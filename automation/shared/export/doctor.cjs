'use strict';
/**
 * doctor.cjs — export-doctor: every historical export failure mode becomes a
 * named check with a one-line fix, before any batch or render starts (T1.4).
 *
 * The folklore this replaces (each of these was once a dead run discovered
 * minutes in):
 *   - no Chrome / wrong CHROME_PATH
 *   - page opened as file:// → vendored MediaBunny module import blocked
 *   - /vendor/... 404 (public/ not served → every export dies)
 *   - npx http-server instead of Vite → raw HTML, broken layout, no HMR
 *   - dev server down when the editor path needs it
 *   - disk full mid-batch
 *   - ffmpeg assumed required (it is not, after T1.2 — reported as info only)
 *
 * Usage:
 *   node automation/shared/export/doctor.cjs            # quick checks
 *   node automation/shared/export/doctor.cjs --deep     # + launch Chrome,
 *                                                       #   WebCodecs, vendored
 *                                                       #   module, export fns
 *   node automation/shared/export/doctor.cjs --need-dev-server   # fail when
 *                                                       #   no dev server is up
 *
 * Programmatic: runDoctor({ deep, needDevServer }) → { ok, checks }.
 * Exit code 1 when any REQUIRED check fails (info checks never fail).
 */

const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const DEV_PORTS = [7000, 3000, 3001];

const CHECKS = [];

function add(name, required, ok, detail, fix) {
  CHECKS.push({ name, required, ok: !!ok, detail: detail || '', fix: fix || '' });
  return CHECKS[CHECKS.length - 1];
}

function fileExists(rel) { return fs.existsSync(path.join(ROOT, rel)); }

function probePort(port, timeoutMs = 800) {
  /* Vite may bind ::1 only (Node 17+ dns order makes 127.0.0.1 look dead),
     so try IPv4 then IPv6 — the same lesson md-render learned. */
  const tryHost = (host) => new Promise((resolve) => {
    const sock = net.connect({ host, port });
    let done = false;
    const finish = (v) => { if (!done) { done = true; try { sock.destroy(); } catch (e) {} resolve(v); } };
    sock.once('connect', () => finish(true));
    sock.once('error', () => finish(false));
    sock.setTimeout(timeoutMs, () => finish(false));
  });
  return tryHost('127.0.0.1').then((ok4) => ok4 || tryHost('::1'));
}

function httpGet(url, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', (c) => { if (body.length < 200000) body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', () => resolve(null));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve(null); });
  });
}

async function findDevServer() {
  for (const port of DEV_PORTS) {
    if (await probePort(port)) return `http://localhost:${port}`;
  }
  return null;
}

