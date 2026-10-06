/**
 * reel-fidelity.cjs — proves the reconciliation is LOSSLESS for what it maps.
 *
 * reel-compile.cjs maps role→size, tone→hex and seconds→ms. A mapping can be
 * structurally valid and still quietly corrupt the film: a truncated string, a
 * size that lands on an undefined class, an off-by-one that shifts a scene by
 * one frame. This checks the two things that actually carry content —
 *
 *   1. every in-path element appears in the emitted html with its EXACT id,
 *      size, colour and text (plain substring match, no regex — the text
 *      contains em dashes, slashes and %, and an escaped pattern would be a
 *      second thing that can be wrong)
 *   2. every scene's start_ms/end_ms survive into the clip's own storyboard
 *      literal, which is what onFrame(t) actually reads
 *
 * This is a companion to reel-compile.cjs, not a replacement: that one gates
 * the pipeline, this one proves the gate is not lying about the content.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');
const EMITTER = path.join(ROOT, 'docs/html-in-canvas/hic-storyboard.js');

const SIZE = { kicker: 'title', title: 'title', lead: 'body' };
const HEX = { normal: '#f8fafc', alarm: '#fb7185', positive: '#34d399' };

function loadEmitter() {
  const src = fs.readFileSync(EMITTER, 'utf8');
  const shim = { exports: {} };
  vm.runInNewContext(src, { module: shim, console, require, window: {}, document: {} }, { filename: 'hic-storyboard.js' });
  return shim.exports;
}

function reconcile(sb) {
  const top = {
    title: sb.meta.title,
    aspect: sb.meta.aspect,
    total_duration_ms: Math.round(sb.meta.duration * 1000),
    scenes: [],
  };
  for (const sc of sb.scenes) {
    const o = {
      id: sc.id,
      start_ms: Math.round(sc.start * 1000),
      end_ms: Math.round((sc.start + sc.dur) * 1000),
      elements: [],
    };
    for (const e of sc.elements) {
      if (e.type !== 'text') continue;
      o.elements.push({
        id: e.id, type: 'text',
        size: SIZE[e.role] || 'body',
        color: HEX[sc.tone] || '#f8fafc',
        text: e.text, at_ms: e.at_ms || 0,
      });
    }
    top.scenes.push(o);
  }
  return top;
}

let failures = 0;
const filmsDir = path.join(__dirname, 'films');
const films = fs.readdirSync(filmsDir).filter((d) => fs.existsSync(path.join(filmsDir, d, 'storyboard.json')));
const { compileStoryboard } = loadEmitter();

for (const film of films) {
  const sb = JSON.parse(fs.readFileSync(path.join(filmsDir, film, 'storyboard.json'), 'utf8'));
  const top = reconcile(sb);
  const clip = compileStoryboard(top);
  console.log(`\n=== ${film} ===`);

  let checked = 0;
  for (const sc of top.scenes) {
    for (const el of sc.elements) {
      checked++;
      const want = `<div class="hss-el" id="${el.id}"><div class="hss-text hss-${el.size}" style="color:${el.color}">${el.text}</div>`;
      if (clip.html.indexOf(want) === -1) {
        failures++;
        console.log(`  TEXT MISMATCH ${el.id}: expected ${JSON.stringify(want.slice(0, 110))}`);
      }
    }
  }
  console.log(`  text+style     ${checked - (failures)}/${checked} elements byte-exact (id, size, colour, text)`);

  // the literal onFrame(t) reads back out of the emitted js
  const m = clip.js.match(/var SB = (\{[\s\S]*?\});/);
  if (!m) {
    failures++;
    console.log('  TIMING: could not find the SB literal in the emitted js');
  } else {
    const lit = JSON.parse(m[1]);
    let tok = true;
    if (lit.total !== top.total_duration_ms) {
      tok = false;
      console.log(`  TIMING MISMATCH: clip total ${lit.total} != authored ${top.total_duration_ms}`);
    }
    top.scenes.forEach((sc, i) => {
      const L = lit.scenes[i];
      if (!L || L.s !== sc.start_ms || L.e !== sc.end_ms) {
        tok = false;
        console.log(`  TIMING MISMATCH ${sc.id}: literal ${L && L.s}/${L && L.e} vs authored ${sc.start_ms}/${sc.end_ms}`);
      }
    });
    if (tok) console.log(`  scene timing   ${top.scenes.length}/${top.scenes.length} scenes exact, total ${lit.total}ms`);
    if (!tok) failures++;
  }
}

console.log('');
if (failures) {
  console.error(`reel-fidelity: FAILED (${failures}) — the reconciled IR did not survive into the clip intact.`);
  process.exit(1);
}
console.log('reel-fidelity: OK — every mapped element and every scene boundary survived intact.');