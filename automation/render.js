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
    format: 'ftrt-mp4',  // Default to FTRT (faster than realtime)
    quality: 'ultra',    // Default to ultra quality
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
  -o, --output <path>       Output file path (default: auto-generated with all params)
  -r, --resolution <res>    720p, 1080p, 1440p, 2160p (default: 1080p)
  --fps <num>               12, 24, 30, 60 (default: 30)
  -f, --format <fmt>        Render mode + codec:
                              ftrt-mp4      FTRT + H.264 (4× realtime, recommended)
                              ftrt-webm     FTRT + VP9 (4× realtime, smaller files)
                              mediabunny-mp4  MediaBunny + H.264 (1× realtime)
                              mediabunny-webm MediaBunny + VP9 (1× realtime)
                              std-mp4       Standard + H.264 (1× realtime, fallback)
                              std-webm      Standard + VP9 (1× realtime, fallback)
                            (default: ftrt-mp4)
  -q, --quality <preset>    Quality preset with bitrate cap:
                              draft     3 Mbps  — Quick preview, small files
                              standard  8 Mbps  — Social media quality
                              high     15 Mbps  — YouTube recommended
                              ultra    30 Mbps  — Maximum quality
                            (default: ultra)
  -t, --template <id>       Apply design template before render
  --debug                   Open Chrome window for debugging (default: headless)
  -h, --help                Show this help

Default Parameters:
  --format   ftrt-mp4    (FTRT + H.264, 4× realtime)
  --quality  ultra       (30 Mbps cap, maximum quality)
  --fps      30          (30 frames per second)
  --resolution 1080p     (1920×1080 Full HD)
  --debug    false       (headless mode, no Chrome window)

Output Filename Convention:
  scriptname_quality_fps_encoder_resolution.ext
  Example: social-short_ultra_30Mbps_30fps_FTRT-H264_1080p.mp4

  Encoder labels:
    FTRT-H264   Fast export, H.264 (default, 4× realtime)
    FTRT-VP9    Fast export, VP9 (4× realtime, smaller)
    MB-H264     MediaBunny, H.264 (1× realtime)
    MB-VP9      MediaBunny, VP9 (1× realtime)
    STD-H264    Standard, H.264 (1× realtime)
    STD-VP9     Standard, VP9 (1× realtime)

Examples:
  # Default: FTRT + ultra + 30fps + 1080p
  node render.js scripts/product-launch.md
  # Output: product-launch_ultra_30Mbps_30fps_FTRT-H264_1080p.mp4

  # Custom quality and FPS
  node render.js scripts/demo.md -q high --fps 60
  # Output: demo_high_15Mbps_60fps_FTRT-H264_1080p.mp4

  # MediaBunny mode
  node render.js scripts/demo.md -f mediabunny-mp4
  # Output: demo_ultra_30Mbps_30fps_MB-H264_1080p.mp4

  # Low resolution draft
  node render.js scripts/demo.md -r 720p -q draft
  # Output: demo_draft_3Mbps_30fps_FTRT-H264_720p.mp4
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
  
  // Generate detailed filename with all parameters
  // Format: scriptname_quality_fps_encoder_format_resolution.mp4
  // Example: social-short_ultra_30fps_FTRT-H264_1080p.mp4
  //
  // Encoder labels:
  //   FTRT-H264   = Fast export, H.264 codec (default, 4× realtime)
  //   FTRT-VP9    = Fast export, VP9 codec
  //   MB-H264     = MediaBunny, H.264 codec (1× realtime)
  //   MB-VP9      = MediaBunny, VP9 codec
  //   STD-H264    = Standard captureStream, H.264 (1× realtime)
  //   STD-VP9     = Standard captureStream, VP9
  //
  // Quality labels (with bitrate):
  //   ultra_30Mbps  = Maximum quality, 30 Mbps cap
  //   high_15Mbps   = YouTube standard, 15 Mbps cap
  //   standard_8Mbps = Social media, 8 Mbps cap
  //   draft_3Mbps   = Quick preview, 3 Mbps cap
  
  const ENCODER_MAP = {
    'ftrt-mp4': 'FTRT-H264',
    'ftrt-webm': 'FTRT-VP9',
    'mediabunny-mp4': 'MB-H264',
    'mediabunny-webm': 'MB-VP9',
    'std-mp4': 'STD-H264',
    'std-webm': 'STD-VP9'
  };
  
  const QUALITY_MAP = {
    'ultra': 'ultra_30Mbps',
    'high': 'high_15Mbps',
    'standard': 'standard_8Mbps',
    'draft': 'draft_3Mbps'
  };
  
  const encoderLabel = ENCODER_MAP[format] || format;
  const qualityLabel = QUALITY_MAP[quality] || quality;
  const ext = format.includes('webm') ? 'webm' : 'mp4';
  
  const detailedName = output 
    ? output 
    : resolve(config.outputDir, `${scriptName}_${qualityLabel}_${fps}fps_${encoderLabel}_${resolution}.${ext}`);
  const outputPath = detailedName;

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
