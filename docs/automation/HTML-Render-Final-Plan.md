# HTML Clip Rendering — Final Unified Plan

## The Three-Layer Model (Organizing Principle)

The cleanest way to understand this problem: **three separate layers**, each with its own solution.

```
┌─────────────────────────────────────────────────┐
│  LAYER 3: MARKUP (How AI writes graphics)       │
│  HyperFrames data-attributes + CSS keyframes    │
├─────────────────────────────────────────────────┤
│  LAYER 2: TIME CONTROL (How editor scrubs)      │
│  WAAPI — native browser seekToFrame()           │
├─────────────────────────────────────────────────┤
│  LAYER 1: FRAME CAPTURE (DOM → pixels → MP4)    │
│  html-to-image + Mediabunny WebCodecs           │
└─────────────────────────────────────────────────┘
```

| Layer | What It Does | Solution | Performance |
|---|---|---|---|
| **Markup** | How AI generates animation code | Declarative `data-*` attributes + CSS keyframes | 0ms (parse on load) |
| **Time Control** | How editor scrubs to any frame | WAAPI `anim.pause()` + `anim.currentTime = ms` | **0ms native GPU** |
| **Frame Capture** | How DOM becomes video pixels | html-to-image SVG foreignObject → canvas → WebCodecs | ~5-15ms per frame |

**Key insight: These layers are independent.** You can swap any layer without changing the others.

---

## Four Plans Analyzed

| Plan | Source | Core Idea |
|---|---|---|
| **Plan A** | Buffy (original) | Replace html2canvas with strategy pattern (drawElementImage, html-to-image, Puppeteer) |
| **Plan B** | Gemini analysis | 3 options: SVG foreignObject, Agent-native output, Capture stream |
| **Plan C** | HyperFrames-inspired | Declarative HTML + Universal Frame Adapter + Dual-tier rendering + Web Workers |
| **Plan D** | Three-Layer Model | Clean separation: Markup + Time Control + Frame Capture |

---

## Unique Strengths of Each Plan

### Plan A (Original) — Strengths
- **Strategy pattern architecture** — clean engine that swaps render backends
- **drawElementImage** identified as the Chrome native endgame
- **Puppeteer screenshot** for pixel-perfect export
- **Practical implementation phases** with file structures

### Plan B (Gemini) — Strengths
- **SVG foreignObject** as zero-dependency html2canvas replacement (~15 lines)
- **Agent-native rendering** — agents output SVG/Canvas2D instead of HTML (eliminates conversion entirely)
- **Capture stream** — `MediaStreamTrackProcessor` → `VideoFrame` → WebCodecs (bypasses canvas)
- **Simplest possible code** for immediate wins

### Plan C (HyperFrames-inspired) — Strengths ⭐ MOST COMPLETE
- **`seekToFrame(frame)` Universal Adapter** — seeks ALL animation types (WAAPI, GSAP, CSS, Lottie) with one call
- **Declarative `data-*` attributes** — standardized HTML syntax for AI agents (`data-start`, `data-duration`, `data-adapter`)
- **Dual-tier rendering** — Live DOM overlay for preview (60 FPS native GPU), WebCodecs for export
- **Web Worker off-thread rendering** — OffscreenCanvas + resvg-wasm, main thread stays responsive
- **Zero Headless Chrome** — 100% client-side export via WebCodecs/Mediabunny
- **`data-adapter` selector** — tells the system which runtime drives each element

### Plan D (Three-Layer Model) — Strengths ⭐ CLEANEST MENTAL MODEL
- **Identifies WAAPI as the native solution** — no custom adapter needed, browser already has `getAnimations()` + `anim.seekToFrame()`
- **Correctly separates concerns** — Markup, Time Control, and Frame Capture are independent layers
- **Simplifies the adapter** — WAAPI alone handles CSS keyframes deterministically (no need for GSAP/Lottie detection in Phase 1)
- **Clarifies the AI ergonomics** — agents just write standard CSS keyframes + `data-*` attributes, no custom `animate(t)` function needed
- **Shows that html-to-image is the right capture layer** — not html2canvas, not Puppeteer, not drawElementImage

---

## Head-to-Head: The Critical Differences

### 1. Animation Seeking

