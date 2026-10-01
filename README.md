# 🎬 Studio Pro — Browser Video Editor

A powerful, **100% in-browser** video editor and motion-graphics builder. No accounts, no servers, no uploads — your project stays on your machine. Build multi-track timelines from text, shapes, images, video, audio, math equations, **HTML clips**, **HTML-in-Canvas** animations, ink and hand-drawn annotations, and scenes, generate entire slideshows from **Markdown scripts**, and export finished MP4/WebM videos right from the browser.

> **Live site:** https://simplearyan.github.io/studio-pro/
> **GitHub repo:** https://github.com/simplearyan/studio-pro

---

## ✨ Highlights

- **Single-file editor** — everything runs in the browser (Vite + Tailwind CSS 4 + MediaBunny).
- **HTML clips** — write raw HTML/CSS/JS, preview live on canvas, export to video. Like Remotion, but browser-native.
- **HTML-in-Canvas (HIC)** — frame-exact HTML/CSS/JS animation driven by one `onFrame(t)` function, rasterized through SVG `foreignObject`. 12 presets, a code editor, and a built-in AI prompt builder.
- **Ink & hand-drawn annotations** — a 20-brush ink engine (pen → sumi-e fude → watercolor) plus 18 stampable hand-drawn elements (circle, box, arrow, underline…) with draw-on reveal.
- **Markdown → video generator** — write a script, get a full timeline of clips in seconds.
- **Code → video automation** — AI agents write JavaScript compositions, Puppeteer renders them to MP4.
- **Two math engines** — LaTeX equations as crisp images (MathJax) *or* as smooth editable vector shapes.
- **MediaBunny turbo export** — WebCodecs-based MP4/WebM encoding that's dramatically faster than standard MediaRecorder (Chrome/Edge/Opera).
- **Deep per-clip styling** — stroke/outline, drop shadows, 3D extrude, textures, backgrounds, letter-by-letter text editing, and 30+ animation presets.

---

## 🧭 The Interface

| Area | What it does |
|---|---|
| **Top toolbar** | Add clips (Text `T`, HTML, **HTML-in-Canvas** `✦`, WAAPI, Shapes, Image, Video, Audio, Math `Σ`, **Draw** `✏`, **Annotation** `✍`, Scene), undo/redo, export, settings |
| **Canvas preview** | Live preview with selectable/movable/resizable clips, frame-by-frame playback |
| **Timeline (bottom)** | Multi-track editor with playhead, zoom, ripple/push-trim, blade tool, per-track heights |
| **Sidebar** | Six panels: **Properties** (with a **Basic · Adjust · Effects · Media** section list and an **Ink** card on draw clips) · **Animations · Audio · Presets · Captions · Markdown** |

---

## 🧩 Elements & Clips

Add any of these from the header, or via Markdown generation:

- **Text** — per-letter styling (each character independently styled), backgrounds with border-radius + opacity, stroke, drop shadow, 3D extrude, textures.
- **HTML** — write raw HTML/CSS/JS directly. Live preview on canvas. Preset templates (Gradient, Glass, Minimal, Chart, Wisteria, Aurora, Neon, Sunset, Mesh, Ocean). Modal code editor for clean editing.
- **HTML-in-Canvas** — the frame-exact HTML engine (see below). Deterministic `onFrame(t)` animation, 12 presets, code editor with mobile tabs and an AI prompt builder.
- **Shapes** — rectangle, ellipse, triangle, star, line, arrows, callouts… with fill/stroke/effects/textures.
- **Image** — paste a URL or upload a file; optional timeline thumbnail previews.
- **Video** — URL or file; auto-linked audio track; mock placeholder while loading.
- **Audio** — file or from the built-in audio library; volume/pan/effects, waveform thumbnails.
- **Math (image)** — LaTeX via MathJax, cached to an image; fill, stroke, drop shadow, 3D extrude.
- **Math (vector)** — same equations rendered as *vector shapes* — infinitely smooth scaling, no raster flicker.
- **Scene** — group clips into a reusable composition; transparency and opaque-background modes.
- **Ink (draw)** — freehand strokes with 20 brushes, from a plain pen to chisel, dry-erase, wet marker, sumi-e fude, watercolor and airbrush.
- **Annotation elements** — 18 hand-drawn emphasis marks stamped as a draw clip at the playhead (or dragged onto the canvas), each with a draw-on reveal.

