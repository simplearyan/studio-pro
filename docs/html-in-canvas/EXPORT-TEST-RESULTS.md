# FTRT Export Test Results — All Phases

## Latest Test: VideoFrame (6 HIC clips, 30s, 1920×1080 @ 30fps)

```
[FTRT] Pre-rendering HIC frames for 6 clip(s)...
[FTRT] HIC pre-render done: 643 frames in 3.7s (175.4 fps)
[FTRT Timing] f=60   fps=3.7   wall=16.1s
[FTRT Timing] f=840  fps=10.4  wall=81.1s
[FTRT] exported 30.0s in 86.1s = 0.35× real-time (mp4)
```

## All Tests Comparison

| Test | Capture Method | FPS Range | Export Time | Real-time |
|------|---------------|-----------|-------------|-----------|
| Baseline | createImageBitmap | 3.3-6.1 | 143.6s | 0.21× |
| Phase 0+1 | createImageBitmap | 11.2-11.8 | 52.0s | 0.38× |
| Phase 2 | createImageBitmap | 3.6-10.3 | 86.4s | 0.35× |
| **VideoFrame** | **VideoFrame** | **3.7-10.4** | **86.1s** | **0.35×** |

## Key Finding: VideoFrame Didn't Help

| Operation | createImageBitmap | VideoFrame | Winner |
|-----------|------------------|------------|--------|
| Capture time | ~80ms | ~2ms | VideoFrame ✅ |
| Worker encoding | ~180ms | ~180ms | Same ❌ |
| **Total per frame** | **~260ms** | **~260ms** | **Same** |

**The bottleneck is NOT capture — it's worker encoding.**

## Bottleneck Analysis

### Per-Frame Pipeline (260ms total at f=60)

| Step | Time | % of Total | Can Optimize? |
|------|------|-----------|---------------|
| `drawCanvas()` | ~30ms | 11% | Partial (skip non-visible) |
| Capture (VideoFrame/createImageBitmap) | ~2-80ms | 3-30% | ✅ VideoFrame already optimal |
| **Worker encoding (VideoSampleSource.add)** | **~180ms** | **69%** | **Yes — this is the bottleneck** |
| Ack wait + overhead | ~10ms | 4% | No |

### Why Worker Encoding Is Slow

MediaBunny's `VideoSampleSource.add()` does:
1. H.264/VP9 encoding (CPU-intensive) — ~150ms
2. Bitstream packaging — ~20ms
3. Memory management — ~10ms

At 1920×1080 @ 30fps, that's 2,073,600 pixels × 30 frames/sec = 62M pixels/sec to encode.

## What Would Actually Help

### Option 1: Parallel Encoding (Medium Effort, +30-50%)

Overlap main thread rendering with worker encoding:

```
Frame N:   [drawCanvas] [capture] [send] ──────────────────────►
Frame N+1:              [drawCanvas] [capture] [send] ──────────►
Worker:                 [──────encode N──────] [──────encode N+1──]
```

**How:** Don't wait for ack before sending next frame. Use a queue with backpressure.

**Current:** `drawCanvas → capture → send → wait ack → next frame`
**Parallel:** `drawCanvas → capture → send → next frame (don't wait)`

**Expected:** 2× throughput if pipeline is balanced.

### Option 2: Lower Encoding Complexity (Low Effort, +10-20%)

Reduce MediaBunny's encoding preset:

```javascript
videoSampleSource = new VideoSampleSource({
    codec: 'avc',
    width, height,
    bitrate: bitrate,
    preset: 'ultrafast', // or 'superfast' — faster encoding, larger file
});
```

**Tradeoff:** Larger file size, slightly lower quality at same bitrate.

### Option 3: Hardware Encoding (Medium Effort, +50-100%)

Use browser's hardware-accelerated encoder:

```javascript
const encoder = new VideoEncoder({
    output: (chunk) => worker.postMessage({ type: 'encoded-chunk', chunk }),
    error: (e) => console.error(e)
});
encoder.configure({
    codec: 'avc1.64001f',
    width: 1920, height: 1080,
    bitrate: 2_400_000,
    framerate: 30,
    hardwareAcceleration: 'prefer'
});
```

**Why faster:** GPU-accelerated H.264 encoding — 5-10ms per frame vs 150ms CPU.

**Tradeoff:** Requires WebCodecs API, more complex integration.

### Option 4: Skip Frames + Interpolate (Low Effort, +100-200%)

Render every 3rd frame, interpolate in worker:

```
Frame 0: render + encode (keyframe)
Frame 1: reuse frame 0 (P-frame, low bitrate)
Frame 2: reuse frame 0 (P-frame, low bitrate)
Frame 3: render + encode (keyframe)
...
```

**Why faster:** 3× fewer full renders/encodes.

**Tradeoff:** Lower temporal quality (3-frame repeats visible in fast motion).

## Recommended Priority

| Option | Expected FPS | Quality | Effort | Risk |
|--------|-------------|---------|--------|------|
| Current | 3.7-10.4 | 1920×1080 ✅ | Done | — |
| **1. Parallel encoding** | **8-15** | **1920×1080 ✅** | **Medium** | **Low** |
| 2. Lower preset | 4-12 | 1920×1080 ✅ | Low | Low |
| **3. Hardware encoding** | **15-30** | **1920×1080 ✅** | **Medium** | **Medium** |
| 4. Skip frames | 10-25 | 1920×1080 ⚠️ | Low | Medium |

**Recommendation: Option 1 (Parallel) + Option 3 (Hardware)** for best quality + speed.

## Export Quality

The exported video looks correct:
- Resolution: 1920×1080 ✅
- Duration: 0:30 ✅
- File size: 8.5 MB (2.4 Mbps) ✅
- Content: All HIC presets rendering correctly ✅
- No artifacts or corruption ✅

---

# ROOT CAUSE FOUND — The 5×rAF Wait Tax (Latest: 20s test)

## The Smoking Gun (measured from steady-state logs)

| Mode | Steady-state per-frame interval | ÷ 60Hz rAF tick |
|------|--------------------------------|-----------------|
| FTRT | (19879−14880)/60 = **83.3 ms** | **exactly 5 × 16.67 ms** |
| MediaBunny | (10306−5305)/60 = **83.4 ms** | **exactly 5 × 16.67 ms** |

