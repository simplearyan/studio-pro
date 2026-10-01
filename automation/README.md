# Studio Pro — Automation Layer

> Render videos from the terminal: **Markdown → Video**, or **HTML-in-Canvas → Video**.
> Two pipelines. Write Markdown for simple videos; write a JS composition for anything that
> needs designed HTML/CSS/JS, with two export strategies behind one command.

## Quick Start

```bash
# 1. Start dev server (required)
cd studio-pro-editor && npm run dev

# 2. Run automation (in another terminal)
cd automation
npm install

# Markdown → Video
node md-render/render.js md-render/scripts/product-launch.md

# HTML-in-Canvas → Video
node html-in-canvas/render.js html-in-canvas/examples/simple-test.js

# …or let the editor's own export pump render it instead
node html-in-canvas/render.js html-in-canvas/examples/simple-test.js -m editor -e ftrt
```

## Two Automation Pipelines

| Pipeline | Input | Command | Best For |
|---|---|---|---|
| **md-render** | `.md` files | `node md-render/render.js md-render/scripts/file.md` | Simple videos, explainers, social posts |
| **html-in-canvas** | `.js` files | `node html-in-canvas/render.js html-in-canvas/examples/file.js` | Designed HTML/CSS/JS compositions, motion graphics, AI agents |

`html-in-canvas` replaced the `html-static` and `html-waapi` pipelines, and both old folders have
been deleted (see
[../docs/automation/HTML-IN-CANVAS-PIPELINE-PLAN.md](../docs/automation/HTML-IN-CANVAS-PIPELINE-PLAN.md)).

**Two export strategies, one command:**

| Flag | Strategy |
|---|---|
| `-m cdp` *(default)* | Standalone page per clip + CDP screenshots + ffmpeg. Deterministic: the same frame index gives the same pixels across runs. |
| `-m editor` | Drive the running editor and let its own export pump render. `-e mediabunny` *(default)*, `-e ftrt`, or `-e standard`. |

The old mode names still work and are mapped, with a warning: `-m gui` / `-m mediabunny` →
`-m editor -e mediabunny`, `-m ftrt` → `-m editor -e ftrt`, `-m standard` → `-m editor -e standard`.

## Folder Structure

```
automation/
├── README.md                    # This file
├── batch.js                     # Batch render (multiple videos)
├── package.json                 # puppeteer-core dependency
│
├── md-render/                   # Pipeline 1: Markdown → Video
│   ├── render.js                # Headless Chrome renderer
│   ├── config.json              # Chrome path, dev server port
│   ├── scripts/                 # Markdown video scripts
│   │   ├── animal-test.md
│   │   ├── explainer.md
│   │   ├── product-launch.md
│   │   ├── short-test.md
│   │   └── social-short.md
│   └── output/                  # Rendered videos
│
├── html-in-canvas/              # Pipeline 2: HTML-in-Canvas → Video
│   ├── render.js                # CLI entry point — --mode cdp|editor
│   ├── api.js                   # Editor client (used by --mode editor)
│   ├── cdp-capture.js           # Standalone page + CDP screenshots (--mode cdp)
│   ├── examples/                # Composition scripts
│   │   ├── india-pollution.js
│   │   ├── kinetic-text.js
│   │   ├── simple-test.js
│   │   ├── social-reel.js
│   │   └── …
│   ├── templates/               # Reusable HTML/CSS/JS
│   │   ├── design-tokens.md
│   │   ├── glassmorphism.html
│   │   ├── gradient-card.html
│   │   └── premium-gradient.html
│   └── output/                  # Rendered videos
│
├── shared/                      # Shared across all pipelines
│   ├── skills/                  # AI agent workflows
│   │   ├── AGENTS.md            # Agent contract (read FIRST)
│   │   ├── html2canvas-gotchas.md
│   │   ├── kinetic-text.md
│   │   ├── product-launch.md
│   │   └── social-reel.md
│   └── tests/                   # Test scripts
│       ├── test-headless.js
│       ├── test-export.js
│       ├── test-debug.js
│       └── test-quick.js
│
├── assets/                      # Shared assets
│   ├── fonts/
│   ├── images/
│   ├── videos/
│   ├── audio/
│   └── templates/
│
└── output/                      # (legacy, now in each pipeline)
```

## Pipeline Comparison