### Styling depth (Properties panel)

- Fill / stroke / outline width & color
- Drop shadow (color, blur, offset, opacity)
- **3D extrude** shadow with adjustable depth
- **Textures** — grain, carbon, paper, leather, neon grid… (plus upload your own)
- Backgrounds for text with radius + opacity
- Blend modes, flip, rotation, scale, opacity, aspect ratio presets (9:16, 16:9, 1:1, 4:5…)
- Per-letter editing for text clips (fonts, color, weight per character)

---

## 🌐 HTML Clips

Write raw HTML/CSS/JS and see it render live on the canvas. Export it to video like any other clip.

### Features

- **Live preview** — HTML renders in an iframe, captured to canvas via html2canvas
- **10 preset templates** — one-click professional designs (Gradient, Glass, Wisteria, Aurora, etc.)
- **Modal code editor** — clean editing experience with live preview
- **Google Fonts** — load any Google Font from the sidebar, use in HTML clips
- **Border radius & stroke** — works like other clip types
- **Drag & resize** — select on canvas, move with mouse, resize with handles
- **Pre-render** — clips pre-render on project load for faster seeking

### HTML Clip Workflow

1. Click **HTML** in the toolbar to add a clip
2. Select it on the timeline to open the sidebar
3. Edit HTML/CSS/JS in the Properties panel (or click the code icon for modal editor)
4. Choose a preset template or write your own
5. See it live on the canvas
6. Export to video — html2canvas captures each frame

### Known Limitations

- `backdrop-filter` may not render correctly in html2canvas
- Cross-origin images require CORS headers
- CSS `animation` is static (captured at current frame, not seekable)
- Future: WAAPI system will make animations deterministically seekable

---

## 🖼️ HTML-in-Canvas (HIC)

A second HTML engine — the one built for frame-exact video. Instead of capturing a live iframe with html2canvas, a HIC clip is a **pure function of time**: you write a single `onFrame(t)`, and the editor rasterizes that frame through SVG `foreignObject` at the canvas resolution. Same time in → same pixels out, at any seek position or export resolution.

### The contract

```js
function onFrame(t) {                             // t = ms since the clip started
  el.style.transform = 'translateY(' + Math.sin(t / 400) * 20 + 'px)';
}
```

- **No `requestAnimationFrame`, no `setTimeout`/`setInterval`, no CSS `@keyframes` or `transition`** — every element state is computed inside `onFrame` from `t` alone.
- Design space is a fixed **800 × 450** (16:9); the renderer scales the whole stage to any output resolution.
- **Vanilla HTML/CSS/JS only** — no imports, no external libraries. Guard your lookups (`if (el) { … }`) so a missing id never throws.
- Images must be CORS-safe `https` URLs; they are inlined to base64 before the SVG render.

### What's in the box

- **12 presets** — Google Clean, Gradient Hero, Neo-Brutal, iOS Glass, Data Chart, Stagger Grid, Fireship Terminal, Material You, iOS Gradient, Vox Title, Text Reveal, Google Search.
- **HIC code editor** — HTML / CSS / JS panes, live preview at the design space, mobile Preview/Code tabs, and a built-in **Format** button (three hand-written formatters, no third-party libs).
- **AI tab** — documents the clip contract, offers 12 prompt chips (Counter Stats, Quote Reveal, Neon Glitch Intro, Subscribe Outro, Particle Constellation…), assembles the full prompt, and takes the three fenced blocks back into the panes.
- **Pre-render before export** — HIC clips are pre-rendered ahead of the render pump, including the FTRT path, so seeking and export never race an async capture.
- **Per-clip effects** — everything a normal clip gets: stroke/outline, shadow, border radius, blend, transform, and in/out/loop animation presets.

