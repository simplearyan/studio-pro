# Export A/V Sync Plan — video runs too fast, audio is perfect

**Status:** analysis + plan only — **nothing committed, nothing implemented.**

---

## 1. Symptom

After the clip **speed** feature (constant speed + speed ramps) landed:

- **Canvas preview:** audio + video play perfectly in sync, even at 2× / 0.5× / ramps.
- **MediaBunny export:** the exported video's picture runs **too fast** while the exported audio plays at the correct pace. The two tracks desync over time.

## 2. How the export builds the two tracks (root-cause context)

`startMediaBunnyExport` (index.html:22268) builds audio and video through **completely different mechanisms**:

### Audio — exact, model-derived (this is why it's "perfect")

Audio is **pre-rendered once** with an `OfflineAudioContext` (index.html:22278–22430) before the frame loop:

- Every audio-bearing clip is scheduled with `source.playbackRate.value = clipSpeed(c)` (22299).
- Speed ramps are baked as `setValueAtTime` / `linearRampToValueAtTime` rate curves over the offline window (22341).
- Source offsets use `clipSourcePos(c, …)` = the exact **integral** of the speed ramp (22333), and `srcDur = duration * clipSpeed` (22435) so a 2× clip consumes 2 source-seconds per timeline second — precisely the model.
- The resulting buffer is a **perfect timeline-accurate mix**. Chunks are sent to the worker with their own sample timestamps (`audioSentUpTo * 1e6`, 22800), so the audio track is right regardless of wall-clock timing.

**Audio can never drift** — it is computed from the data model, not from anything that happens in real time.

### Video — live, wall-clock-driven (this is what breaks)

The frame loop (`realtimeExportLoop`, index.html:22727) instead:

1. Creates **fresh** `<video>` elements, `el.playbackRate = clipSpeed(clip)` (22509), or the ramp's start rate (22510).
2. Keeps the **frame-count clock** as the master time: `frameElapsed = lastCapturedFrame * timeStep` (22734), `State.currentTime = startTime + frameElapsed`.
3. Stagger-starts each clip: when `exportTime` crosses the clip start it does a **one-time seek** `entry.el.currentTime = targetTime; el.play()` (22743–22747) — then lets the element **play in real time**.
4. For ramp clips only, it nudges `playbackRate` each frame (22748 area) — but **never touches `currentTime` again**.
5. Captures the current element frame via `drawCanvas(exportCtx, …)` (22768) and sends it with timestamp `frameIndex * timeStep`.
6. Sends audio chunks by **wall clock** (`sendAudioChunksUpTo(wallElapsed)`, 22797) — an explicit admission that the two clocks already differ.

## 3. Root cause

**The video elements play on the wall clock, but the captured frames are stamped with the frame-count clock, and nothing re-synchronizes them — while the audio is pinned to the model clock.**

During the export, each element advances `speed × real-time`. The frame at model time `T_N` is captured at wall time `T_N + δ`, where `δ` is the accumulated **capture lag** (or lead):

- `δ` grows from everything that slows the loop: `createImageBitmap` + frame-ack **backpressure** (the loop awaits every ack, up to 3 s), GPU encode stalls (the code even comments about a GT 740), GC pauses, and **Fast Mode** which intentionally captures "as fast as possible" (2 ms between frames) — the opposite direction, `δ < 0`.
- At the moment frame `N` is actually grabbed, the element has already played to `seek₀ + speed·(T_N + δ)`, so the captured picture corresponds to model time ≈ `T_N + speed·δ`.

With `speed = 1` the drift is `δ` (barely noticeable on short exports). With `speed = 2` it's `2δ`, and with ramps it varies — **the speed multiplier turns a small clock mismatch into a visibly fast/slow picture**, while the audio (model-derived) stays locked. On a machine where export encodes slower than real time, `δ > 0` and the video plays **too fast** — exactly the reported symptom.

### Why the canvas preview is fine

The preview does **per-frame re-seek**: `syncMediaElements` calls `seekMediaEl(el, clipSourcePos(clip, State.currentTime - clip.start), 0.25)` **every animation tick** (index.html:21520). `seekMediaEl` (21213) coalesces latest-wins seeks, waits for the decoded frame, and re-seeks if the target moved — so the element's `currentTime` is constantly **locked to the model clock**. The export loop simply omits this step after the initial seek.

