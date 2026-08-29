/**
 * HTML-in-Canvas Renderer
 * 
 * Renders HTML/CSS/JS directly onto a <canvas> element using
 * SVG foreignObject — zero dependencies, full CSS support.
 * 
 * Approach (matching canvas_animator_studio reference):
 *   1. HTML is rendered in a hidden <div> sandbox (offscreen)
 *   2. onFrame(time) callback updates DOM for animation
 *   3. cloneNode(true) + XMLSerializer serializes DOM → XHTML
 *   4. <style> tag placed as SIBLING of content div (not inside)
 *   5. new Image() loads SVG as raster bitmap
 *   6. ctx.drawImage() paints to canvas
 */

import { embedWebFonts, preloadImages } from './preload.js';

export class HTMLCanvasRenderer {
    /**
     * @param {number} width  - Canvas width in pixels
     * @param {number} height - Canvas height in pixels
     */
    constructor(width = 1920, height = 1080) {
        this.width = width;
        this.height = height;

        // Offscreen canvas for rendering
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext('2d');

        // Hidden sandbox for DOM rendering
        // NOTE: sandbox must NOT have inline positioning styles — 
        // they would be cloned into the SVG and break rendering.
        // Use a separate offscreen wrapper if you need to hide it.
        this.sandbox = document.createElement('div');
        this.sandbox.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:' + width + 'px;height:' + height + 'px;overflow:hidden;pointer-events:none;';
        document.body.appendChild(this.sandbox);

        // Current state
        this.css = '';
        this.js = '';
        this._onFrame = null;
        this._ready = false;
    }

    /**
     * Load a clip's HTML/CSS/JS and preload fonts + images.
     * 
     * @param {string} html - HTML string
     * @param {string} css  - CSS string
     * @param {string} js   - JavaScript string (should define onFrame(time))
     * @returns {Promise<void>}
     */
    async setClip(html, css, js) {
        // 1. Preload fonts (Google Fonts → data URIs)
        const { html: preloadedHtml, css: preloadedCss } = await embedWebFonts(html, css);

        // 2. Preload images (external URLs → data URIs)
        const finalHtml = await preloadImages(preloadedHtml);

        // 3. Store state
        this.css = preloadedCss || '';
        this.js = js || '';

        // 4. Set sandbox content
        this.sandbox.innerHTML = finalHtml;

        // 5. Compile JS into onFrame function
        this._onFrame = null;
        if (this.js) {
            try {
                const code = this.js + '\n;return typeof onFrame === "function" ? onFrame : null;';
                this._onFrame = new Function('time', code)();
            } catch (e) {
                console.error('[HTMLCanvas] JS compile error:', e);
            }
        }

        this._ready = true;
    }

    /**
     * Render a single frame at the given time.
     * 
     * Uses the same approach as canvas_animator_studio:
     *   - cloneNode(true) + XMLSerializer for XHTML serialization
     *   - Override clone style to remove sandbox positioning
     *   - <style> tag as SIBLING of content div (not inside it)
     * 
     * @param {number} timeMs - Time in milliseconds
     * @returns {Promise<boolean>} true if render succeeded
     */
    async renderFrame(timeMs) {
        if (!this._ready) return false;

        // 1. Update DOM via user's onFrame callback
        if (this._onFrame) {
            try {
                this._onFrame(timeMs);
            } catch (e) {
                console.error('[HTMLCanvas] onFrame error:', e);
            }
        }

        // 2. Clone DOM + override style (KEY: removes sandbox positioning)
        try {
            const clone = this.sandbox.cloneNode(true);
            clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
            clone.setAttribute('style', 'width:100%;height:100%;margin:0;padding:0;overflow:hidden;');

            // 3. Serialize to well-formed XHTML
            const domString = new XMLSerializer().serializeToString(clone);

            // 4. Build SVG: <style> as SIBLING of content div
            const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + this.width + '" height="' + this.height + '">' +
                '<foreignObject width="100%" height="100%">' +
                '<style xmlns="http://www.w3.org/1999/xhtml">' + this.css + '</style>' +
                '<div xmlns="http://www.w3.org/1999/xhtml" style="width:' + this.width + 'px;height:' + this.height + 'px;overflow:hidden;">' +
                domString +
                '</div></foreignObject></svg>';

            // 5. Draw to canvas via Image
            return new Promise((resolve) => {
                const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
                const img = new Image();
                img.onload = () => {
                    this.ctx.clearRect(0, 0, this.width, this.height);
                    this.ctx.drawImage(img, 0, 0);
                    resolve(true);
                };
                img.onerror = () => {
                    console.error('[HTMLCanvas] SVG image load failed');
                    this.ctx.fillStyle = '#1e293b';
                    this.ctx.fillRect(0, 0, this.width, this.height);
                    this.ctx.fillStyle = '#ef4444';
                    this.ctx.font = '24px sans-serif';
                    this.ctx.fillText('Render Error', 40, 60);
                    resolve(false);
                };
                img.src = url;
            });
        } catch (e) {
            console.error('[HTMLCanvas] Render error:', e);
            return false;
        }
    }

    /**
     * Draw the rendered canvas onto another canvas context.
     */
    drawTo(targetCtx, x = 0, y = 0, w = this.width, h = this.height) {
        targetCtx.drawImage(this.canvas, 0, 0, this.width, this.height, x, y, w, h);
    }

    /**
     * Get the rendered canvas as a Blob.
     */
    async toBlob(type = 'image/png', quality = 0.92) {
        return new Promise((resolve) => {
            this.canvas.toBlob(resolve, type, quality);
        });
    }

    /**
     * Resize the renderer.
     */
    resize(width, height) {
        this.width = width;
        this.height = height;
        this.canvas.width = width;
        this.canvas.height = height;
    }

    /**
     * Clean up resources.
     */
    destroy() {
        if (this.sandbox && this.sandbox.parentNode) {
            this.sandbox.parentNode.removeChild(this.sandbox);
        }
        this.canvas = null;
        this.ctx = null;
        this.sandbox = null;
        this._onFrame = null;
        this._ready = false;
    }
}

/**
 * Quick render: HTML/CSS/JS → canvas data URL (one-shot)
 */
export async function quickRender(html, css, js, timeMs = 0, width = 800, height = 600) {
    const renderer = new HTMLCanvasRenderer(width, height);
    await renderer.setClip(html, css, js);
    await renderer.renderFrame(timeMs);
    const dataUrl = renderer.canvas.toDataURL();
    renderer.destroy();
    return dataUrl;
}
