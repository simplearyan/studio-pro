# WAAPI Export: Can We Do It Without html2canvas?

## TL;DR Answer

| Context | Without html2canvas? | How |
|---------|---------------------|-----|
| Browser GUI export | **Not yet** — html2canvas is the only practical option today | Use html2canvas + seekToFrame (fix animation) |
| Automation export | **Yes** — Puppeteer CDP screenshots | Headless Chrome `Page.captureScreenshot` |
| Future (2026+) | **Yes** — Chrome HTML-in-canvas API | `canvas.drawElementImage()` (experimental) |

---

## How Remotion Does It

Remotion does **NOT** use html2canvas. They built a custom **DOM Composer**:

```
For each frame:
  1. Walk the DOM tree with createTreeWalker()
  2. For each element:
     a. Get bounding box via getBoundingClientRect()
     b. Resolve parent transforms to calculate absolute position
     c. For <svg>, <canvas>, <img>: capture pixels natively
     d. For text nodes: split with Intl.Segmenter, render each token
     e. For other elements: draw background, border, etc. with Canvas 2D API
  3. Draw everything to canvas in calculated positions
```

**Key insight:** Remotion's DOM Composer only supports a **subset** of CSS (background, border, border-radius). It doesn't support flex, grid, or complex layouts. They compensate by requiring React components — the framework controls what's rendered.

**Why this works for Remotion:** Everything is a React component. The framework knows exactly what each element is and how it should render. It doesn't need to support all CSS — just the subset their components use.

**Why this won't work for Studio Pro:** WAAPI clips use arbitrary HTML/CSS/JS. We can't restrict what CSS features users employ. Flex, grid, transforms, animations — everything needs to work.

---

## How HyperFrames Does It

HyperFrames uses **Headless Chrome CDP screenshots**:

```javascript
// The entire capture loop:
for (let i = 0; i < totalFrames; i++) {
    const time = quantizeTimeToFrame(i / fps, fps);
    await page.evaluate(t => window.__hf.seek(t), time);
    const { buffer } = await beginFrameCapture(page, options, frameTicks, interval);
    writeFileSync(`frame_${i}.jpg`, buffer);
}
```

**Key technique: "Seek, Don't Play"**
- The composition exposes `window.__hf.seek(time)` — a deterministic seek function
- The renderer NEVER calls `play()`. It calls `seek(0)`, screenshot, `seek(1/30)`, screenshot...
- Time doesn't advance on its own. Nothing is driven by `requestAnimationFrame`
- The browser holds a fixed frame until the next one is requested

**For deterministic capture (Linux production):**
```
chrome-headless-shell --deterministic-mode --enable-begin-frame-control \
    --run-all-compositor-stages-before-draw \
    --disable-threaded-animation --disable-threaded-scrolling
```
- `HeadlessExperimental.beginFrame` runs one layout→paint→composite→screenshot cycle atomically
- One call, one frame. No race conditions.

**For non-deterministic capture (macOS/Windows dev):**
- `page.screenshot()` with "did the frame land" heuristics
- Poll `fonts.ready`, wait for computed styles, compare pixel hashes

**Key insight:** HyperFrames captures the ENTIRE browser viewport — every pixel, every CSS property, every animation. No DOM-to-canvas conversion needed. Chrome IS the renderer.

---

## How Replit Does It

Replit built a custom **Virtual Clock** renderer:

```
1. Monkey-patch setTimeout, setInterval, requestAnimationFrame, Date, performance.now()
2. Replace with a fake clock that advances only when told
3. For each frame:
   a. seekCSSAnimations(currentTime)  ← sync CSS animations
   b. seekMedias()                     ← sync video elements
   c. currentTime += frameInterval     ← tick the clock
   d. Fire all callbacks (setTimeout, setInterval, rAF)
   e. captureFrame()                   ← CDP screenshot
```

**Key insight:** They make the browser believe time moves only when they say it does. This gives frame-perfect determinism for arbitrary web content.

---

