# Studio Pro — Automation Layer

Render videos from the terminal using markdown/JSON scripts with system Chrome.

## Status

| Feature | Status |
|---|---|
| MediaBunny MP4 export | ✅ Working (1× real-time with GPU) |
| MediaBunny WebM export | ✅ Working |
| Standard MP4 export | ✅ Working |
| Batch rendering | ✅ Working |
| Template application | ✅ Working |
| Progress display | ✅ Working |

## Prerequisites

**You MUST start the dev server before running automation:**

```bash
# Terminal 1: Start dev server
cd studio-pro-editor
npm run dev

# Terminal 2: Run automation
cd automation
node render.js scripts/product-launch.md
```

The automation connects to the running Vite dev server (like canvas-labs-portal).

## Quick Start

```bash
# Single render
node render.js scripts/product-launch.md

# Custom output
node render.js scripts/demo.md -o output/demo.mp4 -r 720p

# Batch render
node batch.js scripts/ -o output/ -f mp4
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

## CLI Options

### render.js

| Option | Description | Default |
|---|---|---|
| `-o, --output <path>` | Output file path | `output/<name>.mp4` |
| `-r, --resolution <res>` | Resolution: 720p, 1080p, 1440p, 2160p | 1080p |
| `--fps <num>` | Frame rate: 12, 24, 30, 60 | 30 |
| `-f, --format <fmt>` | Format: mp4, webm, mediabunny-mp4, std-mp4 | mp4 |
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

## Test Results (August 2026)

### MediaBunny MP4 (Recommended)

| Script | Duration | Export Time | Speed | File Size |
|---|---|---|---|---|
| animal-test.md | 60s | 67.4s | 0.89× | 5.2 MB |
| explainer.md | 24s | 69.0s | 0.35× | 1.8 MB |
| product-launch.md | 15s | 68.0s | 0.22× | 1.7 MB |
| social-short.md | 18s | 65.8s | 0.27× | 1.1 MB |

**Total: 4 scripts, 270s, all successful**

### Key Metrics

- **FPS:** Consistent 30.0 fps
- **Drift:** Only 1-3ms
- **Quality:** Excellent (GPU-accelerated H.264)

## How It Works

1. **Connects to dev server** — Uses running Vite server (same as canvas-labs-portal)
2. **Launches Chrome with GPU** — `headless: false` for hardware acceleration
3. **Loads Studio Pro** — Full CSS/JS from dev server
4. **Injects script** — Markdown or JSON
5. **Exports via MediaBunny** — WebCodecs with GPU
6. **Captures blob** — Saves to output folder

## Configuration

Edit `config.json`:

```json
{
  "chromePath": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "devServerPort": 3000,
  "defaultWidth": 1920,
  "defaultHeight": 1080,
  "defaultFps": 30,
  "defaultFormat": "mp4",
  "defaultQuality": "high"
}
```

## Troubleshooting

### "Dev server not found"

Start the dev server first:
```bash
cd studio-pro-editor && npm run dev
```

### "Chrome not found"

Edit `automation/config.json` and set the correct `chromePath`.

### Export is slow

- Ensure dev server is running
- Check that Chrome has GPU access
- Use `-f mp4` for best performance

## Architecture

```
automation/
├── package.json      # puppeteer-core (~30MB)
├── render.js         # Single script render
├── batch.js          # Batch render
├── config.json       # Chrome path, dev server port
├── assets/           # Local assets
├── scripts/          # Input scripts
└── output/           # Rendered videos (gitignored)
```

## Reference

This approach is based on the canvas-labs-portal preview-automator, which uses:
- `headless: false` for GPU access
- Running dev server for full app loading
- Puppeteer-core for Chrome automation
