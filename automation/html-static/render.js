#!/usr/bin/env node

/**
 * StudioPro Code-to-Video Renderer
 * 
 * Renders a JavaScript composition file to MP4/WebM.
 * The JS file uses the StudioPro API to define clips, animations, and effects.
 * 
 * Usage:
 *   node render.js examples/product-launch.js
 *   node render.js examples/social-reel.js output.mp4 --quality standard
 *   node render.js examples/kinetic-text.js --format webm --mode ftrt
 * 
 * Default settings (if user doesn't specify):
 *   Quality: ultra (30 Mbps)
 *   Format: mp4
 *   Mode: ftrt (fastest)
 *   FPS: 30
 */

import path from 'path';
import fs from 'fs';
import { StudioPro } from './api.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Default settings ───────────────────────────────────────────────────────

const DEFAULTS = {
    quality: 'ultra',     // ultra=30Mbps, standard=15Mbps, draft=8Mbps
    format: 'mp4',        // mp4 or webm
    mode: 'mediabunny',   // mediabunny (default, reliable) or ftrt (fast but may stall on HTML clips)
    fps: 30,
    width: 1920,
    height: 1080,
    headless: true
};

// ── Parse arguments ────────────────────────────────────────────────────────

function parseArgs(args) {
    const result = {
        script: null,
        output: null,
        options: { ...DEFAULTS }
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--help' || arg === '-h') {
            printHelp();
            process.exit(0);
        }

        if ((arg === '--quality' || arg === '-q') && args[i + 1]) {
            result.options.quality = args[++i];
        } else if ((arg === '--format' || arg === '-f') && args[i + 1]) {
            result.options.format = args[++i];
        } else if ((arg === '--mode' || arg === '-m') && args[i + 1]) {
            result.options.mode = args[++i];
        } else if ((arg === '--fps') && args[i + 1]) {
            result.options.fps = parseInt(args[++i]);
        } else if (arg === '--no-headless') {
            result.options.headless = false;
        } else if (arg === '--url' && args[i + 1]) {
            result.options.url = args[++i];
        } else if (!arg.startsWith('-') && !result.script) {
            result.script = arg;
        } else if (!arg.startsWith('-') && !result.output) {
            result.output = arg;
        }
    }

    return result;
}

// ── Help text ──────────────────────────────────────────────────────────────

function printHelp() {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║  StudioPro Code-to-Video Renderer                          ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Usage:                                                      ║
║    node render.js <script.js> [output] [options]             ║
║                                                              ║
║  Arguments:                                                  ║
║    script.js    JavaScript file defining the composition     ║
║    output       Output filename (default: script.mp4)        ║
║                                                              ║
║  Options:                                                    ║
║    --quality <draft|standard|ultra>  (default: ultra)        ║
║    --format <mp4|webm>               (default: mp4)          ║
║    --mode <ftrt|standard>            (default: ftrt)         ║
║    --fps <30>                        (default: 30)           ║
║    --no-headless                     Show browser window     ║
║    --url <http://localhost:3000>     StudioPro URL           ║
║    --help                            Show this help          ║
║                                                              ║
║  Quality presets:                                            ║
║    draft     8 Mbps  — fast, smaller files                   ║
║    standard  15 Mbps — balanced                              ║
║    ultra     30 Mbps — highest quality                       ║
║                                                              ║
║  Examples:                                                   ║
║    node render.js examples/product-launch.js                 ║
║    node render.js examples/social-reel.js reel.mp4           ║
║    node render.js examples/kinetic-text.js --format webm     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
}

// ── Main render function ───────────────────────────────────────────────────

async function render(scriptPath, outputPath, options) {
    // Validate script exists
    if (!fs.existsSync(scriptPath)) {
        console.error(`❌ Script not found: ${scriptPath}`);
        process.exit(1);
    }

    // Generate output filename if not provided
    if (!outputPath) {
        const scriptName = path.basename(scriptPath, '.js');
        outputPath = `${scriptName}_${options.quality}_${options.fps}fps_${options.mode}_${options.format}`;
    }

    // Ensure output has correct extension
    if (!outputPath.endsWith(`.${options.format}`)) {
        outputPath = `${outputPath}.${options.format}`;
    }

    // Resolve output path — place in html-static/output/
    const outputDir = path.join(__dirname, 'output');
    if (!path.isAbsolute(outputPath)) {
        // If user passed a relative path like 'output/file.mp4',
        // don't double-nest it
        const basename = path.basename(outputPath);
        const dirPart = path.dirname(outputPath);
        if (dirPart === 'output' || dirPart === '.') {
            outputPath = path.join(outputDir, basename);
        } else {
            outputPath = path.join(outputDir, outputPath);
        }
    }

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Print render info
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║  StudioPro Code-to-Video                                    ║
╠══════════════════════════════════════════════════════════════╣
║  Script:  ${scriptPath.padEnd(48)}║
║  Output:  ${outputPath.padEnd(48)}║
║  Quality: ${options.quality.padEnd(48)}║
║  Format:  ${options.format.padEnd(48)}║
║  Mode:    ${options.mode.padEnd(48)}║
║  FPS:     ${String(options.fps).padEnd(48)}║
╚══════════════════════════════════════════════════════════════╝
`);

    const startTime = Date.now();
    const maxRetries = options.retries || 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        // Launch StudioPro
        const studio = new StudioPro({
            headless: options.headless,
            url: options.url || DEFAULTS.url,
            retries: maxRetries
        });

        try {
            // 1. Launch browser
            console.log('🚀 Launching Chrome...');
            await studio.launch();

            // 2. Execute the composition script
            console.log('📝 Executing composition script...');
            await studio.execute(scriptPath);

            // 2b. Pre-render HTML clips to canvas (eliminates black frames)
            await studio.preloadHtmlClips();

            // 3. Export video
            console.log('🎬 Exporting video...');
            await studio.export(outputPath, options);

        // 4. Calculate time taken
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║  ✅ Render Complete!                                        ║
╠══════════════════════════════════════════════════════════════╣
║  Output:   ${outputPath.padEnd(47)}║
║  Time:     ${elapsed.padEnd(47)}s║
║  Quality:  ${options.quality.padEnd(47)}║
║  Format:   ${options.format.padEnd(47)}║
╚══════════════════════════════════════════════════════════════╝
`);

    } catch (err) {
        console.error(`\n❌ Render failed (attempt ${attempt}/${maxRetries}): ${err.message}`);
        
        if (attempt < maxRetries) {
            console.log(`\n🔄 Retrying in 2 seconds...`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
        }
        
        console.error('\n❌ All attempts failed');
        if (err.stack) console.error(err.stack);
        process.exit(1);
    } finally {
        await studio.close();
    }
    
    break; // Success — exit loop
    }
}

// ── CLI entry ──────────────────────────────────────────────────────────────

if (process.argv[1] && process.argv[1].endsWith('render.js')) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        printHelp();
        process.exit(0);
    }

    const parsed = parseArgs(args);

    if (!parsed.script) {
        console.error('❌ No script specified');
        console.error('Usage: node render.js <script.js> [output] [options]');
        process.exit(1);
    }

    render(parsed.script, parsed.output, parsed.options);
}

export { render };
