#!/usr/bin/env node
/**
 * reel-style.cjs — the style report (Track V1): one informational gate that
 * answers "what does each film actually look like?" in numbers.
 *
 * The variety diagnosis in docs/automation/STUDIO-REEL-VARIETY-AND-EXPORT-PLAN.md
 * §2 was assembled by hand from exactly these fields; this gate makes the
 * report repeatable. What is measured gets authored — but nothing here can
 * FAIL a film for being uniform (variety is authored vocabulary, never a
 * loosened gate — plan §2). The only failure mode is an unreadable storyboard.
 *
 * Per film: scene count, frame archetypes (scene.frame), element census,
 * entrance mix, authored eases, exits, tone mix, type ramp families.
 * Then a corpus summary: what is used, what sits idle (image 0/8, chart 1/8),
 * how many eases out of the library are ever authored, exits total.
 *
 * Usage: node automation/studio-reel/reel-style.cjs [--json]
 * Exit: 0 report printed · 1 a storyboard failed to parse
 */
'use strict';

const fs = require('fs');
const path = require('path');

const FILMS_DIR = path.join(__dirname, 'films');
const asJson = process.argv.includes('--json');

/* Known idle capabilities (plan §2) — reported, never failed. */
const IDLE_CAPS = { image: 'image', chart: 'chart' };

function tally(map, key, n = 1) { map[key] = (map[key] || 0) + n; }
function sortedEntries(map) { return Object.entries(map).sort((a, b) => b[1] - a[1]); }
function top(map, n = 6) { return sortedEntries(map).slice(0, n).map(([k, v]) => `${k} ${v}`).join(', '); }

