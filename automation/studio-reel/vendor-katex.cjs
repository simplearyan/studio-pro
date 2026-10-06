#!/usr/bin/env node
/**
 * vendor-katex.cjs — put one self-contained KaTeX in the repo, once.
 *
 * WHY THIS EXISTS
 *
 * The reel emitter used to load KaTeX from jsDelivr with three tags in the clip
 * html. Every path that actually runs a clip worked, because hic-frame.js
 * fetches remote stylesheets and inlines their fonts as data URIs, and hoists
 * the two <script src> tags into <head> — but only while the machine is online.
 * A film exported to a standalone HTML file, or opened on a plane, rendered
 * literal `$$\binom{52}{4}$$` with no error and a green gate, because
 * `_hssSetup` retries forever waiting for `window.renderMathInElement`.
 *
 * So the renderer has to be INSIDE the clip. This script produces that copy:
 *
 *   public/vendor/katex/katex.min.css          fonts inlined as woff2 data URIs
 *   public/vendor/katex/katex.min.js
 *   public/vendor/katex/auto-render.min.js
 *   public/vendor/katex/katex.manifest.json    version + sha256 + byte counts
 *   public/vendor/katex/README.md              provenance and regeneration
 *
 * WHY THE CSS IS REWRITTEN
 *
 * KaTeX's stylesheet points at 20 faces x 3 formats next to itself. Two of those
 * formats are dead weight in every browser that can run this app (woff2 is
 * supported everywhere Chrome and Safari are), and all of them are *files* —
 * which is exactly what an offline clip cannot have. So each @font-face is
 * rewritten to carry its woff2 face as a base64 data URI and nothing else.
 * 260KB of woff2 becomes ~350KB of text and the stylesheet stops needing a
 * directory to live in.
 *
 * WHY A HAND-WRITTEN TAR READER
 *
 * This repo has no tar dependency and should not gain one for a script that runs
 * twice a year. A `.tgz` is gzip + ustar; ustar is a 512-byte header, the file
 * body, and padding to the next 512-byte boundary. That is the whole format for
 * a package tarball, so it is read here rather than installed.
 *
 * USAGE
 *   node automation/studio-reel/vendor-katex.cjs              # fetch from npm
 *   node automation/studio-reel/vendor-katex.cjs --from DIR    # use an extracted dist/ (offline)
 *   node automation/studio-reel/vendor-katex.cjs --check       # verify only, write nothing
 *
 * The version is pinned. Changing it is a deliberate edit of KATEX_VERSION
 * below, followed by re-running this script and the reel gates — never a
 * floating `@3`-style range, which would make two checkouts of this repo
 * compile the same film to two different clips.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'public/vendor/katex');
const KATEX_VERSION = '0.16.11';
const TARBALL = 'https://registry.npmjs.org/katex/-/katex-' + KATEX_VERSION + '.tgz';

/* The three files a clip needs, and where each lands in the vendored folder.
   auto-render is flattened out of contrib/ because the vendored folder is not
   a package any more — it is four files a clip inlines. */
const WANTED = [
  { tar: 'package/dist/katex.min.css', out: 'katex.min.css' },
  { tar: 'package/dist/katex.min.js', out: 'katex.min.js' },
  { tar: 'package/dist/contrib/auto-render.min.js', out: 'auto-render.min.js' },
];

/* ── minimal ustar reader: 512-byte header, body, pad to 512 ─────────────
 * Only the fields a package tarball actually uses are read. Directories and
 * pax headers are skipped by typeflag, which is correct here: npm tarballs are
 * ustar, and the only member names this script looks up are the three above. */
function untar(gz) {
  const buf = zlib.gunzipSync(gz);
  const files = {};
  let off = 0;
  while (off + 512 <= buf.length) {
    const header = buf.subarray(off, off + 512);
    const name = header.subarray(0, 100).toString('utf8').replace(/\0[\s\S]*$/, '');
    if (!name) break;                                   // two zero blocks = end
    const size = parseInt(header.subarray(124, 136).toString('utf8').replace(/\0[\s\S]*$/, '').trim(), 8) || 0;
    const type = String.fromCharCode(header[156]);
    const start = off + 512;
    if (type === '0' || type === '\0') files[name] = buf.subarray(start, start + size);
    off = start + Math.ceil(size / 512) * 512;
  }
  return files;
}

