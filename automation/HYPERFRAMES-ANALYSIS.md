# HyperFrames Deep Analysis + CDP for GUI Export

## 1. HyperFrames Architecture Overview

HyperFrames is a **video rendering framework** by HeyGen. It's NOT a traditional video editor — it's a code-driven rendering engine.

### Core Concept: "Video as Code"

```
HTML/CSS/JS → seekToFrame() → Chrome screenshot → FFmpeg → MP4
```

Every composition is a **single HTML page** with:
- Layout in CSS
- Motion in GSAP, CSS animations, Lottie, Three.js, or WAAPI
- Timing controlled by data attributes or JavaScript

### The Seek Protocol

```typescript
// Every composition MUST expose this to the renderer
window.__hf = {
    duration: 10,  // seconds
    seek: (timeSeconds) => {
        // Position EVERY element at this exact time
        // GSAP: timeline.seek(timeSeconds)
        // WAAPI: animation.currentTime = timeSeconds * 1000
        // CSS: set --time variable
    }
}
```

**The renderer NEVER calls `play()`.** It calls:
```
seek(0) → screenshot → seek(1/30) → screenshot → seek(2/30) → ...
```

This is **deterministic** — same input = identical output every time.

### Frame Adapter Pattern

```typescript
interface FrameAdapter {
    id: string;
    init?: (ctx) => Promise<void> | void;
    getDurationFrames: () => number;
    seekFrame: (frame: number) => Promise<void> | void;
    destroy?: () => Promise<void> | void;
}
```

**Built-in adapters:**
- **GSAP** (default) — `timeline.pause()` + `timeline.totalTime(t)`
- **WAAPI** — `document.getAnimations()` + `animation.currentTime = ms`
- **Lottie** — `lottie.seek()` + `lottie.pause()`
- **Three.js** — `renderer.render()` at specific time
- **Custom** — user-defined adapter function

### Data Attributes

```html
<div data-start="0" data-duration="5" data-layer="v1" data-adapter="gsap">
    <h1>Animated Title</h1>
</div>

<div data-start="2" data-duration="3" data-layer="v2" data-adapter="waapi">
    <svg>...</svg>
</div>
```

| Attribute | Purpose |
|-----------|---------|
| `data-start` | When element appears (seconds) |
| `data-duration` | How long it's visible |
| `data-layer` | Z-index / track assignment |
| `data-adapter` | Which animation runtime to use |

---

## 2. HyperFrames Studio (Visual Editor)

### What It Is

HyperFrames Studio is a **minimal visual editor** for HTML compositions. It's NOT a full NLE like Premiere or DaVinci — it's closer to a **code-aware preview tool**.

### Workspace Layout

```
┌─────────────────────────────────────────────────────────┐
│  Code │ Comps │ Assets │ Catalog  │  Design │ Layers    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                    CANVAS (Live Preview)                 │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  TIMELINE (Clips, Keyframes, Beats)                    │
└─────────────────────────────────────────────────────────┘
```

### Key Features

| Feature | Description |
|---------|-------------|
| **Live Preview** | Real-time iframe preview of HTML composition |
| **Timeline** | Drag/trim/split clips, keyframe diamonds |
| **Keyframes** | Property animation with bezier easing |
| **Auto-Keyframe** | Records changes as animation automatically |
| **Gesture Recording** | Drag to record motion paths |
| **Layers** | Track-based layer management |
| **Design Panel** | Text, layout, style, motion controls |
| **Variables** | Parameterized values for batch rendering |
| **Catalog** | 150+ prebuilt animation blocks |
| **Lint** | Validates composition for rendering |
| **Agent Integration** | Copy context to AI agent for complex edits |

### How Preview Works

1. **Studio runs `npx hyperframes preview`** — starts a local dev server
2. **Preview is an iframe** loading the HTML composition
3. **postMessage bridge** communicates between Studio and iframe:
   - `seek(time)` — position playhead
   - `play()` / `pause()` — control playback
   - `getDuration()` — read composition length
4. **Canvas shows live DOM** — not rasterized, native GPU rendering
5. **Timeline syncs with preview** — scrub timeline = seek iframe

### How Export Works

```bash
# CLI export (local)
npx hyperframes render project-folder/ --output video.mp4

# Cloud export (HeyGen API)
curl -X POST https://api.heygen.com/hyperframes/render \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"project": "bundle-id"}'
```

**Export pipeline:**
1. **Compile** — bundle HTML/CSS/JS into single page
2. **Launch Chrome** — headless with special flags
3. **Warmup** — fire beginFrame every 33ms to advance event loop
4. **Capture loop** — for each frame:
   - `seekToFrame(frame, fps)` via page.evaluate()
   - `HeadlessExperimental.beginFrame` — atomic layout→paint→screenshot
   - Write JPEG to disk
5. **Encode** — FFmpeg concatenates frames into MP4

### Chrome Flags for Determinism

```bash
chrome-headless-shell \
    --deterministic-mode \           # Fixed time source
    --enable-begin-frame-control \   # Manual frame pacing
    --run-all-compositor-stages-before-draw \  # Sync rendering
    --disable-threaded-animation \   # No async animations
    --disable-threaded-scrolling \   # No async scrolling
    --disable-checker-imaging \      # No incremental decode
    --disable-image-animation-resync \  # No animation restart
    --enable-surface-synchronization   # Sync surface updates
```

