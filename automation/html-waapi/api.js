#!/usr/bin/env node

/**
 * StudioPro WAAPI API (Independent)
 * 
 * Standalone StudioPro for WAAPI clips — no dependency on html-static.
 * Uses SVG foreignObject for frame capture (5-15ms/frame) instead of
 * html2canvas (500ms/frame).
 * 
 * The export pipeline (MediaBunny/FTRT) runs in the browser, same as html-static.
 * The difference is how frames are captured for WAAPI clips:
 *   - html-static: html2canvas (slow, unreliable for CSS animations)
 *   - html-waapi:  SVG foreignObject + seekToFrame (fast, deterministic)
 */

import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Chrome detection (same as html-static) ────────────────────────────────

function findChrome() {
    if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
    try {
        const configPath = path.join(__dirname, '..', 'config.json');
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            if (config.chromePath && fs.existsSync(config.chromePath)) return config.chromePath;
        }
    } catch (e) {}
    const commonPaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome'
    ];
    for (const p of commonPaths) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

const CHROME_PATH = findChrome();
const PORT_PRIORITY = [7000, 3000, 3001];
const USER_DATA_DIR = path.join(__dirname, '.chrome-profile');

// ── WAAPI Adapter (injected into iframes) ────────────────────────────────

const WAAPI_SEEK_ADAPTER = `
(function() {
    'use strict';
    window.seekToFrame = function(frame, framesPerSec) {
        var fps = framesPerSec || 30;
        var ms = (frame / fps) * 1000;
        try {
            var animations = document.getAnimations({ subtree: true });
            animations.forEach(function(anim) {
                anim.pause();
                anim.currentTime = ms;
            });
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
    window.getAnimationState = function(frame, fps) {
        fps = fps || 30;
        var ms = (frame / fps) * 1000;
        var animations = document.getAnimations({ subtree: true });
        return animations.map(function(a) {
            return {
                name: a.animationName || 'unnamed',
                duration: a.effect ? a.effect.getComputedTiming().duration : 0,
                currentTime: a.currentTime,
                playState: a.playState
            };
        });
    };
})();`;

// ── SVG ForeignObject Capture (injected into page) ───────────────────────

const SVG_CAPTURE_FN = `
window.__waapiCaptureFrame = async function(iframe, width, height) {
    if (!iframe || !iframe.contentDocument || !iframe.contentDocument.body) {
        return null;
    }
    var doc = iframe.contentDocument;
    var body = doc.body;

    // Gather styles
    var styles = Array.from(doc.querySelectorAll('style')).map(function(s) { return s.textContent; }).join('\\n');
    var links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map(function(l) {
        return '@import url("' + l.href + '");';
    }).join('\\n');

    // Inline computed styles for accurate rendering
    var inlineCSS = '';
    var allEls = body.querySelectorAll('*');
    var importantProps = [
        'width','height','position','display','flex-direction','justify-content',
        'align-items','gap','padding','margin','background','background-color',
        'background-image','border','border-radius','box-shadow','font-family',
        'font-size','font-weight','font-style','color','text-align','text-decoration',
        'line-height','opacity','transform','overflow','z-index'
    ];
    allEls.forEach(function(el) {
        try {
            var cs = getComputedStyle(el);
            var css = '';
            importantProps.forEach(function(p) {
                var v = cs.getPropertyValue(p);
                if (v && v !== 'initial' && v !== 'normal' && v !== 'none') {
                    css += p + ':' + v + ';';
                }
            });
            if (css) {
                var tag = el.tagName.toLowerCase();
                var sel = tag + (el.id ? '#'+el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : '');
                inlineCSS += sel + '{' + css + '}\\n';
            }
        } catch(e) {}
    });

    var svgData = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">' +
        '<foreignObject width="100%" height="100%">' +
        '<div xmlns="http://www.w3.org/1999/xhtml" style="width:' + width + 'px;height:' + height + 'px;">' +
        '<style>' + links + '\\n' + styles + '\\n' + inlineCSS + '</style>' +
        body.innerHTML +
        '</div>' +
        '</foreignObject>' +
        '</svg>';

    return new Promise(function(resolve, reject) {
        var img = new Image();
        var blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        img.onload = function() {
            var canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            try {
                var dataUrl = canvas.toDataURL('image/png');
                resolve(dataUrl);
            } catch(e) {
                resolve(null);
            }
        };
        img.onerror = function() {
            URL.revokeObjectURL(url);
            resolve(null);
        };
        img.src = url;
    });
};

// Seek a specific clip's iframe to a given frame
window.__waapiSeekClip = function(clipId, frame, fps) {
    fps = fps || 30;
    var clips = (typeof State !== 'undefined' && State.clips) ? State.clips : [];
    var clip = clips.find(function(c) { return c.id === clipId; });
    if (!clip || !clip._htmlIframe) return false;
    try {
        var win = clip._htmlIframe.contentWindow;
        if (win && typeof win.seekToFrame === 'function') {
            win.seekToFrame(frame, fps);
            return true;
        }
    } catch(e) {}
    return false;
};

// Get all WAAPI clips info
window.__getWaaapiClips = function() {
    var clips = (typeof State !== 'undefined' && State.clips) ? State.clips : [];
    return clips.filter(function(c) { return c._isWaaapi; }).map(function(c) {
        return {
            id: c.id,
            start: c.start,
            duration: c.duration,
            width: c.width || 1920,
            height: c.height || 1080,
            hasIframe: !!c._htmlIframe,
            ready: c._htmlReady || false
        };
    });
};
`;

