# 🎬 Studio Pro — Browser Video Editor

A powerful, **100% in-browser** video editor and motion-graphics builder. No accounts, no servers, no uploads — your project stays on your machine. Build multi-track timelines from text, shapes, images, video, audio, math equations, **HTML clips**, and scenes, generate entire slideshows from **Markdown scripts**, and export finished MP4/WebM videos right from the browser.

> **Live site:** https://simplearyan.github.io/studio-pro/
> **GitHub repo:** https://github.com/simplearyan/studio-pro

---

## ✨ Highlights

- **Single-file editor** — everything runs in the browser (Vite + Tailwind CSS 4 + MediaBunny).
- **HTML clips** — write raw HTML/CSS/JS, preview live on canvas, export to video. Like Remotion, but browser-native.
- **Markdown → video generator** — write a script, get a full timeline of clips in seconds.
- **Code → video automation** — AI agents write JavaScript compositions, Puppeteer renders them to MP4.
- **Two math engines** — LaTeX equations as crisp images (MathJax) *or* as smooth editable vector shapes.
- **MediaBunny turbo export** — WebCodecs-based MP4/WebM encoding that's dramatically faster than standard MediaRecorder (Chrome/Edge/Opera).
- **Deep per-clip styling** — stroke/outline, drop shadows, 3D extrude, textures, backgrounds, letter-by-letter text editing, and 30+ animation presets.

---

## 🧭 The Interface

| Area | What it does |
|---|---|
| **Top toolbar** | Add clips (Text `T`, HTML, Shapes, Image, Video, Audio, Math `Σ`, Scene), undo/redo, export, settings |
| **Canvas preview** | Live preview with selectable/movable/resizable clips, frame-by-frame playback |
| **Timeline (bottom)** | Multi-track editor with playhead, zoom, ripple/push-trim, blade tool, per-track heights |
| **Sidebar** | Six panels: **Properties · Animations · Audio · Presets · Captions · Markdown** |

---

## 🧩 Elements & Clips

Add any of these from the header, or via Markdown generation:

- **Text** — per-letter styling (each character independently styled), backgrounds with border-radius + opacity, stroke, drop shadow, 3D extrude, textures.
- **HTML** — write raw HTML/CSS/JS directly. Live preview on canvas. Preset templates (Gradient, Glass, Minimal, Chart, Wisteria, Aurora, Neon, Sunset, Mesh, Ocean). Modal code editor for clean editing.
- **Shapes** — rectangle, ellipse, triangle, star, line, arrows, callouts… with fill/stroke/effects/textures.
- **Image** — paste a URL or upload a file; optional timeline thumbnail previews.
- **Video** — URL or file; auto-linked audio track; mock placeholder while loading.
- **Audio** — file or from the built-in audio library; volume/pan/effects, waveform thumbnails.
- **Math (image)** — LaTeX via MathJax, cached to an image; fill, stroke, drop shadow, 3D extrude.
- **Math (vector)** — same equations rendered as *vector shapes* — infinitely smooth scaling, no raster flicker.
- **Scene** — group clips into a reusable composition; transparency and opaque-background modes.

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

## 🔬 Future: WAAPI Animation System

A research system for deterministic, frame-by-frame animation control using the browser's native Web Animations API.

### What It Enables

| Current (html2canvas) | Future (WAAPI) |
|---|---|
| Static capture at one frame | Seek to ANY frame instantly |
| CSS animations are frozen | CSS animations are scrubable |
| Custom `animate(t)` function required | Standard `@keyframes` work |
| ~500ms per frame capture | ~0ms native GPU seeking |

### Three-Layer Architecture

| Layer | What | Solution |
|---|---|---|
| **Markup** | How AI writes graphics | `data-animate="fade-in"` attributes |
| **Time Control** | How editor scrubs time | WAAPI — `anim.pause(); anim.currentTime = ms` |
| **Frame Capture** | How DOM becomes pixels | SVG foreignObject (~5-15ms) |

### Status

- 🔬 Research complete (docs in `docs/automation/`)
- 🔬 Prototype libs ready (`future-waapi/lib/`)
- 🔬 Production pipeline scaffolded (`automation/html-waapi/`)
- ⏳ Not yet integrated into editor

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
- **MathJax** — LaTeX rendering for image-based math
- **Puppeteer** — headless Chrome for automation rendering
- Vanilla JS single-page app — no framework, no backend, no telemetry

---

## 📁 Project Structure

```
studio-pro-editor/
├── index.html              ← the entire editor (UI + logic, ~34k lines)
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
├── future-waapi/           ← WAAPI research lab (libs, docs, examples)
│
├── docs/                   ← planning docs
│   └── automation/         ← render architecture plans
│
└── package.json
```

---

## 📖 Docs & Contributing

- [Contributing guide](CONTRIBUTING.md) — how to set up, code conventions, and testing checklist
- [Automation docs](automation/README.md) — full automation guide
- [WAAPI research](future-waapi/README.md) — future animation system
- [Render architecture](docs/automation/HTML-Render-Final-Plan.md) — three-layer rendering plan
- [Commercial licensing strategy](LICENSE_STRATEGY_COMMERCIAL.md) — how we plan to fund the editor
- [License deep-dive](LICENSE_RECOMMENDATION.md) — how MediaBunny's MPL-2.0 license works with our own

---

*Built for creators who want a pro editing feel with zero setup. Make something great! 🚀*
