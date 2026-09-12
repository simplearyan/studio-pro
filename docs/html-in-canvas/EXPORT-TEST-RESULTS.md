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
