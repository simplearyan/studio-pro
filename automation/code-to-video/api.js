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
        this.timeout = options.timeout || 30000;
    }

    async launch() {
        if (!CHROME_PATH) {
            throw new Error('Chrome not found. Set CHROME_PATH or check config.json');
        }

        // Check dev server
        const http = await import('http');
        const isUp = await new Promise((resolve) => {
            const req = http.default.get(this.url, (res) => {
                res.resume();
                resolve(true);
            });
            req.on('error', () => resolve(false));
            req.setTimeout(3000, () => { req.destroy(); resolve(false); });
        });
        if (!isUp) {
            throw new Error(`Dev server not running at ${this.url}. Run 'npm run dev' first.`);
        }

        console.log('[StudioPro] Launching Chrome...');
        this.browser = await puppeteer.launch({
            headless: this.headless ? 'new' : false,
            executablePath: CHROME_PATH,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1920,1080']
        });
        this.page = await this.browser.newPage();
        await this.page.setViewport({ width: 1920, height: 1080 });

        console.log(`[StudioPro] Connecting to ${this.url}...`);
        await this.page.goto(this.url, { waitUntil: 'networkidle0', timeout: this.timeout });
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
        const { quality = 'ultra', format = 'mp4', mode = 'ftrt' } = options;
        const FORMAT_MAP = {
            'ftrt-mp4': 'video-ftrt-mp4', 'ftrt-webm': 'video-ftrt-webm',
            'standard-mp4': 'video-mp4', 'standard-webm': 'video-webm',
            'mp4': 'video-mediabunny-mp4', 'webm': 'video-mediabunny'
        };
        const formatValue = FORMAT_MAP[`${mode}-${format}`] || FORMAT_MAP[format] || 'video-ftrt-mp4';

        console.log(`[StudioPro] Starting export (format: ${formatValue})...`);
        const result = await this.page.evaluate(async (params) => {
            try {
                if (typeof startExport === 'function') {
                    startExport(params.formatValue, 0, window.State?.duration || 60);
                } else {
                    throw new Error('startExport not found');
                }
                await new Promise(r => setTimeout(r, 500));
                return { success: true, isExporting: window.State?.isExporting };
            } catch (err) { return { success: false, error: err.message }; }
        }, { formatValue });

        if (!result.success) throw new Error(`Export failed: ${result.error}`);

        // Wait for export
        console.log('[StudioPro] Waiting for export...');
        const exportStart = Date.now();
        let lastProgress = -1;
        await new Promise(r => setTimeout(r, 2000));

        while (true) {
            const status = await this.page.evaluate(() => ({
                done: !window.State || !window.State.isExporting,
                progress: parseInt(document.getElementById('exportProgressText')?.textContent) || 0
            }));
            if (status.done && lastProgress >= 0) break;
            if (status.progress > lastProgress) {
                lastProgress = status.progress;
                process.stdout.write(`\r   ⏳ ${status.progress}% (${((Date.now() - exportStart) / 1000).toFixed(0)}s)`);
            }
            await new Promise(r => setTimeout(r, 500));
        }
        console.log(`\n[StudioPro] Export complete in ${((Date.now() - exportStart) / 1000).toFixed(1)}s`);

        // Wait for blob URL to be available
        console.log('[StudioPro] Capturing export...');
        
        // Wait for blob URL to be available (poll with timeout)
        for (let i = 0; i < 10; i++) {
            const hasUrl = await this.page.evaluate(() => !!window._exportDoneUrl);
            if (hasUrl) break;
            await new Promise(r => setTimeout(r, 1000));
        }

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
