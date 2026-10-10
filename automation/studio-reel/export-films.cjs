#!/usr/bin/env node
/**
 * export-films.cjs — batch-export every studio-reel film to MP4 / WebM.
 *
 * THREE PIECES, ONE JOB. The ask: "export all our films with CDP and
 * MediaBunny, through the test renderer" — so all three are used literally:
 *
 *   1. CDP (cdp.cjs, zero dependencies) launches headless Chrome and drives a
 *      real `html-in-canvas/test-renderer.html` page. The renderer is not
 *      reimplemented anywhere: the page's own HicRenderer rasterizes each
 *      frame through the same SVG foreignObject path a human sees.
 *   2. The test renderer imports the film exactly the way ⬇ Import HTML does
 *      (parseImportedFile + fillPanesFromImport) and renders frame i at
 *      t = i/fps with its pure f(t) onFrame — deterministic by construction.
 *   3. MediaBunny (vendored, in-page) muxes those frames into MP4 or WebM
 *      via WebCodecs (T1.3: WebM is VP9 frame-exact, never MediaRecorder)
 *      — the same Output/VideoSampleSource calls the editor's export worker
 *      makes (src/workers/export-worker.js).
 *
 * The finished MP4 travels back as 3MB base64 chunks on
 * window.__hicExportResult, because the minimal CDP client deliberately has no
 * event plumbing and one 90MB JSON message would be a bad idea anyway.
 *
 * Every file is then re-read with MediaBunny IN NODE (demux needs no WebCodecs)
 * and checked for size, duration, dimensions and packet count — an export that
 * wrote a file but not a video fails the run rather than sitting on disk.
 *
 * Usage:
 *   node automation/studio-reel/export-films.cjs                    # everything
 *   node automation/studio-reel/export-films.cjs --film two-queens --mode dark
 *   node automation/studio-reel/export-films.cjs --res 720 --fps 30 --dry-run
 *
 * Flags: --film <id> (repeatable)  --mode dark|light   --res 480|720|1080|1440
 *        --fps 30|60               --bitrate <bps>     --out <dir>
 *        --format mp4|webm|both (default mp4)   --changed-since <git-ref>
 *        --dry-run (list jobs, no browser)
 *
 * Shared harness (Track T1.1): serve/verify/doctor live in
 * automation/shared/export/ — the same modules render.js consumes.
 */
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { execSync } = require('child_process');
const { findBrowser, launchBrowser } = require('./cdp.cjs');
const { serveRepo } = require('../shared/export/serve.cjs');
const { verify } = require('../shared/export/verify.cjs');
const { runDoctor, printChecks } = require('../shared/export/doctor.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const FILMS_DIR = path.join(__dirname, 'films');
const PAGE_PATH = '/html-in-canvas/test-renderer.html';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── args ─────────────────────────────────────────────────────────────── */
function parseArgs(argv) {
  const opts = {
    films: [], mode: null, res: '1080', fps: 30, bitrate: 0,
    out: path.join('_exports', 'reel'), dryRun: false,
    format: 'mp4', changedSince: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--film') opts.films.push(argv[++i]);
    else if (a === '--mode') opts.mode = argv[++i];
    else if (a === '--res') opts.res = argv[++i];
    else if (a === '--fps') opts.fps = parseInt(argv[++i], 10);
    else if (a === '--bitrate') opts.bitrate = parseInt(argv[++i], 10);
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--format') opts.format = argv[++i];
    else if (a === '--changed-since') opts.changedSince = argv[++i];
    else if (a === '--dry-run') opts.dryRun = true;
    else { console.error(`unknown flag: ${a}`); process.exit(2); }
  }
  if (opts.mode && !['dark', 'light'].includes(opts.mode)) {
    console.error(`--mode must be dark or light, got ${opts.mode}`); process.exit(2);
  }
  if (!['mp4', 'webm', 'both'].includes(opts.format)) {
    console.error(`--format must be mp4, webm or both, got ${opts.format}`); process.exit(2);
  }
  if (!Number.isFinite(opts.fps) || opts.fps <= 0) { console.error('bad --fps'); process.exit(2); }
  return opts;
}

/* --changed-since <ref> (T1.6): only films whose storyboard/preview/design
 * changed since <ref> — the common "I edited one film" loop stops costing a
 * full batch. git exit is fatal: a wrong ref must not silently export all. */
function changedFilmSet(ref) {
  let out;
  try {
    out = execSync(`git diff --name-only ${JSON.stringify(ref)} -- automation/studio-reel/films`,
      { cwd: ROOT, encoding: 'utf8' });
  } catch (e) {
    console.error(`--changed-since: git diff failed: ${String(e.message).split('\n')[0]}`);
    process.exit(2);
  }
  const set = new Set();
  for (const line of out.split('\n')) {
    const m = line.match(/^automation\/studio-reel\/films\/([^/]+)\//);
    if (m) set.add(m[1]);
  }
  return set;
}

/* Jobs = every committed reel-preview a film has. Single-mode films ship
 * reel-preview.html; two-queens ships reel-preview-{dark,light}.html. */
function listJobs(opts) {
  const jobs = [];
  const changed = opts.changedSince ? changedFilmSet(opts.changedSince) : null;
  const films = fs.readdirSync(FILMS_DIR)
    .filter((d) => fs.existsSync(path.join(FILMS_DIR, d, 'storyboard.json')))
    .filter((d) => !opts.films.length || opts.films.includes(d))
    .filter((d) => !changed || changed.has(d));
  for (const film of films) {
    const dir = path.join(FILMS_DIR, film);
    const previews = fs.readdirSync(dir).filter((f) => /^reel-preview(-dark|-light)?\.html$/.test(f)).sort();
    for (const pv of previews) {
      const m = pv.match(/^reel-preview(-dark|-light)?\.html$/);
      const variant = m[1] ? m[1].slice(1) : null;
      /* --mode dark means the dark variants; light covers both the -light
         files and the single-mode films (which have no mode axis at all). */
      if (opts.mode) {
        if (opts.mode === 'dark' && variant !== 'dark') continue;
        if (opts.mode === 'light' && variant === 'dark') continue;
      }
      jobs.push({
        film, variant,
        id: variant ? `${film}-${variant}` : film,
        file: path.join(dir, pv),
      });
    }
  }
  return jobs;
}

/* The static server moved to automation/shared/export/serve.cjs (T1.1) —
 * same origin rules: a real http origin so vendored modules and fonts load;
 * file:// is opaque-origin and blocks import(). */

/* ── page driving ─────────────────────────────────────────────────────── */
async function makePage(cdp, url) {
  const { targetId } = await cdp.send('Target.createTarget', { url });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  return { targetId, sessionId };
}

async function ev(cdp, sid, expression, awaitPromise) {
  const r = await cdp.send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: !!awaitPromise, timeout: 30000,
  }, sid);
  if (r.exceptionDetails) {
    const d = r.exceptionDetails.exception && r.exceptionDetails.exception.description;
    throw new Error('page threw: ' + (d || r.exceptionDetails.text));
  }
  return r.result && r.result.value;
}

