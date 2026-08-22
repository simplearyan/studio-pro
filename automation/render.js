#!/usr/bin/env node

/**
 * Studio Pro — Headless Render Script
 *
 * Renders a markdown or JSON script to MP4/WebM using system Chrome headless.
 * Uses MediaBunny (WebCodecs) for encoding — no FFmpeg required.
 *
 * Usage:
 *   node render.js <script> [options]
 *
 * Examples:
 *   node render.js scripts/product-launch.md
 *   node render.js scripts/explainer.json -o output/explainer.mp4
 *   node render.js scripts/demo.md --resolution 720p --fps 24
 */

import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Config ───────────────────────────────────────────────────────────────────

const config = JSON.parse(readFileSync(resolve(__dirname, 'config.json'), 'utf8'));

const RESOLUTION_MAP = {
  '720p':  { w: 1280, h: 720 },
  '1080p': { w: 1920, h: 1080 },
  '1440p': { w: 2560, h: 1440 },
  '2160p': { w: 3840, h: 2160 }
};

// ─── Argument Parsing ─────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    script: null,
    output: null,
    resolution: '1080p',
    fps: 30,
    format: 'mp4',
    quality: 'high',
    template: null,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '-o': case '--output':
        result.output = args[++i];
        break;
      case '-r': case '--resolution':
        result.resolution = args[++i];
        break;
      case '--fps':
        result.fps = parseInt(args[++i], 10);
        break;
      case '-f': case '--format':
        result.format = args[++i];
        break;
      case '-q': case '--quality':
        result.quality = args[++i];
        break;
      case '-t': case '--template':
        result.template = args[++i];
        break;
      case '-h': case '--help':
        result.help = true;
        break;
      default:
        if (!arg.startsWith('-') && !result.script) {
          result.script = arg;
        }
    }
  }

  return result;
}

function showHelp() {
  console.log(`
Studio Pro — Headless Render

Usage:
  node render.js <script> [options]

Options:
  -o, --output <path>       Output file path (default: output/<script-name>.mp4)
  -r, --resolution <res>    Resolution: 720p, 1080p, 1440p, 2160p (default: 1080p)
  --fps <num>               Frame rate: 12, 24, 30, 60 (default: 30)
  -f, --format <fmt>        Format: mp4, webm (default: mp4)
  -q, --quality <preset>    Quality: draft, standard, high, ultra (default: high)
  -t, --template <id>       Apply design template before render
  -h, --help                Show this help

Examples:
  node render.js scripts/product-launch.md
  node render.js scripts/demo.md -o output/demo.mp4 --resolution 720p
  node render.js scripts/explainer.json --quality ultra --fps 60
  `);
}

// ─── Core Render ──────────────────────────────────────────────────────────────

