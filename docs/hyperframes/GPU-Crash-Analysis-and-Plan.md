# GPU Crash on the 30 s Graded-Video Compare — Analysis & Fix Plan

> **Date:** 2026-08-17
> **Status:** Analysis complete, evidence collected — fixes planned (P0/P1/P2)
> **Environment:** GT 740 (1 GB VRAM) · Studio Pro `index.html` · Fast (FTRT) tab **Compare probe**
> **Symptoms:** 30 s markdown compare ✅ · 10 s graded-video compare ✅ · **30 s graded-video compare → screen goes black, GPU driver TDR**

---

## 1. What actually happened (the user's sequence)

| Run | Range | Result |
|---|---|---|
| Markdown animation clips | 30 s @ 22 fps | ✅ **8.44×** — no grade, no per-frame canvas |
| Feature film + hue changes | 10 s @ 22 fps | ✅ **1.97×** — worked, slower (video + grade) |
| **Same video + hue changes** | **30 s @ 22 fps** | ❌ **black screen, GPU crash** |

The crash is **specific to a long range of *graded video***. Text/markdown (even 30 s) is fine; short graded video is fine. Only the long graded-video run kills the GPU.

---

## 2. Root cause — verified in code and by measurement

### 2.1 The per-frame full-res grade canvas (the allocation bomb)

`applyColorCorrection()` (index.html ~4800) creates a **fresh `1920×1080` canvas for every frame of a graded *video* clip**:

```js
if (clip.type === 'image' && clip._ccCache && …) return clip._ccCache.canvas;  // image clips CACHE
const canvas = document.createElement('canvas');                                // video clips: NEW canvas EVERY frame
canvas.width = cw; canvas.height = ch;                                          // 1920×1080 = 8.3 MB GPU texture
```

The cache is gated on `clip.type === 'image'` — **video clips are never cached** (their source advances every frame), so every draw allocates a new 8.3 MB GPU-resident canvas, runs the filter/overlay pass into it, and throws it away for GC.

### 2.2 The un-paced FTRT pass has no backpressure

The probe's fast pass (index.html ~29115) is a pure pump:

```js
for (let f = 0; f < frames; f++) {
    await renderFrame(f);   // drawCanvas + createImageBitmap + close
    await sleep(0);         // no pacing, no in-flight cap
}
```

By contrast, the **MediaBunny export loop that provably works on this card** (index.html ~30370) waits for the worker's `frame-processed` ack before drawing the next frame — **one frame in flight**, giving the GPU process time to retire and reclaim. Its comments even name the GT 740: *"createImageBitmap (async…) instead of transferToImageBitmap (sync, stalls GPU pipeline 30–50 ms on GT 740)… prevents GPU driver timeout/BSOD."* The probe throws that protection away.

### 2.3 Measured evidence (safe 8 s run on the same machine, instrumented)

Instrumented `document.createElement('canvas')` during an 8 s graded-video Compare run (240 frames × 2 passes):

| Metric | Value |
|---|---|
| 1920×1080 canvases created | **484** (≈ 1 per frame) |
| Cumulative GPU-backed bytes | **≈ 4 GB** |
| Fast-pass allocation burst | 240 canvases ≈ 2 GB **in ~1.3 s** (184 fps) |

**Extrapolation to the crash:** 30 s @ 22 fps = 660 frames × 2 passes = 1320 allocations ≈ **11 GB cumulative** against a **1 GB VRAM** card. The GPU process cannot reclaim that fast with zero backpressure → VRAM exhaustion → **Windows TDR driver reset → black screen**.

This explains every data point:
- 30 s markdown ✅ — text clips never call `applyColorCorrection` (0 allocations).
- 10 s video ✅ — 440 allocations ≈ 3.7 GB cumulative; under the cliff.
- 30 s video ❌ — 1320 allocations ≈ 11 GB; over the cliff.
- MediaBunny export of the same video ✅ — worker-ack backpressure keeps allocations at ~1 in flight.

### 2.4 The "corrupt video" theory — disproven for the demo file

`ffprobe` + full `ffmpeg -v error` decode of `_demo_assets/videos/We are making a feature film!_1080p.mp4` (H.264 1920×1080 24 fps, 1670 frames, 69.7 s): **zero decode errors, clean container**. The file is not the cause. (The draw path already has decode-error recovery — `_videoLastGoodT` / `_lastGoodFrame` / retry — so a genuinely bad file would degrade gracefully, not black-screen.)

---

## 3. Fix plan

### P0 — immediate (kills the crash mechanism)