async function waitUntil(cdp, sid, expr, label, timeoutMs) {
  const t0 = Date.now();
  for (;;) {
    let v = null;
    try { v = await ev(cdp, sid, expr); } catch (e) { /* page still settling */ }
    if (v) return;
    if (Date.now() - t0 > timeoutMs) throw new Error(`timed out waiting for ${label} (${timeoutMs}ms)`);
    await sleep(400);
  }
}

const READY_EXPR =
  "document.readyState === 'complete'" +
  " && typeof parseImportedFile === 'function' && typeof startMp4Export === 'function'" +
  " && typeof cmHtml !== 'undefined' && !!cmHtml && typeof cmHtml.setValue === 'function'";

const RENDERER_READY_EXPR =
  "typeof modalRenderer !== 'undefined' && !!modalRenderer && modalRenderer._ready === true" +
  " && typeof exporting !== 'undefined' && !exporting";

/* Import a preview through the page's own header-import path. The file text
 * rides in as a JSON string — same data the ⬇ Import HTML button reads. */
async function importFilm(cdp, sid, job) {
  const text = fs.readFileSync(job.file, 'utf8');
  const expr =
    '(function () {\n' +
    `  var text = ${JSON.stringify(text)};\n` +
    `  var imp = parseImportedFile({ name: ${JSON.stringify(path.basename(job.file))} }, text);\n` +
    '  if (!imp) return JSON.stringify({ error: "parse returned null" });\n' +
    '  fillPanesFromImport(imp, true);\n' +
    '  return JSON.stringify({ ok: true, dur: imp.dur, title: imp.title });\n' +
    '})()';
  const raw = await ev(cdp, sid, expr);
  const res = JSON.parse(raw);
  if (res.error) throw new Error(`import failed: ${res.error}`);
  if (!res.dur || res.dur <= 0) throw new Error(`import adopted no duration (got ${res.dur}) — SB.total regex missed`);
  return res;
}

