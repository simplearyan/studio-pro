# Phase 2: HTML-in-Canvas Clip Type — Integration Plan

> **Date:** August 2026 (Updated)
> **Goal:** Add HTML-in-Canvas as a new independent clip type in Studio Pro, with proper canvas preview rendering, timeline playhead seeking, and MediaBunny/FTRT export.

---

## 1. Current Architecture Analysis

### Existing Element Types

Studio Pro has 6 clip types, each with its own rendering path in `drawCanvas()`:

| Type | Rendering | Properties |
|------|-----------|------------|
| `text` | Canvas 2D `fillText()` | fontSize, fontFamily, fillColor, textAlign, lineHeight |
| `shape` | Canvas 2D path drawing | shapeType (rect/circle/star), fillColor, width, height |
| `image` | `ctx.drawImage(imgEl)` | src, objectFit, crop |
| `video` | `ctx.drawImage(videoEl)` | src, objectFit, crop |
| `scene` | Container for other clips | opaqueBg, backgroundColor |
| `html` | **iframe + html2canvas** | html, css, js, fonts |

### How drawCanvas() Works

```javascript
function drawCanvas(targetCtx, targetW, targetH, opts) {
    // 1. Clear canvas
    // 2. Draw background
    // 3. Filter active clips (visible + in time range)
    // 4. Sort by track order (top track draws last)
    // 5. For each clip:
    //    - Calculate transform (scale, rotate, offset, opacity)
    //    - Apply animation state (enter/exit/loop)
    //    - Draw to canvas based on clip type
}
```

### How Timeline Seek Works

```javascript
// User moves playhead → State.currentTime updates → drawCanvas() called
function seekTo(time) {
    State.currentTime = time;
    drawCanvas();  // Re-renders all visible clips at current time
    updateTimelinePlayhead();  // Moves playhead indicator
}
```

**Key insight:** Every clip type must render correctly at any `State.currentTime`. The renderer must be able to seek to any frame instantly.

### Our SVG foreignObject Renderer (Phase 1 Complete)

```javascript
// src/html-in-canvas/renderer.js
class HTMLCanvasRenderer {
    async setClip(html, css, js) { /* preload fonts/images, compile onFrame */ }
    async renderFrame(timeMs) {
        // 1. onFrame(timeMs) updates DOM
        // 2. cloneNode(true) + XMLSerializer → XHTML
        // 3. <style> as sibling of content div
        // 4. new Image() loads SVG → canvas
    }
}
```

**Why this is better than html2canvas:**
- Full CSS support (flexbox, grid, backdrop-filter, filters)
- 5-15ms per frame (vs 200-500ms)
- Zero dependencies (native browser APIs)
- External fonts/images preloaded as base64

---

## 2. What We're Building

### New Clip Type: `hic` (HTML-in-Canvas)

A completely independent element type that renders HTML/CSS/JS using SVG foreignObject. Separate from existing `html` type.

```
┌─────────────────────────────────────────────┐
│  Toolbar                                    │
│  [Text] [Shape] [Image] [HTML] [HIC ✨]     │
│                                    ↑ NEW     │
├─────────────────────────────────────────────┤
│  Timeline Track                             │
│  ═══════════════════════════════════════════ │
│  Track 1: [Text Clip]    [HIC Clip]         │
│  Track 2: [Image Clip]   [HIC Clip]         │
│  Track 3: [Video Clip]                      │
├─────────────────────────────────────────────┤
│  Canvas Preview                             │
│  ┌─────────────────────────────────────┐    │
│  │  HIC Clip rendered via SVG          │    │
│  │  foreignObject → canvas             │    │
│  └─────────────────────────────────────┘    │
├─────────────────────────────────────────────┤
│  Sidebar Panel                              │
│  ┌─────────────────────────────────────┐    │
│  │  Preset: [Google] [Neo] [Glass] ... │    │
│  │  Duration: [5s]                     │    │
│  │  [Open Code Editor]                 │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### Features

1. **New toolbar button** — "HIC" (HTML-in-Canvas) with sparkle icon
2. **Preset browser** — Grid of animated presets (from Phase 1)
3. **Code editor modal** — CodeMirror with HTML/CSS/JS tabs + live preview
4. **Canvas preview** — Real-time animation with playhead seeking
5. **Timeline rendering** — Proper clip display with color/icon
6. **Export** — MediaBunny (html2canvas + WebCodecs) or FTRT

---

## 3. Implementation Phases

### Phase 2.1: Core Integration (2-3 days)

**Goal:** Add `hic` clip type to State, drawCanvas, and timeline.

#### Files to Modify

| File | Changes |
|------|---------|
| `index.html` | Add `hic` to clip type enum, drawCanvas rendering, sidebar panel |
| `src/html-in-canvas/renderer.js` | Integrate with drawCanvas (singleton renderer) |
| `src/html-in-canvas/presets/index.js` | Preset definitions for sidebar |

#### Step 1: Add `hic` to State Clip Factory

```javascript
// index.html — _createClipFromDef()
case 'hic':
    baseClip.html = def.html || '';
    baseClip.css = def.css || '';
    baseClip.js = def.js || '';
    baseClip.presetId = def.presetId || null;
    baseClip.fonts = def.fonts || [];
    baseClip.renderWidth = 1920;
    baseClip.renderHeight = 1080;
    break;
