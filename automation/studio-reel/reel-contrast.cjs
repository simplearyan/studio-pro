/**
 * reel-contrast.cjs — the contrast gate.
 *
 * Measured, on the four films as they stood before this gate existed:
 *
 *   breath-of-air      0 failures   (no design block; the runtime default is light ink)
 *   jan-suraaj         1 failure    j9-cta        1.05:1   #0F0D0E on #0e1512
 *   studio-pro-showcase 18 failures p1..p9-badge  1.00:1   #151217 on #0e1512
 *                                     p9-foot      1.00:1
 *                                     p3-tiles x8  1.09-1.12:1  #151217 on #211C29
 *   two-queens         0 failures   both modes
 *
 * 19 of 88 measured text nodes were unreadable, and every one of them was
 * syntactically valid CSS with a green build. That is the whole argument for
 * this file: nothing else in the pipeline looks at COLOUR PAIRS.
 *
 * WHY A NODE ANALYSER AND NOT A BROWSER. reel-fidelity reads the compiled
 * markup, not a live DOM, so it runs in CI with no Chromium. This gate takes
 * the same input and the same discipline. What it needs from the cascade —
 * which surface each element sits on, and what opacity its text is drawn at —
 * is a CLOSED set, because the emitter's RUNTIME_CSS is a closed set. Those
 * two facts are tabulated in HOST_SURFACE and TEXT_ALPHA below and are
 * asserted against the emitter's actual CSS by `assertEmitterContract()`.
 * If someone adds a rule that breaks the assumption, the gate says so instead
 * of quietly measuring the wrong surface.
 *
 * The one thing it cannot see is `background-clip:text` (the gradient stat
 * numeral), where `color` is transparent by design. Those are SKIPPED, and
 * the skip is counted so a silent zero-measurement cannot pass for a pass.
 *
 * Usage:
 *   node automation/studio-reel/reel-contrast.cjs
 *   node automation/studio-reel/reel-contrast.cjs --only <film>
 *   node automation/studio-reel/reel-contrast.cjs --mode dark
 *   node automation/studio-reel/reel-contrast.cjs --min 4.5   # stricter floor
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');
const EMITTER = path.join(ROOT, 'docs/html-in-canvas/hic-storyboard.js');

/* ── colour maths ─────────────────────────────────────────────────────────
 * WCAG 2.1 relative luminance. sRGB is not linear, so every channel is
 * de-gamma'd first; using the raw 0..1 value understates light colours badly
 * enough to turn a 4.2:1 pair into a reported 9:1. */
function parseColor(c) {
  const s = String(c).trim();
  let m = s.match(/^#([0-9a-f]{3,8})$/i);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map((x) => x + x).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
  }
  m = s.match(/rgba?\(([^)]+)\)/i);
  if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
  return null;
}
const chan = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const luminance = ([r, g, b]) => 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
const composite = (fg, bg, a) => fg.map((c, i) => c * a + bg[i] * (1 - a));
function contrast(a, b) {
  const L1 = luminance(a), L2 = luminance(b);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}

/* ── the closed cascade ───────────────────────────────────────────────────
 * Which SURFACE each text node is actually painted against, by class. The
 * stage is the answer for everything that is not on a panel. */
const HOST_SURFACE = {
  'hss-tile-head': 'panel', 'hss-tile-body': 'panel',
  'hss-panel-num': 'panel', 'hss-panel-label': 'panel',
  'hss-pill': 'stage',
  'hss-text': 'stage', 'hss-latex': 'stage', 'hss-answer': 'stage',
  'hss-credit': 'stage', 'hss-stat-label': 'stage',
  'hss-stat-num': 'gradient',           // color:transparent + background-clip:text
  'hss-card': 'own',                    // carries its own inline background
};