// ── StudioPro WAAPI Class ────────────────────────────────────────────────

class StudioProWAAPI {
    constructor(options = {}) {
        this.browser = null;
        this.page = null;
        this.url = options.url || process.env.STUDIO_PRO_URL || null;
        this.headless = options.headless !== false;
        this.timeout = options.timeout || 120000;
    }

    async _detectPort() {
        if (this.url) return;
        const http = await import('http');
        for (const port of PORT_PRIORITY) {
            const url = `http://localhost:${port}`;
            const ok = await new Promise((resolve) => {
                http.default.get(url, (res) => { res.resume(); resolve(true); })
                    .on('error', () => resolve(false))
                    .setTimeout(1500, function() { this.destroy(); resolve(false); });
            });
            if (ok) {
                this.url = url;
                console.log(`[WAAPI] Auto-detected dev server on port ${port}`);
                return;
            }
        }
        throw new Error(
            `❌ No dev server found on ports ${PORT_PRIORITY.join(', ')}\n` +
            `   Run: npm run dev`
        );
    }

    async launch() {
        if (!CHROME_PATH) {
            throw new Error('Chrome not found. Set CHROME_PATH or check config.json');
        }

        await this._detectPort();

        // Verify dev server is Vite
        const http = await import('http');
        const pageHtml = await new Promise((resolve, reject) => {
            http.default.get(this.url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', () => reject(new Error('not running'))).setTimeout(3000, function() { this.destroy(); reject(new Error('timeout')); });
        }).catch(() => null);

        if (!pageHtml || !pageHtml.includes('@vite/client')) {
            throw new Error(`❌ Wrong server at ${this.url}. Run: npm run dev`);
        }
        console.log(`[WAAPI] Dev server verified (Vite) at ${this.url}`);

        console.log('[WAAPI] Launching Chrome...');
        this.browser = await puppeteer.launch({
            headless: this.headless ? 'new' : false,
            executablePath: CHROME_PATH,
            userDataDir: USER_DATA_DIR,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webcodecs']
        });
        this.page = await this.browser.newPage();
        await this.page.setViewport({ width: 1920, height: 1080 });

        console.log(`[WAAPI] Connecting to ${this.url}...`);
        await this.page.goto(this.url, { waitUntil: 'domcontentloaded', timeout: this.timeout });
        await this.page.waitForFunction('window.StudioPro !== undefined', { timeout: this.timeout });
        console.log('[WAAPI] Connected successfully');

        // Inject WAAPI seek adapter and SVG capture function into the page
        console.log('[WAAPI] Injecting seek engine + SVG capture...');
        await this.page.evaluate(WAAPI_SEEK_ADAPTER);
        await this.page.evaluate(SVG_CAPTURE_FN);
        console.log('[WAAPI] Ready for WAAPI composition');
    }

    async execute(scriptPath) {
        if (!fs.existsSync(scriptPath)) throw new Error(`Script not found: ${scriptPath}`);
        const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
        console.log(`[WAAPI] Executing: ${scriptPath}`);

        const result = await this.page.evaluate((code) => {
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
        }, scriptContent);

        if (!result.success) throw new Error(`Script failed: ${result.error}`);
        console.log('[WAAPI] Script executed successfully');
    }

    /**
     * Pre-load WAAPI clips: create iframes, write content, wait for fonts.
     * Uses SVG foreignObject for frame capture (NOT html2canvas).
     */
    async preloadWaaapiClips() {
        console.log('[WAAPI] Pre-loading WAAPI clips (CDP screenshots — no html2canvas)...');
        const startTime = Date.now();

        const clipInfo = await this.page.evaluate(async () => {
            const clips = window.__getWaaapiClips ? window.__getWaaapiClips() : [];
            const results = [];

            for (const info of clips) {
                const clip = State.clips.find(c => c.id === info.id);
                if (!clip) continue;

                // Create iframe if not exists
                if (!clip._htmlIframe) {
                    const iframe = document.createElement('iframe');
                    iframe.style.cssText = 'position:absolute;left:-9999px;width:' + (info.width || 1920) + 'px;height:' + (info.height || 1080) + 'px;border:none;';
                    document.body.appendChild(iframe);
                    clip._htmlIframe = iframe;
                }

                const iframe = clip._htmlIframe;
                const doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
                if (!doc) { results.push({ id: info.id, status: 'no-doc' }); continue; }

                // Write content with WAAPI adapter
                const fonts = clip.fonts || [];
                const allFonts = [...new Set([...(State.googleFonts || []), ...fonts])];
                const fontLinks = allFonts.map(fn =>
                    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=' + fn.replace(/\s+/g, '+') + ':wght@400;600;700;900&display=swap">'
                ).join('\n');
                const sysRules = (State.importedSystemFonts || []).map(fn =>
                    `@font-face{font-family:'${fn}';src:local('${fn}');}`
                ).join('\n');

                // Build WAAPI adapter inline (seekToFrame)
                const seekJs = '<scr' + 'ipt>' + `window.seekToFrame=function(f,fps){var ms=(f/(fps||30))*1000;try{var els=document.querySelectorAll("*");for(var i=0;i<els.length;i++){var el=els[i];var cs=getComputedStyle(el);var dur=parseFloat(cs.animationDuration)||1000;var ad=parseFloat(cs.animationDelay)||0;var it=cs.animationIterationCount;var ti=parseFloat(it);if(isNaN(ti))ti=999999;var td=dur*ti;var em=ms+ad*1000;if(em<0)em=0;if(td>0&&em>td)em=td;el.style.animationDelay=(-em)+"s";el.style.animationPlayState="paused";}}catch(e){}try{document.documentElement.style.setProperty("--frame",f);document.documentElement.style.setProperty("--progress",(ms/1000).toFixed(4));}catch(e){}try{if(typeof window.animate==="function")window.animate(ms/1000);}catch(e){}};` + '</scr' + 'ipt>';

                doc.open();
                doc.write('<!DOCTYPE html><html><head><meta charset="UTF-8">' +
                    fontLinks + '<style>*{margin:0;padding:0;box-sizing:border-box;}' + sysRules +
                    'body{width:' + (info.width || 1920) + 'px;height:' + (info.height || 1080) + 'px;overflow:hidden;background:transparent;}' +
                    (clip.css || '') + '</style></head><body>' +
                    seekJs + (clip.html || '') +
                    (clip.js ? '<scr' + 'ipt>' + clip.js + '</scr' + 'ipt>' : '') +
                    '</body></html>');
                doc.close();

                // Wait for content to load
                await new Promise(r => setTimeout(r, 100));

                // Seek to frame 0
                try { iframe.contentWindow.seekToFrame(0, 30); } catch(e) {}
                await new Promise(r => setTimeout(r, 50));

                // Test SVG capture
                const dataUrl = await window.__waapiCaptureFrame(iframe, info.width || 1920, info.height || 1080);
                const captureOk = !!dataUrl && dataUrl.length > 100;

                results.push({
                    id: info.id,
                    status: captureOk ? 'ok' : 'capture-failed',
                    contentLen: doc.body.innerHTML.length,
                    captureSize: dataUrl ? dataUrl.length : 0
                });
            }
            return results;
        });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const ok = clipInfo.filter(r => r.status === 'ok').length;
        const fail = clipInfo.filter(r => r.status !== 'ok').length;
        console.log(`[WAAPI] Pre-loaded ${ok}/${clipInfo.length} clips in ${elapsed}s (SVG foreignObject)`);
        if (fail > 0) console.log(`[WAAPI] ⚠️  ${fail} clips failed SVG capture`);
    }

    async export(outputPath, options = {}) {
        const { quality = 'ultra', format = 'mp4', mode = 'mediabunny' } = options;
        const FORMAT_MAP = {
            'ftrt-mp4': 'video-ftrt-mp4', 'ftrt-webm': 'video-ftrt-webm',
            'standard-mp4': 'video-mp4', 'standard-webm': 'video-webm',
            'mediabunny-mp4': 'video-mediabunny-mp4', 'mediabunny-webm': 'video-mediabunny',
            'mp4': 'video-mediabunny-mp4', 'webm': 'video-mediabunny'
        };
        const formatValue = FORMAT_MAP[`${mode}-${format}`] || FORMAT_MAP[format] || 'video-mediabunny-mp4';

        console.log(`[WAAPI] Starting export (format: ${formatValue})...`);

        // Open export modal
        await this.page.evaluate((params) => {
            openExportModal();
            function setRadio(name, value) {
                const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
                if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
            }
            setRadio('exportFormat', params.formatValue);
            setRadio('exportScope', 'full');
            exportSelectOption();
        }, { formatValue });

        await this.page.evaluate(() => submitExport());

        // Monitor progress
        console.log('[WAAPI] Waiting for export...');
        const exportStart = Date.now();
        let lastProgress = -1;

        while (true) {
            const status = await this.page.evaluate(() => ({
                done: !State.isExporting,
                progress: parseInt(document.getElementById('exportProgressText')?.textContent) || 0
            }));
            if (status.done) break;

            // Auto-recover from FTRT stall
            const modalVisible = await this.page.evaluate(() => {
                const el = document.getElementById('ftrtFbOverlay');
                return el && !el.classList.contains('hidden');
            }).catch(() => false);
            if (modalVisible) {
                console.log('\n[WAAPI] FTRT stall → switching to MediaBunny...');
                await this.page.evaluate(() => {
                    const btn = document.getElementById('ftrtFbMediaBunny');
                    if (btn) btn.click();
                }).catch(() => {});
                await new Promise(r => setTimeout(r, 2000));
            }

            const p = status.progress;
            if (p >= lastProgress + 5) {
                lastProgress = p;
                process.stdout.write(`\r   ⏳ ${p}% (${((Date.now() - exportStart) / 1000).toFixed(0)}s)`);
            }
            await new Promise(r => setTimeout(r, 500));
        }
        console.log(`\n[WAAPI] Export complete in ${((Date.now() - exportStart) / 1000).toFixed(1)}s`);

        // Capture blob
        console.log('[WAAPI] Capturing export...');
        await new Promise(r => setTimeout(r, 1000));

        const blobData = await this.page.evaluate(async () => {
            if (!window._exportDoneUrl) return { error: '_exportDoneUrl is null' };
            try {
                const resp = await fetch(window._exportDoneUrl);
                const blob = await resp.blob();
                return new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve({ data: reader.result, size: blob.size });
                    reader.readAsDataURL(blob);
                });
            } catch (e) { return { error: e.message }; }
        });

        if (blobData?.data) {
            const base64 = blobData.data.split(',')[1];
            const buffer = Buffer.from(base64, 'base64');
            fs.writeFileSync(outputPath, buffer);
            console.log(`[WAAPI] Saved: ${outputPath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
        } else {
            console.log(`[WAAPI] Blob capture failed: ${blobData?.error}`);
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
            console.log('[WAAPI] Browser closed');
        }
        try {
            const fs = await import('fs');
            if (fs.default.existsSync(USER_DATA_DIR)) {
                fs.default.rmSync(USER_DATA_DIR, { recursive: true, force: true });
            }
        } catch(e) {}
    }
}

export { StudioProWAAPI };
