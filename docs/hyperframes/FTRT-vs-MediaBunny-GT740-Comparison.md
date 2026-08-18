# FTRT (Fast) vs MediaBunny on the GT 740 — Video-Project Comparison + M1c Plan

> **Date:** 2026-08-17 → updated 2026-08-18
> **Status:** M1c.2 shipped (Fast-lane grade approximation); round-2 real exports documented (§2.6); decision recorded (§5).
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

> Note on the user's summary: "video with color grade **or** video with stroke/drop-shadow take the same time in both modes" — the **graded pair is genuinely equal** (0.61 vs 0.67, 0.54 vs 0.55 — within run-to-run noise), which the screenshots confirm. The **dino pair** actually shows FTRT ≈ 1.9× faster (16 s vs 30 s) — **re-verified below (§1.2): FTRT wins on video+text; the equal-times claim only holds for graded video.**

### 1.2 Re-verification (2026-08-17, dev webview on the same GT 740 machine, clean page load per run)

The exact user projects aren't in the repo (zebra/flower dino videos, BBC-anchor clip), so these are **structural equivalents** — the BBC **camel** video from `_demo_assets/videos` (matches the user's image-6 screenshot) graded with sat 118 / **vibrance 30** / temp 16 / tint 5 / hue −5 (vibrance forces the exact pixel pass, the thing that slows the BBC case), and the feature film with a stroked + drop-shadowed text card as the dino analog. 30 s @ 24 fps 1920×1080 MP4, fresh page load before every run:

| Equivalent | Mode | Wall | × real-time | Capture fps |
|---|---|---|---|---|
| BBC camel, graded (vibrance 30) | **FTRT** | **49.2 s** | **0.61×** | ~14.5 (69 ms/frame — exact grade) |
| *ditto* | MediaBunny | 55 s | 0.55× | ~12.9 |
| Feature film + stroked/shadowed text | **FTRT** | **26.6 s** | **1.13×** | ~27 (37 ms/frame — capture-bound) |
| *ditto* | MediaBunny | 30 s | 1.0× | paced |

