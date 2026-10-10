#!/usr/bin/env node
/**
 * reel-export-gate.cjs — the missing gate #11 (T1.5) + the determinism
 * probe (T1.6), in one run that takes under a minute:
 *
 *   1. export-doctor quick preflight (T1.4)
 *   2. a 1-second fixture film imported through the REAL chain
 *      (parseImportedFile → fillPanesFromImport → HicRenderer.setClip)
 *   3. determinism probe: render every frame twice, hash each frame's pixels
 *      IN THE PAGE — the two runs must be identical (T1.6)
 *   4. motion probe: the fixture's ONLY animation is a CSS @keyframes (no
 *      onFrame) — hashes must VARY across frames or the raster is freezing
 *      animation (T1.7 materialize) and the gate says so by name
 *   5. export MP4 and WebM from the same import (T1.3) and re-read both with
 *      MediaBunny in Node (T1.1) — a file that is not a video fails the run
 *
 * The fixture deliberately protects against the historical "valid MP4 of a
 * flat grey field" bug: it has two static colored elements plus the animated
 * card, so a dead raster cannot pass either probe.
 *
 * Usage: node automation/studio-reel/reel-export-gate.cjs [--keep] [--fps 30]
 *          [--film <name> --probe fromMs:toMs [--probe ...]]
 *   --keep  leave the produced videos in _freebuff/export-gate/ (default: keep)
 *   --film  M8 mode: import films/<name>/reel-clip.json instead of the fixture,
 *           probe ONLY the given --probe windows (CSS-keyframed scenes), then
 *           export + verify both containers from that import. Exit 0 with the
 *           same verdict contract as fixture mode.
 * Exit: 0 all probes pass · 1 probe/export failure · 2 preflight failure
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { findBrowser, launchBrowser } = require('./cdp.cjs');
const { serveRepo } = require('../shared/export/serve.cjs');
const { verify } = require('../shared/export/verify.cjs');
const { runDoctor, printChecks } = require('../shared/export/doctor.cjs');
const {
  makePage, waitUntil, importFilm, runExport,
  READY_EXPR, RENDERER_READY_EXPR,
} = require('./export-films.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, '_freebuff', 'export-gate');
const FIXTURE_FILE = path.join(OUT_DIR, 'fixture.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* The fixture: 1s, pure CSS animation (no onFrame), static landmarks.
   Opacity starts at 0 with a translate — an unmaterialized raster shows the
   static landmarks ONLY, identically, forever: both probes catch it. */
const FIXTURE = {
  name: 'Export Gate Fixture',
  dur: 1,
  html: [
    '<div class="fx-stage">',
    '  <div class="fx-kicker">EXPORT GATE</div>',
    '  <div class="fx-box"></div>',
    '  <div class="fx-sub">css animation · frame-exact · deterministic</div>',
    '</div>',
  ].join('\n'),
  css: [
    '.fx-stage{width:100%;height:100%;background:#14161f;display:flex;flex-direction:column;',
    'align-items:center;justify-content:center;gap:26px;font-family:Arial,Helvetica,sans-serif}',
    '.fx-kicker{color:#FFD84D;letter-spacing:10px;font-size:30px;font-weight:700}',
    '.fx-sub{color:#9895EE;font-size:19px}',
    '.fx-box{width:220px;height:220px;border-radius:30px;',
    'background:linear-gradient(135deg,#6965DB,#FF4D8D);opacity:0;',
    'transform:translateY(190px) rotate(-14deg);',
    'animation:fx-grow 1s linear both}',
    '@keyframes fx-grow{',
    '0%{opacity:0;transform:translateY(190px) rotate(-14deg)}',
    '55%{opacity:1}',
    '100%{opacity:1;transform:translateY(0) rotate(0deg)}}',
  ].join('\n'),
  js: '',
};

/* In-page: render every frame and SHA-256 its pixels (first 16 bytes hex).
   Rendered THROUGH renderFrame, so whatever the export pump would bake into
   frame i is exactly what this hashes — T1.7 included. */
const HASH_RUN = `
window.__gateHashRun = async function (fps, fromMs, toMs) {
  var p = PRESETS[currentPresetKey];
  var dur = p.dur || 0;
  var a = (fromMs === undefined || fromMs === null) ? 0 : fromMs;
  var b = (toMs === undefined || toMs === null) ? Math.round(dur * 1000) : Math.min(toMs, Math.round(dur * 1000));
  var out = [];
  for (var t = a; t < b; t += (1000 / fps)) {
    await modalRenderer.renderFrame(t);
    var c = modalRenderer.canvas;
    var data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    var digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
    var hex = '';
    for (var j = 0; j < 16; j++) hex += digest[j].toString(16).padStart(2, '0');
    out.push(hex);
  }
  return out;
};`;

