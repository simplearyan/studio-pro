#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
 * render-meta.mjs — regenerate site OG images + favicons with Playwright
 *
 * Drives test-renderer.html (the studio's SVG-foreignObject clip engine)
 * through the SAME seams a human uses: paste a fenced payload into the AI
 * tab, let aiApplyReply() build the stage, pick the frame aspect + bg,
 * seek the timeline, hit exportFrame(), capture the download — then
 * post-process on a blank workbench page (resize / encode / pixel
 * self-check) and write the finals into automation/meta/output/.
 *
 * Clips render in PARALLEL — one browser context per clip, so cold font
 * fetches overlap instead of stacking.
 *
 * Output set per OG clip (material, ios):
 *   og-<name>-1920x1080.webp        1080p native pass-through (og:image)
 *   og-<name>-1200x630.png          classic og:image size
 *   og-<name>-square-1200x1200.webp square card (1:1 frame + bg fill)
 * Favicon clip: 512 / 64 / 32 PNG.
 *
 * Usage (from studio-pro-editor/):
 *   node automation/meta/render-meta.mjs                 # full set
 *   node automation/meta/render-meta.mjs --only ios      # one clip
 *   node automation/meta/render-meta.mjs --quality=0.85  # webp quality
 *   node automation/meta/render-meta.mjs --site          # also copy favicons
 *                                                        # into ../IITM/site/public
 *
 * Requires: vite on :5173 (auto-started) + playwright (browsers resolve
 * from %LOCALAPPDATA%\ms-playwright, falling back to system Chrome).
 * ═══════════════════════════════════════════════════════════════════════ */

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import { mkdirSync, writeFileSync, readFileSync, unlinkSync, copyFileSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');          // studio-pro-editor/
const VITE_ROOT = resolve(ROOT, '..', '..');          // design_concepts/ (serves /studios/…)
const OUT_DIR = resolve(__dirname, 'output');
const TR_URL = 'http://localhost:5173/studios/studio-pro-editor/docs/html-in-canvas/test-renderer.html';
const IITM_PUBLIC = resolve(ROOT, '..', 'IITM', 'site', 'public');

const argv = process.argv.slice(2);
const ONLY = (argv.find(a => a.startsWith('--only')) || '').split('=')[1] || '';
const TO_SITE = argv.includes('--site');
const QUALITY = parseFloat((argv.find(a => a.startsWith('--quality')) || '').split('=')[1]) || 0.9;

const EXT = { webp: 'webp', png: 'png', jpeg: 'jpg' };

/* ─── Clip registry (TR fenced contract: html/css/js + ds/dur markers) ───
 * Square jobs render in a 1:1 FRAME: the 16:9 design is contain-fitted by
 * drawFrame() onto the clip's own bg color — full card visible, no crop.
 * Wide jobs render in the native 16:9 frame at 1080p (native-DS raster,
 * so the 1920×1080 file is a pass-through encode with zero resampling). */
const CLIPS = [
    {
        name: 'material',
        mod: () => import('./clips/og-material.js'),
        bg: '#eef1f8',
        token: 'tonebar',   // class that must appear in _lastAppliedCode before exporting
        jobs: [
            { out: 'og-material-1920x1080.webp', size: { w: 1920, h: 1080 }, aspect: '16:9', at: 2600, fmt: 'webp' },
            { out: 'og-material-1200x630.png', size: { w: 1200, h: 630 }, aspect: '16:9', at: 2600, fmt: 'png' },
            { out: 'og-material-square-1200x1200.webp', size: { w: 1200, h: 1200 }, aspect: '1:1', at: 2600, fmt: 'webp' },
        ],
    },
    {
        name: 'ios',
        mod: () => import('./clips/og-ios.js'),
        bg: '#070b18',
        token: 'glass',
        jobs: [
            { out: 'og-ios-1920x1080.webp', size: { w: 1920, h: 1080 }, aspect: '16:9', at: 2600, fmt: 'webp' },
            { out: 'og-ios-1200x630.png', size: { w: 1200, h: 630 }, aspect: '16:9', at: 2600, fmt: 'png' },
            { out: 'og-ios-square-1200x1200.webp', size: { w: 1200, h: 1200 }, aspect: '1:1', at: 2600, fmt: 'webp' },
        ],
    },
    {
        name: 'favicon',
        mod: () => import('./clips/favicon.js'),
        bg: '#0e1512',
        token: 'viewBox',
        jobs: [
            { out: 'favicon-512.png', size: { w: 512, h: 512 }, aspect: '1:1', at: 0, fmt: 'png' },
            { out: 'favicon-64.png', size: { w: 64, h: 64 }, aspect: '1:1', at: 0, fmt: 'png' },
            { out: 'favicon-32.png', size: { w: 32, h: 32 }, aspect: '1:1', at: 0, fmt: 'png' },
        ],
    },
];

/* ─── Vite dev server (auto-start, IPv4/IPv6 aware) ────────────────────── */

function httpOK(url) {
    return new Promise(res => {
        const req = http.get(url, r => { r.resume(); res(r.statusCode === 200); });
        req.on('error', () => res(false));
        req.setTimeout(1500, () => { req.destroy(); res(false); });
    });
}

async function ensureVite() {
    if (await httpOK(TR_URL)) { console.log('• vite already serving test-renderer on :5173'); return; }
    console.log('• starting vite (design_concepts root) …');
    const child = spawn('npx', ['vite', '--port', '5173', '--strictPort'], {
        cwd: VITE_ROOT, shell: true, stdio: 'ignore',
    });
    child.unref();
    for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 500));
        if (await httpOK(TR_URL)) { console.log('• vite is up'); return; }
    }
    throw new Error(`vite did not serve ${TR_URL} within 30s (is something else on :5173?)`);
}