```

#### Step 2: Add to drawCanvas Rendering

```javascript
// index.html — drawCanvas() activeVisualClips filter
(c.type === 'video' || c.type === 'image' || c.type === 'text' || 
 c.type === 'scene' || c.type === 'shape' || c.type === 'html' || 
 c.type === 'hic')  // ← ADD

// index.html — drawCanvas() rendering switch
} else if (clip.type === 'hic') {
    // ── HTML-in-Canvas Rendering (SVG foreignObject) ──
    const clipTime = State.currentTime - clip.start;
    const timeLeft = clip.duration - clipTime;
    const aState = calculateAnimationState(clip, clipTime, timeLeft, w, h);
    
    ctx.save();
    const finalScale = baseScale * aState.animScale;
    const cx = w/2 + (offsetX * w) / 100 + aState.animX;
    const cy = h/2 + (offsetY * h) / 100 + aState.animY;
    
    ctx.globalAlpha = aState.animAlpha * (opacity / 100);
    ctx.globalCompositeOperation = clip.effects.blendMode || 'source-over';
    ctx.translate(cx, cy);
    ctx.rotate((rotate * Math.PI / 180) + aState.animRot);
    ctx.scale(finalScale * (clip.effects.flipH ? -1 : 1), 
              finalScale * (clip.effects.flipV ? -1 : 1));
    
    // Use singleton renderer
    if (!window._hicRenderer) {
        window._hicRenderer = new HTMLCanvasRenderer(w, h);
    }
    const renderer = window._hicRenderer;
    
    // Set clip if changed
    const sig = (clip.html || '') + '|||' + (clip.css || '') + '|||' + (clip.js || '');
    if (clip._hicSig !== sig) {
        clip._hicSig = sig;
        await renderer.setClip(clip.html, clip.css, clip.js);
    }
    
    // Render frame at current time (PLAYHEAD SEEK)
    // clipTime is in seconds, renderFrame expects milliseconds
    await renderer.renderFrame(clipTime * 1000);
    
    // Draw to canvas
    ctx.drawImage(renderer.canvas, -w/2, -h/2, w, h);
    
    // Stroke/border
    if (clip.effects.strokeEnable) {
        ctx.strokeStyle = clip.effects.strokeColor || '#ffffff';
        ctx.lineWidth = clip.effects.strokeWidth || 4;
        ctx.beginPath();
        ctx.rect(-w/2, -h/2, w, h);
        ctx.stroke();
    }
    
    ctx.restore();
}
```

#### Step 3: Add to activeVisualClips Filter

```javascript
// Already done in Step 2 — add 'hic' to the type filter
let activeVisualClips = State.clips.filter(c => {
    const track = State.tracks.find(t => t.id === c.trackId);
    return !c.hidden &&
        (track && !track.hidden) &&
        (c.type === 'video' || c.type === 'image' || c.type === 'text' || 
         c.type === 'scene' || c.type === 'shape' || c.type === 'html' || 
         c.type === 'hic') &&
        (c.sceneId === State.activeSceneId || (!c.sceneId && !State.activeSceneId)) &&
        State.currentTime >= c.start && State.currentTime < c.start + c.duration;
});
```

#### Step 4: Add Toolbar Button

```html
<!-- index.html — toolbar -->
<button id="btnAddHic" onclick="addHicClipToTimeline()" 
    class="p-1.5 text-violet-600 dark:text-violet-400 hover:text-violet-900 
           dark:hover:text-white bg-violet-50 dark:bg-violet-900/30 
           rounded-md border border-violet-200 dark:border-violet-700 shadow-sm" 
    title="Add HTML-in-Canvas Animated Clip">
    <i data-lucide="sparkles" class="w-4 h-4"></i>
