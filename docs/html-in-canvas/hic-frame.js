/* ═══════════════════════════════════════════════════════════════════════
 * hic-frame.js — shared frame geometry + SVG renderer for the HTML-in-Canvas
 * preview modals (test-renderer.html and designs.html both load this file).
 *
 * Single source of truth for:
 *   - ASPECTS / DESIGN_SPACES tables and the frame-geometry math
 *   - curFrame {aspect, bg, clipDS} — the mutable per-page frame state
 *   - HicRenderer — the SVG foreignObject design-space renderer
 *   - export preferences (hicExportPrefs in localStorage), shared so both
 *     modals remember (and sync) the same aspect/background/resolution
 *
 * Pages must load this BEFORE their main inline script and refer to the
 * frame state through curFrame (curFrame.aspect / curFrame.bg /
 * curFrame.clipDS) — there are no bare globals for those anymore.
 * ═══════════════════════════════════════════════════════════════════════ */

/* FRAME GEOMETRY — aspect + background of the OUTPUT frame.
 * The design space is contain-fitted inside the frame: a 9:16 export
 * pillarboxes a 16:9 design over the background color, so every preset
 * stays pixel-correct and preview === export. Resolution = the frame's
 * SHORT side ("1080p" works for every aspect). */
const ASPECTS = {
    '16:9': { rw: 16, rh: 9 },
    '9:16': { rw: 9, rh: 16 },
    '1:1':  { rw: 1, rh: 1 },
    '4:5':  { rw: 4, rh: 5 }
};

/* Native per-aspect DESIGN SPACES: a clip is authored against one of these
   and choreographs in its absolute px. 16:9 keeps the historical 800x450 so
   every existing preset stays pixel-identical. The frame aspect
   (curFrame.aspect) is the OUTPUT shape; when it differs from the clip's
   design aspect the design is contain-fitted (pillarbox/letterbox) —
   native-space clips fill their frame edge-to-edge with no bars. */
const DESIGN_SPACES = {
    '16:9': { w: 800, h: 450 },
    '9:16': { w: 450, h: 800 },
    '1:1':  { w: 720, h: 720 },
    '4:5':  { w: 640, h: 800 }
};

/* Mutable per-page frame state. clipDS = design space of the clip currently
   loaded in the page's modal. */
const curFrame = {
    aspect: '16:9',
    bg: 'transparent', /* 'transparent' keeps alpha in PNG/WebP exports */
    clipDS: '16:9'
};

function dsDims(ds) { return DESIGN_SPACES[ds || curFrame.clipDS] || DESIGN_SPACES['16:9']; }

function frameDims(shortSide) {
    const a = ASPECTS[curFrame.aspect] || ASPECTS['16:9'];
    let w, h;
    if (a.rw >= a.rh) { h = shortSide; w = Math.round(shortSide * a.rw / a.rh); }
    else { w = shortSide; h = Math.round(shortSide * a.rh / a.rw); }
    if (w % 2) w++; if (h % 2) h++; /* encoders want even dimensions */
    return { w, h };
}

/* True when two dimension pairs carry the same aspect (tolerance absorbs
   the even-dimension rounding in frameDims). */
function aspectMatches(a, b) {
    return Math.abs((a.w / a.h) - (b.w / b.h)) < 0.004;
}

/* ── Export preferences (shared localStorage key — both modals sync) ── */
const EXP_PREFS_KEY = 'hicExportPrefs';

/* Validates and applies the saved aspect + background into curFrame, and
   returns the raw saved values ({fmt, fps, res}) for the page to validate
   against its own tables (FMT_META / RESOLUTIONS). */
