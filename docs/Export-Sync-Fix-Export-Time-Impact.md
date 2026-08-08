# Export Sync Fix — Impact on Export Times

**Status:** projection written **before** implementation; Phases 1–2 (export-safe `seekExportVideo` helper, `armExportFrameLatch`, thresholded re-seek in both the MediaBunny and standard capture loops) are now **implemented** (see `docs/Export-Heavy-Effects-Sync-Plan.md` Phases 1–2). After-numbers in §8 are **pending a live re-export** of the About.md repro.
**Purpose:** answer, in detail: *"Will the export desync fix make export times worse — especially for videos with no or few effects?"*
**Source of the fix:** `docs/Export-Heavy-Effects-Sync-Plan.md` (Phases 1–2) + `docs/Export-Video-Audio-Sync-Plan.md` (Phase A) — the thresholded per-frame re-seek.

---

## 1. TL;DR (the answer)

| Export scenario | Export time today (measured) | After the fix (projected) |
|---|---|---|
| **No effects** (e.g. `(50).mp4`, captions only) | ~60 s for 60 s (1.0× real-time) | **~60–63 s (+0–5%) — essentially unchanged** |
| **Light effects** | ~65 s (est.) | ~65–70 s (+5–10%) |
| **Heavy effects** (color grade + multiply overlay, e.g. `(44).mp4`) | ~90 s for 60 s (1.5×) | ~95–120 s (+5–30%) with simple design; **~90–95 s (+0–5%) with the rate-lock variant** |
| **Fast mode** | fastest-but-wrong (sync broken) | needs its own policy; see §7 — bounded, not guaranteed free |

**The fix adds zero cost when the export is healthy** — it only acts when the video has drifted more than 1–2 frames, which (by definition) almost never happens on a clean export. The clean-export case is a single number comparison per frame, no more.

---

## 2. Current measured baselines (from `_exports/About.md` repro)

- **`(44).mp4` — color grading + multiply overlay:** 60 s project, **~90 s wall time** (1.5×), video drifted **+16 s** ahead of audio by the 20 s mark (growing).
- **`(50).mp4` — captions only:** 60 s project, **~60 s wall time** (1.0×), **0 s drift**.

Conclusion: capture speed ≈ real-time when frames are cheap to draw; ~1.5× slower when each frame pays for heavy compositing. The drift is a *symptom* of capture being slower than real-time.

---

## 3. What the fix actually does (cost model)

The fix (Phases 1–2) inserts one step into the export loop, right before each frame capture (`drawCanvas(exportCtx, …)`, `index.html:22768`):

```
1. target = the exact source position the audio clock is at (model-derived)
2. if |element.currentTime − target| > threshold (1–2 frames):
       → re-seek element to target (small seek), wait for the frame, then capture
   else:
       → capture immediately (NO extra work)
```

### The per-frame cost breakdown

| Step | Healthy path (no drift) | Drifted path (needs correction) |
|---|---|---|
| Compute target | `clipSourcePos()` — sub-microsecond | same |
| Compare currentTime vs target | sub-microsecond | same |
| Re-seek element | — **never happens** | small seek: ~1–20 ms (see §6) |
| Wait for decoded frame | — never happens | `seeked`/`readyState≥2` poll, usually ~1–10 ms; 400 ms fallback is a rare safety net |
| Capture | unchanged | unchanged |

**Key insight:** with the fix, the drift never grows large — the element is re-synced *before* it can run away — so every corrective seek is a **tiny backward seek of 1–2 frames** inside an already-warm media buffer. Tiny, warm-range seeks are cheap (~1–20 ms), far cheaper than the 16 s of accumulated drift they prevent.

The encode settings are untouched (same fps, codec, resolution) — the encoder's per-frame cost does not change. The only added work is element sync overhead.

---

## 4. Why clean / low-effect exports will NOT get slower

1. **The healthy path is a no-op.** When the element is within 1–2 frames of the audio clock (the clean-export case — measured 0 s drift in `(50)`), the loop does nothing beyond a number comparison. A comparison is nanoseconds; the frame capture + encode (≈ 40 ms) completely dominates. Export time contribution: **~0%**.
2. **Even jitter corrections are negligible.** No machine is perfectly steady — a frame may occasionally cross the threshold. A single tiny re-seek costs ~5–20 ms once every few seconds. Over a 60 s export that's well under a second of added time.
3. **The check is per-element, per-frame, O(1).** For a timeline with a handful of active video clips, this is a handful of comparisons per frame — not a scaling problem.

So for the scenario you care about — *"will no-effect/low-effect export time increase?"* — the answer is: **no, effectively unchanged** (projected +0–5%, mostly measurement noise).

---

## 5. Why heavy-effect exports may get (a little) slower — and how to avoid it

With heavy effects the element *is* drifting on nearly every frame, so the corrective branch runs nearly every frame. Two designs:

### Variant A — per-frame thresholded re-seek (simplest, recommended first)
Re-seek whenever drift > threshold. For a heavy export this means one small seek per frame ≈ **+5–20 ms × 1440 frames ≈ +10–30 s** on top of the current ~90 s → **~100–120 s for a 60 s project**. This is a *bounded, predictable* increase, and it buys correct sync (≤2 frames) in every mode.

### Variant B — rate-lock + occasional correction (recommended after A, or instead of A)
Measure the live capture/wall ratio and nudge the element's `playbackRate` (`clipSpeed × captureRate/wallRate`) so the element plays *as fast as capture actually is* — it then hovers inside the threshold and only rarely needs a corrective seek.

- Drift rate collapses to ≈ 0, so corrective seeks become rare → heavy-effect export stays near its current ~90 s (**+0–5%**).
- Cost: more moving parts (rate estimation, per-clip handling with speed ramps, fast-mode polarity). Higher implementation risk.

