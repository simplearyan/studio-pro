# M6 — Puppeteer Automation (Final Plan)

> **Date:** August 2026
> **Status:** Phase 1 Complete (scaffold done)
> **Goal:** Automate video production using Puppeteer-core + system Chrome, with MD/JSON scripts, local assets, and MediaBunny encoding (FFmpeg as future enhancement)
> **Depends on:** M0-M5 (deterministic core, FTRT export, templates, .spcomp, agent loop, AI panel)
> **Encoder:** MediaBunny (WebCodecs) now — FFmpeg optional future upgrade

---

## 1. TL;DR

We add an `automation/` folder to Studio Pro that lets you render videos from the terminal using markdown or JSON scripts. It launches system Chrome headless, loads Studio Pro, injects the script, and exports the video — no FFmpeg installation required (uses WebCodecs/MediaBunny inside Chrome), with an optional FFmpeg path for 2-3× faster encoding.

---

## 2. Why a Separate Folder?

| Benefit | Explanation |
|---|---|
| **No bloat in main app** | `puppeteer-core` (~30MB) stays outside the browser app |
| **System Chrome** | Uses installed Chrome — no bundled Chromium (~150MB savings) |
| **Independent versions** | `automation/` updates deps without touching the app |
| **CI/CD friendly** | Install deps only when running automation |
| **Clean git** | Can be `.gitignored` or in a separate repo later |

---

## 3. Architecture

```
studio-pro-editor/
├── automation/
│   ├── package.json              # Only puppeteer-core (~30MB)
│   ├── render.js                 # Main render script
│   ├── batch.js                  # Batch render multiple scripts
│   ├── config.json               # Chrome path, encoder choice, defaults
│   ├── README.md                 # Usage docs
│   ├── assets/                   # Local assets
│   │   ├── fonts/                # Custom fonts (Plus Jakarta Sans, Anton, etc.)
│   │   ├── images/               # Product images, logos, backgrounds
│   │   ├── videos/               # Intro/outro, b-roll clips
│   │   ├── audio/                # Music, SFX
│   │   └── templates/            # .sptpl design templates
│   ├── scripts/                  # Input scripts (MD or JSON)
│   │   ├── product-launch.md
│   │   ├── explainer.json
│   │   └── social-short.md
│   └── output/                   # Rendered videos
├── index.html                    # Main app (unchanged)
└── ...
```

---

## 4. Encoder — MediaBunny Now, FFmpeg Later

### Current: MediaBunny (zero-install)

```
Headless Chrome → loads Studio Pro → WebCodecs encodes → downloads MP4
```

| Pros | Cons |
|---|---|
| No FFmpeg install needed | 2-3× slower than FFmpeg |
| Same code as browser | Limited to H.264, VP9 |
| Deterministic (same Chrome = same output) | No H.265/HEVC |
| Works on any machine with Chrome | No hardware encode control |

**Speed:** 30s text video = ~3s, 30s video = ~15s

### Future: FFmpeg (optional speed boost)

```
Headless Chrome → captures PNG frames → FFmpeg encodes → MP4
```

| Pros | Cons |
|---|---|
| 2-3× faster encoding | Requires FFmpeg installed |
| H.265/HEVC support | Different code path than browser |
| Better rate control | More complex setup |

**Speed:** 30s text video = ~1.5s, 30s video = ~6s

**Decision:** Ship with MediaBunny only. Add FFmpeg as a config option in a future phase.

---

## 5. How It Works (Step by Step)

### Step 1: User writes a script

**Markdown** (`scripts/product-launch.md`):
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

**JSON** (`scripts/explainer.json`):
```json
{
  "canvas": { "width": 1920, "height": 1080, "fps": 30 },
  "slides": [
    { "text": "How It Works", "duration": 3, "bg": "#000" },
    { "text": "Step 1", "image": "assets/images/step1.png", "duration": 4 },
    { "text": "Step 2", "image": "assets/images/step2.png", "duration": 4 }
  ]
}
```

### Step 2: User runs the render command

```bash
cd automation
node render.js scripts/product-launch.md -o output/product.mp4
```

