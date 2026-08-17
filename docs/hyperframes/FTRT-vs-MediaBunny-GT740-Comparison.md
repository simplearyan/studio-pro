# FTRT (Fast) vs MediaBunny on the GT 740 — Video-Project Comparison + M1c Plan

> **Date:** 2026-08-17
> **Status:** Findings from the user's real exports (screenshots); M1c plan not yet implemented.
> **Machine:** GT 740 (1 GB VRAM) — the card that TDR'd on the 30 s graded-video Compare before the P0 fix.
> **Scope:** Fast-tab `startFTRTExport` (index.html ~30723) vs MediaBunny `startMediaBunnyExport`. Both modes share the same `drawCanvas` compositing; only the **capture pacing** differs (FTRT un-paced pool pump vs MediaBunny ack-backpressured 1× loop).

---

## 1. What the user tested (real 30 s exports, screenshots)

| Project | Mode | Export time | × real-time | Per-frame cost* | File |
|---|---|---|---|---|---|
| **Markdown text + images** | FTRT | — | **3.0–5.5×** (dev-measured; M1a/§7.1 + probe doc) | ~3–7 ms | — |
| *ditto* | MediaBunny | — | 1.0× | paced | — |
| **Video + text overlay** (dino cards, stroke + drop shadow, 30 s @ 22 fps 1080p) | FTRT | **0:16** | **1.87×** | ~24 ms | 7.9 MB |
| *ditto* | MediaBunny | 0:30 | 1.0× | paced | 7.9 MB |
| **Video + color grade** (BBC anchor, 30 s @ 24 fps 1080p) | FTRT | **0:49 / 0:56** | **0.61× / 0.54×** | ~68 / 78 ms | 9.6 / 10.6 MB |
| *ditto* | MediaBunny | 0:45 / 0:55 | 0.67× / 0.55× | ~63 / 76 ms | 11.1 / 11.4 MB |

\* wall time ÷ frame count (30 s @ 24 fps = 720 frames; @ 22 fps = 660).

**Evidence in the screenshots:** FTRT modal `MP4 · 0.61×…` + 0:49 (BBC anchor, 9.6 MB); FTRT `MP4 · 0.54×…` + 0:56 (10.6 MB); FTRT `MP4 · 1…×` + 0:16 (Brachiosaurus card, 7.9 MB); MediaBunny 0:45 (11.1 MB), 0:55 (11.4 MB), 1.0× (T-Rex card, 7.9 MB). Downloads list shows the FTRT/MediaBunny pairs adjacent in time (FTRT (1) ↔ MB (79), both 7.9 MB — same project, 1–2 min apart).

> Note on the user's summary: "video with color grade **or** video with stroke/drop-shadow take the same time in both modes" — the **graded pair is genuinely equal** (0.61 vs 0.67, 0.54 vs 0.55 — within run-to-run noise), which the screenshots confirm. The **dino pair** actually shows FTRT ≈ 1.9× faster (16 s vs 30 s) — the screenshots disagree with the recollection there; worth one re-run to confirm, and the plan's targets below assume FTRT should beat 1× decisively for both.

## 2. Analysis — why video projects don't speed up in Fast mode

The two modes share `drawCanvas`; the only difference is capture pacing. So the FTRT advantage equals *(MediaBunny wall) − (per-frame compositing cost) − (FTRT capture cost)*. The numbers expose **two independent bottlenecks**:

### 2.1 Bottleneck A — frame capture/decode (~24 ms/frame floor, dino case)

The dino project at 1.87× runs ~41 fps capture → ~24 ms/frame. That is the M1b element-pool cost: `seekExportVideo` settle + `createImageBitmap(el)` readback per frame (measured 31–32 fps on the dev machine — same ballpark). Capture is decode-bound, not encode-bound. **This is the bottleneck the WebCodecs decode-worker plan targets** (`docs/hyperframes/WebCodecs-Video-Decode-Plan.md`): decode in a worker straight to transferable `VideoFrame`s, no element, no readback → 5–10 ms/frame expected even on the GT 740's hardware H.264 decode.

### 2.2 Bottleneck B — the color-grade pixel pass (~63–78 ms/frame, BBC case)

The graded case is **identical in both modes** (0.55–0.67×) — the per-frame cost (63–78 ms) swamps the capture difference entirely. That cost matches the **exact per-pixel grade pass** (measured 68–107 ms at 1080p on the dev machine, `docs/export/FTRT-Probe-Comparison.md` §5): the BBC grade almost certainly uses **vibrance** (or `colorGradeExact`), which by design bypasses the GPU fast path. Both modes run the same `applyColorCorrection` → both are dragged to ~13–16 fps. **Fixing capture (M1c.1) would do almost nothing for this project — the grade is the wall.**

### 2.3 Why text-only projects are already fast

No video decode (no capture wall) and image clips hit the `_ccCache` (one graded canvas, reused) — the pump is encode-bound at 3–5.5×. Nothing to fix.

