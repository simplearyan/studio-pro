/**
 * reel-contrast.cjs — the contrast gate, measured by a browser.
 *
 * WHAT IT DOES. Opens every film's standalone page in headless Chrome, lifts
 * the animation to its finished state, and asks every element that owns text
 * what colour it actually paints and what it paints onto. Fails below WCAG AA
 * (3:1 large, 4.5:1 normal) plus a hard 3:1 floor on every node. `--min`
 * raises the bar further.
 *
 * ── WHAT IT USED TO DO, AND WHY THAT IS GONE ────────────────────────────────
 * This file used to hold a hand-written model of the cascade: HOST_SURFACE
 * (which class sits on which surface), FILL_SURFACE, FILL_INK, CSS_INK (which
 * token each class's text reads), SVG_PX, TONAL_INK_MIX and TEXT_ALPHA — six
 * tables that had to agree with RUNTIME_CSS, plus `assertEmitterContract`, a
 * seventh check that they did. The tables were defensible when colour
 * resolution was a closed set, and they caught real bugs: a chip reading
 * --hss-ink when the CSS reads --hss-pill, a class whose opacity was 0.75 and
 * nobody had written down.
 *
 * They are also the wrong tool. They enumerate the emitter's *current* rules,
 * so they can only ever be as true as they were written, and the day a new
 * component appears they are silent rather than wrong — the same failure mode
 * as BUILDABLE was. A browser has no tables: `getComputedStyle` resolves the
 * cascade that shipped, including inherited custom properties, inline styles,
 * colour-mix(), per-mode [data-mode] rules and the authored ramp's real
 * font-size at the design-space width. Asking it removes six things to keep in
 * step and `assertEmitterContract` with them.
 *
 * WHAT IS DELIBERATELY STILL IN NODE. The WCAG maths. It lives in one place
 * (`luminance`/`contrast`/`composite` below) because `reel-compile` borrows it
 * for the design board's ratio chips; the page only reports colour components
 * and sizes it resolved, and Node does the arithmetic. A second copy of that
 * formula inside the page would be the same mistake as a second colour
 * resolver, which is exactly what `theme_map` exists to prevent.
 *
 * THE ONE THING A COMPUTED COLOUR CANNOT TELL US. Backdrop sampling walks up
 * collecting `background-color` layers, because `background-image` has no
 * colour to read — a gradient is painted, not declared as a value. Where an
 * ancestor carries one, the node is measured against the nearest opaque colour
 * beneath it and COUNTED (`on a background-image`), never silently passed.
 * Today that is 133 of 289 nodes, and all 133 are in films whose gradients are
 * dark decorative washes over a dark stage, so the approximation is
 * conservative rather than hopeful — but it is an approximation. The honest
 * fix is to sample the painted pixel: one `Page.captureScreenshot` per film,
 * decode with `zlib` (PNG is a deflated filtered scanline), and take the
 * backdrop from the pixels around each node. That is the whole of what remains
 * between this gate and measuring the film as rendered.
 *
 * IT CANNOT PASS BY NOT RUNNING. No browser, or a protocol failure, exits
 * NON-ZERO. A gate that skips itself is worse than no gate: the day it starts
 * skipping is the day a film ships unreadable and everyone believes it ran.
 *
 * Usage:
 *   node automation/studio-reel/reel-contrast.cjs
 *   node automation/studio-reel/reel-contrast.cjs --only two-queens --mode dark
 *   node automation/studio-reel/reel-contrast.cjs --min 4.5   # demand more than WCAG
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { DEFAULT_W, DEFAULT_H, findBrowser, launchBrowser } = require('./cdp.cjs');

const ROOT = path.resolve(__dirname, '../..');
const EMITTER = path.join(ROOT, 'html-in-canvas/hic-storyboard.js');

/* ── colour maths ─────────────────────────────────────────────────────────
 * The ONE copy. reel-compile's design board renders these next to every
 * swatch, so a second copy would be a second thing to get wrong. */