### The shared HIC layer

`docs/html-in-canvas/` holds the standalone HIC pages and the libraries they and the editor are built from:

| File | What it does |
|---|---|
| `hic-frame.js` | Aspect / design-space tables, frame geometry, and the `HicRenderer` SVG engine |
| `hic-modal.js` | The full preview modal — player shell, overlay transport, export toolbar, Code tab, AI tab |
| `hic-storyboard.js` | Storyboard → clip compiler: a storyboard JSON becomes a self-contained HIC clip whose `onFrame(t)` *is* the interpolator |
| `hic-theme.js` · `hic-theme.css` | Shared theme boot + toggle (runs pre-paint, so no light flash on dark-first visits) |
| `designs.html` · `test-renderer.html` · `prompts-engineer.html` | Standalone tools: design gallery, renderer test bench, AI prompt engineer |

### How this differs from HTML clips

| | HTML clips | HTML-in-Canvas |
|---|---|---|
| Capture | html2canvas over a live iframe | SVG `foreignObject` at canvas resolution |
| Animation | CSS animation, captured at the current frame | `onFrame(t)` — deterministic and seekable |
| Seeking | Re-captures the iframe | Pure function of `t`, instant |
| Export accuracy | Approximate | Frame-exact |

### Known limitations

- The whole clip is driven by one `onFrame(t)`, so CSS animations and transitions are ignored — anything that moves must be computed from `t`.
- Cross-origin images need CORS headers; fonts and scripts must be vendored or web-safe.
- Text is laid out by the browser's HTML engine, so line breaking can shift slightly between the editor preview and an export at a very different resolution.

---

## ✍️ Ink & Hand-Drawn Annotations

Two ways to draw on the timeline: freehand with the **Draw** tool, or stamp a ready-made **hand-drawn element** from the annotation library. Both produce a normal **draw clip**, so selection, trimming, reveal, effects, grouping, copy/paste and export all come for free.

### Brushes (20)

| Pack | Brushes |
|---|---|
| **Core** | Pen, Eraser, Chisel, Calligraphy, Highlighter, Fine Liner, Dry Erase, Wet Marker, Brush Pen, Paint Marker |
| **Ink-physics** | Fude Brush, Menso Fine, Kasure Dry, Nijimi Wet, Bokashi Wash, Shibuki Splatter, Hake Flat, Watercolor, Charcoal, Airbrush |

- The **Pen** uses vendored **perfect-freehand** for velocity-simulated tapered ink.
- The **ink-physics pack** adds four shared knobs on top of size / nib angle / texture / ink opacity / blend: **Bleed** (wet spread), **Sensitivity** (speed → width, resolved at commit time), **Ink Fade** (ink depletes along the stroke) and **Scatter** (particle density).

### Annotation elements (18)

| Group | Elements |
|---|---|
| **Emphasis** | Circle, Double Circle, Messy Circle, Box, Dashed Box, Ellipse, Star, Heart, Bracket |
| **Arrows** | Arrow, Curved Arrow, Double Arrow |
| **Marks** | Underline, Highlight, Check, Cross, Wavy Line, Burst |

- **Stamp at the playhead** from the library flyout, or **drag a chip onto the canvas** to stamp it where you drop it.
- Every element lands with a **draw-on reveal** — the mark draws itself at its own pace (0.5–1.3 s) from the clip's start.
- **Sketch styles** — `Off · Light · Sketchy · Messy` re-render a stroke as 1–2 rough passes with roughness and bowing you can dial, plus a per-clip **Boiling** switch that makes a hand-drawn line wiggle at 10 fps like traditional animation.
- **Deterministic by construction** — every speckle, bleed and spatter comes from coordinate-hashed noise instead of `Math.random()`, so a frame rasterizes identically at any seek position or export resolution.

### The Ink card (Properties)