function readExpPrefs() {
    try {
        const saved = JSON.parse(localStorage.getItem(EXP_PREFS_KEY) || '{}');
        if (ASPECTS[saved.aspect]) curFrame.aspect = saved.aspect;
        if (typeof saved.bg === 'string' && (saved.bg === 'transparent' || /^#[0-9a-fA-F]{6}$/.test(saved.bg))) curFrame.bg = saved.bg;
        return saved;
    } catch (e) { return {}; }
}

function writeExpPrefs(extra) {
    try {
        const prev = (() => { try { return JSON.parse(localStorage.getItem(EXP_PREFS_KEY) || '{}'); } catch (e) { return {}; } })();
        localStorage.setItem(EXP_PREFS_KEY, JSON.stringify(Object.assign(prev, extra, { aspect: curFrame.aspect, bg: curFrame.bg })));
    } catch (e) { /* storage unavailable */ }
}

/* Cache for embedded remote stylesheets (Google Fonts css2 URLs etc.),
   keyed by URL — survives renderer rebuilds within and across pages. */
const FONT_CSS_CACHE = {};

/* ═══════════════════════════════════════════════════════════════════════
 * SVG foreignObject Renderer (design-space aware)
 * ═══════════════════════════════════════════════════════════════════════ */
class HicRenderer {
    /* w/h = raster canvas size (frame at export res, or design size for
       preview). sw/sh = DESIGN SPACE the clip choreographs in — DOM sandbox
       and the foreignObject content render at this size; the SVG then scales
       it to w/h natively (sharper than raster-upscale, and it replaces the
       old export scale-wrapper hack entirely). Defaults keep the classic
       800x450 space so every existing caller is unchanged. */
    constructor(w, h, sw, sh) {
        this.w = w; this.h = h;
        this.sw = sw || 800; this.sh = sh || 450;
        this.canvas = document.createElement('canvas');
        this.canvas.width = w; this.canvas.height = h;
        this.ctx = this.canvas.getContext('2d');
        this.sandbox = document.createElement('div');
        this.sandbox.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:' + this.sw + 'px;height:' + this.sh + 'px;overflow:hidden;pointer-events:none;';
        document.body.appendChild(this.sandbox);
        this.css = ''; this._onFrame = null; this._ready = false;
    }

    async setClip(html, css, js) {
        this.css = css || '';
        this.sandbox.innerHTML = '<div style="width:' + this.sw + 'px;height:' + this.sh + 'px;"></div>';
        /* 1. Load external scripts (KaTeX, marked, Tailwind CDN) in page context */
        html = await this._loadExternalScripts(html);
        /* 2. Inline external images as data URIs */
        html = await this._preloadImages(html);
        /* 3. Mount the html so the Tailwind Play CDN's MutationObserver sees the classes
              and generates its utilities <style> — then capture that CSS for the SVG.
              GATED: only when the clip actually uses Tailwind utilities. Once the CDN
              runtime is loaded it emits a preflight reset stylesheet for EVERY DOM
              change; capturing that unconditionally would append h1{font-size:inherit}
              etc. after the preset's own CSS and collapse its typography. */
        this.sandbox.innerHTML = html;
        var _usesTw = /class="[^"]*\b(bg-|text-|flex|grid-|p[xytblr]?-|m[xytblr]?-|rounded|shadow|font-|border|min-h-|max-w-|w-|h-|gap-|mt-|mb-|tracking-|from-|to-)/.test(html) || html.indexOf('tailwindcss') !== -1;
        if (_usesTw) {
            /* v4 browser build compiles async on MutationObserver (no window global).
               Poll for its managed <style> (identifiable by --tw- markers), then
               capture it for the SVG. Gated on _usesTw so the preflight reset it
               emits for every DOM change never pollutes non-Tailwind presets. */
            var twStyle = null;
            for (var _twWait = 0; _twWait < 20 && !twStyle; _twWait++) {
                await new Promise(r => setTimeout(r, 50));
                twStyle = [...document.querySelectorAll('head style')]
                    .filter(s => (s.textContent || '').indexOf('--tw-') !== -1)
                    .pop();
            }
            if (twStyle) this.css = (css || '') + '\n' + twStyle.textContent;
        }
        /* 4. Embed remote stylesheets (Google Fonts, KaTeX CSS) + their fonts as data URIs.
              SVG rasterization can't load external resources, so this is what makes them work. */
        const processed = await this._embedAssets(html, this.css);
        html = processed.html;
        this.css = processed.css;
        this.sandbox.innerHTML = html;
        /* 5. Wait for fonts to be ready so first raster isn't fallback-font */
        try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch(e) {}
        this._onFrame = null;
        if (js) {
            try {
                /* Wrap js so onFrame returns correctly */
                var fn = new Function('time', js + '\n;return typeof onFrame==="function"?onFrame:null;');
                this._onFrame = fn();
            } catch(e) { console.error('[Renderer] JS parse error:', e); }
        }
        this._ready = true;
    }

    /* External <script src> / <link rel=stylesheet> inside preset HTML — hoist into <head>.
       Scripts load SEQUENTIALLY (dynamically inserted scripts don't honor defer order,
       and auto-render must never beat katex.min.js to the global scope). */
    async _loadExternalScripts(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString('<div>' + html + '</div>', 'text/html');
        /* Stylesheets: left untouched — _embedAssets (next step in setClip) strips them from the
           html and inlines their content + fonts as data URIs. Rewriting or hoisting them here
           would lose the URL before the embed step can fetch it. */
        /* Scripts: sequential chain, each waits for the previous */
        const srcs = [...doc.querySelectorAll('script[src]')].map(s => { const v = s.getAttribute('src'); s.remove(); return v; }).filter(Boolean);
        for (const src of srcs) {
            if (src.indexOf('tailwind') !== -1) continue; /* CDN runtime handled separately */
            if (document.querySelector('script[src="' + src + '"]')) continue;
            await new Promise(res => {
                const s = document.createElement('script');
                s.src = src;
                if (src.indexOf('jsdelivr') !== -1 || src.indexOf('crossorigin') !== -1) s.crossOrigin = 'anonymous';
                s.onload = res; s.onerror = res;
                document.head.appendChild(s);
            });
        }
        html = doc.querySelector('div').innerHTML;
        /* Tailwind runtime loaded once globally from the locally installed
           @tailwindcss/browser (same 4.3.3 version as the app's PostCSS toolchain) —
           no CDN, works offline, and no "should not be used in production" warning.
           v4 sets no window global; it appends a managed <style> to <head> and
           compiles on MutationObserver — capture happens in setClip. */
        if (html.indexOf('tailwindcss') !== -1 || /class="[^"]*\b(bg-|text-|flex|grid-|p[xytblr]?-|m[xytblr]?-|rounded|shadow|font-|border)/.test(html)) {
            if (!document.getElementById('tw-browser-runtime')) {
                await new Promise(res => {
                    const s = document.createElement('script');
                    s.id = 'tw-browser-runtime';
                    /* Site base derived from this page's own URL: '/studio-pro/' on
                       GitHub Pages, '/' locally (page lives at <base>docs/...). An
                       absolute '/vendor/...' would 404 under the Pages base. */
                    var _slashDocs = location.pathname.indexOf('/docs/');
                    var _siteBase = _slashDocs > 0 ? location.pathname.slice(0, _slashDocs + 1) : '/';
                    s.src = _siteBase + 'vendor/tailwind-browser/index.global.js';
                    s.onload = res; s.onerror = res;
                    document.head.appendChild(s);
                    setTimeout(res, 3000); /* don't hang offline */
                });
            }
        }
        return html;
    }

    /* Fetch remote stylesheets (Google Fonts, KaTeX CDN, any https <link rel=stylesheet>)
       + their font files, inline everything as @font-face / url data URIs. The SVG
       rasterizer can't load external resources, so this is what makes web fonts work. */
    async _embedAssets(html, css) {
        const urls = [];
        const linkRe = /<link[^>]*href=["'](https:\/\/fonts\.googleapis\.com[^"']*)["'][^>]*>/gi;
        html = html.replace(linkRe, (_, url) => { urls.push(url.replace(/&amp;/g, '&')); return ''; });
        /* Any other remote stylesheet (KaTeX CSS, Tailwind builds, etc.) */
        const cdnLinkRe = /<link[^>]*rel=["']stylesheet["'][^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>/gi;
        const cdnLinkRe2 = /<link[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi;
        html = html.replace(cdnLinkRe, (_, url) => { urls.push(url.replace(/&amp;/g, '&')); return ''; });
        html = html.replace(cdnLinkRe2, (_, url) => { urls.push(url.replace(/&amp;/g, '&')); return ''; });
        const importRe = /@import\s+(?:url\()?["']?(https:\/\/fonts\.googleapis\.com[^"')\s]*)["']?\)?\s*;/gi;
        css = css.replace(importRe, (_, url) => { urls.push(url.replace(/&amp;/g, '&')); return ''; });
        let fontCss = '';
        for (const url of urls) {
            if (FONT_CSS_CACHE[url]) { fontCss += FONT_CSS_CACHE[url] + '\n'; continue; }
            try {
                const res = await fetch(url);
                if (!res.ok) continue;
                let sheet = await res.text();
                /* Collect every url(...) — absolute or relative (resolved against the sheet's base URL,
                   e.g. KaTeX ships `url(fonts/KaTeX_AMS-Regular.woff2)`) */
                const refs = [];
                const urlRe = /url\(\s*['"]?([^'")]+?)['"]?\s*\)/g;
                let mm;
                while ((mm = urlRe.exec(sheet)) !== null) {
                    const raw = mm[1];
                    if (/^data:/i.test(raw)) continue;
                    let abs = raw;
                    if (!/^https?:\/\//i.test(raw)) {
                        try { abs = new URL(raw, url).href; } catch(e) { continue; }
                    }
                    refs.push({ raw, abs });
                }
                /* Fetch unique absolute URLs once, then replace each ORIGINAL relative/absolute
                   occurrence in the sheet — split() on the absolute URL would miss relative paths */
                const uniqAbs = Array.from(new Set(refs.map(r => r.abs)));
                const dataMap = {};
                await Promise.all(uniqAbs.map(async abs => {
                    try {
                        const r = await fetch(abs);
                        const blob = await r.blob();
                        dataMap[abs] = await new Promise(resolve => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(blob);
                        });
                    } catch(e) {}
                }));
                refs.forEach(ref => { const d = dataMap[ref.abs]; if (d) sheet = sheet.split(ref.raw).join(d); });
                FONT_CSS_CACHE[url] = sheet;
                fontCss += sheet + '\n';
            } catch(e) { console.warn('[Renderer] Font fetch failed:', url); }
        }
        return { html, css: fontCss + '\n' + css };
    }

    async _preloadImages(htmlString) {
        const parser = new DOMParser();
        /* Wrap in a div: a bare parse hoists leading <link> into <head>, and body.innerHTML
           would silently drop it before _embedAssets ever sees the URL */
        const doc = parser.parseFromString('<div>' + htmlString + '</div>', 'text/html');
        const images = doc.querySelectorAll('img');
        const promises = Array.from(images).map(async (img) => {
            const src = img.getAttribute('src');
            if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
                try {
                    const resp = await fetch(src, { mode: 'cors' });
                    if (!resp.ok) throw new Error('fail');
                    const blob = await resp.blob();
                    const dataUrl = await new Promise((res, rej) => {
                        const reader = new FileReader();
                        reader.onloadend = () => res(reader.result);
                        reader.onerror = rej;
                        reader.readAsDataURL(blob);
                    });
                    img.setAttribute('src', dataUrl);
                } catch(e) { /* keep original src as fallback */ }
            }
        });
        await Promise.allSettled(promises);
        return doc.querySelector('div').innerHTML;
    }

    renderFrame(timeMs) {
        if (!this._ready) return false;
        if (this._onFrame) {
            const origQSA = Document.prototype.querySelectorAll;
            const origGEBI = Document.prototype.getElementById;
            const sandbox = this.sandbox;
            Document.prototype.querySelectorAll = function(sel) { return sandbox.querySelectorAll(sel); };
            Document.prototype.getElementById = function(id) { return sandbox.querySelector('#' + id) || origGEBI.call(document, id); };
            try { this._onFrame(timeMs); } catch(e) { console.error('[Renderer] onFrame error:', e); }
            Document.prototype.querySelectorAll = origQSA;
            Document.prototype.getElementById = origGEBI;
        }
        const clone = this.sandbox.cloneNode(true);
        clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
        clone.setAttribute('style', 'width:100%;height:100%;margin:0;padding:0;overflow:hidden;');
        const domString = new XMLSerializer().serializeToString(clone);
        /* The raster canvas always carries the DESIGN aspect: when raster size ≠
           design size (exports upscale for sharp text; drawFrame passes the
           frame size when aspects match) the SVG rasterizes the design at full
           width and the foreignObject's inner scale(k) shrinks it uniformly —
           vector-sharp, never stretched. drawFrame is the ONLY place aspect
           fitting happens, so this canvas can never clip the design. */
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + this.w + '" height="' + this.h + '">' +
            '<foreignObject width="100%" height="100%">' +
            '<style xmlns="http://www.w3.org/1999/xhtml"><![CDATA[' + this.css + ']]></style>' +
            '<div xmlns="http://www.w3.org/1999/xhtml" style="width:' + this.w + 'px;height:' + this.h + 'px;overflow:hidden;">' +
            '<div xmlns="http://www.w3.org/1999/xhtml" style="width:' + this.sw + 'px;height:' + this.sh + 'px;overflow:hidden;transform-origin:0 0;transform:scale(' + (this.w / this.sw) + ')">' +
            domString + '</div></div></foreignObject></svg>';
        return new Promise(resolve => {
            const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
            const img = new Image();
            img.onload = () => { this.ctx.clearRect(0, 0, this.w, this.h); this.ctx.drawImage(img, 0, 0); resolve(true); };
            img.onerror = () => { this.ctx.fillStyle = '#1e293b'; this.ctx.fillRect(0, 0, this.w, this.h); this.ctx.fillStyle = '#f87171'; this.ctx.font = '14px sans-serif'; this.ctx.fillText('Render Error', 16, 24); resolve(false); };
            img.src = url;
        });
    }

    drawTo(targetCtx, x, y, w, h) { targetCtx.drawImage(this.canvas, 0, 0, this.w, this.h, x, y, w, h); }

    /* Composite onto an output-size ctx: background fill first, then the
       design raster contain-fitted and centered. When the frame aspect equals
       the clip's design aspect the raster IS the frame — no bars, native
       per-aspect design spaces fill edge-to-edge. */
    drawFrame(ctx, fw, fh) {
        ctx.clearRect(0, 0, fw, fh);
        if (curFrame.bg !== 'transparent') { ctx.fillStyle = curFrame.bg; ctx.fillRect(0, 0, fw, fh); }
        if (fw === this.w && fh === this.h) { this.drawTo(ctx, 0, 0, this.w, this.h); return; }
        /* Contain-fit the raster (which always carries the design aspect) */
        const k = Math.min(fw / this.w, fh / this.h);
        const dw = Math.round(this.w * k), dh = Math.round(this.h * k);
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        this.drawTo(ctx, Math.round((fw - dw) / 2), Math.round((fh - dh) / 2), dw, dh);
    }
}

