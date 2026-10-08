/**
 * reel-extent.cjs — the stage-extent gate.
 *
 * Everything else in this pipeline reasons about markup. This one opens a
 * browser, because the only honest way to know whether a lead paragraph runs
 * off the edge of the stage is to lay it out and ask.
 *
 * Why it matters. `max_width` is now authorable and `design.text_width` sets
 * a measure once per role, but nothing was checking the RESULT. A film can
 * author a 1445px-wide element across a 1920px stage, a heading two words
 * longer than the one that was tested, a webfont that falls back to a wider
 * face, or a `min_px` type floor that re-wraps a paragraph at embed width —
 * and the clip compiles green, the contrast gate passes, and the film exports
 * with the top half of a sentence. That is a defect you find by watching it,
 * which is to say by not finding it.
 *
 * Measured for two-queens before this existed: 31 non-credit elements, tightest
 * side margin 238px, tightest vertical margin 224px. Those numbers are the
 * reason the films are not already broken — but they were obtained once, by
 * hand, and nothing kept them true.
 *
 * WHAT IS MEASURED. Every element of every scene, at that scene's MID-FRAME —
 * not its start, where a `slide` entrance is still off-stage and would report
 * an overflow that is the animation working. `.hss` is `overflow:hidden`, so an
 * overflowed element is silently cropped: no scrollbar, no warning, no layout
 * error. That silent crop is the entire failure this file exists for.
 *
 * WHY A REAL BROWSER AND NOT NODE. Geometry cannot be tabulated: text wraps,
 * fonts substitute, a grid resolves, and a reimplementation that disagrees with
 * Chromium reports overflows that do not exist while missing the ones that do.
 * reel-contrast.cjs reached the same conclusion about colour and now drives a
 * browser too — the two share `cdp.cjs` for finding and speaking to it, and
 * keep their own questions, which are genuinely different: this one asks where
 * a box ends, that one asks what colour a glyph paints.
 *
 * ZERO DEPENDENCIES, ON PURPOSE. Headless Chrome is driven over the DevTools
 * Protocol using Node 22's built-in `fetch` and `WebSocket`. There is no
 * playwright or puppeteer here, and no `--remote-debugging-port` guesswork:
 * Chrome is launched with `--remote-debugging-port=0` and writes the port it
 * actually chose to `DevToolsActivePort` in its own profile directory. A gate
 * that needs a 60MB npm install and a matching browser build is a gate that
 * quietly stops running. Finding the browser and speaking to it now live in
 * `cdp.cjs`, shared with `reel-contrast` — this gate's own job is only to
 * decide WHAT to ask the page once it is open.
 *
 * IT CANNOT PASS BY NOT RUNNING. If no browser is found, or the protocol
 * refuses, this exits NON-ZERO and says so. A geometry gate that skips itself
 * is worse than no gate, because the day it starts skipping is the day a film
 * ships cropped and everyone believes the gate ran.
 *
 * Usage:
 *   node automation/studio-reel/reel-extent.cjs
 *   node automation/studio-reel/reel-extent.cjs --only two-queens --mode dark
 *   node automation/studio-reel/reel-extent.cjs --min 40     # require 40px of breathing room
 *                                                          # (default 0 = fail on
 *                                                          #  any overflow, minus
 *                                                          #  half a pixel)
 *   node automation/studio-reel/reel-extent.cjs --width 1280 --height 720
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { DEFAULT_W, DEFAULT_H, findBrowser, launchBrowser } = require('./cdp.cjs');
const ROOT = path.resolve(__dirname, '../..');
const EMITTER = path.join(ROOT, 'docs/html-in-canvas/hic-storyboard.js');

/* Sub-pixel slack, APPLIED below rather than merely declared. Layout is
 * fractional and a border can round a hair past the stage without a single
 * pixel being cropped; a gate that fires on 0.3px gets ignored, which costs
 * more than the false positive. Half a pixel is below what anyone can see. */
const TOLERANCE = 0.5;

/* #rrggbb -> "rgb(r, g, b)" so the page's reported computed value can be
 * compared with what the compiler resolved. Without this the gate can measure
 * the light theme, print it under a dark label, and still look healthy. */
function hexToRgb(hex) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

function loadEmitter() {
  const src = fs.readFileSync(EMITTER, 'utf8');
  const shim = { exports: {} };
  vm.runInNewContext(src, { module: shim, console, require, window: {}, document: {} }, { filename: 'hic-storyboard.js' });
  return shim.exports;
}

