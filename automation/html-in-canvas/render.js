#!/usr/bin/env node

/**
 * StudioPro HTML-in-Canvas renderer
 *
 * Renders a JavaScript composition file to MP4/WebM, two ways:
 *
 *   --mode cdp     (default) Standalone page per clip + Chrome DevTools Protocol
 *                  screenshots, encoded by an in-page MediaBunny encoder —
 *                  no ffmpeg anywhere in the chain (Track T1.2). Deterministic:
 *                  the same frame index produces the same pixels across runs.
 *   --mode editor  Drive the running editor and let its OWN export pump render
 *                  (MediaBunny worker or FTRT). Slower, and it is the only
 *                  automated consumer of that export path — which is why it is
 *                  a mode here rather than a second CLI.
 *
 * Flow (cdp):
 *   1. Launch headless Chrome → connect to the StudioPro dev server
 *   2. Execute the composition script, creating HIC clips
 *   3. Extract clip data (html/css/js/fonts/duration)
 *   4. Per clip: build a standalone page → screenshot each frame
 *   5. Encode the frames to MP4/WebM with ffmpeg
 *
 * Flow (editor):
 *   1. Launch headless Chrome → connect to the StudioPro dev server
 *   2. Execute the composition script, creating HIC clips
 *   3. Queue the editor's own HIC pre-render (preRenderAllHicClips)
 *   4. Open the export modal, choose the format, submit, watch progress
 *   5. Pull the finished blob out of the page and write it to disk
 *
 * Usage:
 *   node html-in-canvas/render.js html-in-canvas/examples/animated-pollution.js
 *   node html-in-canvas/render.js html-in-canvas/examples/waapi-test.js -q ultra --fps 30
 *   node html-in-canvas/render.js html-in-canvas/examples/simple-test.js -m editor -e ftrt
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { launchBrowser, preloadFonts, captureClipFrames } from './cdp-capture.js';
import { InPageEncoder } from '../shared/export/inpage-encoder.js';
import verifyModule from '../shared/export/verify.cjs';

const { verify } = verifyModule;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Help-box helper ────────────────────────────────────────────────────────
// Built rather than hand-padded. The width follows the longest line (never
// below 62 columns) and lines are measured in CHARACTERS, not bytes, so a `—`
// or `→` in the copy cannot knock the right border out of line — and nothing is
// ever truncated to fit, which silently eats the tail of a description.

const BOX_MIN_W = 62;
const boxChars = (s) => [...s].length;

function box(rows) {
    const lines = rows.map((r) => String(r ?? ''));
    const w = Math.max(BOX_MIN_W, ...lines.map(boxChars));
    const border = (l, r) => l + '═'.repeat(w) + r;
    const body = lines.map((s) => '║' + s + ' '.repeat(w - boxChars(s)) + '║');
    return [border('╔', '╗'), ...body, border('╚', '╝')].join('\n');
}

// ── Default settings ───────────────────────────────────────────────────────

const DEFAULTS = {
    quality: 'ultra',       // cdp: in-page MediaBunny bitrate. editor: passed to
                            // the client (the editor picks its own bitrate — see
                            // --help)
    format: 'mp4',          // mp4 | webm
    mode: 'cdp',            // cdp | editor
    encoder: 'mediabunny',  // editor mode only: mediabunny | ftrt | standard
    fps: 30,
    headless: true,
    url: null,              // null = auto-detect on 7000 → 3000 → 3001
    retries: 3
};

// Bitrate ladders replaced the old ffmpeg CRF presets when the encode moved
// in-page (T1.2). Named by destination the way md-render's ladder is —
// 3/8/15/30 Mbps — instead of codec numbers only a video engineer picks.
const QUALITY_PRESETS = {
    draft:    { bitrate: 3e6 },
    standard: { bitrate: 8e6 },
    high:     { bitrate: 15e6 },
    ultra:    { bitrate: 30e6 }
};

const MODES = ['cdp', 'editor'];
const ENCODERS = ['mediabunny', 'ftrt', 'standard'];
const FORMATS = ['mp4', 'webm'];
const QUALITIES = Object.keys(QUALITY_PRESETS);

// The two CLIs this file replaces had three names for "let the editor render":
// html-static's `-m mediabunny` / `-m ftrt`, and html-waapi's `-m gui`. They are
// accepted as aliases so every documented command keeps working; the mode and
// encoder they imply are printed, so a stale command tells on itself.
const MODE_ALIASES = {
    gui:        { mode: 'editor', encoder: 'mediabunny' },
    mediabunny: { mode: 'editor', encoder: 'mediabunny' },
    ftrt:       { mode: 'editor', encoder: 'ftrt' },
    standard:   { mode: 'editor', encoder: 'standard' }
};

// ── Parse args ─────────────────────────────────────────────────────────────

function parseArgs(args) {
    const result = { script: null, output: null, options: { ...DEFAULTS }, usedAlias: null };
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--help' || arg === '-h') { printHelp(); process.exit(0); }
        if ((arg === '--quality' || arg === '-q') && args[i + 1]) result.options.quality = args[++i];
        else if ((arg === '--format' || arg === '-f') && args[i + 1]) result.options.format = args[++i];
        else if ((arg === '--mode' || arg === '-m') && args[i + 1]) {
            const m = args[++i];
            if (MODE_ALIASES[m]) {
                result.options.mode = MODE_ALIASES[m].mode;
                result.options.encoder = MODE_ALIASES[m].encoder;
                result.usedAlias = m;
            } else {
                result.options.mode = m;
            }
        }
        else if ((arg === '--encoder' || arg === '-e') && args[i + 1]) result.options.encoder = args[++i];
        else if (arg === '--fps' && args[i + 1]) result.options.fps = parseInt(args[++i]);
        else if ((arg === '--url' || arg === '-u') && args[i + 1]) result.options.url = args[++i];
        else if (arg === '--retries' && args[i + 1]) result.options.retries = parseInt(args[++i]);
        else if (arg === '--no-headless') result.options.headless = false;
        else if (!arg.startsWith('-') && !result.script) result.script = arg;
        else if (!arg.startsWith('-') && !result.output) result.output = arg;
    }
    return result;
}

/** Returns an error string, or null when the options are usable. */
function validateOptions(options) {
    if (!MODES.includes(options.mode)) {
        return `Unknown --mode "${options.mode}". Use: ${MODES.join(' | ')}`;
    }
    if (!ENCODERS.includes(options.encoder)) {
        return `Unknown --encoder "${options.encoder}". Use: ${ENCODERS.join(' | ')}`;
    }
    if (!FORMATS.includes(options.format)) {
        return `Unknown --format "${options.format}". Use: ${FORMATS.join(' | ')}`;
    }
    if (!QUALITIES.includes(options.quality)) {
        return `Unknown --quality "${options.quality}". Use: ${QUALITIES.join(' | ')}`;
    }
    if (!(options.fps > 0)) {
        return `--fps must be a positive number (got "${options.fps}")`;
    }
    return null;
}

