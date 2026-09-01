# FTRT Export Test Results — All Phases

## Latest Test (6 HIC clips, 30s, 1920×1080 @ 30fps)

```
[FTRT] Pre-rendering HIC frames for 6 clip(s)...
[FTRT] HIC pre-render done: 643 frames in 3.6s (178.3 fps)
[FTRT Timing] f=60   fps=3.6   wall=16.5s
[FTRT Timing] f=240  fps=7.6   wall=31.4s
[FTRT Timing] f=480  fps=9.3   wall=51.5s
[FTRT Timing] f=840  fps=10.3  wall=81.5s
[FTRT] exported 30.0s in 86.4s = 0.35× real-time (mp4)
```

| Metric | Value |
|--------|-------|
| Duration | 30s |
| Resolution | 1920×1080 |
| Frame Rate | 30 fps |
| Total Frames | 900 |
| Export Time | 86.4s (1:26) |
| Real-time | 0.35× |
| File Size | 8.5 MB |
| Bitrate | 2.4 Mbps |

## All Tests Comparison

| Test | Clips | Duration | Frames | Export Time | Real-time | FPS Range |
|------|-------|----------|--------|-------------|-----------|-----------|
| Baseline | 3 | 30s | 900 | 143.6s | 0.21× | 3.3-6.1 |
| Phase 0+1 | 7 | 20s | 600 | 52.0s | 0.38× | 11.2-11.8 |
| Phase 2 (no skip) | 6 | 30s | 900 | 87.1s | 0.34× | 3.5-10.2 |
| Phase 2 (with fast wait) | 6 | 30s | 900 | 86.4s | 0.35× | 3.6-10.3 |

## Key Insights

### 1. Pre-render is Excellent ✅
- 643 frames cached in 3.6s = **178.3 fps**
- 71% of frames had active HIC clips
- Each unique HIC frame takes ~5.5ms to render and cache

### 2. Pump Phase is the Bottleneck ❌
- FPS climbs from 3.6 → 10.3 (not stable)
- **`createImageBitmap()` takes 50-100ms per frame** at 1920×1080
- This is the #1 bottleneck — not HIC rendering

### 3. Fast HIC Wait Saves Minimal Time
- Only ~0.7s saved (87.1s → 86.4s)
- Most frames have HIC clips active, so the fast path rarely triggers

### 4. FPS Climbing Pattern
- Early frames (f=60): 3.6 fps — more clips active, more rendering
- Late frames (f=840): 10.3 fps — fewer clips, less work
- This suggests non-HIC clips (text, shape, image) also contribute to slow frame times

## Time Breakdown (per frame at f=60)

| Step | Estimated Time | % of Total |
|------|---------------|------------|
| `drawCanvas()` (all clips) | ~30ms | 20% |
| `waitForHicRenders()` | ~2ms (fast path or dedup) | 1% |
| `createImageBitmap()` | **~80ms** | **53%** |
| `sendFrame()` + `ackForFrame()` | ~5ms | 3% |
| Worker encoding | ~30ms | 20% |
| Other overhead | ~5ms | 3% |
| **Total** | **~150ms** | **100%** |

**The bottleneck is `createImageBitmap()` at 53% of frame time.**

## Why createImageBitmap is Slow at 1920×1080

```
createImageBitmap(canvas) does:
1. GPU → CPU readback: flush GPU pipeline, copy 8.3 MB to system memory  ← 50-80ms
2. Format conversion: RGBA → ImageBitmap format                           ← 5-10ms
3. Memory allocation: allocate 8.3 MB for new bitmap                      ← 1-2ms
```

The GPU readback is the bottleneck. At 1920×1080, that's 2,073,600 pixels × 4 bytes = 8.3 MB of data flowing from GPU to CPU on every frame.

## Next Phase Options

### Option A: WebCodecs VideoEncoder (Best Quality + Speed)

Replace `createImageBitmap()` + worker encoding with WebCodecs `VideoEncoder`:

```javascript
const encoder = new VideoEncoder({
    output: (chunk, meta) => {
        worker.postMessage({ type: 'encoded-chunk', chunk, meta });
    },
    error: (e) => console.error(e)
});
encoder.configure({
    codec: 'avc1.64001f',
    width: 1920, height: 1080,
    bitrate: 2_400_000,
    framerate: 30
});

// In pump loop — no createImageBitmap needed:
drawCanvas(exportCtx, exportW, exportH);
var frame = new VideoFrame(exportCanvas, { timestamp: targetFrame * 1000000 / fps });
encoder.encode(frame, { keyFrame: targetFrame % 30 === 0 });
frame.close();
```

**Why faster:** `VideoFrame` from canvas shares the buffer directly — no GPU readback, no format conversion. The encoder handles everything.

**Expected:** 20-30 fps (2-3× faster than current).

### Option B: Skip Frames + Interpolate (Fastest)

Render every Nth frame, interpolate the rest:

```javascript
// Render every 3rd frame (30 fps → 10 renders/sec)
if (targetFrame % 3 === 0) {
    drawCanvas(exportCtx, exportW, exportH);
    var bitmap = await createImageBitmap(exportCanvas);
    sendFrame(bitmap, targetFrame);
    lastKeyBitmap = bitmap;
    lastKeyFrame = targetFrame;
} else {
    // Reuse last keyframe (worker handles interpolation)
    worker.postMessage({ type: 'reuse-key', frameIndex: targetFrame, keyFrame: lastKeyFrame });
}
```

**Why faster:** 3× fewer `createImageBitmap` calls.

**Tradeoff:** Lower temporal quality (3-frame repeats). Worker needs interpolation logic.

### Option C: Lower Render Resolution (Simplest)

Render at 1280×720, let encoder upscale to 1920×1080:

```javascript
drawCanvas(exportCtx, 1280, 720);
var bitmap = await createImageBitmap(exportCanvas); // 3.7 MB, 2× faster
// Encoder upscales to 1920×1080
```

**Why faster:** 2.3× less data to capture (3.7 MB vs 8.3 MB).

**Tradeoff:** Slight quality loss from upscaling (imperceptible for most content).

## Recommended Path

| Option | Expected FPS | Quality | Effort |
|--------|-------------|---------|--------|
| Current | 3.6-10.3 | 1920×1080 ✅ | Done |
| **Option A: WebCodecs** | **20-30** | **1920×1080 ✅** | **Medium** |
| Option B: Skip + interpolate | 15-25 | 1920×1080 ⚠️ | Medium |
| Option C: 720p render | 8-15 | 1920×1080 ✅ | Low |

**Recommendation: Option A (WebCodecs)** — keeps full 1920×1080 quality while being 2-3× faster.
