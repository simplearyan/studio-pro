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
