#!/usr/bin/env node
'use strict';

/**
 * audit-dead-code.cjs — re-runnable dead-code / orphan-file sweep.
 *
 * Built for the HTML-in-Canvas cleanup (docs/HTML-IN-CANVAS-DEAD-CODE-AUDIT.md)
 * so the same audit can be re-run after future changes. It is a HEURISTIC
 * REPORTER: it never deletes or modifies anything, and it always exits 0.
 *
 * Two reports:
 *   1. Unused editor globals — `window.NAME = …` and `function NAME(…)` definitions
 *      in the editor whose name occurs exactly once across all LIVE CODE (tracked
 *      code files, excluding `_archive/`, `dist/`, and docs). Counting repo-wide
 *      avoids flagging a `window.*` global that automation calls; excluding docs and
 *      `_archive/` avoids prose mentions and backups hiding a real orphan.
 *   2. Unreferenced tracked files — tracked files whose basename appears in no other
 *      tracked text file (docs included, because a doc link is a real reference).
 *
 * Usage:
 *   node tools/audit-dead-code.cjs [--editor index.html] [--json] [--all]
 *
 *   --editor <path>  file to scan for global definitions (default: index.html)
 *   --json           emit machine-readable JSON instead of the text report
 *   --all            do not truncate the lists
 *
 * Known limits (by design — verify before deleting anything):
 *   - A global referenced only via a string (`window['name']`) or reflection counts
 *     as unused; a recursive function counts as used.
 *   - Incidental same-token text (e.g. a comment mentioning the name) counts as a
 *     reference and can hide an orphan — open the hit before deleting.
 *   - A file loaded only via a directory glob or a path-free import (`./x`) looks
 *     unreferenced; so does a file whose basename is a common word.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── options ─────────────────────────────────────────────────────────────────
const opts = { editor: 'index.html', json: false, all: false };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--json') opts.json = true;
  else if (a === '--all') opts.all = true;
  else if (a === '--editor') opts.editor = argv[++i];
  else if (a === '-h' || a === '--help') { printHelp(); process.exit(0); }
  else { console.error('unknown option: ' + a + '\n'); printHelp(); process.exit(2); }
}

function printHelp() {
  console.log([
    'Usage: node tools/audit-dead-code.cjs [--editor index.html] [--json] [--all]',
    '',
    '  --editor <path>  file to scan for global definitions (default: index.html)',
    '  --json           machine-readable output',
    '  --all            do not truncate the lists',
  ].join('\n'));
}

// ── setup ───────────────────────────────────────────────────────────────────
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
process.chdir(root);

const CODE_EXT = new Set([
  '.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.html', '.htm', '.css',
  '.py', '.sh', '.ps1', '.json', '.yaml', '.yml', '.xml', '.svg',
]);
const ARCHIVE = /(^|\/)_archive\//;
const MAX_BYTES = 6 * 1024 * 1024;

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
}

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Count whole-token occurrences (`_`, `$`, letters, digits form the token). */
function countTokens(src, name) {
  const re = new RegExp('(^|[^A-Za-z0-9_$])' + esc(name) + '(?![A-Za-z0-9_$])', 'g');
  let n = 0;
  while (re.exec(src) !== null) n++;
  return n;
}

