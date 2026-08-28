#!/usr/bin/env node

/**
 * CDP Frame Capture — Chrome DevTools Protocol screenshots for WAAPI clips
 * 
 * Instead of html2canvas (200-500ms/frame, limited CSS) or SVG foreignObject
 * (broken by browser security), this uses Puppeteer's page.screenshot() which
 * captures the ACTUAL browser rendering — perfect quality, full CSS support.
 * 
 * This is the same technique used by HyperFrames and Replit for video export.
 * 
 * Flow:
 *   1. Generate standalone HTML page with clip content + seekToFrame adapter
 *   2. Open in headless Chrome
 *   3. For each frame: seekToFrame → page.screenshot() → save PNG
 *   4. Feed PNGs to FFmpeg for encoding
 * 
 * Usage:
 *   import { captureClipFrames } from './cdp-capture.js';
 *   const frames = await captureClipFrames(clip, { fps: 30, width: 1920, height: 1080 });
 */

import puppeteer from 'puppeteer-core';
import { writeFileSync, readFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Chrome detection ─────────────────────────────────────────────────────

function findChrome() {
    if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
    try {
        const configPath = path.join(__dirname, '..', 'config.json');
        if (existsSync(configPath)) {
            const config = JSON.parse(readFileSync(configPath, 'utf-8'));
            if (config.chromePath && existsSync(config.chromePath)) return config.chromePath;
        }
    } catch (e) {}
    const commonPaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable'
    ];
    for (const p of commonPaths) {
        if (existsSync(p)) return p;
    }
    return null;
}

// ── WAAPI Seek Adapter (injected into standalone page) ───────────────────

const SEEK_ADAPTER = `
<script>
(function() {
    'use strict';
    // Web Animations API-based seek — the CORRECT way to seek CSS animations
    window.seekToFrame = function(frame, framesPerSec) {
        var fps = framesPerSec || 30;
        var ms = (frame / fps) * 1000;
        try {
            var animations = document.getAnimations({ subtree: true });
            for (var i = 0; i < animations.length; i++) {
                animations[i].currentTime = ms;
                animations[i].pause();
            }
        } catch(e) {}
        try {
            document.documentElement.style.setProperty('--frame', frame);
            document.documentElement.style.setProperty('--progress', (ms / 1000).toFixed(4));
            document.documentElement.style.setProperty('--t', (ms / 1000).toFixed(4));
        } catch(e) {}
        try {
            if (typeof window.animate === 'function') window.animate(ms / 1000);
        } catch(e) {}
    };
    // Signal that the adapter is loaded
    window.__cdpReady = true;
})();
</script>`;

// ── Generate Standalone HTML Page ────────────────────────────────────────