</button>
```

#### Step 5: Add `addHicClipToTimeline()` Function

```javascript
window.addHicClipToTimeline = function(presetKey) {
    let targetTrackId = getAvailableTrack('video', State.currentTime, 5);
    let targetTrack = State.tracks.find(t => t.id === targetTrackId);
    let clipColor = (targetTrack.colorIndex + 9) % PALETTES.length;
    
    const preset = HIC_PRESETS[presetKey] || HIC_PRESETS.googleClean;
    
    const newClip = {
        id: 'hic_' + Date.now() + Math.random().toString(36).substr(2, 5),
        sceneId: State.activeSceneId || null,
        trackId: targetTrackId,
        colorIndex: clipColor,
        type: 'hic',
        title: preset.name,
        start: State.currentTime,
        duration: preset.dur || 5,
        html: preset.html,
        css: preset.css,
        js: preset.js,
        effects: {
            scale: 1, rotate: 0, offsetX: 0, offsetY: 0,
            opacity: 100, borderRadius: 0, blendMode: 'source-over',
            strokeEnable: false, strokeColor: '#ffffff', strokeWidth: 4,
            shadowEnable: false, shadowColor: '#000000', shadowBlur: 20,
            shadowX: 0, shadowY: 10
        }
    };
    
    State.clips.push(newClip);
    calcOverlaps();
    renderClips();
    drawCanvas();
};
```

---

### Phase 2.2: Canvas Preview with Playhead Seeking (2-3 days)

**Goal:** When user moves playhead, HIC clip animation updates to correct frame.

#### How Playhead Seeking Works

```
User drags playhead
  → State.currentTime = newTime
  → drawCanvas() called
  → For each HIC clip:
      clipTime = State.currentTime - clip.start
      renderer.renderFrame(clipTime * 1000)
      → onFrame(clipTime * 1000) updates DOM
      → SVG foreignObject captures frame
      → canvas.drawImage() paints to preview
```

#### Key Implementation Details

1. **Deterministic rendering:** `onFrame(time)` must produce the same output for the same time value. No `Math.random()`, no `Date.now()`, no network requests.

2. **Instant seeking:** The renderer must be able to jump to any frame without playing through previous frames. This is why we use `onFrame(time)` instead of CSS @keyframes.

3. **Frame caching:** Cache rendered frames to avoid re-rendering when seeking back to a previously rendered time.

```javascript
// Renderer with frame caching
class HTMLCanvasRenderer {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.sandbox = document.createElement('div');
        this.sandbox.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:' + width + 'px;height:' + height + 'px;overflow:hidden;pointer-events:none;';
        document.body.appendChild(this.sandbox);
        
        // Frame cache: timeMs → ImageBitmap
        this._frameCache = new Map();
        this._cacheMaxSize = 30;  // Keep last 30 frames
    }
    
    async renderFrame(timeMs) {
        // Check cache first
        const cacheKey = Math.round(timeMs);  // Quantize to nearest ms
        if (this._frameCache.has(cacheKey)) {
            const cached = this._frameCache.get(cacheKey);
            this.ctx.clearRect(0, 0, this.width, this.height);
            this.ctx.drawImage(cached, 0, 0);
            return true;
        }
        
        // Render new frame
        if (this._onFrame) {
            try { this._onFrame(timeMs); } catch (e) { console.error('[HIC] onFrame error:', e); }
        }
        
        // Serialize DOM to SVG
        const clone = this.sandbox.cloneNode(true);
        clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
        clone.setAttribute('style', 'width:100%;height:100%;margin:0;padding:0;overflow:hidden;');
        const domString = new XMLSerializer().serializeToString(clone);
        
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + this.width + '" height="' + this.height + '">' +
            '<foreignObject width="100%" height="100%">' +
            '<style xmlns="http://www.w3.org/1999/xhtml">' + this.css + '</style>' +
            '<div xmlns="http://www.w3.org/1999/xhtml" style="width:' + this.width + 'px;height:' + this.height + 'px;overflow:hidden;">' +
            domString +
            '</div></foreignObject></svg>';
        
        return new Promise((resolve) => {
            const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
            const img = new Image();
            img.onload = () => {
                this.ctx.clearRect(0, 0, this.width, this.height);
                this.ctx.drawImage(img, 0, 0);
                
                // Cache the frame
                if (this._frameCache.size >= this._cacheMaxSize) {
                    const firstKey = this._frameCache.keys().next().value;
                    this._frameCache.delete(firstKey);
                }
                this._frameCache.set(cacheKey, this.canvas);
                
                resolve(true);
            };
            img.onerror = () => {
                this.ctx.fillStyle = '#1e293b';
                this.ctx.fillRect(0, 0, this.width, this.height);
                this.ctx.fillStyle = '#ef4444';
                this.ctx.font = '24px sans-serif';
                this.ctx.fillText('Render Error', 40, 60);
                resolve(false);
            };
            img.src = url;
        });
    }
    
    // Clear cache when clip changes
    clearCache() {
        this._frameCache.clear();
    }
}
```

#### Playhead Interaction Flow

```
1. User clicks on timeline at 2.5s
   → State.currentTime = 2.5
   → drawCanvas() called

