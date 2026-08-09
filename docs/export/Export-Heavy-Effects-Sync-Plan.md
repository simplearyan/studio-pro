# Export Desync with Heavy Effects — Analysis & Plan

**Status:** analysis + plan only — **nothing committed, nothing implemented.**

**Source report:** `_exports/About.md` (user-written repro notes)
**Evidence files:** `_exports/StudioPro_Export_MediaBunny (44).mp4` (with effects), `_exports/StudioPro_Export_MediaBunny (50).mp4` (no effects)
**Related doc:** `docs/export/Export-Video-Audio-Sync-Plan.md` (same root cause, speed-triggered view)

---

## 1. The problem (from About.md)

User imported `_demo_assets/videos/…_The truth about gut health.mp4` and exported the first 60 s with captions, twice:

| Export | Effects | Wall time | Result |
|---|---|---|---|
| `(44).mp4` | **Color grading** (+ a shape overlay with multiply blend on top) | ~1:30 for 60 s | **Video runs too fast** while audio + captions are perfect |
| `(50).mp4` | None (captions only) | ~60 s for 60 s | Video + audio + captions perfectly in sync |

The user also tested **v1.0, v0.6, v0.5** (tagged baselines) and saw the **same** behavior in all of them: clean export = fast + in sync; heavy-effect export = slow + video ahead of audio. So this is **not** a speed-feature regression — it predates the speed feature and is purely effect-cost-driven.

## 2. Measured evidence (this analysis)

Both files were probed with ffmpeg. **Track lengths are identical** — h264 1920×1080 @ 24 fps, 1440 frames (= 60.0 s), aac 48 kHz stereo, container 60.01 s. The desync is therefore **inside the video content**, not a short track.

Frame-level cross-correlation (PSNR of export frames against source frames at known times, source is 630 s long):

| Export frame at audio-time | Best-matching source frame | Drift |
|---|---|---|
| **(44) @ 20 s** | source **36 s** | **+16 s** (video ahead) |
| **(44) @ 40 s** | beyond 46 s (window edge, rising) | ≥ +6 s, still growing |
| **(44) @ 55 s** | no clean match in 46–60 s (scatter 5–10 dB) | video is *far* outside the 60 s window |
| **(50) @ 20 s** | source 20 s (sharp 19.5 dB peak) | 0 s |
| **(50) @ 40 s** | source 40 s (sharp 20.4 dB peak) | 0 s |
| **(50) @ 55 s** | source 55 s (sharp 23.7 dB peak) | 0 s |

The `(44)` drift grows with time: ~+16 s by model-time 20 s and increasing — the capture loop falls further and further behind the wall clock. At model 55 s the element is already ~1.5 min into the source (beyond the export range), which is why no source frame in 46–60 s matches.

## 3. Root cause

The export builds the two tracks with **two different clocks**, and heavy effects widen the gap:

- **Audio is pre-rendered once** with an `OfflineAudioContext` from the data model (`index.html:22278–22311`) — it is exact by construction, so it can never drift. **That's why the audio is always perfect.**
- **Video is captured live**: fresh `<video>` elements get a one-time seek at clip start (`el.currentTime = sourceOffset`, `index.html:22528`) and then `play()` (22746) at `playbackRate = clipSpeed` (22509). The loop advances on the **frame-count clock** (`frameElapsed = lastCapturedFrame * timeStep`, `index.html:22734`; capture at `drawCanvas(exportCtx, …)`, 22768) and **never re-seeks `currentTime` again** (only the ramp `playbackRate` is nudged, 22750).

So: while the loop is busy, the element keeps playing at wall-clock rate. The captured frame at model time `T` shows source content from `T + δ`, where `δ` is the accumulated capture lag:

- Heavy effects make each frame slow: **color grading** runs a per-pixel `getImageData/putImageData` pass at 1920×1080 on *every video frame* (video clips are deliberately not cached — their frames advance), and the **multiply-blend overlay** adds a second composited draw. Capture rate drops below 24 fps.
- `(44)` took 90 s of wall time for 60 s of model time ⇒ capture ≈ 1.5× slower than real-time ⇒ at model 20 s the element has already played ~36 s ⇒ **drift ≈ +16 s and climbing**. This matches the measured numbers (early drift ratio ≈ 1.8, dominated by slow first frames / encoder warmup).
- `(50)` ran at ≈ 1.0× wall time ⇒ drift ≈ 0 — exactly what the user observed.

The canvas preview never has this bug because `syncMediaElements` calls `seekMediaEl(el, clipSourcePos(...), 0.25)` **every tick** (`index.html:21520`), permanently locking the element to the model clock. The export loop simply omits that step after the first seek. This is the same root cause as `docs/export/Export-Video-Audio-Sync-Plan.md` — that doc is the speed-triggered view, this one is the effect-cost-triggered view.

## 4. Possible solutions (options)

