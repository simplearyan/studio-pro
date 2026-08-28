#!/usr/bin/env node

/**
 * StudioPro WAAPI Renderer (Independent)
 * 
 * Uses SVG foreignObject for frame capture — no html2canvas dependency.
 * Standalone pipeline: WAAPI adapter + seekToFrame + SVG capture → MediaBunny.
 * 
 * Usage:
 *   node html-waapi/render.js examples/animated-pollution.js
 *   node html-waapi/render.js examples/animated-pollution.js -m mediabunny -q ultra
 */

import path from 'path';
import { readFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Independent WAAPI API — NO dependency on html-static
import { StudioProWAAPI } from './api.js';

// ── Default settings ───────────────────────────────────────────────────────

const DEFAULTS = {
    quality: 'ultra',
    format: 'mp4',
    mode: 'mediabunny',
    fps: 30,
    headless: true
};

// ── Parse args ─────────────────────────────────────────────────────────────

function parseArgs(args) {
    const result = { script: null, output: null, options: { ...DEFAULTS } };
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--help' || arg === '-h') { printHelp(); process.exit(0); }
        if ((arg === '--quality' || arg === '-q') && args[i + 1]) result.options.quality = args[++i];
        else if ((arg === '--format' || arg === '-f') && args[i + 1]) result.options.format = args[++i];
        else if ((arg === '--mode' || arg === '-m') && args[i + 1]) result.options.mode = args[++i];
        else if (arg === '--fps' && args[i + 1]) result.options.fps = parseInt(args[++i]);
        else if (arg === '--no-headless') result.options.headless = false;
        else if (arg === '--url' && args[i + 1]) result.options.url = args[++i];
        else if (!arg.startsWith('-') && !result.script) result.script = arg;
        else if (!arg.startsWith('-') && !result.output) result.output = arg;
    }
    return result;
}

function printHelp() {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║  StudioPro WAAPI Renderer (Independent)                     ║
╠══════════════════════════════════════════════════════════════╣
║  Uses SVG foreignObject for frame capture (no html2canvas)  ║
║                                                              ║
║  Usage:                                                      ║
║    node html-waapi/render.js <script.js> [output] [options] ║
║                                                              ║
║  Options:                                                    ║
║    -q, --quality <draft|standard|ultra>                     ║
║    -f, --format <mp4|webm>                                  ║
║    -m, --mode <mediabunny|ftrt>                            ║
║    --fps <30>                                                ║
║    --no-headless     Show Chrome window                      ║
║    --url <url>       Override dev server URL                 ║
╚══════════════════════════════════════════════════════════════╝
    `);
}

// ── Main render function ───────────────────────────────────────────────────

async function render(scriptPath, outputPath, options) {
    const studio = new StudioProWAAPI({
        headless: options.headless,
        url: options.url || null,
        timeout: 300000
    });

    try {
        // 1. Launch Chrome + connect to dev server
        console.log('\n╔══════════════════════════════════════════════════════════════╗');
        console.log('║  StudioPro WAAPI Renderer (Independent)                     ║');
        console.log('╠══════════════════════════════════════════════════════════════╣');
        console.log(`║  Script:  ${path.basename(scriptPath).padEnd(48)}║`);
        console.log(`║  Mode:    ${options.mode.padEnd(48)}║`);
        console.log(`║  Capture: SVG foreignObject (5-15ms/frame)                 ║`);
        console.log('╚══════════════════════════════════════════════════════════════╝\n');

        await studio.launch();

        // 2. Execute composition script
        console.log('📝 Executing composition...');
        await studio.execute(scriptPath);

        const clipCount = await studio.page.evaluate(() => State.clips.length);
        console.log(`✅ Composition loaded: ${clipCount} clips`);

        // 3. Pre-load WAAPI clips with SVG foreignObject capture
        await studio.preloadWaaapiClips();

        // 4. Export via MediaBunny/FTRT
        console.log('🎬 Starting export...');
        if (!outputPath) {
            const scriptName = path.basename(scriptPath, '.js');
            outputPath = path.join(__dirname, 'output', `${scriptName}_${options.quality}_${options.fps}fps_${options.mode}.${options.format}`);
        }
        try { mkdirSync(path.dirname(outputPath), { recursive: true }); } catch(e) {}

        await studio.export(outputPath, options);

        console.log('\n✅ WAAPI render complete! (SVG foreignObject capture)');

    } finally {
        await studio.close();
    }
}

// ── CLI ────────────────────────────────────────────────────────────────────

if (process.argv[1] && process.argv[1].endsWith('render.js')) {
    const args = process.argv.slice(2);
    if (args.length === 0) { printHelp(); process.exit(0); }
    
    const parsed = parseArgs(args);
    if (!parsed.script) {
        console.error('❌ No script specified');
        process.exit(1);
    }
    
    render(parsed.script, parsed.output, parsed.options).catch(err => {
        console.error(`\n❌ Render failed: ${err.message}`);
        process.exit(1);
    });
}

export { render };