function parseColor(c) {
  if (c == null) return null;
  const s = String(c).trim().toLowerCase();
  if (!s || s === 'transparent') return [0, 0, 0, 0];
  if (s[0] === '#') {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = h.split('').map((x) => x + x).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
  if (p.length < 3 || p.some((n) => Number.isNaN(n))) return null;
  return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
}

function luminance(rgb) {
  const c = rgb.slice(0, 3).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrast(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function composite(fg, bg, alpha) {
  const a = alpha === undefined ? 1 : alpha;
  return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a));
}

function loadEmitter() {
  const src = fs.readFileSync(EMITTER, 'utf8');
  const shim = { exports: {} };
  vm.runInNewContext(src, { module: shim, console, require, window: {}, document: {} }, { filename: 'hic-storyboard.js' });
  return shim.exports;
}

/* ── the measurement, executed IN the page ────────────────────────────────
 * Colour is not knowable outside a browser. The old gate reconstructed it
 * from tables of the emitter's rules; this asks the rules directly.
 *
 * Built by join() rather than a template literal on purpose: the body is
 * several hundred characters of code containing `${...}`-shaped text and
 * quotes, and a template literal would be parsing itself.
 *
 * Returns primitives only — arrays and numbers — so Runtime.evaluate can
 * serialise it by value. The WCAG arithmetic happens back in Node. */
function measureExpression(mode) {
  return [
    '(async () => {',
    'const MODE = ' + JSON.stringify(mode || '') + ';',
    'const stage = document.getElementById("hss");',
    'if (!stage) return { error: "no #hss stage in the document" };',
    /* Only a film that DECLARES modes has [data-mode] rules. Stamping the
       attribute onto a single-theme film is harmless today but it is a claim
       about a mode that does not exist, and the next person to add a
       data-mode rule would get it applied to films that never asked for it. */
    'if (MODE) stage.setAttribute("data-mode", MODE);',
    'try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) {}',
    /* Typeset first. The clip does this on its first onFrame, and we are not
       going to run frames — without this every formula would be measured as
       raw $$...$$ source, which is a text node nobody ever sees. `_hssSetup`
       probes for renderMathInElement rather than latching, so a short wait for
       the data: scripts is enough; if the renderer never appears the rows come
       back as source and the KaTeX presence check below reports it. */
    'for (let i = 0; i < 40 && !window.renderMathInElement; i++) await new Promise(function(r){setTimeout(r,50);});',
    'try { if (typeof _hssSetup === "function") _hssSetup(); } catch (e) {}',
    /* Lift the ANIMATION state, not the design. `.hss-scene`/`.hss-el` start
       at opacity 0 and onFrame drives them; measuring that state reports the
       entrance rather than the film, and measuring one scene at a time would
       never see the other seven. Stylesheet !important beats the inline
       styles onFrame writes, so this holds against a running animation loop.
       Only opacity and transform are lifted — a class that deliberately sets
       opacity (the credit at .75, a chart tick at .8) must keep it, because
       THAT opacity is part of the pairing being audited. */
    '(function(){var s=document.createElement("style");',
    ' s.textContent=".hss-scene{display:flex!important;opacity:1!important}.hss-el,.hss-slot,.hss-cardwrap{opacity:1!important;transform:none!important}";',
    ' document.head.appendChild(s);})();',
    'await new Promise(function(r){setTimeout(r,150);});',
    /* Resolve a computed colour string to [r,g,b,a]. Modern Chrome emits both
       `rgba(r,g,b,a)` and space-separated `rgb(r g b / a)`, and colour-mix()
       (       the tonal fill) resolves to `color(srgb …)` with each channel in 0..1
       — so one pattern is not enough, and getting it wrong would silently
       report every tonal surface as near-black. Testing the `color` prefix is
       what makes the 0..1 scaling safe: a plain `rgb(1,1,1)` is not scaled. */
    'function pc(s){',
    '  if(!s) return null;',
    '  const n=s.match(/[-.0-9]+/g); if(!n) return null;',
    '  let v=n.map(Number); if(v.some(function(x){return isNaN(x);})) return null;',
    '  if(s.indexOf("color")===0 && v[0]<=1 && v[1]<=1 && v[2]<=1){',
    '    v=[v[0]*255,v[1]*255,v[2]*255].concat(v.slice(3));',
    '  }',
    '  return [v[0],v[1],v[2], v.length>3 ? v[3] : 1];',
    '}',
    /* The painted backdrop: walk up collecting background-color layers and
       composite from the outermost inward. Background-color only — a
       background-image cannot be sampled without reading pixels, so nodes
       sitting on a gradient report `img:true` and are counted, not guessed
       at. The old gate did exactly this implicitly (it used the stage colour
       for every class with no surface) and never said so. */
    'function backdrop(el){',
    '  const layers=[]; let img=false;',
    '  for(let n=el;n;n=n.parentElement){',
    '    const cs=getComputedStyle(n);',
    '    const c=pc(cs.backgroundColor);',
    '    if(c && c[3]>0) layers.push({c:c,src:n});',
    '    const bi=cs.backgroundImage; if(bi && bi!=="none") img=true;',
    '  }',
    '  let out=pc(getComputedStyle(document.body).backgroundColor);',
    '  if(!out || out[3]<1) out=[255,255,255,1];',
    '  let src=null;',
    '  for(let i=layers.length-1;i>=0;i--){',
    '    const c=layers[i].c; src=layers[i].src;',
    '    out=[c[0]*c[3]+out[0]*(1-c[3]), c[1]*c[3]+out[1]*(1-c[3]), c[2]*c[3]+out[2]*(1-c[3]), 1];',
    '  }',
    '  return {rgb:out.slice(0,3), img:img, src:src};',
    '}',
    /* Opacity multiplies down the tree, so it has to be accumulated rather
       than read off the node. Ancestors stop at the stage: everything above
       it is page chrome, not the film. */
    'function opacityOf(el){',
    '  let op=1;',
    '  for(let n=el;n;n=n.parentElement){',
    '    const o=parseFloat(getComputedStyle(n).opacity); if(!isNaN(o)) op*=o;',
    '    if(n===stage) break;',
    '  }',
    '  return op;',
    '}',
    /* Text owner. Walk every text node, take its parent, and climb out of any
       KaTeX subtree: one formula is one measurement, reported at the `.katex`
       root whose computed colour is what the glyphs inherit. Counting
       KaTeX's ~40 inner spans per formula would have measured the same
       pairing forty times and drowned the table. */    'const rows=[]; const seen=new Set(); let skippedInk=0, imgBackdrop=0;',
    'const w=document.createTreeWalker(stage, NodeFilter.SHOW_TEXT, null);',
    'let tn;',
    'while((tn=w.nextNode())){',
    '  const txt=(tn.nodeValue||"").trim(); if(!txt) continue;',
    '  let el=tn.parentNode;',
    '  if(!el || el.nodeType!==1) continue;',
    '  if(el.tagName==="SCRIPT"||el.tagName==="STYLE") continue;',
    '  while(el && el.parentElement && el.parentElement.closest && el.parentElement.closest(".katex")) el=el.parentElement;',
    '  if(seen.has(el)) continue; seen.add(el);',
    '  const cs=getComputedStyle(el);',
    '  if(cs.display==="none"||cs.visibility==="hidden") continue;',
    '  const r=el.getBoundingClientRect();',
    '  if(r.width<1||r.height<1) continue;',
    '  const fg=pc(cs.color); if(!fg) continue;',
    '  const op=opacityOf(el);',
    /* Ink we cannot see has no contrast to complain about. This is how the
       old gate's "gradient-clipped" skip falls out of the measurement rather
       than being a class name in a table: background-clip:text paints colour
       through the glyph and leaves `color` transparent. */
    '  if(fg[3]*op<0.01){ skippedInk++; continue; }',
    '  const bg=backdrop(el);',
    '  if(bg.img) imgBackdrop++;',
    '  const cls=(el.getAttribute("class")||el.tagName.toLowerCase()).trim();',
    '  const owner=el.closest(".hss-el[id]");',
    '  rows.push({',
    '    id: (owner && owner.id) || el.id || "?",',
    '    cls: cls,',
    '    px: parseFloat(cs.fontSize),',
    '    weight: (/^[0-9]+$/.test(cs.fontWeight) ? parseInt(cs.fontWeight,10) : (/bold|bolder/.test(cs.fontWeight)?700:400)),',
    '    fg: [fg[0],fg[1],fg[2], fg[3]*op],',
    '    bg: bg.rgb,',
    '    img: bg.img,',
    '    bgFrom: (bg.src && (bg.src.getAttribute("class")||bg.src.tagName.toLowerCase())) || "page"',
    '  });',
    '}',    'return { rows: rows, skippedInk: skippedInk, imgBackdrop: imgBackdrop,',
    '  katexLoaded: !!window.renderMathInElement, stage: stage.getAttribute("data-mode"),',
    '  stageBg: getComputedStyle(stage).backgroundColor };',
    '})()',
  ].join('\n');
}

async function main() {
  const argv = process.argv.slice(2);
  const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
  const mode = argv.includes('--mode') ? argv[argv.indexOf('--mode') + 1] : 'light';
  const minArg = argv.includes('--min') ? argv[argv.indexOf('--min') + 1] : null;
  const width = argv.includes('--width') ? parseInt(argv[argv.indexOf('--width') + 1], 10) : DEFAULT_W;
  const height = argv.includes('--height') ? parseInt(argv[argv.indexOf('--height') + 1], 10) : DEFAULT_H;

  const bin = findBrowser();
  if (!bin) {
    console.error('reel-contrast: FAILED — no Chrome/Chromium/Edge found.');
    console.error('  Set CHROME_PATH, or install one of:');
    console.error('    C:/Program Files/Google/Chrome/Application/chrome.exe');
    console.error('    /Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    console.error('    /usr/bin/google-chrome');
    return 1;
  }

  const emitter = loadEmitter();
  const filmsDir = path.join(__dirname, 'films');
  const films = fs.readdirSync(filmsDir)
    .filter((d) => fs.existsSync(path.join(filmsDir, d, 'storyboard.json')) && (!only || d === only));

  /* Resolve the design by borrowing reel-compile's own resolver rather than
   * keeping a second copy: a second resolver would drift, and a contrast
   * gate that measures a different palette than the one that ships is worse
   * than no gate at all. */
  const { resolveMode, reconcile, attachUtilities } = require('./reel-compile.cjs').__test;

  const jobs = [];
  for (const film of films) {
    const dir = path.join(filmsDir, film);
    const sb = JSON.parse(fs.readFileSync(path.join(dir, 'storyboard.json'), 'utf8'));
    const resolved = resolveMode(sb, mode);
    if (resolved.error) { console.error(`\n=== ${film} ===\n  ${resolved.error}`); return 1; }
    const { top } = reconcile(sb, resolved.design, mode);
    /* Build-time utilities are attached BEFORE the page is cloned, so the
       page this gate measures carries the same stylesheet the file will
       always ship (plan §2). No candidates → no block → nothing moves. */
    await attachUtilities(top);
    const clip = emitter.compileStoryboard(JSON.parse(JSON.stringify(top)));
    const page = emitter.buildStandalonePage(JSON.parse(JSON.stringify(top)));
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'reel-contrast-')), 'reel.html');
    fs.writeFileSync(file, page);
    jobs.push({ film, file, clip, mode: resolved.modes && resolved.modes.length ? mode : null });
  }

  return runJobs(bin, jobs, width, height, mode, minArg).then(
    (code) => code,
    (err) => {
      console.error('\nreel-contrast: FAILED — ' + err.message);
      return 1;
    }
  );
}