**Recommendation:** ship **A** first (correct, simple), measure with §8's table, and add **B** as an accelerator only if the heavy-effect numbers justify it. Either way the user-visible result is the same: correct sync.

---

## 6. Factors that change the seek cost (real-world spread)

- **Container layout:** mp4 with `moov` at the front (fast random access) seeks faster than files with `moov` at the end (the exporter must re-locate the table). Our export worker writes standard mp4 — expect the *source* clips to matter, not the export.
- **Source I/O:** local files / object URLs (our demo assets) seek at disk speed; a remote/network source pays network latency per seek.
- **Buffer warmth:** small backward seeks into already-buffered range are fastest; seeking into unbuffered range triggers a network/disk fetch.
- **Browser/media pipeline:** Chrome's seek within a warm buffer is typically single-digit ms; the 400 ms fallback in `drawWhenFrameReady`/`armVideoFrameLatch` (`index.html:21114`) only fires on stalls — it must stay bounded so one bad seek can't hang the export.
- **Clip count:** seek cost scales with the number of simultaneously active video clips, not the timeline length.

---

## 7. Fast-mode caveat (flag, not blocker)

Fast mode intentionally captures faster than real-time — the element ends up **behind** the audio clock (negative drift). Per-frame *backward* re-seeks would fight it: each seek would yank the element *forward* to target, costing a forward seek every frame.

Planned handling: in fast mode, use a larger threshold and only correct when the element is **ahead** (behind resolves itself once capture pauses); optionally pre-seek a look-ahead. This keeps fast mode fast while bounding the error. Exact policy is a follow-up decision — it does **not** affect the normal-mode time analysis above.

---

## 8. Before/after measurement plan (to run after implementation)

Re-export the exact same 60 s project in each scenario and record wall time + drift:

**Before-numbers are measured** (About.md repro + PSNR cross-correlation, `docs/Export-Heavy-Effects-Sync-Plan.md` §2). **After-numbers are pending**: re-export the same 60 s project per scenario on the fixed build, then re-run the PSNR method and the wall-time clock.

| Scenario | Export time before | Drift before | Export time after | Drift after | Δ |
|---|---|---|---|---|---|
| No effects | **60 s** (measured) | **0 s** (measured @20/40/55 s) | pending | pending | — |
| Light effect (opacity/scale) | est. 65 s | — | pending | pending | — |
| Heavy (grade + multiply) | **90 s** (measured) | **+16 s** @20 s, growing (measured) | pending | pending | — |
| Speed 2× clip | — | — | pending | pending | — |
| Fast mode | — | — | pending | pending | — |

**Acceptance criteria (unchanged):** drift at model 20/40/55 s ≤ 2 frames; no-effects export within +5% of 60 s; heavy-effects increase documented (add Variant B rate-lock if > +30%).

**How to run the after-measurement:** (1) open the fixed build, import `_demo_assets/…_The truth about gut health.mp4`, add captions + color grade + a multiply overlay for the heavy row; (2) export 60 s, note wall time; (3) ffmpeg-extract frames at audio times 20/40/55 s and cross-correlate against the source window (PSNR argmax) — expect the best match at the *same* timestamp (±2 frames).

Acceptance criteria:
- Drift at model 20/40/55 s ≤ 2 frames (PSNR method from `Export-Heavy-Effects-Sync-Plan.md` §2).
- No-effects export time within **+5%** of baseline.
- Heavy-effects export time increase documented; if > +30%, add Variant B.

---

## 9. Implementation note (what Phases 1–2 shipped)

- `seekExportVideo(el, target, threshold, fallbackMs)` — export-safe seek mirroring `seekMediaEl` (latest-wins, waits for the decoded frame, bounded fallback) that **never repaints the preview canvas**; resolves immediately when in range. Reviewer-hardened: when a seek is initiated it resolves only on `'seeked'` / `readyState≥2 && !seeking` (the bare readyState poll can fire mid-seek and capture the stale frame); the `readyState<1` branch has a bounded timeout so a dead source can't hang the export; `fallbackMs` is configurable (standard path passes 100 ms).
- `armExportFrameLatch(el)` — sets `_frameReady` the moment a decodable frame exists on the fresh export elements, without painting (kills the mock-frame-at-t=0 hazard).
- MediaBunny loop (`realtimeExportLoop`): before each capture, every active video element is compared against `clipSourcePos(clip, exportTime - clip.start)`; drifted elements are re-seeked with threshold `max(2·timeStep, 0.05)`; fast mode only corrects when the element is AHEAD; the sync pass is skipped on the final (all-frames-captured) iteration. Verified live: helpers + wiring present in the served module, no console errors, syntax + production build pass, and unit-style checks of all seek paths (no-op 0 ms, mid-seek gating, negative clamp, dead-source bound, frame latch).
- Standard capture loop (`exportLoop`, MediaRecorder path): same defensive thresholded lock (it is wall-clock self-consistent; the lock only fires on stutters).

## 10. Summary

1. **Clean/low-effect exports: no meaningful time change** — the fix is a no-op when the export is healthy (projected +0–5%, mostly noise).
2. **Heavy-effect exports: modest, bounded increase with the simple design** (+5–30%); the rate-lock variant keeps it near today's time (+0–5%).
3. **The trade is always the same:** a small, bounded time cost (or a bit more engineering) in exchange for correct audio/video sync — currently the video is up to **16 s ahead**, which is unusable. Even the worst-case projection keeps sync correct and stays under ~2× real-time.
4. **Nothing changes about encode quality/settings** — only the element-sync step is added.
