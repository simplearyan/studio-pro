# Studio Pro — Automation Layer

Render videos from the terminal using markdown/JSON scripts with system Chrome headless.

## Status

| Feature | Status |
|---|---|
| Standard MP4 export | ✅ Working (1× real-time) |
| Standard WebM export | ✅ Working |
| MediaBunny export | ⚠️ Slow in headless (no GPU) |
| Batch rendering | ✅ Working |
| Template application | ✅ Working |
| Progress display | ✅ Working |

## Setup

```bash
cd automation
npm install
```

Ensure Google Chrome is installed at the path in `config.json`:
- **Windows:** `C:\Program Files\Google\Chrome\Application\chrome.exe`
- **macOS:** `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- **Linux:** `/usr/bin/google-chrome`

## Quick Start

```bash
# Render a markdown script
node render.js scripts/product-launch.md

# Render with custom settings
node render.js scripts/demo.md -o output/demo.mp4 --resolution 720p --fps 24

# Batch render all scripts in a folder
node batch.js scripts/ -o output/ --format mp4
```

## Script Formats

### Markdown (`.md`)

```markdown
---
slideDuration: 3
bg: #1a1a2e
template: product-launch
---

## Introducing ProductX

The future of productivity

---

## Key Features

![feature1](assets/images/feature1.png) [right]

AI-powered automation

---

## Get Started

Visit productx.com
```

### JSON (`.json` / `.spcomp`)

```json
{
  "canvas": { "width": 1920, "height": 1080, "fps": 30 },
  "slides": [
    { "text": "How It Works", "duration": 3, "bg": "#000" },
    { "text": "Step 1", "image": "assets/images/step1.png", "duration": 4 }
  ]
}
```

## CLI Options

### render.js

| Option | Description | Default |
|---|---|---|
| `-o, --output <path>` | Output file path | `output/<name>.mp4` |
| `-r, --resolution <res>` | Resolution: 720p, 1080p, 1440p, 2160p | 1080p |
| `--fps <num>` | Frame rate: 12, 24, 30, 60 | 30 |
| `-f, --format <fmt>` | Format: mp4, webm | mp4 |
| `-q, --quality <preset>` | Quality: draft, standard, high, ultra | high |
| `-t, --template <id>` | Apply design template | none |

### batch.js

| Option | Description | Default |
|---|---|---|
| `-o, --output <dir>` | Output directory | ./output |
| `-r, --resolution <res>` | Resolution for all scripts | 1080p |
| `-f, --format <fmt>` | Format for all scripts | mp4 |
| `-q, --quality <preset>` | Quality for all scripts | high |
| `-t, --template <id>` | Apply template to all | none |
| `--parallel <num>` | Parallel renders | 1 |

## Assets

Place your assets in the `assets/` folder:

```
assets/
├── fonts/        # Custom fonts (TTF, OTF, WOFF2)
├── images/       # Product images, logos, backgrounds
├── videos/       # Intro/outro clips, b-roll
├── audio/        # Music, sound effects
└── templates/    # .sptpl design templates
```

Reference assets in markdown scripts:

```markdown
![hero](assets/images/hero.png)
![logo](assets/images/logo.svg)
```

## Templates

Apply a design template to any script:

```bash
node render.js scripts/demo.md --template explainer
node render.js scripts/launch.md --template product-launch
```

Available templates (built-in):
- `product-launch` — Bold hero, features grid, CTA
- `explainer` — Step-by-step, diagrams, summary
- `shorts-captions` — Vertical, kinetic text, captions
- `minimal` — Clean, simple, professional

## Test Results (August 2026)

### Standard MP4 Export (Recommended for Headless)

| Script | Duration | Export Time | Speed | File Size |
|---|---|---|---|---|
| animal-test.md | 60s | 63.3s | 0.95× | 3.6 MB |
| explainer.md | 24s | 66.3s | 0.36× | 1.2 MB |
| product-launch.md | 15s | 62.6s | 0.24× | 1.3 MB |
| social-short.md | 18s | 62.9s | 0.29× | 958 KB |

**Total: 4 scripts, 255s, all successful**

### Why Standard Export?

Headless Chrome has no GPU, so MediaBunny (WebCodecs) falls back to software encoding (~100× slower). Standard export uses MediaRecorder + captureStream which works at 1× real-time regardless of GPU.

## How It Works

1. Launches system Chrome with `--headless=new`
2. Starts a local HTTP server for Studio Pro
3. Loads `index.html` in headless Chrome
4. Injects your markdown/JSON script
5. Opens export modal and sets parameters
6. Uses MediaRecorder + captureStream to encode
7. Captures the blob and saves to `output/`

## Troubleshooting

### "Chrome not found"

Edit `config.json` and set the correct `chromePath` for your system.

### "Script not found"

Check that the script path is relative to the `automation/` folder.

### Export is slow

- Standard export runs at 1× real-time (60s video = 60s export)
- Chrome startup adds ~10s overhead per script
- For faster encoding, use a machine with GPU for MediaBunny

### Missing assets

All assets referenced in markdown must be in `assets/` or use absolute URLs.

## Architecture

```
automation/
├── package.json      # puppeteer-core (~30MB)
├── render.js         # Single script render
├── batch.js          # Batch render
├── config.json       # Chrome path, defaults
├── assets/           # Local assets
├── scripts/          # Input scripts
└── output/           # Rendered videos (gitignored)
```

## Future: FFmpeg Integration

For 2-3× faster encoding, FFmpeg can be added as an optional encoder:

```bash
# Future: FFmpeg mode
node render.js scripts/demo.md --encoder ffmpeg
```

FFmpeg captures PNG frames from Chrome and encodes them natively, bypassing the browser's MediaRecorder.
