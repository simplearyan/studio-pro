/**
 * reel-compile.cjs — R1 step 1: storyboard.json → emitter contract → clip.
 *
 * The authoring IR in films/<film>/storyboard.json is written in the plan's
 * §3.5 shape, which is richer than the emitter and, more importantly, uses
 * FIELD NAMES for the things they share. compileStoryboard() reads:
 *
 *     sb.title, sb.aspect, sb.total_duration_ms
 *     sb.scenes[].start_ms / .end_ms / .elements[]
 *     sc.elements[].id / .type / .at_ms / .in
 *     sc.elements[].in.start_ms / .dur_ms / .from_x / .from_y / .overshoot / .stagger_ms
 *
 * The IR has meta.title, meta.aspect, meta.duration (seconds) and per-scene
 * start/dur (seconds). Fed to the emitter unchanged it does NOT throw — it
 * returns dur=NaN and name='Storyboard', which is worse than an error because
 * a NaN duration is a clip with no length.
 *
 * So this script does the reconciliation in ONE place rather than checking in a
 * second hand-maintained JSON that can drift from the first. Steps:
 *
 *   1. read the authoring IR
 *   2. lift meta.* to the top level, convert seconds → ms, map role → size
 *   3. split elements into what the emitter can BUILD and what it cannot
 *   4. compile, then assert the clip is structurally sound
 *   5. print the deferred inventory and exit NON-ZERO while it is non-empty
 *
 * Step 5 is the honest gate. The emitter's buildElHtml() has no `default` case,
 * so an element type it does not know silently emits `<div class="hss-el" id=…
 * ></div>` — an empty div, no warning, no error. Half of this film's 22
 * elements are types the emitter has never heard of, and a green exit code
 * over a reel missing them is exactly the failure R1 exists to prevent. The
 * script therefore fails while the inventory is non-empty, and names every
 * item, so the remaining work is enumerated rather than discovered.
 *
 * Usage:
 *   node automation/studio-reel/reel-compile.cjs                 # compile + gate
 *   node automation/studio-reel/reel-compile.cjs --write-clip    # also emit .reel-clip.json
 *   node automation/studio-reel/reel-compile.cjs --write-html    # also emit a standalone reel page
 *   node automation/studio-reel/reel-compile.cjs --only <film>   # pick one film
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');
const EMITTER = path.join(ROOT, 'docs/html-in-canvas/hic-storyboard.js');

/* Element types buildElHtml() actually has a `case` for. Anything else falls
 * through the switch with inner='' and emits an empty wrapper. Read off the
 * emitter's switch, not from the docs — this is the contract that matters. */
const BUILDABLE = new Set(['text', 'latex', 'answer', 'cards', 'image', 'shape']);

/* Classes that exist in RUNTIME_CSS. e.size becomes .hss-<size>, so a size
 * outside this set silently loses its font-size. hss-title is the largest the
 * runtime offers at 22px. */
const SIZES = new Set(['title', 'sub', 'body']);

/* role → emitter size. The film wants a 104px display title; the runtime's
 * largest is 22px. Mapping kicker→title and title→title both is honest here —
 * both are the "tracked, weighted" class — but it means the kicker and the
 * title render identically, which is a fidelity loss, not a design choice. */
const ROLE_SIZE = { kicker: 'title', title: 'title', lead: 'body' };

/* tone → token → hex. The IR's tones are semantic; the emitter takes a literal
 * colour per element and has no tone concept. */
const TONE_HEX = { normal: '#f8fafc', alarm: '#fb7185', positive: '#34d399' };
const DEFAULT_HEX = '#f8fafc';

/* Why each type cannot be expressed, in the emitter's terms. */
const DEFER_REASON = {
  stat: 'gradient-filled numeral over an 18px caption, stacked. The emitter\'s text is one size and one colour, with no background-clip: text.',
  card: 'panel + numeral + caption + an independently animated meter bar. The emitter\'s cards is a row of 56x78 tiles carrying one label each.',
  tiles: 'a 2x2 grid of emoji glyph + 28px head + 18px body. The emitter has no grid layout and no emoji.',
  pills: 'a row of outlined 100px-radius chips. The emitter\'s cards are filled tiles with a drop shadow.',
  credit: 'an absolutely positioned footer. The emitter lays every scene out as one centred flex column (.hss-scene) and has no footer slot.',
};

/* Recursively find which authored fields the emitter never reads. Kept as data
 * so the note cannot rot into a claim: every one of these is present in the IR
 * and provably discarded by the emitter. */
