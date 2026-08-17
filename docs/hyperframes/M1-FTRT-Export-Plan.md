# M1 — FTRT Export Mode (Revised Plan: side-by-side tab, MediaBunny untouched)

> **Date:** August 2026
> **Status:** Plan (revised). Supersedes the *"replace the wall-clock `realtimeExportLoop`"* framing in [Agent-Authoring-and-Automation-Plan.md](./Agent-Authoring-and-Automation-Plan.md) §C.2 and [Render-Speed-Analysis-and-Plan.md](./Render-Speed-Analysis-and-Plan.md) — it was written before we inspected the actual loop.
> **User requirement (the re-plan):** keep the current MediaBunny export logic **exactly as it is**; add the new FTRT mode as a **new tab** in the export modal; if the new mode fails on a weak GPU (GT 740 @ 4K → freeze risk), the user can fall back to the current MediaBunny export; and give the user a way to **compare speeds** of the two modes for markdown clips.
> **Builds on:** [M0-Determinism-Spec.md](./M0-Determinism-Spec.md) (committed `f13c260`) — quantized seeks, seeded PRNG, parity harness. Code refs are `index.html` (30,311 lines).

---

## 1. The re-plan in one paragraph

Don't touch the MediaBunny path at all. Add a **fourth tab — "Fast (FTRT)"** — next to Video / MediaBunny / Audio in the existing export modal (`switchExportTab`, index.html:28847). It runs a **new orchestrator** `startFTRTExport()` that reuses the same MediaBunny encode worker, muxer, and deterministic `OfflineAudioContext` audio pre-render (via read-only extraction of shared helpers), but drives capture with an **un-paced frame pump** (quantize → draw → `createImageBitmap` → worker, backpressured). It ships with a **stall watchdog + one-click "Fall back to Standard"** for weak-GPU freezes and a **speed-comparison probe** so the user can measure markdown-clip exports in both modes. The MediaBunny tab is the safety net — its code diff must be **zero**.

---

## 2. Reality check — what actually makes today's export real-time (verified)

Before planning a "replacement", we inspected the real loop (`realtimeExportLoop`, index.html:30053). The honest picture:

| Fact | Where | Implication |
|---|---|---|
| The time source is **already frame-indexed** — `frameElapsed = lastCapturedFrame * timeStep`, `State.currentTime = startTime + frameElapsed` | 30067–30068 | The clock is NOT wall-clock (older docs were stale). M0 quantization already makes preview seeks land on the same grid. |
| **Normal mode paces each frame** to exactly `1000/fps` ms (`waitMs = nextFrameDueMs - elapsedMs`) | 30214–30219 | This is the real-time constraint for *all* clips in normal mode. |
| **Fast Mode** (existing checkbox, off by default) removes pacing — `setTimeout(realtimeExportLoop, 2)` | 30211–30213 | Text/markdown-only timelines in Fast Mode are **already un-paced today**. |
| Live `<video>` elements are created and played at 1×; per-frame drift re-seek | 30075–30110 | The **only true 1× dependency**: video clips must play live. Empty for text-only timelines. |
| Audio chunks are streamed by **wall clock** (`sendAudioChunksUpTo(wallElapsed)`) | 30131 | Audio itself is pre-rendered deterministically (OfflineAudioContext, 29623+); the wall-clock streaming is just a feed-order choice. Muxing is by timestamp, so sending all chunks up-front is equivalent. |
| Worker ack awaited per frame with 3 s safety timeout; `MAX_IN_FLIGHT = 5` | 29929, 30146–30163 | Backpressure exists; encode runs in the worker (GT 740-safe pattern: `createImageBitmap`, never `transferToImageBitmap`). |

**So what the new tab actually adds over today:**
1. A **first-class, always-on FTRT mode** — no dependency on the hidden Fast Mode checkbox, with its own tab + copy.
2. **Determinism by construction** — M0 guarantees scrub(t) == export-frame(t); the new loop quantizes every seek.
3. **A genuinely fast text/markdown path** — zero video machinery when no video clips exist (today the loop still runs the element-sync blocks as no-ops and the 2 ms timeout only in fast mode).
4. **Safety for GT 740 @ 4K** — stall watchdog + auto-fallback, so a bad run degrades gracefully instead of freezing.
5. **Comparison UX** — measure both modes on the same range.

---

## 3. Design

### 3.1 The new tab (UI)