## 4. Fix plan

### Phase A — Frame-accurate re-seek in the export loop (root fix)

Mirror the preview in `realtimeExportLoop`, right before the `drawCanvas(exportCtx, …)` capture (index.html:22768):

- For every active video clip in `exportVideoEls`, compute `target = clipSourcePos(clip, exportTime - clip.start)` and call a **seek with a threshold** (≈ 1.5× `timeStep`, i.e. 1–2 source frames). When the element is within the threshold it's a **no-op** — healthy machines pay zero seek cost and keep real-time playback speed.
- When the element **has drifted** beyond the threshold, re-seek it and **wait for the decoded frame** (`seeked` / `readyState ≥ 2` poll with the existing 400 ms fallback — the `drawWhenFrameReady` / `armVideoFrameLatch` pattern, 21114) before capturing that frame.
- Keep the existing one-time seek at clip start and the ramp `playbackRate` updates; they become cheap accelerators, not the only sync.

This bounds drift to a frame or two in **every** mode (normal, slow GPU, fast mode) and makes the video track match the audio track, because both are now derived from `clipSourcePos`.

### Phase B — Export-safe seek helper (no preview side effects)

`seekMediaEl` calls `drawCanvas()` on settle (preview redraw). For the export we want the same coalescing without repainting the preview canvas behind the overlay. Small refactor:

- Give `seekMediaEl` an optional `paint` callback (default `drawCanvas`), or add a slim `seekExportVideo(el, target, threshold)` that reuses the same latest-wins/coalescing + `_wantedTime` logic but resolves a promise on settle.
- Use `armVideoFrameLatch` on the export elements at creation (they're fresh, so `_frameReady` is never set — the "mock frame at t=0" hazard from the earlier export plan is the same family of bug).

### Phase C — Audio stays untouched

The offline pre-render is already model-exact. **No changes** to the audio path. (Pitch-baked clips already play their stretched buffer at rate 1 — `getClipPlayBuffer` 6073 + `clipSpeed` returning 1 — and that path is consistent with the video element rate.)

### Phase D — Validation (before/after numbers)

1. **Sync test:** build a 3-clip timeline — a 2× clip, a 0.5× clip, and a 0.5×→2× ramp clip — each with a source containing a visible moving timecode or a distinct scene marker.
2. Export and compare, via ffmpeg frame extraction:
   - Timeline t=2 s should show source t=4 s content (2×), etc.
   - Correlate a **visual marker** (e.g. a flash frame added at a known timeline time) against the **audio waveform** of a beep at the same timeline time — measure the offset in ms. Target: ≤ 1–2 frames (~33–67 ms at 30 fps), vs the current unbounded drift.
3. Repeat in **normal** and **fast** mode, and with an artificially stalled ack (e.g. temporarily 200 ms delay) to prove drift stays bounded.
4. Console-drift instrumentation: log `entry.el.currentTime - target` per frame during a test export (reuse the `[MB Timing]` log pattern at 22800 area) to capture exact before/after numbers for the plan.

## 5. Alternatives considered

- **Paused per-frame seek-only (no real-time playback):** the most exact, but abandons the real-time engine and would likely drop capture well below target fps on slow machines; also the team previously hit seek reliability issues (comment at 22482).
- **Rate-correction (PLL):** adjusting `playbackRate` by measured drift is smooth but needs careful tuning and still can't correct a fully-stalled encode. Phase A's threshold re-seek handles the stalled case directly.
- **Pacing capture to wall clock in all modes:** fixes fast mode only; cannot fix the slow-GPU case where capture simply cannot keep up. Phase A fixes both.

## 6. Risks / notes

- Per-frame re-seeks are a no-op when healthy (threshold), so export speed is preserved in the common case.
- Seeks while the element is playing can hiccup for a frame; the settle-wait before capture absorbs that. (Only triggers when drift actually occurred.)
- Reuses proven infrastructure (`seekMediaEl`, `drawWhenFrameReady`, `armVideoFrameLatch`) that already keeps the preview frame-accurate.
- No changes are committed; this doc is the plan only.