/* ── quick checks: no browser launch, no network beyond localhost ─────── */
async function quickChecks(opts) {
  /* 1. Chrome binary — same finder the export path uses. */
  let bin = null;
  try { bin = require('../../studio-reel/cdp.cjs').findBrowser(); } catch (e) { /* fall through */ }
  add('chrome binary', true, !!bin,
    bin || 'not found',
    bin ? '' : 'set CHROME_PATH to a Chrome/Edge executable, or install Chrome');

  /* 2. The renderer page the batch drives. */
  const renderer = 'docs/html-in-canvas/test-renderer.html';
  add('renderer page', true, fileExists(renderer), renderer,
    'missing? the batch cannot render without test-renderer.html');

  /* 3+4. Vendored runtimes public/ must serve (a 404 here kills every export). */
  const mb = 'public/vendor/mediabunny/mediabunny.min.js';
  add('vendored mediabunny', true, fileExists(mb), mb,
    'missing? exports import it at runtime — restore public/vendor/mediabunny/');
  const tw = 'public/vendor/tailwind-browser/index.global.js';
  add('vendored tailwind-browser', true, fileExists(tw), tw,
    'missing? Tailwind-utility clips fall back to unstyled — restore public/vendor/tailwind-browser/');

  /* 5. Encoder page used by html-in-canvas cdp renders (T1.2 transport). */
  const enc = 'automation/shared/export/encoder.html';
  add('in-page encoder page', true, fileExists(enc), enc,
    'missing? cdp-mode renders have no ffmpeg-free encode path');

  /* 6. At least one film with storyboard + preview. */
  let films = 0;
  try {
    const dir = path.join(ROOT, 'automation', 'studio-reel', 'films');
    films = fs.readdirSync(dir)
      .filter((d) => fs.existsSync(path.join(dir, d, 'storyboard.json')) &&
                      fs.readdirSync(path.join(dir, d)).some((f) => /^reel-preview(-dark|-light)?\.html$/.test(f)))
      .length;
  } catch (e) { /* films dir gone */ }
  add('reel films', true, films > 0, `${films} film(s) with storyboard + preview`,
    'missing? run reel-compile to regenerate previews');

  /* 7. Disk space on the export dir (statfs where the platform has it). */
  try {
    const statfs = fs.promises && fs.promises.statfs ? await fs.promises.statfs(path.join(ROOT, '_exports')) : null;
    if (statfs) {
      const freeMB = Math.floor((statfs.bavail * statfs.bsize) / 1e6);
      add('disk space', true, freeMB > 200, `${freeMB}MB free on _exports`,
        freeMB > 200 ? '' : 'free up disk — a full disk mid-batch leaves corrupt videos');
    } else {
      add('disk space', false, true, 'statfs unavailable on this Node — skipped');
    }
  } catch (e) {
    /* _exports may not exist yet — probe ROOT instead */
    try {
      const statfs = await fs.promises.statfs(ROOT);
      const freeMB = Math.floor((statfs.bavail * statfs.bsize) / 1e6);
      add('disk space', true, freeMB > 200, `${freeMB}MB free`);
    } catch (e2) {
      add('disk space', false, true, 'could not stat filesystem — skipped');
    }
  }

  /* 8. ffmpeg — informational only: after T1.2 nothing in the repo needs it. */
  const ffmpeg = await new Promise((resolve) => {
    const { spawn } = require('child_process');
    const p = spawn(process.platform === 'win32' ? 'where' : 'which', ['ffmpeg']);
    p.on('error', () => resolve(false));
    p.on('close', (code) => resolve(code === 0));
  });
  add('ffmpeg (not required)', false, true, ffmpeg ? 'present — ignored by all code paths' : 'absent — fine (informational)');

  /* 9. Dev server — required only when the caller says so (editor mode /
        cdp renders need it for composition load + the encoder page). */
  const devUrl = await findDevServer();
  add('dev server', !!opts.needDevServer, !!devUrl,
    devUrl || `none answering on ${DEV_PORTS.join('/')}`,
    opts.needDevServer && !devUrl ? 'npm run dev  (or: npm run dev:automation for port 7000)' : '');

  /* 10. Vite identity — a wrong server produces garbage, not an error. */
  if (devUrl) {
    const res = await httpGet(devUrl + '/');
    const isVite = !!(res && res.body && res.body.indexOf('@vite/client') !== -1);
    add('vite identity', !!opts.needDevServer, isVite,
      isVite ? `${devUrl} serves Vite` : `${devUrl} is NOT Vite`,
      isVite ? '' : 'kill it and run npm run dev — never npx http-server / npx serve');
  } else {
    add('vite identity', false, true, 'skipped (no dev server up)');
  }

  return devUrl;
}