async function runExport(cdp, sid, job, opts) {
  const kick =
    'window.__hicExportResult = null;\n' +
    'window.__hicExportProgress = { phase: "kick", done: 0, total: 0, error: null };\n' +
    'startVideoExport({ download: false, store: true, ' +
      `fps: ${opts.fps}, res: ${JSON.stringify(String(opts.res))}, ` +
      `format: ${JSON.stringify(opts.format || 'mp4')}` +
      (opts.bitrate ? `, bitrate: ${opts.bitrate}` : '') +
    ' }).then(\n' +
    '  function (r) { window.__hicExportResult = r || { error: "null result" }; },\n' +
    '  function (e) { window.__hicExportResult = { error: String((e && e.message) || e) }; }\n' +
    ');';
  await ev(cdp, sid, kick);

  const t0 = Date.now();
  const expectedFrames = Math.max(1, Math.round((await pageDuration(cdp, sid)) * opts.fps));
  const capMs = 600000 + expectedFrames * 5000;
  let lastSig = '';
  let lastChange = Date.now();
  let lastLoggedPct = -1;
  for (;;) {
    const p = JSON.parse(await ev(cdp, sid, 'JSON.stringify(window.__hicExportProgress || { phase: "missing" })'));
    const sig = `${p.phase}:${p.done}`;
    if (sig !== lastSig) { lastSig = sig; lastChange = Date.now(); }
    if (p.phase === 'error') throw new Error(p.error || 'export failed in page');
    if (p.phase === 'done') break;
    if (p.phase === 'missing') throw new Error('progress cell vanished (page navigated?)');
    const pct = p.total ? Math.floor((p.done * 10) / p.total) : 0;
    if (pct !== lastLoggedPct) {
      lastLoggedPct = pct;
      console.log(`    encode ${String(p.done).padStart(5)}/${p.total} frames (${pct * 10}%)`);
    }
    if (Date.now() - lastChange > 240000) {
      throw new Error(`stalled at phase=${p.phase} ${p.done}/${p.total} for 240s`);
    }
    if (Date.now() - t0 > capMs) throw new Error(`absolute timeout after ${Math.round(capMs / 1000)}s`);
    await sleep(1500);
  }
  /* Let the export's finally (preview restore) settle before the next import
     replaces the renderer — importing into a half-restored stage is how two
     clips end up sharing one sandbox. */
  await waitUntil(cdp, sid, "typeof exporting !== 'undefined' && !exporting", 'export finally', 30000);

  const summary = JSON.parse(await ev(cdp, sid, 'JSON.stringify(window.__hicExportResult || { error: "no result" })'));
  if (summary.error) throw new Error(summary.error);
  if (!Array.isArray(summary.chunks) || !summary.chunks.length) throw new Error('result carried no chunks');

  const parts = [];
  for (let i = 0; i < summary.chunks.length; i++) {
    const b64 = await ev(cdp, sid, `window.__hicExportResult.chunks[${i}]`);
    parts.push(Buffer.from(b64, 'base64'));
  }
  summary.bytes = Buffer.concat(parts);
  return summary;
}

async function pageDuration(cdp, sid) {
  const raw = await ev(cdp, sid,
    'JSON.stringify({ dur: (PRESETS[currentPresetKey] || {}).dur || 0 })');
  return JSON.parse(raw).dur;
}

/* verify() moved to automation/shared/export/verify.cjs (T1.1) — same
 * MediaBunny re-read in Node, now covering MP4 AND WebM (T1.3). */

