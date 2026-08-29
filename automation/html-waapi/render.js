#!/usr/bin/env node

/**
 * StudioPro WAAPI Renderer (CDP Screenshots)
 * 
 * Uses Chrome DevTools Protocol screenshots for frame capture —
 * the same technique used by HyperFrames and Replit.
 * 
 * Flow:
 *   1. Launch headless Chrome → connect to StudioPro dev server
 *   2. Execute composition script to create WAAPI clips
 *   3. Extract clip data (HTML/CSS/JS/fonts/duration)
 *   4. For each clip: generate standalone HTML → CDP screenshot each frame
 *   5. Encode frames to MP4/WebM with FFmpeg
 * 
 * Usage:
 *   node html-waapi/render.js examples/animated-pollution.js
 *   node html-waapi/render.js examples/animated-pollution.js -m cdp -q ultra
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { launchBrowser, preloadFonts, captureClipFrames, encodeFrames, cleanupFrames } from './cdp-capture.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Default settings ───────────────────────────────────────────────────────

const DEFAULTS = {
    quality: 'ultra',
    format: 'mp4',
    mode: 'cdp',          // 'cdp' = CDP screenshots (fast, perfect), 'gui' = editor export (slow)
    fps: 30,
    headless: true
};

const QUALITY_PRESETS = {
    draft:  { crf: 28, scale: 0.5 },
    standard: { crf: 23, scale: 1 },
    ultra:  { crf: 18, scale: 1 }
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
        else if (!arg.startsWith('-') && !result.script) result.script = arg;
        else if (!arg.startsWith('-') && !result.output) result.output = arg;
    }
    return result;
}

function printHelp() {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║  StudioPro WAAPI Renderer (CDP Screenshots)                 ║
╠══════════════════════════════════════════════════════════════╣
║  Uses headless Chrome screenshots for perfect frame capture ║
║  Same technique as HyperFrames + Replit video export        ║
║                                                              ║
║  Usage:                                                      ║
║    node html-waapi/render.js <script.js> [output] [options] ║
║                                                              ║
║  Options:                                                    ║
║    -q, --quality <draft|standard|ultra>                     ║
║    -f, --format <mp4|webm>                                  ║
║    -m, --mode <cdp|gui>                                     ║
║    --fps <30>                                                ║
║    --no-headless     Show Chrome window                      ║
╚══════════════════════════════════════════════════════════════╝
    `);
}

// ── Extract clip data from editor ──────────────────────────────────────────

async function extractClipData(page) {
    return await page.evaluate(() => {
        // Capture ALL HTML clips (both WAAPI and regular)
        const clips = State.clips.filter(c => c.type === 'html' && !c.hidden);
        return clips.map(c => ({
            id: c.id,
            html: c.html || '',
            css: c.css || '',
            js: c.js || '',
            fonts: c.fonts || [],
            systemFonts: State.importedSystemFonts || [],
            duration: c.duration,
            start: c.start,
            width: 1920,
            height: 1080,
            effects: c.effects || {}
        }));
    });
}

// ── Main render function (CDP mode) ─────────────────────────────────────

async function renderCDP(scriptPath, outputPath, options) {
    // Launch Chrome using shared launcher (optimized args)
    const browser = await launchBrowser({
        headless: options.headless,
        width: 1920,
        height: 1080
    });

    // Detect dev server
    const http = await import('http');
    let serverUrl = null;
    for (const port of [7000, 3000, 3001]) {
        const ok = await new Promise(r => {
            http.default.get(`http://localhost:${port}`, res => { res.resume(); r(true); })
                .on('error', () => r(false)).setTimeout(1500, function() { this.destroy(); r(false); });
        });
        if (ok) { serverUrl = `http://localhost:${port}`; break; }
    }
    if (!serverUrl) throw new Error('No dev server found. Run: npm run dev');

    console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
    console.log(`║  StudioPro WAAPI Renderer (CDP Screenshots)                 ║`);
    console.log(`╠══════════════════════════════════════════════════════════════╣`);
    console.log(`║  Script:  ${path.basename(scriptPath).padEnd(48)}║`);
    console.log(`║  Mode:    CDP screenshots (perfect rendering)              ║`);
    console.log(`║  Capture: page.screenshot() — full browser rendering       ║`);
    console.log(`╚══════════════════════════════════════════════════════════════╝\n`);

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        console.log(`[CDP] Connecting to ${serverUrl}...`);
        await page.goto(serverUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction('window.StudioPro !== undefined', { timeout: 30000 });
        console.log('[CDP] Connected to StudioPro');

        // Execute composition script
        console.log('[CDP] Executing composition...');
        const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
        await page.evaluate((code) => {
            let fnBody = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
                .replace(/\s*module\.exports\s*=\s*/g, '').replace(/\s*export\s+default\s+/g, '')
                .replace(/;\s*$/, '').trim();
            let fnStr;
            if (fnBody.startsWith('function')) {
                const firstBrace = fnBody.indexOf('{');
                const lastBrace = fnBody.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    const params = fnBody.substring(fnBody.indexOf('('), fnBody.indexOf(')') + 1);
                    const body = fnBody.substring(firstBrace, lastBrace + 1);
                    fnStr = `${params} => ${body}`;
                } else { fnStr = fnBody; }
            } else { fnStr = fnBody; }
            const scriptFn = new Function('return ' + fnStr)();
            scriptFn(window.StudioPro, window.State);
        }, scriptContent);

        const clipCount = await page.evaluate(() => State.clips.filter(c => c.type === 'html').length);
        console.log(`[CDP] Composition loaded: ${clipCount} HTML clips`);

        // Extract clip data
        console.log('[CDP] Extracting clip data...');
        const clips = await extractClipData(page);
        console.log(`[CDP] Extracted ${clips.length} clips`);

        // Close editor tab (not browser — reuse for capture)
        await page.close();

        // ── Font preloading (KEY OPTIMIZATION) ──
        // Collect all unique fonts across all clips
        const allFonts = [...new Set(clips.flatMap(c => c.fonts || []))];
        if (allFonts.length > 0) {
            console.log(`[CDP] Preloading ${allFonts.length} fonts: ${allFonts.join(', ')}...`);
            await preloadFonts(browser, allFonts, { verbose: true });
        }

        // Capture frames for each clip using the SAME browser instance
        const quality = QUALITY_PRESETS[options.quality] || QUALITY_PRESETS.ultra;
        const allFrameDirs = [];
        let clipIndex = 0;

        for (const clip of clips) {
            clipIndex++;
            console.log(`\n[CDP] Capturing clip ${clipIndex}/${clips.length}: ${clip.id} (${clip.duration}s)`);

            const result = await captureClipFrames(clip, {
                fps: options.fps,
                width: clip.width,
                height: clip.height,
                browser: browser,  // Reuse same browser instance!
                headless: options.headless,
                verbose: true
            });

            allFrameDirs.push(result);
        }

        // Encode to video
        if (!outputPath) {
            const scriptName = path.basename(scriptPath, '.js');
            outputPath = path.join(__dirname, 'output', `${scriptName}_${options.quality}_${options.fps}fps_cdp.${options.format}`);
        }
        try { fs.mkdirSync(path.dirname(outputPath), { recursive: true }); } catch(e) {}

        // If multiple clips, concatenate frame directories
        if (allFrameDirs.length === 1) {
            await encodeFrames(allFrameDirs[0].outputDir, outputPath, {
                fps: options.fps,
                format: options.format,
                crf: quality.crf
            });
        } else {
            // Concatenate all frames in timeline order
            console.log(`\n[CDP] Concatenating ${allFrameDirs.length} clip frame sequences...`);
            const concatDir = path.join(__dirname, '.frames', 'concat');
            fs.mkdirSync(concatDir, { recursive: true });
            
            let frameIndex = 0;
            for (const result of allFrameDirs) {
                for (const framePath of result.frames) {
                    const dest = path.join(concatDir, `frame_${String(frameIndex).padStart(6, '0')}.png`);
                    fs.copyFileSync(framePath, dest);
                    frameIndex++;
                }
            }
            
            await encodeFrames(concatDir, outputPath, {
                fps: options.fps,
                format: options.format,
                crf: quality.crf
            });
            
            cleanupFrames(concatDir);
        }

        // Cleanup
        for (const result of allFrameDirs) {
            cleanupFrames(result.outputDir);
        }

        console.log(`\n✅ WAAPI render complete! (CDP screenshots — perfect quality)`);
        console.log(`   Output: ${outputPath}`);

    } catch (err) {
        // Make sure browser is closed
        try { await browser.close(); } catch(e) {}
        throw err;
    }
}

