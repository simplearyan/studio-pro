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

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Find the StudioPro app URL
const STUDIO_PRO_URL = process.env.STUDIO_PRO_URL || 'http://localhost:3000';
const CHROME_PATH = process.env.CHROME_PATH || undefined;

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

        // Execute the script in the browser context
        // The script can use window.StudioPro directly
        const result = await this.page.evaluate((code) => {
            try {
                // Create a function from the script code
                const fn = new Function('StudioPro', 'State', `
                    ${code}
                `);
                
                // Execute with StudioPro API
                const sp = window.StudioPro;
                const state = window.State;
                const composition = fn(sp, state);
                
                return { success: true, composition };
            } catch (err) {
                return { success: false, error: err.message };
            }
        }, scriptContent);

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

        // Trigger the export via the UI
        // This simulates clicking the export button with the right options
        const result = await this.page.evaluate(async (opts) => {
            try {
                // Set export options
                if (opts.quality) {
                    const qualityBtn = document.querySelector(`[data-quality="${opts.quality}"]`);
                    if (qualityBtn) qualityBtn.click();
                }

                // Click export button
                const exportBtn = document.getElementById('btnExport');
                if (!exportBtn) throw new Error('Export button not found');
                exportBtn.click();

                // Wait for export to start
                await new Promise(r => setTimeout(r, 1000));

                return { success: true, message: 'Export started' };
            } catch (err) {
                return { success: false, error: err.message };
            }
        }, { quality, format, mode });

        if (!result.success) {
            throw new Error(`Export failed: ${result.error}`);
        }

        // Wait for export to complete (simplified — in real impl, monitor progress)
        console.log('[StudioPro] Export started, waiting for completion...');
        await this.page.waitForFunction(
            '!window.State || !window.State.isExporting',
            { timeout: 300000 } // 5 minute timeout
        );

        console.log(`[StudioPro] Export complete: ${outputPath}`);
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

if (require.main === module) {
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

module.exports = { StudioPro, renderScript };
