# Three-Layer Plan — Feasibility Analysis

## How StudioPro Works Today (Simple Terms)

Think of StudioPro like a **video editor** (like Premiere Pro or DaVinci Resolve). Here's how it works:

### The Canvas (The Screen)
```
┌─────────────────────────────────┐
│         renderCanvas             │  ← This is a <canvas> element
│    (what you see in the editor)  │
│                                  │
│  ┌───────────────────────────┐  │
│  │   HTML Clip (iframe)      │  │  ← HTML clips live in hidden iframes
│  │   rendered via html2canvas │  │
│  └───────────────────────────┘  │
│                                  │
│  ┌───────────────────────────┐  │
│  │   Text Clip (canvas API)  │  │  ← Text clips draw directly to canvas
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

### The Timeline (The Film Strip)
```
Track 1:  [====HTML Clip 1====][====HTML Clip 2====][====HTML Clip 3====]
Track 2:  [====Text Clip 1====]              [====Text Clip 2====]
                    ▲
                    │
              currentTime (playhead)
```

### How Seeking Works (Moving the Playhead)
When you press `,` or `.` to seek:
1. `State.currentTime` updates to the new time
2. `drawCanvas()` is called
3. For each clip visible at that time:
   - **Text/Image/Video clips**: Draw directly to canvas (fast, instant)
   - **HTML clips**: Write HTML to iframe → wait → html2canvas captures → draw to canvas (SLOW, ~500ms)

### How Export Works (Making the MP4)
```
For each frame (30 per second):
  1. Set State.currentTime = frame time
  2. Call drawCanvas() — renders everything to an offscreen canvas
  3. Wait for html2canvas to finish (if HTML clips are active)
  4. Create ImageBitmap from canvas
  5. Send bitmap to WebWorker → WebCodecs → MP4 file
```

---

## The Three-Layer Plan — Will It Work?

### Layer 1: WAAPI Time Control

**What we want:** Instead of writing custom `animate(t)` functions, agents write CSS `@keyframes` and the editor seeks them natively using the Web Animations API.

**How it would work in the current code:**

```javascript
// CURRENT (in drawCanvas, line 6362):
// Agent writes a custom animate(t) function
const clipTime = State.currentTime - clip.start;
clip._htmlIframe.contentWindow.setClipTime(clipTime);
// setClipTime calls animate(t) inside the iframe

// NEW (with WAAPI):
// Agent writes standard CSS keyframes
const animations = clip._htmlIframe.contentDocument.getAnimations({ subtree: true });
animations.forEach(anim => {
    anim.pause();
    anim.currentTime = (State.currentTime - clip.start) * 1000; // ms
});
```

**Will it work?** ✅ **YES — with one caveat**

The iframe already loads HTML with CSS. If the agent writes:
```html
<style>
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.title { animation: fadeIn 0.5s ease forwards; }
</style>
<h1 class="title">Hello</h1>
```

Then `getAnimations({ subtree: true })` will find the WAAPI animation and we can seek it.

**The caveat:** The iframe must be **already rendered** (layout complete) before `getAnimations()` works. Currently the iframe is written in drawCanvas with a 5-50ms delay. We need to ensure the iframe is ready before seeking.

**Integration difficulty:** ⭐ Easy — just add 5 lines to the existing `setClipTime` bridge:
```javascript
// In the bridge script injected into iframes:
window.seekToFrame = function(frame, fps) {
    const ms = (frame / fps) * 1000;
    // WAAPI: seek all CSS animations
    document.getAnimations({ subtree: true }).forEach(anim => {
        anim.pause();
        anim.currentTime = ms;
    });
    // CSS variables for custom rules
    document.documentElement.style.setProperty('--frame', frame);
    document.documentElement.style.setProperty('--progress', (ms / 1000).toFixed(4));
    // Backward compat
    if (typeof window.animate === 'function') window.animate(ms / 1000);
};
```

---

### Layer 2: Declarative Markup (data-* attributes)

**What we want:** Instead of agents writing `function animate(t) { ... }` with hundreds of lines of JavaScript, they write simple HTML attributes:

```html
<div class="slide" data-duration="5s">
  <h1 data-animate="fade-in" data-delay="0.2s">Title</h1>
  <div class="chart" data-animate="grow" data-delay="0.5s">...</div>