### A. Per-frame re-seek to the model clock (primary — recommended)
Before each `drawCanvas(exportCtx, …)` capture, compute `target = clipSourcePos(clip, exportTime − clip.start)` and re-seek any element that has drifted beyond ~1–2 source frames (`Math.abs(el.currentTime − target) > threshold`). Healthy machines re-seek at most every few frames (a no-op when within threshold) so export speed is preserved; lagging machines get pulled back to the exact frame, bounding drift to ±2 frames in every mode (normal, slow GPU, fast mode). This is the proven preview mechanism (`seekMediaEl`, 21213) made export-safe.
- **Pros:** correct in all modes; reuses proven logic; fixes both this bug and the speed/ramp sync bug in one place; no quality change.
- **Cons:** a drifted frame costs one seek + frame-wait (bounded 400 ms fallback); export wall time can rise slightly on very slow machines (still correct).

### B. Lock the element's playback rate to the measured capture ratio
Measure the running wall/model ratio and set `el.playbackRate = clipSpeed × (modelElapsed / wallElapsed)` every N frames so the element plays *as fast as capture* instead of racing ahead.
- **Pros:** cheap (no seeks); keeps element streaming smoothly.
- **Cons:** rate estimation lags; doesn't fix bursts (encoder stalls, GC); per-clip rates with ramps get complicated; fast mode (negative lag) needs the inverse. Riskier than A — best used as a secondary smoothing on top of A.

### C. Render video offline (no live elements)
Decode video per-frame into ImageBitmaps (e.g. via the MediaBunny/WebCodecs video decoder already in the export worker) and draw each frame at exactly model time, like the audio offline path.
- **Pros:** eliminates the two-clock problem entirely — the ultimate fix; enables frame-exact fast export.
- **Cons:** a large change (decode + demux plumbing into the worker, alpha/hardware-accel caveats); more moving parts; bigger risk. Good as a later phase/rewrite, not a quick fix.

### D. Pause/step the element per frame
Pause the element, seek to the exact frame, wait for `seeked`, capture, then advance. (i.e. "seek-per-frame always".)
- **Pros:** dead simple, exact.
- **Cons:** kills export speed on healthy machines (seek latency per frame even when in sync) — only acceptable when the re-seek threshold in A says we've drifted. A's thresholded version supersedes this.

### Recommendation
**A (thresholded re-seek), with B's rate-lock as an optional accelerator.** C is the long-term architecture if export speed becomes a priority later.

## 5. Implementation plan

**Phase 1 — Export-safe seek helper**
- Add `seekExportVideo(el, target, threshold)` beside `seekMediaEl` (`index.html:21213`): same latest-wins coalescing + `_wantedTime` re-seek + settle promise on `seeked` / `readyState ≥ 2` with the existing 400 ms fallback, but **no preview `drawCanvas()` repaint** (accept a paint callback, default `drawCanvas`, pass a no-op for export).
- `armVideoFrameLatch` the fresh export elements at creation (22509 area) so the `_frameReady` gate clears the instant the first frame decodes (also fixes the "mock video first frame" hazard from `docs/export/Export-First-Frame-Mock-Plan.md`).

**Phase 2 — Wire into the MediaBunny loop** (`index.html:22727` …)
- In the loop, right before capture (22762–22768), for each active export video element:
  - `target = clipSourcePos(clip, exportTime − clip.start)` (or `sourceOffset + exportTime − clip.start` for constant speed),
  - if `Math.abs(el.currentTime − target) > Math.max(1.5 × timeStep, 1/24)` → `await seekExportVideo(el, target, …)` (bounded), else no-op.
- Keep the one-time start seek (22745) and ramp `playbackRate` nudge (22750) — they become accelerators, not the only sync.
- Same treatment in the **standard (non-MediaBunny) capture path** (`index.html:22120–22168`, which also uses `drawCanvas(exportCtx, …)` at 22168) so both exporters benefit.

**Phase 3 — Audio**
- No changes — the offline pre-render (`22278`) is model-exact.

**Phase 4 — Validation (before/after numbers)**
1. Re-run the exact About.md repro: same source, 60 s export, color grading + multiply overlay on top.
2. Re-run the PSNR cross-correlation (method in §2): assert drift at model 20/40/55 s is ≤ ~2 frames for the effect export, and stays 0 for the clean export.
3. Add a 2× and a speed-ramp clip with a visible timecode marker + a beep at the same timeline time; ffmpeg-compare the marker's position against the audio waveform (also covers the speed sync plan's Phase D).
4. Regression: fast mode and a stalled-GPU scenario (throttle via DevTools CPU 6×) — assert drift stays bounded.

**Out of scope:** offline video render (Phase C / option C), MediaBunny worker decode rewrite.

## 6. Notes

- Verified the mechanism is version-independent: user tested v0.5/v0.6/v1.0 with identical symptoms. The speed feature only *multiplies* the same drift when speed ≠ 1.
- The color-correction cache (image clips cached; video clips intentionally not) means every video frame pays the full per-pixel grade — the primary reason `(44)` captures ~1.5× slower than real-time. Optionally cache-grading video frames at reduced resolution (e.g. half-res per-pixel pass) to shrink `δ` itself; this reduces but does not eliminate the desync, so Phase 1–2 remain the core fix.
- Probe artifacts used for this analysis live in `_tmp_probe/` (deleted after analysis; reproducible with the commands in §2).
