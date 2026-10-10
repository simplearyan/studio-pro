/**
 * inpage-encoder.js — drive encoder.html from Node (Track T1.2).
 *
 * The transport that replaced ffmpeg screenshots→libx264: every frame the
 * capture page screenshots is pushed straight into an in-page MediaBunny
 * encoder (the same Output/VideoSampleSource calls the editor's export worker
 * and test-renderer's startVideoExport make). Nothing touches disk; there is
 * no concat step; MP4 and WebM come from one code path.
 *
 * The encoder page must be same-origin with the dev server (module imports are
 * origin-blocked on file:// and data:). export-doctor names that failure.
 */

export class InPageEncoder {
    constructor(page) {
        this.page = page;
        this.pushed = 0;
        this.meta = null;
    }

    /** Open the encoder page on `baseUrl` (a dev-server origin). */
    static async open({ browser, baseUrl, verbose = false }) {
        const page = await browser.newPage();
        await page.setViewport({ width: 128, height: 128 });
        const url = baseUrl.replace(/\/$/, '') + '/automation/shared/export/encoder.html';
        await page.goto(url, { waitUntil: 'load', timeout: 30000 });
        await page.waitForFunction('window.__encReady === true', { timeout: 15000 });
        if (verbose) console.log(`[CDP] encoder ready at ${url}`);
        return new InPageEncoder(page);
    }

    async begin({ width, height, fps, format = 'mp4', bitrate = 0 }) {
        const res = await this.page.evaluate(
            (o) => window.__enc.begin(o),
            { width, height, fps, format, bitrate: bitrate || undefined }
        );
        return res; /* { codec, format } */
    }

    /** Push one PNG screenshot (Buffer or Uint8Array) — resolves when the encoder takes it. */
    async push(pngBuffer) {
        /* Buffer.from FIRST: puppeteer returns a Uint8Array, and
           uint8.toString('base64') silently yields "137,80,78,71,…" (the
           encoding argument is ignored by TypedArray#toString) — which the
           page's atob then rejects. */
        const b64 = (Buffer.isBuffer(pngBuffer) ? pngBuffer : Buffer.from(pngBuffer)).toString('base64');
        await this.page.evaluate(async (data) => { await window.__enc.push(data); }, b64);
        this.pushed++;
    }

    /** Finalize; returns meta with `buffer` (Buffer) attached. */
    async finish() {
        const meta = await this.page.evaluate(() => window.__enc.finish());
        if (!meta || !Array.isArray(meta.chunks) || !meta.chunks.length) {
            throw new Error('encoder finish carried no chunks');
        }
        const parts = meta.chunks.map((c) => Buffer.from(c, 'base64'));
        meta.buffer = Buffer.concat(parts);
        delete meta.chunks;
        this.meta = meta;
        return meta;
    }

    async abort() {
        try { await this.page.evaluate(() => window.__enc.abort()); } catch (e) { /* page gone */ }
    }

    async close() {
        try { await this.page.close(); } catch (e) { /* already gone */ }
    }
}
