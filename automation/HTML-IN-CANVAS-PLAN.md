# HTML-in-Canvas: Code to Video with SVG foreignObject

## The Problem

**html2canvas** (current WAAPI export) has known limitations:
- ❌ No flexbox/grid support
- ❌ Broken `backdrop-filter`, `filter`, `mix-blend-mode`
- ❌ External images fail (CORS)
- ❌ Google Fonts not loaded → wrong text
- ❌ 200-500ms per frame (slow)

## The Solution: SVG foreignObject

Render HTML/CSS/JS directly onto `<canvas>` using native browser APIs. Zero dependencies.

```
User writes HTML/CSS/JS code
  → Hidden <div> sandbox renders the DOM
  → onFrame(time) updates DOM for animation
  → XMLSerializer serializes DOM to SVG string
  → new Image() loads SVG as raster
  → ctx.drawImage() paints to canvas
  → canvas.toBlob() / canvas.captureStream() for export
```

### How It Works (from reference: `canvas_animator_studio.html`)

```javascript
// 1. Clone the sandbox DOM
const clone = sandbox.cloneNode(true);
clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');

// 2. Serialize to SVG with foreignObject
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <foreignObject width="100%" height="100%">
    <style xmlns="http://www.w3.org/1999/xhtml">${css}</style>
    <div xmlns="http://www.w3.org/1999/xhtml" 
         style="width:${w}px;height:${h}px;">
      ${domString}
    </div>
  </foreignObject>
</svg>`;

// 3. Draw to canvas via Image
const img = new Image();
img.onload = () => ctx.drawImage(img, 0, 0);
img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
```

### Why This Is Better Than html2canvas

| Feature | html2canvas | SVG foreignObject |
|---------|-------------|-------------------|
| Flexbox/Grid | ❌ Broken | ✅ Full CSS |
| backdrop-filter | ❌ No | ✅ Yes |
| External fonts | ❌ No | ✅ Preload as data URI |
| External images | ❌ CORS issues | ✅ Preload as data URI |
| SVG elements | ❌ No | ✅ Native |
| CSS animations | ❌ No | ✅ via `onFrame()` |
| Speed | 200-500ms/frame | 5-15ms/frame |
| Dependencies | npm package | Zero (native API) |

---

## Folder Structure

```
studio-pro-editor/
├── src/
│   └── html-in-canvas/                    # NEW: Core rendering engine
│       ├── renderer.js                     # SVG foreignObject → canvas engine
│       ├── preload.js                      # Font + image preloading
│       ├── adapters/
│       │   ├── waapi.js                    # CSS Animation → onFrame() adapter
│       │   ├── gsap.js                     # GSAP timeline adapter (future)
│       │   └── lottie.js                   # Lottie adapter (future)
│       └── presets/
│           ├── google-clean.js             # Animated Google Clean preset
│           ├── brutal.js                   # Neo-Brutalism animated
│           ├── gradient-hero.js            # Gradient mesh animated
│           └── data-chart.js               # Vox-style animated chart
│
├── automation/
│   ├── html-to-canvas/                     # NEW: Automation pipeline
│   │   ├── render.js                       # CDP-based renderer (like html-waapi)
│   │   ├── cdp-capture.js                  # Frame capture via Puppeteer
│   │   ├── examples/
│   │   │   ├── animated-pollution.js       # Test: animated pollution clip
│   │   │   └── bouncing-google.js          # Test: bouncing logo
│   │   └── output/                         # Exported videos
│   │
│   ├── html-waapi/                         # EXISTING: WAAPI pipeline
│   ├── md-render/                          # EXISTING: Markdown pipeline
│   └── code-to-video/                      # EXISTING: Legacy pipeline
│
├── index.html                              # MODIFIED: Add SVG foreignObject rendering
└── server/
    └── export-server.js                    # EXISTING: CDP WebSocket server