/* ── main ─────────────────────────────────────────────────────────────── */
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const jobs = listJobs(opts);
  if (!jobs.length) {
    if (opts.changedSince) {
      console.log(`export-films: no films changed since ${opts.changedSince} — nothing to do`);
      return 0;
    }
    console.error('export-films: no reel-preview files matched');
    return 2;
  }

  console.log(`export-films: ${jobs.length} job(s), ${opts.res}p @ ${opts.fps}fps → ${opts.out}`);
  for (const j of jobs) console.log(`  ${j.id.padEnd(24)} ${path.relative(ROOT, j.file)}`);
  if (opts.dryRun) return 0;

  /* Preflight (T1.4): every historical failure mode is a named line before
     Chrome ever launches — a dead run is discovered in milliseconds, not
     minutes. */
  const doctor = await runDoctor({ needDevServer: false });
  printChecks(doctor.checks);
  if (!doctor.ok) {
    console.error('export-films: export-doctor failed — fix the FAIL line(s) above');
    return 2;
  }

  const bin = findBrowser();
  if (!bin) { console.error('export-films: no Chrome found (set CHROME_PATH)'); return 2; }

  fs.mkdirSync(opts.out, { recursive: true });
  const server = await serveRepo();
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const browser = await launchBrowser(bin, 1920, 1080);

  /* Page exceptions land here — the CDP client has no event plumbing by
     design, but a failed job must be diagnosable beyond "stalled". */
  const pageErrors = [];
  browser.cdp.onEvent = (d) => {
    if (d.method === 'Runtime.exceptionThrown') {
      const ex = d.params.exceptionDetails;
      const desc = ex.exception && (ex.exception.description || String(ex.exception.value));
      pageErrors.push(desc || ex.text || 'unknown exception');
      if (pageErrors.length > 20) pageErrors.shift();
    }
  };

  const results = [];
  try {
    const { sessionId } = await makePage(browser.cdp, base + PAGE_PATH);
    await waitUntil(browser.cdp, sessionId, READY_EXPR, 'test-renderer ready', 90000);
    console.log('  test-renderer ready\n');

    for (const job of jobs) {
      const started = Date.now();
      console.log(`${job.id}`);
      try {
        const imported = await importFilm(browser.cdp, sessionId, job);
        console.log(`    imported "${imported.title}" · ${imported.dur}s timeline`);
        await waitUntil(browser.cdp, sessionId, RENDERER_READY_EXPR, 'clip renderer', 60000);
        await sleep(300); /* fonts settle beyond setClip's own fonts.ready */

        /* One import, every requested container (T1.3): MP4 and WebM come
           from the same frame-exact pump — WebM is VP9 via WebCodecs, never
           the wall-clock MediaRecorder path. */
        const formats = opts.format === 'both' ? ['mp4', 'webm'] : [opts.format];
        const outs = [];
        for (const fmt of formats) {
          if (outs.length) {
            /* A previous export rebuilt the preview renderer in its finally;
               wait for that stage before exporting into it again. */
            await waitUntil(browser.cdp, sessionId, RENDERER_READY_EXPR, 'clip renderer (next format)', 60000);
            await sleep(300);
          }
          const tFmt = Date.now();
          const out = await runExport(browser.cdp, sessionId, job, { ...opts, format: fmt });
          const outFile = path.join(opts.out, `${job.id}.${fmt}`);
          fs.writeFileSync(outFile, out.bytes);

          const v = await verify(outFile, {
            width: out.width, height: out.height, duration: out.duration, frames: out.frames,
          });
          if (!v.ok) throw new Error(`verification failed (${fmt}): ${v.why}`);

          const elapsedFmt = ((Date.now() - tFmt) / 1000).toFixed(1);
          console.log(`    ok   ${path.relative(ROOT, outFile)} — ${out.frames} frames, ${out.duration}s, ` +
            `${out.codec}, ${(out.bytes.length / 1e6).toFixed(1)}MB, verify ok (${elapsedFmt}s)`);
          outs.push({ fmt, out, v, outFile });
        }

        const elapsed = ((Date.now() - started) / 1000).toFixed(1);
        console.log('');
        results.push({ id: job.id, ok: true, outs, elapsed: +elapsed });
      } catch (e) {
        const msg = String((e && e.message) || e);
        console.log(`    FAIL ${msg}`);
        if (pageErrors.length) {
          console.log('    page errors:');
          for (const err of pageErrors.slice(-3)) console.log(`      - ${String(err).split('\n')[0]}`);
        }
        console.log('');
        results.push({ id: job.id, ok: false, error: msg });
        /* A failed page state (half-torn-down renderer, stuck exporting flag)
           would poison every later job — reload and wait for a clean stage. */
        try {
          pageErrors.length = 0;
          await browser.cdp.send('Page.reload', {}, sessionId);
          await waitUntil(browser.cdp, sessionId, READY_EXPR, 'test-renderer after reload', 90000);
          console.log('    (page reloaded — continuing)\n');
        } catch (e2) {
          console.log(`    (reload failed: ${e2.message})\n`);
        }
      }
    }
  } finally {
    try { browser.close(); } catch (e) { /* already gone */ }
    await new Promise((r) => server.close(r));
  }

  console.log('─────────────────────────────────────────────');
  const bad = results.filter((r) => !r.ok);
  const mb = results.filter((r) => r.ok)
    .reduce((a, r) => a + r.outs.reduce((s, o) => s + o.out.bytes.length, 0), 0);
  console.log(`export-films: ${results.length - bad.length}/${results.length} exported, ${(mb / 1e6).toFixed(0)}MB total, ${opts.out}`);
  for (const r of bad) console.log(`  FAILED ${r.id}: ${r.error}`);
  return bad.length ? 1 : 0;
}

module.exports = {
  parseArgs, listJobs, makePage, ev, waitUntil, importFilm, runExport, pageDuration,
  READY_EXPR, RENDERER_READY_EXPR, ROOT, FILMS_DIR,
};

if (require.main === module) {
  main().then(
    (code) => process.exit(code || 0),
    (e) => { console.error('export-films: crashed —', e && e.stack || e); process.exit(1); }
  );
}