| Plan | How seeking works | Limitation |
|---|---|---|
| **A** | `setClipTime(t)` calls custom `animate(t)` function | Only works with custom animate function |
| **B** | Same as A (no new seeking mechanism) | Same limitation |
| **C** | `seekToFrame(frame)` sweeps DOM, seeks WAAPI + GSAP + CSS + Lottie | ✅ **Works with ANY animation framework** |

**Winner: Plan C.** The `seekToFrame` adapter is the killer feature. Currently our clips require agents to write a custom `animate(t)` function. Plan C's adapter would make ANY animation library work deterministically:

```javascript
// Plan C's Universal Adapter — seeks everything
class HyperAdapterEngine {
  seekToFrame(frame) {
    const currentTime = (frame / this.fps) * 1000;

    // 1. Seek WAAPI & CSS Animations (native browser animations)
    this.root.getAnimations({ subtree: true }).forEach(anim => {
      anim.pause();
      anim.currentTime = currentTime;
    });

    // 2. Seek GSAP Timelines (if present)
    if (window.gsapTimeline) {
      window.gsapTimeline.pause();
      window.gsapTimeline.seek(currentTime / 1000);
    }

    // 3. Update CSS Variables for custom keyframe rules
    this.root.style.setProperty('--frame', frame);
    this.root.style.setProperty('--progress', (currentTime / 1000).toFixed(4));
  }
}
```

### 2. Preview Rendering

| Plan | Preview method | FPS | Overhead |
|---|---|---|---|
| **A** | html2canvas / html-to-image capture | ~2-5 FPS | High (async capture per frame) |
| **B** | SVG foreignObject capture | ~5-15 FPS | Medium (async Blob URL load) |
| **C** | **Live DOM overlay** (un-rasterized) | **60 FPS native** | **Zero** (GPU composited) |

**Winner: Plan C.** The dual-tier approach is brilliant:
- **Preview:** Keep the HTML element as a **live DOM layer** stacked directly over the canvas. The browser's GPU compositor renders it at native 60 FPS. No capture, no serialization, no canvas.
- **Export:** Only when exporting do you serialize frames via Web Worker + OffscreenCanvas.

```
Plan A/B (current):
  DOM → html2canvas/SVG → Canvas → Display (every frame, slow)

Plan C:
  Preview: DOM → GPU compositor → Display (instant, 60 FPS)
  Export:  DOM → seekToFrame → OffscreenCanvas → WebCodecs → MP4
```

### 3. Export Pipeline

| Plan | Export method | Dependencies | Speed |
|---|---|---|---|
| **A** | Puppeteer screenshot per frame | Headless Chrome + Node.js | ~50-100ms/frame |
| **B** | MediaStreamTrackProcessor → VideoFrame | Browser only | Real-time |
| **C** | Web Worker + OffscreenCanvas → WebCodecs/Mediabunny | Browser only | **Off-thread, fast** |

