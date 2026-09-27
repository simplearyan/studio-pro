#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
 * sync-presets.mjs — mirror automation/meta/clips/* into test-renderer's
 * PRESETS gallery, between the [meta-presets] markers.
 *
 * The OG card designs live in automation/meta/clips/ as ES modules (single
 * source of truth for the render pipeline). This script compiles them into
 * self-contained preset entries so the same designs appear in the gallery
 * as playable, scrubable, exportable presets.
 *
 *   node automation/meta/sync-presets.mjs          # sync + report
 *   node automation/meta/sync-presets.mjs --check  # exit 1 if out of date
 *
 * The generated block is deterministic → safe for --check in CI.
 * ═══════════════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TR = resolve(__dirname, '..', '..', 'docs', 'html-in-canvas', 'test-renderer.html');

/* beginPrefix matches old/broken blocks too; the written marker ALWAYS
 * carries its closing comment delimiter — an unterminated comment here
 * silently swallows every entry after it (burned once: the favicon/og
 * entries vanished from the object literal and the page script broke). */
/* BOTH markers must be pure comments: they sit INSIDE the PRESETS object
 * literal, so a bare leading '[' (like the end marker used to start with)
 * parses as a computed property key with a regex inside — and V8 reports
 * the blowup at the object's closing brace, miles from the real cause.
 * Never write the literal closing-comment delimiter inside these comments. */
const MARKS = {
    beginPrefix: '/* [meta-presets]',
    full: '/* [meta-presets] GENERATED — do not hand-edit inside this block. Regenerate: node automation/meta/sync-presets.mjs */',
    end: '/* [/meta-presets] */',
};

/* ─── Compile a clip module into a PRESETS entry source ────────────────── */

function presetSource(key, mod) {
    const name = mod.galleryName || key.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    // CRITICAL: skip title/desc/ds/dur COMMENT markers — the AI tab treats
    // them as directive-bearing replies, and pasting a preset via Copy code
    // → AI tab would re-apply the clip as a "reply". Gallery presets carry
    // their real <title> inside html (TR backfills it anyway).
    const strip = (s) => String(s).replace(/^\s*<!--\s*(title|desc|ds|dur):[\s\S]*?-->\s*$/gm, '');
    const html = strip(mod.html), css = strip(mod.css), js = strip(mod.js);

    const q = (s) => JSON.stringify(s);
    return [
        `    '${key}': {`,
        `        name: ${q(name)}, cat: 'meta', dur: ${Number(mod.dur) || 5}, ds: ${q(mod.ds || '16:9')},`,
        `        /* ${name} — mirrored from automation/meta/clips/${key.replace('og-', 'og-')}.js (source of truth; regen via sync-presets.mjs) */`,
        `        html: ${q(html)},`,
        `        css: ${q(css)},`,
        `        js: ${q(js)}`,
        '    },',
    ].join('\n');
}

/* The generated block sits INSIDE the PRESETS object literal, so whatever
 * entry precedes it must end with a comma. Idempotent: appends ',' only when
 * the last non-whitespace char is '}' (never doubles an existing comma). */
function ensureTrailingComma(text) {
    const trimmed = text.replace(/\s+$/, '');
    const last = trimmed.slice(-1);
    if (last === ',' || last === '{') return text;                 // already fine / table open
    if (last === '}') return trimmed + ',\n';                      // last entry needs a comma
    return text;
}

async function main() {
    const clipFiles = readdirSync(resolve(__dirname, 'clips')).filter(f => f.endsWith('.js'));
    const blocks = [];
    for (const f of clipFiles) {
        const mod = await import(pathToFileURL(resolve(__dirname, 'clips', f)));
        const key = f.replace(/\.js$/, '');
        blocks.push(presetSource(key, mod));
    }
    const generated = [
        MARKS.full,
        ...blocks,
        MARKS.end,
    ].join('\n');

    const src = readFileSync(TR, 'utf8');
    const beginIdx = src.indexOf(MARKS.beginPrefix);
    const endIdx = src.indexOf(MARKS.end);

    if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
        const before = ensureTrailingComma(src.slice(0, beginIdx));
        const after = src.slice(endIdx + MARKS.end.length);
        const next = before + generated + after;
        if (src === next) { console.log('• presets already in sync'); return; }
        if (process.argv.includes('--check')) { console.error('✗ presets out of date — run: node automation/meta/sync-presets.mjs'); process.exit(1); }
        writeFileSync(TR, next);
        console.log(`✓ synced ${blocks.length} meta preset(s) into ${TR.replace(/^.*[\\/]/, '')}`);
        return;
    }

    // First run: inject a trailing entry before the closing `};` of PRESETS.
    const anchor = src.indexOf('const PRESETS = {');
    if (anchor === -1) throw new Error('PRESETS table not found in test-renderer.html');
    const closeIdx = src.indexOf('\n};', anchor);
    if (closeIdx === -1) throw new Error('PRESETS closing brace not found');
    const injection = '\n' + generated + '\n';
    const next = ensureTrailingComma(src.slice(0, closeIdx + 1)) + injection + src.slice(closeIdx + 1).replace(/^\r?\n/, '');
    if (process.argv.includes('--check')) { console.error('✗ markers missing (first sync needed)'); process.exit(1); }
    writeFileSync(TR, next);
    console.log(`✓ injected ${blocks.length} meta preset(s) into PRESETS (markers created)`);
}

main().catch(e => { console.error('✗ sync-presets failed:', e.message); process.exit(1); });