/* A COMPONENT VARIANT overrides the class default above. The four treatments
 * are a closed set, so the surface each one paints is too — which is the only
 * reason this file can stay a Node analyser instead of needing a browser.
 *
 * This table was wrong by omission until the variants existed and, worse, the
 * `.hss-pill` INK was being read from --hss-ink when the cascade takes it from
 * --hss-pill. That passed by luck: the two happened to have enough contrast
 * against the stage. Asserting the cascade is what turned the luck into a
 * checked fact, and it is asserted again in assertEmitterContract(). */
const FILL_SURFACE = {
  'hss-fill-filled': 'fill',           // --hss-fill, falling back to --hss-panel
  'hss-fill-tonal': 'fill-tone',       // --hss-fill-tone, falling back to 14% ink over the stage
  'hss-fill-outlined': 'stage',        // background:none — the border is not a fill
  'hss-fill-text': 'stage',
};
/* Only `filled` paints a colour of its own; the other three inherit. */
const FILL_INK = { 'hss-fill-filled': 'fill-ink' };

/* The color-mix the emitter falls back to when a theme names no
 * --hss-fill-tone. Kept here as an ARITHMETIC fact rather than a string so the
 * gate measures the surface a browser would actually paint. */
const TONAL_INK_MIX = 0.14;

/* Opacity the runtime draws each text class AT. Not a detail: a 4.6:1 pair
 * drawn at .74 over the same surface composites down under 3:1, which is why
 * an audit that ignores opacity under-reports. */
const TEXT_ALPHA = {
  'hss-credit': 0.75, 'hss-tile-body': 0.74, 'hss-panel-label': 0.75, 'hss-stat-label': 0.78,
};

/* Every class that can hold text. Keep in step with buildElHtml. */
const TEXT_CLASSES = Object.keys(HOST_SURFACE);

function loadEmitter() {
  const src = fs.readFileSync(EMITTER, 'utf8');
  const shim = { exports: {} };
  vm.runInNewContext(src, { module: shim, console, require, window: {}, document: {} }, { filename: 'hic-storyboard.js' });
  return shim.exports;
}

/* The tabulated cascade is only trustworthy while it matches the emitter.
 * Verify the facts it rests on rather than assuming them. */
function assertEmitterContract(emitter) {
  const css = emitter.RUNTIME_CSS;
  const problems = [];
  for (const [cls, alpha] of Object.entries(TEXT_ALPHA)) {
    const rule = css.slice(css.indexOf('.' + cls + '{'));
    const body = rule.slice(0, rule.indexOf('}'));
    const found = body.match(/opacity:([\d.]+)/);
    if (!found) problems.push(`.${cls} has no opacity declaration, but the gate assumes ${alpha}`);
    else if (Math.abs(parseFloat(found[1]) - alpha) > 0.001) {
      problems.push(`.${cls} opacity is ${found[1]}, gate assumes ${alpha} — update TEXT_ALPHA`);
    }
  }
  if (!/background-clip:text/.test(css)) problems.push('.hss-stat-num no longer uses background-clip:text — re-check the gradient-numeral skip');

  /* The variant surfaces. Each is asserted by the VARIABLE it reads, because
     that is the part that silently changes a colour: a rename would still
     parse, still render, and still pass every other check here. */
  const reads = (selector, prop) => {
    const i = css.indexOf(selector);
    if (i === -1) return null;
    const body = css.slice(i, css.indexOf('}', i));
    return body.includes(prop);
  };
  const wanted = [
    ['.hss-fill-filled{', '--hss-fill,', 'filled variant surface'],
    ['.hss-fill-filled{', '--hss-fill-ink,', 'filled variant ink'],
    ['.hss-fill-tonal{', '--hss-fill-tone,', 'tonal variant surface'],
    ['.hss-pill{', '--hss-pill,', 'pill ink (NOT --hss-ink — that is how the old table read it)'],
  ];
  for (const [sel, prop, what] of wanted) {
    if (!reads(sel, prop)) problems.push(`${sel.slice(0, -1)} no longer reads ${prop} — the gate's ${what} assumption is stale`);
  }
  /* the tonal fallback is an arithmetic constant here and a literal there */
  const mix = css.match(/color-mix\(in srgb,var\(--hss-ink[^)]*\)\s*([\d.]+)%/);
  if (!mix) problems.push('.hss-fill-tonal no longer falls back to a color-mix of the ink — update TONAL_INK_MIX');
  else if (Math.abs(parseFloat(mix[1]) / 100 - TONAL_INK_MIX) > 0.001) {
    problems.push(`.hss-fill-tonal fallback mixes ${mix[1]}%, gate assumes ${TONAL_INK_MIX * 100}%`);
  }
  /* a filled pill takes its fill FROM the pill accent, so a badge is accent-on-ink
     rather than container-on-ink — the opposite pairing. Getting it backwards
     inverts the measurement. */
  if (!reads('.hss-pill.hss-fill-filled{', '--hss-fill:var(--hss-pill')) {
    problems.push('.hss-pill.hss-fill-filled no longer takes its fill from --hss-pill — update the filled-pill surface');
  }
  return problems;
}