</div>
```

**How it would work:** A small adapter script (pasted into the iframe) reads `data-animate` attributes and generates CSS keyframes automatically:

```javascript
// Adapter script injected into iframe
document.querySelectorAll('[data-animate]').forEach(el => {
    const type = el.dataset.animate;
    const delay = parseFloat(el.dataset.delay || 0);
    const duration = parseFloat(el.dataset.duration || 0.5);
    
    // Generate CSS keyframes from data attributes
    const anim = el.animate([
        { opacity: 0, transform: 'translateY(20px)' },  // start
        { opacity: 1, transform: 'translateY(0)' }       // end
    ], { duration: duration * 1000, delay: delay * 1000, fill: 'forwards' });
});
```

**Will it work?** ✅ **YES — this is just a convenience layer**

The adapter converts `data-animate` → WAAPI animations → Layer 1's `seekToFrame()` seeks them. It's purely an AI ergonomics improvement.

**Integration difficulty:** ⭐ Easy — add the adapter script to the iframe's `<head>` alongside the bridge script.

---

### Layer 3: SVG foreignObject Frame Capture

**What we want:** Replace html2canvas (~500ms async) with SVG foreignObject (~5-15ms async) for export.

**Current flow (line 6379):**
```javascript
html2canvas(clip._htmlIframe.contentDocument.body, {
    width: w, height: h, backgroundColor: null, scale: 1
}).then(canvas => {
    clip._htmlCanvas = canvas;
    // ... redraw
});
```

**New flow:**
```javascript
async function captureHtmlToCanvas(clip, w, h) {
    const iframe = clip._htmlIframe;
    const doc = iframe.contentDocument;
    
    // Get the HTML content
    const html = doc.body.innerHTML;
    const styles = Array.from(doc.querySelectorAll('style'))
        .map(s => s.textContent).join('\n');
    
    // Wrap in SVG foreignObject
    const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml">
                <style>${styles}</style>
                ${html}
            </div>
        </foreignObject>
    </svg>`;
    
    const img = new Image();
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    return new Promise(resolve => {
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            resolve(canvas);
        };
        img.src = url;
    });
}
```

**Will it work?** ⚠️ **PARTIALLY — with limitations**

**What works:**
- Simple HTML/CSS layouts (flexbox, grid, text, colors, gradients)
- CSS animations (seeked via WAAPI before capture)
- Google Fonts (already loaded via `<link>` tags in the iframe)

**What might NOT work:**
- **Cross-origin images** — SVG foreignObject can't load images from other domains (CORS). Our iframes already have this issue with html2canvas.
- **Complex CSS** — Some CSS features like `backdrop-filter`, `clip-path`, `mix-blend-mode` may not render correctly in SVG.
- **Canvas elements inside the HTML** — If the HTML clip contains a `<canvas>` element, it won't serialize.
- **JavaScript-generated content** — If the HTML relies on JS to populate content, we need to capture AFTER the JS runs.

**Integration difficulty:** ⭐⭐ Medium — replace the `html2canvas()` call with the SVG approach. Keep html2canvas as fallback.

---

## The Big Question: Will the Export Loop Work?

**Current export loop (MediaBunny, line 33856):**
```javascript
const realtimeExportLoop = async () => {
    // 1. Set time
    State.currentTime = startTime + frameElapsed;
    
    // 2. Draw everything
    drawCanvas(exportCtx, exportW, exportH);
    
    // 3. Wait for html2canvas to finish
    if (window._pendingHtmlCaptures.length > 0) {
        await Promise.all(window._pendingHtmlCaptures);
        window._pendingHtmlCaptures = [];
        drawCanvas(exportCtx, exportW, exportH); // Redraw with captured content
    }
    
    // 4. Create bitmap and send to worker
    const bitmap = await createImageBitmap(exportCanvas);
    sendFrameToWorker(bitmap, targetFrame);
};
```

**With the three-layer plan:**

```javascript
const realtimeExportLoop = async () => {
    // 1. Set time
    State.currentTime = startTime + frameElapsed;
    
    // 2. Draw everything (html2canvas replaced with SVG foreignObject)
    drawCanvas(exportCtx, exportW, exportH);
    
    // 3. Wait for SVG capture to finish (MUCH faster: ~5-15ms vs ~500ms)
    if (window._pendingHtmlCaptures.length > 0) {
        await Promise.all(window._pendingHtmlCaptures);
        window._pendingHtmlCaptures = [];
        drawCanvas(exportCtx, exportW, exportH);
    }
    
    // 4. Create bitmap and send to worker
    const bitmap = await createImageBitmap(exportCanvas);
    sendFrameToWorker(bitmap, targetFrame);
};
```

**Will it work?** ✅ **YES — the export loop structure doesn't change**

The only change is that `_pendingHtmlCaptures` resolves in ~5-15ms instead of ~500ms. The export loop is already designed to wait for pending captures. This is a drop-in replacement.

---

## What Needs to Change (Summary)

### Changes to `index.html` (the editor):

| What | Where | Change | Difficulty |
|---|---|---|---|
| **Bridge script** | Line 6355 | Add `seekToFrame()` function to iframe bridge | ⭐ Easy |
| **Adapter script** | Line 6355 | Add data-animate → WAAPI adapter to iframe | ⭐ Easy |
| **html2canvas replacement** | Line 6379 | Replace `html2canvas()` with SVG foreignObject | ⭐⭐ Medium |
| **Preload on project load** | Line ~6200 | Call `seekToFrame(0)` after iframe write | ⭐ Easy |
| **Export loop** | Line 33856 | No change needed — already waits for captures | ✅ None |

### Changes to `automation/code-to-video/api.js`:

| What | Change | Difficulty |
|---|---|---|
| **Composition loading** | No change — already works via `StudioPro.createComposition()` | ✅ None |
| **Export triggering** | No change — already calls `submitExport()` | ✅ None |
| **Frame capture** | Benefits automatically from faster SVG capture | ✅ None |

### New files to create:

| What | Purpose |
|---|---|
| `lib/svg-renderer.js` | SVG foreignObject capture engine |
| `lib/hyper-adapter.js` | WAAPI seekToFrame + data-animate adapter |
| `docs/skills/HTML-CLIP-GUIDE.md` | Guide for AI agents on writing HTML clips |

---

## Risk Assessment

### What Could Go Wrong

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SVG foreignObject doesn't render some CSS | Medium | Medium | Keep html2canvas as fallback |
| WAAPI `getAnimations()` returns empty in iframe | Low | High | Test with actual CSS keyframes in iframe |
| Cross-origin images fail in SVG | High | Low | Already fails with html2canvas — no regression |
| iframe layout not ready when seekToFrame called | Medium | Medium | Add `requestAnimationFrame` wait before seeking |
| Agent writes CSS that svg-renderer can't handle | Medium | Low | Document limitations in agent guide |

### What's Definitely Safe

| Feature | Why Safe |
|---|---|
| WAAPI seeking | Browser native API, well-supported, works in iframes |
| data-animate adapter | Purely additive — doesn't change existing flow |
| Export loop structure | Already designed to wait for async captures |
| Backward compatibility | Old `animate(t)` clips still work alongside new WAAPI clips |

---

## Simple Summary

**Think of it like this:**

Today, when you move the playhead to an HTML clip:
1. The editor writes HTML into a hidden iframe
2. Waits 500ms for html2canvas to "screenshot" the iframe
3. Draws that screenshot onto the canvas
4. You finally see the content (with a white flash)

**With the three-layer plan:**

**Layer 1 (WAAPI):** When you move the playhead, the editor tells the iframe "show me frame 47" and the browser instantly updates the CSS animations to that exact frame. No screenshot needed for preview — the iframe IS the preview.

**Layer 2 (Declarative):** Instead of writing 100 lines of `animate(t)` JavaScript, the agent writes `<h1 data-animate="fade-in">`. A tiny adapter converts this to CSS keyframes. The agent's job gets 10x simpler.

**Layer 3 (SVG Capture):** When exporting to MP4, instead of html2canvas (500ms per frame), the editor wraps the iframe content in an SVG foreignObject (5-15ms per frame). The export runs 30-100x faster for HTML clips.

**The bottom line:** All three layers fit into the existing architecture with minimal changes. The export loop already handles async captures — we just make the captures faster. The iframe already loads HTML/CSS — we just add WAAPI seeking. The agent already writes HTML — we just add data-* attributes.

**Estimated total effort: 5-8 days of focused work.**
