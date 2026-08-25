# MD Render — Markdown to Video

> Write Markdown → Get video. Simple, fast, no code required.

---

## Quick Start

```bash
# 1. Start dev server (from project root)
cd studio-pro-editor && npm run dev

# 2. Render a video (from automation/)
cd automation
node md-render/render.js scripts/social-short.md
```

---

## How It Works

```
Markdown Script
      ↓
Parse into clips (text, images, audio)
      ↓
Load into StudioPro timeline
      ↓
Export via FTRT or MediaBunny
      ↓
MP4/WebM file
```

---

## CLI Usage

```bash
node md-render/render.js <script.md> [options]

Options:
  -q, --quality <draft|standard|high|ultra>   Video quality (default: ultra)
  -f, --format <ftrt-mp4|mediabunny-mp4|...>  Export format (default: ftrt-mp4)
  -r, --resolution <720p|1080p|1440p|2160p>   Output resolution (default: 1080p)
  --fps <24|30|60>                             Frames per second (default: 30)
  --debug                                      Show Chrome window (for debugging)
  --url <http://localhost:3000>                StudioPro dev server URL
```

### Examples

```bash
# Default: FTRT + ultra + 30fps + 1080p
node md-render/render.js scripts/social-short.md

# MediaBunny mode, high quality
node md-render/render.js scripts/product-launch.md -f mediabunny-mp4 -q high

# Low resolution draft
node md-render/render.js scripts/explainer.md -r 720p -q draft

# Debug mode (Chrome visible)
node md-render/render.js scripts/short-test.md --debug
```

---

## Markdown Format

Scripts are plain Markdown with special syntax:

```markdown
# Video Title

This is the first scene. The text becomes a clip.

![Image Alt](path/to/image.jpg)

This is another scene with an image above.

---

New section after the divider.
```

### Supported Elements

| Element | Syntax | Result |
|---|---|---|
| Text | Plain paragraphs | Text clips |
| Headers | `# Title` | Large text |
| Images | `![alt](url)` | Image clips |
| Dividers | `---` | Scene breaks |
| Bold | `**text**` | Bold text |
| Links | `[text](url)` | Clickable text |

---

## Scripts

| Script | Duration | Description |
|---|---|---|
| `scripts/social-short.md` | 18s | Social media short (14 clips) |
| `scripts/product-launch.md` | 15s | Product launch video |
| `scripts/explainer.md` | 24s | Explainer video |
| `scripts/animal-test.md` | 60s | Test with 3 images |
| `scripts/short-test.md` | 10s | Quick test |

---

## Output

Videos are saved to `md-render/output/` with naming:

```
{script-name}_{quality}_{fps}fps_{format}_{resolution}.mp4
```

Example: `social-short_ultra_30Mbps_30fps_FTRT-H264_1080p.mp4`

---

## Quality Presets

| Preset | Bitrate | FPS | Use Case |
|---|---|---|---|
| `draft` | 3 Mbps | 30 | Quick preview |
| `standard` | 8 Mbps | 24 | Balanced |
| `high` | 15 Mbps | 24 | Good quality |
| `ultra` | 30 Mbps | 30 | Best quality |

---

## Export Modes

| Mode | Flag | Speed | Description |
|---|---|---|---|
| FTRT | `-f ftrt-mp4` | 4× realtime | Fastest — frame-index loop |
| MediaBunny | `-f mediabunny-mp4` | 1× realtime | Reliable — uses WebCodecs |
| Standard | `-f std-mp4` | 1× realtime | Standard export |

---

## Batch Rendering

```bash
# Render all scripts
for f in md-render/scripts/*.md; do
  node md-render/render.js "$f" -q ultra
done
```

Or use the batch script:
```bash
node batch.js md-render/scripts/ -q ultra
```

---

## Prerequisites

- Node.js 18+
- Google Chrome installed
- Vite dev server running on port 3000 (`npm run dev`)

---

## Troubleshooting

**"Script not found"**
- Run from `automation/` directory
- Use relative path: `scripts/social-short.md` (not `md-render/scripts/...`)

**Export fails with "Session closed"**
- Kill stale Chrome: `taskkill //IM chrome.exe //F` (Windows)
- Restart dev server: `npm run dev`

**Blank video**
- Ensure dev server is Vite, not http-server
- Check `--debug` mode to see Chrome

**Wrong output path**
- Output goes to `md-render/output/` by default
- Use `-o path/to/file.mp4` to override
