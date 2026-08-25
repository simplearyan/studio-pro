# HTML Clip Rendering — Architecture Plan

## The Problem

StudioPro uses **html2canvas** to render HTML clips to the export canvas. This causes:

1. **Async capture** (~0.5-1s per frame) — canvas shows white during capture
2. **Inaccurate CSS** — html2canvas re-implements CSS in JS (no real browser rendering)
3. **Font issues** — ligatures, subpixel antialiasing differ from actual browser
4. **Blank frames in export** — html2canvas starts async but export captures canvas immediately
5. **Slow animation** — can't re-render at 30fps for animated clips

## Research: 5 Approaches

### Option A: `drawElementImage()` — Native Chrome API ⭐ BEST

| Aspect | Details |
|---|---|
| **What** | New W3C spec: browser paints real DOM elements directly into canvas |
| **How** | `<canvas layoutsubtree><div id="content">...</div></canvas>` → `ctx.drawElementImage(el, 0, 0)` |
| **Speed** | Synchronous, uses browser's paint pipeline — fast enough for 30fps animation |
| **Fidelity** | Perfect — browser's own renderer, not a JS re-implementation |
| **Support** | Chrome 148-150 origin trial, behind `chrome://flags/#canvas-draw-element` |
| **Bundle** | 0 KB — built into browser |
| **Fallback** | html2canvas for non-Chrome browsers |

```javascript
// Minimal example
<canvas id="c" layoutsubtree style="width:1920px;height:1080px">
  <div id="content">
    <h1 style="font-family:Google Sans">Hello World</h1>
  </div>
</canvas>
<script>
const ctx = c.getContext('2d');
c.onpaint = () => {
    ctx.reset();
    ctx.drawElementImage(content, 0, 0);
    content.style.transform = ctx.drawElementImage(content, 0, 0).toString();
};
</script>
```

**Verdict: This is the future. Fast, accurate, synchronous. But requires Chrome flag.**

---

### Option B: `html-to-image` / `dom-to-image-more` — SVG-based ⭐ GOOD NOW

| Aspect | Details |
|---|---|
| **What** | Library that serializes DOM to SVG, then renders SVG to canvas |
| **How** | `import { toPng } from 'html-to-image'` → `const dataUrl = await toPng(element)` |
| **Speed** | **71x faster** than html2canvas (per benchmarks) |
| **Fidelity** | Good — SVG preserves layout, fonts, CSS |
| **Support** | All modern browsers |
| **Bundle** | ~12 KB min+gzip |
| **Limitation** | Still async (but much faster), can't handle some CSS features |

```javascript
import { toCanvas } from 'html-to-image';

// Render iframe body to canvas
const canvas = await toCanvas(iframe.contentDocument.body, {
    width: 1920,
    height: 1080,
    backgroundColor: null,
});
ctx.drawImage(canvas, x, y, w, h);
```

**Verdict: Best production-ready option now. Much faster than html2canvas.**

---

### Option C: SnapDOM — Newest library

| Aspect | Details |
|---|---|
| **What** | Open-source DOM-to-image tool, faster than html2canvas |
| **Speed** | Faster than html2canvas, better accuracy |
| **Support** | Modern browsers |
| **Status** | New (2025), less mature |

**Verdict: Worth evaluating but html-to-image is more proven.**

---

### Option D: Remotion Architecture — No screenshot library

| Aspect | Details |
|---|---|
| **What** | Each frame is a React component rendered by the real browser engine |
| **How** | `<OffscreenCanvas>` + React render → `canvas.toBlob()` for each frame |
| **Speed** | Real-time — browser renders natively |
| **Fidelity** | Perfect — it IS the browser |
| **Limitation** | Requires React build step, can't use raw HTML/CSS/JS |

**Verdict: Best quality but requires rewriting StudioPro's clip system as React components.**

---

### Option E: Puppeteer Screenshot per frame

