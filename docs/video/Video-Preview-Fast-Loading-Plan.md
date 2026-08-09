# Fast Video Preview Loading — Plan

**Status:** Draft for review — **do not commit until approved**
**Sources analyzed:** [`mediabunny` media-player example](https://mediabunny.dev/examples/media-player/) ([source](https://github.com/Vanilagy/mediabunny/blob/main/examples/media-player/media-player.ts)) vs StudioPro's current preview pipeline in `index.html`.

---

## 1. Problem statement

Importing a video clip adds it to the timeline, but the canvas often shows a **blank / frame-0 / stale frame** until the user scrubs over the clip or moves the playhead into it. Mediabunny's example player, by contrast, shows the first frame almost instantly after import and seeks without perceptible stalls.

Goal: close that gap — make imported video **appear in the canvas immediately** and make scrubbing/seeking feel snappy — borrowing mediabunny's techniques where they fit our multi-clip timeline architecture.

---

## 2. Why mediabunny loads fast (what the example actually does)

`examples/media-player/media-player.ts` is a **WebCodecs player**, not an `<video>`-element player:

1. **Decode-to-canvas, not decode-to-element.** It wraps the video track in a `CanvasSink` (`poolSize: 2`) and iterates decoded frames as `WrappedCanvas` objects. Frames are drawn straight to a 2D context — no `HTMLVideoElement` involved, so there is no buffering/readyState machine.
2. **Look-ahead frame iterator.** `videoSink.canvases(time)` is an async generator that starts decoding at a given time. `startVideoIterator()` immediately pulls **two** frames — draws the first, holds the second as `nextFrame`. `updateNextFrame()` keeps the decoder running ahead of the playhead so the next frame is *already decoded* when the current one is presented. This is the core "fast" trick: **decode stays ahead of the playhead**.
3. **Seek = dispose + restart the iterator.** `seekToTime()` bumps an `asyncId` counter (invalidating any in-flight async work), `return()`s the old iterator, creates a fresh one at the target timestamp, and draws the first decoded frame. Hardware decode + restart-at-keyframe is why seeking feels instant.
4. **One clock for everything.** Playback time is derived from `audioContext.currentTime` so audio and video can never drift; a `setInterval(render, 500)` fallback keeps the canvas updating even when the tab is hidden.
5. **Audio chunk scheduling.** `AudioBufferSink.buffers(time)` yields short chunks scheduled as `AudioBufferSourceNode`s at exact timestamps.

**The three ideas worth stealing:**
- **(A) Keep a decode/frame **look-ahead** so the playhead never waits on the decoder.**
- **(B) Treat a seek as "restart decoding at target + paint first frame"** (cancel stale work, draw immediately).
- **(C) Drive playback from a single high-resolution clock.**

---

## 3. Why StudioPro feels slow today (root causes)

The editor preview uses **one `<video>` element per clip** (`clip.videoEl`), painted with `drawImage`. Current pipeline (line anchors in `index.html`):

| # | Location | Current behavior | Consequence |
|---|----------|------------------|-------------|
| 1 | Import, `~16532–16596` | Creates `<video>` with **no `preload='auto'`** (defaults to metadata-only-ish), `v.load()`, assigns `clip.videoEl`; tail calls `calcOverlaps(); renderClips(); syncMediaElements(); refreshFreshVideoPreview(createdVideoClips); if (!waiting) drawCanvas();` — so it *does* attempt an eager first-frame draw, but the fresh element's `readyState < 1` makes `refreshFreshVideoPreview` register a `loadedmetadata` wait and **skip the immediate `drawCanvas`** | Frame 0 *is* painted ~70 ms in (see §3.5), but a later redraw wipes it and nothing repaints once the frame actually decodes |
| 2 | Markdown video el, `~15544–15557` | Sets `preload='auto'` + `_mdLoaded` latch (correct pattern) | Only markdown media gets the fast path — imports don't |
| 3 | Draw gate, `~4998` | For non-md video, once `clip.videoEl` exists it draws unconditionally | No "wait for first frame" placeholder for plain imports → black frame flash |
| 4 | `syncMediaElements()`, `~20367` | Per-frame sync; paused branch only seeks clips **strictly under the playhead** (`~20590–20594`) | Neighboring clips are never pre-seeked while paused |
| 5 | `isUpcoming` prefetch, `~20410` | `State.isPlaying && (clip.start - State.currentTime) < 0.5` — playing-only, 0.5 s window | No look-ahead when paused; tiny window |
| 6 | `seekMediaEl`, `~20333` | Seeks via `el.currentTime = target`; waits for `loadedmetadata` when `readyState < 1` (`_pendingSeek`) | One `<video>` seek = keyframe + buffering + decode latency; repeated scrubs queue redundant seeks |
| 7 | `drawWhenFrameReady` `~20263` / `refreshFreshVideoPreview` `~20299` | Seek-then-draw-on-`seeked` helper; **only wired to split/duplicate call sites** (`20312/20322/20348`) | The "show correct frame immediately" machinery exists but import never calls it |
| 8 | Frame readiness | `seeked` event + 400 ms timeout | Timeout is a guess; `requestVideoFrameCallback` (rvfc) would be exact where supported |

**Summary of root causes:** (1) import doesn't configure the element (`preload='auto'`) and its eager-draw path races — the first good paint is later overwritten by a blank redraw and never refreshed when the frame decodes; (2) the paused path has no look-ahead; (3) readiness signaling is coarse; (4) `<video>` seeks are inherently heavier than mediabunny's restart-at-keyframe decode.

---

## 3.5 Measured baseline (live, 2026-08-07)

Measured in the running app (`localhost:3000`, Chrome) with a real H.264 file (MDN `flower.mp4`, 960×540, ~1.1 MB) imported through the real `#mediaInput` path, with probes on the clip's video element lifecycle and the main canvas `drawImage`:

| Metric | Value | How it was measured |
|--------|-------|--------------------|
| Import dispatch → clip video element created | **~41 ms** | `document.createElement('video')` probe (a 2nd probe element for duration also appears at ~10 ms) |
| Clip element → `loadedmetadata` | ~68 ms | element event probe |
| Clip element → `readyState >= 2` (frame decodable) | **~78 ms after creation** | 16 ms interval probe |
| First main-canvas `drawImage(videoEl)` | **+69 ms** (`readyState 4`, `currentTime 0`) | `renderCanvas` ctx `drawImage` wrapper |
| Canvas content 1.3 s after import, **no interaction** | **0 / 576 sampled pixels non-background** (pure `#231F20`) | `getImageData` grid sampling |
| Import dispatch → clip visible in timeline DOM | **< 1.3 s** | clip-element poll (handler also decodes audio + builds peaks) |
| After 4+ scrub clicks | 143 / 576 non-background pixels → **video finally visible** | same sampling |
| `drawImage` calls during scrubbing | `readyState 1` (HAVE_METADATA only), `currentTime` = seek target | paint wrapper |

**What this proves:**

1. **Decoding is NOT the bottleneck** — the element reaches a decodable frame in ~78 ms, and frame 0 is painted to the canvas at ~69 ms. Mediabunny-like decode speed is already available; the problem is entirely in the *pipeline glue*.
2. **The initial good paint is wiped.** The canvas is painted with the real frame 0 at ~69 ms, yet 1.3 s later it is 100% background. A subsequent `drawCanvas` pass repaints blank (placeholder branch / pre-decode gate), and because the element never re-seeks and no `loadeddata`→`drawCanvas` latch exists for plain imports, nothing restores it.
3. **Interaction is required and flaky.** After scrubbing, video appears — but the `drawImage` calls that show it fire at `readyState 1` (no frame yet), so visibility depends on a later repaint landing after decode. Each scrub pays a fresh seek.

**User-perceived "first-frame-to-paint": effectively never without interaction (blank canvas), ~1–2 s of scrubbing with interaction.** The fix targets the glue: preload, don't wipe the good frame, and repaint on frame-ready — exactly Phases 1–2 below.

---

## 4. Proposed plan (phased; each phase is independently shippable)

### Phase 1 — Prime on import + stop the wipe (low risk, biggest UX win)

*Driven by §3.5: decode is already fast (~78 ms) and frame 0 paints at ~69 ms — the fix is keeping that frame on screen and repainting when the next one arrives.*

- **1.1 Import config parity** (`~16532`): set `v.preload = 'auto'; v.playsInline = true;` before assigning `src` (markdown path already does this — `~15548`); drop the redundant `v.load()` after the `loadedmetadata` await (it restarts loading).
- **1.2 Don't wipe the good frame:** the import tail's `refreshFreshVideoPreview(createdVideoClips)` registers a wait on a `readyState < 1` element and **skips the immediate `drawCanvas`**, but the frame-0 paint then gets clobbered by a later blank repaint. Fix: after `refreshFreshVideoPreview` returns, if it waited, **re-draw on `loadeddata`/`seeked` AND when `readyState` first reaches 2** (a `readyState` poll or `requestVideoFrameCallback`), so the decoded frame replaces the blank rather than vice versa.
- **1.3 Honest placeholder:** extend the draw gate (`~4998`) so a **plain imported video also shows the "Loading media …" placeholder** until `readyState >= 2` (HAVE_CURRENT_DATA) or `_mdLoaded` — mirroring the existing markdown behavior. Prevents the black-frame flash; the §1.2 latch flips it to the video frame.
- **1.4 Unify priming helper:** add a single `primeVideoClipForPreview(clip)` used by import, split, and duplicate (dedupe the three `refreshFreshVideoPreview` call sites), so every fresh element gets the same eager-seek + frame-ready-latch treatment.

**Result:** import → decoded frame at the playhead stays on screen (no blank wipe), verified by the §3.5 sampling method (expect 576/576-region non-background once the clip is under the playhead).

### Phase 2 — Paused look-ahead + seek hygiene (medium risk)

- **2.1 Look-ahead while paused:** change `isUpcoming` (`~20410`) to apply when **paused too**, and widen the window (e.g. 1.5–2 s ahead of the playhead): when paused and the playhead is within N seconds of a clip's start, `seekMediaEl(el, clip.sourceOffset)` to pre-warm it (the existing paused branch already does this per-clip under the playhead — extend it to *upcoming* clips). This is the editorial-equivalent of mediabunny's iterator look-ahead.
- **2.2 Also pre-seek clips just behind the playhead:** when the playhead is *inside* a clip, after seeking to the exact frame, issue one additional forward prefetch seek (`target + ~0.5 s`) on the same element so the next frame is already in the buffer — a cheap approximation of "keep decode ahead" without rvfc.
- **2.3 Coalesce scrubs:** in the playhead drag handler (`~19125`), skip calling `seekMediaEl` on every `pointermove` — only seek when the accumulated time delta ≥ ~0.15 s (or on `pointerup` with `drawWhenFrameReady`). Prevents seek storms on long scrubs; preserves the `_pendingSeek` "latest target wins" semantics that already exists.
- **2.4 rvfc-based readiness (progressive enhancement):** in `drawWhenFrameReady`, when `el.requestVideoFrameCallback` exists, prefer it over `seeked` + timeout for exact "a frame is ready" signaling; keep the timeout fallback. Note: rvfc fires per presented frame, so the helper should also handle the "fires before our seek lands" case by re-arming once.

**Result:** scrubbing and playhead moves feel responsive; neighboring clips are pre-warmed; long drags don't hammer the decoder.

### Phase 3 — WebCodecs canvas preview (the mediabunny way; high value, opt-in)

Reuse the **already-shipped mediabunny dependency** (export worker already runs it in `src/workers/export-worker.js`) to decode preview frames to an offscreen canvas, bypassing `<video>` entirely for the *preview* path:

- **3.1 `VideoPreviewDecoder` (new module, main thread):** wraps `Input(BlobSource(clip.file))` + `CanvasSink({ poolSize: 2 })`. API mirrors mediabunny's player: `open(clip)`, `seek(t)` → dispose old iterator (`asyncId++`), start `canvases(t)`, paint first frame; `next()` keeps a 1-frame look-ahead while playing.
- **3.2 Frame cache:** small LRU keyed by `(clipId, floor(second))` (cap ~32 frames) so pausing/scrubbing back over recently-seen regions is instant — stronger than `<video>` because seek cost becomes a cache hit.
- **3.3 Integration:** in `drawCanvas`'s video branch (`~5187`), when a clip has a live `VideoPreviewDecoder`, draw `decoder.currentCanvas` instead of `clip.videoEl`; `syncMediaElements` drives `seek(t)`/`next()` instead of `el.currentTime`.
- **3.4 Fallback ladder:** `VideoDecoder` unsupported / codec not decodable / decode error → fall back to the existing `<video>` path (feature-detect once per clip, sticky). Audio keeps using the current element/`AudioBuffer` path — Phase 3 only changes the **video image** source.
- **3.5 Dual-mode parity with export:** the export worker already decodes via mediabunny; a preview decoder uses the same decode pipeline, so "what you see is what you export" improves too.

**Result:** the true mediabunny experience — instant first frame, fast seek, decode-ahead while playing — with graceful degradation.

### Phase 4 — Single clock + polish (small, after Phase 3)

- **4.1 Playback clock:** when playing, derive the playhead from `audioCtx.currentTime` (already the audio master) instead of wall-clock deltas, and let `syncMediaElements` read that — mirrors mediabunny's "one clock" design and keeps A/V in lockstep.
- **4.2 Metrics:** log first-frame-to-paint time per import (`performance.now()` at seek start → `seeked`/rvfc) and seek-p95 during a scrub, so Phases 1–3 can be compared. **Baseline from §3.5:** element decode ≈ 78 ms, first canvas paint ≈ 69 ms after dispatch, but *visible* frame ≈ ∞ without interaction / ~1–2 s of scrubbing with it — the gap between "paint" and "visible" is the number Phases 1–2 must close.
- **4.3 Memory cap:** guard the Phase 3 cache by total bytes (~64 MB), evict LRU, and dispose decoders when a clip is deleted / element swapped.

---

## 5. Explicitly out of scope (or deferred)

- Replacing the **audio** preview path with mediabunny `AudioBufferSink` — current `AudioBuffer`/element path is fine and heavily feature-tested (SFX, fades, automation). Revisit only if sync issues appear.
- Live-input / streaming sources (markdown URLs, etc.) in Phase 3 — decoder needs a seekable blob; keep `<video>` for remote URLs unless range requests are confirmed.
- Multi-track "render every visible clip via WebCodecs simultaneously" — decode only the clip(s) under the playhead; full decode is the export worker's job.

---

## 6. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| WebCodecs not available (Firefox/Safari today) | Phase 3 is strictly additive behind a feature gate; `<video>` path remains the default and is improved by Phases 1–2 anyway |
| Extra memory from decoded frame cache | LRU + byte budget (4.3); canvases are pool-cycled, not retained beyond the budget |
| Scrubbing regression from coalescing (2.3) | Threshold is small (0.15 s); final position always exact via `pointerup` → `drawWhenFrameReady` |
| Import regressions (placeholder shown forever on slow files) | Placeholder latch mirrors the existing markdown `_mdLoaded` pattern incl. `seeked` + timeout fallback; retry/cooldown logic already exists (`_videoRetries`, `_videoGiveUpAt`) |
| Behavior drift between preview & export | Phase 3 shares mediabunny's decode; keep the `<video>` fallback visually equivalent |

---

## 7. Suggested implementation order

1. **Phase 1** (1.1–1.4) — one PR-sized change, low risk, immediate visual win on import.
2. **Phase 2** (2.1–2.4) — scrub/look-ahead polish; verify with the p95 seek metric from 4.2.
3. **Phase 3** (3.1–3.5) — new decoder module + canvas-branch switch + fallback ladder; largest change, gated & testable independently.
4. **Phase 4** (4.1–4.3) — clock unification + metrics + memory guards.

Each phase keeps the editor fully functional if rolled back; nothing here changes export behavior in earlier phases.

---

*Prepared for review — no code changes or commits made yet.*