/* Shared renderer builder: raster canvas + design space (see HicRenderer).
   Pages alias this as makeRenderer so call sites stay short. */
function makeHicRenderer(w, h, sw, sh) { return new HicRenderer(w, h, sw, sh); }

/* ═══════════════════════════════════════════════════════════════════
 * Frame controls: aspect dropdown + background swatches
 * ═══════════════════════════════════════════════════════════════════
 * One canonical control pair mounted by every page (test-renderer,
 * designs gallery, prompts-engineer) so the frame UI is pixel-identical
 * everywhere and styled from one place. */
(function injectFrameControlsCss() {
    if (document.getElementById('hic-frame-controls-css')) return;
    const st = document.createElement('style');
    st.id = 'hic-frame-controls-css';
    st.textContent =
        '.hic-frame-controls{display:inline-flex;gap:8px;align-items:center}' +
        '.hic-aspect-select{background:#1e2533;color:#e2e8f0;border:1px solid #2d3748;border-radius:7px;padding:5px 8px;font:600 11px \'Rubik\',sans-serif;cursor:pointer;outline:none;min-width:64px}' +
        '.hic-aspect-select:focus{border-color:#4a90d9}' +
        '.hic-bg-row{display:inline-flex;gap:5px;align-items:center;padding:4px 6px;border:1px solid #2d3748;border-radius:8px;background:#0d1320}' +
        '.hic-bg-swatch{width:22px;height:22px;border-radius:5px;border:1px solid #3a4353;cursor:pointer;padding:0;display:inline-flex;align-items:center;justify-content:center;transition:transform .12s, box-shadow .12s;background:#1a2334}' +
        '.hic-bg-swatch:hover{transform:scale(1.12)}' +
        '.hic-bg-swatch.selected{box-shadow:0 0 0 2px #2563eb;border-color:#2563eb}' +
        '.hic-bg-transparent{background:repeating-conic-gradient(#3a4353 0% 25%, #1a2334 0% 50%) 0 0/8px 8px}' +
        '.hic-bg-custom{position:relative;width:22px;height:22px;border-radius:5px;border:1px dashed #4a90d9;display:inline-block;cursor:pointer;background:conic-gradient(#ef4444,#eab308,#22c55e,#3b82f6,#a855f7,#ef4444)}' +
        '.hic-bg-custom input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}' +
        '.hic-bg-custom.selected{box-shadow:0 0 0 2px #2563eb;border-style:solid}';
    document.head.appendChild(st);
})();