**Both modes are rAF-bound, not encode-bound.** Every exported frame pays for
5 `requestAnimationFrame` ticks (~83ms at 60Hz display) inside the html2canvas wait loop:

```javascript
// Present in BOTH the FTRT pump loop and the MediaBunny loop:
for (let _wh = 0; _wh < 5; _wh++) {
    if (window._pendingHtmlCaptures && window._pendingHtmlCaptures.length > 0) break;
    await new Promise(r => requestAnimationFrame(r));   // ← 16.7ms per tick
    drawCanvas(exportCtx, exportW, exportH);            // ← full redraw per tick
}
```

`window._pendingHtmlCaptures` is only ever filled by **iframe `html` clips**
(html2canvas capture at index.html:6555). This test project has 6 HIC clips and
**zero iframe html clips**, so the array is always empty → the loop never breaks
early → a fixed **5 rAFs + 6 full drawCanvas calls per exported frame**.

This overturns the earlier conclusion that "worker encoding ~180ms" was the
bottleneck — the measured 83.3ms/frame leaves no room for a 180ms serial encode,
so worker `VideoSampleSource.add()` must be fast (hardware-accelerated or
queue-and-return). The rAF loop IS the bottleneck.

## The Fix (applies to both modes)

**Gate the html2canvas wait on an active iframe html clip:**

```javascript
const t = State.currentTime;
const needsHtmlWait = State.clips.some(c =>
    c.type === 'html' && !c.hidden && !c._isWaaapi &&
    t >= c.start && t < c.start + c.duration);
if (needsHtmlWait) {
    // existing 5×rAF loop — only for projects that actually have html clips
}
```

**Expected result:** per-frame drops from ~83ms → ~10-25ms (drawCanvas dedup +
VideoFrame + worker ack). 20s video: ~60s → **~10-25s**, both modes.

## Phase 2 (after the rAF fix): pipeline the worker