async function render(scriptPath, options) {
  const {
    output,
    resolution = '1080p',
    fps = 30,
    format = 'mp4',
    quality = 'high',
    template = null
  } = options;

  const { w: width, h: height } = RESOLUTION_MAP[resolution] || RESOLUTION_MAP['1080p'];
  const scriptName = basename(scriptPath).replace(/\.[^.]+$/, '');
  const outputPath = output || resolve(config.outputDir, `${scriptName}.${format}`);

  console.log(`\n🎬 Studio Pro — Headless Render`);
  console.log(`   Script:    ${scriptPath}`);
  console.log(`   Output:    ${outputPath}`);
  console.log(`   Resolution: ${width}×${height}`);
  console.log(`   FPS:       ${fps}`);
  console.log(`   Format:    ${format}`);
  console.log(`   Quality:   ${quality}`);
  if (template) console.log(`   Template:  ${template}`);
  console.log('');

  // Ensure output directory exists
  const outDir = dirname(outputPath);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  // 1. Launch Chrome
  console.log('🚀 Launching Chrome headless...');
  let browser;
  let server = null;
  try {
    browser = await puppeteer.launch({
      executablePath: config.chromePath,
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--enable-webcodecs',
        '--enable-unsafe-swiftshader'
      ]
    });
  } catch (err) {
    console.error(`\n❌ Chrome not found at: ${config.chromePath}`);
    console.error('   Edit config.json to set the correct chromePath for your system.');
    console.error('   Windows: C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
    console.error('   macOS:   /Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    console.error('   Linux:   /usr/bin/google-chrome');
    process.exit(1);
  }

  const page = await browser.newPage();
  await page.setViewport({ width, height });

  try {
    // 2. Load Studio Pro via HTTP (file:// has CORS restrictions for some features)
    console.log('📂 Loading Studio Pro...');
    
    // Start a local HTTP server if not already running
    const http = await import('http');
    const fs = await import('fs');
    const path = await import('path');
    const appDir = resolve(__dirname, '..');
    
    let port = 3099;
    try {
      server = http.createServer((req, res) => {
        let filePath = path.join(appDir, req.url === '/' ? 'index.html' : req.url);
        if (!fs.existsSync(filePath)) { res.writeHead(404); res.end(); return; }
        const ext = path.extname(filePath);
        const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
        res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      });
      await new Promise((resolve, reject) => {
        server.listen(port, '127.0.0.1', () => resolve());
        server.on('error', reject);
      });
      console.log(`   HTTP server on port ${port}`);
    } catch (err) {
      // Port might be in use, try next
      port = 3100;
      server = http.createServer((req, res) => {
        let filePath = path.join(appDir, req.url === '/' ? 'index.html' : req.url);
        if (!fs.existsSync(filePath)) { res.writeHead(404); res.end(); return; }
        const ext = path.extname(filePath);
        const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
        res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      });
      await new Promise((resolve, reject) => {
        server.listen(port, '127.0.0.1', () => resolve());
        server.on('error', reject);
      });
      console.log(`   HTTP server on port ${port}`);
    }

    await page.goto(`http://127.0.0.1:${port}/index.html`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for app to initialize and all functions to be defined
    await page.waitForFunction(() => 
      typeof State !== 'undefined' && 
      typeof window.startMediaBunnyExport === 'function' &&
      typeof openExportModal === 'function' &&
      typeof submitExport === 'function', 
    {
      timeout: 20000
    });
    console.log('✅ App loaded');

    // 3. Load script
    const script = readFileSync(resolve(__dirname, scriptPath), 'utf8');
    const isMarkdown = scriptPath.endsWith('.md');

    console.log('📜 Loading script...');
    if (isMarkdown) {
      await page.evaluate((md) => {
        State.markdownText = md;
        parseMarkdownToClips();
      }, script);
    } else {
      const json = JSON.parse(script);
      await page.evaluate((data) => importSpcomp(data), json);
    }
    console.log('✅ Script loaded');

    // 4. Apply template if specified
    if (template) {
      console.log(`🎨 Applying template: ${template}...`);
      await page.evaluate((tid) => {
        window.applyDesignTemplate(tid, 'apply');
      }, template);
      console.log('✅ Template applied');
    }

    // 5. Export
    console.log('📤 Starting export...');
    const startTime = Date.now();

    // Resolution mapping: 720p -> 1280, 1080p -> 1920, 1440p -> 2560, 2160p -> 3840
    const RES_VALUE = { '720p': '1280', '1080p': '1920', '1440p': '2560', '2160p': '3840' };
    // Format mapping — headless Chrome has no GPU, so WebCodecs (MediaBunny/FTRT)
    // falls back to software encoding which is ~100× slower.
    // Standard export uses MediaRecorder + captureStream which works at 1× real-time.
    const FORMAT_VALUE = {
      'mp4': 'video-mp4',           // Standard MP4 (default for headless)
      'webm': 'video-webm',         // Standard WebM
      'mediabunny-mp4': 'video-mediabunny-mp4',  // MediaBunny MP4 (slow in headless)
      'mediabunny-webm': 'video-mediabunny',      // MediaBunny WebM (slow in headless)
      'ftrt-mp4': 'video-ftrt-mp4',  // FTRT MP4 (slow in headless)
      'ftrt-webm': 'video-ftrt-webm' // FTRT WebM (slow in headless)
    };
    const FPS_VALUE = String(fps);

    await page.evaluate((params) => {
      // Open export modal
      openExportModal();

      // Helper: check a radio button by name and value and fire change event
      function setRadio(name, value) {
        const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
        if (radio) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      // Set format
      setRadio('exportFormat', params.formatValue);

      // Set resolution
      setRadio('exportResolution', params.resValue);

      // Set FPS
      setRadio('exportFrameRate', params.fpsValue);

      // Set quality
      if (params.quality) setExportQuality(params.quality);

      // Ensure full timeline is selected
      setRadio('exportScope', 'full');

      // Update UI to reflect selections
      exportSelectOption();
    }, {
      formatValue: FORMAT_VALUE[format] || 'video-mediabunny-mp4',
      resValue: RES_VALUE[resolution] || '1920',
      fpsValue: FPS_VALUE,
      quality
    });

    // Click Start Export (this reads the radio buttons and starts the correct encoder)
    await page.evaluate(() => submitExport());

    // Wait for export to complete with progress display
    console.log('⏳ Rendering...');
    const exportStart = Date.now();
    let lastProgress = -1;

    while (true) {
      const status = await page.evaluate(() => {
        if (!State.isExporting) return { done: true };
        const progress = State.exportProgress || 0;
        return { done: false, progress };
      });

      if (status.done) break;

      // Show progress every 5%
      const p = Math.floor(status.progress || 0);
      if (p >= lastProgress + 5) {
        lastProgress = p;
        const elapsedSec = ((Date.now() - exportStart) / 1000).toFixed(0);
        process.stdout.write(`\r   ${p}% complete (${elapsedSec}s elapsed)`);
      }

      await new Promise(r => setTimeout(r, 500));
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n\n✅ Export complete in ${elapsed}s`);

    // 6. Capture the exported file via _exportDoneUrl (blob URL)
    console.log('📥 Capturing export...');
    const exportData = await page.evaluate(async () => {
      // Wait for the blob URL to be set
      for (let i = 0; i < 50; i++) {
        if (window._exportDoneUrl) break;
        await new Promise(r => setTimeout(r, 100));
      }
      if (!window._exportDoneUrl) return null;

      // Fetch the blob and convert to base64
      const resp = await fetch(window._exportDoneUrl);
      const blob = await resp.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    });

    if (exportData) {
      const base64 = exportData.split(',')[1];
      const buffer = Buffer.from(base64, 'base64');
      writeFileSync(outputPath, buffer);
      console.log(`📁 Saved to: ${outputPath}`);
      console.log(`📊 Size: ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);
    } else {
      console.log('⚠️  Export completed but blob not captured.');
      console.log('   The video was downloaded by Chrome to the default downloads folder.');
    }

  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    process.exit(1);
  } finally {
    await browser.close();
    if (server) { try { server.close(); } catch (_) {} }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const opts = parseArgs();

if (opts.help || !opts.script) {
  showHelp();
  process.exit(opts.help ? 0 : 1);
}

if (!existsSync(resolve(__dirname, opts.script))) {
  console.error(`❌ Script not found: ${opts.script}`);
  process.exit(1);
}

render(opts.script, opts).catch((err) => {
  console.error(`❌ Fatal: ${err.message}`);
  process.exit(1);
});