const IGNORED_BY_EMITTER = [
  'tokens (the emitter has no token resolver; colours are literals per element)',
  'frame  (design space, safe areas, type ramp — the emitter is stage-relative and hardcodes its own type ramp)',
  'scenes[].background (one flat sb.background for the WHOLE reel; the film has four different gradients)',
  'scenes[].ambient (no decorative-layer concept at all — 3 layers in this film)',
  'scenes[].exit, scenes[].tone, scenes[].frame',
  'elements[].in.ease (the runtime hardcodes three curves: _eo ease-out, _eb back, else fade. Every cubic-bezier in the IR is discarded)',
  'elements[].in.type "slot" (falls through to the fade branch, losing from_scale)',
  'elements[].role, .place, .meter, .value, .label, .max_width, .big, .small, .items, .columns, .width, .gap',
];

function reconcile(sb) {
  const deferred = [];
  const scenes = [];
  const warnings = [];

  const top = {
    title: sb.meta.title,
    id: sb.meta.id,
    aspect: sb.meta.aspect,
    fps: sb.meta.fps,
    total_duration_ms: Math.round(sb.meta.duration * 1000),
  };

  for (const sc of sb.scenes) {
    const out = {
      id: sc.id,
      start_ms: Math.round(sc.start * 1000),
      end_ms: Math.round((sc.start + sc.dur) * 1000),
      elements: [],
    };
    if (sc.background) {
      warnings.push(`${sc.id}: background ignored — the emitter takes one flat sb.background for the whole reel`);
    }
    if (sc.ambient && sc.ambient.length) {
      warnings.push(`${sc.id}: ${sc.ambient.length} ambient layer(s) ignored — no decorative-layer concept`);
    }
    for (const e of sc.elements) {
      if (!BUILDABLE.has(e.type)) {
        deferred.push({ scene: sc.id, id: e.id, type: e.type, reason: DEFER_REASON[e.type] || 'no emitter case' });
        continue;
      }
      const el = { id: e.id, type: e.type, at_ms: e.at_ms || 0 };
      if (e.type === 'text') {
        const size = ROLE_SIZE[e.role] || 'body';
        if (!SIZES.has(size)) warnings.push(`${e.id}: unknown size "${size}"`);
        el.size = size;
        el.color = TONE_HEX[sc.tone] || DEFAULT_HEX;
        el.text = e.text;
      }
      if (e.in) {
        el.in = { type: e.in.type };
        if (e.in.from_x !== undefined) el.in.from_x = e.in.from_x;
        if (e.in.from_y !== undefined) el.in.from_y = e.in.from_y;
        if (e.in.overshoot !== undefined) el.in.overshoot = e.in.overshoot;
        if (e.in.stagger_ms !== undefined) el.in.stagger_ms = e.in.stagger_ms;
        el.in.start_ms = e.in.start_ms || 0;
        el.in.dur_ms = e.in.dur_ms || 600;
      }
      out.elements.push(el);
    }
    scenes.push(out);
  }

  return { top: Object.assign(top, { scenes }), deferred, warnings };
}

function loadEmitter() {
  const src = fs.readFileSync(EMITTER, 'utf8');
  const shim = { exports: {} };
  vm.runInNewContext(src, { module: shim, console, require, window: {}, document: {} }, { filename: 'hic-storyboard.js' });
  return shim.exports;
}