2. drawCanvas() finds HIC clip at start=1.0, duration=5.0
   → clipTime = 2.5 - 1.0 = 1.5s
   → renderer.renderFrame(1500)  // 1500ms

3. renderer.renderFrame(1500):
   → onFrame(1500) updates DOM to show animation at 1.5s
   → SVG foreignObject captures frame
   → canvas.drawImage() paints to preview

4. User sees correct animation frame at 1.5s into the clip
```

---

### Phase 2.3: Sidebar Panel (1-2 days)

**Goal:** Properties panel for HIC clips with preset browser and code access.

#### Sidebar Panel HTML

```javascript
// index.html — updateSidebarPanel()
const isHic = clip.type === 'hic';

if (isHic) {
    sceneHTML = `
        <details id="cardHic" class="group bg-white dark:bg-surface-800 border border-surface-300 
                   dark:border-surface-700 shadow-sm rounded-lg shrink-0 overflow-hidden flex flex-col" open>
            <summary class="flex items-center justify-between px-3 py-2 
                          bg-surface-100 dark:bg-surface-800/80 border-b border-surface-200 
                          dark:border-surface-700 cursor-pointer list-none">
                <div class="text-sm font-bold text-surface-800 dark:text-surface-200 flex items-center gap-2">
                    <i data-lucide="sparkles" class="w-4 h-4 text-violet-500"></i> 
                    HTML-in-Canvas
                </div>
                <i data-lucide="chevron-down" class="w-4 h-4 text-surface-500 
                   transition-transform group-open:rotate-180"></i>
            </summary>
            <div class="px-3 py-2 flex flex-col gap-2 bg-surface-50 dark:bg-surface-900/50 flex-1">
                <!-- Preset Selector -->
                <div class="flex flex-wrap gap-1">
                    ${Object.entries(HIC_PRESETS).map(([key, p]) => `
                        <button onclick="applyHicPreset('${clip.id}', '${key}')" 
                            class="px-2 py-1 text-[10px] font-bold bg-violet-100 dark:bg-violet-900/30 
                                   hover:bg-violet-200 dark:hover:bg-violet-800/50 text-violet-700 
                                   dark:text-violet-300 rounded transition-colors">
                            ${p.name}
                        </button>
                    `).join('')}
                </div>
                <!-- Duration -->
                <div class="flex items-center justify-between gap-2">
                    <span class="text-[10px] font-bold text-surface-500 dark:text-surface-300 
                                 uppercase tracking-widest">Duration</span>
                    <input type="number" value="${clip.duration}" min="0.5" max="60" step="0.5"
                        onchange="setClipDuration('${clip.id}', Number(this.value)); drawCanvas();"
                        class="w-16 text-xs py-1 px-2 border border-surface-200 dark:border-surface-700 
                               rounded bg-surface-50 dark:bg-surface-900/80 text-surface-800 
                               dark:text-surface-200 font-bold">
                </div>
                <!-- Open Code Editor -->
                <button onclick="openHicEditor('${clip.id}')" 
                    class="w-full py-2 text-xs font-bold bg-violet-600 hover:bg-violet-500 
                           text-white rounded-lg transition-colors flex items-center justify-center gap-2">
                    <i data-lucide="code" class="w-3 h-3"></i> Open Code Editor
                </button>
            </div>
        </details>
    `;
}
```

#### Apply Preset Function

```javascript
window.applyHicPreset = function(clipId, presetKey) {
    const clip = State.clips.find(c => c.id === clipId);
    if (!clip || clip.type !== 'hic') return;
    
    const preset = HIC_PRESETS[presetKey];
    if (!preset) return;
    
    clip.html = preset.html;
    clip.css = preset.css;
    clip.js = preset.js;
    clip.presetId = presetKey;
    clip._hicSig = '';  // Force re-render
    
    // Clear renderer cache
    if (window._hicRenderer) window._hicRenderer.clearCache();
    
    updateSidebarPanel();
    drawCanvas();
};
```

---

### Phase 2.4: Code Editor Modal (2-3 days)

**Goal:** Full-featured code editor with CodeMirror, live preview, and apply/reset.

#### Modal Structure

```html
<div id="hicEditorModal" class="fixed inset-0 bg-surface-950/80 backdrop-blur-sm 
     z-[110] hidden flex-col p-3 sm:p-4 transition-all duration-300">
    <div class="bg-surface-900 rounded-xl shadow-2xl flex flex-col w-full max-w-6xl 
                h-[90dvh] m-auto border border-surface-700 overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-2.5 bg-surface-800 
                    border-b border-surface-700 shrink-0">
            <div class="flex items-center gap-2">
                <i data-lucide="sparkles" class="w-4 h-4 text-violet-400"></i>
                <span class="text-sm font-bold text-surface-200">HTML-in-Canvas Editor</span>
                <span id="hicEditorClipName" class="text-xs text-surface-400"></span>
            </div>
            <div class="flex items-center gap-2">
                <!-- Preset buttons -->
                <button onclick="hicEditorApplyPreset('googleClean')" 
                    class="px-2 py-1 text-[10px] font-bold bg-surface-700 hover:bg-surface-600 
                           rounded text-surface-300 transition-colors">Google</button>
                <button onclick="hicEditorApplyPreset('neoBrutal')" 
                    class="px-2 py-1 text-[10px] font-bold bg-surface-700 hover:bg-surface-600 
                           rounded text-surface-300 transition-colors">Neo-Brutal</button>
                <button onclick="hicEditorApplyPreset('iosGlass')" 
                    class="px-2 py-1 text-[10px] font-bold bg-surface-700 hover:bg-surface-600 
                           rounded text-surface-300 transition-colors">Glass</button>
                <button onclick="hicEditorApplyPreset('dataChart')" 
                    class="px-2 py-1 text-[10px] font-bold bg-surface-700 hover:bg-surface-600 
                           rounded text-surface-300 transition-colors">Chart</button>
                <div class="w-px h-5 bg-surface-600 mx-1"></div>
                <button onclick="closeHicEditor(false)" 
                    class="px-3 py-1.5 text-xs font-bold bg-surface-700 hover:bg-surface-600 
                           rounded text-surface-300 transition-colors">Cancel</button>
                <button onclick="closeHicEditor(true)" 
                    class="px-3 py-1.5 text-xs font-bold bg-violet-600 hover:bg-violet-500 
                           rounded text-white transition-colors">Apply</button>
            </div>
        </div>
        
        <!-- Content: Code + Preview split -->
        <div class="flex-1 flex overflow-hidden min-h-0">
            <!-- Code editors -->
            <div class="flex flex-col w-full sm:w-1/2 min-h-0 border-r border-surface-700">
                <div class="flex flex-col flex-1 min-h-0">
                    <label class="px-3 py-1.5 text-[10px] font-bold text-surface-400 
                                 uppercase tracking-widest bg-surface-800 border-b 
                                 border-surface-700 shrink-0">HTML</label>
                    <textarea id="hicHtmlEditor" class="flex-1 w-full p-3 text-sm font-mono 
                              bg-surface-800 text-surface-200 border-none resize-none 
                              focus:outline-none" spellcheck="false" 
                              placeholder="<div>Your HTML here</div>"></textarea>
                </div>
                <div class="flex flex-col flex-1 min-h-0 border-t border-surface-700">
                    <label class="px-3 py-1.5 text-[10px] font-bold text-surface-400 
                                 uppercase tracking-widest bg-surface-800 border-b 
                                 border-surface-700 shrink-0">CSS</label>
                    <textarea id="hicCssEditor" class="flex-1 w-full p-3 text-sm font-mono 
                              bg-surface-800 text-surface-200 border-none resize-none 
                              focus:outline-none" spellcheck="false" 
                              placeholder=".class { color: red; }"></textarea>
                </div>
                <div class="flex flex-col h-28 border-t border-surface-700 shrink-0">
                    <label class="px-3 py-1.5 text-[10px] font-bold text-surface-400 
                                 uppercase tracking-widest bg-surface-800 border-b 
                                 border-surface-700 shrink-0">
                        JavaScript <span class="text-surface-600">(onFrame)</span>
                    </label>
                    <textarea id="hicJsEditor" class="flex-1 w-full p-3 text-sm font-mono 
                              bg-surface-800 text-surface-200 border-none resize-none 
                              focus:outline-none" spellcheck="false" 
                              placeholder="function onFrame(time) { /* animate */ }"></textarea>
                </div>
            </div>
            
            <!-- Live preview -->
            <div class="flex flex-col w-full sm:w-1/2 min-h-0">
                <label class="px-3 py-1.5 text-[10px] font-bold text-surface-400 
                             uppercase tracking-widest bg-surface-800 border-b 
                             border-surface-700 shrink-0 flex items-center gap-2">
                    Preview
                    <span id="hicPreviewStatus" class="text-violet-400">●</span>
                </label>
                <div class="flex-1 bg-surface-950 flex items-center justify-center p-4 overflow-hidden">
                    <div id="hicPreviewScaler" class="relative">
                        <div id="hicPreviewWrap" class="bg-surface-900 rounded-lg overflow-hidden 
                              border border-surface-700 shadow-2xl" 
                             style="width:640px;height:360px;">
                            <div id="hicPreview" class="w-full h-full"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
