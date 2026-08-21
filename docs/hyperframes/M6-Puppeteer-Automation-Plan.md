# M6 — Puppeteer Automation Layer

> **Date:** August 2026
> **Status:** Plan
> **Goal:** Automate video production using Puppeteer + system Chrome, with JSON/MD scripts and local assets

---

## 1. Architecture

```
studio-pro-editor/
├── automation/                    # ← Separate folder (not in main project)
│   ├── package.json              # Minimal deps: puppeteer-core, sharp
│   ├── render.js                 # Main render script
│   ├── batch.js                  # Batch render multiple scripts
│   ├── server.js                 # Optional: HTTP server for headless rendering
│   ├── assets/                   # Local assets for automation
│   │   ├── fonts/                # Custom fonts (Plus Jakarta Sans, etc.)
│   │   ├── images/               # Product images, logos, backgrounds
│   │   ├── videos/               # Intro/outro clips, b-roll
│   │   ├── audio/                # Music, sound effects
│   │   └── templates/            # Reusable .sptpl design templates
│   ├── scripts/                  # Input scripts (MD or JSON)
│   │   ├── product-launch.md
│   │   ├── explainer.json
│   │   └── social-short.md
│   ├── output/                   # Rendered videos
│   └── config.json              # Chrome path, default settings
├── index.html                    # Main app (unchanged)
└── ...
```

---

## 2. Why Separate Folder?

| Benefit | Explanation |
|---|---|
| **No bloat in main project** | Puppeteer deps (~300MB) don't affect the browser app |
| **System Chrome** | Use installed Chrome instead of bundled Chromium (~150MB savings) |
| **Independent versions** | automation/ can update deps without touching the app |
| **CI/CD friendly** | Install deps only when running automation |
| **Clean git** | automation/ can be .gitignored or separate repo |

---

## 3. How It Works

### Step 1: Write a script (MD or JSON)

**Markdown script** (`scripts/product-launch.md`):
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

**JSON script** (`scripts/explainer.json`):
```json
{
  "canvas": { "width": 1920, "height": 1080, "fps": 30 },
  "slides": [
    { "text": "How It Works", "duration": 3, "bg": "#000000" },
    { "text": "Step 1: Connect", "image": "assets/images/step1.png", "duration": 4 },
    { "text": "Step 2: Configure", "image": "assets/images/step2.png", "duration": 4 },
    { "text": "Step 3: Launch", "image": "assets/images/step3.png", "duration": 4 }
  ]
}
```

### Step 2: Render with Puppeteer

```bash
cd automation
node render.js scripts/product-launch.md --output output/product.mp4
```

### Step 3: What render.js does

1. Launch Chrome with `--headless=new` flag
2. Navigate to `file:///path/to/index.html` (local Studio Pro)
3. Inject the script (MD or JSON)
4. Call `parseMarkdownToClips()` to generate timeline
5. Call `exportSpcomp()` to get the composition
6. Use WebCodecs or MediaRecorder to capture frames
7. Encode to MP4/WebM
8. Save to output/

---

## 4. Implementation Details

### package.json (minimal)

```json
{
  "name": "studio-pro-automation",
  "private": true,
  "type": "module",
  "scripts": {
    "render": "node render.js",
    "batch": "node batch.js",
    "server": "node server.js"
  },
  "dependencies": {
    "puppeteer-core": "^23.0.0",
    "sharp": "^0.33.0"
  }
}
```

### config.json

```json
{
  "chromePath": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "defaultWidth": 1920,
  "defaultHeight": 1080,
  "defaultFps": 30,
  "outputFormat": "mp4",
  "outputBitrate": "8M"
}
```

### render.js (core logic)

```javascript
import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const config = JSON.parse(readFileSync('config.json', 'utf8'));

async function render(scriptPath, outputPath) {
    // 1. Launch Chrome
    const browser = await puppeteer.launch({
        executablePath: config.chromePath,
        headless: 'new',
        args: ['--no-sandbox', '--disable-gpu']
    });

    // 2. Open Studio Pro
    const page = await browser.newPage();
    await page.setViewport({ width: config.defaultWidth, height: config.defaultHeight });
    await page.goto('file:///path/to/index.html');

    // 3. Load script
    const script = readFileSync(scriptPath, 'utf8');
    if (scriptPath.endsWith('.md')) {
        await page.evaluate((md) => {
            State.markdownText = md;
            parseMarkdownToClips();
        }, script);
    } else {
        const json = JSON.parse(script);
        await page.evaluate((data) => importSpcomp(data), json);
    }

    // 4. Render frames
    const frames = await page.evaluate(async () => {
        const frames = [];
        const duration = State.duration;
        const fps = State.exportFps || 30;
        const timeStep = 1 / fps;

        for (let t = 0; t < duration; t += timeStep) {
            State.currentTime = t;
            drawCanvas();
            const bitmap = await createImageBitmap(document.getElementById('renderCanvas'));
            frames.push({ time: t, bitmap });
        }
        return frames;
    });

    // 5. Encode to video (using sharp or FFmpeg)
    // ... encoding logic ...

    // 6. Save
    writeFileSync(outputPath, videoBuffer);

    await browser.close();
}
```