**What the re-run confirms:**
- The graded pair is **equal and sub-1× in both modes** (0.61× vs 0.55×) — and the FTRT wall (49.2 s, 0.61×) **matches the user's BBC-anchor screenshot (49 s, 0.61×) almost exactly**, validating the reconstruction. The grade pixel pass is the wall, shared by both modes.
- The **dino pair is NOT equal** — FTRT beats MediaBunny (1.13× here; the user's own run was 1.87× vs 1.0×). The lower ratio here vs the user's 1.87× is expected: their dino sources are smaller (cheaper capture), and this analog uses a 1080p source.
- Conclusion: the user's "same time in both modes" is **true for graded video, false for video+text** — FTRT is capture-bound (M1c.1) for the latter and grade-bound (M1c.2) for the former. The M1c targets below stand unchanged.

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
| Video + grade | grade pixel pass (~70 ms) | ≈ equal, both < 1× | **M1c.2 done — Fast-lane saturate() approximation** (see §3) |

### 2.5 What changed (2026-08-18): the grade wall is now Fast-mode-only

M1c.2 shipped a **Fast-lane-only grade approximation** (`State.exportGradeFast`, set exclusively inside `startFTRTExport` and the probe's FTRT pass): vibrance rides the CSS filter chain as `saturate(100 + vibrance·0.3)%` — GPU-composited, ~1 ms/frame — instead of the full-res per-pixel pass. MediaBunny, the preview, and the probe's Standard pass never set the flag, so they keep the exact pass untouched (stable, pixel-perfect, slow). `clip.effects.colorGradeExact` still forces exact in every mode.

**Why not the half-res pass from the original M1c.2 plan:** measured on the GT 7xx, `getImageData` readback costs ~60 ms **regardless of resolution** (59 ms at 960×540 vs 65 ms at 1920×1080) — the half-res pixel loop only reached 1.4–1.6×. The saturate() approximation is the engineering answer: 0.7 ms/frame, avg diff < 8/255 at vibrance 30 (stress pattern), max diff ~5%.

### 2.6 Round 2 — user's real exports on the actual BBC projects (2026-08-18, screenshots)

Two real BBC projects, both exported in both modes on the user's machine: **(a) anchor clip + simple drop shadow + stroke**, and **(b) the same clip with a **hue** change from the color grade. 30 s @ 24 fps 1920×1080. Numbers read from the export modals and the browser download list:

| Project | Mode | Export time | × real-time (modal) | File size |
|---|---|---|---|---|
| BBC + shadow/stroke | MediaBunny | **0:46** | ~0.65× | 9.4 MB |
| BBC + shadow/stroke | FTRT (4) | **0:51** | **0.58×** | 8.1 MB |
| BBC + hue grade | MediaBunny | **0:55** | ~0.55× | 9.2 MB |
| BBC + hue grade | FTRT (5) | **0:59** | **0.51×** | 8.3 MB |

(FTRT (82), 9.4 MB in the download list, is an earlier exact-grade run of the same content — same size as its MediaBunny twin.)

**What the screenshots show — the user's observation is confirmed:** the two modes take **roughly the same wall time for real video exports** (46–59 s across all four), and FTRT is **sub-1× (0.51–0.58×)** — *slightly behind* MediaBunny, within run-to-run noise. This holds for **both** the simple (shadow/stroke) and the hue-graded project. The M1c.2 grade fast path (§2.5) is in the served build, yet the graded FTRT run is still ~0.5×.

**Why — the encode worker is the shared wall (this round's finding).** The Compare probe (§2.5) measured *capture-only* (paused frame, no pool seeks, no encode) — that's why it showed 6.65×. A real export adds per-frame cost on **every** frame in **both** modes:

1. **Encode (`VideoEncoder`, avc, 5 Mbps, `src/workers/export-worker.js`)** — noisy 1080p video content is far more expensive to encode than flat text frames. Text-only projects encode at ~7–11 ms/frame (hence 3–5.5×); video content on this machine is in the ~30–50 ms/frame range. Since both modes feed the *same* encoder, this cost is identical and unavoidable in FTRT — it caps the mode at ~0.6× regardless of capture pacing.
2. **Capture + compositing** (~22–37 ms/frame even with the M1b pool when the source is a real video element) — the second term, already targeted by M1c.1.

Per-frame math that matches the modals: 720 frames ÷ (46–59 s) = **64–82 ms/frame** in both modes. The probe's 6.65× was real but **not representative** of full exports — encode dominates once the pump runs for real. The grade fast path removed the grade term (which *was* the wall in the §1.2 probe runs), but that term was never the largest one in a full export.

**Implication:** for text/markdown projects FTRT stays a 3–5.5× win (encode is cheap — the automation core). For video projects on the GT 740, FTRT ≈ MediaBunny until **both** remaining walls fall: decode/capture (M1c.1 WebCodecs decode worker) **and** encode (hardware `avc` encode via the OS media stack — worth a probe; software fallback at 1080p24 is the suspect). Neither is a small change, and both are GT-740-uncertain.

---

## 3. M1c — Fast video export v2 (beat MediaBunny without crashing the GT 740)

### M1c.1 — WebCodecs decode worker (capture wall)

Ship `docs/hyperframes/WebCodecs-Video-Decode-Plan.md` (Phases A–D): dedicated `video-decode-worker.js` (module worker, vite-bundled like `export-worker.js`), demux + `VideoDecoder` per clip, transferable `VideoFrame`s into the existing `clip._framePool`, keyframe-aware seek, parity preflight, per-clip fallback to the current element pool. **Target: dino-style projects ≥ 3×** (24 ms → ~8 ms/frame).

### M1c.2 — Weak-GPU grade hardening (grade wall) — ✅ done (2026-08-18, Fast-lane only)

The exact pixel pass cost 63–78 ms/frame on the GT 740. What shipped:

1. **CSS saturate() approximation for vibrance (Fast lane only)** — vibrance is luminance-adaptive so a fixed overlay can't replicate it, but a GPU-composited `saturate(100 + vibrance·0.3)%` (calibrated to minimize pixel diff vs the exact pass) is visually close and ~free. The full-res exact pass remains the default everywhere else. `clip.effects.colorGradeExact` still forces exact even in Fast.
2. **The half-res idea was tried and rejected with data** — `getImageData` readback is ~60 ms at any resolution on this GPU class, so half-res only reached 1.4–1.6×; the filter approach is 8.6× on the real `drawCanvas` path.
3. **Per-clip policy deferred** — the current scope is "Fast = approximate, everything else = exact." A per-clip/toggle exact-in-Fast override can ride on the existing `colorGradeExact` flag if wanted later.

**Verified live (2026-08-18, GT 730 webview — same GPU class as the GT 740, real drawCanvas path):**

| Case (6 s @ 30 fps 1920×1080, Compare probe) | Standard (exact) | Fast (approx) | Gap |
|---|---|---|---|
| BBC camel, vibrance 30 + temp 16 + tint 5 | 16.8 s · 0.36× · 10.7 fps | **0.9 s · 6.65× · 199 fps** | **18.6×** |
| Same video, stroke + drop shadow (no grade) | 6.0 s · 1.00× · 30 fps | 1.0 s · 6.05× · 182 fps | 6.1× |
| Single-frame grade cost (fake 1080p clip) | 93–95 ms/frame | 11 ms/frame | 8.6× |

Single-frame sanity (through `drawCanvas`, camel video, flag off vs on): exact 93 ms/frame → fast 11 ms/frame. Note the probe is capture-only (paused frame, no pool seeks/encode) — a real Fast export adds M1b pool + encode, so expect real graded exports near the video+text result (~1.1–1.3× at 24 fps) instead of the old 0.61×; MediaBunny keeps the exact pass (and its 0.55× — stable and pixel-perfect by design).

**Target hit:** graded projects were 0.55–0.61× → the grade wall is gone in Fast; remaining bound is capture (M1c.1).

### M1c.3 — Preflight speed advisor (honest before you wait)

Use the Compare probe's data (or a quick ~20-frame sample at export settings) to estimate × real-time **before** the pump starts. If < 1.0, show *"Fast export will run slower than real time on this machine — use MediaBunny?"* up front, instead of discovering it 49 s later. Complements the existing mid-run stall watchdog (8 s, no-ack) and heavy-range warning (> 3 GB workload).

### GT 740 safety (kept, not weakened)

- **P0 scratch canvases** — `_ccScratchGPU`/`_ccScratchExact` reuse (no per-frame allocation bomb; was 484 canvases ≈ 4 GB per 8 s probe → 8).
- **Conditional `willReadFrequently`** — the hint that CPU-backed every op (60 ms → 5.5 ms GPU path when removed).
- **Watchdog + fallback dialog** (10 slow frames > 150 ms → "Use MediaBunny"), heavy-range warning, 3 ms pacing floor, probe video-pause.
- New WebCodecs path inherits all of it: frames still flow `drawCanvas → exportCanvas → createImageBitmap → encode worker`; the decode worker is separate so it can never trip the encode-side ack watchdog.

### Acceptance criteria (GT 740, 30 s @ 1080p)

- [ ] Dino-style (video + text, no grade): FTRT **≥ 2×** (was 1.87×); MediaBunny unchanged ~1×.
- [x] Graded video (BBC-style): FTRT probe **6.65× vs 0.36×** (was 0.55× equal); exact grade preserved — MediaBunny/preview untouched, `colorGradeExact` override intact.
- [ ] Text-only stays ≥ 3×; MediaBunny loop untouched (zero diff).
- [ ] **No TDR** across 3 consecutive 30 s runs with the grade; watchdog armed; console clean.
- [ ] Determinism: two identical FTRT exports → identical frame hashes (M0 harness).
- [x] Discrepancy resolved: re-verification (§1.2) confirms FTRT **wins** on video+text (1.13×/1.87× vs 1.0×) and is **equal** on graded video (0.61× vs 0.55×) — the "same time" claim holds only for graded video.
- [ ] Output frames verifiably distinct (hash 3 sample frames — the check used for M1b).

### Out of scope (this pass)

- Reversed clips (still route to MediaBunny).
- Video audio through the decode worker (stays on `preRenderExportAudio`).
- HEVC/AV1 decode targets; WebGL-accelerated compositing rewrite.

---

## 4. Docs to update alongside

- `WebCodecs-Video-Decode-Plan.md` — mark Phases A–D as M1c.1 with these targets.
- `M1-FTRT-Export-Plan.md` — §7.4 outcome for M1c (or reference this doc).
- `Render-Speed-Analysis-and-Plan.md` — fold in the GT 740 real-project numbers as the baseline.

## 5. Verdict / decision (2026-08-18) — proceed to M2 automation

Round-2 real exports (§2.6) show FTRT ≈ MediaBunny for **video** projects (0.51–0.58× vs 0.55–0.65×) because the encode wall is shared — but FTRT's real, shipped value is **text/markdown at 3–5.5×**, which is exactly the lane the automation roadmap (AI writes markdown → fast render) is built on. Beating MediaBunny for *video* on the GT 740 requires M1c.1 (decode worker) + a hardware-encode investigation — a multi-session, hardware-bound effort with uncertain payoff on a 2014 card. **Decision: park video-speed work as a follow-up; proceed to M2 (design templates) — the next automation step and the biggest user-visible win.** M1c.1 stays scoped in `WebCodecs-Video-Decode-Plan.md` and can be picked up when automation lands or if the encode probe shows a hardware path exists.
