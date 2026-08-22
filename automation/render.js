#!/usr/bin/env node

/**
 * Studio Pro — Headless Render Script
 *
 * Renders a markdown or JSON script to MP4/WebM using system Chrome.
 * Connects to the running Vite dev server (same approach as canvas-labs-portal).
 *
 * Prerequisites:
 *   1. Run "npm run dev" in studio-pro-editor/ (starts Vite on port 3000)
 *   2. Run "node automation/render.js scripts/product-launch.md"
 */

import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Config ───────────────────────────────────────────────────────────────────

const config = JSON.parse(readFileSync(resolve(__dirname, 'config.json'), 'utf8'));

const RESOLUTION_MAP = {
  '720p':  { w: 1280, h: 720 },
  '1080p': { w: 1920, h: 1080 },
  '1440p': { w: 2560, h: 1440 },
  '2160p': { w: 3840, h: 2160 }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function checkPort(port) {
  return new Promise((resolve) => {
    // Try IPv4 first, then IPv6 (Vite may listen on either)
    const tryConnect = (host) => {
      const req = http.get(`http://${host}:${port}/`, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => {
        if (host === '127.0.0.1') tryConnect('localhost');
        else if (host === 'localhost') tryConnect('::1');
        else resolve(false);
      });
      req.setTimeout(2000, () => { req.destroy(); resolve(false); });
    };
    tryConnect('127.0.0.1');
  });
}

async function findDevServer() {
  // Check configured port first, then common Vite ports
  const ports = [config.devServerPort || 3000, 3001, 3002, 5173, 5174];
  for (const port of ports) {
    if (await checkPort(port)) {
      return `http://localhost:${port}`;
    }
  }
  return null;
}

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
    debug: false,
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
      case '--debug':
        result.debug = true;
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

Prerequisites:
  Start the dev server first:
    cd studio-pro-editor && npm run dev

Usage:
  node render.js <script> [options]

Options:
  -o, --output <path>       Output file path (default: output/<name>.mp4)
  -r, --resolution <res>    Resolution: 720p, 1080p, 1440p, 2160p (default: 1080p)
  --fps <num>               Frame rate: 12, 24, 30, 60 (default: 30)
  -f, --format <fmt>        Format: mp4, webm, mediabunny-mp4, mediabunny-webm (default: mp4)
  -q, --quality <preset>    Quality: draft, standard, high, ultra (default: high)
  -t, --template <id>       Apply design template before render
  --debug                   Open Chrome window for debugging (default: headless)
  -h, --help                Show this help

Examples:
  node render.js scripts/product-launch.md
  node render.js scripts/demo.md -o output/demo.mp4 -r 720p
  node render.js scripts/launch.md -f mediabunny-mp4 --debug
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
  console.log(`   Script:     ${scriptPath}`);
  console.log(`   Output:     ${outputPath}`);
  console.log(`   Resolution: ${width}×${height}`);
  console.log(`   FPS:        ${fps}`);
  console.log(`   Format:     ${format}`);
  console.log(`   Quality:    ${quality}`);
  console.log(`   Debug:      ${options.debug ? 'Yes (Chrome visible)' : 'No (headless)'}`);
  if (template) console.log(`   Template:   ${template}`);
  console.log('');

  // Ensure output directory exists
  const outDir = dirname(outputPath);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  // 1. Find dev server (canvas-labs-portal approach: connect to running server)
  console.log('📂 Finding dev server...');
  let devUrl = await findDevServer();
  
  if (!devUrl) {
    console.error('\n❌ Dev server not found!');
    console.error('   Please start the dev server first:');
    console.error('   cd studio-pro-editor && npm run dev');
    console.error('');
    console.error('   Or set the port in automation/config.json');
    process.exit(1);
  }
  console.log(`   Found: ${devUrl}`);

  // 2. Launch Chrome — headless by default, visible window with --debug
  console.log(`🚀 Launching Chrome (${options.debug ? 'visible window' : 'headless'})...`);
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: config.chromePath,
      headless: options.debug ? false : 'new',  // false = visible, 'new' = headless
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--enable-webcodecs'
      ]
    });
  } catch (err) {
    console.error(`\n❌ Chrome not found at: ${config.chromePath}`);
    console.error('   Edit automation/config.json to set the correct chromePath.');
    process.exit(1);
  }

  const page = await browser.newPage();
  await page.setViewport({ width, height });

  // Collect console logs for debugging
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[MB') || text.includes('[Export') || text.includes('Error')) {
      console.log(`  [browser] ${text}`);
    }
  });

  try {
    // 3. Load Studio Pro from dev server (full CSS/JS loaded)
    console.log(`📂 Loading from ${devUrl}...`);
    await page.goto(devUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for app to initialize
    await page.waitForFunction(() => 
      typeof State !== 'undefined' && 
      typeof window.startMediaBunnyExport === 'function' &&
      typeof openExportModal === 'function' &&
      typeof submitExport === 'function', 
    { timeout: 20000 });
    console.log('✅ App loaded');

    // 4. Load script
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
    console.log('✅ Script loaded:', await page.evaluate(() => State.clips.length), 'clips');

    // 5. Apply template if specified
    if (template) {
      console.log(`🎨 Applying template: ${template}...`);
      await page.evaluate((tid) => {
        window.applyDesignTemplate(tid, 'apply');
      }, template);
      console.log('✅ Template applied');
    }

    // 6. Export
    console.log('📤 Starting export...');
    const startTime = Date.now();

    // Format mapping — use MediaBunny for GPU-accelerated export
    const FORMAT_VALUE = {
      'mp4': 'video-mediabunny-mp4',
      'webm': 'video-mediabunny',
      'mediabunny-mp4': 'video-mediabunny-mp4',
      'mediabunny-webm': 'video-mediabunny',
      'std-mp4': 'video-mp4',
      'std-webm': 'video-webm',
      'ftrt-mp4': 'video-ftrt-mp4',
      'ftrt-webm': 'video-ftrt-webm'
    };

    const RES_VALUE = { '720p': '1280', '1080p': '1920', '1440p': '2560', '2160p': '3840' };

    await page.evaluate((params) => {
      openExportModal();

      function setRadio(name, value) {
        const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
        if (radio) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      setRadio('exportFormat', params.formatValue);
      setRadio('exportResolution', params.resValue);
      setRadio('exportFrameRate', String(params.fps));
      if (params.quality) setExportQuality(params.quality);
      setRadio('exportScope', 'full');
      exportSelectOption();
    }, {
      formatValue: FORMAT_VALUE[format] || 'video-mediabunny-mp4',
      resValue: RES_VALUE[resolution] || '1920',
      fps,
      quality
    });

    // Click Start Export
    await page.evaluate(() => submitExport());

    // Monitor progress
    console.log('⏳ Rendering...');
    const exportStart = Date.now();
    let lastProgress = -1;

    while (true) {
      const status = await page.evaluate(() => ({
        done: !State.isExporting,
        progress: parseInt(document.getElementById('exportProgressText')?.textContent) || 0,
        currentTime: State.currentTime || 0
      }));

      if (status.done) break;

      const p = status.progress;
      if (p >= lastProgress + 5) {
        lastProgress = p;
        const elapsedSec = ((Date.now() - exportStart) / 1000).toFixed(0);
        process.stdout.write(`\r   ${p}% (${elapsedSec}s) t=${status.currentTime.toFixed(1)}s`);
      }

      await new Promise(r => setTimeout(r, 500));
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n\n✅ Export complete in ${elapsed}s`);

    // 7. Capture blob
    console.log('📥 Capturing export...');
    await new Promise(r => setTimeout(r, 1000));

    const blobData = await page.evaluate(async () => {
      if (!window._exportDoneUrl) return { error: '_exportDoneUrl is null' };
      try {
        const resp = await fetch(window._exportDoneUrl);
        const blob = await resp.blob();
        return new Promise(resolve => {
          const reader = new FileReader();
          reader.onloadend = () => resolve({ data: reader.result, size: blob.size });
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        return { error: e.message };
      }
    });

    if (blobData?.error) {
      console.log(`⚠️  Blob capture failed: ${blobData.error}`);
      console.log('   The video was downloaded by Chrome.');
    } else if (blobData?.data) {
      const base64 = blobData.data.split(',')[1];
      const buffer = Buffer.from(base64, 'base64');
      writeFileSync(outputPath, buffer);
      console.log(`📁 Saved: ${outputPath}`);
      console.log(`📊 Size: ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);
    }

  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    process.exit(1);
  } finally {
    await browser.close();
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