/* ── read the compiled markup ──────────────────────────────────────────────
 * The gate measures clip.html, so it measures exactly what ships: the
 * resolver's colour, the authored ramp's size, the emitter's classes. */
function auditClip(html, theme, stageBg, panelBg, defaultInk) {
  const rows = [];
  let skippedGradient = 0;
  const fillHex = parseColor(theme.fill) || null;
  const fillInk = parseColor(theme['fill-ink'] || theme['slab-ink']) || null;
  const fillTone = parseColor(theme['fill-tone']) || null;

  /* `--hss-pill` is declared on the .hss-pills CONTAINER and inherited by
     every chip, so it is not on the node the text lives in. The emitter
     writes one value per pills element, so the nearest preceding declaration
     is the one that applies — the same positional trick as idAt below. */
  const pillMarks = [];
  const pillRe = /--hss-pill:\s*([^;"]+)/g;
  let pm;
  while ((pm = pillRe.exec(html))) { const c = parseColor(pm[1]); if (c) pillMarks.push([pm.index, c.slice(0, 3)]); }
  const pillAt = (pos) => {
    let found = null;
    for (const [ix, rgb] of pillMarks) { if (ix > pos) break; found = rgb; }
    return found;
  };

  /* Every .hss-el wrapper carries id="x", so the last one before a text node
   * is that node's owner. A failure that names a CSS class instead of a
   * storyboard.json id is not actionable. */
  const idMarks = [];
  const idRe = /id="([^"]+)"/g;
  let im;
  while ((im = idRe.exec(html))) idMarks.push([im.index, im[1]]);
  const idAt = (pos) => {
    let found = '?';
    for (const [ix, id] of idMarks) { if (ix > pos) break; found = id; }
    return found;
  };

  /* Only LEAF text nodes: they contain no child markup at compile time, so a
     `[^<]*` body is exact. The earlier pattern used a non-greedy body and
     matched `class="hss-text"` with ONE class, which silently skipped every
     multi-class node — 43 nodes measured where a browser saw 88. Matching any
     class list and then testing each class is what closes that gap. */
  /* Leaf text nodes. The tag alternation is not cosmetic: `.hss-pill` is a
     <span>, so a <div>-only pattern matched every other text-bearing element
     in the runtime and silently reported "0 failures" for chips it had never
     looked at. Nine chips across the four films were unmeasured. */
  const nodeRe = /<(?:div|span) class="([^"]*)"([^>]*)>([^<]*)<\/(?:div|span)>/g;
  let m;
  while ((m = nodeRe.exec(html))) {
    const classes = m[1].split(/\s+/);
    const cls = classes.find((c) => TEXT_CLASSES.includes(c));
    if (!cls) continue;
    const attrs = m[2] || '';
    const styleMatch = attrs.match(/style="([^"]*)"/);
    if (!(m[3] || '').trim()) continue;

    if (HOST_SURFACE[cls] === 'gradient') { skippedGradient++; continue; }

    const style = {};
    if (styleMatch) for (const decl of styleMatch[1].split(';')) {
      const i = decl.indexOf(':');
      if (i > 0) style[decl.slice(0, i).trim()] = decl.slice(i + 1).trim();
    }

    /* host surface. An inline background WINS over everything: the brutalist
     * name-slab is an .hss-text with its own background, and measuring it
     * against the stage reports 1:1 for a heading that is perfectly legible.
     * Then a component VARIANT wins over the class default, then the class
     * default. That order is the cascade. */
    const pillInk = pillAt(m.index);
    const inlinePanel = parseColor(style['--hss-panel']);
    const fillKind = classes.find((c) => FILL_SURFACE[c]) ? FILL_SURFACE[classes.find((c) => FILL_SURFACE[c])] : null;
    const surfaceKind = fillKind || HOST_SURFACE[cls];

    let bg = stageBg, bgSource = 'stage';
    const own = parseColor(style.background);
    if (own && own[3] >= 1) { bg = own.slice(0, 3); bgSource = 'inline background (slab)'; }
    else if (surfaceKind === 'fill') {
      /* a FILLED pill is a badge: accent fill with on-ink type, the opposite
         pairing to a filled container. Reading --hss-panel for it would
         measure a chip as a container and pass on the wrong pairing. */
      if (cls === 'hss-pill' && pillInk) { bg = pillInk; bgSource = '--hss-pill (filled)'; }
      else if (fillHex) { bg = fillHex.slice(0, 3); bgSource = '--hss-fill'; }
      else if (inlinePanel) { bg = inlinePanel.slice(0, 3); bgSource = 'inline --hss-panel (fill)'; }
      else { bg = panelBg; bgSource = '--hss-panel (fill fallback)'; }
    } else if (surfaceKind === 'fill-tone') {
      if (fillTone) { bg = fillTone.slice(0, 3); bgSource = '--hss-fill-tone'; }
      else {
        /* the emitter's fallback: the ink at 14% over whatever is behind it */
        const ink = (parseColor(defaultInk) || [248, 250, 252]).slice(0, 3);
        bg = composite(ink, stageBg, TONAL_INK_MIX);
        bgSource = `--hss-ink at ${TONAL_INK_MIX * 100}% (tonal fallback)`;
      }
    } else if (surfaceKind === 'panel') {
      bg = (inlinePanel && inlinePanel[3] >= 1) ? inlinePanel.slice(0, 3) : panelBg;
      bgSource = (inlinePanel && inlinePanel[3] >= 1) ? 'inline --hss-panel' : '--hss-panel';
    } else if (surfaceKind === 'own') { if (!own) continue; bg = own.slice(0, 3); bgSource = 'own background'; }

    /* ink. parseColor returns RGBA; composite is RGB, so slice first or the
       alpha slot becomes bg[3] * (1-a) = NaN and poisons the whole row.
       Order mirrors the cascade: an authored colour wins, then a filled
       component's own on-container ink, then a chip's accent, then the stage
       ink. Note the chip accent sits ABOVE the stage ink — `.hss-pill` sets
       `color:var(--hss-pill)` and this table used to read --hss-ink. */
    const fgRaw = style.color;
    let fg, fgSource;
    if (fgRaw) { const c = parseColor(fgRaw); if (!c) continue; fg = c.slice(0, 3); fgSource = 'inline'; }
    else if (cls === 'hss-pill' && fillKind !== 'fill' && pillInk) { fg = pillInk; fgSource = '--hss-pill'; }
    else if (fillKind === 'fill' && fillInk) { fg = fillInk.slice(0, 3); fgSource = '--hss-fill-ink'; }
    else { fg = (parseColor(defaultInk) || [248, 250, 252]).slice(0, 3); fgSource = '--hss-ink'; }
    fg = composite(fg, bg, TEXT_ALPHA[cls] !== undefined ? TEXT_ALPHA[cls] : 1);

    /* size: the emitted value is vw, so resolve it at the DESIGN-SPACE width.
     * Measuring at the embed width instead would change the WCAG threshold —
     * the same element passes at 1920 and fails at 512, which is nonsense. */
    let px = null;
    if (style['font-size']) {
      /* max(2.083vw,14px) — the floor form type_scale.min_px emits. The
         threshold is decided at the DESIGN-SPACE size, because that is the
         size the film is authored and exported at; the floor exists only to
         keep an embed legible. */
      const mx = style['font-size'].match(/^max\(([\d.]+)vw,\s*([\d.]+)px\)$/);
      if (mx) px = parseFloat(mx[1]) * 19.2;
      else {
        const vw = style['font-size'].match(/^([\d.]+)vw$/);
        if (vw) px = parseFloat(vw[1]) * 19.2;
        else { const p = style['font-size'].match(/^([\d.]+)px$/); if (p) px = parseFloat(p[1]); }
      }
    }
    if (px === null) {
      const byClass = { 'hss-tile-head': 1.3, 'hss-tile-body': 0.98, 'hss-panel-num': 3.1, 'hss-panel-label': 1.05, 'hss-stat-label': 1.25, 'hss-credit': 0.95, 'hss-pill': 1.25 };
      px = (byClass[cls] || 1.8) * 19.2;
    }
    const weight = style['font-weight'] ? parseInt(style['font-weight']) : (cls === 'hss-pill' || cls === 'hss-tile-head' || cls === 'hss-panel-num' ? 700 : 400);

    rows.push({
      cls, px: Math.round(px), weight,
      ratio: +contrast(fg, bg).toFixed(2),
      fgSource, bgSource,
      fg: 'rgb(' + fg.map(Math.round).join(',') + ')',
      bg: 'rgb(' + bg.map(Math.round).join(',') + ')',
      elId: idAt(m.index),
    });
  }
  return { rows, skippedGradient };
}