/* ── inline every face as woff2, drop the woff/ttf fallbacks ─────────────
 * Matches KaTeX's own @font-face src declaration exactly as it ships (no
 * spaces after the commas). Anything that does not match is left alone and
 * counted, so a stylesheet that stops looking like this is reported instead of
 * silently half-rewritten. */
function inlineFonts(css, dist) {
  const seen = [];
  const missing = [];
  const out = css.replace(
    /url\(fonts\/([\w.-]+)\.woff2\) format\("woff2"\),url\(fonts\/[\w.-]+\.woff\) format\("woff"\),url\(fonts\/[\w.-]+\.ttf\) format\("truetype"\)/g,
    (whole, base) => {
      const face = dist['package/dist/fonts/' + base + '.woff2'];
      if (!face) { missing.push(base); return whole; }
      seen.push(base);
      return 'url(data:font/woff2;base64,' + face.toString('base64') + ') format("woff2")';
    }
  );
  return { css: out, faces: seen.length, missing };
}

function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function kb(n) { return (n / 1024).toFixed(0) + 'KB'; }

function build(dist) {
  const { css, faces, missing } = inlineFonts(dist['package/dist/katex.min.css'].toString('utf8'), dist);
  const files = { 'katex.min.css': Buffer.from(css, 'utf8') };
  for (const w of WANTED) if (w.out !== 'katex.min.css') files[w.out] = Buffer.from(dist[w.tar]);
  return { files, faces, missing };
}

function main() {
  const argv = process.argv.slice(2);
  const check = argv.includes('--check');
  const fromIdx = argv.indexOf('--from');
  const from = fromIdx >= 0 ? argv[fromIdx + 1] : null;

  let dist;
  if (from) {
    dist = {};
    for (const w of WANTED) dist[w.tar] = fs.readFileSync(path.join(from, w.tar.replace('package/dist/', '')));
    for (const f of fs.readdirSync(path.join(from, 'fonts'))) {
      if (f.endsWith('.woff2')) dist['package/dist/fonts/' + f] = fs.readFileSync(path.join(from, 'fonts', f));
    }
    console.log(`vendor-katex: reading an extracted dist at ${from}`);
  } else {
    if (typeof fetch !== 'function') throw new Error('vendor-katex: no global fetch — use --from DIR');
    console.log(`vendor-katex: fetching ${TARBALL}`);
    /* fetch is synchronous-looking only because main() is; execFileSync in the
       gates never calls this. Make the await work by doing the whole job in a
       promise and exiting non-zero on failure. */
    return fetch(TARBALL)
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then((ab) => run(untar(Buffer.from(ab)), check))
      .catch((e) => { console.error('vendor-katex: ' + e.message); process.exit(1); });
  }
  return run(dist, check);
}