Select a draw clip — or any annotation it stamped — and the sidebar shows:

- brush picker (per-brush glyph, label and size sample)
- size, nib angle, texture, ink opacity, ink blend
- only the physics knobs that brush actually uses (bleed / sensitivity / fade / scatter)
- sketch style, boiling, stroke colour — plus the clip's normal effects, animations and transform

---

## 📝 Markdown → Video Generator

Write plain Markdown in the **Markdown → Content** tab, hit **Generate**, and Studio Pro builds slides on the timeline — headings, paragraphs, images, videos, math and mocks, all with per-slide timing, positions and stacking.

### Syntax

```markdown
# 🎬 Slide Title

## 🦖 T-Rex [top-left]

![T-Rex](https://.../t-rex.jpeg) [right]

The Tyrannosaurus Rex was one of the largest land carnivores… [bottom]

$$e^{i\pi} + 1 = 0$$ [center-right]

![Alt text](mock)          ← mock image placeholder
![Reel](mock:video)        ← mock video placeholder
![Clip](video.mp4)         ← real video by extension
[video](https://…/x.mp4)   ← real video by URL

---                          ← separates slides
```

### Features

- **Element types:** headings, paragraphs, images, math, mock placeholders, real video URLs
- **Position tags:** `[top]`, `[bottom]`, `[left]`, `[right]`, `[center]`, corners, sides
- **Timing:** per-slide duration, text delay, generate-from time
- **Track modes:** Auto layout or Script-order lanes
- **Presets:** Animals & Dinosaurs, Σ Math, Showcase

---

## 🎞️ Animations

- **Preset grid** (Transform): In / Out / Loop animations — fade, slide, zoom, bounce, spin, flip, blur, **Puzzle Blocks**
- **Text tab:** letter-by-letter pop, background sweep, stagger effects
- **Custom tab:** full keyframe editor — add/delete keyframes, per-property reset
- Per-clip duration, delay, and easing controls

---

## 🗒️ Captions

- **Import SRT/VTT** files — auto-synced caption clips
- Convert captions to normal text tracks for full timeline control
- Overlap handling with live preview

---

## ⏱️ Timeline Editing

- Multi-track timeline (V1…, A1…) with per-track height adjustment
- **Split** at playhead — one clip, linked clips, or all clips (blade tool)
- Trim from start or end; **push/ripple trim** moves neighbors
- **Gap select** — click empty space, remove it, ripple left
- Multi-select, group to scene, duplicate, copy/paste, drag across tracks

---

## 📤 Export

Hit **Export** in the toolbar, choose a tab and format:

| Format | Engine | Notes |
|---|---|---|
| **MP4** (MediaBunny) | WebCodecs | ⚡ Fast, high quality — needs Chrome/Edge/Opera |
| **WebM** (MediaBunny) | WebCodecs | ⚡ Fast VP9 |
| **MP4** (FTRT) | Frame-index | ⚡ Fastest — 4× realtime |
| **MP4** (standard) | MediaRecorder | H.264 + AAC, universal fallback |
| **WebM** (standard) | MediaRecorder | VP9 + Opus |
| **GIF** | MediaRecorder | Animated GIF via WebM |
| **Audio WebM / WAV** | MediaRecorder | Audio-only export |

- **Resolution** up to 1080p+, **FPS** selectable, **time-range export**
- Custom aspect ratios (9:16, 16:9, 1:1, 4:5…)
- Progress bar + cancel, settings remembered in `localStorage`

---

## 🤖 Automation

Studio Pro includes a full automation layer for rendering videos from the terminal — designed for AI agents and batch processing.

### Three Pipelines

| Pipeline | Input | Command | Best For |
|---|---|---|---|
| **md-render** | `.md` files | `node md-render/render.js scripts/file.md` | Simple videos, explainers |
| **html-static** | `.js` files | `node html-static/render.js examples/file.js` | HTML clip compositions |
| **html-waapi** | `.js` files | `node html-waapi/render.js examples/file.js` | Animated HTML clips (future) |