```

---

## Implementation Phases

### Phase 1: Core Renderer (`src/html-in-canvas/renderer.js`)

The SVG foreignObject engine that renders HTML/CSS/JS to canvas:

```javascript
class HTMLCanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.sandbox = document.createElement('div');
        this.sandbox.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:800px;height:600px;overflow:hidden;';
        document.body.appendChild(this.sandbox);
    }
    
    // Set HTML/CSS/JS for a clip
    async setClip(html, css, js, width, height) {
        await this.preloadFonts(html, css);
        await this.preloadImages(html);
        this.sandbox.innerHTML = html;
        this.css = css;
        this.width = width;
        this.height = height;
        // Compile JS into onFrame function
        if (js) {
            this.onFrame = new Function('time', js + '\nreturn typeof onFrame === "function" ? onFrame : null;')();
        }
    }
    
    // Render a single frame to canvas
    renderFrame(timeMs) {
        // 1. Update DOM via user's onFrame callback
        if (this.onFrame) this.onFrame(timeMs);
        
        // 2. Serialize DOM to SVG
        const clone = this.sandbox.cloneNode(true);
        clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
        const domString = new XMLSerializer().serializeToString(clone);
        
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}">
            <foreignObject width="100%" height="100%">
                <style xmlns="http://www.w3.org/1999/xhtml">${this.css}</style>
                <div xmlns="http://www.w3.org/1999/xhtml" style="width:${this.width}px;height:${this.height}px;overflow:hidden;">
                    ${domString}
                </div>
            </foreignObject>
        </svg>`;
        
        // 3. Draw to canvas
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                this.ctx.clearRect(0, 0, this.width, this.height);
                this.ctx.drawImage(img, 0, 0);
                resolve();
            };
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        });
    }
    
    // Determine animation duration from JS code
    getDuration() {
        // Parse JS for max time references, or default to 5s
        return 5000;
    }
}
```

### Phase 2: Font/Image Preloader (`src/html-in-canvas/preload.js`)

Preload Google Fonts as base64 data URIs so SVG foreignObject can render them:

```javascript
// Fetch Google Fonts CSS → find WOFF URLs → fetch → convert to data URI → inject
async function embedWebFonts(html, css) {
    // 1. Find all font URLs in HTML (<link>) and CSS (@import)
    // 2. Fetch the font CSS from Google Fonts
    // 3. Find all WOFF2/WOFF URLs in the CSS
    // 4. Fetch each font file → convert to base64 data URI
    // 5. Replace URLs in CSS with data URIs
    return { html, css };
}

// Convert external images to base64 data URIs
async function preloadImages(htmlString) {
    // Parse HTML → find <img src="http..."> → fetch → data URI
    return processedHTML;
}
```

### Phase 3: WAAPI Adapter (`src/html-in-canvas/adapters/waapi.js`)

Deterministic animation seeking — replace CSS animations with `onFrame(time)`:

```javascript
// Transform CSS @keyframes into onFrame(time) callback
function waapiAdapter(clip) {
    const { css, html, js, duration, fps } = clip;
    
    // Strategy: use document.getAnimations() to seek
    return `
        function onFrame(timeMs) {
            try {
                var animations = document.getAnimations({ subtree: true });
                animations.forEach(function(anim) {
                    anim.currentTime = timeMs;
                    anim.pause();
                });
            } catch(e) {}
            // Also update CSS custom properties
            document.documentElement.style.setProperty('--t', (timeMs/1000).toFixed(4));
            document.documentElement.style.setProperty('--frame', Math.floor(timeMs/1000 * ${fps}));
        }
    `;
}
```

### Phase 4: Timeline Integration (`index.html` modifications)

Replace html2canvas with SVG foreignObject for WAAPI clips:

```javascript
// In drawCanvas(), instead of html2canvas:
if (clip._isWaaapi || clip._useHtmlInCanvas) {
    // Use SVG foreignObject renderer
    if (!clip._htmlCanvasRenderer) {
        clip._htmlCanvasRenderer = new HTMLCanvasRenderer();
        await clip._htmlCanvasRenderer.setClip(clip.html, clip.css, clip.js, w, h);
    }
    const clipTime = (State.currentTime - clip.start) * 1000;
    await clip._htmlCanvasRenderer.renderFrame(clipTime);
    // Copy canvas to main canvas
    ctx.drawImage(clip._htmlCanvasRenderer.canvas, clip.x, clip.y, clip.w, clip.h);
} else {
    // Existing html2canvas path for static HTML clips
    // ...
}
```

### Phase 5: Export Integration