```

#### CodeMirror Integration

```javascript
// Load CodeMirror via CDN
const cmScript = document.createElement('script');
cmScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js';
document.head.appendChild(cmScript);

const cmCss = document.createElement('link');
cmCss.rel = 'stylesheet';
cmCss.href = 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.css';
document.head.appendChild(cmCss);

// Initialize CodeMirror editors
let hicHtmlCM, hicCssCM, hicJsCM;

function initHicCodeMirror() {
    hicHtmlCM = CodeMirror.fromTextArea(
        document.getElementById('hicHtmlEditor'), 
        { mode: 'htmlmixed', lineNumbers: true, theme: 'material-darker' }
    );
    hicCssCM = CodeMirror.fromTextArea(
        document.getElementById('hicCssEditor'), 
        { mode: 'css', lineNumbers: true, theme: 'material-darker' }
    );
    hicJsCM = CodeMirror.fromTextArea(
        document.getElementById('hicJsEditor'), 
        { mode: 'javascript', lineNumbers: true, theme: 'material-darker' }
    );
    
    // Live preview on change
    [hicHtmlCM, hicCssCM, hicJsCM].forEach(cm => {
        cm.on('change', () => updateHicPreview());
    });
}
```

#### Open/Close Editor

```javascript
let _hicEditorClipId = null;

