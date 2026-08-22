# HTML/CSS/JS Animation Hybrid — Experimental Feature Plan

> **Date:** August 2026
> **Trigger:** "Claude Code can now make videos" — Remotion's HTML/CSS/JS approach
> **Question:** Can Studio Pro add HTML/CSS/JS animation alongside Canvas GUI elements?

---

## 1. The Remotion Approach — Why It Works for AI Agents

### What Remotion Does

```jsx
// Remotion: React component = video frame
const MyVideo = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1]);
  
  return (
    <div style={{ opacity, background: 'linear-gradient(135deg, #667eea, #764ba2)' }}>
      <h1>Hello World</h1>
    </div>
  );
};
```

**Why AI agents love it:**
- **HTML/CSS/JS** — Agents already know this
- **Declarative** — Describe WHAT, not HOW
- **React components** — Modular, composable
- **Tailwind CSS** — Utility classes for rapid styling
- **No Canvas API** — Just DOM elements

### What Remotion Can Do (That Canvas Can't Easily)

| Feature | How Remotion Does It | Why It's Hard in Canvas |
|---|---|---|
| **Gradient cards** | CSS `linear-gradient`, `box-shadow` | Must manually draw gradients |
| **Glassmorphism** | `backdrop-filter: blur()` | No native support |
| **Complex layouts** | Flexbox, Grid | Manual positioning |
| **Text wrapping** | CSS `word-wrap`, `line-height` | Canvas `fillText` has no wrap |
| **Hover effects** | CSS `:hover` | No interaction in export |
| **3D transforms** | CSS `transform: perspective()` | Canvas 2D has no 3D |
| **Blur/filters** | CSS `filter: blur(5px)` | Must implement manually |

---

## 2. Studio Pro's Canvas Approach — Strengths

| Feature | How Studio Pro Does It | Why It's Better |
|---|---|---|
| **Pixel-perfect control** | `drawCanvas()` owns every pixel | No browser quirks |
| **Deterministic** | Same input → same output | No CSS rendering variance |
| **Performance** | Direct GPU via Canvas 2D | Faster than DOM compositing |
| **Video integration** | Native `<video>` element | Seamless video-in-video |
| **Timeline control** | Frame-accurate seeking | Precise animation timing |
| **Audio sync** | OfflineAudioContext | Perfect audio alignment |

---

## 3. The Hybrid Vision — Best of Both Worlds

### Concept: HTML Layer on Canvas

```
┌─────────────────────────────────────────┐
│  Canvas Layer (existing)                │
│  ├── Text clips (drawCanvas)            │
│  ├── Image clips (drawCanvas)           │
│  ├── Video clips (drawCanvas)           │
│  └── Shape clips (drawCanvas)           │
├─────────────────────────────────────────┤
│  HTML Layer (new)                       │
│  ├── Gradient cards (CSS)               │
│  ├── Glassmorphism (CSS)                │
│  ├── Complex layouts (Flexbox/Grid)     │
│  ├── Animated components (JS)           │
│  └── Tailwind-styled elements           │
├─────────────────────────────────────────┤
│  Composition → Final Frame             │
│  (HTML rendered to Canvas via           │
│   html2canvas or DOM-to-Canvas)         │
└─────────────────────────────────────────┘
```

### How It Would Work

1. **Author:** AI agent writes HTML/CSS/JS component
2. **Preview:** Component renders in an iframe overlay
3. **Timeline:** Component appears as a clip on the timeline
4. **Export:** Component rendered to Canvas via `html2canvas` or `DOMToCanvas`
5. **Compose:** Merged with Canvas clips for final frame

---

## 4. Implementation Options

### Option A: HTML Clip Type (Recommended)

Add a new clip type `html` that renders HTML/CSS/JS:

```javascript
// New clip type
{
  type: 'html',
  html: '<div class="gradient-card"><h1>Title</h1></div>',
  css: '.gradient-card { background: linear-gradient(...); }',
  tailwind: true,
  js: '/* animation logic */',
  start: 0,
  duration: 5
}
```

**Rendering pipeline:**
```
HTML string → iframe → html2canvas → ImageBitmap → Canvas
```

**Pros:**
- Full HTML/CSS/JS support
- AI agents can generate it
- Tailwind CSS works
- Complex animations possible

**Cons:**
- Performance overhead (iframe + html2canvas)
- Not pixel-perfect deterministic
- Export slower than pure Canvas

### Option B: Embedded Browser View

Embed a hidden Chrome instance for HTML rendering:

```javascript
// Puppeteer approach
const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.setContent(htmlString);
const screenshot = await page.screenshot();
```

**Pros:**
- Perfect HTML rendering
- Full CSS/JS support
- Deterministic (same Chrome = same output)

**Cons:**
- Heavy (needs Chrome)
- Slow (per-frame screenshot)
- Memory intensive