async function launch() {
    try { return await chromium.launch(); }
    catch (e) {
        console.warn('• bundled chromium unavailable (' + e.message.split('\n')[0] + ') — trying system Chrome');
        return await chromium.launch({ channel: 'chrome' });
    }
}

/* ─── Page-side steps ─────────────────────────────────────────────────────
 * GOTCHA burned in here once: TR declares modalSlider / modalRenderer /
 * _lastAppliedCode with top-level `let`, so they are LEXICAL globals —
 * `window.modalSlider` is undefined. waitForFunction bodies must use the
 * bare identifiers (with typeof guards, since lexical globals throw in
 * typeof only when truly undeclared... they don't: typeof is safe). */

function buildFenced(clip, meta) {
    const { title, description, ds, dur } = meta;
    const { html, css, js } = clip.mod;
    return [
        '```html', html, '```', '', '```css', css, '```', '', '```js', js, '```', '',
        `<!-- title:${title} -->`,
        `<!-- desc:${description} -->`,
        `<!-- ds:${ds} -->`,
        `<!-- dur:${dur * 1000} -->`,
        ''
    ].join('\n');
}

async function loadClip(trPage, clip, meta) {
    await trPage.evaluate(({ fenced }) => {
        aiShowView('paste');
        aiReply.value = fenced;      // direct value, NOT a paste event — we control when apply fires
        aiApplyReply();
    }, { fenced: buildFenced(clip, meta) });

    // dur marker adopted (applyCode clicked)
    await trPage.waitForFunction(
        (durMs) => typeof modalSlider !== 'undefined' && parseInt(modalSlider.max) === durMs,
        meta.dur * 1000, { timeout: 10000 },
    );
    // applyCode assigns _lastAppliedCode only AFTER its awaited setClip
    // resolves — and setClip fetches+inlines external font <link>s (seconds,
    // cold). Exporting earlier silently falls back to the empty __custom
    // preset (blank frame). Poll for the clip's token in the applied code.
    await trPage.waitForFunction(
        (token) => typeof _lastAppliedCode !== 'undefined' &&
            (_lastAppliedCode.html + ' ' + _lastAppliedCode.css + ' ' + _lastAppliedCode.js).includes(token),
        clip.token, { timeout: 25000 },
    );
    await trPage.waitForFunction(
        () => typeof modalRenderer !== 'undefined' && modalRenderer && modalRenderer._ready && !!modalRenderer._onFrame,
        null, { timeout: 10000 },
    );
    await trPage.waitForTimeout(250); // CodeMirror prettify + compositor settle
}

async function settleFonts(trPage) {
    try { await trPage.evaluate(() => Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 4000))])); }
    catch { /* offline → fallback fonts, still renders */ }
    await trPage.waitForTimeout(120);
}

async function setFrame(trPage, { aspect, bg }) {
    await trPage.evaluate(({ aspect, bg }) => {
        curFrame.aspect = aspect;
        curFrame.bg = bg;
        applyAspect();
    }, { aspect, bg });
    // applyAspect may rebuild the renderer (design-space switch) — wait it out
    await trPage.waitForFunction(
        () => typeof modalRenderer !== 'undefined' && modalRenderer && modalRenderer._ready,
        null, { timeout: 8000 },
    );
    await trPage.waitForTimeout(150);
}