/* ── deep checks: launch Chrome, prove WebCodecs + the vendored module ── */
async function deepChecks(opts, devUrl) {
  let browser = null;
  try {
    const { launchBrowser } = require('../../studio-reel/cdp.cjs');
    const bin = require('../../studio-reel/cdp.cjs').findBrowser();
    const { serveRepo } = require('./serve.cjs');
    const server = await serveRepo();
    const port = server.address().port;
    const base = devUrl || `http://127.0.0.1:${port}`;
    try {
      browser = await launchBrowser(bin, 640, 360);
      const { Cdp } = require('../../studio-reel/cdp.cjs');
      /* launchBrowser returns { cdp, close } — reuse its client. */
      const cdp = browser.cdp;
      const { targetId } = await cdp.send('Target.createTarget', { url: base + '/docs/html-in-canvas/test-renderer.html' });
      const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
      await cdp.send('Page.enable', {}, sessionId);
      await cdp.send('Runtime.enable', {}, sessionId);

      const evalOn = async (expr) => {
        const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
        if (r.exceptionDetails) return null;
        return r.result && r.result.value;
      };

      /* Target.createTarget navigates asynchronously — evaluating into
         about:blank would report "no WebCodecs / not http / no export
         functions" for a page that simply has not loaded yet. Wait for it. */
      const t0 = Date.now();
      let loaded = false;
      for (;;) {
        loaded = await evalOn('location.protocol.indexOf("http") === 0 && typeof startVideoExport === "function"');
        if (loaded) break;
        if (Date.now() - t0 > 60000) break;
        await new Promise((r) => setTimeout(r, 500));
      }
      if (!loaded) {
        add('test-renderer load', true, false, 'page did not reach http origin + export functions in 60s',
          'open the page manually and check console errors; dev server must serve docs/');
        return;
      }

      /* WebCodecs + raster primitives the in-page encoder needs. */
      const codecs = await evalOn('JSON.stringify({ ve: typeof VideoEncoder, vf: typeof VideoFrame, cib: typeof createImageBitmap, cs: typeof crypto && !!crypto.subtle })');
      let codecOk = false, codecDetail = codecs || 'page did not answer';
      if (codecs) {
        const c = JSON.parse(codecs);
        codecOk = c.ve === 'function' && c.vf === 'function' && c.cib === 'function' && c.cs === true;
        if (!codecOk) codecDetail = `VideoEncoder=${c.ve} VideoFrame=${c.vf} createImageBitmap=${c.cib} crypto.subtle=${c.cs}`;
      }
      add('webcodecs', true, codecOk, codecDetail,
        codecOk ? '' : 'Chrome too old or no software encoder available — update Chrome');

      /* Origin is http (not file://) + vendored MediaBunny importable. */
      const originOk = await evalOn('location.protocol === "http:" || location.protocol === "https:"');
      add('page origin', true, !!originOk, originOk ? base + ' (http)' : 'not an http origin',
        originOk ? '' : 'never open export pages as file:// — module imports are origin-blocked');

      const mbOk = await evalOn('import("/vendor/mediabunny/mediabunny.min.js").then(m => !!(m.Output && m.VideoSampleSource)).catch(e => String(e && e.message || e))');
      const mbGood = mbOk === true;
      add('vendored mediabunny importable', true, mbGood,
        mbGood ? 'module imports and exposes Output/VideoSampleSource' : String(mbOk),
        mbGood ? '' : 'public/vendor must be served — check the static server mapping');

      /* The export entry points both pipelines call. */
      const fns = await evalOn('JSON.stringify({ mp4: typeof startMp4Export, video: typeof startVideoExport, imp: typeof parseImportedFile })');
      let fnOk = false, fnDetail = fns || 'page did not answer';
      if (fns) {
        const f = JSON.parse(fns);
        fnOk = f.mp4 === 'function' && f.video === 'function' && f.imp === 'function';
        if (!fnOk) fnDetail = `startMp4Export=${f.mp4} startVideoExport=${f.video} parseImportedFile=${f.imp}`;
      }
      add('export functions', true, fnOk, fnDetail,
        fnOk ? '' : 'test-renderer failed to load — check console errors in the page');

      await cdp.send('Target.closeTarget', { targetId });
    } finally {
      try { await browser.close(); } catch (e) { /* already gone */ }
      if (!devUrl) await new Promise((r) => server.close(r));
    }
  } catch (e) {
    add('browser deep check', false, false, 'crashed: ' + (e && e.message),
      'Chrome launch failed — check CHROME_PATH and that no other headless instance holds the profile');
  }
}

/* ── runner + CLI ─────────────────────────────────────────────────────── */

async function runDoctor(opts = {}) {
  CHECKS.length = 0;
  const devUrl = await quickChecks(opts);
  if (opts.deep) await deepChecks(opts, devUrl);
  const ok = CHECKS.every((c) => c.required ? c.ok : true);
  return { ok, checks: CHECKS.slice(), devUrl };
}

function printChecks(checks) {
  const width = Math.max(...checks.map((c) => c.name.length));
  for (const c of checks) {
    const status = c.ok ? 'OK  ' : (c.required ? 'FAIL' : 'warn');
    console.log(`  [${status}] ${c.name.padEnd(width)}  ${c.detail}`);
    if (!c.ok && c.required && c.fix) console.log(`         fix: ${c.fix}`);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const opts = {
    deep: argv.includes('--deep'),
    needDevServer: argv.includes('--need-dev-server'),
  };
  console.log(`export-doctor${opts.deep ? ' (deep)' : ''}...`);
  const { ok, checks } = await runDoctor(opts);
  printChecks(checks);
  const failed = checks.filter((c) => c.required && !c.ok);
  if (ok) {
    console.log(`export-doctor: all ${checks.length} checks passed`);
    return 0;
  }
  console.error(`export-doctor: ${failed.length} required check(s) failed — ${failed.map((c) => c.name).join(', ')}`);
  return 1;
}

if (require.main === module) {
  main().then((code) => process.exit(code), (e) => { console.error('export-doctor: crashed —', e && e.stack || e); process.exit(1); });
}

module.exports = { runDoctor, printChecks };