## Chrome HTML-in-Canvas API (The Future)

Chrome 148-150 has an experimental API that draws DOM elements directly into canvas:

```html
<canvas layoutsubtree>
  <div id="form_element">
    <label>Name:</label> <input type="text">
  </div>
</canvas>
```

```javascript
const ctx = canvas.getContext('2d');
canvas.onpaint = () => {
    ctx.reset();
    let transform = ctx.drawElementImage(form_element, 0, 0);
    form_element.style.transform = transform.toString();
};
```

**Pros:** Native browser API, perfect rendering, supports ALL CSS, no html2canvas
**Cons:** Experimental, requires `chrome://flags/#canvas-draw-element`, Chrome 148-150 only

**Remotion already supports this** via `@remotion/web-renderer` with `allowHtmlInCanvas: true`.

---

## Analysis: Studio Pro's Options

### Option A: html2canvas + seekToFrame (Current, Browser Export)

```
For each frame:
  1. seekToFrame(frame, fps)           ← freeze CSS animations
  2. html2canvas(iframe.body)          ← capture DOM to canvas (~200-500ms)
  3. ctx.drawImage(canvas)             ← draw to export canvas
```

| Pros | Cons |
|------|------|
| Works in all browsers | Slow (200-500ms/frame) |
| Already integrated | Doesn't support flex/grid well |
| Supports most CSS | Can't capture live animations |
| No server needed | Limited CSS support |

**Verdict:** The only practical option for browser GUI export today. Fix the animation seeking and it works.

### Option B: Puppeteer CDP Screenshots (Automation Export)

```
For each frame:
  1. page.evaluate(seekToFrame, frame, fps)   ← freeze CSS animations
  2. page.screenshot() or beginFrameCapture()  ← full viewport screenshot
```

| Pros | Cons |
|------|------|
| Perfect rendering (full browser) | Requires headless Chrome |
| Supports ALL CSS | Can't run in browser GUI |
| Fast (50-100ms/frame) | Needs Puppeteer/CDP |
| Deterministic with right flags | Linux-only for full determinism |

**Verdict:** The industry standard for production video rendering. Use for automation.

### Option C: Chrome HTML-in-canvas API (Future)

```
For each frame:
  1. seekToFrame(frame, fps)
  2. ctx.drawElementImage(iframeElement, 0, 0)  ← native DOM→canvas
```

| Pros | Cons |
|------|------|
| Native browser API | Experimental (Chrome 148-150) |
| Perfect rendering | Requires chrome flag |
| Supports ALL CSS | Not stable yet |
| Fast (native speed) | Chrome-only |

**Verdict:** When this stabilizes, it replaces html2canvas entirely.

---

## Recommended Plan

### Phase 1: Fix Browser Export (Now)
- Use html2canvas + seekToFrame for WAAPI clips
- Cache html2canvas results to avoid re-capturing static frames
- Only re-capture when the animation frame changes
- **This fixes the immediate problem**

### Phase 2: Optimize Automation Export (Next)
- Use Puppeteer CDP screenshots for WAAPI clips in automation
- Implement HyperFrames-style "seek, don't play" pattern
- Use `HeadlessExperimental.beginFrame` for deterministic capture
- **This gives production-quality rendering**

### Phase 3: Chrome HTML-in-canvas (Future)
- When Chrome stabilizes `drawElementImage()`, replace html2canvas
- Feature-detect at runtime: `if (ctx.drawElementImage) { ... } else { html2canvas }`
- **This is the end goal**

---

## Key Takeaway

**html2canvas is not the enemy — it's the fallback.** The real rendering engine is the browser itself. For automation, we capture the browser's output directly (CDP screenshots). For the GUI, html2canvas is the bridge until Chrome's HTML-in-canvas API stabilizes.

The animation problem (WAAPI clips showing static frames) is solved by `seekToFrame()` + html2canvas. The rendering quality problem (flex/grid not supported) is solved by using CDP screenshots in automation. Both problems have clear solutions.