**GUI Export (MediaBunny):**
```javascript
// In the export loop:
for (let frame = startFrame; frame < endFrame; frame++) {
    const timeMs = (frame / fps) * 1000;
    
    // Draw all layers to main canvas
    drawCanvas(ctx, w, h, timeMs);
    
    // Capture bitmap (this is instant since it's already on canvas)
    const bitmap = await createImageBitmap(canvas);
    worker.postMessage({ type: 'frame', bitmap, frame });
}
```

**Automation Export (CDP):**
```javascript
// Same as current CDP pipeline but uses onFrame(time) for seeking
for (let frame = 0; frame < totalFrames; frame++) {
    await page.evaluate((f, fps) => {
        window.seekToFrame(f, fps);
    }, frame, fps);
    
    const screenshot = await page.screenshot({ type: 'jpeg', quality: 85 });
    frames.push(screenshot);
}
```

### Phase 6: Preset System

Port presets from `canvas_animator_studio.html`:

```javascript
const WAAPI_PRESETS = {
    'google-clean': {
        html: `<div class="wrap">...</div>`,
        css: `.wrap { ... }`,
        js: `function onFrame(time) { /* animate elements */ }`,
        duration: 5,
        fps: 30
    },
    'brutal': { ... },
    'gradient-hero': { ... },
    'data-chart': { ... },
    'ios-glass': { ... },
    'material-flow': { ... }
};
```

---

## What's Different From Current WAAPI Pipeline

| Aspect | Current (html2canvas) | New (SVG foreignObject) |
|--------|----------------------|------------------------|
| **Preview** | Live iframe overlay | Canvas-rendered (60fps) |
| **Export** | html2canvas → bitmap | SVG foreignObject → bitmap |
| **CSS support** | Partial | Full (browser-native) |
| **Animation** | CSS @keyframes (broken seek) | `onFrame(time)` (deterministic) |
| **Speed** | 200-500ms/frame | 5-15ms/frame |
| **Dependencies** | html2canvas npm | Zero |
| **Font handling** | Network-dependent | Preloaded as data URI |
| **Image handling** | CORS issues | Preloaded as data URI |

---

## Key Insight from Reference

The `canvas_animator_studio.html` demo proves that **SVG foreignObject can render complex CSS** including:
- ✅ `backdrop-filter: blur(40px)` (iOS glassmorphism)
- ✅ `mix-blend-mode: screen` (gradient meshes)
- ✅ `transform`, `opacity`, `filter`
- ✅ Google Fonts (after preloading)
- ✅ External images (after data URI conversion)
- ✅ Flexbox and Grid layouts
- ✅ CSS animations (via `onFrame()` seeking)

This is everything html2canvas fails at.

---

## Migration Path

1. **Phase 1-2**: Build renderer + preloader in `src/html-in-canvas/`
2. **Phase 3**: Add WAAPI adapter for CSS animation seeking
3. **Phase 4**: Integrate into `drawCanvas()` for WAAPI clips
4. **Phase 5**: Update export to use SVG foreignObject captures
5. **Phase 6**: Port presets from canvas_animator_studio reference
6. **Phase 7**: Remove html2canvas dependency entirely

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SVG foreignObject has size limits | Export at high res may fail | Split into tiles or use CDP for 4K+ |
| External resources blocked | Fonts/images don't load | Preload as data URIs (Phase 2) |
| `document.getAnimations()` timing | Seeking inaccurate | Use `onFrame(time)` pattern instead |
| Canvas tainting | `toBlob()` fails | Keep sandbox in same origin |

---

## Testing Plan

1. **Unit test**: Render each preset to canvas, verify pixel colors
2. **Integration test**: Load preset → seek to frame → export single frame → compare
3. **Export test**: Full 5-second video export via MediaBunny → verify frames
4. **CDP test**: Automation export → verify animation progression
5. **Regression test**: Existing html clips still work via html2canvas fallback

---

## Estimated Timeline

| Phase | Scope | Effort |
|-------|-------|--------|
| Phase 1 | Core renderer | 2-3 hours |
| Phase 2 | Font/image preload | 1-2 hours |
| Phase 3 | WAAPI adapter | 1 hour |
| Phase 4 | Timeline integration | 2-3 hours |
| Phase 5 | Export integration | 1-2 hours |
| Phase 6 | Preset system | 1-2 hours |
| **Total** | | **8-13 hours** |
