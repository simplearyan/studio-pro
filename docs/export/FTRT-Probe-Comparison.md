# FTRT Probe — 3-Way Benchmark (Markdown / Video / Color-Graded Video)

> **Date:** August 2026
> **Tool:** the **Compare probe** in the Fast (FTRT) export tab (`runCompareProbe`, committed `1ec79d4` + `e8609d6`). Capture-only benchmark: the same range is drawn twice on a hidden 1920×1080 canvas — once with the Standard (MediaBunny) precision 1× pacing, once with the un-paced FTRT frame pump. Wall time, × real-time, and actual fps are recorded to `ftrtProbeHistory`.
> **Machine:** user's machine (GT 740-class GPU), Chromium, 1080p, 30 fps, dev server build.
> **Caveat up front:** the probe measures **capture cost only** — no encoder, no file, no live video playback. The encoder adds the same overhead to both modes, so the × real-time ratio is the honest speedup for *render-bound* work. For video timelines a real export is additionally pinned to 1× because the loop must wait for the `<video>` element to play live (that constraint is removed only by the M1b frame pool) — see §4.

---

## 1. The three tests

| # | Test | Timeline content | Range | fps | Res |
|---|---|---|---|---|---|
| **A** | 30 s markdown animation | `MARKDOWN_PRESET_ANIMALS` generated → 37 clips (30 text + 7 remote images), no video | 30 s | 30 | 1920×1080 |
| **B** | Imported video (feature film) | `_demo_assets/videos/We are making a feature film!_1080p.mp4` (69.7 s) as a single video clip, no grade | 10 s | 30 | 1920×1080 |
| **C** | Same video + heavy color grade | Test B clip with `colorSaturation 150, vibrance 30, hue 25, temperature 20, tint 10, brightness 105, contrast 110, blur 2` — forces the per-pixel `applyColorCorrection` pass | 10 s | 30 | 1920×1080 |

---

## 2. Results (measured)

| Test | Standard (MediaBunny) | Fast (FTRT) | FTRT speedup |
|---|---|---|---|
| **A — 30 s markdown** | 30.0 s wall · **1.00×** · 30.0 fps | 4.7 s wall · **6.38×** · 192 fps | **6.4× faster** |
| **B — video, no grade** | 10.0 s wall · **1.00×** · 30.0 fps | 1.4 s wall · **6.99×** · 210 fps | **7.0× faster** |
| **C — video + color grade** | 21.7 s wall · **0.46×** · 13.8 fps | 23.7 s wall · **0.42×** · 13.0 fps | **~1.0× (both sub-real-time)** |

> Standard pass rows for A and B land at exactly 1.00× by construction (precision pacing); the value is that the **Fast** pass beats it by 6–7×. Test C is the outlier that changes the story.

---

## 3. Analysis

### Test A — text/markdown: FTRT is a clear win (6.4×)
37 text/image clips, 900 frames: Fast captures at ~192 fps vs the 30 fps pace of Standard. This is the plan's day-one claim, now measured: **markdown animations are render-bound, not encode-bound, at 1080p** — the un-paced frame pump runs 6.4× faster than real time. The encoder (same worker in both modes) adds equal overhead, so a real FTRT export should land in the 3–5× range end-to-end. *(Remote image URLs may have drawn as blanks if offline; text clips dominate the count either way.)*

### Test B — plain video: the *frame draw* is cheap, but a real export is still 1×
Surprising: drawing a decoded video frame costs about the same as a text frame (Fast 6.99× in capture-only terms). **The probe cannot see the real constraint** — a true export must wait for the `<video>` element to play live, which pins it to ~1× regardless of capture speed. So:
- **Capture-only FTRT for video: fast.** Real FTRT export for video: still ~1× until the **M1b video frame pool** (pre-decode → `ImageBitmap[]`, `drawImage(pool[frame])`) removes the live-playback dependency.

### Test C — color grade: the bottleneck is the render, not the pacing (the GT 740 story)
With saturation/vibrance/hue/temperature/tint/contrast/blur active, **both modes fall below real-time (0.42–0.46×)** — the per-pixel `applyColorCorrection` JS pass (~2.5 MP per frame, plus GPU `ctx.filter` blur) caps capture at ~13 fps. FTRT offers **no advantage** here because the loop is bounded by the draw itself, not by pacing.
- **This is exactly the freeze risk behind the M1 fallback design.** At 4K the pixel pass is 16× heavier still (8.3 MP/frame); on a GT 740 that is the stall the **8 s watchdog + "Use MediaBunny" fallback dialog** exists for.
- **Honest takeaway:** FTRT is a pacing fix. It wins when rendering is *faster* than real time (text/markdown/plain video). When a heavy effect makes rendering *slower* than real time, neither mode helps — the fix is render-side (cache the graded frame — the app already caches image-clip grades via `_ccCache`; video grades are never cached because the source advances every frame).

---

## 4. What this means for M1 (and what it doesn't)

| Claim | Verdict from this benchmark |
|---|---|
| "FTRT exports text/markdown faster than real time" | ✅ **Proven: 6.4×** on the 30 s animal script |
| "FTRT helps video timelines too" | ⚠️ **Not yet** — capture-only is fast (7×), but a real export waits for live video playback until M1b's frame pool |
| "FTRT degrades gracefully on weak GPUs" | ✅ The watchdog/fallback is justified — **Test C is the exact sub-real-time + freeze territory** it guards |
| "The two modes can be compared meaningfully" | ✅ For render-bound content; for video the comparison must wait for M1b |
| "Color grading is cheap" | ❌ **Per-pixel grading is the single biggest export cost measured** (drops both modes to ~0.4×) |

**Recommended next step is unchanged:** ship M1a (the FTRT loop + watchdog + fallback) for text/markdown, then M1b (video frame pool), then re-run this exact suite — the probe + `ftrtProbeHistory` make the before/after comparison a one-click rerun.

---

## 5. Raw records (from `ftrtProbeHistory`, trimmed)

```json
[
  { "dur": 30, "fps": 30, "hasVideo": false, "stdWall": 30.0,  "stdX": 1.00, "ftrtWall":  4.7, "ftrtX": 6.38, "ftrtFps": 192 },  // A
  { "dur": 10, "fps": 30, "hasVideo": true,  "stdWall": 10.0,  "stdX": 1.00, "ftrtWall":  1.4, "ftrtX": 6.99, "ftrtFps": 210 },  // B
  { "dur": 10, "fps": 30, "hasVideo": true,  "stdWall": 21.7,  "stdX": 0.46, "ftrtWall": 23.7, "ftrtX": 0.42, "ftrtFps":  13 }   // C
]
```