window.openHicEditor = function(clipId) {
    const clip = State.clips.find(c => c.id === clipId);
    if (!clip || clip.type !== 'hic') return;
    
    _hicEditorClipId = clipId;
    
    // Initialize CodeMirror if needed
    if (!hicHtmlCM) initHicCodeMirror();
    
    // Load clip content
    hicHtmlCM.setValue(clip.html || '');
    hicCssCM.setValue(clip.css || '');
    hicJsCM.setValue(clip.js || '');
    
    // Show clip name
    document.getElementById('hicEditorClipName').textContent = clip.title || 'HIC Clip';
    
    // Show modal
    const modal = document.getElementById('hicEditorModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    // Initial preview
    updateHicPreview();
};

window.closeHicEditor = function(apply) {
    if (apply && _hicEditorClipId) {
        const clip = State.clips.find(c => c.id === _hicEditorClipId);
        if (clip) {
            clip.html = hicHtmlCM.getValue();
            clip.css = hicCssCM.getValue();
            clip.js = hicJsCM.getValue();
            clip._hicSig = '';  // Force re-render
            if (window._hicRenderer) window._hicRenderer.clearCache();
            drawCanvas();
        }
    }
    
    _hicEditorClipId = null;
    const modal = document.getElementById('hicEditorModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};

// Escape key closes modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _hicEditorClipId) {
        closeHicEditor(false);
    }
});
```

#### Live Preview

```javascript
let _hicPreviewRenderer = null;