function printHelp() {
    console.log('\n' + box([
        '  StudioPro HTML-in-Canvas Renderer',
        '',
        '  Two export strategies, one CLI:',
        '    cdp     standalone page + CDP screenshots + in-page',
        '            MediaBunny encode (default, deterministic — a migrated',
        '            clip is frame-for-frame reproducible across runs)',
        '    editor  drive the running editor and let its own export',
        '            pump render (MediaBunny / FTRT)',
        '',
        '  Usage:',
        '    node html-in-canvas/render.js <script.js> [output] [options]',
        '',
        '  Arguments:',
        '    script.js    Composition script (StudioPro API)',
        '    output       Output filename (default: output/<script>_<...>)',
        '',
        '  Options:',
        '    -m, --mode <cdp|editor>        default: cdp',
        '    -e, --encoder <mediabunny|ftrt|standard>',
        '                                   editor mode only, default: mediabunny',
        '    -q, --quality <draft|standard|high|ultra>',
        '                                   cdp: in-page bitrate 3/8/15/30 Mbps',
        '                                   (no ffmpeg anywhere).',
        '                                   editor: passed through — the editor',
        '                                   modal owns the bitrate (see Notes)',
        '    -f, --format <mp4|webm>        default: mp4',
        '        --fps <30>                 default: 30',
        '    -u, --url <http://localhost:3000>',
        '                                   skip port auto-detect',
        '        --retries <3>              attempts before giving up',
        '        --no-headless              show the Chrome window',
        '    -h, --help                     this help',
        '',
        '  Legacy mode names (accepted, mapped, and reported):',
        '    -m gui | -m mediabunny  →  --mode editor --encoder mediabunny',
        '    -m ftrt                 →  --mode editor --encoder ftrt',
        '    -m standard             →  --mode editor --encoder standard',
        '',
        '  Notes:',
        '    The script path resolves against the CURRENT DIRECTORY, so from',
        '    automation/ the form is:',
        '      node html-in-canvas/render.js html-in-canvas/examples/x.js',
        '    A relative output path lands in html-in-canvas/output/.',
        '    Ports tried in order: 7000 → 3000 → 3001.',
        '',
        '  Examples:',
        '    node html-in-canvas/render.js html-in-canvas/examples/simple-test.js',
        '    node html-in-canvas/render.js html-in-canvas/examples/social-reel.js \\',
        '         reel.mp4 -q standard',
        '    node html-in-canvas/render.js html-in-canvas/examples/kinetic-text.js \\',
        '         -m editor -e ftrt'
    ]) + '\n');
}