### Option C: Hybrid Rendering (Best Balance)

Use Canvas for most things, HTML for complex components:

```javascript
function drawFrame(ctx, w, h, time) {
  // 1. Draw Canvas clips (fast, deterministic)
  drawCanvasClips(ctx, w, h, time);
  
  // 2. Draw HTML clips (slower, but complex)
  for (const htmlClip of getHtmlClips(time)) {
    const bitmap = await renderHtmlToCanvas(htmlClip);
    ctx.drawImage(bitmap, htmlClip.x, htmlClip.y);
  }
}
```

**Pros:**
- Best performance for most content
- HTML available when needed
- Balanced approach

**Cons:**
- Two rendering paths
- More complex codebase

---

## 5. AI Agent Workflow

### Current Workflow (Canvas Only)

```
Agent → Markdown → parseMarkdownToClips() → Canvas clips → Video
```

### New Workflow (Hybrid)

```
Agent → Markdown/HTML → parseToClips() → Canvas + HTML clips → Video
```

### Example: Agent Generates Gradient Card

**Input (Agent writes):**
```html
<div class="gradient-card" style="animation: fadeIn 1s">
  <h2 style="color: white; font-size: 48px">Product Launch</h2>
  <p style="color: rgba(255,255,255,0.8)">The future of productivity</p>
</div>
```

**Output (Studio Pro renders):**
- Beautiful gradient background
- White text with shadows
- Smooth fade-in animation
- Glassmorphism effect

### Template System

```json
{
  "name": "Product Launch",
  "type": "html",
  "html": "{{content}}",
  "css": ".card { background: linear-gradient(135deg, #667eea, #764ba2); }",
  "tailwind": true,
  "animation": "fadeIn"
}
```

---

## 6. Technical Architecture

### New Clip Type: `html`

```javascript
// State.clips structure
{
  id: 'html-1',
  type: 'html',
  html: '<div class="card">...</div>',
  css: '.card { ... }',
  tailwind: true,
  js: '/* optional animations */',
  x: 100,
  y: 100,
  width: 800,
  height: 600,
  start: 0,
  duration: 5,
  effects: {
    animIn: 'fadeIn',
    animInDur: 1
  }
}
```

### Rendering Pipeline

```javascript
// 1. Create offscreen iframe
const iframe = document.createElement('iframe');
iframe.style.display = 'none';
document.body.appendChild(iframe);

// 2. Write HTML/CSS/JS
iframe.contentDocument.write(`
  <html>
    <head>
      <style>${clip.css}</style>
      ${clip.tailwind ? '<script src="https://cdn.tailwindcss.com"></script>' : ''}
    </head>
    <body>
      ${clip.html}
      <script>${clip.js}</script>
    </body>
  </html>
`);

// 3. Wait for render
await new Promise(r => setTimeout(r, 100));

// 4. Capture to Canvas
const canvas = await html2canvas(iframe.contentDocument.body);
const bitmap = await createImageBitmap(canvas);

// 5. Draw to export canvas
ctx.drawImage(bitmap, clip.x, clip.y, clip.width, clip.height);
```

### Timeline Integration

```
Timeline:
├── Text: "Hello World" (Canvas)
├── Image: product.png (Canvas)
├── HTML: gradient-card (HTML → Canvas)
├── Video: intro.mp4 (Canvas)
└── HTML: cta-button (HTML → Canvas)
```

---

## 7. Performance Considerations

### Benchmark Targets

| Content Type | Target Speed | Method |
|---|---|---|
| Canvas only | 4× realtime | FTRT (existing) |
| HTML + Canvas | 2× realtime | html2canvas + Canvas |
| Complex HTML | 1× realtime | DOM-to-Canvas |

### Optimization Strategies

1. **Cache rendered HTML** — Don't re-render if HTML/CSS/JS unchanged
2. **Pre-render HTML clips** — Render all HTML at start, store as ImageBitmaps
3. **Limit HTML complexity** — Warn if too many DOM nodes
4. **Use Tailwind CDN** — Pre-load Tailwind CSS
5. **Batch HTML renders** — Render multiple HTML clips in one iframe

---

## 8. UI Changes

### Timeline

```
┌─────────────────────────────────────────────┐
│ Timeline                                    │
├─────────────────────────────────────────────┤
│ [T] Text: Hello World         ▓▓▓░░░░░░░░░ │
│ [I] Image: product.png        ░░░▓▓▓░░░░░░ │
│ [H] HTML: gradient-card       ░░░░░▓▓▓░░░░ │ ← New HTML type
│ [V] Video: intro.mp4          ░░░░░░░▓▓▓▓▓ │
│ [H] HTML: cta-button          ░░░░░░░░░▓▓▓ │ ← New HTML type
└─────────────────────────────────────────────┘
```

### Properties Panel