1. **Reuse a scratch canvas for video grades.** Add a module-level `_ccScratch` canvas in `applyColorCorrection`; resize only when dimensions change; redraw content every call (video frames aren't cacheable by content, but the **allocation** is). Image clips keep the `_ccCache` path. Effect: **zero** full-res canvas allocations per frame — for the probe, the future FTRT export, *and* live scrubbing of graded video.
2. **Pause video elements while the probe runs.** The probe currently draws whatever live frame a *playing* element shows (the UI even warns "video clips in range may appear blank"). Pausing removes the uncontrolled DXVA decode + texture-upload load from the measurement. (Exact per-frame seek sync is M1b's frame-pool job — out of scope here.)
3. **Backpressure floor in the fast pass** — `await sleep(3)` per frame (mirrors MediaBunny fast mode's `setTimeout(2)`). Costs ~nothing on the ×-ratio (3 ms vs 23+ ms/frame draw) and bounds burst allocations to ≤ ~300/s instead of unlimited.

### P1 — safety rails (so a slow GPU degrades, never crashes)

4. **Frame-time watchdog in the probe** — track per-frame draw time; if 10 consecutive frames exceed ~150 ms, **abort** with `"GPU too slow for this range — use the MediaBunny tab"` instead of plowing into TDR territory. Same concept as the M1 plan's 8 s stall watchdog, applied to the probe.
5. **VRAM footprint warning** — estimate live grade-texture bytes (`frames × exportW × exportH × 4`) before a graded-video run; if > ~250 MB (a quarter of the GT 740), warn and/or auto-cap the probe duration at 15 s.

### P2 — the real FTRT export (M1a) inherits all of it

6. `startFTRTExport()` must ship with the scratch canvas, **worker `frame-processed`-ack backpressure** (the exact pattern that makes MediaBunny safe), the stall watchdog, and the **"Use MediaBunny" fallback dialog** (M1 plan §3). The probe stays capture-only; the export adds encode + file.

---

## 4. Acceptance criteria

- [ ] 30 s graded-video Compare completes on the GT 740 without TDR (expect ≈ same ×-ratio as the 10 s run, minus pacing-floor overhead).
- [ ] Re-running the three-test suite (30 s markdown / 10 s graded video / 30 s graded video) — no crash; results logged in `ftrtProbeHistory`.
- [ ] `git diff` shows the MediaBunny loop (`startMediaBunnyExport` / `realtimeExportLoop`) untouched — only the probe + grade path change.
- [ ] Image-clip grade cache (`_ccCache`) still hits (sig includes `exact|gpu` marker).
- [ ] Watchdog aborts cleanly and the UI tells the user to use MediaBunny (testable by artificially inflating frame cost).

---

## 4.1 Outcome — P0 implemented and verified on the GT 740 (2026-08-17)

**Implemented in `index.html` (uncommitted):**
1. **Scratch grade canvases** — `_ccScratchGPU` / `_ccScratchExact` module-level canvases reused by `applyColorCorrection` for **video** clips (resized in place only when dimensions change; two scratches so the exact-mode `willReadFrequently` hint can never CPU-back the GPU path's context). Image clips keep the `_ccCache` path unchanged.
2. **Video pause in the probe** — `runCompareProbe` pauses all playing video elements for the duration (playing state restored at the end), removing the uncontrolled DXVA decode + texture-upload load and making the capture coherent (it draws the element's current frame).
3. **3 ms pacing floor in the fast pass** — `await sleep(3)` per frame (mirrors MediaBunny fast mode's `setTimeout(2)`); bounds how fast the loop can issue GPU work.

**Measured verification (same machine, GT 740):**

| Metric | Before | After |
|---|---|---|
| Full-res canvases created during an 8 s graded-video probe (480 frames) | **484 (≈ 4 GB)** | **8** |
| Scratch reuse | — | `_ccScratchGPU` retained across the run ✓ |
| **30 s graded-video Compare @ 22 fps** (the exact crash) | **black screen, TDR** | **✅ completed — Standard 1.00× (30.0 s) · Fast 8.28× (3.6 s, 182 fps)** |
| Page health after the run | crashed | preview rendering normally, app alive ✓ |

Note: 8.28× is faster than the pre-fix 10 s video runs (1.97×) because the video is now paused — the probe measures the draw+grade path instead of live playback (exact per-frame video sync is M1b's frame-pool job). The MediaBunny loop was not touched (P2/M1a inherits these protections).

## 5. Out of scope

- Exact per-frame video seek in the probe (→ M1b video frame pool).
- 4K graded-video FTRT (still needs the pixel pass at 8.3 MP/frame — the watchdog/fallback is the safety net).
- Fixing the corrupt-download pipeline at videosave.net (file is clean; nothing to fix here).