function readFilm(dir) {
  const file = path.join(FILMS_DIR, dir, 'storyboard.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function filmReport(name, sb) {
  const r = {
    name,
    scenes: (sb.scenes || []).length,
    archetypes: {},          // scene.frame — the composition vocabulary
    tones: {},               // scene.tone
    types: {},               // element.type census
    entrances: {},           // element.in.type
    eases: {},               // element.in.ease
    exits: {},               // element.out.type — plan P1 wants these authored
    layouts: {},             // scene.layout — V2's field (0 until shipped)
    families: {},            // type ramp families (design.frame.ramp[*].family)
    aspect: '?',
    seconds: 0,
    htmlEls: 0,
  };
  const ds = sb.frame && sb.frame.design_space;
  if (ds && ds.w && ds.h) r.aspect = `${ds.w}x${ds.h}`;
  const ramp = (sb.frame && sb.frame.ramp) || {};
  for (const role of Object.keys(ramp)) {
    if (ramp[role] && ramp[role].family) tally(r.families, ramp[role].family);
  }
  for (const sc of sb.scenes || []) {
    tally(r.archetypes, sc.frame || '(none)');
    tally(r.tones, sc.tone || '-');
    tally(r.layouts, sc.layout || '(none)');
    r.seconds += Number(sc.dur) || 0; /* storyboard dur is SECONDS (6+7+7+6=26s), not ms */
    for (const e of sc.elements || []) {
      tally(r.types, e.type || '?');
      if (e.type === 'html') r.htmlEls++;
      if (e.in) {
        tally(r.entrances, e.in.type || '?');
        if (e.in.ease) tally(r.eases, e.in.ease);
      }
      if (e.out) tally(r.exits, e.out.type || JSON.stringify(e.out));
    }
  }
  return r;
}

function main() {
  let films;
  try {
    films = fs.readdirSync(FILMS_DIR)
      .filter((d) => fs.existsSync(path.join(FILMS_DIR, d, 'storyboard.json')));
  } catch (e) {
    console.error(`reel-style: cannot read films dir — ${e.message}`);
    return 1;
  }

  const reports = [];
  for (const f of films.sort()) {
    try {
      reports.push(filmReport(f, readFilm(f)));
    } catch (e) {
      console.error(`reel-style: FAIL ${f} — storyboard unreadable: ${e.message}`);
      return 1;
    }
  }

  if (asJson) {
    console.log(JSON.stringify(reports, null, 2));
    return 0;
  }

  /* ── per-film fingerprints ─────────────────────────────────────────── */
  console.log('style report — one line per film\n');
  const w = Math.max(...reports.map((r) => r.name.length));
  for (const r of reports) {
    const arch = sortedEntries(r.archetypes).length;
    const eases = sortedEntries(r.eases).length;
    console.log(
      `${r.name.padEnd(w)}  ${String(r.scenes).padStart(2)} scenes · ` +
      `${String(arch).padStart(2)} frame archetypes · ${r.seconds.toFixed(0)}s · ` +
      `in: ${top(r.entrances, 3)} · eases: ${eases} · exits: ${Object.keys(r.exits).length} · ` +
      `types: ${top(r.types, 4)}`
    );
  }

  /* ── corpus roll-up ───────────────────────────────────────────────── */
  const corpus = { archetypes: {}, types: {}, entrances: {}, eases: {}, exits: {}, layouts: {}, families: {}, tones: {} };
  const usedImage = new Set(), usedChart = new Set();
  let totalScenes = 0;
  for (const r of reports) {
    totalScenes += r.scenes;
    for (const [k, v] of Object.entries(r.archetypes)) tally(corpus.archetypes, k, v);
    for (const [k, v] of Object.entries(r.types)) tally(corpus.types, k, v);
    for (const [k, v] of Object.entries(r.entrances)) tally(corpus.entrances, k, v);
    for (const [k, v] of Object.entries(r.eases)) tally(corpus.eases, k, v);
    for (const [k, v] of Object.entries(r.exits)) tally(corpus.exits, k, v);
    for (const [k, v] of Object.entries(r.layouts)) tally(corpus.layouts, k, v);
    for (const [k, v] of Object.entries(r.families)) tally(corpus.families, k, v);
    for (const [k, v] of Object.entries(r.tones)) tally(corpus.tones, k, v);
    if (r.types.image) usedImage.add(r.name);
    if (r.types.chart) usedChart.add(r.name);
  }

  const n = reports.length;
  console.log(`\ncorpus — ${n} films, ${totalScenes} scenes`);
  console.log(`  frame archetypes : ${sortedEntries(corpus.archetypes).length} distinct — ${top(corpus.archetypes, 10)}`);
  console.log(`  element types    : ${top(corpus.types, 12)}`);
  console.log(`  entrances        : ${top(corpus.entrances, 6)}`);
  console.log(`  eases authored   : ${sortedEntries(corpus.eases).length} — ${top(corpus.eases, 6)}`);
  console.log(`  exits authored   : ${sortedEntries(corpus.exits).length === 0 ? 'NONE (plan P1 ships exits next)' : top(corpus.exits, 6)}`);
  console.log(`  scene.layout     : ${corpus.layouts['(none)'] === totalScenes ? `none yet (${totalScenes}/${totalScenes} unset — V2 adds split/grid/fullbleed/frame)` : top(corpus.layouts, 6)}`);
  console.log(`  tones            : ${top(corpus.tones, 6)}`);
  console.log(`  type families    : ${top(corpus.families, 8)}`);

  console.log('\nidle capabilities (plan §2 — report only):');
  console.log(`  image used by ${usedImage.size}/${n} films${usedImage.size ? ` (${[...usedImage].join(', ')})` : ''}`);
  console.log(`  chart used by ${usedChart.size}/${n} films${usedChart.size ? ` (${[...usedChart].join(', ')})` : ''}`);

  const aspects = new Set(reports.map((r) => r.aspect));
  console.log(`\nformats: ${[...aspects].join(', ')}${aspects.size === 1 ? ' — every film (V6 ships 9:16 and 1:1 cuts)' : ''}`);

  console.log('\nreel-style: report only — nothing here fails a film (variety is authored, not gated)');
  return 0;
}

process.exit(main());