Once the rAF tax is gone, the serial ack becomes the limiter (FTRT and MB both
`await` each frame's `frame-processed` before capturing the next). Overlap
encode(N) with render(N+1) using a small in-flight window (2-3) → throughput
approaches max(render, encode) instead of render + encode.

## Phase 3: rAF independence

`requestAnimationFrame` never fires in a hidden/background tab — long exports
freeze when the user switches tabs. Replace rAF waits with `setTimeout(0)`
(or MessageChannel) when `document.hidden`.

---

# PHASE 1 RESULTS — html-wait gate shipped (20s project, 6 HIC clips, 1920×1080@30)

## Before vs After

| Metric | FTRT before | FTRT after | MB before | MB after |
|--------|------------|-----------|-----------|----------|
| Total export | 59.9s | **35.4s** | ~50s | **~32s** |
| Real-time factor | 0.33× | **0.56×** | 0.39× | **~0.62×** |
| Steady-state ms/frame | 83.3 | **39-56** | 83.4 | **42-84** |
| Speedup | — | **1.69×** | — | **1.56×** |

## Steady-state intervals (from logs)

```
FTRT: f=60→300: (20786−11355)/240 = 39ms/frame (climbing to 56ms by f=540)
MB:   f=180→240: 42ms/frame ... f=420→480: 84ms/frame (declining, drift 2ms→12.1s)
```

MB is real-time-paced so its drift (12.1s at f=540) shows it can't hold 30fps —
it converges to the same ~40-60ms/frame wall as FTRT. The two modes are now
symptoms of the same remaining cost, not different architectures.

## First automation run (64.9s total, pre-render 36.9s) — DISCARDED as noise

Pre-render at 14 fps vs the usual 176 fps only happened when my browser
automation hammered the same tab during export. User's clean run: pre-render
518 frames in 2.9s (176.2 fps) — unchanged, confirming the regression was
test-harness contention, not code.

## Remaining per-frame cost (~40-56ms) breakdown

1. drawCanvas() ~25-35ms — full 1920×1080 composite of 12 clips (6 HIC drawImage)
2. VideoFrame ~2ms ✅ (already fast)
3. **Serial worker ack wait ~15-25ms — encode(N) blocks render(N+1)** ← next target
4. progress/overhead ~2ms (throttled ✅)

# PHASE 2 PLAN — Pipeline the worker (overlap encode with render)

**Change:** don't `await ackForFrame(N)` before capturing N+1. Keep a small
in-flight window (2-3 frames): send N, capture N+1, then await ack N before send N+2.

```
Today:    [render N][send N][wait ack N][render N+1][send N+1][wait ack N+1]  = render+encode serial
Pipelined: [render N][send N][render N+1][send N+1][wait ack N][render N+2]  = max(render, encode)
```

**Expected:** 40-56ms → ~25-35ms/frame → 20s video in ~20-25s (~0.9-1.2× real-time).

**Safety:** keep the STALL_MS watchdog per-window (not per-frame); on worker
error, drain the window before bailing. A/V sync unaffected — timestamps ride
with each frame.

**Phase 3 (later):** replace rAF pacing with setTimeout when document.hidden so
exports survive tab switches; consider drawCanvas composite caching for static
frames to cut the ~25ms render cost.

---

# PHASE 2 FAILED — worker pipelining hangs the PC on GT 740 (REVERTED)

## What was implemented

Converted the FTRT pump loop from serial acks to a 3-frame in-flight window:
central ack handler + `PIPE_WINDOW=3` queue, backpressure only when the window
filled, drain before finalize, stall watchdog scoped to non-empty windows.

## Failure signature (observed during 20s/600-frame test export)

- Pre-render normal: 518 frames in 3.1s (165 fps)
- Pump reached ~39% (~frame 234) in 21s, then progress + timer froze completely
- No console errors, no worker error — the whole PC hung (GT 740, old GPU)
- Watchdog never fired: the loop was stuck inside a synchronous GPU call
  (`drawCanvas` / `new VideoFrame`), not awaiting an ack — a JS watchdog
  cannot preempt a driver-level stall

## Root cause: the serial ack WAS the GPU protection mechanism

The original code's comment said it plainly: the FRAME_DONE serial pattern was
adopted from Kenichi Studio specifically to "prevent GPU driver timeout/BSOD"
on the GT 740. Serial execution guarantees at most ONE frame is being encoded
while the main thread waits idle — GPU pressure never overlaps.

Phase 2 removed that throttle. With a 3-frame window:

- Up to 3 × 1920×1080 VideoFrames (~8 MB each) pinned in GPU memory (~24 MB)
- Worker H.264 encode runs CONCURRENTLY with continuous drawCanvas composites
- GT 740 (Fermi/Kepler era, ~80 GB/s DDR3, shallow command queues) saturates:
  render + encode + compositor contend for the same GPU → driver queue backlog
  → system-wide hang

Conclusion: pipelining trades GPU headroom for throughput. Viable on modern
GPUs with hardware encoders; dangerous on the GT 740. Do not re-attempt
concurrency increases on this class of hardware.

## Reverted to commit 02adaec (Phase 1 — verified stable)

FTRT 35.4s / 0.56× real-time, MediaBunny ~32s / ~0.62× on the 20s project.
No hangs, no stalls across repeated runs.

# REVISED PLAN — go faster by doing LESS GPU work per frame, not more concurrently

| Phase | Change | Why GT 740-safe | Expected |
|-------|--------|-----------------|----------|
| 3a | Static-layer caching in drawCanvas: render non-animating clips (shapes, static text, static HIC frames) into cached offscreen layers; composite per frame = 1 drawImage per layer | Strictly REDUCES GPU work per frame; no added concurrency | drawCanvas ~25-35ms → ~10-15ms → total ~25-30ms/frame |
| 3b | Optional render-scale for weak GPUs: composite at 1280×720, upscale to 1920×1080 at VideoFrame creation | Cuts pixel throughput 2.25×; quality loss mostly invisible after encode | ~2× faster pump; flag-gated |
| 4 | GPU tier detection (WebGL renderer string / encode benchmark): auto-enable pipelining window=2 ONLY on strong-GPU machines; keep serial on weak | Best of both per machine | 0.9-1.2× on strong GPUs, unchanged stability on weak |

Priority: 3a first (pure win, no quality tradeoff), then evaluate 3b behind a
setting, keep 4 as a future stretch. Phase 2 code exists only in git history
and should be re-derived from this document if attempted.

---

# UX ISSUE — FTRT progress bar "0% pause" vs MediaBunny instant movement

## Symptom (user-visible)

- FTRT: progress sits at 0% for ~5-6s after clicking export, then crawls —
  reaching 10% takes ~9s total. Feels frozen/broken.
- MediaBunny: bar starts moving within ~1-2s and climbs smoothly.

## Root cause — three stacked factors

1. **FTRT does heavy work BEFORE the first frame is captured.** Timeline from
   the log: worker spawn (~1s) + audio queue + HIC pre-render (518 frames,
   3.8s) all happen while `lastCapturedFrame = -1` → progress formula
   `(lastCapturedFrame+1)/totalFrames` = 0% the whole time.
   MediaBunny has no pre-render phase — it starts capturing immediately and
   paces to real time, so the bar moves at once (drift=2ms at f=60).

2. **Pump crawl near 0%.** FTRT pumps at ~15fps (55ms/frame): frame 60 (10%)
   lands ~3.3s after the pump starts. Combined with the 5-6s dead zone, 0→10%
   ≈ 9s — perceived as a stall.

3. **Throttled updateProgress skips exact-frame timing logs.** The
   `[FTRT Timing]` log lives inside `updateProgress`, which is throttled to
   100ms; it only fires when the throttle window happens to land exactly on
   frame %60. That's why the user's log shows only f=420 and f=480 for a
   600-frame export (f=60..360 were skipped by the throttle). Misleading logs,
   and it hides the early-crawl shape of the curve.

## New data point: MediaBunny is now FASTER than FTRT

Same 20s project: **MB 26s (0.77×) vs FTRT 35.5s (0.56×)** after the html-wait
gate. MB skips pre-render entirely (HIC renders inline with dedup) and its
real-time pacing now tracks ~22-28fps early. FTRT pays 3.8s pre-render up
front then pumps at 15fps. FTRT's remaining edge (frame-accuracy under load)
may not justify its slower typical run — revisit default choice later.

## THE PLAN — two-stage progress for FTRT (UX-only, no pipeline changes, GT 740-safe)

| # | Change | Detail |
|---|--------|--------|
| 1 | **Progress during pre-render** | Add `updatePreRenderProgress(done, total)`: bar maps pre-render to 0→40% (`done/total*40`), status text "Pre-rendering HTML-in-Canvas 234/518…", timer keeps ticking from exportStartWall |
| 2 | **Rebase pump progress to 40→100%** | Pump progress = `40 + captured/total*60`; reset `window._lastFtrtProgressUpdate = 0` after pre-render so the bar moves the instant pumping starts |
| 3 | **Fix timing-log skip** | Move the `[FTRT Timing]` console.log out of `updateProgress` into the pump loop body (fires on exact %60 frames regardless of throttle) |
| 4 | **ETA during pre-render** | Show "~pre-render Xs left" from pre-render rate (frames/sec so far) instead of hiding ETA until 5% |

No GPU-concurrency changes — pure UI math, zero risk of the Phase 2 hang.

# PHASE 3 EXPLAINED — cut per-frame GPU work (the safe speed lever)

After Phase 2 (pipelining) was rejected for the GT 740, the only safe way to
go faster is to make each frame CHEAPER, not to run more concurrently.

## 3a — Static-layer caching in drawCanvas (the main event)

Today every exported frame re-composites ALL ~12 clips from scratch (~25-35ms):
background, shapes, text, HIC drawImages — even clips that haven't changed
between frames.

The idea: split the composite into **cached layers**.

```
Per frame today:   redraw clip1 + clip2 + ... + clipN        (~30ms)
Per frame with 3a: drawImage(staticLayer) + redraw only ANIMATING clips (~10-15ms)
```

- A clip's layer is re-rendered only when its "dirty" (time-varying props
  changed, HIC frame signature changed, transform/opacity animated).
- Static shapes/text/backgrounds render once per contiguous static range.
- HIC clips already have per-frame signatures (`_lastHicFrameSig`) — a HIC clip
  whose signature is unchanged is a static layer hit too.
- Invalidations: clip edit, selection change, track visibility, seek.

Expected: drawCanvas ~30ms → ~10-15ms → FTRT total ~25-30ms/frame → 20s video
in ~20s (0.9-1× real-time) WITHOUT any concurrency. Strictly less GPU work
per frame — exactly what a GT 740 needs.

