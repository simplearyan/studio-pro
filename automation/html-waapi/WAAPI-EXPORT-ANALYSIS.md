# WAAPI Export Analysis & Plan

## How Studio Pro Exports Video

### The Export Architecture (All Clip Types)

```
startMediaBunnyExport() / startFTRTExport()
    │
    ├── 1. Setup: Create export canvas, fresh video elements, audio buffer
    │
    ├── 2. Frame Loop (realtimeExportLoop):
    │      │
    │      ├── State.currentTime = startTime + frameIndex * timeStep
    │      │
    │      ├── For video clips: seek/play video elements to match currentTime
    │      │
    │      ├── drawCanvas(exportCtx, exportW, exportH)  ◄── SAME function as preview!
    │      │      │
    │      │      ├── Text clips:     ctx.fillText()           ✅ Canvas 2D API
    │      │      ├── Image clips:    ctx.drawImage(imgEl)     ✅ Canvas 2D API
    │      │      ├── Shape clips:    ctx.fillRect/arc()       ✅ Canvas 2D API
    │      │      ├── HTML clips:     html2canvas → drawImage  ✅ DOM → Canvas
    │      │      └── WAAPI clips:    ???                      ❌ Broken
    │      │
    │      ├── Wait for pending html2canvas captures
    │      │
    │      ├── createImageBitmap(exportCanvas) → sendFrameToWorker()
    │      │
    │      └── Worker encodes frame → mux into MP4/WebM
    │
    └── 3. Cleanup: restore video elements, close modal
```

### Key Insight: `drawCanvas()` Is Universal

The **same `drawCanvas()` function** handles both canvas preview AND export. The only difference:
- **Preview:** `drawCanvas(null, w, h)` → renders to screen canvas
- **Export:** `drawCanvas(exportCtx, exportW, exportH)` → renders to offscreen export canvas

This means **every clip type that works in preview should also work in export**.

### Frame Snapshot (Single Frame Export)

```javascript
async function renderFrameCanvas() {
    const baseCanvas = document.createElement('canvas');
    drawCanvas(baseCanvas.getContext('2d'), bw, bh);  // SAME drawCanvas!
    // Scale to target resolution
    ctx.drawImage(baseCanvas, 0, 0, w, h);
    return { canvas, cfg };
}
```

Also uses `drawCanvas()` — so fixing WAAPI in drawCanvas fixes everything.

---

## SVG foreignObject: Why It Doesn't Work

### The Test

```javascript
// Create SVG with foreignObject containing HTML content
var svgData = '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">' +
    '<foreignObject width="100%" height="100%">' +
    '<div xmlns="http://www.w3.org/1999/xhtml">...</div>' +
    '</foreignObject></svg>';

// Render to canvas
var blob = new Blob([svgData], { type: 'image/svg+xml' });
var url = URL.createObjectURL(blob);
var img = new Image();
img.onload = () => {
    ctx.drawImage(img, 0, 0);
    canvas.toDataURL('image/png');  // ← FAILS!
};
img.src = url;
```

### Result

```
Failed to execute 'toDataURL' on 'HTMLCanvasElement': Tainted canvases may not be exported.
```

### Why

Browser security taints any canvas drawn from an SVG blob URL containing HTML content in `<foreignObject>`. This is a **fundamental browser security restriction** — no workaround exists:

| Approach | Works? | Reason |
|----------|--------|--------|
| SVG foreignObject (blob URL) | ❌ | Canvas tainted by foreignObject content |
| SVG foreignObject (base64 fonts) | ❌ | Still tainted — foreignObject itself is the issue |
| SVG foreignObject (same-origin) | ❌ | Blob URLs are always tainted for foreignObject |
| SVG foreignObject (data: URL) | ❌ | Same tainting rule applies |

**SVG foreignObject cannot be used to capture HTML content to canvas in any browser.**

---

## The Correct Approach: Same Technique as HTML Clips

HTML clips already work perfectly in export using this flow:

```
1. Create offscreen iframe with clip content
2. html2canvas(iframe.contentDocument.body) → canvas
3. ctx.drawImage(canvas) to export canvas
4. createImageBitmap → sendFrameToWorker → encode
```

**WAAPI clips should use the EXACT same technique**, with one addition:

```
1. Create offscreen iframe with clip content + WAAPI adapter
2. seekToFrame(frame, fps) → freeze CSS animations at correct frame
3. Wait for browser paint (requestAnimationFrame × 2)
4. html2canvas(iframe.contentDocument.body) → canvas
5. ctx.drawImage(canvas) to export canvas
6. createImageBitmap → sendFrameToWorker → encode
```

### Why This Works

- html2canvas reads computed styles directly from the DOM (no CORS issues)
- `seekToFrame()` with `document.getAnimations()` freezes CSS animations at any frame
- The canvas is NOT tainted (html2canvas renders DOM → Canvas 2D API, no SVG involved)
- Same speed as HTML clips: ~200-500ms per frame

### Current WAAPI Export Code Flow (BROKEN)

```
Line 6377: if (clip._isWaaapi && State.isExporting && typeof __waapiCaptureFrame === 'function')
    → Try SVG foreignObject capture → RETURNS NULL (tainted)
    
Line 6425: Draw cached canvas while SVG resolves
    → clip._htmlCanvas is null for WAAPI clips → nothing drawn
    
Line 6433: else if (!clip._isWaaapi && typeof html2canvas !== 'undefined')
    → html2canvas fallback → SKIPPED because we just added !clip._isWaaapi guard
```

Result: **WAAPI clips export as blank frames.**

### Planned Fix

```
Line 6377: if (clip._isWaaapi && State.isExporting)
    → Create offscreen iframe (reuse existing one)
    → Write clip content with WAAPI adapter
    → seekToFrame(currentTime - clip.start, 30)  ← FREEZE ANIMATION
    → Wait for paint (requestAnimationFrame × 2)
    → html2canvas(iframe.body) → canvas
    → ctx.drawImage(canvas) to export context
    
    NO SVG foreignObject. NO __waapiCaptureFrame. Just html2canvas + seekToFrame.
```

---

## Comparison: How Each Clip Type Exports

| Clip Type | Preview Technique | Export Technique | Animation |
|-----------|------------------|------------------|-----------|
| Text | ctx.fillText() | ctx.fillText() | Keyframe interpolation |
| Image | ctx.drawImage() | ctx.drawImage() | Keyframe interpolation |
| Shape | ctx.fillRect() | ctx.fillRect() | Keyframe interpolation |
| HTML | iframe overlay → html2canvas cache | html2canvas → drawImage | Static frames |
| **WAAPI** | **iframe overlay (live CSS)** | **seekToFrame + html2canvas** | **Seekable CSS animations** |

---

## Speed Comparison

| Method | Speed/frame | Notes |
|--------|------------|-------|
| SVG foreignObject | 5-15ms | ❌ Doesn't work (tainted) |
| html2canvas (no seek) | 200-500ms | Works but shows wrong frame |
| html2canvas + seekToFrame | 200-500ms | ✅ Correct frame + correct animation |
| Puppeteer CDP screenshot | 50-100ms | ✅ Perfect but requires headless Chrome |

For browser-based export: **html2canvas + seekToFrame is the only viable option**.
For automation export: **Puppeteer CDP screenshots are faster and more reliable**.