window.updateHicPreview = function() {
    const html = hicHtmlCM.getValue();
    const css = hicCssCM.getValue();
    const js = hicJsCM.getValue();
    const preview = document.getElementById('hicPreview');
    const status = document.getElementById('hicPreviewStatus');
    
    if (!html && !css) {
        preview.innerHTML = '<div class="flex items-center justify-center h-full text-surface-500 text-sm">Write HTML/CSS to preview</div>';
        status.textContent = '○';
        status.className = 'text-surface-500';
        return;
    }
    
    // Create/update renderer
    if (!_hicPreviewRenderer) {
        _hicPreviewRenderer = new HTMLCanvasRenderer(800, 450);
    }
    
    // Set clip and render
    _hicPreviewRenderer.setClip(html, css, js).then(() => {
        return _hicPreviewRenderer.renderFrame(0);
    }).then(() => {
        preview.innerHTML = '';
        const img = document.createElement('img');
        img.src = _hicPreviewRenderer.canvas.toDataURL();
        img.className = 'w-full h-full object-contain';
        preview.appendChild(img);
        status.textContent = '●';
        status.className = 'text-green-400';
    }).catch(err => {
        status.textContent = '●';
        status.className = 'text-red-400';
        console.error('[HIC Preview] Error:', err);
    });
};
```

---

### Phase 2.5: Preset Templates (1-2 days)

**Goal:** Import all 12 Phase 1 presets into the sidebar and editor.

#### Preset Definitions

```javascript
// index.html — HIC_PRESETS constant
const HIC_PRESETS = {
    googleClean: {
        name: 'Google Clean',
        dur: 4,
        html: `<div class="scene">
            <div class="kicker">ANNOUNCING</div>
            <h1 class="title">Think <span class="hl">different</span>.</h1>
            <p class="sub">Simple. Beautiful. Functional.</p>
            <div class="divider"></div>
        </div>`,
        css: `/* Full CSS from Phase 1 */`,
        js: `/* onFrame(time) animation */`
    },
    neoBrutal: {
        name: 'Neo-Brutal',
        dur: 5,
        html: `/* ... */`,
        css: `/* ... */`,
        js: `/* ... */`
    },
    // ... all 12 presets
};
```

#### Import from Phase 1

Copy presets from `src/html-in-canvas/presets/index.js` into `HIC_PRESETS` in `index.html`. The presets are already designed with `onFrame(time)` callbacks (no CSS @keyframes), so they work with SVG foreignObject.

---

### Phase 2.6: Timeline Rendering (1 day)

**Goal:** Show HIC clips on the timeline with proper colors and labels.

#### Timeline Clip Element

```javascript
// index.html — renderClips()
if (clip.type === 'hic') {
    clipEl.style.backgroundColor = '#7c3aed';  // Violet for HIC clips
    clipEl.querySelector('.clip-label').textContent = clip.title || 'HIC Clip';
    
    // Add sparkle icon
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'sparkles');
    icon.className = 'w-3 h-3 text-violet-200';
    clipEl.querySelector('.clip-label').prepend(icon);
}
```

#### Timeline Color

```javascript
// PALETTES array — add violet for HIC
PALETTES.push({ bg: '#7c3aed', border: '#6d28d9', text: '#ffffff' });  // Violet
```

---

### Phase 2.7: Export Integration (2-3 days)

**Goal:** Export HIC clips to video using MediaBunny or FTRT.

#### Export Flow

```
User clicks Export
  → startExport() begins frame loop
  → For each frame:
      1. State.currentTime = frame / fps
      2. drawCanvas() called
      3. HIC clips: renderer.renderFrame(time) → ctx.drawImage()
      4. All clips composited to final frame
      5. Frame captured to video stream
  → Video encoded and downloaded
```

#### MediaBunny Export (Primary)

```javascript
// In drawCanvas() HIC rendering path — capture canvas stream
if (State.isExporting && clip.type === 'hic') {
    // Render frame at export time
    await renderer.renderFrame(clipTime * 1000);
    ctx.drawImage(renderer.canvas, -w/2, -h/2, w, h);
}
```

This works because `drawCanvas()` is called for every frame during export, and the SVG foreignObject renderer is fast enough (5-15ms/frame).

#### FTRT Export (Alternative)

```javascript
// FTRT uses the same drawCanvas() path
// Just different encoding (WebCodecs vs MediaRecorder)
window.startFTRTExport(exportW, exportH, fps, startTime, endTime, format);
```

#### Why No CDP Export

| Reason | Impact |
|--------|--------|
| CDP export caused PC hangs/black screens | Critical — breaks user workflow |
| MediaBunny already handles HIC clips | CDP export is redundant |
| Adds complexity for no benefit | Maintenance burden |
| HIC clips render in 5-15ms/frame | Fast enough for real-time export |

---

## 4. File Structure

```
studio-pro-editor/
├── src/
│   └── html-in-canvas/
│       ├── renderer.js          # Core SVG foreignObject engine (EXISTS)
│       ├── preload.js           # Font + image preloading (EXISTS)
│       ├── adapters/
│       │   └── waapi.js         # CSS Animation → onFrame() (EXISTS)
│       └── presets/
│           └── index.js         # Preset definitions (EXISTS)
│
├── docs/
│   └── html-in-canvas/
│       ├── PLAN.md              # Phase 1 plan (EXISTS)
│       ├── PHASE-2-PLAN.md      # This file (UPDATED)
│       └── test-renderer.html   # Interactive test site (EXISTS)
│
└── index.html                   # Main editor — MODIFIED
    ├── Toolbar: add HIC button
    ├── drawCanvas(): add HIC rendering path
    ├── Sidebar: add HIC panel
    ├── Modal: add HIC code editor
    └── Timeline: add HIC clip rendering
