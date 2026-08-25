# Studio Pro — Automation Layer

> Render videos from the terminal using **Markdown → Video**, **HTML Static → Video**, or **HTML Animated → Video**.
> Three pipelines: write Markdown for simple videos, HTML clips for static content, or WAAPI-animated clips for motion graphics.

## Quick Start

```bash
# 1. Start dev server (required)
cd studio-pro-editor && npm run dev

# 2. Run automation (in another terminal)
cd automation
npm install

# Markdown → Video
node md-render/render.js md-render/scripts/product-launch.md

# HTML Static → Video
node html-static/render.js html-static/examples/product-launch.js

# HTML Animated → Video (future)
node html-waapi/render.js html-waapi/examples/animated-slide.js
```

## Three Automation Pipelines

| Pipeline | Input | Command | Best For |
|---|---|---|---|
| **md-render** | `.md` files | `node md-render/render.js scripts/file.md` | Simple videos, explainers, social posts |
| **html-static** | `.js` files | `node html-static/render.js examples/file.js` | Complex HTML clip compositions, AI agents |
| **html-waapi** | `.js` files | `node html-waapi/render.js examples/file.js` | Animated HTML clips with WAAPI, motion graphics |

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
├── html-static/                 # Pipeline 2: HTML Clips → Video (static)
│   ├── api.js                   # Node.js Puppeteer API
│   ├── render.js                # CLI entry point
│   ├── examples/                # Composition scripts
│   │   ├── india-pollution.js
│   │   ├── kinetic-text.js
│   │   ├── product-launch.js
│   │   ├── simple-test.js
│   │   └── social-reel.js
│   ├── templates/               # Reusable HTML/CSS/JS
│   │   ├── design-tokens.md
│   │   ├── glassmorphism.html
│   │   ├── gradient-card.html
│   │   └── premium-gradient.html
│   ├── skills/                  # (moved to shared/skills/)
│   └── output/                  # Rendered videos
│
├── html-waapi/                  # Pipeline 3: HTML Clips → Video (animated)
│   ├── lib/
│   │   ├── waapi-seek.js        # WAAPI seek engine (deterministic)
│   │   ├── data-animate-adapter.js  # data-animate → WAAPI
│   │   └── svg-renderer.js      # SVG foreignObject capture
│   ├── templates/               # Animated HTML templates
│   │   ├── animated-slide.html
│   │   └── data-animate-slide.html
│   ├── examples/                # Animated compositions
│   ├── skills/                  # Agent skills for animated clips
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

| Feature | md-render | html-static | html-waapi |
|---|---|---|---|
| **Input format** | Markdown | JavaScript (StudioPro API) | JavaScript + data-animate |
| **HTML clips** | ❌ No | ✅ Static | ✅ Animated (WAAPI) |
| **Animation** | ❌ No | ⚠️ Custom animate(t) | ✅ CSS keyframes + WAAPI |
| **AI agent effort** | Write markdown | Write JS composition | Write data-animate HTML |
| **Rendering** | html2canvas | html2canvas | html2canvas + WAAPI seek |
| **Export modes** | FTRT, MediaBunny | FTRT, MediaBunny | FTRT, MediaBunny |
| **Status** | ✅ Working | ✅ Working | 🔬 In development |

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
# Render all markdown scripts
node batch.js md-render/scripts/*.md

# Render all HTML compositions
node batch.js html-static/examples/*.js
```

## AI Agent Integration

Each pipeline has its own `skills/` folder with agent workflows:

- **shared/skills/AGENTS.md** — Master contract for all agents
- **shared/skills/html2canvas-gotchas.md** — Known html2canvas limitations
- **html-static/skills/** — Static HTML clip agent guides
- **html-waapi/skills/** — Animated HTML clip agent guides

### Writing Compositions

**Static (html-static):**
```javascript
StudioPro.project({ name: 'My Video', width: 1920, height: 1080, fps: 30 });
StudioPro.addHtmlClip({
    html: '<h1>Hello World</h1>',
    css: 'h1 { color: white; font-size: 72px; }',
    start: 0, duration: 5
});
```

**Animated (html-waapi):**
```javascript
StudioPro.project({ name: 'My Video', width: 1920, height: 1080, fps: 30 });
StudioPro.addHtmlClip({
    html: '<h1 data-animate="fade-in" data-delay="0.2s">Hello World</h1>',
    css: 'h1 { color: white; font-size: 72px; }',
    start: 0, duration: 5,
    animated: true  // Enable WAAPI seek
});
```

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
- Check console for html2canvas errors
- Try `--mode mediabunny` instead of `--mode ftrt`

**Fonts missing in export:**
- Use `StudioPro.fonts.loadGoogle("Font Name")` in composition
- Or add Google Fonts link in HTML clip's `<head>`
