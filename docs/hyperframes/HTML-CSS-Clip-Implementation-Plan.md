# HTML/CSS Clip Implementation Plan

> **Date:** August 2026
> **Goal:** Add a new 'html' clip type that renders HTML/CSS to Canvas
> **Scope:** Standard CSS only (no Tailwind), all core features (effects, animations, keyframes)

---

## 1. The Vision

### What We're Building

A new clip type that lets users (and AI agents) write HTML/CSS to create complex visuals:

```html
<!-- User writes this -->
<div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 40px; border-radius: 20px;">
  <h1 style="color: white; font-size: 48px;">Product Launch</h1>
  <p style="color: rgba(255,255,255,0.8);">The future of productivity</p>
</div>
```

**Result:** Beautiful gradient card rendered on Canvas, with all standard features:
- ✅ Scale, rotate, opacity
- ✅ Stroke, shadow, blend modes
- ✅ Fade in/out, slide, pop animations
- ✅ Keyframe animation
- ✅ Timeline positioning
- ✅ Export (FTRT + MediaBunny)

---

## 2. Architecture Decision: Separate File vs Same File

### Option A: Separate JS File (Recommended)

```
index.html          — Main editor (existing)
html-clip.js        — HTML clip rendering engine (new)
```

**Pros:**
- Keeps index.html clean (already 33,000+ lines)
- Easier to maintain and test
- Can be loaded conditionally

**Cons:**
- Need to coordinate between files
- Slightly more complex build

### Option B: Same File

```
index.html          — Everything in one file
```

**Pros:**
- Simpler (no coordination)
- No build step needed

**Cons:**
- index.html already massive
- Harder to maintain

---

## 3. The Data Structure

### New Clip Type: `html`

```javascript
{
  // ── Identity ──────────────────────────────────────────────
  id: 'html_1234567890_abc',
  type: 'html',                    // NEW TYPE
  trackId: 't1',
  sceneId: null,
  colorIndex: 0,
  zIndex: 0,
  hidden: false,
  locked: false,

  // ── Timing ────────────────────────────────────────────────
  start: 0,                        // Start time in seconds
  duration: 5,                     // Duration in seconds
  
  // ── HTML Content ──────────────────────────────────────────
  html: '<div class="card">...</div>',  // HTML string
  css: '.card { background: ...; }',    // CSS string
  js: '/* optional animations */',      // Optional JS string
  
  // ── Rendering Options ─────────────────────────────────────
  renderWidth: 1920,               // Render resolution
  renderHeight: 1080,
  backgroundColor: 'transparent',  // Background color
  
  // ── Standard Effects (same as other clips) ────────────────
  effects: {
    // Transform
    scale: 1,
    rotate: 0,
    offsetX: 0,
    offsetY: 0,
    opacity: 100,
    
    // Visual
    strokeEnable: false,
    strokeColor: '#ffffff',
    strokeWidth: 4,
    shadowEnable: false,
    shadowColor: '#000000',
    shadowBlur: 20,
    shadowX: 0,
    shadowY: 10,
    borderRadius: 0,
    
    // Animation (IN)
    animIn: 'none',
    animInDur: 1.0,
    animInDelay: 0,
    animInEase: 'easeOut',
    animSlideDir: 'up',
    animSlideOffCanvas: true,
    
    // Animation (OUT)
    animOut: 'none',
    animOutDur: 1.0,
    animOutDelay: 0,
    
    // Animation (LOOP)
    animLoop: 'none',
    
    // Blend
    blendMode: 'source-over',
  },
  
  // ── Keyframes ─────────────────────────────────────────────
  keyframes: {},                    // Same as other clips
  
  // ── Cache ─────────────────────────────────────────────────
  _iframe: null,                    // Offscreen iframe (session only)
  _bitmap: null,                    // Rendered ImageBitmap (session only)
  _lastHtml: '',                    // For cache invalidation
  _lastCss: '',
}
```

---

## 4. Rendering Pipeline

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User writes HTML/CSS in editor                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Create offscreen iframe                                  │
│    iframe = document.createElement('iframe')                │
│    iframe.style.display = 'none'                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Write HTML/CSS/JS to iframe                              │
│    iframe.contentDocument.write(`                           │
│      <html>                                                 │
│        <head><style>${css}</style></head>                   │
│        <body>${html}<script>${js}</script></body>           │
│      </html>                                                │
│    `)                                                       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Wait for render (requestAnimationFrame or setTimeout)    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Capture to Canvas using html2canvas                      │
│    canvas = await html2canvas(iframe.contentDocument.body)  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Create ImageBitmap for fast drawing                      │
│    bitmap = await createImageBitmap(canvas)                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. Draw to export canvas in drawCanvas()                    │
│    ctx.drawImage(bitmap, x, y, width, height)               │
└─────────────────────────────────────────────────────────────┘
```

### The Code (Pseudocode)

```javascript
// ── html-clip.js ────────────────────────────────────────────