async function exportRaster(trPage, tMs, fmt) {
    const dlPromise = trPage.waitForEvent('download', { timeout: 20000 });
    await trPage.evaluate(({ t, fmt }) => {
        modalPlaying = false; setPlayState(false);
        modalSlider.value = String(t);
        exportFrame(fmt);
    }, { t: tMs, fmt });
    const dl = await dlPromise;
    const tmp = resolve(OUT_DIR, '.tmp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) + '.' + (EXT[fmt] || 'png'));
    await dl.saveAs(tmp);
    return tmp;
}

/* Workbench page (separate tab, stays on about:blank): resize → encode →
 * blank-frame self-check, all via canvas. */
async function processPng(wbPage, tmpPath, size, fmt, quality) {
    const b64 = readFileSync(tmpPath).toString('base64');
    return await wbPage.evaluate(async ({ b64, w, h, fmt, quality }) => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + b64;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        const k = Math.max(w / img.width, h / img.height);           // cover
        const dw = img.width * k, dh = img.height * k;
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        const mime = fmt === 'webp' ? 'image/webp' : 'image/png';
        const out = c.toDataURL(mime, fmt === 'webp' ? quality : undefined);
        const encodedAsRequested = out.startsWith('data:' + mime);
        /* blank-frame self-check on the RESULT */
        const d = ctx.getImageData(0, 0, w, h).data;
        let bright = 0; const colors = new Set();
        for (let i = 0; i < d.length; i += 40) {
            const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
            if (lum > 60) bright++;
            colors.add((d[i] >> 4) + '.' + (d[i + 1] >> 4) + '.' + (d[i + 2] >> 4));
        }
        const n = Math.floor(d.length / 40);
        const minColors = w < 128 ? 3 : 6;   // tiny rasters legitimately quantize hard
        return {
            png: out,
            encodedAsRequested,
            brightRatio: bright / n,
            distinctColors: colors.size,
            ok: encodedAsRequested && colors.size >= minColors && bright / n > 0.004,
        };
    }, { b64, w: size.w, h: size.h, fmt, quality });
}

/* ─── Per-clip worker: own context, own TR page + workbench page ───────── */

async function runClip(browser, clip) {
    clip.mod = await clip.mod();
    const meta = { title: clip.mod.title, description: clip.mod.description, ds: clip.mod.ds, dur: clip.mod.dur };
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
    const trPage = await ctx.newPage();
    const wbPage = await ctx.newPage();
    trPage.on('pageerror', e => console.error(`  [${clip.name} pageerror]`, e.message.slice(0, 120)));
    trPage.on('console', m => { if (m.type() === 'error') console.error(`  [${clip.name} console]`, m.text().slice(0, 140)); });

    await trPage.goto(TR_URL + '?metaTool=' + clip.name, { waitUntil: 'load', timeout: 30000 });
    await trPage.waitForSelector('#presetGrid', { timeout: 15000 });

    const rows = [];
    try {
        console.log(`▶ ${clip.name} — "${meta.title}"`);
        await loadClip(trPage, clip, meta);
        await settleFonts(trPage);
        for (const job of clip.jobs) {
            await setFrame(trPage, { aspect: job.aspect, bg: clip.bg });
            const tmp = await exportRaster(trPage, job.at, job.fmt);
            const res = await processPng(wbPage, tmp, job.size, job.fmt, QUALITY);
            const finalPath = resolve(OUT_DIR, job.out);
            writeFileSync(finalPath, Buffer.from(res.png.split(',')[1], 'base64'));
            unlinkSync(tmp);
            const kb = Math.round(statSync(finalPath).size / 1024);
            const mark = res.ok ? '✓' : (res.encodedAsRequested ? '⚠ BLANK?' : '⚠ codec');
            console.log(`   ${mark} ${job.out}  ${job.size.w}×${job.size.h}  ${kb}KB  bright=${(res.brightRatio * 100).toFixed(1)}%  colors=${res.distinctColors}`);
            rows.push({ clip: clip.name, out: job.out, ok: res.ok, kb });
        }
    } finally {
        await ctx.close();
    }
    return rows;
}

/* ─── Main: parallel workers over one browser ──────────────────────────── */

async function main() {
    mkdirSync(OUT_DIR, { recursive: true });
    await ensureVite();

    const browser = await launch();
    const selected = CLIPS.filter(c => !ONLY || c.name.includes(ONLY));

    const groups = await Promise.all(selected.map(p =>
        runClip(browser, p).catch(e => { console.error(`✗ [${p.name}]`, e.message.split('\n')[0]); return [{ clip: p.name, out: '(failed)', ok: false, kb: 0 }]; })
    ));

    if (TO_SITE) {
        console.log('\n→ copying site picks into ../IITM/site/public:');
        const picks = { 'favicon-512.png': 'favicon-512.png', 'favicon-64.png': 'favicon-64.png', 'favicon-32.png': 'favicon-32.png' };
        for (const [from, to] of Object.entries(picks)) {
            try { copyFileSync(resolve(OUT_DIR, from), resolve(IITM_PUBLIC, to)); }
            catch (e) { console.warn(`   (skip ${to}: ${e.message.split('\n')[0]})`); continue; }
            console.log(`   ✓ ${to}`);
        }
        console.log('   (OG cards stay in output/ — wire them per page in Base.astro / frontmatter)');
    }

    await browser.close();
    const report = groups.flat();
    const bad = report.filter(r => !r.ok);
    console.log(`\n${report.length} file(s) → ${OUT_DIR}${bad.length ? `  ⚠ ${bad.length} failed self-check` : '  all passed the blank-frame self-check'}`);
    process.exit(bad.length ? 1 : 0);
}

main().catch(e => { console.error('\n✗ render-meta failed:', e.message); process.exit(1); });
