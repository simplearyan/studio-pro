# CDP for GUI Export + HyperFrames Architecture Analysis

## Part 1: CDP for GUI Export — Can We Do It?

### Current Problem

| Pipeline | HTML Clips | WAAPI Clips |
|----------|-----------|-------------|
| **Canvas Preview** | html2canvas ✅ | iframe overlay (live) ✅ |
| **Automation Export** | html2canvas ✅ | CDP screenshots ✅ (perfect) |
| **GUI Export** | html2canvas ✅ | html2canvas ❌ (broken — shows "HTML Clip" fallback) |

The GUI export uses `drawCanvas()` → html2canvas, which fails for WAAPI clips because:
1. `getAnimations()` returns empty on fresh iframes (animations haven't started yet)
2. The "instant complete" CSS hack shows background but hides text
3. Font loading race conditions

**CDP automation works perfectly** because it:
1. Uses `page.screenshot()` — captures actual browser rendering
2. Uses `seekToFrame()` after animations have started
3. Has font preloading

### Can We Use CDP for GUI Export?

**Short answer: Yes, but it requires a fundamental architecture change.**

#### Option A: Spawn Chrome from the Editor (NOT recommended)

```
User clicks Export → Editor spawns Puppeteer → Chrome renders → FFmpeg encodes
```

**Problems:**
- Requires Puppeteer + Chrome installed on user's machine
- Editor runs in browser — can't spawn processes directly
- Would need a backend server (Node.js) to bridge the gap
- Massive UX complexity

#### Option B: CDP over WebSocket to a Local Server

```
Editor runs on localhost:3000
Local helper server runs on localhost:7001
Export flow: Editor → WebSocket → Helper → Puppeteer → CDP → FFmpeg
```

**Problems:**
- Requires user to install and run a helper server
- Extra dependency for a "simple" editor
- Same architecture as automation, just triggered from GUI

#### Option C: Service Worker / SharedWorker CDP Bridge

```
Editor uses a Service Worker that connects to Chrome DevTools Protocol
The Service Worker acts as a headless Chrome proxy
```

**Problems:**
- Service Workers can't access Chrome DevTools Protocol directly
- Browser security blocks this entirely

#### Option D: Native Web API Capture (Best for GUI) ✅

**Instead of CDP, use better browser-native techniques:**

1. **iframe screenshot via `html-to-image`** — more reliable than html2canvas for CSS
2. **SVG foreignObject** — works for simple HTML (no external resources)
3. **Canvas `drawImage(iframe)`** — capture iframe directly to canvas (limited support)
4. **`document.querySelector('iframe').contentWindow`** — access iframe DOM for capture

**The real fix for GUI export is NOT CDP — it's fixing the html2canvas capture for WAAPI clips.**

### Recommended GUI Export Fix

Instead of CDP, fix the WAAPI html2canvas capture:

```javascript
// 1. Wait for animations to actually start
await new Promise(r => {
    const check = () => {
        if (clip._htmlIframe.contentDocument.getAnimations().length > 0) r();
        else requestAnimationFrame(check);
    };
    check();
});

// 2. Seek to correct frame
seekToFrame(clipTime * 30, 30);

// 3. Wait for paint
await new Promise(r => {
    clip._htmlIframe.contentWindow.requestAnimationFrame(() =>
        clip._htmlIframe.contentWindow.requestAnimationFrame(r)
    );
});

// 4. Capture with html2canvas
const canvas = await html2canvas(clip._htmlIframe.contentDocument.body);
```

---

## Part 2: HyperFrames Architecture Analysis

### How HyperFrames Works

HyperFrames is a **video rendering framework** by HeyGen that turns HTML into deterministic MP4 video. It's NOT a video editor — it's a rendering engine.

#### Core Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    HYPERFRAMES PIPELINE                  │
│                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐  │
│  │ HTML/CSS │───▶│ Chrome   │───▶│ FFmpeg           │  │
│  │ + JS     │    │ Headless │    │ (encode to MP4)  │  │
│  └──────────┘    └──────────┘    └──────────────────┘  │
│       │              │                                   │
│       ▼              ▼                                   │
│  data-* attrs   seekToFrame()                           │
│  (timing)       (frame capture)                         │
└─────────────────────────────────────────────────────────┘
```

#### The Key Innovation: `window.__hf.seek()`

```javascript
// HyperFrames' ONE abstraction
window.__hf = {
    duration: 10,
    seek: (timeSeconds) => {
        // Position EVERY element at this exact time
        // GSAP timeline.seek(), WAAPI animation.currentTime, etc.
    }
}
```

**The renderer NEVER calls `play()`.** It calls:
```
seek(0) → screenshot → seek(1/30) → screenshot → seek(2/30) → ...
```

This is **exactly what our CDP automation already does** with `seekToFrame()`.

#### HyperFrames Data Attributes

```html
<div class="card" data-start="0s" data-duration="4s" data-adapter="waapi">
    <h1>Animated Title</h1>
</div>

<div class="chart" data-start="2s" data-duration="3s" data-adapter="gsap">
    <svg>...</svg>
</div>
```

| Attribute | Purpose |
|-----------|---------|
| `data-start` | When element appears in timeline |
| `data-duration` | How long it's visible |
| `data-adapter` | Which animation runtime (gsap, waapi, lottie, three) |
| `data-layer` | Z-index / track assignment |

#### HyperFrames Studio (Visual Editor)

HyperFrames Studio is a **minimal visual editor** — NOT a full NLE like our Studio Pro:

| Feature | HyperFrames Studio | Studio Pro |
|---------|-------------------|------------|
| **Timeline** | ✅ Basic clip drag/trim/split | ✅ Full multi-track with V1/V2/V3 |
| **Canvas** | ✅ Live iframe preview | ✅ Canvas 2D + iframe overlay |
| **Keyframes** | ✅ Property diamonds on timeline | ✅ Position/opacity/scale keyframes |
| **Layers** | ✅ Track-based layers | ✅ Track-based layers |
| **Code Editor** | ✅ Built-in code panel | ❌ External (AI generates code) |
| **Properties Inspector** | ✅ Design panel for selected element | ✅ Sidebar with clip properties |
| **Animation Recording** | ✅ Gesture recording (drag to animate) | ❌ Not yet |
| **Transitions** | ✅ Between clips | ✅ Phase 1 (fade/cut planned) |
| **Nested Scenes** | ✅ Composition nesting | ❌ Not yet |
| **Export** | MP4, MOV, WebM, GIF, PNG sequence | MP4 (MediaBunny), WebM (FTRT) |
| **Rendering** | CDP screenshots (HeadlessExperimental.beginFrame) | html2canvas (GUI) / CDP (automation) |

#### HyperFrames Frame Adapter System

```javascript
// HyperFrames' FrameAdapter interface
interface FrameAdapter {
    id: string;
    init?: (ctx) => Promise<void> | void;
    getDurationFrames: () => number;
    seekFrame: (frame: number) => Promise<void> | void;
}

// GSAP adapter (default)
class GsapAdapter {
    seekFrame(frame) {
        this.timeline.pause();
        this.timeline.totalTime(frame / fps, false);
    }
}

// WAAPI adapter
class WaapiAdapter {
    seekFrame(frame) {
        const ms = (frame / fps) * 1000;
        document.getAnimations({ subtree: true }).forEach(a => {
            a.currentTime = ms;
            a.pause();
        });
    }
}
```

**Our equivalent:** The `_waapiAdapter` in index.html that does `seekToFrame()`.

#### HyperFrames Deterministic Rendering

HyperFrames uses `chrome-headless-shell` with special flags for perfect determinism:

```bash
chrome-headless-shell \
    --deterministic-mode \
    --enable-begin-frame-control \
    --run-all-compositor-stages-before-draw \
    --disable-threaded-animation \
    --disable-threaded-scrolling
```

This makes Chrome render **exactly the same pixels every time** for the same input.

**Our approach:** Regular Puppeteer with `page.screenshot()` — not fully deterministic but good enough.

---

## Part 3: What We Share with HyperFrames

| Concept | HyperFrames | Studio Pro |
|---------|-------------|------------|
| **HTML as video format** | ✅ Core concept | ✅ HTML clips |
| **CSS animation seeking** | ✅ via WAAPI adapter | ✅ via `seekToFrame()` |
| **Data attributes for timing** | ✅ `data-start`, `data-duration` | ❌ We use `clip.start`, `clip.duration` in JS |
| **Frame adapter pattern** | ✅ `FrameAdapter` interface | ✅ `_waapiAdapter` (informal) |
| **CDP screenshot capture** | ✅ `page.screenshot()` | ✅ `cdp-capture.js` (automation only) |
| **Deterministic rendering** | ✅ `beginFrame` mode | ❌ Not yet |
| **GSAP support** | ✅ Default adapter | ❌ Not yet |
| **Lottie support** | ✅ Via adapter | ❌ Not yet |
| **Video-in-video** | ✅ Pre-extract frames with FFmpeg | ✅ Video clips via Canvas drawImage |
| **Font preloading** | ✅ Local @fontsource | ✅ `preloadFonts()` in CDP |
| **Studio visual editor** | ✅ Minimal (code-first) | ✅ Full NLE (timeline-first) |
| **AI agent authoring** | ✅ Primary use case | ✅ code-to-video automation |
| **Community catalog** | ✅ 150+ prebuilt blocks | ❌ Not yet |

---

## Part 4: How to Make Our Export Match HyperFrames Quality

### Phase 1: Fix GUI Export (Immediate)

**Don't use CDP for GUI** — it's too complex. Instead, fix html2canvas:

1. **Wait for animations to start** before calling `getAnimations()`
2. **Use double-rAF** to ensure paint is committed
3. **Pre-cache fonts** in the iframe before capture
4. **Add retry logic** — if html2canvas fails, retry after 100ms

### Phase 2: Add Data Attributes (Future)

Adopt HyperFrames-style data attributes for AI-generated clips:

```html
<div data-start="0" data-duration="5" data-layer="v1" data-adapter="waapi">
    <!-- AI-generated content -->
</div>
```

This makes our `code-to-video` automation compatible with HyperFrames compositions.

### Phase 3: Deterministic Rendering (Production)

For production-quality exports, use `chrome-headless-shell` with `--deterministic-mode`:

```javascript
// In automation/html-waapi/cdp-capture.js
const browser = await puppeteer.launch({
    executablePath: chromeHeadlessShellPath,
    args: [
        '--deterministic-mode',
        '--enable-begin-frame-control',
        '--run-all-compositor-stages-before-draw',
        '--disable-threaded-animation',
    ]
});
```

### Phase 4: Frame Adapter Pattern (Architecture)

Formalize our `_waapiAdapter` into a proper adapter system:

```javascript
// Future: automation/html-waapi/adapters/
export const adapters = {
    waapi: {
        seekFrame(frame, fps) {
            const ms = (frame / fps) * 1000;
            document.getAnimations({ subtree: true }).forEach(a => {
                a.currentTime = ms;
                a.pause();
            });
        }
    },
    gsap: {
        seekFrame(frame, fps) {
            if (window.gsapTimeline) {
                window.gsapTimeline.pause();
                window.gsapTimeline.seek(frame / fps);
            }
        }
    },
    css: {
        seekFrame(frame, fps) {
            document.documentElement.style.setProperty('--frame', frame);
            document.documentElement.style.setProperty('--progress', (frame / fps).toFixed(4));
        }
    }
};
```

---

## Part 5: HyperFrames vs Studio Pro — Feature Comparison

| Feature | HyperFrames | Studio Pro | Winner |
|---------|-------------|------------|--------|
| **Authoring model** | Code-first (HTML) | GUI-first (timeline) | Different philosophies |
| **Animation control** | `window.__hf.seek()` | `seekToFrame()` in iframe | HyperFrames (cleaner API) |
| **Frame capture** | CDP `beginFrame` (deterministic) | html2canvas (GUI) / CDP (auto) | HyperFrames (more reliable) |
| **Video encoding** | FFmpeg (server-side) | MediaBunny (browser WebCodecs) | Studio Pro (no server needed) |
| **Preview quality** | Live iframe (same as render) | Canvas 2D + iframe overlay | Tie (both use iframes) |
| **Timeline editing** | Basic (drag/trim/split) | Full NLE (multi-track, keyframes) | Studio Pro |
| **Multi-track** | Limited | Full V1/V2/V3 + audio | Studio Pro |
| **AI integration** | Primary (built for agents) | Secondary (code-to-video) | HyperFrames |
| **Community/catalog** | 150+ blocks | None | HyperFrames |
| **Local rendering** | ✅ CLI | ✅ Browser | Tie |
| **Cloud rendering** | ✅ HeyGen cloud | ❌ Not yet | HyperFrames |
| **Cost** | Free (open source) + cloud paid | Free (browser-based) | Studio Pro |
| **Ease of use** | Requires coding knowledge | Full GUI | Studio Pro |

---

## Recommendations

### For GUI Export (Immediate Fix)
1. **Fix html2canvas capture** — wait for animations, add retry, pre-cache fonts
2. **Don't use CDP** — too complex for browser-based GUI
3. **Test with WAAPI clips** — ensure all text/elements visible in export

### For Automation Export (Already Working)
1. **CDP screenshots work perfectly** — keep using them
2. **Add font preloading** — already implemented
3. **Add `--deterministic-mode`** when chrome-headless-shell is available

### For Future Architecture
1. **Adopt data attributes** for AI-generated compositions
2. **Formalize frame adapter pattern** — support GSAP, Lottie, Three.js
3. **Add HyperFrames catalog blocks** — import 150+ prebuilt components
4. **Consider deterministic rendering** for production quality

---

*Analysis completed: August 29, 2026*
*Based on HyperFrames docs, HeyGen research article, and Studio Pro codebase*