/* ── the measurement, executed IN the page ───────────────────────────────
 * It has to run in the page: the scene node ids, the animation state and the
 * bounding boxes all live there, and the alternative is reconstructing layout
 * in Node, which is the thing this file exists to avoid.
 *
 * `scenes` is the compiled storyboard literal, so the ids here are the ids that
 * shipped. */
function measureExpression(scenes, mode, expectBg) {
  return `(async () => {
    const SCENES = ${JSON.stringify(scenes)};
    const MODE = ${JSON.stringify(mode)};
    const EXPECT_BG = ${JSON.stringify(expectBg || '')};
    // Fonts first: a fallback face is a different width, and measuring before
    // the webfont lands reports an overflow that the finished film does not
    // have — or hides one it does.
    try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) {}
    await new Promise(r => setTimeout(r, 250));
    const stage = document.getElementById('hss');
    if (!stage) return { error: 'no #hss stage in the document' };
    /* The stage boots in whichever mode it was compiled with, and the runtime
       toggle only overrides it when the OS asks for something else. So
       \`--mode dark\` measured a LIGHT stage and reported light geometry under
       a dark label — indistinguishable from a real result, because the numbers
       came out plausible. Pin the mode here and REPORT what was actually
       painted, so "I measured the theme I was asked to measure" is a checked
       claim rather than an assumption. */
    if (MODE) stage.setAttribute('data-mode', MODE);
    const stageBg = getComputedStyle(stage).backgroundColor;
    const S = stage.getBoundingClientRect();
    const sceneNodes = stage.querySelectorAll('.hss-scene');
    const rows = [];
    const notes = { katex: !!window.renderMathInElement, fonts: 0, faces: [] };
    try {
      if (document.fonts) {
        notes.fonts = document.fonts.size;
        for (const f of document.fonts) if (f.status === 'loaded') notes.faces.push(f.family + ' ' + f.weight);
      }
    } catch (e) {}
    for (let si = 0; si < SCENES.length; si++) {
      const sc = SCENES[si];
      // MID-FRAME, not the start: a slide entrance is legitimately off-stage
      // at t=0 and reporting that would make the gate useless.
      const t = sc.s + Math.max(1, (sc.e - sc.s) / 2);
      onFrame(t);
      const sceneEl = sceneNodes[si];
      if (!sceneEl) { rows.push({ scene: si, error: 'scene node ' + si + ' is not in the DOM' }); continue; }
      for (const e of sc.els) {
        const el = sceneEl.querySelector('#' + CSS.escape(e.id));
        if (!el) { rows.push({ scene: si, id: e.id, error: 'element is not in the scene node' }); continue; }
        // A hidden element has no box to complain about. Opacity 0 mid-scene
        // means the entrance has not finished, and its box is mid-flight.
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || parseFloat(cs.opacity) === 0) continue;
        // An element's real ink can be smaller than its wrapper: a pill row's
        // host is as wide as the widest chip plus the row gap, and a stat's
        // host is the whole column. Measure the INK (the deepest visible
        // leaf), or a 20%-wide element reports a margin it never had.
        let ink = el;
        const kids = el.querySelectorAll('*');
        let best = el.getBoundingClientRect();
        for (const k of kids) {
          const kc = getComputedStyle(k);
          if (kc.display === 'none') continue;
          if (kc.position === 'absolute' && k.tagName !== 'IMG') continue;   // credits
          const r = k.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.left < best.left || r.right > best.right || r.top < best.top || r.bottom > best.bottom) best = r;
        }
        const r = ink = best;
        rows.push({
          scene: si, id: e.id, type: e.type,
          left: r.left - S.left,
          top: r.top - S.top,
          right: S.right - r.right,
          bottom: S.bottom - r.bottom,
        });
      }
    }
    /* ── P5's CONTENT assertion, after every scene has been drawn ─────────
       notes.katex above only proves the library loaded. It does not prove
       anything was typeset: the latch bug this pipeline found kept the
       library loaded and the stage raw for the whole reel, and a missing
       renderer does the same. So ask the stage itself, once onFrame has run
       for every scene: if any .hss-latex still reads as source, the film
       exports $$...$$ where its maths should be, with a green gate. */
    let latexEls = 0;
    let rawLatex = 0;
    for (const n of stage.querySelectorAll('.hss-latex')) {
      latexEls++;
      if ((n.textContent || '').indexOf('$$') !== -1) rawLatex++;
    }
    notes.latexEls = latexEls;
    notes.rawLatex = rawLatex;
    return { stage: { w: S.width, h: S.height, bg: stageBg, mode: stage.getAttribute('data-mode') }, expectedBg: EXPECT_BG, rows: rows, notes: notes };
  })()`;
}