| Feature | md-render | html-in-canvas |
|---|---|---|
| **Input format** | Markdown | JavaScript (StudioPro API) |
| **Clip type** | text/shape/image/math | HTML-in-Canvas (`type: 'hic'`) |
| **HTML clips** | ❌ No | ✅ Yes |
| **Animation** | ❌ No | ✅ One deterministic `onFrame(t)`; CSS `@keyframes` are compiled into it |
| **AI agent effort** | Write markdown | Write a JS composition |
| **Rendering** | the editor's export pump | `-m cdp`: CDP screenshots + ffmpeg, or `-m editor`: the editor's export pump |
| **Export modes** | FTRT, MediaBunny | cdp (default) · editor + mediabunny/ftrt/standard |
| **Status** | ✅ Working | ✅ Working |

## Features

### Export Modes

| Mode | Flag | Speed | Quality |
|---|---|---|---|
| **FTRT** (Fastest) | `--mode ftrt` | ⚡⚡⚡ | Good |
| **MediaBunny** | `--mode mediabunny` | ⚡⚡ | Better |
| **Standard** | `--mode standard` | ⚡ | Best |

### Quality Presets

| Preset | Resolution | Bitrate | FPS |
|---|---|---|---|
| `standard` | 1080p | 8 Mbps | 24 |
| `high` | 1080p | 15 Mbps | 24 |
| `ultra` | 1080p | 30 Mbps | 30 |

### Batch Rendering

```bash
# `batch.js` currently routes ONLY md-render (batch.js:148); there is no
# batch input for HTML-in-Canvas compositions — shell a loop of render.js calls.
node batch.js md-render/scripts/*.md
```

Batching HTML-in-Canvas compositions means shelling a loop of `render.js` calls; wiring
`batch.js` for a second input type is an open item.

## AI Agent Integration

Each pipeline has its own `skills/` folder with agent workflows:

- **shared/skills/AGENTS.md** — Master contract for all agents
- **shared/skills/html2canvas-gotchas.md** — Known html2canvas limitations
- **shared/skills/** — the skill docs themselves (`kinetic-text.md`, `product-launch.md`,
  `social-reel.md`). Neither pipeline has its own `skills/` folder.

### Writing Compositions

```javascript
module.exports = function(StudioPro, State) {
    StudioPro.fonts.loadGoogle('Poppins');

    StudioPro.createComposition({
        id: 'my-video',
        duration: 10,
        clips: [
            StudioPro.html(
                '<div class="card"><h1>Hello World</h1></div>',
                '.card { background: linear-gradient(135deg, #667eea, #764ba2); }',
                '',                                             // js: onFrame(t)
                { start: 0, duration: 5, fonts: ['Poppins'] }
            ),
            StudioPro.text('10× Faster', { start: 5, duration: 5 })
        ]
    });

    // Animations are applied to the created clips.
    StudioPro.keyframes(State.clips[0], {
        opacity: [{ frame: 0, value: 0 }, { frame: 15, value: 100 }]
    });
};
```

> An earlier revision of this section documented `StudioPro.addHtmlClip({ … animated: true })` and
> `data-animate` attributes. **Neither exists** — `addHtmlClip` was never a method on
> `window.StudioPro` (`createHtmlClip`/`createComposition` are), and `data-animate` was a prototype
> in `future-waapi/` that nothing ever imported. The version above is the real API; see
> `shared/skills/AGENTS.md` for the full reference. Note that a bare `StudioPro.html(...)` clip is
> a static HTML-in-Canvas clip — to animate it, either give it a `js` `onFrame(t)` or put CSS
> `@keyframes` in its `css` (the editor compiles them).

## Prerequisites

- Node.js 18+
- Google Chrome (for Puppeteer)
- Vite dev server running on port 3000

## Troubleshooting

**Export fails with "Session closed":**
- Kill stale Chrome: `taskkill //IM chrome.exe //F` (Windows) or `pkill chrome` (Mac/Linux)
- Restart dev server: `npm run dev`

**Blank frames in export:**
- Ensure dev server is Vite (`npm run dev`), not `http-server`
- Check the console for HIC render errors (`[HIC] JS error: …` means the clip's `onFrame` threw)
- In `-m editor`, try `-e mediabunny` instead of `-e ftrt` — FTRT is realtime and can stall

**Fonts missing in export:**
- Use `StudioPro.fonts.loadGoogle("Font Name")` in composition
- Or add Google Fonts link in HTML clip's `<head>`