### 2.4 Takeaway

| Project type | Bound by | FTRT vs MB today | The fix |
|---|---|---|---|
| Text/markdown | encode | 3–5.5× faster | — (done) |
| Video + text (no grade) | capture (~24 ms) | ~1.9× faster | **M1c.1 WebCodecs decode worker** |
| Video + grade | grade pixel pass (~70 ms) | ≈ equal, both < 1× | **M1c.2 weak-GPU grade hardening** |

---

## 3. M1c — Fast video export v2 (beat MediaBunny without crashing the GT 740)

### M1c.1 — WebCodecs decode worker (capture wall)

Ship `docs/hyperframes/WebCodecs-Video-Decode-Plan.md` (Phases A–D): dedicated `video-decode-worker.js` (module worker, vite-bundled like `export-worker.js`), demux + `VideoDecoder` per clip, transferable `VideoFrame`s into the existing `clip._framePool`, keyframe-aware seek, parity preflight, per-clip fallback to the current element pool. **Target: dino-style projects ≥ 3×** (24 ms → ~8 ms/frame).

### M1c.2 — Weak-GPU grade hardening (grade wall)

The exact pixel pass must stop costing 63–78 ms/frame on the GT 740:

1. **Static grade-layer precompute** — temperature/tint overlays and the filter chain are constant per clip unless keyframed. Build them **once per clip** (at pool-build time) and composite the precomputed layer per frame, instead of re-running `getInterpolatedValue` + re-rendering the wash every frame. (The P0 scratch canvases already avoid the allocation bomb; this removes the *render* cost.)
2. **Half-resolution exact pass for video** — when an exact pass is unavoidable (vibrance / `colorGradeExact`), run it at **half res** (4× fewer pixels) and upscale: ~68–107 ms → ~17–27 ms/frame → 2–4× faster. Visual tradeoff: slightly softer grade — acceptable for export, flagged with a notice.
3. **Per-clip export grade policy** — Fast tab (or per-clip) toggle: *"GPU grade approximation for export"* (default) vs *"exact grade"* (preserves today's pixel-perfect output; slower). MediaBunny stays the guaranteed-exact lane, so FTRT can safely default to the approximation.

**Target: graded projects ≥ 1.5×** (from 0.55×), no TDR, exact output one toggle away.

### M1c.3 — Preflight speed advisor (honest before you wait)

Use the Compare probe's data (or a quick ~20-frame sample at export settings) to estimate × real-time **before** the pump starts. If < 1.0, show *"Fast export will run slower than real time on this machine — use MediaBunny?"* up front, instead of discovering it 49 s later. Complements the existing mid-run stall watchdog (8 s, no-ack) and heavy-range warning (> 3 GB workload).

### GT 740 safety (kept, not weakened)

- **P0 scratch canvases** — `_ccScratchGPU`/`_ccScratchExact` reuse (no per-frame allocation bomb; was 484 canvases ≈ 4 GB per 8 s probe → 8).
- **Conditional `willReadFrequently`** — the hint that CPU-backed every op (60 ms → 5.5 ms GPU path when removed).
- **Watchdog + fallback dialog** (10 slow frames > 150 ms → "Use MediaBunny"), heavy-range warning, 3 ms pacing floor, probe video-pause.
- New WebCodecs path inherits all of it: frames still flow `drawCanvas → exportCanvas → createImageBitmap → encode worker`; the decode worker is separate so it can never trip the encode-side ack watchdog.

### Acceptance criteria (GT 740, 30 s @ 1080p)

- [ ] Dino-style (video + text, no grade): FTRT **≥ 2×** (was 1.87×); MediaBunny unchanged ~1×.
- [ ] Graded video (BBC-style): FTRT **≥ 1.5×** (was 0.55×); exact grade preserved via the toggle.
- [ ] Text-only stays ≥ 3×; MediaBunny loop untouched (zero diff).
- [ ] **No TDR** across 3 consecutive 30 s runs with the grade; watchdog armed; console clean.
- [ ] Determinism: two identical FTRT exports → identical frame hashes (M0 harness).
- [ ] Output frames verifiably distinct (hash 3 sample frames — the check used for M1b) — **also re-run the dino pair to confirm the 1.9× vs "same time" discrepancy**.

### Out of scope (this pass)

- Reversed clips (still route to MediaBunny).
- Video audio through the decode worker (stays on `preRenderExportAudio`).
- HEVC/AV1 decode targets; WebGL-accelerated compositing rewrite.

---

## 4. Docs to update alongside

- `WebCodecs-Video-Decode-Plan.md` — mark Phases A–D as M1c.1 with these targets.
- `M1-FTRT-Export-Plan.md` — §7.4 outcome for M1c (or reference this doc).
- `Render-Speed-Analysis-and-Plan.md` — fold in the GT 740 real-project numbers as the baseline.