function mountFrameControls(host, opts) {
    opts = opts || {};
    host.classList.add('hic-frame-controls');
    host.innerHTML =
        '<select class="hic-aspect-select" title="Frame aspect ratio — sets the design space for native presets and AI pastes">' +
            '<option value="16:9">16:9</option><option value="9:16">9:16</option>' +
            '<option value="1:1">1:1</option><option value="4:5">4:5</option>' +
        '</select>' +
        '<span class="hic-bg-row" title="Frame background (fills the bars around the design; Transparent keeps alpha in PNG/WebP exports)">' +
            '<button type="button" class="hic-bg-swatch hic-bg-transparent" data-bg="transparent" title="Transparent">' +
                '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="0" y="0" width="6" height="6" fill="#9aa4b2"/><rect x="6" y="6" width="6" height="6" fill="#9aa4b2"/><rect x="6" y="0" width="6" height="6" fill="#3a4353"/><rect x="0" y="6" width="6" height="6" fill="#3a4353"/></svg>' +
            '</button>' +
            '<button type="button" class="hic-bg-swatch" data-bg="#ffffff" title="White" style="background:#ffffff"></button>' +
            '<button type="button" class="hic-bg-swatch" data-bg="#0b0f1a" title="Dark" style="background:#0b0f1a"></button>' +
            '<label class="hic-bg-custom" title="Custom background color"><input type="color" value="#2563eb"></label>' +
        '</span>';
    const sel = host.querySelector('.hic-aspect-select');
    const input = host.querySelector('.hic-bg-custom input');
    const isLocked = function() { try { return opts.isLocked ? opts.isLocked() : false; } catch (e) { return false; } };
    function apply(change) {
        sync();
        writeExpPrefs({});
        if (change && opts.onFrame) opts.onFrame();
    }
    sel.addEventListener('change', function() {
        if (isLocked()) { sel.value = curFrame.aspect; return; }
        curFrame.aspect = sel.value;
        apply(true);
    });
    host.querySelector('.hic-bg-row').addEventListener('click', function(e) {
        const s = e.target.closest('.hic-bg-swatch');
        if (!s || isLocked()) return;
        curFrame.bg = s.getAttribute('data-bg');
        apply(true);
    });
    input.addEventListener('input', function() {
        if (isLocked()) return;
        curFrame.bg = input.value;
        apply(true);
    });
    function sync() {
        sel.value = curFrame.aspect;
        host.querySelectorAll('.hic-bg-swatch').forEach(function(s) { s.classList.toggle('selected', s.getAttribute('data-bg') === curFrame.bg); });
        host.querySelector('.hic-bg-custom').classList.toggle('selected', curFrame.bg !== 'transparent' && !host.querySelector('.hic-bg-swatch.selected'));
    }
    sync();
    return { sync: sync };
}