function run(dist, check) {
  for (const w of WANTED) {
    if (!dist[w.tar]) { console.error(`vendor-katex: ${w.tar} is missing from the tarball`); process.exit(1); }
  }
  const { files, faces, missing } = build(dist);
  if (missing.length) {
    console.error(`vendor-katex: ${missing.length} @font-face declaration(s) did not match — ` +
      `the stylesheet format changed:\n  ${missing.slice(0, 4).join('\n  ')}`);
    process.exit(1);
  }

  const total = Object.values(files).reduce((a, b) => a + b.length, 0);
  console.log(`vendor-katex: ${faces} faces inlined as woff2 data URIs, ${kb(total)} total`);
  for (const [name, buf] of Object.entries(files)) console.log(`  ${name}  ${kb(buf.length)}`);

  if (check) {
    const manifestPath = path.join(OUT, 'katex.manifest.json');
    if (!fs.existsSync(manifestPath)) { console.error('vendor-katex: nothing vendored yet — run without --check'); process.exit(1); }
    const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    let bad = 0;
    for (const [name, buf] of Object.entries(files)) {
      const onDisk = fs.existsSync(path.join(OUT, name)) ? fs.readFileSync(path.join(OUT, name)) : null;
      const want = sha256(buf);
      if (!onDisk || sha256(onDisk) !== want) {
        console.error(`  DRIFT ${name} — on disk ${onDisk ? sha256(onDisk).slice(0, 12) : 'missing'}, ` +
          `tarball says ${want.slice(0, 12)}`);
        bad++;
      } else if (m.files[name] && m.files[name].sha256 !== want) {
        console.error(`  DRIFT ${name} — manifest says ${m.files[name].sha256.slice(0, 12)}`);
        bad++;
      } else {
        console.log(`  ok    ${name}`);
      }
    }
    console.log(bad ? `vendor-katex: ${bad} file(s) do not match katex@${KATEX_VERSION}` :
      `vendor-katex: OK — public/vendor/katex is katex@${KATEX_VERSION}`);
    return process.exit(bad ? 1 : 0);
  }

  fs.mkdirSync(OUT, { recursive: true });
  const manifest = { version: KATEX_VERSION, source: TARBALL, faces, files: {} };
  for (const [name, buf] of Object.entries(files)) {
    fs.writeFileSync(path.join(OUT, name), buf);
    manifest.files[name] = { bytes: buf.length, sha256: sha256(buf) };
  }
  fs.writeFileSync(path.join(OUT, 'katex.manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(OUT, 'README.md'), readme(manifest));
  console.log(`vendor-katex: wrote public/vendor/katex (katex@${KATEX_VERSION}, ${kb(total)})`);
  return process.exit(0);
}

function readme(manifest) {
  const rows = Object.entries(manifest.files)
    .map(([n, f]) => `| \`${n}\` | ${(f.bytes / 1024).toFixed(0)}KB | \`${f.sha256.slice(0, 16)}…\` |`)
    .join('\n');
  return `# public/vendor/katex — Vendored KaTeX, inlined into maths clips

KaTeX \`${manifest.version}\`, from \`${manifest.source}\`, with all
${manifest.faces} @font-face rules rewritten to carry their **woff2 face as a
base64 data URI** and their woff/ttf fallbacks dropped.

| file | size | sha256 |
| --- | --- | --- |
${rows}

## Why the CSS is not the published one

The published \`katex.min.css\` points at 20 faces × 3 formats sitting in a
\`fonts/\` directory beside it. A reel clip is a self-contained HTML fragment
that may be exported to a bare file and opened with no server, so a sibling
directory is exactly what it cannot have. woff2 is supported by every browser
this app runs in, so the two older formats are pure weight. Inlining the faces
costs ~350KB of text and removes the directory from the problem entirely.

## How a clip uses it

\`reel-compile.cjs\` reads these three files and hands them to the emitter as
\`sb.math\`, which splices them into the clip's html as one inline \`<style>\` and
two \`<script src="data:text/javascript;base64,…">\` tags. The scripts are data:
URLs rather than inline scripts on purpose: \`hic-frame.js\` mounts clip html with
\`innerHTML\`, and **scripts inserted that way never execute** — only external
\`<script src>\` tags are hoisted and run. A data: URL is external, so the same
markup works through the renderer *and* from \`file://\` (verified in headless
Chrome).

\`design.math.src\` selects the renderer per film:

- *(unauthored)* → \`vendor/katex\`, i.e. this folder: inlined, offline, the default.
- \`cdn:jsdelivr katex@…\` → the old three CDN tags; reported as informational, not failed.
- empty → a hard failure for a film with \`latex\` elements, because an empty
  \`src\` is exactly what an offline export renders as raw \`$$…$$\`.

## Regenerate / update

\`\`\`bash
node automation/studio-reel/vendor-katex.cjs            # fetch the pinned tarball from npm
node automation/studio-reel/vendor-katex.cjs --check    # has anything here drifted?
\`\`\`

Bump \`KATEX_VERSION\` in \`automation/studio-reel/vendor-katex.cjs\` to move
versions — the pin is deliberate, so two checkouts compile a film to the same
clip. \`--from DIR\` takes an already-extracted \`dist/\` for an offline machine.
`;
}

main();
