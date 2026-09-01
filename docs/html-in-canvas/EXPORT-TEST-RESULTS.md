# FTRT Export Test Results — Phase 0+1+2

## Test Configuration

- **Clips:** 6 HIC clips (Google Clean, Gradient Hero, etc.)
- **Duration:** 30s @ 30fps = 900 frames
- **Resolution:** 1920×1080
- **Format:** MP4 via FTRT

## Results

### Pre-Render Phase ✅

```
[FTRT] Pre-rendering HIC frames for 6 clip(s)...
[FTRT] HIC pre-render done: 643 frames in 3.5s (181.2 fps)
```

| Metric | Value |
|--------|-------|
| Frames pre-rendered | 643 / 900 (71%) |
| Pre-render time | 3.5s |
| Pre-render FPS | **181.2 fps** |
| Frames skipped (no HIC) | 257 (29%) |

**Analysis:** Pre-render is extremely fast. 181 fps means each unique HIC frame takes ~5.5ms to render and cache. The dedup is working — many frames are identical and skipped.

### Pump Phase ❌ (Slower than expected)

```
[FTRT Timing] f=60/899  wall=17114ms  fps=3.5
[FTRT Timing] f=120/899 wall=22111ms  fps=5.4
[FTRT Timing] f=240/899 wall=32109ms  fps=7.5
[FTRT Timing] f=480/899 wall=52141ms  fps=9.2
[FTRT Timing] f=840/899 wall=82140ms  fps=10.2
```

| Metric | Before Phase 2 | After Phase 2 | Change |
|--------|----------------|---------------|--------|
| Pump FPS | 11.5 (stable) | 3.5→10.2 (climbing) | **Worse** |
| Total time | 52s | 87.1s | **1.7× slower** |
| Real-time | 0.38× | 0.34× | **Worse** |

### Export Summary

```
Duration:  0:30
Resolution: 1920×1080
Frame Rate: 30 fps
Format:    MP4 · 0.34×...
File Size: 8.5 MB
Export Time: 1:27
Bitrate:   2.4 Mbps
```

## Why Pump Phase Is Slower

The pre-render cached HIC display canvases, but the pump loop still:

1. **`drawCanvas()` runs for ALL clip types** — text, shape, image, video clips still render every frame
2. **`waitForHicRenders(80)` polls even when no HIC clips active** — wastes 2ms×20 polls = 40ms per non-HIC frame
3. **`createImageBitmap(exportCanvas)` captures full 1920×1080** — this is the real bottleneck (~50-100ms per frame)
4. **FPS climbs from 3.5→10.2** — early frames have more clips active, later frames have fewer

### Time Breakdown (per frame at f=60)

| Step | Estimated Time |
|------|---------------|
| `drawCanvas()` (all clips) | ~30ms |
| `waitForHicRenders()` | ~5ms (dedup hit, instant return) |
| `createImageBitmap()` | ~50-100ms |
| `sendFrame()` + `ackForFrame()` | ~5ms |
| **Total** | **~90-140ms per frame** |

**The bottleneck is `createImageBitmap()` at 1920×1080, not HIC rendering.**

## Comparison: All Phases

| Metric | Baseline | Phase 0+1 | Phase 0+1+2 |
|--------|----------|-----------|-------------|
| Clips | 3 | 7 | 6 |
| Duration | 30s | 20s | 30s |
| Frames | 900 | 600 | 900 |
| Export time | 143.6s | 52.0s | 87.1s |
| Real-time | 0.21× | 0.38× | 0.34× |
| Pump FPS | 3.3-6.1 | 11.2-11.8 | 3.5-10.2 |
| Pre-render | None | None | 3.5s (181 fps) |

**Phase 0+1 was the best performer** because it had fewer clips and the dedup worked well without the overhead of pre-rendering.

## Next Phase Plan

### Phase 3: Skip Non-HIC Overhead in Pump Loop

**Problem:** `waitForHicRenders()` polls even when no HIC clips are active.

**Fix:** Check if any HIC clips are active at current time before polling.

```javascript
// Only wait for HIC renders if an HIC clip is active at this time
var _anyHicActive = State.clips.some(c => 
    c.type === 'hic' && !c.hidden && 
    State.currentTime >= c.start && State.currentTime < c.start + c.duration
);
if (_anyHicActive) {
    var _hicReady = await waitForHicRenders(80);
    if (_hicReady) drawCanvas(exportCtx, exportW, exportH);
}
```

**Impact:** Saves ~40ms per frame for non-HIC frames → +3-5 fps.

### Phase 4: Reduce createImageBitmap Cost

**Problem:** `createImageBitmap()` at 1920×1080 takes 50-100ms per frame.

**Options:**
1. **Lower export resolution** — 1280×720 for preview, 1920×1080 for final
2. **OffscreenCanvas** — render to OffscreenCanvas, transfer to main thread
3. **WebGL capture** — use WebGL to capture canvas (faster than createImageBitmap)
4. **Skip capture for static frames** — if canvas hasn't changed, reuse last bitmap

**Impact:** Could reduce per-frame time from 90ms to 20-30ms → 30-50 fps.

### Phase 5: Parallel Frame Capture

**Problem:** Single-threaded capture pipeline.

**Options:**
1. **Double-buffer** — capture frame N while rendering frame N+1
2. **WebWorker capture** — offload createImageBitmap to worker
3. **RequestAnimationFrame budget** — render multiple frames per rAF

**Impact:** Could overlap render + capture → 2× throughput.

## Recommended Priority

| Phase | Effort | Expected FPS | Priority |
|-------|--------|-------------|----------|
| Phase 3: Skip non-HIC wait | Low | +3-5 fps | **P0** |
| Phase 4: Reduce createImageBitmap | Medium | +10-20 fps | **P1** |
| Phase 5: Parallel capture | High | +15-30 fps | P2 |

**Target after Phase 3+4:** 20-30 fps → 30s export in ~30-45s (0.7-1× real-time).
