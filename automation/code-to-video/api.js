#!/usr/bin/env node

/**
 * StudioPro Code-to-Video API
 * 
 * Node.js wrapper that communicates with StudioPro via Puppeteer.
 * Allows AI agents to write entire videos programmatically.
 * 
 * Usage:
 *   const { StudioPro } = require('./api');
 *   const studio = new StudioPro();
 *   await studio.launch();
 *   await studio.createComposition({ ... });
 *   await studio.export('output.mp4');
 *   await studio.close();
 * 
 * Or use the CLI:
 *   node render.js examples/product-launch.js
 */

import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Find the StudioPro app URL and Chrome path
const STUDIO_PRO_URL = process.env.STUDIO_PRO_URL || 'http://localhost:3000';

// Try to read Chrome path from config.json
let CHROME_PATH = process.env.CHROME_PATH || undefined;
if (!CHROME_PATH) {
    try {
        const configPath = path.join(__dirname, '..', 'config.json');
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            CHROME_PATH = config.chromePath;
        }
    } catch (e) {
        // config.json not found, use default
    }
}

class StudioPro {
    constructor(options = {}) {
        this.browser = null;
        this.page = null;
        this.url = options.url || STUDIO_PRO_URL;
        this.headless = options.headless !== false;
        this.timeout = options.timeout || 30000;
    }

    /**
     * Launch Chrome and connect to StudioPro
     */
    async launch() {
        // Check Chrome path
        if (!CHROME_PATH) {
            throw new Error('Chrome not found. Set CHROME_PATH env or check automation/config.json');
        }

        // Check dev server
        const http = await import('http');
        const isServerUp = await new Promise((resolve) => {
            const req = http.default.get(this.url, (res) => {
                res.resume();
                resolve(true);
            });
            req.on('error', () => resolve(false));
            req.setTimeout(3000, () => { req.destroy(); resolve(false); });
        });
        if (!isServerUp) {
            throw new Error(`Dev server not running at ${this.url}. Run 'npm run dev' first.`);
        }

        console.log('[StudioPro] Launching Chrome...');
        this.browser = await puppeteer.launch({
            headless: this.headless ? 'new' : false,
            executablePath: CHROME_PATH,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--window-size=1920,1080'
            ]
        });

        this.page = await this.browser.newPage();
        await this.page.setViewport({ width: 1920, height: 1080 });

        // Navigate to StudioPro
        console.log(`[StudioPro] Connecting to ${this.url}...`);
        await this.page.goto(this.url, { waitUntil: 'networkidle0', timeout: this.timeout });