### Quick Start

```bash
# 1. Start dev server (personal or automation)
npm run dev              # Port 3000 (personal)
npm run dev:automation   # Port 7000 (dedicated, isolated)

# 2. Run automation
cd automation
npm install

# Markdown → Video
node md-render/render.js scripts/social-short.md -q ultra -m ftrt

# HTML → Video
node html-static/render.js html-static/examples/simple-test.js -q ultra -m ftrt
```

### Automation Features

- **Port auto-detect** — tries 7000 → 3000 → 3001 automatically
- **Chrome isolation** — separate profile per pipeline, never touches your browser
- **Short flags** — `-q ultra -m ftrt` for fast CLI
- **Export modes** — FTRT (4× realtime), MediaBunny (WebCodecs), Standard
- **Quality presets** — draft (3Mbps), standard (8Mbps), high (15Mbps), ultra (30Mbps)
- **Batch rendering** — render multiple scripts in parallel

### Folder Structure

```
automation/
├── md-render/                # Pipeline 1: Markdown → Video
│   ├── render.js             # Headless Chrome renderer
│   ├── config.json           # Chrome path, port, defaults
│   ├── scripts/              # Markdown video scripts
│   └── output/               # Rendered videos
│
├── html-static/              # Pipeline 2: HTML Clips → Video
│   ├── api.js                # Puppeteer API wrapper
│   ├── render.js             # CLI entry point
│   ├── examples/             # Composition scripts
│   ├── templates/            # HTML/CSS/JS templates
│   └── output/               # Rendered videos
│
├── html-waapi/               # Pipeline 3: Animated HTML → Video (future)
│   ├── lib/                  # WAAPI seek, data-animate, SVG renderer
│   ├── templates/            # Animated HTML templates
│   ├── examples/             # Animated compositions
│   └── output/               # Rendered videos
│
├── shared/                   # Shared across pipelines
│   ├── skills/               # AI agent workflows (AGENTS.md)
│   └── tests/                # Test scripts
│
├── assets/                   # Shared assets (fonts, images, audio)
├── batch.js                  # Batch render multiple scripts
├── package.json              # puppeteer-core dependency
└── README.md                 # Full automation docs
```

### AI Agent Workflow

1. Read `shared/skills/AGENTS.md` — learn the API
2. Read `shared/skills/*.md` — follow a skill doc
3. Write a JS composition using `StudioPro.createComposition()`
4. Render: `node html-static/render.js my-video.js`
5. Get MP4 output

---

## ✅ WAAPI Animation System (shipped)

CSS `@keyframes` in an HTML-in-Canvas clip are compiled into a deterministic `onFrame(t)` by
`src/engines/hic/adapters/waapi.js`, so they scrub and export frame-exact.

The one thing that turned out not to work is the Web Animations API itself: a HIC clip is rastered
from a **detached** `foreignObject` where the sandbox CSS is never applied, so there are no live
animations for `document.getAnimations()` to seek. Compiling the keyframes into `onFrame` is what
made them seekable instead.

### What It Enables

| Before (html2canvas clips) | Now (HTML-in-Canvas clips) |
|---|---|
| Static capture at one frame | Any frame is reachable |
| CSS animations frozen | `@keyframes` compile to `onFrame(t)` |
| Custom `animate(t)` function required | Either an `onFrame(t)` hook or plain `@keyframes` |
| ~500 ms per frame capture | ~5–15 ms SVG `foreignObject` raster |

### Three-Layer Architecture

| Layer | What | How it works now |
|---|---|---|
| **Markup** | How a clip is authored | HTML/CSS in a HIC clip |
| **Time Control** | How the editor scrubs time | `WAAPIAdapter.compileKeyframes` → `onFrame(t)` |
| **Frame Capture** | How DOM becomes pixels | SVG `foreignObject` (~5–15 ms), not html2canvas |

### Status