// ── Main render function (GUI mode — fallback) ──────────────────────────

async function renderGUI(scriptPath, outputPath, options) {
    // Use the old approach: editor export via MediaBunny worker
    const { StudioProWAAPI } = await import('./api.js');
    const studio = new StudioProWAAPI({
        headless: options.headless,
        timeout: 300000
    });

    try {
        await studio.launch();
        await studio.execute(scriptPath);
        await studio.preloadWaaapiClips();
        
        if (!outputPath) {
            const scriptName = path.basename(scriptPath, '.js');
            outputPath = path.join(__dirname, 'output', `${scriptName}_${options.quality}_${options.fps}fps_gui.${options.format}`);
        }
        try { fs.mkdirSync(path.dirname(outputPath), { recursive: true }); } catch(e) {}
        
        await studio.export(outputPath, options);
        console.log(`\n✅ WAAPI render complete! (GUI export)`);
    } finally {
        await studio.close();
    }
}

// ── CLI Entry Point ──────────────────────────────────────────────────────

if (process.argv[1] && process.argv[1].endsWith('render.js')) {
    const args = process.argv.slice(2);
    if (args.length === 0) { printHelp(); process.exit(0); }
    
    const parsed = parseArgs(args);
    if (!parsed.script) {
        console.error('❌ No script specified');
        process.exit(1);
    }
    
    const renderFn = parsed.options.mode === 'gui' ? renderGUI : renderCDP;
    renderFn(parsed.script, parsed.output, parsed.options).catch(err => {
        console.error(`\n❌ Render failed: ${err.message}`);
        process.exit(1);
    });
}

export { renderCDP, renderGUI };