async function runJobs(bin, jobs, width, height, mode, minArg) {
  let browser;
  try {
    browser = await launchBrowser(bin, width, height);
  } catch (e) {
    console.error('reel-contrast: FAILED — could not start the browser: ' + e.message);
    return 1;
  }

  let failures = 0;
  let totalRows = 0;
  let totalSkipped = 0;
  let totalImg = 0;
  const HARD_FLOOR = 3;

  try {
    for (const job of jobs) {
      const { film, file, clip } = job;
      const target = await browser.cdp.send('Target.createTarget', { url: 'about:blank' });
      const sess = await browser.cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
      const sid = sess.sessionId;
      await browser.cdp.send('Page.enable', {}, sid);
      await browser.cdp.send('Runtime.enable', {}, sid);
      await browser.cdp.send('Emulation.setDeviceMetricsOverride', {
        width, height, deviceScaleFactor: 1, mobile: false,
      }, sid);

      const loaded = new Promise((resolve) => {
        const prev = browser.cdp.ws.onmessage;
        browser.cdp.ws.onmessage = (m) => {
          prev(m);
          try {
            const d = JSON.parse(m.data);
            if (d.method === 'Page.loadEventFired' && d.sessionId === sid) resolve();
          } catch (e) { /* not ours */ }
        };
        setTimeout(resolve, 20000);
      });
      await browser.cdp.send('Page.navigate', { url: 'file:///' + file.replace(/\\/g, '/') }, sid);
      await loaded;

      const res = await browser.cdp.send('Runtime.evaluate', {
        expression: measureExpression(job.mode),
        awaitPromise: true,
        returnByValue: true,
      }, sid);
      await browser.cdp.send('Target.closeTarget', { targetId: target.targetId });

      const value = res.result && res.result.value;
      if (!value) {
        console.log(`\n=== ${film} (${mode}) ===`);
        const d = res.exceptionDetails || {};
        const why = (d.exception && d.exception.description) || d.text || 'no value';
        console.log('  FAIL  the page did not answer: ' + String(why).split('\n')[0]);
        failures++;
        continue;
      }
      if (value.error) {
        console.log(`\n=== ${film} (${mode}) ===`);
        console.log(`  FAIL  ${value.error}`);
        failures++;
        continue;
      }

      const rows = value.rows;
      console.log(`\n=== ${film} (${job.mode || 'single theme'}) ===`);
      console.log(`  stage          ${value.stageBg}${value.stage ? `  [data-mode=${value.stage}]` : ''}`);
      console.log(`  measured       ${rows.length} text nodes` +
        (value.skippedInk ? `, ${value.skippedInk} transparent/gradient ink skipped` : '') +
        (value.imgBackdrop ? `, ${value.imgBackdrop} on a background-image` : ''));
      const hasLatex = /class="hss-latex/.test(clip.html);
      const katexRoots = rows.filter((r) => /^katex/.test(r.cls)).length;
      console.log(`  maths          ${hasLatex ? (value.katexLoaded ? 'renderer loaded' : 'NO RENDERER (no renderMathInElement)') : 'none (no latex elements)'}` +
        (hasLatex && katexRoots ? ` · ${katexRoots} formula(s) measured as one node each` : ''));

      if (hasLatex && !value.katexLoaded) {
        console.log('  FAIL  the maths renderer never loaded — formulas would be raw source on stage');
        failures++;
      }

      if (!rows.length) {
        console.log('  FAIL  nothing measured — an empty result is not a pass');
        failures++;
        continue;
      }

      /* AA per WCAG 2.1 — 3:1 for >=24px or >=18.66px bold, 4.5:1 below that —
       * AND a hard 3:1 floor on EVERY node regardless of size. The floor exists
       * because "large text" is a legibility judgement that fails badly on a
       * phone or a projector: a 24px label that passes AA at 3.2:1 is
       * unreadable in practice. --min raises the bar further. */
      const bad = rows.filter((r) => {
        const px = r.px;
        const aa = minArg ? parseFloat(minArg) : (px >= 24 || (px >= 18.66 && r.weight >= 700) ? 3 : 4.5);
        const need = Math.max(aa, minArg ? aa : HARD_FLOOR);
        r.need = need;
        const bg = r.bg.map(Math.round);
        const eff = composite(r.fg.slice(0, 3), bg, r.fg[3]);
        r.ratio = +contrast(eff, bg).toFixed(2);
        r.fgOut = 'rgb(' + eff.map(Math.round).join(',') + ')';
        r.bgOut = 'rgb(' + bg.join(',') + ')';
        return r.ratio < need;
      }).sort((a, b) => a.ratio - b.ratio);

      totalRows += rows.length;
      totalSkipped += value.skippedInk;
      totalImg += value.imgBackdrop;

      const byClass = {};
      for (const r of rows) {
        const key = r.cls.split(/\s+/)[0];
        byClass[key] = byClass[key] || { n: 0, min: Infinity };
        byClass[key].n++;
        if (r.ratio !== undefined) byClass[key].min = Math.min(byClass[key].min, r.ratio);
      }
      for (const [cls, s] of Object.entries(byClass).sort((a, b) => a[1].min - b[1].min)) {
        console.log(`  ${String(isFinite(s.min) ? s.min.toFixed(2) : '-').padStart(6)}:1 min   ${cls.padEnd(16)} x${s.n}`);
      }

      if (bad.length) {
        console.log(`  CONTRAST FAILURES (${bad.length}):`);
        for (const r of bad) {
          console.log(`    - ${r.id}  ${r.cls}  ${r.px.toFixed(1)}px/${r.weight}  ${r.ratio}:1  (needs ${r.need}:1)  ${r.fgOut} on ${r.bgOut}  [bg from .${r.bgFrom}]`);
        }
        failures++;
      } else {
        console.log(`  contrast       OK — ${rows.length}/${rows.length} text nodes meet WCAG AA and the ${minArg ? parseFloat(minArg) : HARD_FLOOR}:1 floor`);
      }
      if (value.imgBackdrop) {
        console.log(`    ${value.imgBackdrop} node(s) sit under a background-image; their backdrop is the nearest opaque`);
        console.log('    colour beneath the gradient, which is an approximation — not a pass/fail claim.');
      }
    }
  } finally {
    browser.close();
  }

  console.log('');
  console.log(`  totals: ${totalRows} text nodes measured, ${totalSkipped} transparent/gradient ink skipped, ${totalImg} on a background-image, ${failures} film(s) failing`);
  if (failures) {
    console.error(`reel-contrast: FAILED (${failures}) — valid CSS, unreadable pixels.`);
    return 1;
  }
  console.log('reel-contrast: OK — measured in a browser, every text node meets its WCAG AA threshold.');
  return 0;
}

/* The design board renders a contrast ratio next to every swatch, and it
 * borrows these rather than reimplementing them. A second copy of the WCAG
 * maths is a second thing to get wrong, and it would drift silently — the
 * same mistake as a second colour resolver, which is what `theme_map`
 * exists to prevent. */
module.exports = { parseColor, luminance, contrast, composite };

/* Guarded so requiring this file borrows the maths without running the audit.
   reel-compile.cjs pulls it in while building the design board. */
if (require.main === module) {
  main().then(
    (code) => process.exit(code || 0),
    (err) => { console.error('reel-contrast: FAILED — ' + (err && err.message)); process.exit(1); }
  );
}