- Add a tab button `exportTab-ftrt` (zap/rocket icon, "Fast" / "FTRT") and group `exportGroup-ftrt` with the same MP4 (H.264) / WebM (VP9) cards the MediaBunny group uses — the FTRT mode encodes through the **same worker + muxer**.
- `switchExportTab` (28847): register `'ftrt'` in `tabStyles`, the `['standard','mediabunny','audio']` loop (add `'ftrt'`), and the FPS/Resolution visibility rules (same as mediabunny — frame-by-frame capture). `checkChromium()` guard applies like mediabunny (WebCodecs).
- Tab copy: *"Fast render — seeks frames directly, no 1× wait. Best for text/markdown. Fall back to MediaBunny if slow."*
- In-tab sections: **Expected speed** (auto-computed: video-clip count → "un-paced" vs "1×"), **Compare** (probe, §5), **Safety** (watchdog status).

### 3.2 Shared-helper extraction (read-only — the only touch to existing code, and it must not change behavior)

Everything today lives inside `startMediaBunnyExport`'s closure (29596+). `startFTRTExport` needs the same building blocks. **Mechanical, read-only extraction** — move these bodies verbatim to module-level functions, called identically by both orchestrators:

| Piece | Today (inside closure) | Extract to |
|---|---|---|
| OfflineAudioContext pre-render (audioClips filter, gain graph, SFX mix, chunk split) | 29614–~29780 | `preRenderExportAudio(startTime, endTime) → { chunks, sampleRate }` |
| Worker init + `sendFrameToWorker(bitmap, frame)` | ~29780–29900 | `createMbWorker(format)` + `sendFrameToWorker` (module-level) |
| Mux + download (flush audio chunks, blob, filename) | ~30240–30305 | `finishMbExport(...)` |
| `cleanupExport` | 30021–30052 | module-level `cleanupExport()` |
| Video element setup + sync (staggered play, drift re-seek) | 29930–30052 | left **inside** `startMediaBunnyExport` (FTRT doesn't use live elements in M1a) |

**Guardrail:** after extraction, run a full MediaBunny export of a known project and verify: same settings flow, same file produced, `git diff index.html` shows **no changes inside `startMediaBunnyExport` / `realtimeExportLoop` / `cleanupExport` other than the call-site swaps** (e.g. `preRenderExportAudio(...)` where the inlined block was). If a diff is more than a mechanical call swap, the extraction is wrong.

### 3.3 The FTRT loop (`startFTRTExport`)

```js
window.startFTRTExport = async function (exportW, exportH, fps, startTime, endTime, format) {
    const timeStep = 1 / fps;
    const totalFrames = Math.ceil((endTime - startTime) / timeStep);
    const hasVideoClips = State.clips.some(c => c.type === 'video' && overlaps(c, startTime, endTime));

    // Audio: pre-render once (deterministic, timestamped) and queue ALL chunks
    // up-front instead of streaming by wall clock (equivalent mux, FTRT-safe).
    const { chunks, sampleRate } = await preRenderExportAudio(startTime, endTime);
    const worker = createMbWorker(format);

    const exportCanvas = createOffscreenCanvas(exportW, exportH);
    const exportCtx = exportCanvas.getContext('2d');
    let lastCapturedFrame = -1;
    let framesInFlight = 0;
    let lastAckAt = performance.now();
    const stallMs = 8000;                    // watchdog threshold (§4)

    while (lastCapturedFrame < totalFrames - 1 && !State.cancelExport) {
        const targetFrame = lastCapturedFrame + 1;
        const t = startTime + targetFrame * timeStep;   // already on the fps grid (M0)
        State.currentTime = t;                           // quantizeTimeToFrame(t) is identity here

        // Watchdog: no ack within stallMs → offer fallback (§4).
        if (performance.now() - lastAckAt > stallMs) { await offerFallback(); if (aborted) break; }

        drawCanvas(exportCtx, exportW, exportH);
        const bitmap = await createImageBitmap(exportCanvas);   // GT 740-safe read
        framesInFlight++;
        sendFrameToWorker(bitmap, targetFrame);
        await ackForFrame(targetFrame);                        // MAX_IN_FLIGHT backpressure
        lastAckAt = performance.now();
        lastCapturedFrame = targetFrame;

        if (hasVideoClips && videoMode === 'degrade') {
            // M1a: video clips force 1× — pace to the real-time budget (§6 decision).
            const due = (lastCapturedFrame + 1) * (1000 / fps);
            const wait = Math.max(2, due - (performance.now() - wallStart));
            await new Promise(r => setTimeout(r, wait));
        }
        updateFTRTProgress(lastCapturedFrame, totalFrames, fps);   // + live fps + speedup readout
    }
    await finishMbExport(worker, chunks, sampleRate, format);      // same mux as MediaBunny
};
```

**Why this is faster for text/markdown:** no video elements, no precision pacing, no wall-clock audio feed — the loop is bounded only by draw + `createImageBitmap` + encoder ack. Text/shape/math/scene timelines go FTRT on day one (same claim as the old plan, now true because the loop actually exists as its own path).

---

## 4. GT 740 / 4K freeze safety (the user's stated fallback reason)

The standard MediaBunny path already carries the Kenichi-style GPU protections; **the FTRT mode inherits all of them** (`createImageBitmap`, worker encode, `MAX_IN_FLIGHT`, 3 s ack timeout). The new mode **adds**:

1. **Stall watchdog** — if no frame ack lands within `stallMs` (8 s default), show an in-modal dialog: *"The fast renderer seems stalled (your GPU may be struggling with 4K). Switch to the Standard MediaBunny export?"* → **Continue waiting** / **Abort & use MediaBunny** / **Cancel**. Choosing MediaBunny aborts cleanly (`cleanupExport`) and relaunches the **standard path with the identical settings** (`startMediaBunnyExport(exportW, exportH, fps, startTime, endTime, format)`) — one click, same output.
2. **Frame-time monitor** — rolling average of per-frame wall time. If it exceeds ~3× the frame budget and is still climbing, surface a non-blocking warning with the same fallback button (the freeze rarely happens instantly; this catches the climb first).
3. **Resolution-aware default** — when the FTRT tab is selected at 2160p on a detected weak GPU (no `navigator.gpu`, or WebCodecs avc encode latency measured > threshold during the first frames), pre-check the stall dialog and show the fallback path immediately.
4. **Cancel** — reuses existing `State.cancelExport` + progress plumbing; cleanup is identical.

**The fallback is the product promise:** FTRT is a fast lane, MediaBunny is the safe lane, and the user can switch mid-run without losing settings.

---

## 5. Speed comparison for markdown clips

- **Probe ("Compare")** — a button in the FTRT tab. It runs a short range (default 5 s, or the user's custom range if set) twice: once through the **standard MediaBunny loop** (normal pacing) and once through **FTRT**, using hidden canvases. Result card:
  ```
  Compare 5s of this project (30 fps, 1080p)
  Standard (MediaBunny):  5.1s wall   = 1.0× real time
  Fast (FTRT):            1.4s wall   = 3.6× real time   ← 3.6× faster
  ```
- **Post-export readout** — after any FTRT export completes: "Exported 60s in 14.2s (**4.2× real time**)". The standard-mode wall time from the last probe (or the last MediaBunny export of the same range) is shown beside it.
- **Console table** (dev) — every FTRT export logs `[FTRT] frames, wall, fps, ×real` per completed export so the user can compare across markdown presets/versions.
- **Honest scope:** for video-clip timelines in M1a the FTRT number is expected ≈ MediaBunny (both 1×) — the comparison is meaningful for text/markdown now, and for video after M1b's frame pool.

---

## 6. Phases

| Phase | Work | Outcome | Est. |
|---|---|---|---|
| **M1a — Tab + text/markdown FTRT** | `exportTab-ftrt` + `exportGroup-ftrt`; read-only extraction of audio/worker/mux helpers; `startFTRTExport` fast path (no video machinery); watchdog + fallback dialog; post-export speed readout | Markdown clips export FTRT in the new tab; MediaBunny tab byte-identical; GT 740/4K degrades to a dialog instead of freezing | 1–2 days |
| **M1b — Video clips** | Decision (§6 below) then either 1× auto-degrade in the FTRT loop or the M1.2 video frame pool (pre-decode → `ImageBitmap[]` sliding window, `drawImage(pool[frame])`) | Video timelines also FTRT; removes the last 1× dependency | 3–5 days (frame pool) |
| **M1c — Compare probe + polish** | `Compare` probe button + result card; frame-time monitor warnings; weak-GPU pre-check; regression checklist | The comparison UX from §5; full acceptance criteria | 1 day |

**Recommended order:** M1a → M1c (probe only needs M1a) → M1b. M1c's probe can land inside M1a if convenient — it only reads both loops.

**Open decision (default chosen unless you say otherwise):** video clips in the FTRT tab during M1a → **auto-degrade to 1×** (the loop still works, just not fast) with a notice "video clips export in real time in this mode — frame-pool speedup comes in a later update", instead of blocking. Blocking forces a tab switch; degrading keeps one code path.

---

## 7. Acceptance criteria (M1 done = all of these)

- [ ] **MediaBunny untouched:** `git diff` of `index.html` shows zero behavior changes inside `startMediaBunnyExport`, `realtimeExportLoop`, `cleanupExport` — only mechanical call swaps for extracted helpers. The MediaBunny tab exports a known project with identical output (before/after hash compare of the file).
- [ ] New **Fast (FTRT)** tab appears next to the others; `switchExportTab('ftrt')` shows FPS/Resolution and selects MP4/WebM; `checkChromium()` guard matches mediabunny.
- [ ] A 60 s text/markdown project exports via FTRT in **< 60 s wall time** (measure × real-time on the user's machine); the readout shows the speedup.
- [ ] Determinism: the FTRT output frame-for-frame matches a MediaBunny export of the same project (M0 parity harness hash per frame) — same project → same pixels.
- [ ] **Fallback works:** simulating a stalled worker (or a 4K range on the GT 740) triggers the watchdog dialog within `stallMs`; "Use MediaBunny" aborts cleanly and relaunches the standard export with identical settings; cancel works at any point.
- [ ] Audio in FTRT output is in sync and identical to MediaBunny output (timestamp-muxed chunks, pre-rendered — no wall-clock dependency).
- [ ] Video-clip timelines: either auto-degrade notice + 1× correctness, or (M1b) FTRT via frame pool.
- [ ] `Compare` shows both modes' wall time + × real-time for the probe range.
- [ ] `npm run build` passes; no console errors; progress bar / ETA / cancel UX intact.

---

## 7.1 M1a status (2026-08-17) — implemented, verified live

**In `index.html` (uncommitted):** `startFTRTExport()` wired to the Fast tab (`video-ftrt-mp4` / `video-ftrt-webm` formats → `startExport` branch), the stall-watchdog fallback dialog markup, and the one mechanical swap: the inline audio pre-render moved to a shared `preRenderExportAudio(startTime, endTime)` (byte-verified identical to the original block against `git HEAD`, modulo `return renderedBuffer;`). MediaBunny's loop is otherwise untouched.

**Verified live in the dev webview (real worker):**
- ✅ 5 s text timeline @ 12 fps 1080p MP4 → **exported in 1.7 s = 3.01× real-time**, success modal shows `MP4 · ⚡ 3.0× real-time`, download fired.
- ✅ 3 s @ 90 fps 4K WebM (VP9) → completed in 9.3 s = 0.32× (4K draw-bound on this GPU — worked, no freeze).
- ✅ Progress bar / timer / fps / cancel plumbing updates.
- ✅ Worker-error path → clean "Fast export failed" notice modal (triggered via invalid 1×1 avc config).
- ✅ Reversed-video pre-flight → routes straight to MediaBunny with **identical settings** (verified args: 1920×1080, 30 fps, 0–5 s, mp4).
- ⚠️ Stall watchdog + "Switch to MediaBunny" dialog: logic + markup in place; the natural trigger is a **total worker hang** (no acks, no errors) which the healthy dev machine cannot produce — the fallback relaunch call (`window.startMediaBunnyExport(exportW, exportH, fps, startTime, endTime, format)`) is the same one verified via the reversed-video path. To be confirmed on the user's GT 740 under a genuinely hung workload.
- ⚠️ Video 1× degrade (existing-element staggered play + 1× pacing): code in place; needs a real video export to exercise — user-machine check.

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Helper extraction breaks the safe path | Read-only mechanical moves; before/after file hash on a MediaBunny export; acceptance criterion #1 |
| FTRT still freezes at 4K on GT 740 | Watchdog + frame-time monitor + one-click fallback; `createImageBitmap` (never `transferToImageBitmap`); worker encode |
| Audio desync at FTRT speed | Audio is pre-rendered deterministic (`OfflineAudioContext`) and muxed by timestamp — feed all chunks up-front; identical to MediaBunny mux |
| Users expect FTRT for video clips immediately | Auto-degrade + honest notice in M1a; frame pool in M1b |
| Two loops drift apart over time | Both call the same extracted helpers; M0 parity harness checks frame equality |

---

## 9. Docs to update alongside

- `Agent-Authoring-and-Automation-Plan.md` §C.2 — replace "replace the wall-clock realtimeExportLoop" with a pointer to this doc (side-by-side mode).
- `Render-Speed-Analysis-and-Plan.md` — mark the "replace the loop" section superseded; keep its GT 740 measurements as the baseline for the comparison probe.
- `M0-Determinism-Spec.md` §8 — M1 now means "add the FTRT mode", not "remove the pacing from the existing loop".