const RE_WINDOW = /window\.([A-Za-z_$][\w$]*)\s*=/g;
const RE_FN = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g;
// Named function expressions that are invoked immediately are not "unused".
const RE_IIFE = /^\s*[(!+~]\s*\(?\s*(?:async\s+)?function\b/;

const files = git(['ls-files', '-z']).split('\0').filter(Boolean);
const contents = new Map();   // file -> text (text files only)
const liveCode = [];          // text of live code files, for token counting
const allText = [];           // text of every text file, for file references

for (const f of files) {
  let buf;
  try { buf = fs.readFileSync(f); } catch (_) { continue; }
  if (buf.length > MAX_BYTES || buf.includes(0)) continue;   // skip huge / binary
  const s = buf.toString('utf8');
  contents.set(f, s);
  allText.push(s);
  const ext = path.extname(f).toLowerCase();
  if (CODE_EXT.has(ext) && !ARCHIVE.test(f) && !f.startsWith('dist/')) liveCode.push(s);
}

const codeCorpus = liveCode.join('\n');
const refCorpus = allText.join('\n');

// ── report 1: unused editor globals ─────────────────────────────────────────
function unusedGlobals(editorRel) {
  const abs = path.resolve(root, editorRel);
  if (!fs.existsSync(abs)) {
    return { editor: editorRel, error: 'not found', definitions: 0, unused: [] };
  }
  const src = fs.readFileSync(abs, 'utf8');
  const defs = new Map(); // name -> { line, iife }

  src.split(/\r?\n/).forEach((line, i) => {
    let m;
    RE_WINDOW.lastIndex = 0;
    while ((m = RE_WINDOW.exec(line)) !== null) {
      if (!defs.has(m[1])) defs.set(m[1], { line: i + 1, iife: false });
    }
    RE_FN.lastIndex = 0;
    while ((m = RE_FN.exec(line)) !== null) {
      if (!defs.has(m[1])) defs.set(m[1], { line: i + 1, iife: RE_IIFE.test(line) });
    }
  });

  const unused = [];
  let scanned = 0;
  for (const [name, info] of defs) {
    if (info.iife) continue;                       // invoked on the spot
    scanned++;
    const n = countTokens(codeCorpus, name);
    if (n <= 1) unused.push({ name, line: info.line, occurrences: n });
  }
  unused.sort((a, b) => a.line - b.line);
  return { editor: editorRel, definitions: scanned, unused };
}

// ── report 2: unreferenced tracked files ────────────────────────────────────
function unreferencedFiles() {
  const cache = new Map();
  const totalFor = (base) => {
    if (!cache.has(base)) cache.set(base, countTokens(refCorpus, base));
    return cache.get(base);
  };

  const unreferenced = [];
  for (const f of files) {
    const base = path.basename(f);
    const total = totalFor(base);
    const self = contents.has(f) ? countTokens(contents.get(f), base) : 0;
    if (total - self <= 0) unreferenced.push(f);
  }
  unreferenced.sort();
  return { tracked: files.length, scanned: contents.size, unreferenced };
}

// ── run ─────────────────────────────────────────────────────────────────────
const globals = unusedGlobals(opts.editor);
const orphans = unreferencedFiles();
const report = {
  generatedAt: new Date().toISOString(),
  root,
  editorGlobals: globals,
  trackedFiles: orphans,
};

if (opts.json) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const LIMIT = opts.all ? Infinity : 60;
const short = (p) => (p.startsWith(root) ? path.relative(root, p) : p);

console.log('Dead-code audit');
console.log('repo: ' + root);

if (globals.error) {
  console.log('\n== Unused editor globals ==\n  (' + globals.editor + ': ' + globals.error + ')');
} else {
  console.log('\n== Unused editor globals (' + globals.editor + ') ==');
  console.log('  definitions scanned (excluding IIFEs): ' + globals.definitions);
  console.log('  no other live-code reference: ' + globals.unused.length);
  globals.unused.slice(0, LIMIT).forEach((g) => {
    console.log('    - ' + g.name + '   (line ' + g.line + ')');
  });
  if (globals.unused.length > LIMIT) {
    console.log('    … ' + (globals.unused.length - LIMIT) + ' more (use --all)');
  }
}

console.log('\n== Unreferenced tracked files ==');
console.log('  tracked: ' + orphans.tracked + '   text-scanned: ' + orphans.scanned);
console.log('  no inbound reference: ' + orphans.unreferenced.length);
orphans.unreferenced.slice(0, LIMIT).forEach((f) => console.log('    - ' + short(f)));
if (orphans.unreferenced.length > LIMIT) {
  console.log('    … ' + (orphans.unreferenced.length - LIMIT) + ' more (use --all)');
}

console.log('\nReport only — nothing was changed.');
