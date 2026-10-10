'use strict';
/* ── T1.8 — web-font vendoring (compile step) ──────────────────────────────
 * `design.fonts` / `design.font_href` name Google Fonts stylesheets, which
 * the emitter emits as <link> tags — so every gate run and every export
 * depended on connectivity and on what a CDN happened to serve that day.
 * Two runs of the same film could differ because a font changed upstream,
 * and the battery could not run on a plane.
 *
 * This closes it at the compile step: fetch the stylesheet ONCE (Chrome UA →
 * woff2), download every font file it names, inline each as a data: URI
 * inside the CSS, and hand back the whole stylesheet as ONE data:text/css
 * URI. The emitter needs no change — a <link> with a data: href is a
 * stylesheet like any other, and the clip html carries it wherever it
 * travels (preview page, clip json, export import path).
 *
 * The assembled CSS is cached per URL under fonts-cache/, so a recompile is
 * byte-identical without touching the network. REEL_FONTS_OFFLINE=1 forces
 * cache-only ("plane mode"); REEL_FONTS_REFRESH=1 forces a refetch (also:
 * deleting the cache dir). A cache miss offline is NOT fatal — the original
 * href is kept and reported, because a film that still needs the network is
 * a slower film, not a broken one. Non-Google hrefs pass through untouched:
 * a self-hosted font is already vendored by definition. */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CACHE_DIR = path.join(__dirname, 'fonts-cache');
const GOOGLE_CSS = /^https:\/\/fonts\.googleapis\.com\//;
/* A Chrome UA is what makes the CSS API serve woff2 with unicode-range
 * subsets; the default fetch UA gets legacy formats and fewer faces. */
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function cacheKey(href) {
  return crypto.createHash('sha256').update(href).digest('hex').slice(0, 20);
}

function toDataCss(css) {
  return 'data:text/css;base64,' + Buffer.from(css, 'utf8').toString('base64');
}

async function fetchText(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': CHROME_UA },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

async function fetchBytes(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': CHROME_UA },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

/* One href → one data: stylesheet. Returns the ORIGINAL href with
 * `vendored: false` when there is nothing to do or nothing to fall back to;
 * callers decide whether a miss is worth printing. */
async function vendorFontHref(href, opts) {
  opts = opts || {};
  if (!href || typeof href !== 'string' || !GOOGLE_CSS.test(href)) {
    return { href: href, vendored: false, passthrough: true, faces: 0, bytes: 0 };
  }
  const cacheDir = opts.cacheDir || CACHE_DIR;
  const cacheFile = path.join(cacheDir, cacheKey(href) + '.json');
  const offline = opts.offline || process.env.REEL_FONTS_OFFLINE === '1';
  const refresh = opts.refresh || process.env.REEL_FONTS_REFRESH === '1';

  const fromCache = () => {
    try {
      const c = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      return {
        href: toDataCss(c.css),
        vendored: true,
        faces: c.faces,
        bytes: c.bytes,
        source: 'cache',
      };
    } catch (e) {
      return null;
    }
  };

  /* Cache-first: a recompile must be byte-identical WITHOUT the network,
     which is the whole point of T1.8. Only REEL_FONTS_REFRESH=1 (or a cold
     cache) spends a request, so a Google-side CSS change cannot silently
     rewrite every committed preview on the next compile. */
  if (!refresh) {
    const hit = fromCache();
    if (hit) return hit;
  }

  if (!offline) {
    try {
      const css = await fetchText(href);
      /* Every woff2 the stylesheet names, downloaded and inlined. Matched on
       * the full url(...) so a data: URI already present is never re-fetched
       * (the regex requires https, data: cannot match). */
      const urls = [...new Set(
        (css.match(/url\((https:\/\/[^)]+\.woff2)\)/g) || [])
          .map((m) => m.slice(4, -1)),
      )];
      const inlined = new Map();
      for (const u of urls) {
        inlined.set(u, 'data:font/woff2;base64,' + (await fetchBytes(u)).toString('base64'));
      }
      const out = css.replace(/url\((https:\/\/[^)]+\.woff2)\)/g, (m, u) => {
        const data = inlined.get(u);
        return data ? 'url(' + data + ')' : m;
      });
      const faces = (out.match(/@font-face/g) || []).length;
      const bytes = Buffer.byteLength(out, 'utf8');
      if (!faces) throw new Error('stylesheet carried no @font-face blocks');
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify({ href, css: out, faces, bytes }));
      return { href: toDataCss(out), vendored: true, faces, bytes, source: 'fresh' };
    } catch (e) {
      /* Network failed mid-flight — the cache from an earlier run is still a
         correct answer (fonts are immutable per deployed URL in practice, and
         a stale font beats a fallback font), so fall through to it. */
      const hit = fromCache();
      if (hit) {
        hit.stale = true;
        hit.fetchError = e.message;
        return hit;
      }
      return { href: href, vendored: false, error: e.message, faces: 0, bytes: 0 };
    }
  }

  const hit = fromCache();
  if (hit) return hit;
  return { href: href, vendored: false, error: offline ? 'offline and no cache' : 'fetch failed and no cache', faces: 0, bytes: 0 };
}

/* The batch entry point: vendors every {family, href} entry IN PLACE (the
 * emitter bakes hrefs into markup, so the swap must happen before it reads
 * them) and returns one report line's worth of facts. */
async function vendorFonts(fonts, opts) {
  const rep = { vendored: 0, fresh: 0, faces: 0, bytes: 0, passthrough: 0, missed: [] };
  if (!Array.isArray(fonts)) return rep;
  for (const f of fonts) {
    if (!f || !f.href) continue;
    const v = await vendorFontHref(f.href, opts);
    if (v.vendored) {
      f.href = v.href;
      rep.vendored++;
      if (v.source === 'fresh') rep.fresh++;
      rep.faces += v.faces;
      rep.bytes += v.bytes;
    } else if (v.passthrough) {
      rep.passthrough++;
    } else {
      rep.missed.push({ href: f.href, error: v.error || 'unknown' });
    }
  }
  return rep;
}

module.exports = { vendorFonts, vendorFontHref, CACHE_DIR };