function main() {
  const argv = process.argv.slice(2);
  const writeClip = argv.includes('--write-clip');
  const writeHtml = argv.includes('--write-html');
  const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;

  const filmsDir = path.join(__dirname, 'films');
  const films = fs.readdirSync(filmsDir).filter((d) => fs.existsSync(path.join(filmsDir, d, 'storyboard.json')) && (!only || d === only));
  if (!films.length) {
    console.error('reel-compile: no film with a storyboard.json found');
    return 2;
  }

  const { compileStoryboard, buildStandalonePage } = loadEmitter();
  let failed = 0;

  for (const film of films) {
    const dir = path.join(filmsDir, film);
    const sb = JSON.parse(fs.readFileSync(path.join(dir, 'storyboard.json'), 'utf8'));
    console.log(`\n=== ${film} ===`);

    const { top, deferred, warnings } = reconcile(sb);

    // ── gate 1: the clip must have a real duration and name ──────────────
    const clip = compileStoryboard(top);
    const structural = [];
    if (!Number.isFinite(clip.dur) || clip.dur <= 0) structural.push(`dur is ${clip.dur} — the clip has no length`);
    if (clip.dur !== sb.meta.duration) structural.push(`dur ${clip.dur}s != authored ${sb.meta.duration}s`);
    if (clip.name !== sb.meta.title) structural.push(`name "${clip.name}" != authored "${sb.meta.title}"`);
    const scenesEmitted = (clip.html.match(/hss-scene/g) || []).length;
    if (scenesEmitted !== top.scenes.length) structural.push(`${scenesEmitted} scenes emitted, ${top.scenes.length} authored`);

    // ── gate 2: every element in the compiler's path must render ─────────
    // Counts non-empty hss-text children. An empty wrapper means buildElHtml
    // fell through its switch. buildElHtml emits
    //   <div class="hss-text hss-<size>" style="color:…">TEXT</div>
    // so the style attribute sits between the class and the content — the
    // pattern must span it, or a correctly-rendered element reads as blank.
    const inPath = top.scenes.reduce((a, s) => a + s.elements.length, 0);
    const rendered = (clip.html.match(/<div class="hss-text[^"]*"[^>]*>[^<]+<\/div>/g) || []).length;
    if (rendered !== inPath) structural.push(`${rendered}/${inPath} in-path elements rendered text; the rest fell through buildElHtml`);

    // ── gate 3: the scene timeline must actually cover the clip ─────────
    // Found by running this gate against a deliberately broken film: a scene
    // starting at 9000ms inside a 4000ms clip compiled clean and rendered
    // nothing at all, because onFrame clamps at SB.total and never reaches it.
    // The emitter does not validate this, so neither does the count above.
    const total = top.total_duration_ms;
    const sorted = top.scenes.slice().sort((a, b) => a.start_ms - b.start_ms);
    sorted.forEach((s) => {
      if (s.start_ms < 0) structural.push(`${s.id}: starts at ${s.start_ms}ms, before the clip begins`);
      if (s.end_ms <= s.start_ms) structural.push(`${s.id}: end_ms ${s.end_ms} is not after start_ms ${s.start_ms} — zero or negative length`);
      if (s.end_ms > total) structural.push(`${s.id}: ends at ${s.end_ms}ms but the clip is ${total}ms — the last ${s.end_ms - total}ms is unreachable`);
    });
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      if (sorted[i].start_ms < prev.end_ms) {
        structural.push(`${prev.id} and ${sorted[i].id} overlap by ${prev.end_ms - sorted[i].start_ms}ms`);
      } else if (sorted[i].start_ms > prev.end_ms) {
        warnings.push(`dead air: ${sorted[i].id} starts ${sorted[i].start_ms - prev.end_ms}ms after ${prev.id} ends`);
      }
    }

    const authored = sb.scenes.reduce((a, s) => a + s.elements.length, 0);
    console.log(`  clip           name="${clip.name}" dur=${clip.dur}s ds=${clip.ds}`);
    console.log(`  scenes         ${scenesEmitted}/${top.scenes.length} emitted`);
    console.log(`  elements       ${rendered} rendered, ${deferred.length} deferred, ${authored} authored`);
    console.log(`  round trip     ${rendered + deferred.length}/${authored} accounted for`);

    if (structural.length) {
      console.log('  STRUCTURAL FAIL:');
      for (const w of structural) console.log(`    - ${w}`);
      failed++;
    } else {
      console.log('  structural     OK — duration, name, scene count and every in-path element check out');
    }

    if (warnings.length) {
      console.log(`  author-authored but discarded (${warnings.length}):`);
      for (const w of warnings) console.log(`    - ${w}`);
    }

    if (deferred.length) {
      console.log(`  DEFERRED — the emitter has no case for these (${deferred.length}):`);
      for (const d of deferred) console.log(`    - ${d.scene}/${d.id}  ${d.type}: ${d.reason}`);
      console.log('  authored-but-ignored fields (informational):');
      for (const g of IGNORED_BY_EMITTER) console.log(`    - ${g}`);
      failed++;
    }

    if (writeClip) {
      const outFile = path.join(dir, 'reel-clip.json');
      fs.writeFileSync(outFile, JSON.stringify({ name: clip.name, dur: clip.dur, ds: clip.ds, html: clip.html, css: clip.css, js: clip.js }, null, 2));
      console.log(`  wrote          ${path.relative(ROOT, outFile)}`);
    }
    if (writeHtml) {
      // A clip that passes every structural gate but renders nothing is still
      // a failure, so the standalone page is the artefact to actually look at.
      const outFile = path.join(dir, 'reel-preview.html');
      fs.writeFileSync(outFile, buildStandalonePage(top));
      console.log(`  wrote          ${path.relative(ROOT, outFile)}`);
    }
  }

  console.log('');
  if (failed) {
    console.error(`reel-compile: FAILED (${failed}) — the IR compiles structurally, but the emitted clip is NOT the reference film.`);
    return 1;
  }
  console.log('reel-compile: OK — every authored element compiled.');
  return 0;
}

process.exit(main());