function generateStandalonePage(clip, options = {}) {
    const { width = 1920, height = 1080 } = options;
    
    // Build font links
    const fonts = clip.fonts || [];
    const allFonts = [...new Set(fonts)];
    const fontLinks = allFonts.map(fn =>
        `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${fn.replace(/\s+/g, '+')}:wght@400;600;700;900&display=swap">`
    ).join('\n');
    
    // System font rules
    const sysRules = (clip.systemFonts || []).map(fn =>
        `@font-face{font-family:'${fn}';src:local('${fn}');}`
    ).join('\n');

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=${width}, height=${height}">
    ${fontLinks}
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        ${sysRules}
        body {
            width: ${width}px;
            height: ${height}px;
            overflow: hidden;
            background: transparent;
        }
        ${clip.css || ''}
    </style>
    ${SEEK_ADAPTER}
</head>
<body>
    ${clip.html || ''}
    ${clip.js ? `<script>${clip.js}</script>` : ''}
</body>
</html>`;
}

// ── CDP Frame Capture ────────────────────────────────────────────────────

/**
 * Capture all frames of a WAAPI clip using CDP screenshots.
 * 
 * @param {Object} clip - Clip data with html, css, js, fonts, duration
 * @param {Object} options - { fps, width, height, outputDir, chromePath, headless }
 * @returns {Promise<{ frames: string[], fps: number, width: number, height: number }>}
 */
export async function captureClipFrames(clip, options = {}) {
    const {
        fps = 30,
        width = 1920,
        height = 1080,
        outputDir = null,
        chromePath = null,
        headless = true,
        verbose = false
    } = options;

    const chrome = chromePath || findChrome();
    if (!chrome) throw new Error('Chrome not found. Set CHROME_PATH env var.');

    const totalFrames = Math.ceil(clip.duration * fps);
    const timeStep = 1 / fps;
    
    // Create output directory
    const frameDir = outputDir || path.join(__dirname, '.frames', clip.id || 'temp');
    if (existsSync(frameDir)) rmSync(frameDir, { recursive: true });
    mkdirSync(frameDir, { recursive: true });

    if (verbose) console.log(`[CDP] Capturing ${totalFrames} frames (${clip.duration}s @ ${fps}fps)`);

    // Launch headless Chrome
    const browser = await puppeteer.launch({
        headless: headless ? 'new' : false,
        executablePath: chrome,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--font-render-hinting=none'
        ]
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width, height, deviceScaleFactor: 1 });

        // Generate standalone HTML page
        const html = generateStandalonePage(clip, { width, height });
        
        // Load the page (data URI for offline rendering)
        const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
        await page.goto(dataUrl, { waitUntil: 'load', timeout: 30000 });

        // Wait for seekToFrame to be available
        await page.waitForFunction('window.__cdpReady === true', { timeout: 10000 });

        // Wait for fonts to load
        await page.evaluate(() => document.fonts.ready);
        
        // Small delay for CSS animations to initialize
        await new Promise(r => setTimeout(r, 200));

        if (verbose) console.log('[CDP] Page loaded, starting frame capture...');

        // Capture each frame
        const framePaths = [];
        const startTime = Date.now();

        for (let frame = 0; frame < totalFrames; frame++) {
            const time = frame * timeStep;

            // Seek CSS animations to this frame
            await page.evaluate((f, fps) => {
                window.seekToFrame(f, fps);
            }, frame, fps);

            // Wait for paint (requestAnimationFrame × 2)
            await page.evaluate(() => {
                return new Promise(resolve => {
                    requestAnimationFrame(() => requestAnimationFrame(resolve));
                });
            });

            // Capture screenshot
            const framePath = path.join(frameDir, `frame_${String(frame).padStart(6, '0')}.png`);
            await page.screenshot({
                path: framePath,
                type: 'png',
                clip: { x: 0, y: 0, width, height }
            });
            framePaths.push(framePath);

            // Progress
            if (verbose && (frame % fps === 0 || frame === totalFrames - 1)) {
                const elapsed = (Date.now() - startTime) / 1000;
                const fps_actual = (frame + 1) / elapsed;
                const eta = ((totalFrames - frame - 1) / fps_actual).toFixed(0);
                process.stdout.write(`\r   ⏳ Frame ${frame + 1}/${totalFrames} (${fps_actual.toFixed(1)} fps, ETA ${eta}s)`);
            }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        if (verbose) console.log(`\n[CDP] Captured ${totalFrames} frames in ${elapsed}s (${(totalFrames / elapsed).toFixed(1)} fps)`);

        return {
            frames: framePaths,
            fps,
            width,
            height,
            outputDir: frameDir
        };

    } finally {
        await browser.close();
    }
}

// ── FFmpeg Encoding ──────────────────────────────────────────────────────

/**
 * Encode captured frames to video using FFmpeg.
 * 
 * @param {string} frameDir - Directory containing frame_XXXXXX.png files
 * @param {string} outputPath - Output video path (.mp4 or .webm)
 * @param {Object} options - { fps, width, height, format, crf }
 * @returns {Promise<string>} Output file path
 */
export async function encodeFrames(frameDir, outputPath, options = {}) {
    const { fps = 30, format = 'mp4', crf = 18 } = options;
    
    const ext = format === 'webm' ? 'webm' : 'mp4';
    const codec = format === 'webm' ? ['libvpx-vp9', '-b:v', '0'] : ['libx264', '-preset', 'medium'];
    
    // Build FFmpeg command
    const inputPattern = path.join(frameDir, 'frame_%06d.png');
    const args = [
        '-y',
        '-framerate', String(fps),
        '-i', inputPattern,
        '-c:v', ...codec,
        '-crf', String(crf),
        '-pix_fmt', format === 'webm' ? 'yuv420p' : 'yuv420p',
        '-movflags', '+faststart',
        outputPath
    ];

    const { spawn } = await import('child_process');
    
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });
        let stderr = '';
        
        ffmpeg.stderr.on('data', data => { stderr += data.toString(); });
        ffmpeg.on('close', code => {
            if (code === 0) {
                console.log(`[CDP] Encoded: ${outputPath}`);
                resolve(outputPath);
            } else {
                reject(new Error(`FFmpeg failed (code ${code}): ${stderr.slice(-500)}`));
            }
        });
        ffmpeg.on('error', reject);
    });
}

// ── Cleanup ──────────────────────────────────────────────────────────────

export function cleanupFrames(frameDir) {
    try {
        if (existsSync(frameDir)) rmSync(frameDir, { recursive: true, force: true });
    } catch (e) {}
}

// ── CLI ──────────────────────────────────────────────────────────────────

if (process.argv[1] && process.argv[1].endsWith('cdp-capture.js')) {
    console.log('CDP Capture — use as a module, not directly.');
    console.log('Import: import { captureClipFrames, encodeFrames } from "./cdp-capture.js";');
}