### Step 3: render.js does the work

1. Launch Chrome with `--headless=new`
2. Navigate to `file:///path/to/studio-pro-editor/index.html`
3. Wait for app to load
4. Inject the script (MD → `parseMarkdownToClips()` or JSON → `importSpcomp()`)
5. Optionally apply a template (`applyDesignTemplate()`)
6. Call `openExportModal()` → set format, resolution, fps, quality
7. Click "Start Export" programmatically
8. Wait for export to complete (`State.isExporting === false`)
9. Capture the exported blob from the browser
10. Save to `output/`

### Step 4: Output

```
output/
└── product.mp4    # 30s, 1080p, 30fps, 10 Mbps
```

---

## 6. Implementation Plan

### Phase 1: Scaffold (1 day)

| Task | File | What |
|---|---|---|
| Create `automation/` folder | — | Directory structure |
| `package.json` | `automation/package.json` | `puppeteer-core` only |
| `config.json` | `automation/config.json` | Chrome path, defaults |
| `render.js` skeleton | `automation/render.js` | Launch Chrome, load app, close |

### Phase 2: Script Loading (2 days)

| Task | File | What |
|---|---|---|
| MD script loading | `render.js` | Read .md → inject → `parseMarkdownToClips()` |
| JSON/.spcomp loading | `render.js` | Read .json → inject → `importSpcomp()` |
| Template application | `render.js` | `applyDesignTemplate(id)` before render |
| Asset resolution | `render.js` | Resolve `assets/` paths to absolute file:// URIs |

### Phase 3: Export Capture (3 days)

| Task | File | What |
|---|---|---|
| MediaBunny path | `render.js` | Open export modal → set params → click Start → wait → capture blob |
| FFmpeg path (optional) | `render.js` | Capture frames as PNG → `ffmpeg -framerate 30 -i frame-%d.png -c:v libx264 out.mp4` |
| Progress display | `render.js` | Show ETA, FPS, percentage in terminal |
| Error handling | `render.js` | Timeout, missing assets, Chrome not found |

### Phase 4: CLI Interface (1 day)

| Task | File | What |
|---|---|---|
| Argument parsing | `render.js` | `--output`, `--format`, `--resolution`, `--fps`, `--quality`, `--template` |
| Help text | `render.js` | `node render.js --help` |
| Config override | `render.js` | `--config custom-config.json` |

### Phase 5: Batch Rendering (1 day)

| Task | File | What |
|---|---|---|
| Batch script | `batch.js` | Process all scripts in a folder |
| Parallel renders | `batch.js` | Render N scripts simultaneously (configurable) |
| Output naming | `batch.js` | `{script-name}-{resolution}-{date}.mp4` |
| Summary report | `batch.js` | Show total time, file sizes, successes/failures |

### Phase 6: Documentation (1 day)

| Task | File | What |
|---|---|---|
| README | `automation/README.md` | Setup, usage, examples, troubleshooting |
| Examples | `automation/scripts/` | 3-4 ready-to-render demo scripts |
| Assets | `automation/assets/` | Sample fonts, images for demos |

---

## 7. render.js — Core Logic

