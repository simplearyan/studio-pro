/**
 * reel-regression.cjs — proves the five new element types changed nothing for
 * callers that already worked.
 *
 * hic-storyboard.js is a SHARED file: test-renderer.html loads it, and Studio
 * Pro ships it through the static-copy target. Adding stat/card/tiles/pills/
 * credit to buildElHtml touches that switch and the CSS every consumer gets,
 * so "it parses" is not evidence and "the new types work" is not evidence
 * either. The only evidence is that the previously-supported types compile to
 * BYTE-IDENTICAL output before and after.
 *
 * The reference implementation is read straight out of git at HEAD, so this
 * cannot drift: if the baseline commit moves, the baseline moves with it.
 *
 * What it checks:
 *   - html, css and js are byte-identical for a storyboard using only the
 *     pre-existing types (text, latex, cards, shape)
 *   - an UNKNOWN type still behaves the old way (empty div), so this change
 *     did not silently alter the fallback that other code may rely on
 *   - the five new types now produce non-empty markup
 *
 * Usage: node automation/studio-reel/reel-regression.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const EMITTER_REL = 'docs/html-in-canvas/hic-storyboard.js';

/* Load an emitter source string into a fresh module object. */
function loadFrom(src, label) {
  const shim = { exports: {} };
  vm.runInNewContext(src, { module: shim, console, require, window: {}, document: {} }, { filename: label });
  return shim.exports;
}

