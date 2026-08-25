#!/usr/bin/env node

/**
 * StudioPro WAAPI Renderer
 * 
 * Extends html-static's working pipeline with WAAPI adapter injection.
 * The adapter makes CSS @keyframes animations seekable before html2canvas capture.
 * 
 * Usage:
 *   node html-waapi/render.js examples/animated-pollution.js
 *   node html-waapi/render.js examples/animated-pollution.js -m ftrt -q ultra
 */

import path from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Reuse the working api.js from html-static
import { StudioPro } from '../html-static/api.js';

// ── Default settings ───────────────────────────────────────────────────────

const DEFAULTS = {
    quality: 'ultra',
    format: 'mp4',
    mode: 'ftrt',
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
║  StudioPro WAAPI Renderer                                   ║
╠══════════════════════════════════════════════════════════════╣
║  Usage:                                                      ║
║    node html-waapi/render.js <script.js> [output] [options] ║
║                                                              ║
║  Options:                                                    ║
║    -q, --quality <draft|standard|high|ultra>                ║
║    -f, --format <ftrt-mp4|mediabunny-mp4>                   ║
║    -m, --mode <ftrt|mediabunny>                             ║
║    --fps <30>                                                ║
║    --no-headless     Show Chrome window                      ║
║    --url <url>       Override dev server URL                 ║
╚══════════════════════════════════════════════════════════════╝
    `);
}

// ── WAAPI Adapter (injected into iframes) ─────────────────────────────────

const WAAPI_ADAPTER = `
<script>
(function() {
    'use strict';
    
    // Seek CSS keyframe animations to exact frame
    window.seekToFrame = function(frame, framesPerSec) {
        var fps = framesPerSec || 30;
        var ms = (frame / fps) * 1000;
        
        try {
            document.getAnimations({ subtree: true }).forEach(function(anim) {
                anim.pause();
                anim.currentTime = ms;
            });
        } catch(e) {}
        
        try {
            document.documentElement.style.setProperty('--frame', frame);
            document.documentElement.style.setProperty('--progress', (ms / 1000).toFixed(4));
        } catch(e) {}
        
        try {
            if (typeof window.animate === 'function') window.animate(ms / 1000);
        } catch(e) {}
    };
    
    // Convert data-animate attributes to WAAPI
    var ANIMATIONS = {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(30px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'scale-up': { from: { opacity: '0', transform: 'scale(0.8)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'bounce-in': { from: { opacity: '0', transform: 'scale(0.3)' }, to: { opacity: '1', transform: 'scale(1)' } }
    };
    
    document.querySelectorAll('[data-animate]').forEach(function(el) {
        var type = el.dataset.animate;
        var delay = parseFloat(el.dataset.delay || '0') * 1000;
        var duration = parseFloat(el.dataset.duration || '0.5') * 1000;
        var animDef = ANIMATIONS[type];
        if (!animDef) return;
        el.animate([animDef.from, animDef.to], {
            duration: duration, delay: delay, easing: 'ease-out', fill: 'forwards'
        });
    });
})();
</script>`;

// ── Main render ────────────────────────────────────────────────────────────

async function render(scriptPath, outputPath, options) {
    const studio = new StudioPro({
        headless: options.headless,
        url: options.url || null,
        timeout: 300000
    });

    try {
        // 1. Launch Chrome + connect to dev server
        console.log('\n╔══════════════════════════════════════════════════════════════╗');
        console.log('║  StudioPro WAAPI Renderer                                  ║');
        console.log('╠══════════════════════════════════════════════════════════════╣');
        console.log(`║  Script:  ${path.basename(scriptPath).padEnd(48)}║`);
        console.log(`║  Mode:    ${options.mode.padEnd(48)}║`);
        console.log('╚══════════════════════════════════════════════════════════════╝\n');

        await studio.launch();

        // 2. Inject WAAPI adapter into the page
        // Monkey-patch iframe document.write to inject adapter
        console.log('🔧 Injecting WAAPI adapter...');
        await studio.page.evaluate((adapter) => {
            const origWrite = Document.prototype.write;
            Document.prototype.write = function(...args) {
                if (args[0] && args[0].includes('<body>')) {
                    args[0] = args[0].replace('</body>', adapter + '</body>');
                }
                return origWrite.apply(this, args);
            };
        }, WAAPI_ADAPTER);

        // 3. Execute composition script
        console.log('📝 Executing composition...');
        await studio.execute(scriptPath);

        const clipCount = await studio.page.evaluate(() => State.clips.length);
        console.log(`✅ Composition loaded: ${clipCount} clips`);

        // 4. Pre-render HTML clips with WAAPI seeking
        console.log('🎨 Pre-rendering with WAAPI seeking...');
        const fps = options.fps;
        await studio.page.evaluate(async (fps) => {
            const htmlClips = State.clips.filter(c => c.type === 'html' && c.html);
            
            for (const clip of htmlClips) {
                if (!clip._htmlIframe) continue;
                
                const doc = clip._htmlIframe.contentDocument;
                if (!doc || !doc.body) continue;
                
                const w = clip.width || 1920;
                const h = clip.height || 1080;
                
                // Seek to frame 0
                try { clip._htmlIframe.contentWindow.seekToFrame(0, fps); } catch(e) {}
                
                // Wait for animations
                await new Promise(r => setTimeout(r, 100));
                
                // Capture with html2canvas
                try {
                    const canvas = await html2canvas(doc.body, {
                        width: w, height: h,
                        backgroundColor: null, scale: 1, useCORS: true, logging: false
                    });
                    clip._htmlCanvas = canvas;
                    clip._htmlReady = true;
                    clip._htmlNeedsRefresh = false;
                } catch(e) {
                    console.warn('[WAAPI] Pre-render failed:', e.message);
                }
            }
        }, fps);

        console.log('✅ Pre-render complete');

        // 5. Export
        console.log('🎬 Starting export...');
        const formatMap = {
            'ftrt-mp4': 'video-ftrt-mp4',
            'mediabunny-mp4': 'video-mediabunny-mp4',
            'std-mp4': 'video-std-mp4'
        };
        const exportFormat = formatMap[`${options.mode}-${options.format}`] || 'video-ftrt-mp4';
        
        // Generate output path in html-waapi/output/
        if (!outputPath) {
            const scriptName = path.basename(scriptPath, '.js');
            outputPath = path.join(__dirname, 'output', `${scriptName}_${options.quality}_${options.fps}fps_${options.mode}_${options.format}.mp4`);
        }
        try { mkdirSync(path.dirname(outputPath), { recursive: true }); } catch(e) {}
        
        await studio.export(outputPath, {
            format: exportFormat,
            quality: options.quality,
            fps: options.fps
        });

        console.log('\n✅ WAAPI render complete!');

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