const HTMLClipRenderer = {
  // Cache: clipId → ImageBitmap
  cache: new Map(),
  
  // Render HTML clip to bitmap
  async render(clip, width, height) {
    // Check cache (skip if HTML/CSS unchanged)
    const sig = `${clip.html}|||${clip.css}|||${clip.js}`;
    if (clip._lastSig === sig && this.cache.has(clip.id)) {
      return this.cache.get(clip.id);
    }
    
    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:absolute;left:-9999px;width:${width}px;height:${height}px;';
    document.body.appendChild(iframe);
    
    // Write content
    const doc = iframe.contentDocument;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { width: ${width}px; height: ${height}px; overflow: hidden; }
            ${clip.css}
          </style>
        </head>
        <body>
          ${clip.html}
          ${clip.js ? `<script>${clip.js}<\/script>` : ''}
        </body>
      </html>
    `);
    doc.close();
    
    // Wait for render
    await new Promise(r => {
      iframe.contentWindow.requestAnimationFrame(r);
    });
    
    // Capture to canvas
    const canvas = await html2canvas(doc.body, {
      width,
      height,
      backgroundColor: clip.backgroundColor || 'transparent',
    });
    
    // Create bitmap
    const bitmap = await createImageBitmap(canvas);
    
    // Cleanup
    document.body.removeChild(iframe);
    
    // Cache
    this.cache.set(clip.id, bitmap);
    clip._lastSig = sig;
    
    return bitmap;
  },
  
  // Draw HTML clip to context
  async draw(ctx, clip, time, w, h) {
    const bitmap = await this.render(clip, clip.renderWidth || w, clip.renderHeight || h);
    
    // Apply standard effects (same as image clips)
    const clipTime = time - clip.start;
    const timeLeft = clip.duration - clipTime;
    const aState = calculateAnimationState(clip, clipTime, timeLeft, w, h);
    
    ctx.save();
    ctx.globalAlpha = aState.animAlpha * (clip.effects.opacity / 100);
    ctx.globalCompositeOperation = clip.effects.blendMode || 'source-over';
    
    // Transform
    const cx = w/2 + (clip.effects.offsetX * w) / 100 + aState.animX;
    const cy = h/2 + (clip.effects.offsetY * h) / 100 + aState.animY;
    ctx.translate(cx, cy);
    ctx.rotate((clip.effects.rotate * Math.PI / 180) + aState.animRot);
    ctx.scale(aState.animScale, aState.animScale);
    
    // Shadow
    if (clip.effects.shadowEnable) {
      ctx.shadowColor = clip.effects.shadowColor;
      ctx.shadowBlur = clip.effects.shadowBlur;
      ctx.shadowOffsetX = clip.effects.shadowX;
      ctx.shadowOffsetY = clip.effects.shadowY;
    }
    
    // Draw
    ctx.drawImage(bitmap, -w/2, -h/2, w, h);
    
    ctx.restore();
  }
};
```

---

## 5. Integration Points

### 5.1 drawCanvas() Integration

```javascript
// In drawCanvas(), add after image/video handling:

if (clip.type === 'html') {
  // Use async rendering (same pattern as video)
  if (!clip._renderPromise) {
    clip._renderPromise = HTMLClipRenderer.render(clip, w, h);
  }
  
  // Check if bitmap is ready
  if (clip._bitmapReady) {
    HTMLClipRenderer.draw(ctx, clip, State.currentTime, w, h);
  }
}
```

### 5.2 Timeline Integration

```javascript
// In renderClips(), add HTML clip to timeline:

if (clip.type === 'html') {
  // Show as colored block with "HTML" label
  clipEl.querySelector('.clip-label').textContent = clip.title || 'HTML Clip';
  clipEl.style.backgroundColor = '#8b5cf6'; // Purple for HTML
}
```

### 5.3 Properties Panel Integration

```javascript
// In showClipProperties(), add HTML editor:

if (clip.type === 'html') {
  html += `
    <div class="prop-card">
      <label>HTML Content</label>
      <textarea id="clipHtml" rows="6">${clip.html}</textarea>
    </div>
    <div class="prop-card">
      <label>CSS Styles</label>
      <textarea id="clipCss" rows="4">${clip.css}</textarea>
    </div>
    <div class="prop-card">
      <label>JavaScript (optional)</label>
      <textarea id="clipJs" rows="3">${clip.js || ''}</textarea>
    </div>
    <button onclick="previewHtmlClip()">Preview</button>
  `;
}
```

### 5.4 Export Integration

```javascript
// In FTRT export loop, handle HTML clips:

if (clip.type === 'html') {
  const bitmap = await HTMLClipRenderer.render(clip, exportW, exportH);
  // Draw with effects (same as image)
  drawImageWithEffects(ctx, bitmap, clip, exportW, exportH);
}
```

---

## 6. UI Components

### 6.1 Add HTML Clip Button

```html
<!-- In the toolbar/add menu -->
<button onclick="addHtmlClip()" class="toolbar-btn">
  <i data-lucide="code"></i>
  HTML
</button>
```

### 6.2 HTML Editor Panel

```html
<!-- In properties panel -->
<div class="html-editor">
  <div class="editor-header">
    <span>HTML Clip</span>
    <button onclick="previewHtmlClip()">Preview</button>
  </div>
  
  <div class="editor-section">
    <label>HTML</label>
    <textarea id="htmlEditor" rows="8" 
      placeholder="<div>Your HTML here</div>"
      spellcheck="false"></textarea>
  </div>
  
  <div class="editor-section">
    <label>CSS</label>
    <textarea id="cssEditor" rows="5"
      placeholder=".class { color: red; }"
      spellcheck="false"></textarea>
  </div>
  
  <div class="editor-section">
    <label>JavaScript (optional)</label>
    <textarea id="jsEditor" rows="3"
      placeholder="/* Animation logic */"
      spellcheck="false"></textarea>
  </div>
  
  <div class="editor-actions">
    <button onclick="applyHtmlClip()">Apply</button>
    <button onclick="resetHtmlClip()">Reset</button>
  </div>
</div>
```

### 6.3 Live Preview

```javascript
// Live preview in iframe overlay
function previewHtmlClip() {
  const html = document.getElementById('htmlEditor').value;
  const css = document.getElementById('cssEditor').value;
  const js = document.getElementById('jsEditor').value;
  
  const preview = document.getElementById('htmlPreview');
  preview.innerHTML = `
    <style>${css}</style>
    ${html}
    ${js ? `<script>${js}<\/script>` : ''}
  `;
  preview.classList.remove('hidden');
}
```

---

## 7. Feature Parity Checklist

| Feature | Text | Image | Video | Shape | **HTML** |
|---|---|---|---|---|---|
| Position (x, y) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Scale | ✅ | ✅ | ✅ | ✅ | ✅ |
| Rotate | ✅ | ✅ | ✅ | ✅ | ✅ |
| Opacity | ✅ | ✅ | ✅ | ✅ | ✅ |
| Stroke | ✅ | ✅ | ✅ | ✅ | ⬜ Optional |
| Shadow | ✅ | ✅ | ✅ | ✅ | ✅ |
| Blend mode | ✅ | ✅ | ✅ | ✅ | ✅ |
| Fade in/out | ✅ | ✅ | ✅ | ✅ | ✅ |
| Slide | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pop | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shake | ✅ | ✅ | ✅ | ✅ | ✅ |
| Spin | ✅ | ✅ | ✅ | ✅ | ✅ |
| Keyframes | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crop | — | ✅ | ✅ | — | ⬜ Later |
| Mask | — | ✅ | ✅ | — | ⬜ Later |
| Color grade | — | ✅ | ✅ | — | ⬜ Later |

---

## 8. Implementation Phases

### Phase 1: Core Renderer (2-3 days)

**Files to modify:**
- `index.html` — Add clip type handling in drawCanvas()
- `html-clip.js` (new) — HTMLClipRenderer class

**Tasks:**
- [ ] Create HTMLClipRenderer with iframe rendering
- [ ] Add html2canvas integration
- [ ] Add to drawCanvas() loop
- [ ] Test basic rendering

**Outcome:** HTML renders on Canvas

---

### Phase 2: Editor UI (2-3 days)

**Files to modify:**
- `index.html` — Add HTML editor panel, add clip button

**Tasks:**
- [ ] Add "Add HTML Clip" button to toolbar
- [ ] Create HTML/CSS/JS text editors in properties panel
- [ ] Add live preview functionality
- [ ] Add apply/reset buttons

**Outcome:** Users can create and edit HTML clips

---

### Phase 3: Effects & Animations (2-3 days)

**Files to modify:**
- `index.html` — Add effect handling for HTML clips

**Tasks:**
- [ ] Add scale, rotate, opacity (same as image)
- [ ] Add stroke, shadow, blend mode
- [ ] Add fade in/out, slide, pop, shake, spin
- [ ] Add keyframe support

**Outcome:** HTML clips have all standard effects

---

### Phase 4: Export Integration (1-2 days)

**Files to modify:**
- `index.html` — Add to export loops

**Tasks:**
- [ ] Add to FTRT export loop
- [ ] Add to MediaBunny export loop
- [ ] Add to Standard export loop
- [ ] Test export quality

**Outcome:** HTML clips export correctly

---

### Phase 5: Timeline Integration (1 day)

**Files to modify:**
- `index.html` — Add to timeline rendering

**Tasks:**
- [ ] Add HTML clip block to timeline
- [ ] Add drag/resize support
- [ ] Add color coding (purple for HTML)

**Outcome:** HTML clips appear on timeline

---

### Phase 6: Caching & Performance (1-2 days)

**Files to modify:**
- `html-clip.js` — Add caching

**Tasks:**
- [ ] Add render caching (skip if HTML unchanged)
- [ ] Add pre-rendering for known clips
- [ ] Add cache invalidation on edit

**Outcome:** Fast re-renders

---

## 9. Dependencies

### Required

| Library | Purpose | Size | CDN |
|---|---|---|---|
| **html2canvas** | Render HTML to Canvas | ~40KB | ✅ Available |

### Not Required (for now)

| Library | Why Not |
|---|---|
| Tailwind CSS | User said standard CSS only |
| WebCodecs | Not needed for HTML rendering |
| FFmpeg | Not needed (MediaBunny handles encoding) |

---

## 10. Testing Plan

### Unit Tests

1. **Render test:** HTML → iframe → canvas → bitmap
2. **Cache test:** Same HTML renders from cache
3. **Effect test:** Scale, rotate, opacity work correctly
4. **Animation test:** Fade in/out, slide work correctly

### Integration Tests

1. **Timeline test:** HTML clip appears on timeline
2. **Properties test:** HTML editor saves changes
3. **Export test:** HTML clip exports to MP4
4. **Round-trip test:** Save project → load → HTML clip intact

### Visual Tests

1. **Gradient card:** Linear gradient renders correctly
2. **Shadow:** Box shadow renders correctly
3. **Text:** Text wrapping works correctly
4. **Animation:** Fade-in is smooth

---

## 11. Example Use Cases

### 1. Gradient Card

```html
<div style="
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 60px;
  border-radius: 20px;
  text-align: center;
">
  <h1 style="color: white; font-size: 48px; margin-bottom: 20px;">
    Product Launch
  </h1>
  <p style="color: rgba(255,255,255,0.9); font-size: 24px;">
    The future of productivity
  </p>
</div>
```

### 2. Glassmorphism Card

```html
<div style="
  background: rgba(255,255,255,0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 20px;
  padding: 40px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
">
  <h2 style="color: white;">Glassmorphism</h2>
</div>
```

### 3. Animated Counter

```html
<div id="counter" style="font-size: 72px; color: white; text-align: center;">
  0
</div>
<script>
  let count = 0;
  setInterval(() => {
    count++;
    document.getElementById('counter').textContent = count;
  }, 1000);
</script>
```

### 4. Data Visualization

```html
<div style="display: flex; align-items: flex-end; height: 200px; gap: 10px;">
  <div style="width: 40px; background: #3b82f6; height: 60%;"></div>
  <div style="width: 40px; background: #10b981; height: 80%;"></div>
  <div style="width: 40px; background: #f59e0b; height: 40%;"></div>
  <div style="width: 40px; background: #ef4444; height: 90%;"></div>
</div>
```

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Performance** | Slower exports | Cache renders, pre-render known clips |
| **Determinism** | Different output across browsers | Pin html2canvas version, test on Chrome |
| **Security** | XSS via user HTML | Sandboxed iframe, no access to parent |
| **Complexity** | More code to maintain | Clear separation, good docs |
| **File size** | Larger projects | Compress HTML/CSS, lazy loading |

---

## 13. Success Criteria

| Metric | Target |
|---|---|
| Render speed | < 100ms per frame |
| Export speed | 2× realtime (with HTML clips) |
| Feature parity | 90% of image clip features |
| Memory usage | < 50MB per HTML clip |
| Browser support | Chrome 90+ |

---

## 14. Next Steps

1. **Get user approval** on this plan
2. **Create html-clip.js** with HTMLClipRenderer
3. **Add to drawCanvas()** for rendering
4. **Add UI** for editing HTML/CSS
5. **Test and iterate**

---

## Appendix: html2canvas Usage

```javascript
// Basic usage
const canvas = await html2canvas(element, {
  width: 1920,
  height: 1080,
  backgroundColor: null, // transparent
  scale: 1, // no scaling
});

// Create bitmap for fast drawing
const bitmap = await createImageBitmap(canvas);

// Draw to context
ctx.drawImage(bitmap, 0, 0, 1920, 1080);
```
