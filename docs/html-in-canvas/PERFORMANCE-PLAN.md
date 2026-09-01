# HIC Export Performance: Analysis vs HyperFrames

## Current FTRT Export Stats

```
3 HIC clips, 30s, 1920×1080 @ 30fps = 900 frames
Export time: 143.6s (0.21× real-time)
FPS: starts at 3.3, climbs to 6.1
```

## Why HIC Export Is Slow (Simple Terms)

Each frame goes through a **5-step pipeline** that's like making a photocopy of a photocopy:

```
Step 1: Run JavaScript (onFrame) — updates the DOM
Step 2: Clone the entire DOM tree — like making a copy of a building
Step 3: Serialize to text (XMLSerializer) — convert the copy to a recipe
Step 4: Encode the recipe (encodeURIComponent) — translate it to another language
Step 5: Load it as an image (new Image + data URL) — rebuild from the translation
```

**The bottleneck:** Steps 2-5 happen for EVERY frame (30 times per second per clip). At 1920×1080, the SVG string is ~200KB — encoding that 900 times is CPU-intensive.

**Why it's async:** Step 5 (image loading) is asynchronous. By the time the image loads, the export loop has already moved on. This means:
- Frame N renders, but shows up on frame N+1 (1-frame lag)
- The export loop doesn't wait for HIC renders to complete
- `createImageBitmap()` captures a stale/blank canvas

## HyperFrames Comparison

HyperFrames uses **completely different architecture**:

| Feature | Studio Pro HIC | HyperFrames |
|---------|---------------|-------------|
| **Rendering** | SVG foreignObject (browser main thread) | CDP `Page.captureScreenshot` or `canvas.drawElementImage` |
| **Frame capture** | Async `new Image()` + `ctx.drawImage` | Synchronous `page.screenshot()` via Puppeteer |
| **Seeking** | DOM manipulation + re-serialize | CDP `BeginFrame` API (deterministic) |
| **Static dedup** | None | Predicts static frames, reuses last buffer |
| **Parallelism** | Single-threaded | Parallel browser instances |
| **Acceleration** | None | `--enable-features=CanvasDrawElement` for 1.6× speedup |

### Key HyperFrames Optimizations We Can Adopt

1. **Static Frame Deduplication** — If frame N is identical to frame N-1, reuse the buffer
   - HyperFrames analyzes GSAP timelines to predict which frames are static
   - **Our equivalent:** If `onFrame(time)` produces same DOM as previous frame, skip re-render

2. **BeginFrame API** — Chrome's CDP `BeginFrame` gives deterministic, synchronous frame control
   - No async image loading — screenshot is synchronous
   - **Our equivalent:** Use `canvas.toDataURL()` or `createImageBitmap()` after sync render

3. **DrawElement Service** — `canvas.drawElementImage()` reads DOM paint records directly into canvas
   - Bypasses compositor pipeline — 46% faster than screenshot on GPU
   - **Our equivalent:** Not directly available, but we can use OffscreenCanvas

4. **Parallel Browser Instances** — Multiple Puppeteer browsers render different frame ranges simultaneously
   - **Our equivalent:** WebWorker rendering or chunked pre-render

## Performance Improvement Plan

### Phase 1: Sync Rendering During Export (3 → 15-20 fps) ⭐ P0

**Problem:** `img.onload` is async — FTRT loop captures stale frames.
**Fix:** Make HIC rendering synchronous by waiting for image load before capture.

```javascript
// In drawCanvas HIC block — collect pending renders
if (!window._pendingHicRenders) window._pendingHicRenders = [];
window._pendingHicRenders.push(new Promise(resolve => {
    var check = setInterval(() => {
        if (!clip._hicR._rendering) { clearInterval(check); resolve(); }
    }, 1);
}));

// In FTRT pump — wait before capture
if (window._pendingHicRenders.length) {
    await Promise.all(window._pendingHicRenders);
    window._pendingHicRenders = [];
    drawCanvas(exportCtx, exportW, exportH); // re-draw with updated frames
}
```

**Impact:** Each frame waits ~15-30ms for async render → 33-66 fps theoretical.

### Phase 2: Static Frame Deduplication (15 → 30 fps) ⭐ P1

**Problem:** Re-rendering identical frames wastes CPU.
**Fix:** Track last rendered signature, skip if unchanged.

```javascript
// In HIC render block
var frameSig = clipTime.toFixed(3) + '|' + sig;
if (clip._lastHicFrameSig === frameSig) {
    // Same frame — reuse cached display canvas
    ctx.drawImage(_hr.display, -w/2, -h/2, w, h);
    return; // skip SVG pipeline
}
clip._lastHicFrameSig = frameSig;
```

**Impact:** Many frames are identical (especially between keyframes) → skip rendering entirely.

### Phase 3: Pre-Render All HIC Frames (30 → 60+ fps) ⭐ P2

**Problem:** Each frame renders on-demand during export loop.
**Fix:** Pre-render ALL HIC frames into cached canvases before export starts.

```javascript
async function preRenderAllHicFrames(clips, startTime, endTime, fps) {
    var hicClips = clips.filter(c => c.type === 'hic');
    for (let t = startTime; t < endTime; t += 1/fps) {
        for (const clip of hicClips) {
            if (t >= clip.start && t < clip.start + clip.duration) {
                await renderHicFrameSync(clip, (t - clip.start) * 1000);
            }
        }
    }
    // Now export loop reads from cache — zero rendering overhead
}
```

**Impact:** Pre-render takes time upfront (maybe 20-30s), but export loop runs at 60+ fps.

### Phase 4: Reduce SVG Encoding Cost (Long-term)

**Problem:** `encodeURIComponent()` on 200KB SVG is CPU-intensive.
**Fixes:**

1. **Use Blob URL instead of data URL** — `URL.createObjectURL(new Blob([svg]))` avoids encoding
2. **Reduce SVG size** — Minify CSS, remove comments, compress HTML
3. **Use `canvas.toBlob()`** instead of `canvas.toDataURL()` — avoids base64 encoding

### Phase 5: WebWorker Rendering (Long-term)

**Problem:** All rendering happens on main thread, blocking UI.
**Fix:** Offload HIC rendering to WebWorker with OffscreenCanvas.

```javascript
// Worker receives: { html, css, js, time, width, height }
// Worker returns: ImageBitmap (transferable, zero-copy)
```

## Priority Matrix

| Phase | Effort | FPS Gain | User Impact | Priority |
|-------|--------|----------|-------------|----------|
| Phase 1: Sync await | Low | 3→15 fps | Export 10× faster | **P0** |
| Phase 2: Static dedup | Low | 15→30 fps | Export 2× faster | **P1** |
| Phase 3: Pre-render | Medium | 30→60+ fps | Real-time export | **P2** |
| Phase 4: Blob URLs | Low | 10-20% gain | Faster per-frame | P3 |
| Phase 5: WebWorker | High | UI unblocked | Smooth UI during export | P3 |

## Expected Results After Phase 1+2

- **Before:** 143s for 30s video (0.21× real-time)
- **After Phase 1:** ~30-40s (0.75-1× real-time)
- **After Phase 1+2:** ~15-25s (1.2-2× real-time)
- **After Phase 3:** ~5-10s (3-6× real-time)