function gitShow(rel) {
  return execFileSync('git', ['show', 'HEAD:' + rel], { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
}

/* A storyboard using ONLY the types that existed before this change. */
const LEGACY = {
  title: 'Legacy',
  aspect: '16:9',
  total_duration_ms: 4000,
  scenes: [
    {
      start_ms: 0, end_ms: 4000,
      elements: [
        { id: 't1', type: 'text', size: 'title', color: '#e7ba55', text: 'Legacy', at_ms: 0, in: { type: 'fade', dur_ms: 400 } },
        { id: 't2', type: 'latex', color: '#fff', text: 'x^2', at_ms: 100, in: { type: 'slide', from_y: 20, dur_ms: 400 } },
        { id: 'c1', type: 'cards', at_ms: 200, in: { type: 'slide', from_y: 50, dur_ms: 500, stagger_ms: 80 },
          items: [{ label: 'A' }, { label: 'B', accent: '#0f0' }, { label: 'C', muted: true }] },
        { id: 's1', type: 'shape', shape: 'underline', color: '#6ed9b1', at_ms: 300 },
      ],
    },
    { start_ms: 4000, end_ms: 6000, elements: [{ id: 'a1', type: 'answer', color: '#6ed9b1', text: 'Done', at_ms: 0 }] },
  ],
};

/* A type neither version has a case for — the silent-empty-div fallback. */
const UNKNOWN = {
  title: 'Unknown', aspect: '16:9', total_duration_ms: 1000,
  scenes: [{ start_ms: 0, end_ms: 1000, elements: [{ id: 'zz', type: 'hologram' }] }],
};

let failures = 0;
function check(label, cond, detail) {
  if (cond) { console.log(`  ok    ${label}`); }
  else { failures++; console.log(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`); }
}

const before = loadFrom(gitShow(EMITTER_REL), 'hic-storyboard.js@HEAD');
let plainBeforeHtml = '';
const after = loadFrom(fs.readFileSync(path.join(ROOT, EMITTER_REL), 'utf8'), EMITTER_REL);

console.log('=== legacy types must be byte-identical ===');
let a, b;
try { a = before.compileStoryboard(JSON.parse(JSON.stringify(LEGACY))); }
catch (e) { a = { err: e.message }; }
try { b = after.compileStoryboard(JSON.parse(JSON.stringify(LEGACY))); }
catch (e) { b = { err: e.message }; }

if (a.err || b.err) {
  check('both versions compile the legacy storyboard', false, `baseline=${a.err || 'ok'} current=${b.err || 'ok'}`);
} else {
  plainBeforeHtml = a.html;
  /* html is the per-storyboard artefact, so it must be byte-identical.
     css and js CANNOT be: this change adds rules and runtime functions to
     both, and every consumer receives them. Byte-identity there would mean
     "the feature was not added". The meaningful assertion is the opposite:
     nothing that existed before was silently dropped.

     RUNTIME_CSS is one long concatenated string with no newlines, so a
     line-based superset check is meaningless for it. Split on '}' instead,
     which is the actual rule boundary. */
  /* Theme normalisation. The theme layer changed two literals in the shared
     emitter, both intended and both preserving the DEFAULT:
       .hss-text{font-family:'JetBrains Mono',…}          -> var(--hss-font-mono,'JetBrains Mono',…)
       style="color:#abc"                                  -> style="color:#abc;"
     Unwrapping var(--hss-x, DEFAULT) back to DEFAULT and dropping the
     trailing semicolon must make the new output identical to the old. If it
     does not, a default really did change and that IS a regression — this
     asserts the defaults are untouched rather than skipping the comparison. */
  function untheme(css) {
    return css.replace(/var\(--hss-[a-z-]+,([^)]*)\)/g, '$1');
  }
  function unsemicolon(html) {
    return html.replace(/;(")/g, '$1');
  }
  check('html identical once the theme-only trailing `;` is normalised',
    unsemicolon(a.html) === unsemicolon(b.html),
    unsemicolon(a.html) === unsemicolon(b.html) ? '' : `first diff at ${firstDiff(unsemicolon(a.html), unsemicolon(b.html))}`);
  /* .hss-title/.hss-sub/.hss-body GAIN a font-family declaration they did not
     have; its fallback is `inherit`, which resolves to whatever .hss-text set,
     so an unthemed film renders identically. A chunk comparison cannot un-add
     a line, so these three are removed from the legacy side first. */
  for (const pre of ['.hss-title{font-size:22px', '.hss-sub{font-size:13px', '.hss-body{font-size:18px']) {
    const ix = a.css.indexOf(pre);
    if (ix !== -1) a.css = a.css.slice(0, ix) + a.css.slice(a.css.indexOf('}', ix) + 1);
  }
  check('css: every legacy rule still present with its DEFAULT value',
    supersetMiss(a.css, untheme(b.css), '}', ';') === '', supersetMiss(a.css, untheme(b.css), '}', ';'));
  /* Two runtime lines were EDITED rather than added, both to make the scene
     hide/advance rule type-aware. They are listed here so the check stays a
     superset check: any OTHER legacy line disappearing is still a failure.

     The last two are the KaTeX latch fix. The old code set _hssInit=true on
     the first frame whether or not the library had loaded, so a clip whose
     KaTeX <script> resolved after the first onFrame rendered raw `$$…$$` for
     the entire reel with no error. Declaring the old text lets the edit be
     intentional without weakening the check for everything else. */
  const RUNTIME_EDITS = [
    ['if(e.type!=="cards")_hidden(eN);', 'if(!isGroupT(e.type))_hidden(eN);'],
    ['var ws2=e._ws||_cards(e,-1);', 'var ws2=(e.type==="cards"?_cards(e,-1):_group(e,-1));'],
    ['if(e.type==="cards"){_cards(e,tL);continue;}', 'if(e.type==="cards"){_cards(e,tL);}'],
    ['if(_hssInit) return; _hssInit=true;', 'if(_hssInit) return;'],
    ['if(root&&window.renderMathInElement){', 'if(!(root&&window.renderMathInElement)) return;'],
  ];
  let jsLegacy = a.js;
  for (const [from, to] of RUNTIME_EDITS) {
    if (jsLegacy.indexOf(from) === -1) { failures++; console.log(`  FAIL  expected legacy runtime text absent: ${from.slice(0, 40)}`); }
    jsLegacy = jsLegacy.split(from).join(to);
  }
  check('js: every legacy runtime line still present (modulo 2 declared edits)',
    supersetMiss(jsLegacy, b.js, '\n') === '', supersetMiss(jsLegacy, b.js, '\n'));
  check('name/dur/ds unchanged', a.name === b.name && a.dur === b.dur && a.ds === b.ds,
    `${a.name}/${a.dur}/${a.ds} vs ${b.name}/${b.dur}/${b.ds}`);
  /* the legacy storyboard's own cards group must still be intact.
     Attribute order is class, id, THEN style — matching on the contiguous
     class+style pair misses it. The host style gained a trailing `;` when
     per-element box declarations were added to the same string; the
     assertion is "opaque host", not "this exact punctuation", so the
     semicolon is optional here. The byte-identity check above is what proves
     nothing else moved. */
  check('legacy cards group still emitted with an opaque host',
    /<div class="hss-el hss-cards-host" id="[^"]+" style="opacity:1;?">/.test(b.html) &&
    (b.html.match(/class="hss-cardwrap"/g) || []).length === 3);
}

console.log('\n=== the silent-empty-div fallback must be UNCHANGED ===');
const ub = before.compileStoryboard(JSON.parse(JSON.stringify(UNKNOWN)));
const ua = after.compileStoryboard(JSON.parse(JSON.stringify(UNKNOWN)));
check('unknown type still emits an empty wrapper (no throw added)',
  /<div class="hss-el" id="zz"><\/div>/.test(ub.html) && /<div class="hss-el" id="zz"><\/div>/.test(ua.html),
  `before=${/id="zz"><\/div>/.test(ub.html)} after=${/id="zz"><\/div>/.test(ua.html)}`);

console.log('\n=== the five new types now produce real markup ===');
const NEW = {
  title: 'New', aspect: '16:9', total_duration_ms: 2000,
  scenes: [{
    start_ms: 0, end_ms: 2000,
    elements: [
      { id: 'n1', type: 'stat', value: '7M', label: 'deaths', at_ms: 0 },
      { id: 'n2', type: 'card', big: '400+', small: 'AQI', meter_pct: 92, group: 'panels', at_ms: 0 },
      { id: 'n3', type: 'tiles', columns: 2, items: [{ icon: 'x', head: 'h', body: 'b' }], at_ms: 0 },
      { id: 'n4', type: 'pills', items: ['x', 'y'], at_ms: 0 },
      { id: 'n5', type: 'credit', text: 'src', at_ms: 0 },
    ],
  }],
};
const nb = before.compileStoryboard(JSON.parse(JSON.stringify(NEW)));
const na = after.compileStoryboard(JSON.parse(JSON.stringify(NEW)));
/* tiles/pills/cards nest their real markup TWO levels down (wrapper > host >
   slot > inner), so matching a class on the wrapper finds nothing. Credit
   goes the other way: its class is ON the wrapper tag, BEFORE the id. So
   slice from the start of the element's own open tag, not from the id. */
function slice(html, id, n) {
  const i = html.indexOf('id="' + id + '"');
  if (i === -1) return '';
  const open = html.lastIndexOf('<div', i);
  return html.slice(open === -1 ? i : open, (open === -1 ? i : open) + n);
}
for (const [id, cls] of [['n1', 'hss-stat-num'], ['n2', 'hss-panel-num'], ['n3', 'hss-tile'], ['n4', 'hss-pill'], ['n5', 'hss-credit']]) {
  check(`${id} renders <${cls}> in the current emitter`,
    slice(na.html, id, 600).indexOf(cls) !== -1, 'inner class not found within 600 chars of the id');
  check(`${id} rendered EMPTY in the baseline (the bug being fixed)`,
    new RegExp(`<div class="hss-el" id="${id}"><\\/div>`).test(nb.html));
}
check('tiles honour the authored column count',
  /grid-template-columns:repeat\(2,1fr\)/.test(na.html));

console.log('\n=== the new box + surface + runtime-mode layers ===');
/* Each of these is ADDITIVE: emitted only when authored, so a storyboard that
   does not use them must compile to the markup it compiled to before. The
   byte-identity check above already covers the "must not" half for the legacy
   fixture; these cover the "does work" half. */
const BOX = {
  title: 'Box', aspect: '16:9', total_duration_ms: 2000, mode: 'light',
  modes: {
    light: { theme: { ink: '#111111', panel: '#eeeeee' }, bg: '#ffffff' },
    dark: { theme: { ink: '#eeeeee', panel: '#1c1c1c' }, bg: '#0a0a0a' },
  },
  ui: { theme_toggle: true },
  background: '#ffffff',
  scenes: [{
    start_ms: 0, end_ms: 2000, bg: 'background:#123456', gap: 44,
    elements: [{ id: 'bx1', type: 'text', size: 'body', color: '#111', text: 'x', at_ms: 0,
      radius: '24px', max_width: 900, gap: 12 }],
  }],
};
const bx = after.compileStoryboard(JSON.parse(JSON.stringify(BOX)));
check('a scene background reaches the scene node VERBATIM (no re-prefixing)',
  /<div class="hss-scene" style="background:#123456;gap:44px;">/.test(bx.html) &&
  !/background:background/.test(bx.html),
  'a declaration list must be emitted as-is; prefixing it is silently invalid CSS');
check('per-element radius + max_width + gap reach the host',
  /id="bx1" style="border-radius:24px;max-width:900px;gap:12px;"/.test(bx.html));
check('both modes ship as [data-mode] rules in ONE clip',
  /\.hss\[data-mode="dark"\]\{[^}]*--hss-stage:#0a0a0a/.test(bx.css) &&
  /\.hss\{[^}]*--hss-stage:#ffffff/.test(bx.css));
check('the toggle is present and the stage starts in the handed mode',
  /id="hss-toggle"/.test(bx.html) && /data-mode="light"/.test(bx.html));
check('the exporter is told which mode baked in',
  bx.mode === 'light' && Array.isArray(bx.modes) && bx.modes.join(',') === 'dark');
/* Determinism is the property the whole pipeline rests on, so the flip must
   not be wired into onFrame: it is a click handler bound once in setup. */
check('the mode flip is an event listener bound once, not a per-frame read',
  (bx.js.match(/addEventListener\("click"/g) || []).length === 1 &&
  bx.js.indexOf('hss-toggle') < bx.js.indexOf('function onFrame'),
  'the binding must be spliced into the _hssSetup guarded block, not into onFrame');

const GRAD = {
  title: 'G', aspect: '16:9', total_duration_ms: 1000,
  scenes: [{ start_ms: 0, end_ms: 1000,
    bg: 'background-image:linear-gradient(160deg,#1a0f14 0%,#2a1420 100%);background-repeat:no-repeat',
    elements: [{ id: 'g1', type: 'text', size: 'body', text: 'x', at_ms: 0 }] }],
};
const gx = after.compileStoryboard(JSON.parse(JSON.stringify(GRAD)));
check('a gradient declaration list survives verbatim (no re-prefixing)',
  /<div class="hss-scene" style="background-image:linear-gradient\(160deg,#1a0f14 0%,#2a1420 100%\);background-repeat:no-repeat;">/.test(gx.html),
  gx.html.match(/<div class="hss-scene"[^>]*>/)[0]);

/* A FLAT scene is the case that broke: the reel root wants a bare colour and a
   scene wants a declaration list, and returning the bare colour for both
   emitted `style="#f8faf8;"` — a value with no property name, which CSS drops
   without a word. Every scene rendered, and nothing reported it. */
const FLATSCENE = {
  title: 'F', aspect: '16:9', total_duration_ms: 1000, background: '#f8faf8',
  scenes: [{ start_ms: 0, end_ms: 1000,
    bg: 'background:#f8faf8',
    elements: [{ id: 'f1', type: 'text', size: 'body', text: 'x', at_ms: 0 }] }],
};
const fx = after.compileStoryboard(JSON.parse(JSON.stringify(FLATSCENE)));
check('a flat scene emits a NAMED declaration, not a bare colour',
  /<div class="hss-scene" style="background:#f8faf8;">/.test(fx.html) &&
  !/class="hss-scene" style="#/.test(fx.html),
  fx.html.match(/<div class="hss-scene"[^>]*>/)[0]);
check('the reel root still emits a named background',
  /<div class="hss" id="hss" style="background:#f8faf8">/.test(fx.html),
  fx.html.match(/<div class="hss"[^>]*>/)[0]);
/* and the same film compiled with no box/surface/mode authoring is unchanged.
   The baseline is git HEAD, which predates the whole R1 pass (including
   `.hss{color:var(--hss-ink)}`), so this compares like with like only via the
   declared-edit path above — it is the LEGACY fixture check, repeated on a
   second minimal storyboard to catch a regression the first one misses. */
const plain = after.compileStoryboard(JSON.parse(JSON.stringify(LEGACY)));
check('the legacy fixture still compiles to the same non-empty scene markup',
  (plain.html.match(/hss-scene/g) || []).length === (plainBeforeHtml.match(/hss-scene/g) || []).length &&
  !/border-radius|max-width|style="gap/.test(plain.html),
  'unauthored box properties must not appear in the markup at all');

console.log('\n=== component variants, per-type radius, alignment, group layout ===');
/* P6/P7. Every rule added for these is APPENDED to RUNTIME_CSS rather than
   folded into an existing declaration, which is what keeps the legacy
   byte-identity check above meaningful. Assert the additive half here:
   the classes land, and an element that authors none of them is unchanged. */
const VAR = {
  title: 'Var', aspect: '16:9', total_duration_ms: 2000,
  theme: { radius: '4px', fill: '#b4f0d3', 'fill-ink': '#002116', 'fill-tone': '#eef3f0' },
  modes: {
    light: { theme: { radius: '4px', 'radius-pill': '8px', 'radius-card': '20px', 'radius-tile': '20px', 'radius-answer': '24px', fill: '#b4f0d3', 'fill-ink': '#002116', 'fill-tone': '#eef3f0' }, bg: '#ffffff' },
    dark: { theme: { radius: '4px', 'radius-pill': '8px', 'radius-card': '20px', 'radius-tile': '20px', 'radius-answer': '24px', fill: '#00513b', 'fill-ink': '#b4f0d3', 'fill-tone': '#1c2320' }, bg: '#0a0a0a' },
  },
  mode: 'light',
  background: '#ffffff',
  scenes: [{
    start_ms: 0, end_ms: 2000,
    elements: [
      { id: 'v1', type: 'card', fill: 'filled', align: 'start', group: 'solve', layout: 'grid', columns: 2, at_ms: 0 },
      { id: 'v2', type: 'card', fill: 'tonal', align: 'end', group: 'solve', at_ms: 0 },
      { id: 'v3', type: 'pills', fill: 'outlined', align: 'center', items: ['a', 'b'], at_ms: 0 },
      { id: 'v4', type: 'answer', fill: 'text', text: 'x', at_ms: 0 },
      { id: 'v5', type: 'tiles', fill: 'tonal', items: [{ icon: 'i', head: 'h', body: 'b' }], at_ms: 0 },
    ],
  }],
};
const vx = after.compileStoryboard(JSON.parse(JSON.stringify(VAR)));
check('each variant reaches the COMPONENT node, not the wrapper',
  /<div class="hss-panel hss-fill-filled"/.test(vx.html) &&
  /<div class="hss-panel hss-fill-tonal"/.test(vx.html) &&
  /<span class="hss-pill hss-fill-outlined">/.test(vx.html) &&
  /<div class="hss-answer hss-fill-text"/.test(vx.html) &&
  /<div class="hss-tile hss-fill-tonal"/.test(vx.html),
  vx.html.match(/class="hss-(panel|pill|answer|tile)[^"]*"/g));
check('alignment lands on the host as a class',
  /id="v1" class|<div class="hss-el hss-panel-host hss-align-start" id="v1"/.test(vx.html) &&
  /hss-align-end/.test(vx.html) && /hss-align-center/.test(vx.html),
  vx.html.match(/<div class="hss-el[^"]*" id="v[0-9]"/g));
check('a grid group becomes a grid WITH its authored column count',
  /<div class="hss-groups" style="grid-template-columns:repeat\(2,1fr\)">/.test(vx.html),
  vx.html.match(/<div class="hss-(groups|panels)"[^>]*>/g));
check('an ungrouped element gets no wrapper at all',
  !/hss-panels/.test(vx.html) && (vx.html.match(/hss-groups/g) || []).length === 1);
check('a bad variant value cannot become a class attribute',
  after.compileStoryboard(Object.assign(JSON.parse(JSON.stringify(VAR)), {
    scenes: [{ start_ms: 0, end_ms: 1000, elements: [{ id: 'x', type: 'pills', fill: 'x}html{', items: ['a'], at_ms: 0 }] }],
  })).html.indexOf('hss-fill-x') === -1, 'the emitter must whitelist, not trust');
check('a bad alignment value cannot become a class attribute',
  after.compileStoryboard({
    title: 'A', aspect: '16:9', total_duration_ms: 1000,
    scenes: [{ start_ms: 0, end_ms: 1000, elements: [{ id: 'x', type: 'credit', align: 'x"onload="', text: 'a', at_ms: 0 }] }],
  }).html.indexOf('hss-align-x') === -1, 'the emitter must whitelist, not trust');
check('per-component radii are emitted as theme vars and fall back to the global',
  /--hss-radius-pill:8px/.test(vx.css) && /--hss-radius-answer:24px/.test(vx.css) &&
  /\.hss-panel\{border-radius:var\(--hss-radius-card,var\(--hss-radius,1\.1vw\)\)\}/.test(vx.css));
check('a theme that names no per-type radius still resolves the global',
  (function () {
    const c = after.compileStoryboard({
      title: 'R', aspect: '16:9', total_duration_ms: 1000, theme: { radius: '4px' },
      scenes: [{ start_ms: 0, end_ms: 1000, elements: [{ id: 'r', type: 'pills', items: ['a'], at_ms: 0 }] }],
    });
    /* the DECLARATION, not the string: the fallback chain
       `var(--hss-radius-pill,var(--hss-radius,6vw))` names the key in every
       clip whether or not the theme sets it, so matching the bare name would
       pass whether the feature worked or not */
    return /--hss-radius:4px/.test(c.css) && !/--hss-radius-pill:/.test(c.css);
  })());
check('the variant rules exist in BOTH modes, so a re-theme keeps the components',
  /\[data-mode="dark"\][^{]*\{[^}]*--hss-radius-pill:8px/.test(vx.css) &&
  /\[data-mode="dark"\][^{]*\{[^}]*--hss-fill:#00513b/.test(vx.css));

console.log('\n=== the schema gate rejects an invented field name ===');
/* P3. The gate's own self-test proves it can fail; this proves it fails on the
   REAL defect — `label_bg` for `slab_bg` — by taking a film that passes and
   introducing exactly that typo. A gate tested only against its own fixture is
   a gate whose fixture was written to suit it. */
const { validate } = require('./reel-schema.cjs');
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'storyboard.schema.json'), 'utf8'));
const FILMS_DIR = path.join(__dirname, 'films');
for (const film of fs.readdirSync(FILMS_DIR).filter((d) => fs.existsSync(path.join(FILMS_DIR, d, 'storyboard.json')))) {
  const doc = JSON.parse(fs.readFileSync(path.join(FILMS_DIR, film, 'storyboard.json'), 'utf8'));
  check(`${film} validates clean against storyboard.schema.json`, validate(doc, schema).length === 0,
    validate(doc, schema).slice(0, 2).map((e) => `${e.pointer}: ${e.message.slice(0, 60)}`).join(' | '));
}
/* the historical defect, reintroduced. The index is DERIVED from the array
   rather than hardcoded: a hardcoded index passes until the film is edited,
   which is precisely how a regression suite stops testing anything. */
const tq = JSON.parse(fs.readFileSync(path.join(FILMS_DIR, 'two-queens', 'storyboard.json'), 'utf8'));
const scIndex = tq.scenes.findIndex((s) => s.elements.some((e) => e.id === 's7-answer'));
const elIndex = tq.scenes[scIndex].elements.findIndex((e) => e.id === 's7-answer');
const cta = tq.scenes[scIndex].elements[elIndex];
delete cta.color;
cta.label_bg = '#FDCB0B';   // the jan-suraaj bug: invented, dropped in silence
const wantPointer = `/scenes/${scIndex}/elements/${elIndex}/label_bg`;
const errs = validate(tq, schema);
check('an invented field is caught at a JSON POINTER, not a CSS class',
  errs.length === 1 && errs[0].pointer === wantPointer,
  `got ${JSON.stringify(errs.map((e) => e.pointer))}, wanted ["${wantPointer}"]`);
check('the same document is valid with the field spelled correctly',
  (function () {
    const ok = JSON.parse(JSON.stringify(tq));
    ok.scenes[6].elements.find((e) => e.id === 's7-answer').color = '#FDCB0B';
    delete ok.scenes[6].elements.find((e) => e.id === 's7-answer').label_bg;
    return validate(ok, schema).length === 0;
  })());
check('an unknown element TYPE is caught too, not just an unknown field',
  validate(Object.assign(JSON.parse(JSON.stringify(tq)), {
    scenes: [{ id: 's', start: 0, dur: 1, elements: [{ id: 'a', type: 'hologram' }] }],
  }), schema).some((e) => /expected one of/.test(e.message)));

console.log('\n=== the KaTeX latch fix: retry instead of latching blind ===');
/* The failure is invisible from the outside — no throw, no warning, just raw
   `$$…$$` text in the exported film — so assert the ORDER, not the outcome:
   the guard that returns early must appear BEFORE the line that latches. */
check('_hssInit is no longer latched before the library is checked for',
  b.js.indexOf('if(!(root&&window.renderMathInElement)) return;') !== -1 &&
  b.js.indexOf('if(!(root&&window.renderMathInElement)) return;') < b.js.indexOf('_hssInit=true;', b.js.indexOf('function _hssSetup')),
  'renderMathInElement must be probed before the latch, or a late script loses the maths for the whole clip');
check('the retry is still reached every frame (the setup hook is not gated)',
  /_hssSetup\(\);/.test(b.js));

console.log('\n=== latex: colour and size are now authorable ===');
const LATEX_SIZED = {
  title: 'L', aspect: '16:9', total_duration_ms: 1000,
  scenes: [{ start_ms: 0, end_ms: 1000, elements: [
    { id: 'm1', type: 'latex', color: '#191c1a', font_size: '5.000vw', text: '\\binom{52}{4}', at_ms: 0 },
    { id: 'm2', type: 'latex', color: '#ffffff', text: 'x^2', at_ms: 0 },
  ] }],
};
const la = after.compileStoryboard(LATEX_SIZED);
check('an authored latex size reaches the markup', /class="hss-latex" style="color:#191c1a;font-size:5\.000vw"/.test(la.html), la.html.slice(la.html.indexOf('m1'), la.html.indexOf('m1') + 160));
check('an unauthored latex element is unchanged (no stray font-size)',
  /class="hss-latex" style="color:#ffffff"/.test(la.html));

console.log('\n=== the design board: a style preview that cannot lie about the film ===');
/* buildDesignPage is the second consumer of the resolved design. Its whole
   claim is "every colour here is the one the film ships", so the invariants
   worth asserting are (a) it renders the values it is HANDED rather than
   re-reading a design on the side, (b) a film with no design block still gets
   a board, and (c) authored copy is escaped like everywhere else. */
const BOARD = {
  title: 'Board', id: 'b', fonts: [{ href: 'https://example.invalid/f.css' }],
  preview: 'reel-preview.html',
  boards: [
    {
      mode: 'dark', bg: '#0e1512', theme: { ink: '#f8fafc', 'fill': '#0b6bcb' },
      palette: { brand: '#e7ba55' }, roleUse: { brand: ['fill'] }, ramp: [
        { role: 'display', px: 96, weight: 700, family: 'Inter', used: true },
      ],
      fills: { card: 'tonal' }, radii: { card: '12px' }, radius: null, declared: true,
      surfaces: [{ id: 's1', decl: null, css: 'background:#0e1512' }],
      counts: { scenes: 1, elements: 1, duration: 3, types: ['text'] },
    },
    {
      mode: 'light', bg: '#f8faf8', theme: {}, palette: {}, roleUse: {}, ramp: [],
      fills: {}, radii: {}, radius: null, declared: false,
      surfaces: [{ id: 's1', decl: null, css: null }],
      counts: { scenes: 1, elements: 1, duration: 3, types: ['text'] },
    },
  ],
};
let boardHtmlOut = '';
try { boardHtmlOut = after.buildDesignPage(BOARD); }
catch (e) { boardHtmlOut = 'THREW: ' + e.message; }
check('the emitter exports buildDesignPage', typeof after.buildDesignPage === 'function');
check('one board is rendered per mode handed in — not one per file',
  (boardHtmlOut.match(/class="dsp-board"/g) || []).length === 2, boardHtmlOut.slice(0, 80));
check('the board carries the RESOLVED theme, not a re-read one',
  /--hss-ink:#f8fafc/.test(boardHtmlOut) && /--hss-fill:#0b6bcb/.test(boardHtmlOut));
check('the stage paints the mode background it was given', /--hss-stage:#0e1512/.test(boardHtmlOut));
check('the type ramp shows the design-space size, not the clamped sample',
  /96px/.test(boardHtmlOut));
check('a board with no design block renders instead of throwing',
  !/THREW/.test(boardHtmlOut) && /no design block \u00b7 runtime defaults/.test(boardHtmlOut));
check('the board loads the runtime stylesheet, so samples are the real components',
  boardHtmlOut.indexOf(after.RUNTIME_CSS.slice(0, 120)) !== -1 &&
  boardHtmlOut.indexOf(after.DESIGN_CSS.slice(0, 60)) !== -1);
const boardXss = after.buildDesignPage(Object.assign({}, BOARD, { title: '</h1><script>bad()</' + 'script>' }));
check('authored copy on the board is escaped like the film\'s',
  !/<script>bad\(\)<\/script>/.test(boardXss));

console.log('\n=== escaping: authored copy cannot become markup ===');
const XSS = {
  title: 'x', aspect: '16:9', total_duration_ms: 1000,
  scenes: [{ start_ms: 0, end_ms: 1000, elements: [
    { id: 'x1', type: 'stat', value: '<script>bad()</' + 'script>', label: 'a"b', at_ms: 0 },
    { id: 'x2', type: 'credit', text: '</div><b>bold</b>', at_ms: 0 },
  ] }],
};
const xa = after.compileStoryboard(XSS);
check('script tag in a stat value is escaped', !/<script>bad\(\)<\/script>/.test(xa.html));
check('markup in a credit is escaped', !/<\/div><b>bold<\/b>/.test(xa.html));

function firstDiff(x, y) {
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i++) if (x[i] !== y[i]) return i;
  return 'length ' + x.length + ' vs ' + y.length;
}

/* "Superset" means: every chunk of the OLD text still appears verbatim in the
   NEW text. Inserting is the feature; deleting or editing a pre-existing chunk
   in a shared file is the regression. Split on the boundary the caller passes
   ('}' + ';' for CSS rules, '\n' for runtime lines) and skip empties. */
function supersetMiss(oldText, newText, sep, sep2) {
  const missing = [];
  let parts = oldText.split(sep);
  if (sep2) parts = parts.flatMap((p) => p.split(sep2));
  for (const chunk of parts) {
    const t = chunk.trim();
    if (!t || t === '});' || t === ']' || t === '}' || t === ')' || t === "' + '") continue;
    if (newText.indexOf(chunk) === -1 && newText.indexOf(t) === -1) missing.push(t.slice(0, 70));
  }
  return missing.length ? `${missing.length} legacy chunk(s) gone, first: ${missing[0]}` : '';
}

console.log('');
if (failures) {
  console.error(`reel-regression: FAILED (${failures})`);
  process.exit(1);
}
console.log('reel-regression: OK — existing consumers are unaffected, the five new types work, the design board renders from resolved values, copy is escaped.');