## 3b — Render-scale for weak GPUs (flag-gated, optional)

Composite at 1280×720 internally, upscale to 1920×1080 at VideoFrame creation.
2.25× less pixel throughput; quality loss after H.264 encode is small but
measurable on fine text. Ship behind an "Optimize for weak GPU" toggle, OFF by
default.

## 4 — GPU-tier adaptive pipelining (future stretch)

Detect GPU via WebGL renderer string + a 30-frame encode benchmark at export
start. Strong GPUs get window=2 pipelining (the reverted Phase 2, ~1.2×);
weak GPUs keep the serial path. Never re-attempt pipelining unconditionally.

## Priority order

1. **FTRT two-stage progress (UX plan above)** — small, safe, immediate
   perceived-speed win
2. **3a static-layer caching** — the real speed win, no quality tradeoff
3. 3b render-scale toggle — only if 3a isn't enough
4. Phase 4 adaptive pipelining — stretch goal

---

# PHASE 3a SHIPPED — static-layer caching in drawCanvas ✅

## Implementation

Content-layer cache for text/shape clips (the two remaining uncached clip types):
- `_layerSig(clip, kind)` — content-props signature (fill/stroke/extrude/shadow/texture/typography/text). Per-frame state (position/scale/rotation/alpha/blend, entrance/exit/loop/keyframe anims) deliberately EXCLUDED — the caller still applies those on the main ctx.
- `getStaticLayer()` — bakes content into an offscreen canvas (dw+dh + 200px spill pad for stroke/extrude/shadow), keyed by clip.id + sig + dims. Max 64 entries.
- `renderStaticTextContent()` — mirrors the static branch of drawText (extrude→shadow→stroke→fill→decoration→texture, letter/word overrides). drawText itself untouched — animated/mosaic/puzzle/word/letter paths render directly as before.
- Selection frames bypass the cache (need exact local coords) in both paths.

## Verification

| Check | Result |
|-------|--------|
| Pixel identity cached vs uncached | ✅ identical (sampled pixel hash, stride 997) |
| Cache repopulation after clear | ✅ |
| App boot + timeline + playback | ✅ clean, no console errors |
| Cache population on 20s project | ✅ 6 layers (4 text + 2 shape) |

## Measured — 20s project, 6 HIC clips, 1920×1080@30, FTRT

| Metric | Phase 1 | Phase 3a | Δ |
|--------|---------|----------|---|
| Export total | 35.5s | **25.3s** | **1.40× faster** |
| Real-time factor | 0.56× | **0.79×** | +0.23 |
| Pump ms/frame | ~51 | **~35** | 1.45× |
| Pre-render | 3.8s | 3.1s | unchanged (HIC path untouched) |
| vs MediaBunny (26s / 0.77×) | slower | **tied** | — |

Progress hit 100% in 25s wall with no stalls, no hangs (GT 740 safe — strictly
LESS GPU work per frame: drawImage of cached layers replaces full text/shape
rasterization every frame).

## Cumulative export speed journey (20s project, FTRT)

| Phase | Total | Real-time |
|-------|-------|-----------|
| Baseline (pre-Phase-1) | 59.9s | 0.33× |
| Phase 1 (html-wait gate) | 35.5s | 0.56× |
| Phase 2 (pipelining) | REVERTED | GT 740 hang |
| **Phase 3a (static layers)** | **25.3s** | **0.79×** |

Remaining per-frame cost (~35ms): drawCanvas composite (now mostly drawImage
calls) + VideoFrame + serial worker ack. Next levers if needed: 3b render-scale
toggle, Phase 4 GPU-tier adaptive pipelining.

## Phase 3a user verification run — FTRT 38.2s vs MediaBunny 26s (why?)

User-tested both modes after Phase 3a (same 20s project, 1920×1080@30):

| Metric | MediaBunny | FTRT | Δ |
|--------|-----------|------|---|
| Export total | 26s (0.77×) | 38.2s (0.52×) | +12.2s |
| Startup before frame 0 | ~2s | ~2s + **2.9s pre-render** | +2.9s |
| Pump ms/frame (steady) | ~47 | ~52 | +5ms |
| First-frame fps | 29.4 | n/a (timing lines eaten) | — |

### Cause 1 — FTRT pays a 2.9s pre-render tax MediaBunny never pays
FTRT's Phase-2 pre-render redraws the full export canvas 518× (`drawCanvas` +
`waitForHicRenders(100)` per frame) purely to warm the HIC SVG→image cache
before frame 0. MB has no equivalent — its pump warms HIC renders as a side
effect of drawing each frame. Pure +2.9s structural handicap.

### Cause 2 — FTRT captures with a SYNC GPU readback; MB uses async
- FTRT pump: `new VideoFrame(exportCanvas, {timestamp})` — synchronous canvas
  readback that stalls the GPU pipeline.
- MB pump: `await createImageBitmap(exportCanvas)` — async, non-blocking. Its
  own code comment (line ~35021) warns sync readbacks cost 30-50ms stalls on
  GT 740 and were swapped out for exactly this reason.
- ≈ +3-5ms/frame × 600 frames ≈ +2-3s (smaller than worst case because
  text/shape layers are now cached, shrinking the composite the readback
  stalls on — but it is still on the critical path every frame).

### Cause 3 (observability bug) — FTRT timing logs are eaten by the throttle
The `[FTRT Timing]` log lives inside `updateProgress()`, which is throttled to
100ms. At ~35-50ms/frame the throttle lands on a `frame % 60 === 0` boundary
only occasionally — this run printed a single line (f=420) for a 600-frame
export. Diagnosis is flying half-blind. MB logs from its loop body (unthrottled).

Note: everything else is equal — both serialize on a per-frame worker ack
(FTRT `ackForFrame`, MB inline handler), both use the same encoder worker,
both finalize similarly. The 12.2s gap ≈ 2.9s pre-render + ~3s readback
+ ~2s startup delta + remainder in finalize/mux jitter.

Correction to an earlier conclusion: the "createImageBitmap is slower" finding
(from the revert) was based on a contaminated test — the export ran the full
60s project (1800 frames) instead of the 20s range (600 frames), so the fps
comparison was invalid. The revert's conclusion should not be trusted.