async function main() {
  const argv = process.argv.slice(2);
  const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
  const mode = argv.includes('--mode') ? argv[argv.indexOf('--mode') + 1] : 'light';
  const minArg = argv.includes('--min') ? parseFloat(argv[argv.indexOf('--min') + 1]) : 0;
  const width = argv.includes('--width') ? parseInt(argv[argv.indexOf('--width') + 1], 10) : DEFAULT_W;
  const height = argv.includes('--height') ? parseInt(argv[argv.indexOf('--height') + 1], 10) : DEFAULT_H;

  const bin = findBrowser();
  if (!bin) {
    console.error('reel-extent: FAILED — no Chrome/Chromium/Edge found.');
    console.error('  Set CHROME_PATH, or install one of:');
    console.error('    C:/Program Files/Google/Chrome/Application/chrome.exe');
    console.error('    /Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    console.error('    /usr/bin/google-chrome');
    console.error('  This gate exits non-zero rather than skipping: a geometry gate that');
    console.error('  stops running is worse than no gate, because people trust the log.');
    return 1;
  }
  console.log(`browser          ${bin}`);

  const filmsDir = path.join(__dirname, 'films');
  const films = fs.readdirSync(filmsDir)
    .filter((d) => fs.existsSync(path.join(filmsDir, d, 'storyboard.json')) && (!only || d === only));
  if (!films.length) {
    console.error('reel-extent: no film with a storyboard.json found');
    return 2;
  }

  const emitter = loadEmitter();
  const { resolveMode, reconcile, attachUtilities } = require('./reel-compile.cjs').__test;

  /* Compile every film up front so a compile failure is reported before a
     browser is even started. */
  const jobs = [];
  for (const film of films) {
    const sb = JSON.parse(fs.readFileSync(path.join(filmsDir, film, 'storyboard.json'), 'utf8'));
    const resolved = resolveMode(sb, mode);
    if (resolved.error) { console.error(`\n=== ${film} ===\n  ${resolved.error}`); return 1; }
    const { top, unsafe } = reconcile(sb, resolved.design, mode);
    if (unsafe.length) { console.error(`\n=== ${film} ===\n  UNSAFE: ${unsafe.join('; ')}`); return 1; }
    /* Build-time utilities are attached BEFORE the page is cloned, so the
       page this gate measures carries the same stylesheet the file will
       always ship (plan §2). No candidates → no block → nothing moves. */
    await attachUtilities(top);
    const clip = emitter.compileStoryboard(JSON.parse(JSON.stringify(top)));
    /* the standalone page is the artefact the user actually looks at, so it is
       the artefact measured — not a reconstruction of it */
    const page = emitter.buildStandalonePage(JSON.parse(JSON.stringify(top)));
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'reel-page-')), 'reel.html');
    fs.writeFileSync(file, page);
    const sbLit = JSON.parse(clip.js.replace(/^[\s\S]*?var SB = /, '').replace(/;\nvar _hssInit[\s\S]*$/, ''));
    /* what the stage should PAINT for this mode, so the page can be checked
       against it. Colour comparison happens in Node (the page reports
       rgb(), this is hex) — see hexToRgb below. */
    const stageForMode = (top.modes && top.modes[mode] && top.modes[mode].bg)
      || top.background || null;
    jobs.push({
      film, file, scenes: sbLit.scenes, dur: clip.dur,
      mode: top.modes ? mode : null,
      expectBg: stageForMode,
      needsKatex: /katex/.test(clip.html),
      needsWebfont: !!(top.fonts && top.fonts.length),
    });
  }

  return runJobs(bin, jobs, width, height, mode, minArg).then(
    (code) => code,
    (err) => {
      console.error('\nreel-extent: FAILED — ' + err.message);
      return 1;
    });
}