---

## 5. JSON Script Format

```json
{
  "meta": {
    "name": "Product Launch",
    "version": "1.0"
  },
  "canvas": {
    "width": 1920,
    "height": 1080,
    "fps": 30,
    "bg": "#1a1a2e"
  },
  "template": "product-launch",
  "slides": [
    {
      "type": "heading",
      "text": "Introducing ProductX",
      "duration": 3,
      "position": "center",
      "animation": "fadeIn",
      "fontSize": 80
    },
    {
      "type": "text",
      "text": "The future of productivity",
      "duration": 2,
      "position": "bottom",
      "animation": "slideUp"
    },
    {
      "type": "image",
      "src": "assets/images/product.png",
      "duration": 4,
      "position": "center",
      "animation": "zoomIn"
    },
    {
      "type": "composite",
      "elements": [
        { "type": "heading", "text": "Key Features", "position": "top" },
        { "type": "image", "src": "assets/images/feature1.png", "position": "right" },
        { "type": "text", "text": "AI-powered automation", "position": "left" }
      ],
      "duration": 5
    }
  ]
}
```

---

## 6. Batch Rendering

```bash
# Render all scripts in scripts/ folder
node batch.js scripts/ --output output/ --format mp4

# Render with specific template
node batch.js scripts/product-launch.md --template minimal --output output/

# Render multiple resolutions
node batch.js scripts/ --resolution 1080p,720p,4K --output output/
```

---

## 7. Assets Folder Structure

```
assets/
├── fonts/
│   ├── PlusJakartaSans-Bold.ttf
│   ├── PlusJakartaSans-Regular.ttf
│   └── Anton-Regular.ttf
├── images/
│   ├── product-hero.png
│   ├── feature1.png
│   ├── feature2.png
│   ├── background-dark.jpg
│   └── logo.png
├── videos/
│   ├── intro.mp4
│   ├── outro.mp4
│   └── b-roll-*.mp4
├── audio/
│   ├── bgm-corporate.mp3
│   ├── sfx-whoosh.mp3
│   └── sfx-ding.mp3
└── templates/
    ├── product-launch.sptpl
    ├── explainer.sptpl
    └── social-short.sptpl
```

---

## 8. CLI Usage

```bash
# Single render
cd automation
node render.js scripts/product-launch.md -o output/product.mp4

# Batch render
node batch.js scripts/ -o output/ --format mp4

# With custom config
node render.js script.md --config custom-config.json --output out.mp4

# Preview mode (no encode, just frames)
node render.js script.md --preview --frames 30
```

---

## 9. Integration with AI Panel

The AI panel (M5) can generate .spcomp files. The automation layer can:

1. Take AI-generated .spcomp
2. Load into headless Chrome
3. Render to video
4. Save to output/

```bash
# AI generates → automation renders
node render.js ai-output.spcomp -o output/ai-video.mp4
```

---

## 10. Benefits Over Alternatives

| Approach | Pros | Cons |
|---|---|---|
| **Puppeteer + system Chrome** | Fast, no bundled Chromium, uses existing Chrome | Requires Chrome installed |
| **Full Puppeteer** | Bundled Chromium, consistent | ~300MB dependency |
| **Playwright** | Multi-browser support | Heavier dependency |
| **Remotion** | React-based, good DX | Requires React project, build step |
| **FFmpeg + canvas** | Fast encoding | No GUI preview, complex setup |

**Our approach:** Puppeteer-core + system Chrome = lightweight, fast, uses existing installation.

---

## 11. Acceptance Criteria

- [ ] automation/ folder with package.json, render.js, config.json
- [ ] System Chrome detection (configurable path)
- [ ] Markdown script rendering
- [ ] JSON script rendering
- [ ] Local assets loading (fonts, images, videos)
- [ ] Batch rendering (multiple scripts)
- [ ] Output to MP4/WebM
- [ ] CLI interface with options
- [ ] Documentation (README.md in automation/)
- [ ] Integration with M5 AI panel output

---

## 12. Future Enhancements

- **WebUI:** Browser-based batch render interface
- **Queue system:** Process multiple renders in parallel
- **Webhook:** Notify when render completes
- **Cloud render:** Optional cloud Chrome for heavy renders
- **Template marketplace:** Share .sptpl templates
