#!/usr/bin/env node

/**
 * Export Server — CDP Frame Capture for Studio Pro GUI Export
 * 
 * Runs alongside Vite dev server on port 7001.
 * Browser connects via WebSocket, sends clip data,
 * server captures frames using Puppeteer CDP, returns video.
 * 
 * For deployed sites (GitHub Pages etc), falls back to html2canvas in browser.
 * 
 * Usage:
 *   node server/export-server.js          # Start server
 *   node server/export-server.js --port 7002  # Custom port
 */

import puppeteer from 'puppeteer-core';
import { WebSocketServer } from 'ws';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Config ─────────────────────────────────────────────────────────────────

const PORT = parseInt(process.argv.find(a => a.startsWith('--port='))?.split('=')[1] || '7001');
const TEMP_DIR = join(__dirname, '..', '.export-temp');

// ── Chrome Detection ───────────────────────────────────────────────────────

function findChrome() {
    if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
    const configPath = join(__dirname, '..', 'automation', 'config.json');
    try {
        if (existsSync(configPath)) {
            const config = JSON.parse(readFileSync(configPath, 'utf-8'));
            if (config.chromePath && existsSync(config.chromePath)) return config.chromePath;
        }
    } catch (e) {}
    
    const commonPaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable'
    ];
    for (const p of commonPaths) {
        try { if (existsSync(p)) return p; } catch (e) {}
    }
    return null;
}

// ── WAAPI Seek Adapter ─────────────────────────────────────────────────────

const SEEK_ADAPTER = `<script>
(function() {
    'use strict';
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
    window.__cdpReady = true;
})();
</script>`;

// ── Build standalone HTML for a clip ───────────────────────────────────────

function buildClipHTML(clip, width, height) {
    const fontLinks = (clip.fonts || []).map(f => 
        `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(f)}:wght@300;400;500;600;700&display=swap">`
    ).join('\n');
    
    const safeCss = (clip.css || '').replace(/<\/style/gi, '<\\/style');
    
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    ${fontLinks}
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { width: ${width}px; height: ${height}px; overflow: hidden; background: transparent; }
        ${safeCss}
    </style>
</head>
<body>
    ${SEEK_ADAPTER}
    ${clip.html || ''}
    ${clip.js ? `<script>${clip.js}<\/script>` : ''}
</body>
</html>`;
}

// ── Capture frames for a single clip ───────────────────────────────────────

async function captureClipFrames(clip, options) {
    const { browser, width, height, fps, quality = 80 } = options;
    const totalFrames = Math.ceil((clip.duration || 5) * fps);
    
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    
    // Write HTML to temp file (avoids data URL issues)
    const html = buildClipHTML(clip, width, height);
    const tempFile = join(TEMP_DIR, `clip_${clip.id || Date.now()}.html`);
    writeFileSync(tempFile, html, 'utf-8');
    
    try {
        // Navigate to the file
        await page.goto(`file://${tempFile}`, { waitUntil: 'networkidle0', timeout: 15000 });
        
        // Wait for WAAPI adapter to be ready
        await page.waitForFunction('window.__cdpReady === true', { timeout: 5000 });
        
        // Wait for fonts to load
        await page.evaluate(() => document.fonts.ready);
        
        const frames = [];
        
        for (let frame = 0; frame < totalFrames; frame++) {
            // Seek to frame
            await page.evaluate((f, fps) => {
                window.seekToFrame(f, fps);
            }, frame, fps);
            
            // Wait for paint
            await page.evaluate(() => new Promise(r => {
                requestAnimationFrame(() => requestAnimationFrame(r));
            }));
            
            // Capture screenshot
            const buffer = await page.screenshot({
                type: 'jpeg',
                quality: quality,
                omitBackground: true
            });
            
            frames.push(buffer);
        }
        
        return frames;
    } finally {
        // Cleanup temp file
        try { rmSync(tempFile); } catch (e) {}
        await page.close();
    }
}

// ── Encode frames to MP4 using FFmpeg ──────────────────────────────────────

function encodeFramesToMP4(frames, outputPath, fps) {
    // Write frames to temp directory
    const framesDir = join(TEMP_DIR, 'frames');
    if (existsSync(framesDir)) rmSync(framesDir, { recursive: true });
    mkdirSync(framesDir, { recursive: true });
    
    for (let i = 0; i < frames.length; i++) {
        writeFileSync(join(framesDir, `frame_${String(i).padStart(6, '0')}.jpg`), frames[i]);
    }
    
    // Run FFmpeg
    const ffmpegCmd = `ffmpeg -y -framerate ${fps} -i "${join(framesDir, 'frame_%06d.jpg')}" -c:v libx264 -pix_fmt yuv420p -crf 18 "${outputPath}"`;
    
    try {
        execSync(ffmpegCmd, { stdio: 'pipe', timeout: 60000 });
    } catch (e) {
        console.error('[Export] FFmpeg error:', e.stderr?.toString());
        throw new Error('FFmpeg encoding failed');
    }
    
    // Cleanup
    try { rmSync(framesDir, { recursive: true }); } catch (e) {}
}

