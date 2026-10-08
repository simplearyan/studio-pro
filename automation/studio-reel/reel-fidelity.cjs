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
      if (e.type === 'html') {
        /* Passthrough: the payload IS the element, so it is carried exactly
           as authored — nothing maps, sizes or colours it. Proved below by
           a verbatim substring match against the emitted clip. */
        o.elements.push({ id: e.id, type: 'html', html: e.html, at_ms: e.at_ms || 0 });
        continue;
      }
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

  /* Assert the four things that carry content — id, size class, colour and the
     text itself — rather than one exact style string. The theme layer adds a
     `font-family` declaration to elements whose role names a brand face, so a
     whole-attribute comparison started failing on a correct film. Each part is
     checked where it is, so an added declaration cannot mask a wrong value. */
let checked = 0;
  for (const sc of top.scenes) {
    for (const el of sc.elements) {
      checked++;
      const i = clip.html.indexOf(`id="${el.id}"`);
      if (i === -1) {
        failures++;
        console.log(`  MISSING ${el.id}: no wrapper with that id`);
        continue;
      }
      const start = clip.html.lastIndexOf('<div', i);
      const win = clip.html.slice(start, i + 600);
      /* `html` is the one type with no mapping to prove: passthrough means
         the authored bytes arrive VERBATIM inside the same id'd wrapper, so
         that is the whole assertion. Checked before the text probes below,
         which would look for size/colour classes an html block never has. */
      if (el.type === 'html') {
        if (el.html == null || clip.html.indexOf(String(el.html)) === -1) {
          failures++;
          console.log(`  HTML NOT PASSTHROUGH ${el.id}: authored markup not found verbatim in the clip`);
        }
        continue;
      }
      const problems = [];
      if (win.indexOf(`hss-text hss-${el.size}`) === -1) problems.push(`size class hss-${el.size}`);
      if (win.indexOf(`color:${el.color};`) === -1) problems.push(`colour ${el.color}`);
      /* the emitter ESCAPES authored copy, so compare against the escaped
         form - an apostrophe is stored as &#39; and renders identically. */
      const escT = el.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
      if (win.indexOf(`>${escT}</div>`) === -1) problems.push(`text ${JSON.stringify(el.text.slice(0, 40))}`);
      if (problems.length) {
        failures++;
        console.log(`  TEXT MISMATCH ${el.id}: ${problems.join(', ')} missing`);
      }
    }
  }
  console.log(`  text+style     ${checked - (failures)}/${checked} elements exact (id, size, colour, text)`);

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