```javascript
import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(resolve(__dirname, 'config.json'), 'utf8'));

async function render(scriptPath, options = {}) {
    const {
        output = 'output/render.mp4',
        format = 'mp4',
        resolution = '1080p',
        fps = 30,
        quality = 'high',
        template = null,
        encoder = config.encoder || 'mediabunny'
    } = options;

    console.log(`🎬 Rendering: ${scriptPath}`);
    console.log(`   Format: ${format}, Resolution: ${resolution}, FPS: ${fps}`);
    console.log(`   Encoder: ${encoder}`);

    // 1. Launch Chrome
    const browser = await puppeteer.launch({
        executablePath: config.chromePath,
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--enable-webcodecs',
            '--enable-gpu',
            '--use-angle=swiftshader'  // Software GPU for headless
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // 2. Load Studio Pro
    const appPath = resolve(__dirname, '..', 'index.html');
    await page.goto(`file:///${appPath.replace(/\\/g, '/')}`, {
        waitUntil: 'networkidle0'
    });

    // 3. Wait for app to be ready
    await page.waitForFunction(() => typeof State !== 'undefined', {
        timeout: 10000
    });

    // 4. Load script
    const script = readFileSync(resolve(__dirname, scriptPath), 'utf8');
    const isMarkdown = scriptPath.endsWith('.md');

    if (isMarkdown) {
        await page.evaluate((md) => {
            State.markdownText = md;
            parseMarkdownToClips();
        }, script);
    } else {
        const json = JSON.parse(script);
        await page.evaluate((data) => importSpcomp(data), json);
    }

    // 5. Apply template if specified
    if (template) {
        await page.evaluate((tid) => {
            applyDesignTemplate(tid, 'apply');
        }, template);
    }

    // 6. Set export parameters
    await page.evaluate((params) => {
        openExportModal();
        // Set format, resolution, fps, quality via the UI
        // ... (programmatic UI interaction)
    }, { format, resolution, fps, quality });

    // 7. Start export and wait for completion
    const startTime = Date.now();
    await page.evaluate(() => submitExport());

    await page.waitForFunction(() => !State.isExporting, {
        timeout: 300000  // 5 minute timeout
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Export complete in ${elapsed}s`);

    // 8. Capture output (blob download via CDP)
    // ... (browser-side blob → file transfer)

    await browser.close();
    console.log(`📁 Saved to: ${output}`);
}
```

---

## 8. config.json

```json
{
  "chromePath": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "encoder": "mediabunny",
  "ffmpegPath": null,
  "defaultWidth": 1920,
  "defaultHeight": 1080,
  "defaultFps": 30,
  "defaultQuality": "high",
  "defaultFormat": "mp4",
  "timeout": 300000,
  "parallel": 1,
  "outputDir": "./output"
}
```

### Platform-specific Chrome paths

| OS | Path |
|---|---|
| **Windows** | `C:\Program Files\Google\Chrome\Application\chrome.exe` |
| **macOS** | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` |
| **Linux** | `/usr/bin/google-chrome` |

---

## 9. CLI Usage

```bash
cd automation

# Single render (MediaBunny, default settings)
node render.js scripts/product-launch.md -o output/product.mp4

# Single render with FFmpeg (if installed)
node render.js scripts/product-launch.md -o output/product.mp4 --encoder ffmpeg

# Custom settings
node render.js scripts/product-launch.md \
  --format webm \
  --resolution 720p \
  --fps 24 \
  --quality ultra \
  --template explainer

# Batch render all scripts
node batch.js scripts/ -o output/ --format mp4

# Batch with parallel renders
node batch.js scripts/ -o output/ --parallel 4

# Preview mode (frames only, no video)
node render.js scripts/product-launch.md --preview --frames 30

# List available templates
node render.js --list-templates

# Show help
node render.js --help
```

---

## 10. Batch Rendering

```javascript
// batch.js
import { readdir } from 'fs/promises';
import { render } from './render.js';

async function batch(inputDir, outputDir, options) {
    const files = await readdir(inputDir);
    const scripts = files.filter(f => f.endsWith('.md') || f.endsWith('.json'));

    console.log(`📦 Batch rendering ${scripts.length} scripts...`);

    const results = [];
    for (const script of scripts) {
        const start = Date.now();
        try {
            await render(`${inputDir}/${script}`, {
                output: `${outputDir}/${script.replace(/\.[^.]+$/, '')}.mp4`,
                ...options
            });
            results.push({ script, status: '✅', time: Date.now() - start });
        } catch (err) {
            results.push({ script, status: '❌', error: err.message });
        }
    }

    console.log('\n📊 Batch Summary:');
    console.table(results);
}
```

---

## 11. Integration with Existing Features

| Feature | How automation uses it |
|---|---|
| **M0 — Deterministic** | Same input → same output, every render |
| **M1 — FTRT export** | Faster-than-real-time in headless Chrome |
| **M2 — Templates** | `--template explainer` applies design before render |
| **M3 — .spcomp** | `node render.js script.spcomp -o out.mp4` |
| **M4 — Agent loop** | AI generates .spcomp → automation renders it |
| **M5 — AI panel** | CLI equivalent: prompt → markdown → render |
| **Bitrate presets** | `--quality ultra` maps to the in-app preset |
| **captureStream fix** | Headless Chrome uses the same export path |

---

## 12. Asset Resolution

Assets in scripts are resolved relative to `automation/assets/`:

```markdown
![hero](assets/images/hero.png)        → automation/assets/images/hero.png
![logo](../../shared/logo.svg)          → studio-pro-editor/shared/logo.svg
```

The render script resolves paths to absolute `file://` URIs before injecting into Chrome:

```javascript
function resolveAssetPath(src) {
    if (src.startsWith('http')) return src;  // Already absolute
    if (src.startsWith('data:')) return src;  // Already embedded
    return `file:///${resolve(__dirname, 'assets', src).replace(/\\/g, '/')}`;
}
```

---

## 13. Error Handling

| Error | Handling |
|---|---|
| **Chrome not found** | Show path in config.json, suggest install |
| **Missing asset** | List all missing assets, fail with clear message |
| **Export timeout** | Default 5min, configurable via `--timeout` |
| **Script parse error** | Show line number and error from `parseMarkdownToClips()` |
| **GPU crash** | Retry with `--disable-gpu` flag |
| **Memory overflow** | Reduce parallel count, process scripts sequentially |

---

## 14. File Size Estimates

The automation layer predicts output file size before rendering:

```javascript
function estimateFileSize(duration, resolution, quality) {
    const BITRATE_MAP = { draft: 2, standard: 5, high: 10, ultra: 20 };
    const RESOLUTION_MULT = { '720p': 0.5, '1080p': 1, '1440p': 2, '2160p': 4 };
    const bitrate = BITRATE_MAP[quality] * RESOLUTION_MULT[resolution];
    return ((bitrate * duration) / 8).toFixed(1);  // MB
}
```

---

## 15. Acceptance Criteria

- [ ] `automation/` folder with `package.json`, `render.js`, `config.json`
- [ ] System Chrome detection (configurable path, platform-specific defaults)
- [ ] Markdown script rendering (`.md` → timeline → video)
- [ ] JSON/.spcomp script rendering (`.json`/`.spcomp` → timeline → video)
- [ ] Template application (`--template` flag)
- [ ] Local asset resolution (`assets/` folder, absolute paths)
- [ ] MediaBunny encoding (default, zero-install)
- [ ] FFmpeg encoding (optional, 2-3× faster)
- [ ] CLI interface with `--help`, all options documented
- [ ] Batch rendering (multiple scripts, parallel option)
- [ ] Progress display (ETA, FPS, percentage)
- [ ] Error handling (missing Chrome, missing assets, timeout)
- [ ] README with setup, usage, examples, troubleshooting
- [ ] 3-4 demo scripts in `scripts/` folder
- [ ] Sample assets in `assets/` folder

---

## 16. Implementation Order

```
Day 1:  Phase 1 — Scaffold (package.json, config.json, render.js skeleton)
Day 2-3: Phase 2 — Script loading (MD, JSON, templates, asset resolution)
Day 4-6: Phase 3 — Export capture (MediaBunny path, FFmpeg path, progress)
Day 7:  Phase 4 — CLI interface (arg parsing, help, config override)
Day 8:  Phase 5 — Batch rendering (batch.js, parallel, summary)
Day 9:  Phase 6 — Documentation (README, examples, assets)
Day 10: Testing + polish
```

---

## 17. Future Enhancements

| Enhancement | Description |
|---|---|
| **WebUI** | Browser-based batch render interface |
| **Queue system** | Process multiple renders in parallel with job queue |
| **Webhook** | Notify when render completes (Slack, Discord, email) |
| **Cloud render** | Optional cloud Chrome for heavy renders |
| **Template marketplace** | Share `.sptpl` templates |
| **Watch mode** | Re-render when script file changes |
| **Incremental render** | Only re-render changed slides |
| **Multi-resolution** | Render same script at 720p + 1080p + 4K in one pass |
