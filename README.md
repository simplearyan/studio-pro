<div align="center">

# 🎬 Studio Pro

**A pro-feeling video editor and motion-graphics studio that runs entirely in your browser.**

No accounts. No uploads. No backend. Build a timeline from text, shapes, images, video, audio,
math, ink and **HTML-in-Canvas** clips — then export MP4/WebM without your project ever leaving
your machine.

[![Live demo](https://img.shields.io/badge/live-demo-7c3aed?style=for-the-badge)](https://simplearyan.github.io/studio-pro/)
[![License: MPL 2.0](https://img.shields.io/badge/license-MPL--2.0-blue?style=for-the-badge)](LICENSE)
[![Chromium](https://img.shields.io/badge/Chromium-required-4285F4?style=for-the-badge)](https://www.google.com/chrome/)

</div>

---

### ▶️ A Breath of Air

A 26-second film — four **HTML-in-Canvas** clips written as plain HTML/CSS, rendered to MP4 by
the terminal automation pipeline. It is the same code you can read, edit and re-render.

![A Breath of Air — a 26-second HTML-in-Canvas film about global and Indian air pollution](docs/media/pollution-story.gif)

> Source: [`automation/html-in-canvas/examples/pollution-story.js`](automation/html-in-canvas/examples/pollution-story.js) ·
> static frames: [`docs/media/pollution-story-poster.png`](docs/media/pollution-story-poster.png)

---

## 🧭 Contents

- [Why Studio Pro](#-why-studio-pro)
- [Quick start](#-quick-start)
- [The interface](#-the-interface)
- [HTML-in-Canvas — the HTML engine](#-html-in-canvas--the-html-engine)
- [Code → video automation](#-code--video-automation)
- [Everything else it does](#-everything-else-it-does)
- [Export](#-export)
- [Tech stack](#-tech-stack)
- [Project structure](#-project-structure)
- [Docs & contributing](#-docs--contributing)

---

## 💡 Why Studio Pro

- **Nothing leaves your machine.** The editor is a static site; projects live in `localStorage`
  and files you choose. There is no server to trust.
- **HTML is a first-class clip type.** Write real HTML/CSS and get frame-exact video out of
  it — the same idea as Remotion, but browser-native and live on the canvas as you type.
- **Deterministic by construction.** Every animated clip is a pure function of time, so seeking,
  previewing and exporting all agree. Re-rendering gives you the same frames.
- **An agent can drive it.** One `StudioPro.html(…)` call creates a clip; a small CLI renders a
  whole composition to MP4, headless.
- **Zero setup.** `npm install && npm run dev`. No database, no accounts, no build step before
  you can edit.

---

## 🚀 Quick Start

```bash
git clone https://github.com/simplearyan/studio-pro.git
cd studio-pro
npm install
npm run dev            # → http://localhost:3000
```

Then, in the app: press `T` to add text, `✦` to add an **HTML-in-Canvas** clip, or open the
**Markdown** tab, pick a preset and hit **Generate** for an instant timeline.

```bash
npm run build          # production build → dist/
npm run preview        # serve the built site locally
```

> **Browser:** MediaBunny (WebCodecs) exports need a Chromium browser (Chrome, Edge, Opera).
> The standard MediaRecorder export works everywhere.

---

## 🧭 The Interface

| Area | What it does |
|---|---|
| **Top toolbar** | Add clips — Text, **HTML-in-Canvas** `✦`, Shapes, Image, Video, Audio, Math `Σ`, Draw `✏`, Annotation `✍`, Scene — plus undo/redo, export and settings |
| **Canvas preview** | Live preview with selectable, movable, resizable clips and frame-by-frame playback |
| **Timeline (bottom)** | Multi-track editor with playhead, zoom, ripple/push-trim, blade, and per-track heights |
| **Sidebar** | Six panels: Properties (Basic · Adjust · Effects · Media, plus an Ink card on draw clips) · Animations · Audio · Presets · Captions · Markdown |

---

## 🖼️ HTML-in-Canvas — the HTML engine

An HTML-in-Canvas (**HIC**) clip is a **pure function of time**. You write one `onFrame(t)` and the
editor rasterizes that frame through SVG `foreignObject` at the canvas resolution. Same `t` in,
same pixels out — at any seek position or export resolution.

```js
function onFrame(t) {                       // t = milliseconds since the clip started
  el.style.transform = 'translateY(' + Math.sin(t / 400) * 20 + 'px)';
}
```

- **No `requestAnimationFrame`, no `setTimeout`, no live CSS animation** — every moving part is
  computed from `t` alone. That is what makes export frame-exact.
- **Design space is a fixed 800 × 450 (16:9)**, scaled by the renderer to any output size.
- **Vanilla HTML/CSS/JS only** — no imports, no external libraries. Guard lookups (`if (el) { … }`)
  so a missing id never throws.
- **Prefer `@keyframes`?** Write plain CSS keyframes and the editor compiles them into a
  deterministic `onFrame` for you (see below).

### The preset library (19)

13 hand-built presets — *Blank, Google Clean, Gradient Hero, Neo-Brutal, iOS Glass, Data Chart,
Stagger Grid, Fireship Terminal, Material You, iOS Gradient, Vox Title, Text Reveal, Google
Search* — plus 7 ported keyframe presets. Each is a working composition you can open, tweak and
export.

### In the editor

- **HIC code editor** — HTML / CSS / JS panes, live preview, mobile Preview/Code tabs, and a
  built-in **Format** button (three hand-written formatters, no third-party libs).
- **AI tab** — documents the clip contract, offers prompt chips (counter stats, quote reveal,
  neon-glitch intro, subscribe outro, particle constellation…), assembles the prompt, and takes
  the fenced blocks back into the panes.
- **Pre-render before export** — HIC clips rasterize ahead of the render pump (including the
  fast frame-index path), so seeking and export never race an async capture.
- **Per-clip effects** — stroke, shadow, radius, blend, transform and the usual animation presets.

### `@keyframes` → `onFrame` (the WAAPI adapter)

CSS `@keyframes` in a HIC clip are compiled into a deterministic `onFrame(t)` by
[`src/engines/hic/adapters/waapi.js`](src/engines/hic/adapters/waapi.js), so they scrub and export
frame-exact. The Web Animations API itself turned out *not* to work here: a HIC clip rasterizes
from a **detached** `foreignObject` where the clip's CSS is never applied, so `document.getAnimations()`
has nothing to seek. Compiling the keyframes into `onFrame` is what made them seekable.

| | Legacy html2canvas clips | HTML-in-Canvas clips |
|---|---|---|
| DOM → pixels | `html2canvas` over a live iframe | SVG `foreignObject` raster |
| Speed | ~200–500 ms / frame | ~5–15 ms / frame |
| Animation | frozen at the captured frame | `onFrame(t)`, seekable and deterministic |
| Export accuracy | approximate | frame-exact |

### The shared HIC layer

[`docs/html-in-canvas/`](docs/html-in-canvas/) holds the standalone HIC pages and the libraries
they and the editor share:

| File | What it does |
|---|---|
| [`hic-frame.js`](docs/html-in-canvas/hic-frame.js) | Aspect / design-space tables, frame geometry, the `HicRenderer` SVG engine |
| [`hic-modal.js`](docs/html-in-canvas/hic-modal.js) | The preview modal — player shell, transport, export toolbar, Code tab, AI tab |
| [`hic-storyboard.js`](docs/html-in-canvas/hic-storyboard.js) | Storyboard → clip compiler: JSON becomes a self-contained HIC clip |
| [`hic-theme.js`](docs/html-in-canvas/hic-theme.js) · [`hic-theme.css`](docs/html-in-canvas/hic-theme.css) | Shared theme boot + toggle |
| [`designs.html`](docs/html-in-canvas/designs.html) · [`test-renderer.html`](docs/html-in-canvas/test-renderer.html) · [`prompts-engineer.html`](docs/html-in-canvas/prompts-engineer.html) | Standalone tools: design gallery, renderer test bench, AI prompt engineer |

---

## 🤖 Code → video automation

The same HIC clips render headless from the terminal, so an AI agent (or a CI job) can produce
video without touching the UI.

```bash
cd automation && npm install

# Deterministic: a standalone page per clip + CDP screenshots + ffmpeg  (default)
node html-in-canvas/render.js html-in-canvas/examples/pollution-story.js

# Parity: drive the running editor and let its own export pump render
node html-in-canvas/render.js html-in-canvas/examples/pollution-story.js -m editor -e ftrt
```

### How the showcase was made

1. **Write** a composition — four clips, each a `div` with a gradient background and CSS
   `@keyframes` entrances ([`examples/pollution-story.js`](automation/html-in-canvas/examples/pollution-story.js)).
2. **Render** with `-m cdp` (default): 780 frames at 1920×1080, 30 fps.
3. **Preview** it as a GIF — the clip you see at the top of this README.

### Two export strategies, one command

| Strategy | Flag | How | Use it for |
|---|---|---|---|
| **CDP screenshots** | `-m cdp` *(default)* | Standalone page per clip, one screenshot per frame, ffmpeg | Anything you may need to re-render, compare or diff — it is a pure function of the frame index. Two runs produce byte-identical MP4s. |
| **Editor export** | `-m editor` | Drives the running editor's own export pump (`-e mediabunny \| ftrt \| standard`) | Verifying that the path a real user's **Export** button takes actually renders a clip. |

They are **not interchangeable**: both editor encoders are realtime capture loops, so each frame
lands at a slightly different point in the animation, while `-m cdp` samples the same frame index
every time. Use `cdp` for reference files, `editor` for coverage of the shipped path.

### Folder

```
automation/
├── html-in-canvas/            # HTML-in-Canvas → Video
│   ├── render.js              # CLI — --mode cdp|editor
│   ├── api.js                 # editor client (used by --mode editor)
│   ├── cdp-capture.js         # standalone page + CDP screenshots (--mode cdp)
│   ├── examples/              # composition scripts (incl. pollution-story.js)
│   ├── templates/             # reusable HTML/CSS + design tokens
│   └── README.md              # the pipeline's own docs
├── md-render/                 # Markdown → Video
├── shared/skills/             # AI-agent workflows (AGENTS.md first)
└── README.md                  # full automation guide
```

### Agent workflow

1. Read [`automation/shared/skills/AGENTS.md`](automation/shared/skills/AGENTS.md) — the API.
2. Read a skill doc (`kinetic-text`, `product-launch`, `social-reel`) if one fits.
3. Write a JS composition using `StudioPro.createComposition()` / `StudioPro.html()`.
4. Render: `node html-in-canvas/render.js html-in-canvas/examples/my-video.js`.

---

## 🧩 Everything else it does

### Clips you can add

- **Text** — per-letter styling, backgrounds with radius + opacity, stroke, drop shadow, 3D
  extrude, textures.
- **Shapes** — rectangle, ellipse, triangle, star, line, arrows, callouts… with fill, stroke,
  effects and textures.
- **Image / Video / Audio** — URL or file; video auto-links its audio track; the audio library
  adds waveform thumbnails.
- **Math** — LaTeX via MathJax as a crisp image *or* as smooth editable **vector** shapes.
- **Ink (draw)** — freehand strokes with 20 brushes, from a plain pen to sumi-e fude, watercolor
  and airbrush.
- **Annotation elements** — 18 hand-drawn emphasis marks (circle, box, arrow, underline…) stamped
  as a draw clip, each with a draw-on reveal.
- **Scene** — group clips into a reusable composition.

### Ink & hand-drawn annotations

| Pack | Brushes |
|---|---|
| **Core** | Pen, Eraser, Chisel, Calligraphy, Highlighter, Fine Liner, Dry Erase, Wet Marker, Brush Pen, Paint Marker |
| **Ink-physics** | Fude Brush, Menso Fine, Kasure Dry, Nijimi Wet, Bokashi Wash, Shibuki Splatter, Hake Flat, Watercolor, Charcoal, Airbrush |

The **Pen** uses vendored **perfect-freehand** for velocity-simulated tapered ink; the ink-physics
pack adds **Bleed**, **Sensitivity**, **Ink Fade** and **Scatter** knobs. Every speckle comes from
coordinate-hashed noise rather than `Math.random()`, so a stroke rasterizes identically at any
seek position or resolution.

### Markdown → video

Write Markdown in the **Markdown → Content** tab and hit **Generate**: headings, paragraphs,
images, videos, math and mocks become timed, positioned clips. Position tags (`[top-left]`,
`[center-right]`…), per-slide timing and track modes cover most explainer layouts.

### Timeline, animations & captions

- Split at the playhead (one clip, linked clips, or all), trim, push/ripple trim, gap-select,
  multi-select, group to scene, copy/paste, drag across tracks.
- Animation presets for in / out / loop (fade, slide, zoom, bounce, spin, flip, blur, puzzle
  blocks), letter-by-letter text effects, and a custom keyframe editor.
- Import SRT/VTT captions, auto-synced, or convert them to normal text tracks.

---

## 📤 Export

| Format | Engine | Notes |
|---|---|---|
| **MP4** (MediaBunny) | WebCodecs | ⚡ Fast, high quality — Chromium only |
| **WebM** (MediaBunny) | WebCodecs | ⚡ Fast VP9 |
| **MP4** (FTRT) | Frame-index | ⚡ Fastest — ~4× realtime |
| **MP4 / WebM** (standard) | MediaRecorder | Universal fallback (H.264 + AAC / VP9 + Opus) |
| **GIF** | MediaRecorder | Animated GIF via WebM |
| **Audio WebM / WAV** | MediaRecorder | Audio-only export |

Resolution up to 1080p+, selectable FPS, time-range export, and custom aspect ratios
(9:16, 16:9, 1:1, 4:5…). Progress bar + cancel; settings are remembered in `localStorage`.

---

## 🛠 Tech Stack

| Layer | Choice |
|---|---|
| Build / dev server | **Vite** |
| Styling | **Tailwind CSS 4** (dark mode) |
| Encoding | **MediaBunny** — WebCodecs MP4/WebM ([site](https://mediabunny.dev/) · [GitHub](https://github.com/Vanilagy/mediabunny) · MPL-2.0) |
| HIC rasterization | **SVG `foreignObject`** |
| Ink | **perfect-freehand** (vendored in `public/vendor/`) |
| Math | **MathJax** |
| Headless rendering | **Puppeteer** (`automation/`) |
| App model | Vanilla JS single page — no framework, no backend, no telemetry |

`html2canvas` still ships in `src/html-clips/` for the legacy HTML-clip path, which is being
retired — see [`docs/LEGACY-CLIP-REMOVAL-PLAN.md`](docs/LEGACY-CLIP-REMOVAL-PLAN.md).

---

## 📁 Project Structure

```
studio-pro-editor/
├── index.html                  # the editor — UI + logic (single-page app)
├── src/
│   ├── styles/style.css        # custom styles on top of Tailwind
│   ├── engines/hic/adapters/   # waapi.js — @keyframes → onFrame compiler
│   ├── html-clips/             # html2canvas.min.js (legacy path, being retired)
│   └── workers/export-worker.js# MediaBunny export worker
│
├── public/
│   ├── vendor/                 # lucide, mathjax, perfect-freehand
│   └── fonts/
│
├── automation/                 # terminal pipelines (2)
│   ├── md-render/              # Markdown → Video
│   ├── html-in-canvas/         # HTML-in-Canvas → Video  (cdp | editor)
│   ├── shared/skills/          # AI-agent workflows
│   └── README.md
│
├── docs/
│   ├── html-in-canvas/         # HIC libs + standalone pages
│   ├── automation/             # render architecture plans
│   ├── funding/                # licensing strategy docs
│   └── media/                  # README showcase media
│
├── tools/                      # design-page generators
├── og-image.png
├── vite.config.js · tailwind.config.js · postcss.config.js
└── package.json
```

---

## 📖 Docs & Contributing

- [Contributing guide](CONTRIBUTING.md) — setup, conventions, testing checklist
- [Automation guide](automation/README.md) — the pipelines in full
- [HIC renderer, in isolation](docs/html-in-canvas/test-renderer.html) — the SVG `foreignObject` engine
- [HTML-in-Canvas pipeline plan](docs/automation/HTML-IN-CANVAS-PIPELINE-PLAN.md) — how the two automation folders became one
- [HTML engine consolidation](docs/HTML-ENGINE-CONSOLIDATION-PLAN.md) — the WAAPI → HIC port
- [Legacy clip removal](docs/LEGACY-CLIP-REMOVAL-PLAN.md) — retiring the html2canvas path
- [Licensing strategy](docs/funding/LICENSE_STRATEGY_COMMERCIAL.md) ·
  [license deep-dive](docs/funding/LICENSE_RECOMMENDATION.md)

<div align="center">

*Built for creators who want a pro editing feel with zero setup.*

**Make something great.** 🚀

</div>