```
┌─────────────────────────────────────────┐
│ HTML Clip Properties                    │
├─────────────────────────────────────────┤
│ Type: HTML Component                    │
│                                         │
│ HTML:                                  │
│ ┌─────────────────────────────────────┐ │
│ │ <div class="gradient-card">        │ │
│ │   <h2>Title</h2>                   │ │
│ │ </div>                             │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ CSS:                                   │
│ ┌─────────────────────────────────────┐ │
│ │ .card { background: linear... }    │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ☑ Tailwind CSS                         │
│                                         │
│ [Preview] [Open in Browser]            │
└─────────────────────────────────────────┘
```

---

## 9. Use Cases

### 1. AI-Generated Intro Cards

```
Agent: "Create a product launch intro with gradient background"
→ Generates HTML/CSS with gradient, text, animations
→ Studio Pro renders as HTML clip
→ Exported video has beautiful gradient card
```

### 2. Complex Data Visualizations

```
Agent: "Show a bar chart with animated bars"
→ Generates HTML/CSS with chart, animations
→ Studio Pro renders as HTML clip
→ Exported video has animated chart
```

### 3. Glassmorphism UI Elements

```
Agent: "Add a glassmorphism card with blur effect"
→ Generates HTML/CSS with backdrop-filter
→ Studio Pro renders as HTML clip
→ Exported video has modern UI element
```

### 4. Multi-Gradient Backgrounds

```
Agent: "Create a moving gradient background"
→ Generates HTML/CSS with animated gradients
→ Studio Pro renders as HTML clip
→ Exported video has dynamic background
```

---

## 10. Comparison: Current vs Hybrid

| Aspect | Current (Canvas Only) | Hybrid (Canvas + HTML) |
|---|---|---|
| **AI agent authoring** | Markdown only | Markdown + HTML/CSS/JS |
| **Complex visuals** | Limited by Canvas API | Full CSS capabilities |
| **Gradient cards** | Manual drawing | CSS `linear-gradient` |
| **Glassmorphism** | Not possible | CSS `backdrop-filter` |
| **Text wrapping** | Manual | CSS automatic |
| **3D effects** | Not possible | CSS 3D transforms |
| **Performance** | 4× realtime | 2× realtime (estimated) |
| **Determinism** | Perfect | Near-perfect |
| **File size** | Small | Larger (HTML/CSS/JS) |

---

## 11. Implementation Roadmap

### Phase 1: Basic HTML Clip (1-2 weeks)

- [ ] Add `html` clip type to State
- [ ] Create HTML editor panel
- [ ] Implement html2canvas rendering
- [ ] Add to timeline UI
- [ ] Basic export support

### Phase 2: Tailwind Integration (1 week)

- [ ] Add Tailwind CSS CDN
- [ ] Auto-detect Tailwind classes
- [ ] Tailwind config editor
- [ ] Preview with Tailwind

### Phase 3: AI Agent Support (1-2 weeks)

- [ ] HTML template system
- [ ] Agent prompt → HTML generation
- [ ] Markdown → HTML conversion
- [ ] Template gallery

### Phase 4: Performance Optimization (2-3 weeks)

- [ ] HTML clip caching
- [ ] Pre-rendering pipeline
- [ ] Batch HTML rendering
- [ ] Worker-based rendering

### Phase 5: Advanced Features (3-4 weeks)

- [ ] JavaScript animation support
- [ ] Interactive previews
- [ ] Live HTML editing
- [ ] Component library

---

## 12. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Performance** | Slower exports | Cache, pre-render, limit complexity |
| **Determinism** | Different output across browsers | Pin Chrome version, use html2canvas |
| **Complexity** | More code to maintain | Clear separation, good docs |
| **File size** | Larger projects | Compress HTML/CSS, lazy loading |
| **Security** | XSS via user HTML | Sandbox iframe, sanitize input |

---

## 13. Conclusion

### The Opportunity

Remotion proved that **HTML/CSS/JS is the future of AI-generated video**. Agents are excellent at writing code, but struggle with Canvas API. By adding HTML/CSS/JS support to Studio Pro:

1. **AI agents become 10× more productive** — They can generate complex visuals
2. **Users get professional results** — Glassmorphism, gradients, 3D effects
3. **Studio Pro stays competitive** — Matches Remotion's authoring model
4. **Hybrid approach preserves strengths** — Canvas for performance, HTML for complexity

### The Recommendation

**Implement Option C (Hybrid Rendering):**

1. Keep Canvas as the primary renderer (fast, deterministic)
2. Add HTML clip type for complex components (flexible, AI-friendly)
3. Cache HTML renders to minimize performance impact
4. Start with Phase 1 (basic HTML clip) and iterate

**This positions Studio Pro as the best of both worlds:**
- **Canvas performance** for most content
- **HTML flexibility** for complex visuals
- **AI agent authoring** for automation
- **GUI editing** for human creativity