// ── Output path resolution ─────────────────────────────────────────────────

/**
 * Resolve where the video lands. Absolute paths are respected; a relative path
 * is placed under html-in-canvas/output/ without double-nesting an "output/"
 * the caller already wrote. The extension is appended when missing.
 */
function resolveOutputPath(scriptPath, outputPath, options) {
    const scriptName = path.basename(scriptPath, '.js');
    const modeTag = options.mode === 'cdp' ? 'cdp' : `editor_${options.encoder}`;
    const defaultName = `${scriptName}_${options.quality}_${options.fps}fps_${modeTag}.${options.format}`;

    let target = outputPath || defaultName;
    if (!target.endsWith(`.${options.format}`)) target = `${target}.${options.format}`;

    const outputDir = path.join(__dirname, 'output');
    fs.mkdirSync(outputDir, { recursive: true });

    if (path.isAbsolute(target)) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        return target;
    }
    const dirPart = path.dirname(target);
    if (dirPart === '.' || dirPart === 'output') return path.join(outputDir, path.basename(target));
    return path.join(outputDir, target);
}

// ── Dev server ─────────────────────────────────────────────────────────────

const PORT_PRIORITY = [7000, 3000, 3001];

async function detectDevServer(explicitUrl) {
    if (explicitUrl) return explicitUrl.replace(/\/$/, '');
    const http = await import('http');
    for (const port of PORT_PRIORITY) {
        const url = `http://localhost:${port}`;
        const ok = await new Promise((resolve) => {
            http.default.get(url, (res) => { res.resume(); resolve(true); })
                .on('error', () => resolve(false))
                .setTimeout(1500, function() { this.destroy(); resolve(false); });
        });
        if (ok) return url;
    }
    throw new Error(
        `No dev server found on ports ${PORT_PRIORITY.join(', ')}\n` +
        `   Run: npm run dev             (personal, port 3000)\n` +
        `   Run: npm run dev:automation  (dedicated, port 7000)\n` +
        `   Or pass --url <http://localhost:PORT>`
    );
}

// ── Composition script injection ───────────────────────────────────────────
// Shared by both modes so they can never disagree about how a composition is
// loaded. The script is stripped of comments / module wrapper and rebuilt as a
// function taking (StudioPro, State).

const SCRIPT_INJECT = (code) => {
    try {
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
        const composition = scriptFn(window.StudioPro, window.State);
        return { success: true, composition };
    } catch (err) {
        return { success: false, error: err.message };
    }
};

// ── Extract clip data from the editor ──────────────────────────────────────