```

---

## 5. What Changes in index.html

| Section | Line Range | Change |
|---------|-----------|--------|
| Toolbar | ~1171 | Add HIC button (`btnAddHic`) |
| HIC_PRESETS | ~2238 | Add preset definitions (12 presets) |
| drawCanvas() filter | ~5450 | Add `'hic'` to activeVisualClips filter |
| drawCanvas() render | ~6316 | Add `clip.type === 'hic'` rendering case |
| Sidebar panel | ~10519 | Add HIC panel HTML |
| Code editor modal | ~121 | Add HIC editor modal HTML |
| addHicClipToTimeline | ~24504 | Add function |
| openHicEditor | ~24240 | Add function |
| Timeline render | ~20000 | Add HIC clip color/icon |

**Total estimated changes:** ~500-800 lines in index.html

---

## 6. Feasibility Assessment

### What's Already Done (Phase 1 ✅)

- [x] SVG foreignObject renderer (`src/html-in-canvas/renderer.js`)
- [x] Font/image preloading (`src/html-in-canvas/preload.js`)
- [x] WAAPI adapter (`src/html-in-canvas/adapters/waapi.js`)
- [x] 12 animated presets with `onFrame(time)` callbacks
- [x] Interactive test site with CodeMirror, export, resolution selector

### What Needs Building (Phase 2)

| Task | Difficulty | Days |
|------|-----------|------|
| Add `hic` type to State + drawCanvas | Medium | 1-2 |
| Canvas preview with playhead seeking | Medium | 2-3 |
| Sidebar panel with preset browser | Easy | 1 |
| Code editor modal with CodeMirror | Medium | 2-3 |
| Import 12 presets into HIC_PRESETS | Easy | 0.5 |
| Timeline clip rendering (color, icon) | Easy | 0.5 |
| Export integration (MediaBunny/FTRT) | Medium | 1-2 |
| Testing + bug fixes | Medium | 1-2 |
| **Total** | | **9-14 days** |

### Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| SVG foreignObject slow in drawCanvas | High | Cache rendered frames, only re-render when clip changes |
| CodeMirror CDN fails to load | Medium | Fallback to plain textarea |
| Export frame drops | Medium | Pre-render all frames before export starts |
| Preset animations not deterministic | Low | All use `onFrame(time)`, no CSS @keyframes |

---

## 7. Success Criteria

- [ ] User can click "HIC" button → clip appears on timeline
- [ ] User can select HIC clip → sidebar shows preset browser + code editor button
- [ ] User can click preset → clip updates with new HTML/CSS/JS
- [ ] User can open code editor → CodeMirror with live preview
- [ ] User can edit code → preview updates in real-time
- [ ] User can apply changes → canvas preview updates
- [ ] HIC clips render correctly in canvas preview (SVG foreignObject)
- [ ] **Playhead seeking works** — moving playhead shows correct animation frame
- [ ] HIC clips export to video (MediaBunny captureStream)
- [ ] HIC clips export to video (FTRT WebCodecs)
- [ ] All 12 presets render and animate correctly
- [ ] No console errors during preview or export

---

## 8. Future Phases

### Phase 3: Advanced Features
- Drag-and-drop preset browser (grid layout)
- Preset categories (Motion, Premium, Text, Data, UI, Code)
- Custom preset saving/loading
- Animation timeline scrubber in editor

### Phase 4: AI Integration
- AI generates HIC presets from prompts
- Natural language → HTML/CSS/JS conversion
- Style transfer between presets

### Phase 5: Performance Optimization
- WebWorker rendering (off-main-thread)
- Canvas OffscreenCanvas for parallel rendering
- Frame caching with LRU eviction