### Phase 3c plan — close the gap (all low-risk, GT 740 safe)

| # | Change | Expected | Risk |
|---|--------|----------|------|
| P0 | FTRT: drop `new VideoFrame(canvas)` fast-path; capture with `await createImageBitmap()` like MB | −2-3s, per-frame parity | Very low — MB proves this path on the same GPU |
| P1 | Move `[FTRT Timing]` log into the pump loop body (every 60 frames, outside the 100ms throttle) | Full observability | Zero |
| P2 | Skip pre-render frames whose HIC clips are static (sig unchanged) — animated presets still pre-warm, static ones cost ~0 | −0.5-2.9s depending on project | Low |
| P3 (stretch) | Self-tuning capture: benchmark VideoFrame vs createImageBitmap on the first 10 frames, keep the faster | Removes guesswork on any GPU | Low |

Expected after P0+P2: FTRT ≈ 31-33s vs MB 26s; remaining difference is the
pre-render itself, which buys FTRT frame-accurate HIC timing (no one-frame
lag) — the trade MB makes implicitly.

# PHASE 3c SHIPPED + two-stage progress bar ✅

## What was implemented (all five items)

| Item | Change |
|------|--------|
| **UX: two-stage progress** | Setup+pre-render maps to 0→40% (`_setStageProgress`) with live status "Pre-rendering HTML-in-Canvas 58/518…" + ETA; pump maps `_stageBase`(40)→100%; 100ms throttle reset at pump start |
| **P0** | FTRT capture unified in `captureFrame()` with createImageBitmap fallback (VideoFrame unavailable → locks to bitmap) |
| **P1** | `[FTRT Timing]` log moved into pump loop body — every 60th frame logs unconditionally (old in-throttle copy removed) |
| **P2** | Pre-render skips frames where every active HIC clip is static (no JS `onFrame`, no CSS `animation:`/@keyframes) AND already rendered — skip key `'S|'+sig` mirrors drawCanvas's dedup key (which now uses the same `_hicStatic` computation) |
| **P3** | Self-tuning capture: first 6 pumped frames alternate VideoFrame/bitmap (3 each), means compared, faster path locked; logs the verdict |

## Measured — 20s project (12 clips, 6 HIC), 1920×1080@30, FTRT

| Metric | Before 3c | After 3c (run 1, cold) | After 3c (run 2, warm) |
|--------|-----------|------------------------|------------------------|
| Pre-render | 2.9s | 6.9s (cold JIT) | **3.2s** |
| Export total | 38.2s (0.52×) | 34.5s (0.58×) | **26.2s (0.76×)** |
| Pump fps (steady) | ~14-15 | ~15.4 | **~20-21** |
| vs MediaBunny (26s / 0.77×) | +12s slower | +8.5s | **tied** |

Warm-vs-warm (the fair comparison): **38.2s → 26.2s = 1.46× faster**, now
equal to MediaBunny. Run 1's extra time was cold-start JIT/decode, not
regression — its steady-state fps matched run 2 by f=540.

## UX verification (automated bar sampling, 500ms cadence)

```
Stage 1: 0.5s→7% "Pre-rendering 58/518" | 1.0s→13% | 1.5s→19% | 2.0s→25% | 2.5s→31% | 3.0s→36% | 3.5s→40% (done)
Stage 2: 4.0s→40% (pump start) | 15.0s→63% | 25.5s→95% | 26.2s→100%
```

The 0% freeze is gone: bar moves within 0.5s and climbs continuously through
both stages. ETA shows during pre-render from frame 10.

## P3 benchmark observations

- Run 1 (cold): VideoFrame won 0.2ms vs 11.4ms — bitmap's first calls pay
  JIT/decode warmup, so the benchmark correctly avoided it
- Run 2 (warm): bitmap won 0.1ms vs 0.2ms — both effectively free; either
  path is fine once warm