async function main() {
  const argv = process.argv.slice(2);
  const fps = 30;
  const idx = argv.indexOf('--fps');
  if (idx !== -1 && argv[idx + 1]) {
    const v = parseInt(argv[idx + 1], 10);
    if (!Number.isFinite(v) || v <= 0) { console.error('bad --fps'); return 2; }
  }
  const effectiveFps = idx !== -1 && argv[idx + 1] ? parseInt(argv[idx + 1], 10) : fps;

  /* M8 film mode: which film, which keyframed windows to hash. */
  const filmIdx = argv.indexOf('--film');
  const filmName = filmIdx !== -1 ? argv[filmIdx + 1] : null;
  const probes = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--probe') {
      const m = /^(\d+):(\d+)$/.exec(argv[++i] || '');
      if (!m) { console.error('bad --probe, want fromMs:toMs'); return 2; }
      probes.push([parseInt(m[1], 10), parseInt(m[2], 10)]);
    }
  }
  if (filmName && !probes.length) {
    console.error('--film needs at least one --probe fromMs:toMs (the keyframed windows)');
    return 2;
  }

  /* ── 1. preflight ─────────────────────────────────────────────────── */
  console.log('reel-export-gate: preflight');
  const doctor = await runDoctor({ needDevServer: false });
  printChecks(doctor.checks);
  if (!doctor.ok) {
    console.error('reel-export-gate: export-doctor failed — fix the FAIL line(s) above');
    return 2;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  /* Fixture mode writes its 1s probe clip; film mode imports the film's own
     compiled clip (reel-compile --write-clip) — same shape, same import path. */
  let importFile = FIXTURE_FILE;
  let clipDur = FIXTURE.dur;
  if (filmName) {
    const clipPath = path.join(ROOT, 'automation', 'studio-reel', 'films', filmName, 'reel-clip.json');
    if (!fs.existsSync(clipPath)) {
      console.error(`reel-export-gate: ${path.relative(ROOT, clipPath)} missing — run:`);
      console.error(`  node automation/studio-reel/reel-compile.cjs --only ${filmName} --write-clip`);
      return 2;
    }
    clipDur = JSON.parse(fs.readFileSync(clipPath, 'utf8')).dur;
    importFile = clipPath;
    console.log(`reel-export-gate: film mode — ${filmName} · ${clipDur}s · probes ${probes.map((p) => p[0] + '-' + p[1] + 'ms').join(', ')}`);
  } else {
    fs.writeFileSync(FIXTURE_FILE, JSON.stringify(FIXTURE, null, 2));
  }

  const bin = findBrowser();
  if (!bin) { console.error('reel-export-gate: no Chrome found (set CHROME_PATH)'); return 2; }

  const server = await serveRepo();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await launchBrowser(bin, 1920, 1080);
  const pageErrors = [];
  browser.cdp.onEvent = (d) => {
    if (d.method === 'Runtime.exceptionThrown') {
      const ex = d.params.exceptionDetails;
      pageErrors.push((ex.exception && ex.exception.description) || ex.text || 'unknown exception');
    }
  };

  try {
    const { sessionId } = await makePage(browser.cdp, base + '/html-in-canvas/test-renderer.html');
    await waitUntil(browser.cdp, sessionId, READY_EXPR, 'test-renderer ready', 90000);
    console.log('reel-export-gate: test-renderer ready\n');

    /* ── 2. import the fixture through the real chain ───────────────── */
    const imported = await importFilm(browser.cdp, sessionId, { file: importFile });
    console.log(`gate: imported "${imported.title}" · ${imported.dur}s`);
    if (Math.abs(imported.dur - clipDur) > 0.01) {
      console.error(`gate: FAIL imported duration ${imported.dur}s != clip ${clipDur}s`);
      return 1;
    }
    await waitUntil(browser.cdp, sessionId, RENDERER_READY_EXPR, 'clip renderer', 60000);
    await sleep(300);
    /* Import auto-opens the stage and PLAYS it: tickModal keeps rendering the
       film live at wall-clock time and materializeAnimations bakes that
       wall-phase state into inline styles. A keyframe that declares only some
       offsets (bob's `50%{...}`) then reads its UNDERLYING value from the bake,
       so probe frames stop being a pure function of t — nondeterministic hashes
       whose first mismatch lands wherever the live playhead happened to be.
       Exports already stop playback (startVideoExport sets modalPlaying=false);
       the probes must too. The old fixture/CSS passed only because fx-grow and
       ring declare every offset, which makes them immune to the underlying bake. */
    console.log('gate: stopping stage playback (modalPlaying=false) before probes');
    try {
      await browser.cdp.send('Runtime.evaluate', {
        expression: '(function(){ var was = (typeof modalPlaying !== "undefined") ? modalPlaying : null; modalPlaying = false; return was; })()',
        returnByValue: true,
      }, sessionId);
    } catch (e) {
      console.error('gate: playback-stop evaluate failed —', String(e && e.message || e));
      throw e;
    }
    await sleep(400);

    /* ── 3+4. determinism + motion probes ───────────────────────────── */
    await browser.cdp.send('Runtime.evaluate', { expression: HASH_RUN }, sessionId);
    /* Fixture mode probes the whole 1s; film mode probes ONLY the declared
       windows — the CSS-keyframed scenes M8 cares about. */
    const probeList = filmName ? probes : [[0, Math.round(clipDur * 1000)]];
    let failed = false;
    for (const [from, to] of probeList) {
      const run1 = await browser.cdp.send('Runtime.evaluate', {
        expression: `window.__gateHashRun(${effectiveFps}, ${from}, ${to})`, returnByValue: true, awaitPromise: true,
      }, sessionId);
      const run2 = await browser.cdp.send('Runtime.evaluate', {
        expression: `window.__gateHashRun(${effectiveFps}, ${from}, ${to})`, returnByValue: true, awaitPromise: true,
      }, sessionId);
      const h1 = run1.result && run1.result.value;
      const h2 = run2.result && run2.result.value;
      if (!Array.isArray(h1) || !h1.length || !Array.isArray(h2) || !h2.length) {
        console.error('gate: FAIL hash run produced no frames',
          JSON.stringify((run1.exceptionDetails || {}).text || ''),
          JSON.stringify((run2.exceptionDetails || {}).text || ''));
        return 1;
      }

      const distinct = new Set(h1).size;
      const matches = h1.length === h2.length && h1.every((v, i) => v === h2[i]);
      console.log(`gate: probe ${from}-${to}ms · frames ${h1.length} · distinct across time ${distinct} · double-run identical ${matches}`);

      if (distinct < 2) {
        console.error('gate: FAIL no motion across frames in this window — the CSS animation is not being');
        console.error('      materialized into the raster (T1.7 in html-in-canvas/hic-frame.js)');
        failed = true;
      }
      if (!matches) {
        const firstDiff = h1.findIndex((v, i) => v !== h2[i]);
        console.error(`gate: FAIL nondeterministic frames — first mismatch at frame ${firstDiff}`);
        console.error('      (wall-clock animation or unstable raster — T1.6 requires identical hashes)');
        failed = true;
      }
    }
    if (failed) return 1;
    console.log('gate: determinism + motion probes passed (T1.6, T1.7)\n');

    /* ── 5. export both containers, re-read both ────────────────────── */
    const expectFrames = Math.max(1, Math.round(clipDur * effectiveFps));
    const outStem = filmName ? `gate-${filmName}` : 'gate';
    for (const fmt of ['mp4', 'webm']) {
      await waitUntil(browser.cdp, sessionId, RENDERER_READY_EXPR, `clip renderer (${fmt})`, 60000);
      await sleep(300);
      const out = await runExport(browser.cdp, sessionId, { id: outStem },
        { fps: effectiveFps, res: '1080', format: fmt });
      const outFile = path.join(OUT_DIR, `${outStem}.${fmt}`);
      fs.writeFileSync(outFile, out.bytes);

      if (out.frames !== expectFrames) {
        console.error(`gate: FAIL ${fmt} rendered ${out.frames} frames, expected ${expectFrames}`);
        failed = true;
      }
      const v = await verify(outFile, {
        width: out.width, height: out.height, duration: out.duration, frames: out.frames,
      });
      if (!v.ok) {
        console.error(`gate: FAIL ${fmt} verification: ${v.why}`);
        failed = true;
      } else {
        console.log(`gate: ${fmt} ok — ${path.relative(ROOT, outFile)} · ${out.frames} frames · ` +
          `${out.duration}s · ${v.codec} · ${(v.bytes / 1e6).toFixed(1)}MB`);
      }
    }
    if (failed) return 1;

    console.log(`\nreel-export-gate: PASS — doctor, import, determinism, motion, MP4 + WebM verified${filmName ? ` (${filmName})` : ''}`);
    return 0;
  } finally {
    try { await browser.close(); } catch (e) { /* already gone */ }
    await new Promise((r) => server.close(r));
    if (pageErrors.length) {
      console.error('gate: page errors during run:');
      for (const e of pageErrors.slice(-3)) console.error('  - ' + String(e).split('\n')[0]);
    }
  }
}

main().then(
  (code) => process.exit(code || 0),
  (e) => { console.error('reel-export-gate: crashed —', e && e.stack || e); process.exit(1); }
);