        // Wait for StudioPro API to be available
        await this.page.waitForFunction('window.StudioPro !== undefined', { timeout: this.timeout });
        console.log('[StudioPro] Connected successfully');
    }

    /**
     * Execute a script file that defines a composition
     * The script receives the StudioPro API as an argument
     */
    async execute(scriptPath) {
        if (!fs.existsSync(scriptPath)) {
            throw new Error(`Script not found: ${scriptPath}`);
        }

        const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
        console.log(`[StudioPro] Executing script: ${scriptPath}`);

        // Parse the function on the Node side, then pass to browser as string
        // 1. Strip JSDoc comments, module.exports = / export default
        let fnBody = scriptContent
            .replace(/\/\*[\s\S]*?\*\//g, '')    // strip /* ... */
            .replace(/\/\/.*$/gm, '')              // strip // ...
            .replace(/\s*module\.exports\s*=\s*/g, '')
            .replace(/\s*export\s+default\s+/g, '')
            .replace(/;\s*$/, '')
            .trim();

        // 2. Convert 'function(StudioPro, State) { ... }' to arrow function string
        let fnStr;
        if (fnBody.startsWith('function')) {
            // Find the first { and last } to extract params and body
            const firstBrace = fnBody.indexOf('{');
            const lastBrace = fnBody.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                const params = fnBody.substring(fnBody.indexOf('('), fnBody.indexOf(')') + 1);
                const body = fnBody.substring(firstBrace, lastBrace + 1);
                fnStr = `${params} => ${body}`;
            } else {
                fnStr = fnBody;
            }
        } else {
            fnStr = fnBody;
        }

        console.log('[StudioPro] Transpiled function (first 200 chars):', fnStr.substring(0, 200));

        // 3. Execute in browser: create the arrow function and call it
        const result = await this.page.evaluate((fnCode) => {
            try {
                const scriptFn = new Function('return ' + fnCode)();
                const composition = scriptFn(window.StudioPro, window.State);
                return { success: true, composition };
            } catch (err) {
                return { success: false, error: err.message + ' | ' + err.stack };
            }
        }, fnStr);

        if (!result.success) {
            throw new Error(`Script execution failed: ${result.error}`);
        }

        console.log('[StudioPro] Script executed successfully');
        return result.composition;
    }

    /**
     * Create a composition directly via API calls
     */
    async createComposition(config) {
        console.log(`[StudioPro] Creating composition: ${config.id || 'unnamed'}`);

        const result = await this.page.evaluate((config) => {
            try {
                const clips = window.StudioPro.createComposition(config);
                return { success: true, clipCount: clips.length };
            } catch (err) {
                return { success: false, error: err.message };
            }
        }, config);

        if (!result.success) {
            throw new Error(`Composition creation failed: ${result.error}`);
        }

        console.log(`[StudioPro] Created ${result.clipCount} clips`);
        return result;
    }

    /**
     * Load fonts needed for the composition
     */
    async loadFonts(fontNames) {
        if (!fontNames || fontNames.length === 0) return;

        console.log(`[StudioPro] Loading fonts: ${fontNames.join(', ')}`);

        await this.page.evaluate((fonts) => {
            return window.StudioPro.fonts.loadGoogleBatch(fonts);
        }, fontNames);
    }

    /**
     * Export the current timeline to a video file
     */
    async export(outputPath, options = {}) {
        const {
            quality = 'ultra',
            format = 'mp4',
            mode = 'ftrt'
        } = options;

        console.log(`[StudioPro] Exporting to ${outputPath}...`);
        console.log(`[StudioPro] Quality: ${quality}, Format: ${format}, Mode: ${mode}`);

        // Trigger the export via the UI (same flow as existing render.js)
        const FORMAT_MAP = {
            'mp4': 'video-mediabunny-mp4',
            'webm': 'video-mediabunny',
            'ftrt-mp4': 'video-ftrt-mp4',
            'ftrt-webm': 'video-ftrt-webm',
            'standard-mp4': 'video-mp4',
            'standard-webm': 'video-webm'
        };

        const formatValue = FORMAT_MAP[`${mode}-${format}`] || FORMAT_MAP[format] || 'video-ftrt-mp4';

        const result = await this.page.evaluate(async (params) => {
            try {
                // Check what functions are available
                const funcs = {
                    openExportModal: typeof openExportModal,
                    submitExport: typeof submitExport,
                    exportSelectOption: typeof exportSelectOption,
                    setExportQuality: typeof setExportQuality,
                    startExport: typeof startExport
                };

                // Open export modal
                openExportModal();
                await new Promise(r => setTimeout(r, 1000));

                // Set radio buttons
                function setRadio(name, value) {
                    const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
                    if (radio) {
                        radio.checked = true;
                        radio.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }

                setRadio('exportFormat', params.formatValue);
                setRadio('exportResolution', '1920');
                setRadio('exportFrameRate', '30');
                if (params.quality && typeof setExportQuality === 'function') {
                    setExportQuality(params.quality);
                }
                setRadio('exportScope', 'full');
                if (typeof exportSelectOption === 'function') exportSelectOption();

                await new Promise(r => setTimeout(r, 500));

                // Click Start Export
                if (typeof submitExport === 'function') {
                    submitExport();
                } else {
                    throw new Error('submitExport not found');
                }

                // Wait a moment and check if export started
                await new Promise(r => setTimeout(r, 1000));
                const isExporting = window.State?.isExporting;

                return { success: true, message: 'Export started', isExporting, funcs };
            } catch (err) {
                return { success: false, error: err.message };
            }
        }, { formatValue, quality });

        if (!result.success) {
            throw new Error(`Export failed: ${result.error}`);
        }

        // Wait for export to complete (poll progress)
        console.log('[StudioPro] Export started, waiting for completion...');
        const exportStart = Date.now();
        let lastProgress = -1;

        // Wait a moment for export to actually start
        await new Promise(r => setTimeout(r, 2000));

        while (true) {
            const status = await this.page.evaluate(() => ({
                done: !window.State || !window.State.isExporting,
                progress: parseInt(document.getElementById('exportProgressText')?.textContent) || 0,
                currentTime: window.State?.currentTime || 0
            }));

            if (status.done && lastProgress >= 0) break;

            const p = status.progress;
            if (p > lastProgress) {
                lastProgress = p;
                const elapsedSec = ((Date.now() - exportStart) / 1000).toFixed(0);
                process.stdout.write(`\r   ⏳ ${p}% (${elapsedSec}s)`);
            }

            await new Promise(r => setTimeout(r, 500));
        }

        const elapsed = ((Date.now() - exportStart) / 1000).toFixed(1);
        console.log(`\n[StudioPro] Export complete in ${elapsed}s`);

        // Wait for blob URL to be available
        await new Promise(r => setTimeout(r, 1000));

        // Capture the export blob via _exportDoneUrl
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
            } catch (e) {
                return { error: e.message };
            }
        });

        if (blobData?.error) {
            console.log(`[StudioPro] Blob capture failed: ${blobData.error}`);
        } else if (blobData?.data) {
            const base64 = blobData.data.split(',')[1];
            const buffer = Buffer.from(base64, 'base64');
            fs.writeFileSync(outputPath, buffer);
            console.log(`[StudioPro] Saved: ${outputPath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
        }

        return outputPath;
    }

    /**
     * Get project info
     */
    async getProjectInfo() {
        return await this.page.evaluate(() => {
            return window.StudioPro.project();
        });
    }

    /**
     * Close the browser
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            console.log('[StudioPro] Browser closed');
        }
    }
}

// ── Quick helper: execute a script and export ──────────────────────────────

async function renderScript(scriptPath, outputPath, options = {}) {
    const studio = new StudioPro({
        headless: options.headless !== false,
        url: options.url || STUDIO_PRO_URL
    });

    try {
        await studio.launch();
        await studio.execute(scriptPath);
        await studio.export(outputPath, options);
        console.log(`\n✅ Render complete: ${outputPath}`);
    } catch (err) {
        console.error(`\n❌ Render failed: ${err.message}`);
        process.exit(1);
    } finally {
        await studio.close();
    }
}

// ── CLI entry point ────────────────────────────────────────────────────────

if (process.argv[1] && process.argv[1].endsWith('api.js')) {
    const args = process.argv.slice(2);

    if (args.length < 1) {
        console.log(`
StudioPro Code-to-Video

Usage:
  node api.js <script.js> [output.mp4] [options]

Options:
  --quality <draft|standard|ultra>  Video quality (default: ultra)
  --format <mp4|webm>               Video format (default: mp4)
  --mode <ftrt|standard>            Render mode (default: ftrt)
  --no-headless                     Show browser window
  --url <http://localhost:3000>     StudioPro URL

Examples:
  node api.js examples/product-launch.js output.mp4
  node api.js examples/social-reel.js reel.mp4 --quality standard
  node api.js examples/kinetic-text.js text.mp4 --format webm
        `);
        process.exit(0);
    }

    const scriptPath = args[0];
    const outputPath = args[1] || scriptPath.replace('.js', '.mp4');
    const options = {};

    // Parse options
    for (let i = 2; i < args.length; i++) {
        if (args[i] === '--quality' && args[i + 1]) options.quality = args[++i];
        if (args[i] === '--format' && args[i + 1]) options.format = args[++i];
        if (args[i] === '--mode' && args[i + 1]) options.mode = args[++i];
        if (args[i] === '--no-headless') options.headless = false;
        if (args[i] === '--url' && args[i + 1]) options.url = args[++i];
    }

    renderScript(scriptPath, outputPath, options);
}

export { StudioPro, renderScript };