async function extractClipData(page) {
    return await page.evaluate(() => {
        // Clips are HTML-in-Canvas. Phase 3 of docs/LEGACY-CLIP-REMOVAL-PLAN.md
        // migrated every `type: 'html'` clip to `type: 'hic'` on load, compiling
        // each clip's @keyframes into a deterministic onFrame. `css` arrives
        // already stripped of the animations it consumed, and `js` carries the
        // onFrame the standalone page seeks with.
        const clips = State.clips.filter(c => c.type === 'hic' && !c.hidden);
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

/** Open the dev server, wait for the editor, run the composition script. */
async function loadComposition(page, serverUrl, scriptPath, logTag) {
    if (!fs.existsSync(scriptPath)) throw new Error(`Script not found: ${scriptPath}`);
    console.log(`[${logTag}] Connecting to ${serverUrl}...`);
    await page.goto(serverUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction('window.StudioPro !== undefined', { timeout: 30000 });
    console.log(`[${logTag}] Connected to StudioPro`);

    console.log(`[${logTag}] Executing composition...`);
    const result = await page.evaluate(SCRIPT_INJECT, fs.readFileSync(scriptPath, 'utf-8'));
    if (result && result.success === false) throw new Error(`Script failed: ${result.error}`);

    const clipCount = await page.evaluate(() => State.clips.filter(c => c.type === 'hic').length);
    console.log(`[${logTag}] Composition loaded: ${clipCount} HIC clip(s)`);
    return clipCount;
}

// ── Mode: cdp ──────────────────────────────────────────────────────────────

async function renderCDP(scriptPath, outputPath, options) {
    const browser = await launchBrowser({
        headless: options.headless,
        width: 1920,
        height: 1080
    });

    try {
        const serverUrl = await detectDevServer(options.url);

        console.log('\n' + box([
            '  StudioPro HTML-in-Canvas Renderer',
            '',
            `  Script:  ${path.basename(scriptPath)}`,
            `  Mode:    cdp — standalone page + CDP screenshots`,
            `  Encoder: MediaBunny in-page (${((QUALITY_PRESETS[options.quality] || QUALITY_PRESETS.ultra).bitrate / 1e6)} Mbps, ${options.format})`,
            `  FPS:     ${options.fps}`
        ]) + '\n');

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await loadComposition(page, serverUrl, scriptPath, 'CDP');

        console.log('[CDP] Extracting clip data...');
        const clips = await extractClipData(page);
        console.log(`[CDP] Extracted ${clips.length} clips`);
        await page.close();

        // Font preloading — one page for every font across every clip.
        const allFonts = [...new Set(clips.flatMap(c => c.fonts || []))];
        if (allFonts.length > 0) {
            console.log(`[CDP] Preloading ${allFonts.length} fonts: ${allFonts.join(', ')}...`);
            await preloadFonts(browser, allFonts, { verbose: true });
        }

        const quality = QUALITY_PRESETS[options.quality] || QUALITY_PRESETS.ultra;

        const target = resolveOutputPath(scriptPath, outputPath, options);
        console.log(`[CDP] Output: ${target}`);

        /* One in-page encoder for the whole timeline (T1.2): every frame
           streams straight from its capture page into MediaBunny — no PNG
           sequence, no concat directory, no ffmpeg. The encoder page lives
           on the dev-server origin because module imports are origin-blocked
           on file:// and data: (export-doctor names that failure). */
        const enc = await InPageEncoder.open({ browser, baseUrl: serverUrl, verbose: true });
        try {
            const begun = await enc.begin({
                width: 1920,
                height: 1080,
                fps: options.fps,
                format: options.format,
                bitrate: quality.bitrate
            });
            console.log(`[CDP] Encoder ready: ${begun.codec} ${begun.format} @ ${(quality.bitrate / 1e6)} Mbps`);

            let clipIndex = 0;
            for (const clip of clips) {
                clipIndex++;
                console.log(`\n[CDP] Rendering clip ${clipIndex}/${clips.length}: ${clip.id} (${clip.duration}s)`);
                await captureClipFrames(clip, {
                    fps: options.fps,
                    width: clip.width,
                    height: clip.height,
                    browser,
                    headless: options.headless,
                    verbose: true,
                    onFrame: (png) => enc.push(png)
                });
            }

            const meta = await enc.finish();
            fs.writeFileSync(target, meta.buffer);

            /* Re-read with MediaBunny in Node — a file that is not a video
               fails the run instead of sitting on disk (shared verifier,
               T1.1: MP4 or WebM by extension, no ffprobe anywhere). */
            const v = await verify(target, {
                width: meta.width, height: meta.height,
                duration: meta.duration, frames: meta.frames
            });
            if (!v.ok) throw new Error(`verification failed: ${v.why}`);
            console.log(`[CDP] Verified: ${meta.frames} frames, ${meta.duration.toFixed(2)}s, ${v.codec}, ${(meta.bytes / 1e6).toFixed(1)}MB`);
        } finally {
            await enc.close();
        }

        console.log('\n✅ Render complete (cdp)');
        console.log(`   Output: ${target}`);
        return target;

    } finally {
        try { await browser.close(); } catch (e) {}
    }
}

// ── Mode: editor ───────────────────────────────────────────────────────────

async function renderEditor(scriptPath, outputPath, options) {
    const { StudioProClient } = await import('./api.js');
    const studio = new StudioProClient({
        headless: options.headless,
        url: options.url,
        timeout: 300000
    });

    console.log('\n' + box([
        '  StudioPro HTML-in-Canvas Renderer',
        '',
        `  Script:  ${path.basename(scriptPath)}`,
        `  Mode:    editor — the editor's own export pump`,
        `  Encoder: ${options.encoder}`,
        `  Format:  ${options.format}`,
        `  FPS:     ${options.fps}`
    ]) + '\n');

    try {
        await studio.launch();
        await studio.execute(scriptPath);
        await studio.preloadHtmlClips();

        const target = resolveOutputPath(scriptPath, outputPath, options);
        console.log(`[Editor] Output: ${target}`);

        // `mode` here is the ENCODER: api.js maps `${mode}-${format}` onto the
        // editor's export-format radio value (video-ftrt-mp4, video-mediabunny-mp4, …).
        await studio.export(target, { ...options, mode: options.encoder });

        // The editor hands back a blob through window._exportDoneUrl; api.js
        // writes it. It reports a failure by logging rather than throwing, so
        // check the file rather than trusting the return.
        if (!fs.existsSync(target)) throw new Error('Editor export produced no file');
        /* Re-read in Node too (T1.1): the editor path used to trust the
           write; an MP4 of a flat grey field is exactly the bug this catches. */
        const v = await verify(target, {});
        if (!v.ok) throw new Error(`verification failed: ${v.why}`);
        console.log(`[Editor] Verified: ${(v.bytes / 1e6).toFixed(1)}MB, ${v.codec}, ${v.dur.toFixed(2)}s`);
        console.log('\n✅ Render complete (editor)');
        console.log(`   Output: ${target}`);
        return target;

    } finally {
        await studio.close();
    }
}

// ── CLI entry point ────────────────────────────────────────────────────────

async function main() {
    const parsed = parseArgs(process.argv.slice(2));
    if (!parsed.script) {
        console.error('❌ No script specified\n');
        printHelp();
        process.exit(1);
    }

    if (!fs.existsSync(parsed.script)) {
        console.error(`❌ Script not found: ${parsed.script}`);
        process.exit(1);
    }

    const invalid = validateOptions(parsed.options);
    if (invalid) {
        console.error(`❌ ${invalid}\n`);
        printHelp();
        process.exit(1);
    }

    if (parsed.usedAlias) {
        console.log(`⚠️  --mode ${parsed.usedAlias} is a legacy name; using --mode ${parsed.options.mode} --encoder ${parsed.options.encoder}.`);
    }
    if (parsed.options.mode === 'cdp' && parsed.options.encoder !== DEFAULTS.encoder) {
        console.log(`⚠️  --encoder ${parsed.options.encoder} is ignored in cdp mode (cdp always encodes with the in-page MediaBunny encoder).`);
    }

    const renderFn = parsed.options.mode === 'editor' ? renderEditor : renderCDP;
    const maxRetries = Math.max(1, parsed.options.retries || 1);
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await renderFn(parsed.script, parsed.output, parsed.options);
            return;
        } catch (err) {
            lastError = err;
            console.error(`\n❌ Render failed (attempt ${attempt}/${maxRetries}): ${err.message}`);
            if (attempt < maxRetries) {
                console.log('🔄 Retrying in 2 seconds...');
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    }

    if (lastError && lastError.stack) console.error(lastError.stack);
    process.exit(1);
}

if (process.argv[1] && process.argv[1].endsWith('render.js')) {
    main();
}

export { renderCDP, renderEditor, main };
