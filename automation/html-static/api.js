#!/usr/bin/env node

/**
 * StudioPro Code-to-Video API
 * 
 * Node.js wrapper that communicates with StudioPro via Puppeteer.
 * Allows AI agents to write entire videos programmatically.
 */

import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Find Chrome path
function findChrome() {
    if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
    try {
        const configPath = path.join(__dirname, '..', 'config.json');
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            if (config.chromePath && fs.existsSync(configPath)) return config.chromePath;
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
const STUDIO_PRO_URL = process.env.STUDIO_PRO_URL || 'http://localhost:3000';

class StudioPro {
    constructor(options = {}) {
        this.browser = null;
        this.page = null;
        this.url = options.url || STUDIO_PRO_URL;
        this.headless = options.headless !== false;
        this.timeout = options.timeout || 120000;
    }

    async launch() {
        if (!CHROME_PATH) {
            throw new Error('Chrome not found. Set CHROME_PATH or check config.json');
        }

        // Check dev server is running and is Vite (not http-server)
        const http = await import('http');
        const pageHtml = await new Promise((resolve, reject) => {
            http.default.get(this.url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', () => reject(new Error('not running'))).setTimeout(3000, function() { this.destroy(); reject(new Error('timeout')); });
        }).catch(() => null);

        if (!pageHtml) {
            throw new Error(`❌ Dev server not running at ${this.url}\n   Run: npm run dev`);
        }

        // Detect wrong server type (http-server shows directory listing)
        if (pageHtml.includes('Index of /') || !pageHtml.includes('@vite/client')) {
            throw new Error(
                `❌ Wrong server detected! The page at ${this.url} is NOT served by Vite.\n\n` +
                `   Your server is showing raw HTML without CSS/JS processing.\n` +
                `   This causes: broken layout, missing Tailwind styles, export failures.\n\n` +
                `   Fix:\n` +
                `   1. Kill the current server\n` +
                `   2. cd studio-pro-editor && npm run dev\n\n` +
                `   NEVER use: npx http-server, npx serve, python -m http.server`
            );
        }
        console.log('[StudioPro] Dev server verified (Vite)');

        console.log('[StudioPro] Launching Chrome...');
        this.browser = await puppeteer.launch({
            headless: this.headless ? 'new' : false,
            executablePath: CHROME_PATH,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webcodecs']
        });
        this.page = await this.browser.newPage();
        await this.page.setViewport({ width: 1920, height: 1080 });

        console.log(`[StudioPro] Connecting to ${this.url}...`);
        await this.page.goto(this.url, { waitUntil: 'domcontentloaded', timeout: this.timeout });
        await this.page.waitForFunction('window.StudioPro !== undefined', { timeout: this.timeout });
        console.log('[StudioPro] Connected successfully');
    }

    async execute(scriptPath) {
        if (!fs.existsSync(scriptPath)) throw new Error(`Script not found: ${scriptPath}`);
        const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
        console.log(`[StudioPro] Executing: ${scriptPath}`);

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
        console.log('[StudioPro] Script executed successfully');
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

        console.log(`[StudioPro] Starting export (format: ${formatValue})...`);

        // Step 1: Open modal + set radio values (matching working automation/render.js)
        await this.page.evaluate((params) => {
            openExportModal();

            function setRadio(name, value) {
                const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
                if (radio) {
                    radio.checked = true;
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }

            setRadio('exportFormat', params.formatValue);
            setRadio('exportScope', 'full');
            exportSelectOption();
        }, { formatValue });

        // Step 2: Click Submit Export (separate evaluate — same as working render.js)
        await this.page.evaluate(() => submitExport());

        // Step 3: Monitor progress
        console.log('[StudioPro] Waiting for export...');
        const exportStart = Date.now();
        let lastProgress = -1;

        while (true) {
            const status = await this.page.evaluate(() => ({
                done: !State.isExporting,
                progress: parseInt(document.getElementById('exportProgressText')?.textContent) || 0,
                currentTime: State.currentTime || 0
            }));

            if (status.done) break;

            // Check if FTRT stall modal appeared
            const modalVisible = await this.page.evaluate(() => {
                const el = document.getElementById('ftrtFbOverlay');
                return el && !el.classList.contains('hidden');
            }).catch(() => false);
            if (modalVisible) {
                console.log('\n[StudioPro] FTRT stall detected — switching to MediaBunny...');
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
        console.log(`\n[StudioPro] Export complete in ${((Date.now() - exportStart) / 1000).toFixed(1)}s`);

        // Step 4: Capture blob
        console.log('[StudioPro] Capturing export...');
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
            console.log(`[StudioPro] Saved: ${outputPath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
        } else {
            console.log(`[StudioPro] Blob capture failed: ${blobData?.error}`);
        }
    }

    async preloadHtmlClips() {
        console.log('[StudioPro] Pre-rendering HTML clips...');
        const startTime = Date.now();
        // Call the editor's built-in preRenderAllHtmlClips() which handles
        // iframe creation, content writing, font loading, and html2canvas capture
        await this.page.evaluate(() => {
            if (typeof window.preRenderAllHtmlClips === 'function') {
                return window.preRenderAllHtmlClips();
            }
        });
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[StudioPro] HTML clips pre-rendered in ${elapsed}s`);
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
            console.log('[StudioPro] Browser closed');
        }
    }
}

export { StudioPro };