function main() {
  const argv = process.argv.slice(2);
  const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
  const mode = argv.includes('--mode') ? argv[argv.indexOf('--mode') + 1] : 'light';
  const minArg = argv.includes('--min') ? argv[argv.indexOf('--min') + 1] : null;

  const emitter = loadEmitter();
  const contract = assertEmitterContract(emitter);

  const filmsDir = path.join(__dirname, 'films');
  const films = fs.readdirSync(filmsDir)
    .filter((d) => fs.existsSync(path.join(filmsDir, d, 'storyboard.json')) && (!only || d === only));

  console.log('=== emitter cascade contract ===');
  if (contract.length) {
    for (const p of contract) console.log(`  FAIL  ${p}`);
    console.log('\nreel-contrast: FAILED — the gate\'s assumptions no longer match the emitter, so its numbers cannot be trusted.');
    return 1;
  }
  console.log(`  ok    ${Object.keys(TEXT_ALPHA).length} opacity assumptions and the gradient-clip skip match RUNTIME_CSS`);

  let failures = 0;
  let totalRows = 0;
  let totalSkipped = 0;

  for (const film of films) {
    const dir = path.join(filmsDir, film);
    const sb = JSON.parse(fs.readFileSync(path.join(dir, 'storyboard.json'), 'utf8'));

    /* Resolve the design by borrowing reel-compile's own resolver rather than
     * keeping a second copy: a second resolver would drift, and a contrast
     * gate that measures a different palette than the one that ships is worse
     * than no gate at all. */
    const { resolveMode, reconcile } = require('./reel-compile.cjs').__test;
    const resolved = resolveMode(sb, mode);
    const { top } = reconcile(sb, resolved.design, mode);

    const stage = parseColor(top.background || '#0e1512');
    const themeVars = top.theme || {};
    const panel = parseColor(themeVars.panel || '#121a26') || [18, 26, 38];
    const ink = themeVars.ink || '#f8fafc';

    const clip = emitter.compileStoryboard(JSON.parse(JSON.stringify(top)));
    const { rows, skippedGradient } = auditClip(clip.html, themeVars,
      [stage[0], stage[1], stage[2]], [panel[0], panel[1], panel[2]], ink);

    /* Attach the authored element id resolved during the walk. */
    const seen = {};
    const withIds = rows.map((r) => {
      seen[r.cls] = (seen[r.cls] || 0) + 1;
      return Object.assign({}, r, { id: r.elId });
    });

    console.log(`\n=== ${film} (${mode}) ===`);
    console.log(`  stage          ${stage ? 'rgb(' + [stage[0], stage[1], stage[2]].join(',') + ')' : '(emitter default #0e1512)'}`);
    console.log(`  --hss-ink      ${ink}   --hss-panel ${themeVars.panel || '(runtime default)'}`);
    console.log(`  measured       ${withIds.length} text nodes` + (skippedGradient ? `, ${skippedGradient} gradient-clipped skipped` : ''));

    if (!withIds.length) {
      console.log('  FAIL  nothing measured — an empty result is not a pass');
      failures++;
      continue;
    }

    const HARD_FLOOR = 3;
      const bad = withIds.filter((r) => {
        /* AA per WCAG 2.1 — 3:1 for >=24px or >=18.66px bold, 4.5:1 below
         * that — AND a hard 3:1 floor on EVERY node regardless of size. The
         * floor exists because "large text" is a legibility judgement that
         * fails badly on a phone or a projector: a 24px label that passes AA
         * at 3.2:1 is unreadable in practice. --min raises the bar further. */
        const aa = minArg ? parseFloat(minArg) : (r.px >= 24 || (r.px >= 18.66 && r.weight >= 700) ? 3 : 4.5);
        const need = Math.max(aa, minArg ? aa : HARD_FLOOR);
        r.need = need;
        return r.ratio < need;
      }).sort((a, b) => a.ratio - b.ratio);

    totalRows += withIds.length;
    totalSkipped += skippedGradient;

    const byClass = {};
    for (const r of withIds) {
      byClass[r.cls] = byClass[r.cls] || { n: 0, min: Infinity };
      byClass[r.cls].n++;
      byClass[r.cls].min = Math.min(byClass[r.cls].min, r.ratio);
    }
    for (const [cls, s] of Object.entries(byClass).sort((a, b) => a[1].min - b[1].min)) {
      console.log(`  ${String(s.min).padStart(6)}:1 min   ${cls.padEnd(16)} x${s.n}`);
    }

    if (bad.length) {
      console.log(`  CONTRAST FAILURES (${bad.length}):`);
      for (const r of bad) {
        console.log(`    - ${r.id}  .${r.cls}  ${r.px}px/${r.weight}  ${r.ratio}:1  (needs ${r.need}:1)  ${r.fg} on ${r.bg}  [fg:${r.fgSource} bg:${r.bgSource}]`);
      }
      failures++;
    } else {
      console.log(`  contrast       OK — ${withIds.length}/${withIds.length} text nodes meet WCAG AA and the ${minArg ? parseFloat(minArg) : HARD_FLOOR}:1 floor`);
    }
  }

  console.log('');
  console.log(`  totals: ${totalRows} text nodes measured, ${totalSkipped} gradient-clipped skipped, ${failures} film(s) failing`);
  if (failures) {
    console.error(`reel-contrast: FAILED (${failures}) — valid CSS, unreadable pixels.`);
    return 1;
  }
  console.log('reel-contrast: OK — every measured text node meets its WCAG AA threshold.');
  return 0;
}

/* The design board renders a contrast ratio next to every swatch, and it
 * borrows these three rather than reimplementing them. A second copy of the
 * WCAG maths is a second thing to get wrong, and it would drift silently —
 * the same mistake as a second colour resolver, which is what `theme_map`
 * exists to prevent. */
module.exports = { parseColor, luminance, contrast, composite };

/* Guarded so requiring this file borrows the maths without running the audit.
   reel-compile.cjs pulls it in while building the design board. */
if (require.main === module) process.exit(main());