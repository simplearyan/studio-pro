/**
 * cdp.cjs — the browser both gates drive, shared rather than copied.
 *
 * WHY THIS FILE EXISTS. Two gates now need a real browser: `reel-extent` to
 * lay a clip out and measure it, and `reel-contrast` to ask the cascade what
 * colour a text node actually paints. Both need the same fiddly three things —
 * find Chrome, start it on an ephemeral debugging port, speak CDP over one
 * socket. Copying that between them is the exact defect this pipeline exists
 * to remove: two launchers, one of which gets fixed and one of which does not,
 * and a gate that intermittently fails on one machine for a reason nobody can
 * see. The page-level flow (which targets, what to evaluate) stays in each
 * gate — that is genuinely different per gate and belongs there.
 *
 * ZERO DEPENDENCIES, ON PURPOSE. Headless Chrome is driven over the DevTools
 * Protocol using Node 22's built-in `fetch` and `WebSocket`. There is no
 * playwright or puppeteer here, and no `--remote-debugging-port` guesswork:
 * Chrome is launched with `--remote-debugging-port=0` and writes the port it
 * actually chose to `DevToolsActivePort` in its own profile directory. A gate
 * that needs a 60MB npm install and a matching browser build is a gate that
 * quietly stops running.
 *
 * IT CANNOT PASS BY NOT RUNNING. Callers treat a missing browser as a
 * NON-ZERO exit with a message, not a skip. A gate that skips itself is worse
 * than no gate, because the day it starts skipping is the day a film ships
 * wrong and everyone believes the gate ran.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

/* The design space a film is authored and exported at. Measured here rather
 * than at whatever the preview pane happens to be, because a film that fits at
 * 512px and overflows at 1920 is a film that overflows on export. */
const DEFAULT_W = 1920;
const DEFAULT_H = 1080;

/* ── find a browser ─────────────────────────────────────────────────────
 * CHROME_PATH first, then the places Chrome actually installs, then a
 * Playwright browser cache. A missing browser is a FAILURE, not a skip. */
function findBrowser() {
  const env = process.env.CHROME_PATH;
  if (env && fs.existsSync(env)) return env;
  const candidates = process.platform === 'win32' ? [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ] : process.platform === 'darwin' ? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ] : [
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;

  /* the Playwright cache, newest first — this is where CI usually has it */
  const cacheRoot = process.env.PLAYWRIGHT_BROWSERS_PATH
    || (process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA || '', 'ms-playwright')
      : process.platform === 'darwin' ? path.join(os.homedir(), 'Library/Caches/ms-playwright')
        : path.join(os.homedir(), '.cache/ms-playwright'));
  if (fs.existsSync(cacheRoot)) {
    const dirs = fs.readdirSync(cacheRoot).filter((d) => d.startsWith('chromium')).sort().reverse();
    for (const d of dirs) {
      for (const rel of [
        'chrome-win/chrome.exe', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
        'chrome-linux/chrome',
      ]) {
        const p = path.join(cacheRoot, d, rel);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return null;
}

/* ── a minimal CDP client ───────────────────────────────────────────────
 * One socket, id-matched requests, a session for the page target. */
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    /* Optional sink for server-pushed events (Runtime.exceptionThrown, download
       progress, …). Nothing in the gates sets it — they are strict
       request/response — so a null onEvent is the default and the two lines
       below change nothing until a caller opts in. export-films.cjs uses it to
       make a failed job diagnosable instead of just "stalled". */
    this.onEvent = null;
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id && this.pending.has(d.id)) {
        const p = this.pending.get(d.id);
        this.pending.delete(d.id);
        if (d.error) p.reject(new Error(`${d.error.message} (${JSON.stringify(d.error.data || '')})`));
        else p.resolve(d.result);
      } else if (this.onEvent && d.method) {
        this.onEvent(d);
      }
    };
  }
  send(method, params, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params: params || {}, sessionId }));
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(method + ' timed out')); }
      }, 60000);
    });
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = () => reject(new Error('CDP socket failed to open'));
    });
    return new Cdp(ws);
  }
}

async function launchBrowser(bin, width, height) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-cdp-'));
  const child = spawn(bin, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    /* an explicit window size, then Emulation overrides it exactly; without
       the flag Chrome opens an 800x600 window and everything is measured at
       the wrong size, which is a gate that passes for the wrong reason */
    `--window-size=${width},${height}`,
    /* port 0 = pick one and write it to DevToolsActivePort. Guessing a port
       is how two concurrent runs find each other's browser. */
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  const portFile = path.join(profile, 'DevToolsActivePort');
  const deadline = Date.now() + 30000;
  let wsUrl = null;
  let lastReadError = null;
  while (Date.now() < deadline) {
    /* existsSync-then-readFileSync is a RACE, and on Windows a losing one:
       Chrome creates DevToolsActivePort and keeps it open for writing, so the
       read throws EBUSY/EPERM/UNKNOWN rather than returning a short file. The
       symptom was "could not start the browser: EBUSY" on roughly one run in
       three — a gate that fails intermittently gets retried until people stop
       reading it. Existence is a hint; a READABLE pair of lines is the fact. */
    try {
      const txt = fs.readFileSync(portFile, 'utf8').split(/\r?\n/);
      if (txt.length >= 2 && txt[0].trim() && txt[1].trim()) {
        wsUrl = `ws://127.0.0.1:${txt[0].trim()}${txt[1].trim()}`;
        break;
      }
    } catch (e) {
      if (e.code !== 'ENOENT' && e.code !== 'EBUSY' && e.code !== 'EPERM' && e.code !== 'UNKNOWN') {
        lastReadError = e;
        break;
      }
      lastReadError = e;
    }
    if (child.exitCode !== null) throw new Error(`browser exited with code ${child.exitCode}`);
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!wsUrl) {
    child.kill();
    throw new Error('browser never wrote a readable DevToolsActivePort'
      + (lastReadError ? ` (last read: ${lastReadError.code || lastReadError.message})` : ''));
  }

  const cdp = await Cdp.connect(wsUrl);
  return {
    cdp,
    close() {
      try { child.kill(); } catch (e) { /* already gone */ }
      try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* temp dir */ }
    },
  };
}

module.exports = { DEFAULT_W, DEFAULT_H, findBrowser, launchBrowser, Cdp };