// ── Main Export Handler ────────────────────────────────────────────────────

async function handleExport(data, ws) {
    const { clips, fps = 30, width = 1920, height = 1080, format = 'mp4', quality = 80 } = data;
    
    console.log(`[Export] Starting: ${clips.length} clip(s), ${width}x${height} @ ${fps}fps`);
    
    const chromePath = findChrome();
    if (!chromePath) {
        ws.send(JSON.stringify({ type: 'error', error: 'Chrome not found. Install Chrome or set CHROME_PATH.' }));
        return;
    }
    
    // Ensure temp directory exists
    if (!existsSync(TEMP_DIR)) mkdirSync(TEMP_DIR, { recursive: true });
    
    let browser;
    try {
        // Launch browser with conservative GPU settings to avoid driver crashes
        browser = await puppeteer.launch({
            executablePath: chromePath,
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-accelerated-2d-canvas',
                '--disable-accelerated-video-decode',
                '--disable-gpu-compositing',
                '--disable-gpu-sandbox'
            ]
        });
        
        let allFrames = [];
        
        // Capture frames for each clip
        for (let i = 0; i < clips.length; i++) {
            const clip = clips[i];
            const clipFrames = Math.ceil((clip.duration || 5) * fps);
            console.log(`[Export] Capturing clip ${i + 1}/${clips.length}: ${clip.id || 'unknown'} (${clipFrames} frames)`);
            
            ws.send(JSON.stringify({ 
                type: 'progress', 
                message: `Capturing clip ${i + 1}/${clips.length} (${clipFrames} frames)...`,
                clipIndex: i,
                clipTotal: clips.length,
                frameCount: clipFrames
            }));
            
            const frames = await captureClipFrames(clip, { browser, width, height, fps, quality });
            allFrames = allFrames.concat(frames);
            
            ws.send(JSON.stringify({ 
                type: 'progress', 
                message: `Clip ${i + 1} captured (${frames.length} frames)`,
                clipIndex: i + 1,
                clipTotal: clips.length,
                framesCaptured: allFrames.length
            }));
        }
        
        // Encode to MP4
        console.log(`[Export] Encoding ${allFrames.length} frames to MP4...`);
        ws.send(JSON.stringify({ type: 'progress', message: 'Encoding video...' }));
        
        const outputPath = join(TEMP_DIR, `export_${Date.now()}.mp4`);
        encodeFramesToMP4(allFrames, outputPath, fps);
        
        // Read the output file
        const videoBuffer = readFileSync(outputPath);
        
        // Send video data as a single binary message + completion marker
        // No chunking needed for small-medium exports (< 100MB)
        console.log(`[Export] Sending ${videoBuffer.length} bytes...`);
        ws.send(videoBuffer, { binary: true });
        
        // Send completion message AFTER video data
        ws.send(JSON.stringify({ 
            type: 'complete', 
            filename: `StudioPro_Export_${Date.now()}.mp4`,
            size: videoBuffer.length
        }));
        
        // Cleanup
        try { rmSync(outputPath); } catch (e) {}
        
        console.log(`[Export] Complete: ${videoBuffer.length} bytes`);
        
    } catch (error) {
        console.error('[Export] Error:', error.message);
        ws.send(JSON.stringify({ type: 'error', error: error.message }));
    } finally {
        if (browser) await browser.close();
    }
}

// ── WebSocket Server ───────────────────────────────────────────────────────

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
    console.log('[Server] Client connected');
    
    ws.on('message', async (data) => {
        try {
            // Handle JSON messages (export requests)
            if (typeof data === 'string' || (Buffer.isBuffer(data) && data[0] === 0x7b)) {
                const json = JSON.parse(data.toString());
                if (json.type === 'export') {
                    await handleExport(json, ws);
                }
            }
        } catch (error) {
            console.error('[Server] Message error:', error.message);
            ws.send(JSON.stringify({ type: 'error', error: error.message }));
        }
    });
    
    ws.on('close', () => {
        console.log('[Server] Client disconnected');
    });
    
    // Send ready signal
    ws.send(JSON.stringify({ type: 'ready', version: '1.0.0' }));
});

console.log(`[Export Server] Running on ws://localhost:${PORT}`);
console.log(`[Export Server] Chrome: ${findChrome() || 'NOT FOUND'}`);
console.log(`[Export Server] Ready for connections`);

// Cleanup on exit
process.on('SIGINT', () => {
    console.log('[Server] Shutting down...');
    if (existsSync(TEMP_DIR)) rmSync(TEMP_DIR, { recursive: true });
    process.exit(0);
});

process.on('SIGTERM', () => {
    if (existsSync(TEMP_DIR)) rmSync(TEMP_DIR, { recursive: true });
    process.exit(0);
});