**Winner: Plan C (with Plan B's capture stream as alternative).** Plan C's Web Worker approach keeps the main thread responsive during export. Plan B's capture stream is simpler but requires live playback.

### 4. AI Agent Ergonomics

| Plan | Agent output format | Flexibility |
|---|---|---|
| **A** | HTML/CSS/JS with custom `animate(t)` | Limited to custom function |
| **B** | SVG strings or Canvas2D code | Eliminates HTML entirely |
| **C** | Declarative HTML + `data-*` attributes | ✅ **Works with any animation library** |

**Winner: Plan C.** The declarative syntax is the cleanest API for AI agents:

```html
<!-- Plan C's declarative syntax — agents write this -->
<div class="slide" data-start="0s" data-duration="5s" data-adapter="waapi">
  <h1 class="title" data-animate="fade-in" data-delay="0.2s">India Pollution</h1>
  <div class="chart" data-animate="grow-bars" data-delay="0.5s">
    <!-- bar chart elements -->
  </div>
</div>

<!-- The adapter engine auto-discovers and seeks all animations -->
<!-- Agent doesn't need to write animate(t) — just use CSS/WAAPI/GSAP -->
```

vs. current approach:
```html
<!-- Current — agent must write custom animate(t) function -->
<div class="slide">
  <h1 id="title">India Pollution</h1>
</div>
<script>
function animate(t) {
  // Agent must manually implement ALL animation logic
  document.getElementById('title').style.opacity = Math.min(1, t / 0.5);
  // ... hundreds of lines for complex animations
}
</script>
```

### 5. Dependencies & Complexity

| Plan | External deps | Browser APIs used |
|---|---|---|
| **A** | html-to-image (12KB) or drawElementImage (flag) | Canvas 2D, Image, Blob |
| **B** | None | SVG foreignObject, Blob URL, Image |
| **C** | None (or resvg-wasm for Web Worker) | Web Animations API, OffscreenCanvas, WebCodecs, Web Workers |

---

## The Three-Layer Architecture (Final)

Taking the best from all four plans, organized by the Three-Layer Model:

```
┌──────────────────────────────────────────────────────────────────┐
│  LAYER 3: MARKUP — How AI writes graphics                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Declarative HTML + data-* attributes (Plan C + D)               │
│  <div data-start="0s" data-duration="5s">                       │
│    <h1 data-animate="fade-in" data-delay="0.2s">Title</h1>     │
│    <div class="chart" data-animate="grow">...</div>            │
│  </div>                                                           │
│                                                                   │
│  + Standard CSS keyframes (Plan D — agents don't need animate()) │
│  + Backward compat: custom animate(t) function (Plan C)          │
│  + Canvas2D code for max performance (Plan B)                    │
│                                                                   │
├──────────────────────────────────────────────────────────────────┤
│  LAYER 2: TIME CONTROL — How editor scrubs to any frame          │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  WAAPI — native browser mechanism (Plan D)                       │
│  animations.forEach(a => { a.pause(); a.currentTime = ms; })     │
│                                                                   │
│  + CSS variables --frame, --progress (Plan C)                    │
│  + GSAP timeline.seek() if present (Plan C)                      │
│  + Lottie goToFrame() if present (Plan C)                        │
│  + Custom animate(t) backward compat (Plan C)                    │
│                                                                   │
│  PREVIEW: Live DOM overlay → GPU compositor → 60 FPS (Plan C)   │
│  (No capture needed — browser renders natively)                  │
│                                                                   │
├──────────────────────────────────────────────────────────────────┤
│  LAYER 1: FRAME CAPTURE — DOM → pixels → MP4                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  EXPORT MODE (choose one):                                       │
│                                                                   │
│  html-to-image SVG foreignObject (Plan B + D) ← RECOMMENDED     │
│    ~5-15ms, zero deps, 95% fidelity                              │
│                                                                   │
│  OR: Web Worker + OffscreenCanvas (Plan C)                       │
│    Off-thread, responsive export                                  │
│                                                                   │
│  OR: drawElementImage (Plan A)                                    │
│    ~1ms sync, 100% fidelity, Chrome flag required                │
│                                                                   │
│  OR: Puppeteer screenshot (Plan A)                                │
│    ~50-100ms, 100% fidelity, headless Chrome required            │
│                                                                   │
│  → WebCodecs/Mediabunny encoder → MP4                            │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Folder Structure (Final)

```
studio-pro-editor/
├── index.html
├── automation/
│   ├── render.js                              # MD-to-video
│   ├── config.json
│   ├── output/
│   ├── code-to-video/
│   │   ├── api.js
│   │   ├── render.js
│   │   ├── examples/
│   │   │   ├── india-pollution.js             # v1 static
│   │   │   └── india-pollution-v2.js          # v2 animated
│   │   ├── skills/
│   │   └── output/
│   └── html-render/                           # ⭐ NEW
│       ├── engine.js                          # Core render engine
│       ├── adapter.js                         # ⭐ Universal Frame Adapter
│       ├── strategies/
│       │   ├── live-dom.js                    # Preview: GPU overlay
│       │   ├── svg-foreignobject.js           # Export: SVG capture
│       │   ├── draw-element.js                # Export: Chrome native
│       │   ├── web-worker.js                  # Export: OffscreenCanvas
│       │   ├── puppeteer-screenshot.js        # Export: Headless Chrome
│       │   └── html2canvas-fallback.js        # Legacy fallback
│       ├── cache.js                           # Frame cache
│       ├── preload.js                         # Pre-render clips
│       └── README.md
├── lib/
│   ├── hyper-adapter.js                       # ⭐ Universal Frame Adapter
│   ├── svg-renderer.js                        # SVG foreignObject engine
│   ├── html2canvas.min.js                     # Legacy
│   └── ...
├── docs/
│   └── automation/
│       ├── HTML-Render-Architecture-Plan.md   # Plan A
│       ├── HTML-Render-Comparison.md          # Plan A vs B
│       ├── HTML-Render-Final-Plan.md          # This file (A vs B vs C)
│       ├── Fix-Roadmap.md
│       └── clipTime-passthrough-plan.md
└── ...
```

---

## Implementation Phases (Final — Three-Layer Model)

### LAYER 2: Time Control (Do First)

#### Phase 1: WAAPI Seek Engine (1-2 days) ⭐ FOUNDATION
From Plan D. Use the browser's native Web Animations API — no custom adapter needed for CSS keyframes.

```javascript
// Layer 2: WAAPI Time Control — native browser mechanism
function seekHtmlClipToFrame(clip, frame, fps = 30) {
    const ms = (frame / fps) * 1000;
    const iframe = clip._htmlIframe;
    if (!iframe?.contentDocument) return;

    // WAAPI: seek ALL CSS keyframe animations natively
    const animations = iframe.contentDocument.getAnimations({ subtree: true });
    animations.forEach(anim => {
        anim.pause();
        anim.currentTime = ms;
    });

    // CSS variables for custom rules
    iframe.contentDocument.documentElement.style.setProperty('--frame', frame);
    iframe.contentDocument.documentElement.style.setProperty('--progress', (ms / 1000).toFixed(4));

    // Backward compat: custom animate(t)
    if (typeof iframe.contentWindow?.animate === 'function') {
        iframe.contentWindow.animate(ms / 1000);
    }
}
```

**What this solves:** Agents write standard CSS `@keyframes` — the browser's WAAPI seeks them deterministically. No custom `animate(t)` function needed for basic animations.

#### Phase 2: Extended Adapter (GSAP, Lottie) (1-2 days)
From Plan C. Add support for animation libraries beyond WAAPI.

```javascript
// Phase 2: Extended adapters
function seekExtended(iframe, ms) {
    // GSAP
    if (iframe.contentWindow?.gsapTimeline) {
        iframe.contentWindow.gsapTimeline.pause();
        iframe.contentWindow.gsapTimeline.seek(ms / 1000);
    }
    // Lottie
    if (iframe.contentWindow?.lottiePlayer) {
        iframe.contentWindow.lottiePlayer.goToFrame(Math.round(ms / 1000 * 30));
    }
}
```

### LAYER 3: Markup (Do Second)

#### Phase 3: Agent Declarative API (2-3 days)
From Plan C + D. Standardized HTML syntax for AI agents.

```html
<!-- Agent writes declarative HTML — no animate(t) needed -->
<div class="slide" data-duration="5s">
  <h1 data-animate="fade-in" data-delay="0.2s">Title</h1>
  <div class="chart" data-animate="grow" data-delay="0.5s">...</div>
  <style>
    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
    [data-animate="fade-in"] { animation: fade-in 0.5s ease forwards; }
  </style>
</div>
```

**What the agent writes:** Standard CSS keyframes + `data-animate` attributes.
**What the adapter does:** WAAPI seeks the CSS keyframes deterministically.
**Result:** Agent doesn't need to understand animation timing — just CSS.

### LAYER 1: Frame Capture (Do Third)

#### Phase 4: SVG foreignObject Export (1-2 days)
From Plan B + D. Zero-dependency export capture.

```javascript
// Layer 1: Frame Capture — DOM → pixels
async function captureHtmlFrame(clip, width, height) {
    const body = clip._htmlIframe.contentDocument.body.innerHTML;
    const styles = Array.from(clip._htmlIframe.contentDocument.querySelectorAll('style'))
        .map(s => s.textContent).join('\n');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml"><style>${styles}</style>${body}</div>
        </foreignObject>
    </svg>`;

    const img = new Image();
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    return new Promise(resolve => {
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            resolve(canvas);
        };
        img.src = url;
    });
}
```

#### Phase 5: Live DOM Preview (2-3 days)
From Plan C. Replace html2canvas capture with live DOM overlay.

```
Current: iframe → html2canvas (async, 500ms) → canvas.drawImage()
New:     iframe → live DOM layer over canvas → GPU renders natively (0ms)
```

#### Phase 6: Web Worker Export Pipeline (3-5 days)
From Plan C. Off-thread rendering for responsive export.

```
Main Thread:  seekToFrame(N) → serialize DOM → postMessage to Worker
Web Worker:   OffscreenCanvas → pixel array → postMessage back
Main Thread:  VideoEncoder.encode(pixels) → WebCodecs → MP4
```

#### Phase 7: drawElementImage Upgrade (2-3 days)
From Plan A. Chrome native when flag is available.

### Integration

#### Phase 8: Integration & Testing (2-3 days)

---

## Timeline Summary

| Phase | Layer | What | Source | Days |
|---|---|---|---|---|
| 1 | Time Control | WAAPI Seek Engine | Plan D | 1-2 |
| 2 | Time Control | Extended Adapter (GSAP, Lottie) | Plan C | 1-2 |
| 3 | Markup | Agent Declarative API | Plan C+D | 2-3 |
| 4 | Frame Capture | SVG foreignObject Export | Plan B+D | 1-2 |
| 5 | Frame Capture | Live DOM Preview | Plan C | 2-3 |
| 6 | Frame Capture | Web Worker Pipeline | Plan C | 3-5 |
| 7 | Frame Capture | drawElementImage Upgrade | Plan A | 2-3 |
| 8 | All | Integration & Testing | All | 2-3 |
| **Total** | | | | **13-23 days** |

---

## What Each Plan Contributed

| Contribution | Source | Impact |
|---|---|---|
| **Strategy pattern render engine** | Plan A | Architecture foundation |
| **drawElementImage as endgame** | Plan A | Future-proofing |
| **SVG foreignObject (zero deps)** | Plan B | Quick win, replaces html2canvas |
| **Agent-native SVG/Canvas2D output** | Plan B | Eliminates HTML→Canvas conversion |
| **Capture stream → VideoFrame** | Plan B | Best export pipeline |
| **Universal Frame Adapter (seekToFrame)** | Plan C | Works with any animation library |
| **Declarative data-* attributes** | Plan C | Cleanest AI agent API |
| **Dual-tier rendering (preview + export)** | Plan C | Best UX (60 FPS preview) |
| **Web Worker off-thread rendering** | Plan C | Responsive export |
| **Zero Headless Chrome** | Plan C | 100% client-side export |
| **Three-Layer Model** | Plan D | ⭐ **Clearest mental model** — separates Markup, Time Control, Frame Capture |
| **WAAPI as native time control** | Plan D | ⭐ **Simplifies Phase 1** — no custom adapter needed for CSS keyframes |
| **Correct layer ordering** | Plan D | Do Time Control first → Markup second → Capture third |

---

## Final Recommendation

**Follow the Three-Layer Model ordering:**

### 1. Time Control FIRST (Phase 1-2)
WAAPI is the browser's native mechanism. Agents write standard CSS `@keyframes`, the editor seeks them with `anim.pause()` + `anim.currentTime = ms`. This is the foundation — without deterministic seeking, nothing else works.

### 2. Markup SECOND (Phase 3)
Declarative `data-*` attributes + CSS keyframes. Agents don't need to write `animate(t)` — just standard CSS. The WAAPI adapter handles the rest.

### 3. Frame Capture THIRD (Phase 4-7)
SVG foreignObject for quick export win. Live DOM overlay for 60 FPS preview. Web Worker for responsive export. drawElementImage for Chrome native upgrade.

**The key insight across all four plans:** The problem has three independent layers. Solve them in order:
1. **Time Control** — WAAPI makes animations seekable (0ms, native GPU)
2. **Markup** — Declarative HTML makes AI generation reliable (0ms, parse on load)
3. **Frame Capture** — html-to-image makes export fast (~5-15ms per frame)

Each layer can be swapped independently. Start with WAAPI (it's already in the browser), add declarative markup (agents write CSS), then upgrade frame capture (SVG foreignObject replaces html2canvas).