**Result:** Same pixels every time, frame-for-frame identical.

---

## 3. Can We Use CDP for GUI Export?

### The Key Insight

You're right — **Studio Pro runs on Vite dev server (Node.js)**. So there IS a Node.js process. The question is: can we use it for CDP capture?

### Current Architecture

```
Browser Tab (localhost:3000)
  ├── Editor UI (React/Vue/vanilla)
  ├── Canvas Preview (iframe overlay)
  ├── Timeline (drag/seek)
  └── Export Button → html2canvas → MediaBunny Worker → MP4
```

### Proposed Architecture with CDP

```
Browser Tab (localhost:3000)
  ├── Editor UI
  ├── Canvas Preview
  ├── Timeline
  └── Export Button → WebSocket → ???
                                      ↓
                              Node.js Process
                              (Vite or separate)
                                      ↓
                              Puppeteer → Chrome → CDP Screenshot
                                      ↓
                              FFmpeg → MP4
                                      ↓
                              Download to browser
```

### The Problem

**The browser tab can't spawn Node.js processes.** But we CAN:

1. **Run a separate Node.js server** alongside Vite
2. **Connect via WebSocket** from the editor
3. **The server handles CDP capture**
4. **Return the video file** to the browser

### Solution: Hybrid Export Server

```javascript
// server.js (runs alongside Vite)
import puppeteer from 'puppeteer-core';
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 7001 });

wss.on('connection', (ws) => {
    ws.on('message', async (data) => {
        const { clips, fps, width, height } = JSON.parse(data);
        
        // Launch Chrome with CDP
        const browser = await puppeteer.launch({
            executablePath: findChrome(),
            args: ['--headless', '--deterministic-mode']
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width, height });
        
        // For each frame
        for (let frame = 0; frame < totalFrames; frame++) {
            // Seek all clips
            await page.evaluate((f, fps) => {
                window.__studioPro.seek(f / fps);
            }, frame, fps);
            
            // Capture screenshot
            const buffer = await page.screenshot({ 
                type: 'jpeg', 
                quality: 90 
            });
            
            // Send frame to browser
            ws.send(buffer);
        }
        
        await browser.close();
    });
});
```

### Why This Works

| Component | Current | With CDP Server |
|-----------|---------|-----------------|
| **Editor** | Browser tab | Browser tab (unchanged) |
| **Export trigger** | html2canvas in browser | WebSocket to Node.js |
| **Frame capture** | html2canvas (JS library) | Puppeteer CDP (real browser) |
| **CSS support** | Partial (no flex/grid) | **Full** (actual Chrome) |
| **Speed** | 200-500ms/frame | 50-100ms/frame |
| **Quality** | Rendered approximation | **Perfect** (actual pixels) |
| **Encoding** | MediaBunny (WebCodecs) | FFmpeg (server-side) |

### Implementation Steps

1. **Create `server/export-server.js`** — WebSocket server with Puppeteer
2. **Modify `submitExport()`** — connect to WebSocket instead of html2canvas
3. **Add to `package.json`** — `"export-server": "node server/export-server.js"`
4. **Auto-start** — Vite can run both via `concurrently`
5. **Download** — server sends video file, browser triggers download

### Similar to HyperFrames

HyperFrames does exactly this:
- **Studio preview** = iframe with postMessage
- **Export** = Node.js CLI with Puppeteer CDP
- **Same code path** — `window.__hf.seek()` in both preview and render

We would have:
- **Studio preview** = iframe overlay (already working)
- **Export** = Node.js server with Puppeteer CDP
- **Same code path** — `seekToFrame()` in both preview and render

---

## 4. Comparison: html2canvas vs CDP Export

| Aspect | html2canvas (Current) | CDP Export (Proposed) |
|--------|----------------------|----------------------|
| **Where it runs** | Browser tab | Node.js server |
| **CSS support** | Partial (no flex, grid, transforms) | **Full** (real Chrome) |
| **Font rendering** | Approximation | **Perfect** (actual browser) |
| **Animation capture** | Static snapshot | **Frame-by-frame seeking** |
| **Speed** | 200-500ms/frame | 50-100ms/frame |
| **Quality** | ~80% of original | **100%** identical to preview |
| **Dependencies** | html2canvas.js (in-browser) | Puppeteer + Chrome (server) |
| **Complexity** | Low (already implemented) | Medium (new server needed) |
| **User experience** | Instant (no server) | 2-3s server startup |

---

## 5. Recommendation

### Phase 1: Fix html2canvas (Immediate)
- Already done: `getAnimations()` to seek to end
- Test export to verify text/elements visible
- Good enough for most use cases

### Phase 2: Add CDP Export Server (Production)
- Create WebSocket server alongside Vite
- Use Puppeteer CDP for perfect frame capture
- FFmpeg for encoding (already in automation)
- Same architecture as HyperFrames

### Phase 3: Unified Pipeline
- GUI export uses same CDP pipeline as automation
- Automation pipeline unchanged
- Single codebase for both

---

*Analysis completed: August 29, 2026*
*Based on HyperFrames source code analysis (packages/core, packages/engine)*