| Aspect | Details |
|---|---|
| **What** | Use Puppeteer's `page.screenshot()` to capture the actual rendered page |
| **How** | Seek to each frame → `page.screenshot({ clip: { x, y, w, h } })` → canvas |
| **Speed** | ~50-100ms per frame (Chrome's built-in screenshot) |
| **Fidelity** | Perfect — it's a real browser screenshot |
| **Limitation** | Requires headless Chrome, can't work in preview mode |

**Verdict: Best for export, can't work for live preview.**

---

## Recommended Architecture: Hybrid Approach

Use **Option A** (drawElementImage) when available, **Option B** (html-to-image) as fallback, **Option E** (Puppeteer screenshot) for export.

```
┌─────────────────────────────────────────────────────┐
│                    StudioPro                         │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  Live Preview │  │  Export Flow  │  │  CLI/Auto │  │
│  │  (Editor GUI) │  │  (MediaBunny) │  │  (render) │  │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘  │
│         │                 │                 │         │
│         ▼                 ▼                 ▼         │
│  ┌─────────────────────────────────────────────┐     │
│  │           HTML Render Engine                 │     │
│  │                                              │     │
│  │  1. drawElementImage (Chrome flag)  ← FAST   │     │
│  │  2. html-to-image (fallback)       ← RELIABLE│    │
│  │  3. Puppeteer screenshot (export)  ← PERFECT │     │
│  │                                              │     │
│  └─────────────────────────────────────────────┘     │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## Folder Structure

```
studio-pro-editor/
├── index.html                          # Main editor (existing)
├── automation/
│   ├── render.js                       # MD-to-video renderer (existing)
│   ├── config.json                     # Chrome path, ports (existing)
│   ├── output/                         # MD-to-video exports (existing)
│   ├── code-to-video/                  # Code-to-video (existing)
│   │   ├── api.js                      # Node.js API wrapper
│   │   ├── render.js                   # CLI entry point
│   │   ├── examples/                   # Composition scripts
│   │   ├── skills/                     # Agent documentation
│   │   ├── templates/                  # Design tokens
│   │   ├── output/                     # Code-to-video exports
│   │   └── ISSUES-AND-TODOS.md         # Issue tracker
│   └── html-render/                    # ⭐ NEW: HTML rendering engine
│       ├── engine.js                   # Core render engine (browser-side)
│       ├── strategies/
│       │   ├── draw-element.js         # Strategy: drawElementImage (Chrome flag)
│       │   ├── html-to-image.js        # Strategy: html-to-image library
│       │   ├── puppeteer-screenshot.js # Strategy: Puppeteer screenshot
│       │   └── html2canvas-fallback.js # Strategy: html2canvas (legacy fallback)
│       ├── cache.js                    # Frame cache management
│       ├── preload.js                  # Pre-render all clips before export
│       └── README.md                   # Documentation
├── lib/
│   ├── html-render/                    # ⭐ NEW: Browser-side render library
│   │   ├── render-engine.js            # Main engine class
│   │   ├── strategies/                 # Render strategies
│   │   ├── cache/                      # Frame caching
│   │   └── index.js                    # Entry point
│   ├── html2canvas.min.js              # Current (to be replaced)
│   └── ... (other libs)
├── docs/
│   ├── automation/
│   │   ├── HTML-Render-Architecture-Plan.md  # This file
│   │   └── ...
│   └── ...
└── ...
```

## Implementation Plan

### Phase 1: Abstract the Render Engine (2-3 days)

**Goal:** Create a render engine that can swap strategies without changing the rest of the codebase.

**Files to create:**
- `lib/html-render/render-engine.js` — Main class with strategy pattern
- `lib/html-render/strategies/html2canvas-fallback.js` — Current behavior
- `lib/html-render/cache.js` — Frame cache

**Changes to index.html:**
- Replace all `html2canvas(...)` calls with `renderEngine.capture(clip, clipTime)`
- Render engine auto-detects best strategy

```javascript
// lib/html-render/render-engine.js
class HTMLRenderEngine {
    constructor() {
        this.strategies = [];
        this.cache = new Map(); // clipId → Map<clipTime, canvas>
    }
    
    async capture(clip, clipTime, width, height) {
        // Check cache first
        const cacheKey = `${clip.id}_${clipTime}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        
        // Try each strategy
        for (const strategy of this.strategies) {
            if (strategy.supports(clip)) {
                const canvas = await strategy.capture(clip, clipTime, width, height);
                this.cache.set(cacheKey, canvas);
                return canvas;
            }
        }
        throw new Error('No render strategy available');
    }
    
    invalidateCache(clipId) {
        for (const [key] of this.cache) {
            if (key.startsWith(clipId)) this.cache.delete(key);
        }
    }
}
```

### Phase 2: html-to-image Strategy (2-3 days)

**Goal:** Replace html2canvas with html-to-image for 71x speed improvement.

**Files to create:**
- `lib/html-render/strategies/html-to-image.js`

```javascript
// lib/html-render/strategies/html-to-image.js
import { toCanvas } from 'html-to-image';

class HTMLToImageStrategy {
    supports(clip) { return true; }
    
    async capture(clip, clipTime, width, height) {
        const iframe = clip._htmlIframe;
        if (!iframe?.contentDocument?.body) return null;
        
        // Set clipTime
        if (iframe.contentWindow?.setClipTime) {
            iframe.contentWindow.setClipTime(clipTime);
        }
        
        // Wait for DOM update
        await new Promise(r => setTimeout(r, 16));
        
        // Capture using html-to-image (SVG-based, much faster)
        const canvas = await toCanvas(iframe.contentDocument.body, {
            width, height,
            backgroundColor: null,
            pixelRatio: 1,
        });
        
        return canvas;
    }
}
```

### Phase 3: drawElementImage Strategy (3-5 days)

**Goal:** Use Chrome's native API when available for synchronous, perfect-fidelity rendering.

**Files to create:**
- `lib/html-render/strategies/draw-element.js`

```javascript
// lib/html-render/strategies/draw-element.js
class DrawElementStrategy {
    supports(clip) {
        return typeof CanvasRenderingContext2D !== 'undefined' &&
               'drawElementImage' in CanvasRenderingContext2D.prototype;
    }
    
    // This is SYNCHRONOUS — no async needed!
    capture(clip, clipTime, width, height) {
        const iframe = clip._htmlIframe;
        if (!iframe?.contentDocument?.body) return null;
        
        // Set clipTime
        if (iframe.contentWindow?.setClipTime) {
            iframe.contentWindow.setClipTime(clipTime);
        }
        
        // Draw directly — browser renders in real-time
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.reset();
        ctx.drawElementImage(iframe.contentDocument.body, 0, 0);
        
        return canvas; // SYNCHRONOUS — no promise needed!
    }
}
```

### Phase 4: Puppeteer Screenshot for Export (2-3 days)

**Goal:** Use Puppeteer's built-in screenshot for export (fastest, most accurate).

**Changes to `automation/code-to-video/api.js`:**
```javascript
async captureFrame(page, clip, clipTime, width, height) {
    // Use Puppeteer's native screenshot instead of html2canvas
    const clipSelector = `#${clip.id}`;
    
    // Take screenshot of just the clip's iframe
    const screenshot = await page.screenshot({
        clip: {
            x: clip.x, y: clip.y,
            width: clip.width, height: clip.height
        }
    });
    
    return screenshot; // PNG buffer
}
```

### Phase 5: Integration & Testing (2-3 days)

**Goal:** Wire everything together, test all scenarios.

**Test matrix:**
| Scenario | Strategy | Expected |
|---|---|---|
| Live preview (Chrome flag) | drawElementImage | Synchronous, perfect |
| Live preview (no flag) | html-to-image | ~5ms per frame |
| Export (MediaBunny) | Puppeteer screenshot | ~50ms per frame |
| Export (FTRT) | html-to-image | ~5ms per frame |
| Fallback | html2canvas | ~500ms per frame |

## Timeline

| Phase | What | Days | Priority |
|---|---|---|---|
| 1 | Abstract render engine | 2-3 | 🔴 Must |
| 2 | html-to-image strategy | 2-3 | 🔴 Must |
| 3 | drawElementImage strategy | 3-5 | 🟡 High |
| 4 | Puppeteer screenshot export | 2-3 | 🟡 High |
| 5 | Integration & testing | 2-3 | 🔴 Must |
| **Total** | | **11-17 days** | |

## Key Decisions Needed

1. **Chrome flag requirement:** drawElementImage needs `chrome://flags/#canvas-draw-element`. Do we require users to enable it, or auto-detect?

2. **Library choice:** html-to-image vs dom-to-image-more vs SnapDOM? html-to-image is most proven.

3. **Export strategy:** Puppeteer screenshot (fastest) or html-to-image (works in browser too)?

4. **Cache invalidation:** How often to clear the frame cache? Per-seek? Per-edit?

## Expected Outcomes

| Metric | Current (html2canvas) | New (html-to-image) | New (drawElementImage) |
|---|---|---|---|
| Capture time | ~500-1000ms | ~5-15ms | ~1ms (sync) |
| CSS fidelity | 70% | 95% | 100% |
| Font accuracy | Low | High | Perfect |
| Animation support | No (async) | Yes (fast async) | Yes (sync) |
| Bundle size | 45 KB | 12 KB | 0 KB |
| Browser support | All | All | Chrome only |