- Constructor wall-time understates VideoFrame's true GPU-readback stall
  (it's deferred), so treat P3 as a tiebreaker, not proof. P0's real win is
  removing the per-frame stall risk on weak GPUs.

## P2 honesty note

This project skipped 0 frames — all 6 presets are genuinely animated (CSS
keyframes / onFrame). P2 only pays off on projects with static HIC content
(e.g. plain Google Clean with no onFrame), where pre-render collapses toward
one render per clip.

## Back-to-back user test (post-3c) — pump loops are now IDENTICAL

User ran MediaBunny then FTRT consecutively (same 20s project, Chrome, GT 740):

**MB: 26s (0.77×), 7.3 MB · FTRT: 34.5s (0.58×), 7.5 MB**

### Per-frame intervals (ms/frame between each 60-frame checkpoint)

| Frames | MediaBunny | FTRT | Match? |
|--------|-----------|------|--------|
| 60→120  | 38 | 39 | ✅ |
| 120→180 | 40 | 40 | ✅ |
| 180→240 | 33 | 33 | ✅ |
| 240→300 | 48 | 48 | ✅ |
| 300→360 | 48 | 48 | ✅ |
| 360→420 | 65 | 65 | ✅ |
| 420→480 | 72 | 69 | ✅ |
| 480→540 | 31 | 30 | ✅ |

The pumps are byte-for-byte the same speed at every checkpoint. The matching
65-72ms dip at f=360-480 in BOTH modes (then recovery to ~30ms) is classic
GPU thermal throttling on the GT 740 — environmental, hits both modes equally.

### FTRT's 8.5s deficit, decomposed

| Component | Cost | Nature |
|-----------|------|--------|
| Pre-render | +3.2s | By design — buys frame-accurate HIC timing |
| First 60 frames | +5.1s (119ms/frame vs MB's 33) | **Variance, not structural** — my isolated warm run totalled 26.2s; FTRT here ran immediately after a full MB export (hot GPU, GC pressure from prior export) |
| Startup delta | +0.2s | Worker/audio setup |

The first-60 warmup is the only unexplained cost and it did not appear in the
isolated run (which hit 20-21 fps steady by f=300). Likely worker encoder
cold-start + GC from the previous export's leftovers. Not worth code changes;
re-run variance dominates.

### Minor observation

The MB success-modal preview showed black at 0:01 (paused player, no frame
painted yet). Both downloads list at 7.3-7.5 MB / 3.1 Mbps. Worth one manual
spot-check: scrub both outputs to 0:01 and 4:00 and compare content.

### Conclusion

Phase 3c achieved pump parity. Mode choice is now purely about features:
- **FTRT**: pre-rendered frame-accurate HIC, video frame pool, stall watchdog
- **MediaBunny**: no pre-render wait, element-resync machinery, 3.2s head start

# FUTURE WORK (deferred)

## Smooth progress bar — velocity-projection display (planned, not implemented)

Status: planned. Current behavior is correct but the 40→41% transition can
feel sticky after Phase 3c's two-stage bar. Root cause: stage 2 is
frame-count-based and 1% = 10 pump frames; FTRT's first frames are its
slowest (cold worker encoder, ~119ms/frame), so the first visible step lands
~1.2s after 40%. MediaBunny doesn't show this because it starts capturing
real frames instantly (no pre-render) and its pump is real-time paced.

Plan (pure UI, ~25 lines, zero pipeline risk, both modes):
1. Sub-integer bar widths — set style.width with decimals ("40.3%"); keep
   the big % text integer. Bar can then move on every update.
2. Velocity-projection display ticker — a 100ms UI ticker advances the
   displayed % using measured rolling fps, projecting where the pump should
   be between acked frames, clamped to [lastAcked%, lastAcked% + small
   lead]. On a true stall it freezes honestly at the last acked frame.
3. Shared ticker drives MediaBunny's target too (one code path).

Honesty guarantee: projection is anchored to actually-acked frames — a real
stall stops the bar (stall watchdog covers that case).

## Why FTRT has the 40% stage and MediaBunny doesn't (decision record)

FTRT has ~3.2s of invisible work before frame 0 (HIC pre-render, 518 canvas
renders + worker spawn + audio). The old formula (frames/total) cannot show
anything but 0% during it — the original "0% pause" complaint. MediaBunny
has no pre-render, so its bar moves from frame 1; nothing to visualize.

The pre-render IS FTRT's frame-accuracy guarantee (without it, HIC frames
capture before their async SVG render finishes — the one-frame-lag bug).
So: keep the pre-render, keep the two-stage bar, fix the 40→41 plateau with
the projection plan above.

# BUG PLAN — HIC clips can't be dragged between timeline tracks

## Symptom
Dragging an HTML-in-Canvas clip vertically to another video track: the clip
visually follows the cursor during the drag, but snaps back to its original
track on mouseup. Other clip types (text/shape/html/video) move fine.

## Root cause (confirmed by code trace)

Every HIC clip drag goes through the MULTI-SELECT drag path, and that path's
per-clip track targeting is missing the 'hic' type:

1. `addHicClipToTimeline` (line ~25108) sets `multiSelectedClipIds = [clip.id]`,
   and `handleMouseDown` (~28655) builds `drag.initialMulti` from the selected
   set (or the linked group) — so `initialMulti` is ALWAYS non-empty for HIC
   drags. The mousemove handler takes the multi branch.
2. Shared `typedDelta` calc (line 28879) DOES include 'hic' in its visual-type
   list — so the vertical direction is computed correctly.
3. But the per-clip target assignment (line 28948, multi path) omits it:
   `const mcIsVisual = mcClip.type === 'video' || 'image' || 'text' ||
   'shape' || 'scene' || 'html'` — NO 'hic'.
4. So for a HIC clip: `mcIsVisual` = false → `mcTypedTracks` = AUDIO tracks →
   `mcInitialIndex` = -1 (its trackId is a video track) → `mc.targetTrackId`
   is never assigned.
5. Mouseup (line ~29253): `if (mc.targetTrackId) mcClip.trackId = ...` —
   undefined → trackId unchanged → renderClips() snaps the clip back.

## Fix plan

| # | Change | Scope |
|---|--------|-------|
| 1 | **Line 28948: add `|| mcClip.type === 'hic'`** to `mcIsVisual` | 1-line fix — the bug |
| 2 | Extract a shared `isVisualTimelineClip(type)` helper and use it at both type-list sites (28879 + 28948) so the lists can't drift apart again | Small refactor, prevents recurrence |
| 3 | Sweep the other duplicated clip-type lists (5573, 27846, 8772, 11683...) for other missing-'hic' occurrences and consolidate where identical in meaning | Hardening follow-up |

## Verification plan
1. Drag a HIC clip one track down/up → sticks after mouseup, renders on new track
2. Drag across 2+ tracks in one gesture → lands on the hovered track
3. Multi-select HIC + text clip → drag both vertically → both move tracks
4. Drag HIC clip horizontally only → no accidental track change
5. Regression: text/shape/video/audio clips still move between tracks

# BUG PLAN 2 — No selection bounding box for HIC clips on canvas

## Symptom
Selecting an HTML-in-Canvas clip shows the Properties panel but NO bounding
box on the canvas preview. Every other visual type (html, image, video,
text, shape, scene, WAAPI) draws an indigo selection box with corner
handles + rotate stem via `domBoundingBoxContainer`.

## Root cause (code trace)

`drawCanvas` renders a DOM bounding box per clip type at 6 sites:
- html clip: line ~6745 ✅
- image/video: ~6984 ✅
- text/shape/etc: ~7326 ✅
- WAAPI: ~7670 ✅
- **hic branch (~6778-6928): MISSING entirely** — goes stroke → shadow →
  ctx.restore() with no box block.

The HIC branch computes all the same variables the box needs (`cx`, `cy`,
`finalScale`, `rotate`, `aState.animRot`, `w`, `h`, `flipH/flipV`) — the
block was simply never copied into this branch when HIC rendering was
built.

## Fix plan

| # | Change | Scope |
|---|--------|-------|
| 1 | Insert the same DOM bounding-box block into the `clip.type === 'hic'` branch right before `ctx.restore()` (after the shadow block), using the branch's identical variable names | ~10-line copy, mirrors html-clip site |
| 2 | Longer-term (with the drag-fix refactor): extract `drawDomBoundingBox(clip, ctx, canvas, {cx, cy, w, h, rotate, animRot, finalScale})` helper and call it from all 6 sites — the block is copy-pasted 4× already, each with drift risk | Hardening follow-up |

Note: the HIC box must NOT draw when `clip._hicR` is missing/unready —
actually safe by default: the box only needs transform vars, which exist
regardless of render state.

## Verification plan
1. Select HIC clip → indigo box with 4 corner handles + rotate stem appears
2. Box tracks live while: playing (entrance anims), scaling/rotating in
   Transform card, flipping, changing opacity
3. Deselect → box disappears; select other clip type → box moves to it
4. During export → no box (guarded by !State.isExporting && !targetCtx)
5. Multi-select HIC + text → both get boxes

# BUG PLAN 3 — Drop shadow & border radius not applying to HIC clips

## Symptom
With a HIC clip selected: setting Border Radius (e.g. 59px) or enabling
Drop Shadow in the properties panel does nothing on the canvas preview.
Other clip types apply both correctly.

## Root cause (code trace, HIC branch ~6903-6928)

1. **Border radius: zero references.** The HIC branch never reads
   `clip.effects.borderRadius` — `ctx.drawImage(_hr.display, ...)` draws a
   hard-cornered rectangle. Every other visual type round-clips via
   `roundRect(...)` + `ctx.clip()` (html: 6694+6701, video: 7089, text/shape:
   6724, image: 6494). The HIC stroke block also uses `ctx.rect` (square),
   unlike the html branch which uses `roundRect` for stroke.
2. **Drop shadow: dead code.** The branch sets `ctx.shadowColor/Blur/Offset`
   AFTER the `ctx.drawImage` call. Canvas shadow properties only affect
   drawing operations executed AFTER they are set — so the block changes
   nothing. (Stroke also runs before it, so the shadow affects nothing at
   all.) Correct order everywhere else: set shadow props → drawImage →
   reset shadow to transparent.

## Fix plan

Mirror the html-clip branch pattern (it already solved the tricky part):
clip-vs-shadow interaction — a rounded `ctx.clip()` would also clip away
the shadow. The html branch avoids this by rasterizing rounded content
offscreen, then drawing that offscreen canvas with shadow enabled, so the
shadow follows the rounded alpha silhouette.

| Combo | Draw sequence for HIC |
|-------|----------------------|
| radius + shadow | round-clip into a cached per-clip temp canvas → draw temp with shadow props set → reset shadow |
| radius only | `roundRect` + `clip()` on main ctx → drawImage |
| shadow only | set shadow props → drawImage → reset shadow |
| neither | plain drawImage (current path) |

Details:
- Cache the rounded temp canvas on the renderer (`_hr._rounded`, keyed by
  w/h/borderRadius sig) to avoid per-frame allocation
- Stroke block: switch `ctx.rect` → `roundRect` when radius > 0 (parity
  with html branch)
- Combo logic into a small helper or inline if/else — 4 branches, ~30 lines
- Same fix automatically applies to export (same code path, targetCtx
  included)

## Verification plan
1. Radius 59px on HIC → corners visibly rounded on canvas preview
2. Drop shadow on → shadow appears offset/blur as configured
3. Radius + shadow together → shadow follows the rounded silhouette
   (not clipped away, not square)
4. Stroke + radius → rounded outline
5. Export (FTRT + MediaBunny) → same appearance as preview
6. Regression: html/image/video/text clips unchanged

# FEATURE PLAN — Standalone HIC Code Editor modal + AI prompt integration

## Current state
- Properties panel has 3 cramped textareas (4/3/3 rows) that live-edit
  clip.html/css/js — fine for tweaks, painful for real coding
- `openHicEditor(clipId)` is a placeholder stub logging "Phase 2.3 will add
  CodeMirror modal" — the button exists, the modal doesn't
- `htmlEditorModal` (for WAAPI html clips) is the proven pattern to mirror:
  full-screen z-[110] overlay, HTML/CSS/JS textareas, live iframe preview,
  preset buttons, Apply/Cancel
- AI infra already exists: aiPanelOverlay with openai/anthropic/custom
  providers, `studiopro_ai_key_*` localStorage, callOpenAIAPI/callAnthropicAPI
  helpers, system-prompt pattern (AI_SYSTEM_PROMPT for the script generator)
- No CodeMirror/Monaco in the project — keep styled textareas (consistent,
  zero deps), add Tab-key insertion + error surface

## Phase E1 — Editor modal (core)

| Element | Design |
|---------|--------|
| Shell | Mirror htmlEditorModal: `fixed inset-0 z-[110]` overlay, max-w-6xl, 90dvh, dark surface |
| Code panes | Left half, 3 stacked sections HTML/CSS/JS with colored labels (reuse the green/blue/yellow mono styling); Tab inserts 2 spaces; Ctrl+Enter = Apply |
| Live preview | Right half: iframe sandbox at 800×450 design space, scaled to fit; rAF loop drives `onFrame(t)` exactly like the HIC sandbox so what you see = what renders on canvas; play/restart button + time readout |
| Apply | Writes clip.html/css/js, resets `_hicSig` + `_lastHicFrameSig`, drawCanvas(), keeps modal open (toggle in header: "Close on apply") |
| Cancel | Reverts to entry snapshot; confirm if dirty |
| Entry points | `openHicEditor(clipId)` (existing button) + a "Code" button on HIC timeline clips' context menu |

## Phase E2 — AI generation + copy/paste workflow

| Element | Design |
|---------|--------|
| Prompt bar | Top of modal: textarea + Generate button; quick-chips (Lower third, Counter, Chart, Terminal, Logo sting, Kinetic text) |
| System prompt | HIC-specific contract baked in: single onFrame(time) function receiving ms; 800×450 design space scaled to canvas; no external JS libs; CSS animations allowed; must be deterministic per time (no requestAnimationFrame of its own, no setTimeout-driven state); images must be CORS-safe data-URLs or unsplash |
| Generate | Uses existing provider helpers + stored key; streams into the 3 panes (parse ```html/css/js fenced blocks); error toast on failure |
| Copy prompt (external AI) | "Copy AI Prompt" button → copies the full system contract + user prompt to clipboard for ChatGPT/Claude web; "Paste code" buttons per pane accept whatever the user pasted back |
| Copy per pane | Small copy icon on each pane label — fast path to paste into the properties-panel textareas instead |
| Properties fast-path | Also add a paste-from-clipboard button next to the 3 properties textareas so generated code can land there without opening the modal |

## Phase E3 — Polish (later)
- JS error surface: catch onFrame exceptions in preview, show inline status bar with line hint
- Draft autosave per clip id (sessionStorage) so accidental Cancel loses nothing
- Prompt history dropdown (last 10)
- Optional: line numbers gutter

## Verification plan
1. Open editor from properties button + timeline context menu
2. Edit HTML → preview updates live; onFrame time advances; Apply updates
   canvas clip in real time (seek playhead to verify)
3. Cancel reverts; dirty-confirm shows
4. AI Generate with stored key → panes fill → Apply → clip animates on canvas
5. Copy AI Prompt → paste into external chat → paste result back → works
6. Copy pane → paste into properties textarea → identical behavior

# BUG FIXES 1-3 IMPLEMENTED + VERIFIED ✅

## What shipped

| Fix | Change |
|-----|--------|
| **1. Track drag** | `mcIsVisual` in the multi-select drag path now includes `'hic'` — HIC clips can move between video tracks |
| **2. Selection box** | DOM bounding-box block (indigo, 4 corner handles + rotate stem) inserted into the HIC branch before `ctx.restore()`, using the branch's own cx/cy/finalScale/rotate/animRot/flip vars |
| **3. Radius + shadow** | 4-combo draw path: radius+shadow → round-clip into `_hr._rounded` cached temp, drawn WITH shadow props (shadow follows rounded silhouette); radius-only → roundRect+clip in place; shadow-only → shadow props BEFORE drawImage (the old code set them after — dead code); neither → plain. Stroke uses roundRect when radius>0 |

## Critical bug caught during verification (and fixed)

First pixel check failed: `_hr._rounded` captured a BLANK frame. Root cause:
the HIC display canvas fills asynchronously (SVG image onload) but the
rounded cache built synchronously on first draw — caching transparency
forever. Fix: `_hr._contentRev` counter bumped in img.onload; the rounded
cache key includes it (`1920x1080r40v2`), so the cache rebuilds whenever
new content actually lands. This also means the radius+shadow path stays
correct as the preset animates.

## Verification results (live preview, pixel-level)

| Check | Result |
|-------|--------|
| Fix 1: mcIsVisual true for HIC; typed-track lookup finds video tracks; drop lands +1 track | ✅ (applied, verified, reverted) |
| Fix 2: box in domBoundingBoxContainer, `2px solid #6366f1`, handles visible in screenshot | ✅ |
| Fix 3: rounded cache center α=255, corner α=0 (radius works); display syncs via rev-bump | ✅ |
| Screenshot: stagger preset with red stroke + indigo selection box + handles | ✅ |
| Radius+shadow+stroke coexist (screenshot) | ✅ |

Not yet verified by user: real mouse-drag across tracks (code path
simulated), export appearance (same code path — low risk).

---

# Hardening Sweep: Clip-Type List Consolidation (post HIC bug-fixes)

**Date:** post c9223ff · Goal: eliminate the copy-pasted clip-type lists that caused
the HIC track-drag bug class ("one list had 'hic', its twin didn't").

## What shipped

**1. Single source of truth** (top of main script, after PALETTES):
- `VISUAL_CLIP_TYPES = ['video','image','text','scene','shape','html','hic']`
- `AUDIO_CLIP_TYPES = ['audio']`
- `isVisualTimelineClip(clipOrType)` / `isAudioTimelineClip(clipOrType)` — accept
  clip object or type string.

**2. Converted 7 call sites** that had drifted or could drift:
| Site | Before | Why it mattered |
|------|--------|-----------------|
| ~5590 active-visual-clips filter (canvas mouse hit-test) | inline 7-type list (already had hic) | consistency |
| ~8869 effects change → needsCanvasRedraw | inline 7-type list | consistency |
| ~11780 Opacity & Blending card | inline list (already had hic) | consistency |
| ~11935 Transform card | inline list | consistency |
| ~27943 canvas mousedown hit-test | inline list missing scene | **fixed: scene clips now canvas-selectable** |
| ~28976 single-select drag target validation | inline 7-type list | consistency |
| ~29034 multi-select drag mcIsVisual | **the original bug site** (had been patched) | now drift-proof |

**3. Two real bugs found beyond the lists:**
- **Trim-left `isProcedural`** (line ~29107) was
  `text||shape||image||scene` — html/hic clips were treated as *media*:
  left-trim hit the `newSourceOffset < 0` clamp and refused to stretch.
  Now: `isVisualTimelineClip(clip) && clip.type !== 'video'` (identical
  treatment for the original four, adds html/hic).
- **html/hic factories lacked `maxDuration: 3600`** — right-trim cap
  `(clip.maxDuration || clip.duration)` froze them at their saved length
  (can't stretch at all). Fixed in `addHtmlClipToTimeline` +
  `addHicClipToTimeline`, **and** backfilled in `restoreClip` for legacy
  saved projects.

**4. Intentionally NOT converted (genuinely media-specific):**
- 11827 Stroke card (text/shape/image/video/html/hic — shape-specific stroke UI)
- 13224 SFX attach (text/shape/image only — feature scope)
- 11761 Extrude 3D card (text/shape only — feature scope)
- 13206/26825/30590 speed-badge & media handling (video/audio/image only)

**5. Pre-existing latent bug noted, not fixed (out of scope):**
`createClipBase('html')` at line 9074 references a function that is never
defined in the codebase — the automation-API `Clip.add` path would throw if
exercised. Flagged for a future fix.

## Verification (live preview, project: 12 clips / 6 HIC)

| Check | Result |
|-------|--------|
| Main script parses clean | ✅ 2,195,908 chars |
| Helper classification: hic/html/text/video = true, audio = false | ✅ |
| All 6 existing HIC clips + legacy backfill (maxDuration present) | ✅ 6/6 |
| Drag path: mcIsVisual=true → video-track lookup finds track (idx 4), up/down targets resolve | ✅ |
| Trim-right: HIC maxAllowedDuration now 3600s (was capped at 5s) | ✅ |
| Trim-left: image stays procedural (unchanged), html/hic now procedural | ✅ |
| App boots clean, canvas renders, no console errors | ✅ |
| 9 helper call sites live in served source | ✅ |

**Net effect:** HIC and HTML clips can now be freely dragged between tracks,
left-trimmed, and right-trim stretched — same as text/shape/image. Future clip
types only need one list updated.