async function runJobs(bin, jobs, width, height, mode, minMargin) {
  let browser;
  try {
    browser = await launchBrowser(bin, width, height);
  } catch (e) {
    console.error('reel-extent: FAILED — could not start the browser: ' + e.message);
    return 1;
  }

  let failures = 0;
  let measured = 0;
  const reasons = new Set();
  const fail = (why) => { failures++; reasons.add(why); };
  const tightest = { side: Infinity, vertical: Infinity, where: '' };

  try {
    for (const job of jobs) {
      console.log(`\n=== ${job.film} (${mode}) ===`);
      const target = await browser.cdp.send('Target.createTarget', { url: 'about:blank' });
      const sess = await browser.cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
      const sid = sess.sessionId;
      await browser.cdp.send('Page.enable', {}, sid);
      await browser.cdp.send('Runtime.enable', {}, sid);
      /* force the design space exactly — the window flag is a hint, this is
         the contract */
      await browser.cdp.send('Emulation.setDeviceMetricsOverride', {
        width, height, deviceScaleFactor: 1, mobile: false,
      }, sid);

      const loaded = new Promise((resolve) => {
        const prev = browser.cdp.ws.onmessage;
        browser.cdp.ws.onmessage = (m) => {
          prev(m);
          const d = JSON.parse(m.data);
          if (d.method === 'Page.loadEventFired' && d.sessionId === sid) resolve();
        };
        setTimeout(resolve, 20000);
      });
      await browser.cdp.send('Page.navigate', { url: 'file:///' + job.file.replace(/\\/g, '/') }, sid);
      await loaded;

      const res = await browser.cdp.send('Runtime.evaluate', {
        expression: measureExpression(job.scenes, job.mode, job.expectBg),
        awaitPromise: true, returnByValue: true,
      }, sid);
      const value = res.exceptionDetails
        ? { error: res.exceptionDetails.exception && res.exceptionDetails.exception.description || res.exceptionDetails.text }
        : res.result.value;

      await browser.cdp.send('Target.closeTarget', { targetId: target.targetId });

      if (!value || value.error) {
        console.log(`  FAIL  ${value && value.error}`);
        fail('the page could not be measured');
        continue;
      }

      const rows = value.rows.filter((r) => !r.error);
      const structural = value.rows.filter((r) => r.error);
      /* A film with no measured rows is a broken measurement, not a pass. */
      if (!rows.length) {
        console.log('  FAIL  nothing measured — an empty result is not a pass');
        fail('nothing was measured');
        continue;
      }

      /* A credit is `position:absolute; left:0; right:0` — it spans the stage
       * by design. So it may TOUCH the edge but must never cross it: it is
       * checked for overflow like everything else, and exempt from the
       * `--min` headroom requirement. Including it in that requirement made
       * every credit on every film fail the moment `--min` was anything above
       * zero — a gate that fails on the design working as intended is a gate
       * people disable. */
      const credits = rows.filter((r) => r.type === 'credit');
      const body = rows.filter((r) => r.type !== 'credit');

      const overflowing = [];
      const cramped = [];
      for (const r of rows) {
        const worst = Math.min(r.left, r.top, r.right, r.bottom);
        if (worst < -TOLERANCE) overflowing.push(Object.assign({}, r, { worst: +worst.toFixed(1), why: 'outside the stage' }));
        else if (r.type !== 'credit' && worst < minMargin - TOLERANCE) cramped.push(Object.assign({}, r, { worst: +worst.toFixed(1) }));
      }
      overflowing.sort((a, b) => a.worst - b.worst);
      cramped.sort((a, b) => a.worst - b.worst);
      measured += rows.length;

      const stage = value.stage;
      console.log(`  stage          ${Math.round(stage.w)}x${Math.round(stage.h)}  bg=${stage.bg}${stage.mode ? `  data-mode="${stage.mode}"` : ''}`);

      /* Did it paint the theme it was asked to paint? Compare the page's own
         computed background against what the compiler resolved for this mode.
         A scene background overrides the stage, so the stage colour is the
         film-wide default — the right thing to compare, and a mismatch here
         means the whole run measured a different palette than the one whose
         geometry it claims to be reporting. */
      if (job.expectBg) {
        const want = hexToRgb(job.expectBg);
        const got = String(stage.bg).replace(/\s+/g, ' ');
        if (want && got !== want) {
          console.log(`  FAIL  the page painted ${got} but --mode ${job.mode} resolves the stage to ${want}`);
          console.log('        Every number below was measured against the WRONG theme.');
          fail('measured the wrong theme');
        }
      }
      console.log(`  measured       ${rows.length} element boxes across ${job.scenes.length} scene mid-frames (${credits.length} credit(s) checked, excluded from headroom)`);
      if (job.needsKatex && !value.notes.katex) {
        console.log('  FAIL  KaTeX did NOT load (no renderMathInElement) — every latex box below is raw `$$…$$`');
        fail('KaTeX did not load');
      }
      /* The library loading is not the maths rendering. This is the assertion
         that closes P5: after onFrame has run for every scene, the stage must
         not still read as source. It is checked here and nowhere else, because
         this is the only gate that actually runs the clip. */
      if (value.notes.latexEls) {
        console.log(`  maths          ${value.notes.latexEls - value.notes.rawLatex}/${value.notes.latexEls} latex element(s) typeset`);
        if (value.notes.rawLatex) {
          console.log(`  FAIL  ${value.notes.rawLatex} latex element(s) still read as raw \`$$…\$$\` after the clip ran`);
          fail('maths still raw after onFrame');
        }
      }
      const faces = [...new Set(value.notes.faces.map((f) => f.split(' ')[0]))];
      console.log(`  fonts          ${value.notes.fonts} declared, ${value.notes.faces.length} face(s) loaded${faces.length ? ': ' + faces.slice(0, 6).join(', ') : ''}`);
      if (job.needsWebfont && value.notes.faces.length === 0) {
        console.log('  note           NO webfont loaded — every box below is measured in a FALLBACK face, which is a different width.');
      }

      if (structural.length) {
        console.log(`  STRUCTURAL (${structural.length}):`);
        for (const r of structural) console.log(`    - scene ${r.scene}/${r.id || '?'}: ${r.error}`);
        fail('elements missing from the scene DOM');
      }

      if (overflowing.length) {
        console.log(`  OVERFLOWS THE STAGE (${overflowing.length}):`);
        for (const r of overflowing) {
          console.log(`    - ${r.id}  .${r.type}  worst margin ${r.worst}px  [L ${r.left.toFixed(0)} T ${r.top.toFixed(0)} R ${r.right.toFixed(0)} B ${r.bottom.toFixed(0)}]`);
        }
        console.log('    `.hss` is overflow:hidden, so this content is CROPPED in the export — no');
        console.log('    scrollbar, no warning. Shorten it, cap it with max_width, or raise min_px.');
        fail('content cropped at the stage edge');
      }
      if (cramped.length) {
        console.log(`  LESS HEADROOM THAN --min ${minMargin} (${cramped.length}):`);
        for (const r of cramped) {
          console.log(`    - ${r.id}  .${r.type}  margin ${r.worst}px  [L ${r.left.toFixed(0)} T ${r.top.toFixed(0)} R ${r.right.toFixed(0)} B ${r.bottom.toFixed(0)}]`);
        }
        fail(`less than ${minMargin}px of headroom`);
      }
      if (!overflowing.length && !cramped.length && body.length) {
        const sorted = body.slice().sort((a, b) => Math.min(a.left, a.right, a.top, a.bottom) - Math.min(b.left, b.right, b.top, b.bottom));
        const side = Math.min(...body.map((r) => Math.min(r.left, r.right)));
        const vert = Math.min(...body.map((r) => Math.min(r.top, r.bottom)));
        if (Math.min(side, vert) < tightest.side) {
          tightest.side = Math.min(side, vert);
          tightest.where = `${job.film} ${sorted[0].id}`;
        }
        const top3 = sorted.slice(0, 3)
          .map((r) => `${r.id} ${Math.min(r.left, r.right, r.top, r.bottom).toFixed(0)}px`)
          .join(', ');
        console.log(`  extent         OK — tightest side margin ${side.toFixed(0)}px, tightest vertical ${vert.toFixed(0)}px`);
        console.log(`  tightest       ${top3}`);
      }
    }
  } finally {
    browser.close();
  }

  console.log('');
  console.log(`  totals: ${measured} element boxes measured at ${width}x${height}, tightest overall side margin ${Number.isFinite(tightest.side) ? Math.round(tightest.side) + 'px' : 'n/a'} (${tightest.where || 'n/a'}), ${failures} film(s) failing`);
  if (failures) {
    /* Name the actual reasons rather than always blaming overflow: a run that
       measured the wrong theme is a very different failure from one that found
       cropped text, and a single hardcoded sentence would misdescribe half of
       them. */
    console.error(`reel-extent: FAILED (${failures}) — ${[...reasons].join('; ')}.`);
    return 1;
  }
  console.log('reel-extent: OK — every element fits the stage it ships into.');
  return 0;
}

/* main() is a plain number on the pre-browser paths (no browser, bad film) and
 * a Promise once the CDP session exists. process.exit() only takes a number,
 * so the two shapes are reconciled here rather than by making every early
 * return await something it has no reason to await. */
if (require.main === module) {
  const result = main();
  if (result && typeof result.then === 'function') {
    result.then(
      (code) => process.exit(code),
      (err) => { console.error('\nreel-extent: FAILED — ' + (err && err.stack || err)); process.exit(1); },
    );
  } else {
    process.exit(result);
  }
}