- ✅ Shipped in the editor — the adapter plus 19 HTML-in-Canvas presets
- 🔬 Batch pipeline still separate (`automation/html-waapi/`), and it owns the `lib/` and `templates/` prototypes
- ⏳ Retiring the html2canvas path is Phase 4 of the [consolidation plan](docs/HTML-ENGINE-CONSOLIDATION-PLAN.md)

The research folder this replaced (`future-waapi/`) has been removed; its verdict, and the plan for
the rest of the cleanup, live in [HTML-ENGINE-CONSOLIDATION-PLAN.md](docs/HTML-ENGINE-CONSOLIDATION-PLAN.md)
and [LEGACY-CLIP-REMOVAL-PLAN.md](docs/LEGACY-CLIP-REMOVAL-PLAN.md).

---

## 🚀 Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev          # → http://localhost:3000

# 3. Production build
npm run build
npm run preview      # serve the built site locally
```

Open the app, then try the **Showcase** preset in the Markdown tab and hit **Generate** — you'll have a full timeline in seconds.

> **Note:** MediaBunny exports require a Chromium browser (Chrome, Edge, Opera). The standard MediaRecorder export still works everywhere.

---

## 🛠 Tech Stack

- **Vite** — instant dev server & builds
- **Tailwind CSS 4** — utility-first styling, dark mode
- **MediaBunny** — WebCodecs encoding for fast MP4/WebM export ([site](https://mediabunny.dev/) · [GitHub](https://github.com/Vanilagy/mediabunny) · MPL-2.0)
- **html2canvas** — DOM-to-canvas capture for HTML clips
- **perfect-freehand** — pressure-simulated tapered ink for the draw tool (vendored in `public/vendor/`)
- **SVG `foreignObject`** — the rasterization path for HTML-in-Canvas clips
- **MathJax** — LaTeX rendering for image-based math
- **Puppeteer** — headless Chrome for automation rendering
- Vanilla JS single-page app — no framework, no backend, no telemetry

---

## 📁 Project Structure

```
studio-pro-editor/
├── index.html              ← the entire editor (UI + logic, ~39k lines)
├── style.css               ← custom styles (Tailwind 4 + hand-written)
├── tailwind.config.js      ← Tailwind theme
├── vite.config.js          ← build config
├── export-worker.js        ← MediaBunny export worker
│
├── automation/             ← terminal automation (3 pipelines)
│   ├── md-render/          ← Markdown → Video
│   ├── html-static/        ← HTML Clips → Video
│   ├── html-waapi/         ← Animated HTML → Video (future)
│   ├── shared/             ← Skills, tests, assets
│   └── README.md           ← Full automation docs
│
├── public/vendor/          ← vendored runtime deps (lucide, mathjax, perfect-freehand)
│
├── docs/                   ← planning docs
│   ├── automation/         ← render architecture plans
│   └── html-in-canvas/     ← shared HIC libs (hic-frame, hic-modal,
│                              hic-storyboard, hic-theme) + standalone
│                              pages: designs, test-renderer, prompts-engineer
│
└── package.json
```

---

## 📖 Docs & Contributing

- [Contributing guide](CONTRIBUTING.md) — how to set up, code conventions, and testing checklist
- [Automation docs](automation/README.md) — full automation guide
- [HTML-in-Canvas renderer](docs/html-in-canvas/test-renderer.html) — the SVG `foreignObject` engine, in isolation
- [HTML engine consolidation](docs/HTML-ENGINE-CONSOLIDATION-PLAN.md) — the WAAPI→HIC port and the `future-waapi/` verdict
- [Render architecture](docs/automation/HTML-Render-Final-Plan.md) — three-layer rendering plan
- [Commercial licensing strategy](LICENSE_STRATEGY_COMMERCIAL.md) — how we plan to fund the editor
- [License deep-dive](LICENSE_RECOMMENDATION.md) — how MediaBunny's MPL-2.0 license works with our own

---

*Built for creators who want a pro editing feel with zero setup. Make something great! 🚀*
