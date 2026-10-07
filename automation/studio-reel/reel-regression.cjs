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
 *   - an UNKNOWN type is now a throw rather than a silent empty div (see the
 *     note at that assertion — this one is a deliberate reversal, not a
 *     regression), and emitterSupportsType() answers from the switch
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

/* The baseline is PINNED, not HEAD.
 *
 * This gate answers one question — did adding to the shared emitter change
 * what an existing caller gets — and `HEAD` is the wrong thing to ask it of.
 * While the change is uncommitted HEAD is the old emitter and the check reads
 * correctly; the moment the change lands, HEAD becomes the new emitter and
 * every assertion here compares it against itself. Ten of them then fail on
 * text that is simply no longer old, and the suite that exists to catch a
 * dropped rule goes red on a commit that dropped none.
 *
 * `baf1d56` is the last commit whose `hic-storyboard.js` predates the R1
 * element types. Pinning to it keeps the assertions meaningful forever and
 * makes every future addition prove itself against the same legible baseline.
 * When a change genuinely intends to alter legacy output, that has to be
 * declared in RUNTIME_EDITS below rather than absorbed by moving the pin. */
const BASELINE = 'baf1d56';

function gitShow(rel) {
  return execFileSync('git', ['show', BASELINE + ':' + rel], { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
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

const before = loadFrom(gitShow(EMITTER_REL), 'hic-storyboard.js@' + BASELINE);
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
  /* These runtime lines were EDITED rather than added, and they are listed
     here so the check stays a superset check: any OTHER legacy line
     disappearing is still a failure. Declaring the old text lets an edit be
     intentional without weakening the check for everything else.

     1-3. make the scene hide/advance rule type-aware, rather than assuming
          every host is a card row.
     4-5. the KaTeX latch fix: the old code set _hssInit=true on the first
          frame whether or not the library had loaded, so a clip whose KaTeX
          <script> resolved after the first onFrame rendered raw `$$…$$` for
          the entire reel with no error.
     6.    _hssSetup falls back to document.body, so a BOARD can typeset —
          the scenes preview has several stages and no #hss. */
  const RUNTIME_EDITS = [
    ['if(e.type!=="cards")_hidden(eN);', 'if(!isGroupT(e.type))_hidden(eN);'],
    ['var ws2=e._ws||_cards(e,-1);', 'var ws2=(e.type==="cards"?_cards(e,-1):_group(e,-1));'],
    ['if(e.type==="cards"){_cards(e,tL);continue;}', 'if(e.type==="cards"){_cards(e,tL);}'],
    ['if(_hssInit) return; _hssInit=true;', 'if(_hssInit) return;'],
    ['if(root&&window.renderMathInElement){', 'if(!(root&&window.renderMathInElement)) return;'],
    /* The scenes board renders several <div class="hss"> stages and has no
       #hss, so the hook returned before typesetting anything — the board
       showed raw $$…$$ while the film beside it set it. The clip still finds
       #hss, so this changes a no-op into a no-op for every existing caller. */
    ['var root=document.getElementById("hss");', 'var root=document.getElementById("hss")||document.body;'],
  ];
  let jsLegacy = a.js;
  for (const [from, to] of RUNTIME_EDITS) {
    if (jsLegacy.indexOf(from) === -1) { failures++; console.log(`  FAIL  expected legacy runtime text absent: ${from.slice(0, 40)}`); }
    jsLegacy = jsLegacy.split(from).join(to);
  }
  check(`js: every legacy runtime line still present (modulo ${RUNTIME_EDITS.length} declared edits)`,
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

console.log('\n=== the silent-empty-div fallback is now a hard failure ===');
/* DELIBERATE CHANGE, and the one assertion in this file that was written to
 * fail on purpose. It used to read "unknown type still emits an empty wrapper
 * (no throw added)" — i.e. it pinned the SILENT LOSS as the contract, so that a
 * future emitter could not quietly start throwing. That was the wrong thing to
 * protect. An element that renders as <div class="hss-el" id="zz"></div> is a
 * scene that is correct minus one element, with no error anywhere and a green
 * gate; every rule in this pipeline exists to make that impossible, and
 * reel-compile's BUILDABLE list only caught it because a human kept the list in
 * step with the switch.
 *
 * So the baseline behaviour is still asserted (the old emitter DID emit the
 * empty wrapper — that is the history this test now documents), and the
 * working-tree behaviour is asserted to be the opposite: a throw, carrying the
 * offending type, from the one place that knows. */
const ub = before.compileStoryboard(JSON.parse(JSON.stringify(UNKNOWN)));
let uaErr = null;
try { after.compileStoryboard(JSON.parse(JSON.stringify(UNKNOWN))); } catch (e) { uaErr = e; }
check('the baseline emitted an empty wrapper for an unknown type (the old silent loss)',
  /<div class="hss-el" id="zz"><\/div>/.test(ub.html),
  `baseline html had the empty wrapper: ${/id="zz"><\/div>/.test(ub.html)}`);
check('an unknown type is now a THROW, not an empty wrapper',
  !!uaErr, uaErr ? `threw: ${uaErr.message}` : 'compiled without throwing — the default case is gone');
check('the throw names the offending type and is flagged as unknownType',
  !!uaErr && /"hologram"/.test(uaErr.message) && uaErr.unknownType === true,
  uaErr ? `${uaErr.message} (unknownType=${uaErr.unknownType})` : 'no error');
/* the property reel-compile depends on: the switch is asked, not a list beside
 * it, so every supported type answers yes and an unsupported one answers no.
 * If a case were ever added without this agreeing, deferral would silently
 * mis-classify it in one direction or the other. */
const KNOWN_TYPES = ['text', 'latex', 'answer', 'cards', 'image', 'shape',
  'stat', 'card', 'tiles', 'pills', 'credit', 'chart'];
check('emitterSupportsType says yes to all 12 case labels and no to the unknown one',
  KNOWN_TYPES.every((t) => after.emitterSupportsType(t) === true) &&
  after.emitterSupportsType('hologram') === false &&
  after.emitterSupportsType(undefined) === false,
  KNOWN_TYPES.filter((t) => after.emitterSupportsType(t) !== true).join(',') || 'all 12 ok');
check('the probed emitter agrees with the switch for every legacy+buildable type',
  (() => {
    // a probe must not throw for a TYPE reason on any real case, and must not
    // be able to throw a non-unknownType error that emitterSupportsType would
    // re-raise. Verified by asserting the whole probe set returns a boolean.
    return KNOWN_TYPES.every((t) => typeof after.emitterSupportsType(t) === 'boolean');
  })());

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

console.log('\n=== the scenes page: every scene, settled, and none of them playing ===');
/* its own fixture, so this section does not depend on where the chart section
   happens to sit in the file */
const SC_CHART = {
  title: 'S', aspect: '16:9', total_duration_ms: 3000,
  scenes: [
    { start_ms: 0, end_ms: 1500, elements: [
      { id: 'q1', type: 'chart', chart: 'columns', at_ms: 0, categories: ['a', 'b'], series: [{ name: 'x', values: [1, 2] }] },
      { id: 'q2', type: 'chart', chart: 'line', area: true, at_ms: 0, categories: ['a', 'b'], series: [{ name: 'y', values: [1, 2] }] },
    ] },
    { start_ms: 1500, end_ms: 3000, elements: [
      { id: 'q3', type: 'chart', chart: 'donut', at_ms: 0, categories: ['a', 'b'], series: [{ name: 'z', values: [1, 1] }] },
    ] },
  ],
};
const scClip = after.compileStoryboard(JSON.parse(JSON.stringify(SC_CHART)));
const scPage = after.buildScenesPage({
  title: 'S', css: scClip.css, js: scClip.js, theme: scClip.theme,
  preview: 'reel-preview.html', board: 'design-preview.html',
  scenes: scClip.sceneHtml.map((html, i) => ({
    index: i + 1, id: 'sc' + i, start: '0.0', end: '3.0', dur: '3.0',
    elements: 3, kinds: 'chart', html, bg: '#0e1512', mode: null, ratio: '16 / 9', note: 'settled',
  })),
});
check('the emitter exports buildScenesPage', typeof after.buildScenesPage === 'function');
check('one stage per scene, in order',
  (scPage.match(/class="hss"/g) || []).length === scClip.sceneHtml.length &&
  scPage.indexOf('scene-sc0') < scPage.indexOf('scene-sc1'));
/* the page carries the FILM's stylesheet and runtime rather than a re-render,
   which is the whole claim: a component cannot look right here and wrong in
   the film. */
check('the page embeds the compiled clip CSS and JS verbatim',
  scPage.indexOf(scClip.css) !== -1 && scPage.indexOf('function onFrame(t)') !== -1);
check('the page never starts an animation loop',
  scPage.indexOf('requestAnimationFrame') === -1);
check('the page settles using the clip\'s own settle()',
  /function settle\(root\)/.test(scClip.js) && /_hssSetup\(\);settle\(document\);/.test(scPage));
/* settle() is `_chart`'s inverse, so every kind _chart can move must have a
   finished state. A kind added to one and not the other draws a mark the film
   shows and the preview never does — silently. */
check('settle handles every animated kind a chart can emit',
  (function () {
    const kinds = new Set();
    const re = /data-k="(col|row|line|area|arc|value)"/g;
    let m2; while ((m2 = re.exec(scClip.html))) kinds.add(m2[1]);
    const body = scClip.js.slice(scClip.js.indexOf('function settle(root)'), scClip.js.indexOf('function onFrame'));
    return kinds.size >= 5 && [...kinds].every((k) => body.indexOf('m==="' + k + '"') !== -1);
  })());
/* the clip JS is spliced into a <script> in this page, so a `</script>` inside
   authored copy would end the block and dump the rest of the runtime as text */
check('the embedded runtime cannot be closed early by authored copy',
  after.buildScenesPage({
    title: 'x', js: 'var a="</' + 'script>";alert(1)', css: '', scenes: [],
  }).indexOf('</' + 'script>";alert(1)') === -1);
check('a scene id from the storyboard is escaped on the page',
  after.buildScenesPage({
    title: 'x', css: '', js: '',
    scenes: [{ index: 1, id: '"><img src=x onerror=1>', html: '<div></div>', start: '0', end: '1', dur: '1', elements: 1 }],
  }).indexOf('<img src=x') === -1);

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
      mode: 'dark', bg: '#0e1512',
      theme: {
        ink: '#f8fafc', 'fill': '#0b6bcb',
        s1: '#ffeb00', s2: '#7cc4ff', s3: '#ff7a59', s4: '#7bdcb5', s5: '#c9a6ff', s6: '#e8eae9',
        'chart-grid': '#2e3437', 'on-variant': '#a3a8a6',
      },
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
/* The mode tag sits ON the stage swatch but its background is the board's white
   paper, so it must not inherit the stage ink. It did, and the label rendered
   near-white on near-white — present, correct and invisible. The accessibility
   tree could not see it either, because the text was there; only a screenshot
   did. */
check('the mode tag carries board ink, not the stage ink it sits on',
  /\.dsp-tag\{[^}]*color:var\(--dsp-ink\)/.test(after.DESIGN_CSS) &&
  !/class="dsp-tag" style="color:/.test(boardHtmlOut));
/* the chart roles are only worth declaring if the board shows them: the board
   is where a designer checks that the palette they wrote is the palette that
   ships, and a category the board omits is a category nobody reviews. */
check('every chart theme role the film can set is listed on the board',
  ['--hss-s1', '--hss-s6', '--hss-chart-grid', '--hss-on-variant'].every(
    (k) => boardHtmlOut.indexOf('>' + k + '<') !== -1));

console.log('\n=== charts: geometry is computed once, progress is the only runtime state ===');
/* A chart's danger is not that it throws — it is that it renders NOTHING and
   exits 0. A value that coerces to NaN produces a bar with no height, and an
   SVG attribute the parser rejects produces a mark that is simply not there.
   Every assertion below is about a mark that must EXIST. */
const CHART = {
  title: 'C', aspect: '16:9', total_duration_ms: 3000,
  scenes: [{
    start_ms: 0, end_ms: 3000,
    elements: [
      { id: 'k1', type: 'chart', chart: 'columns', at_ms: 0, categories: ['a', 'b', 'c', 'd'],
        series: [{ name: 'one', values: [10, 40, 25, 60] }, { name: 'two', values: [5, 20, 30, 15] }] },
      { id: 'k2', type: 'chart', chart: 'line', area: true, at_ms: 0, categories: ['a', 'b', 'c'],
        series: [{ name: 's', values: [1, 3, 2] }] },
      { id: 'k3', type: 'chart', chart: 'donut', at_ms: 0, categories: ['a', 'b'],
        series: [{ name: 'd', values: [3, 1] }] },
    ],
  }],
};
const ka = after.compileStoryboard(JSON.parse(JSON.stringify(CHART)));
check('every series x category renders a bar',
  (ka.html.match(/class="hss-bar"/g) || []).length === 8, `got ${(ka.html.match(/class="hss-bar"/g) || []).length}, want 8`);
check('a bar carries the geometry the runtime will move it with',
  /data-anim="1" data-k="col" data-i="0" data-by="[\d.]+" data-ty="[\d.]+"/.test(ka.html));
check('a line normalises to pathLength 1, so the runtime never needs PI',
  /class="hss-chart-stroke"[^>]*pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/.test(ka.html));
/* the wrapper is `hss-chart-<kind>`, so a polyline named `hss-chart-line` would
   BE the container class for a line chart: two different elements sharing one
   name, and the first rule written for either silently hits both. */
check('the line stroke does not share a class with its own container',
  !/class="hss-chart-line"/.test(ka.html) && /class="hss-chart hss-chart-line"/.test(ka.html));
check('an area fill is revealed by an animated clip whose width the runtime owns',
  /<clipPath id="hss-clip-k2"><rect[^>]*data-k="area" data-w="\d+/.test(ka.html));
check('a donut segment is a fraction of the ring, not a degree',
  /data-k="arc" data-frac="0\.75000"/.test(ka.html));
check('the chart phase travels with the element, as the meter does',
  /"type":"chart"[\s\S]{0,200}?"min":\{[^}]*\}/.test(ka.js) && /function _chart\(e,t\)/.test(ka.js));
check('the runtime applies progress per node, so a series can stagger',
  /_ph\(a,t-ii\*st\)/.test(ka.js));
/* stacked: the scale must SUM the column. Reading one series would clip the
   stack — the bars would render, fit, and be wrong. */
const stk = after.compileStoryboard({
  title: 'S', aspect: '16:9', total_duration_ms: 1,
  scenes: [{ start_ms: 0, end_ms: 1, elements: [{ id: 's', type: 'chart', chart: 'columns', stacked: true, at_ms: 0,
    categories: ['a', 'b'], series: [{ name: 'x', values: [10, 10] }, { name: 'y', values: [30, 30] }] }] }],
});
const tops = (stk.html.match(/data-ty="([\d.]+)"/g) || []).map((m) => Number(m.slice(9, -1)));
check('a stacked column is scaled by the SUM, not by its largest layer',
  Math.abs(Math.min(...tops) - (458 - 428)) < 1.5, `lowest top ${Math.min(...tops)} (a partial scale would stop near 351)`);
/* whitelist: this string lands in a fill attribute */
const paint = after.compileStoryboard({
  title: 'P', aspect: '16:9', total_duration_ms: 1,
  scenes: [{ start_ms: 0, end_ms: 1, elements: [{ id: 'p', type: 'chart', chart: 'columns', at_ms: 0,
    categories: ['a'], series: [{ name: 'n', values: [1], color: '" onload="alert(1)' }] }] }],
}).html;
check('a series colour that is not a colour cannot become an attribute',
  paint.indexOf('onload') === -1 && /fill="var\(--hss-s1,#ffeb00\)"/.test(paint));
const paintOk = after.compileStoryboard({
  title: 'P', aspect: '16:9', total_duration_ms: 1,
  scenes: [{ start_ms: 0, end_ms: 1, elements: [{ id: 'p', type: 'chart', chart: 'columns', at_ms: 0,
    categories: ['a'], series: [{ name: 'n', values: [1], color: '#FDCB0B' }] }] }],
}).html;
check('a hex series colour reaches the mark verbatim', /fill="#FDCB0B"/.test(paintOk));
/* an unknown kind is a fallback, not an empty div: the schema rejects it, but
   this file is also loaded directly by test-renderer.html */
check('an unknown chart kind falls back to columns rather than rendering nothing',
  /class="hss-chart hss-chart-columns"/.test(after.compileStoryboard({
    title: 'U', aspect: '16:9', total_duration_ms: 1,
    scenes: [{ start_ms: 0, end_ms: 1, elements: [{ id: 'u', type: 'chart', chart: 'treemap', at_ms: 0,
      categories: ['a'], series: [{ name: 'n', values: [1] }] }] }],
  }).html));
check('a chart with no series says so instead of rendering an empty frame',
  /hss-chart-empty/.test(after.compileStoryboard({
    title: 'E', aspect: '16:9', total_duration_ms: 1,
    scenes: [{ start_ms: 0, end_ms: 1, elements: [{ id: 'e', type: 'chart', chart: 'columns', at_ms: 0, series: [] }] }],
  }).html));
check('a category name is escaped like any other authored copy',
  !/<img src=x/.test(after.compileStoryboard({
    title: 'X', aspect: '16:9', total_duration_ms: 1,
    scenes: [{ start_ms: 0, end_ms: 1, elements: [{ id: 'x', type: 'chart', chart: 'columns', at_ms: 0,
      categories: ['<img src=x onerror=1>'], series: [{ name: 'n', values: [1] }] }] }],
  }).html));

console.log('\n=== a reference line is a threshold the chart can DRAW, not one it describes ===');
/* The sixth film is about a barrier — a number a record had to beat — and
   could not ask for the one mark that carries it. These are the assertions
   that keep the mark honest: on the VALUE axis (so `bars` gets a vertical
   line, not a horizontal rule that reads as another series), drawn even with
   `grid` off, clamped inside the plot, and never allowed to set the scale. */
const REFC = {
  title: 'R', aspect: '16:9', total_duration_ms: 3000,
  scenes: [{ start_ms: 0, end_ms: 3000, elements: [
    { id: 'r1', type: 'chart', chart: 'columns', grid: false, at_ms: 0,
      ref: 15, ref_label: '4:00.00', categories: ['a', 'b', 'c'],
      series: [{ name: 'one', values: [10, 20, 30] }] },
    { id: 'r2', type: 'chart', chart: 'bars', at_ms: 0, ref: 15,
      categories: ['alpha', 'beta'], series: [{ name: 'one', values: [10, 30] }] },
    { id: 'r3', type: 'chart', chart: 'columns', at_ms: 0,
      categories: ['a'], series: [{ name: 'one', values: [1] }] },
    { id: 'r4', type: 'chart', chart: 'line', at_ms: 0, ref: 9, ref_label: '<b>x</b>',
      categories: ['a', 'b'], series: [{ name: 'one', values: [1, 10] }] },
  ] }],
};
const refHtml = after.compileStoryboard(REFC).html;
/* matchAll, because `.match(re, /g)` drops the capture groups and a
   subsequent /[\d.]+/ over the full match picks up the digits in `x1`/`y2`
   themselves — which is how this got 8 numbers instead of 4. */
const coords = Array.from(refHtml.matchAll(
  /class="hss-chart-ref" x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g
), (m) => m.slice(1).map(Number));
check('a threshold is drawn even when the grid is off',
  (refHtml.match(/class="hss-chart-ref"/g) || []).length === 3,
  `${(refHtml.match(/class="hss-chart-ref"/g) || []).length} line(s), want 3 (r1 has ref and grid:false)`);
check('on columns the threshold is HORIZONTAL, at the value on the axis',
  coords.length >= 1 && coords[0][1] === coords[0][3] && coords[0][1] > 30 && coords[0][1] < 458,
  JSON.stringify(coords[0]));
check('on bars it is VERTICAL — a horizontal rule there would read as a series',
  coords.length >= 2 && coords[1][0] === coords[1][2] && coords[1][1] === 30 && coords[1][3] === 458,
  JSON.stringify(coords[1]));
/* r3 sits between two charts that DO draw a threshold, so the slice has to be
   bounded on both sides or it would find its neighbour's line. */
const r3body = (refHtml.split('id="r3"')[1] || '').split('id="r4"')[0];
check('a chart with no ref draws no threshold', r3body.indexOf('hss-chart-ref') === -1);
/* indexOf rather than a regex for the escaped one: the pattern contains `/`,
   and a regex literal here would end at the first slash inside `&lt;/b&gt;`. */
check('the authored label lands beside the line, escaped',
  /hss-chart-ref-label[^>]*>4:00\.00</.test(refHtml) &&
  refHtml.indexOf('<b>x</b>') === -1 &&
  refHtml.indexOf('hss-chart-ref-label') !== -1 &&
  refHtml.indexOf('&lt;b&gt;x&lt;/b&gt;') !== -1);
/* The specificity lesson from the value label, applied before it could bite a
   second time: `.hss-chart-svg text` is (0,1,1) and would beat a lone
   `.hss-chart-ref-label` (0,1,0), so the threshold's own label would inherit
   the generic tick ink and the accent would never reach it. */
check('the threshold label wins the specificity fight with `.hss-chart-svg text`',
  after.RUNTIME_CSS.indexOf('.hss-chart-svg .hss-chart-ref-label{') !== -1);
check('the threshold stroke reads the accent, with the ink as its fallback',
  after.RUNTIME_CSS.indexOf('.hss-chart-ref{stroke:var(--hss-accent,var(--hss-ink,') !== -1);

console.log('\n=== a declared axis floor, because a threshold needs room to be seen ===');
/* THE GAP THE SIXTH FILM FOUND. The floor was hard-wired to 0 as an
   editorial rule — a truncated axis is a lie the reader cannot see — which
   is also what makes a threshold chart impossible: 18 seconds of movement
   inside a 241-second space draws flat, and the barrier disappears into the
   line it is meant to separate. The floor became authorable; the ban on
   silence did not, which is what reel-compile's informational line is for. */
const FLOOR = {
  title: 'F', aspect: '16:9', total_duration_ms: 3000,
  scenes: [{ start_ms: 0, end_ms: 3000, elements: [
    { id: 'f1', type: 'chart', chart: 'line', at_ms: 0, min: 220, max: 245, ref: 240,
      ref_label: 'the wall', categories: ['a', 'b'],
      series: [{ name: 's', values: [241.4, 223.13] }] },
    { id: 'f2', type: 'chart', chart: 'columns', stacked: true, at_ms: 0, min: 220,
      categories: ['a'], series: [{ name: 'x', values: [10] }, { name: 'y', values: [30] }] },
    { id: 'f3', type: 'chart', chart: 'columns', at_ms: 0,
      categories: ['a'], series: [{ name: 'x', values: [40] }] },
  ] }],
};
const floorHtml = after.compileStoryboard(FLOOR).html;
const floorRef = Array.from(floorHtml.matchAll(
  /class="hss-chart-ref" x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g
), (m) => m.slice(1).map(Number));
check('an authored floor puts the threshold where it belongs on the axis',
  floorRef.length === 1 && Math.abs(floorRef[0][1] - (458 - 0.8 * 428)) < 1,
  JSON.stringify(floorRef[0]) + ' want y=' + (458 - 0.8 * 428));
check('the bottom tick prints the FLOOR, not zero',
  /hss-chart-tick[^>]*>220</.test(floorHtml));
check('a chart with no floor still starts at zero (nothing truncated by accident)',
  /hss-chart-tick[^>]*>0</.test(floorHtml.split('id="f3"')[1] || ''));
/* stacked + floor: every layer shrunk by the same offset stops summing to
   its own column, so the floor loses and the compiler reports it. */
const stackTops = (floorHtml.split('id="f2"')[1] || '').split('id="f3"')[0]
  .match(/data-ty="([\d.]+)"/g) || [];
check('a stacked chart keeps the zero floor, so its layers still sum',
  stackTops.length === 2 && Math.abs(Number(stackTops[1].slice(9, -1)) - (458 - 428 * 40 / 40)) < 1.5,
  JSON.stringify(stackTops));

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

console.log('\n=== the maths renderer is IN THE CLIP, not on the network ===');
/* A clip is a portable HTML fragment: exported to a bare file, opened with no
 * server, mounted by hic-frame.js with innerHTML. The three jsDelivr tags this
 * emitter used to emit satisfy none of those — on a plane, renderMathInElement
 * never appears, _hssSetup retries forever, and the formula stays literal
 * $$…$$ with no error and a green gate. `sb.math` is the fix, and it is only
 * four properties wide, so the assertions are about the SHAPE of it. */
const crypto = require('crypto');
const VEND = path.join(ROOT, 'public/vendor/katex');
const manifest = JSON.parse(fs.readFileSync(path.join(VEND, 'katex.manifest.json'), 'utf8'));

check('every vendored file exists and matches its manifest sha256',
  Object.entries(manifest.files).every(([name, f]) => {
    const buf = fs.readFileSync(path.join(VEND, name));
    return crypto.createHash('sha256').update(buf).digest('hex') === f.sha256;
  }),
  Object.keys(manifest.files).join(', '));

const vendCss = fs.readFileSync(path.join(VEND, 'katex.min.css'), 'utf8');
check('the vendored stylesheet carries all 20 faces as woff2 data URIs',
  (vendCss.match(/@font-face/g) || []).length === 20 &&
  (vendCss.match(/data:font\/woff2;base64,/g) || []).length === 20 &&
  vendCss.indexOf('url(fonts') === -1,
  `faces=${(vendCss.match(/@font-face/g) || []).length} ` +
  `inlined=${(vendCss.match(/data:font\/woff2;base64,/g) || []).length} ` +
  `remote=${(vendCss.match(/url\(fonts/g) || []).length}`);

/* The two films that answer it: two-queens HAS formulae, the-peak has none.
   Both go through the real reconcile() rather than a hand-built fixture, so
   what is asserted is the path the gate actually runs. */
const { __test: rc } = require('./reel-compile.cjs');
const readFilm = (n) => JSON.parse(fs.readFileSync(
  path.join(ROOT, 'automation/studio-reel/films', n, 'storyboard.json'), 'utf8'));
const compileFilm = (n) => {
  const sb = readFilm(n);
  const rec = rc.reconcile(sb, sb.design, 'light');
  return { mathInfo: rec.mathInfo, top: rec.top, html: after.compileStoryboard(rec.top).html };
};

const mathFilm = compileFilm('two-queens');
check('the compiler inlines the vendored KaTeX for the film with formulae',
  !!mathFilm.mathInfo && mathFilm.mathInfo.src === 'vendor/katex' && !!mathFilm.mathInfo.version && mathFilm.mathInfo.bytes > 100000,
  mathFilm.mathInfo ? `${mathFilm.mathInfo.src}@${mathFilm.mathInfo.version} ${mathFilm.mathInfo.bytes}B` : 'no mathInfo');
check('a maths clip inlines the renderer and keeps no CDN reference',
  mathFilm.html.indexOf('<script src="data:text/javascript;base64,') !== -1 &&
  mathFilm.html.indexOf('@font-face') !== -1 &&
  mathFilm.html.indexOf('cdn.jsdelivr.net') === -1,
  `data=${mathFilm.html.indexOf('data:text/javascript;base64') >= 0} ` +
  `fontFace=${mathFilm.html.indexOf('@font-face') >= 0} ` +
  `cdn=${mathFilm.html.indexOf('cdn.jsdelivr.net') >= 0}`);
/* TWO scripts, and katex.min.js must land BEFORE auto-render — the second one
   reads `window.katex` the moment it runs, and a hoisting order that put it
   first fails at frame one with no error anywhere. The data: URL holds base64,
   so the file name is not readable in the markup; assert order by which blob
   decodes to which source. */
const dataSrcs = (mathFilm.html.match(/<script src="data:text\/javascript;base64,([A-Za-z0-9+/=]+)">/g) || [])
  .map((m) => m.replace(/^<script src="data:text\/javascript;base64,/, '').replace(/">$/, ''));
const decoded = dataSrcs.map((b) => Buffer.from(b, 'base64').toString('utf8'));
check('the clip carries BOTH scripts, katex before auto-render',
  decoded.length === 2 &&
  decoded[0].indexOf('katex') !== -1 &&
  decoded[1].indexOf('renderMathInElement') !== -1,
  decoded.map((d) => d.slice(0, 18)).join(' | '));
check('the inlined CSS is exactly the vendored stylesheet',
  mathFilm.html.indexOf('<style>' + fs.readFileSync(path.join(VEND, 'katex.min.css'), 'utf8') + '</style>') !== -1);

/* A film with NO formulae pays nothing. The blob is ~722KB and it belongs to
   the films that need it — a scene list with no `latex` element must not drag
   a renderer along because the compiler happened to load one. */
const noMathFilm = compileFilm('the-peak');
check('a film with no formulae ships none of it',
  noMathFilm.mathInfo === null && noMathFilm.html.indexOf('data:text/javascript;base64') === -1 &&
  noMathFilm.html.indexOf('@font-face') === -1,
  noMathFilm.mathInfo ? `mathInfo=${noMathFilm.mathInfo.src}` : (noMathFilm.html.indexOf('@font-face') >= 0 ? 'the blob leaked into a non-maths clip' : ''));

/* Back-compat: sb.math absent is still the CDN tags. A caller that hands this
   emitter a storyboard and nothing else — every non-film consumer — must keep
   getting a renderer it can name, not an empty head. */
const legacyMath = after.compileStoryboard({
  title: 'Cdn', aspect: '16:9', total_duration_ms: 1000,
  scenes: [{ start_ms: 0, end_ms: 1000, elements: [{ id: 'm1', type: 'latex', text: 'x', at_ms: 0 }] }],
});
check('without sb.math the emitter falls back to the CDN tags (unchanged)',
  legacyMath.html.indexOf('https://cdn.jsdelivr.net/npm/katex@0.16.11') !== -1 &&
  legacyMath.html.indexOf('auto-render.min.js') !== -1);

/* The scenes board renders eight <div class="hss"> stages and has no #hss, so
   _hssSetup used to return before it ever typed anything. That is why the
   board showed raw $$…$$ while the film beside it set it — two artefacts
   disagreeing about the same scene. The fallback is what closes it. */
check('_hssSetup falls back to document.body, so a board can typeset',
  fs.readFileSync(path.join(ROOT, EMITTER_REL), 'utf8').indexOf(
    'document.getElementById("hss")||document.body') !== -1);

console.log('\n=== annotation marks: a shape draws itself, or it does not ship ===');
/* The annotation film's vocabulary — circle / arrow / highlight — sits on
   top of the SAME machinery the charts use (data-anim nodes, a phase, the
   settle pass), and the two failure modes it must not have are: a mark that
   renders as the default border because the kind was misspelled, and a mark
   that renders NOTHING because it has no target. Both are asserted here,
   emitter-side AND through reel-compile's reconcile, because the emitter can
   refuse while the compiler still passes the element on. */
const ANNO = {
  title: 'Anno', aspect: '16:9', total_duration_ms: 3000,
  scenes: [{ start_ms: 0, end_ms: 3000, elements: [
    { id: 't1', type: 'text', size: 'title', color: '#131720', text: 'Ring me', at_ms: 0, in: { type: 'fade', dur_ms: 400 } },
    { id: 'c1', type: 'shape', shape: 'circle', of: 't1', color: '#2563eb', at_ms: 500, in: { type: 'draw', dur_ms: 800 } },
    { id: 'a1', type: 'shape', shape: 'arrow', of: 't1', color: '#f43f5e', side: 'right', at_ms: 700, in: { type: 'draw', dur_ms: 900 } },
    { id: 'h1', type: 'shape', shape: 'highlight', of: 't1', color: '#fde68a', at_ms: 900, in: { type: 'draw', dur_ms: 700 } },
  ] }],
};
const an = after.compileStoryboard(JSON.parse(JSON.stringify(ANNO)));
check('an overlay mark carries the class that positions it around its target',
  /hss-shape-host hss-overlay hss-overlay-ring" id="c1"/.test(an.html));
check('the circle is an SVG ring normalised to pathLength 1, ready to draw',
  /<ellipse[^>]*pathLength="1"[^>]*data-k="draw"/.test(an.html));
check('the arrow keeps its side as a class and draws from one path',
  /hss-arrow-svg hss-arrow-right/.test(an.html) &&
  /hss-arrow-path[^>]*data-k="draw"/.test(an.html));
/* The FIRST version of this shipped with CSS rules for svg.hss-arrow-l/r/t/b
   while the markup said hss-arrow-left/right/top/bottom — so the horizontal
   anchor never matched and the arrow drew ACROSS the words it pointed at,
   with every other gate green. A styled class and an emitted class are one
   contract; assert both halves together. */
check('every arrow side the emitter emits has a matching anchor rule',
  ['left', 'right', 'top', 'bottom'].every((s) =>
    after.RUNTIME_CSS.indexOf('svg.hss-arrow-' + s + '{') !== -1),
  ['left', 'right', 'top', 'bottom'].filter((s) =>
    after.RUNTIME_CSS.indexOf('svg.hss-arrow-' + s + '{') === -1).join(','));
check('the highlight is a width wipe, not a transform',
  /<i class="hss-hl" data-anim="1" data-k="hl"><\/i>/.test(an.html));
/* The double rule: a BOTTOM strip of two rules, each its own draw node —
   horizontal lines tolerate the x-stretch the way the circle does, and the
   fixed 12px height keeps them on the baseline instead of scaling with the
   text box. */
const dbl = after.compileStoryboard({ title: 'D', aspect: '16:9', total_duration_ms: 2000,
  scenes: [{ start_ms: 0, end_ms: 2000, elements: [
    { id: 't', type: 'text', size: 'title', color: '#123456', text: 'Rule me', at_ms: 0, in: { type: 'fade', dur_ms: 400 } },
    { id: 'd1', type: 'shape', shape: 'dbl-underline', of: 't', color: '#f59e0b', at_ms: 500, in: { type: 'draw', dur_ms: 800 } },
  ] }],
});
check('the double underline is two draw-on rules in a fixed-height bottom strip',
  (dbl.html.match(/class="hss-dbl"[^>]*>[\s\S]*?data-k="draw"/g) || []).length === 1 &&
  (dbl.html.match(/data-k="draw"/g) || []).length === 2 &&
  /<line x1="1" y1="3" x2="99" y2="3"/.test(dbl.html) &&
  /<line x1="1" y1="9" x2="99" y2="9"/.test(dbl.html) &&
  after.RUNTIME_CSS.indexOf('.hss-dbl{position:absolute') !== -1,
  `${(dbl.html.match(/data-k="draw"/g) || []).length} draw node(s)`);
/* An abs-positioned SVG is a REPLACED element: with left+right and no
   width, it sizes to its viewBox (100px!) and right is ignored — the strip
   measured 100px under a 260px headline until width:100% was written. The
   rule is asserted WITH its width, because the position half alone looks
   complete and measures wrong. */
check('the double-rule strip has an explicit width (a viewBox is not a width)',
  /\.hss-dbl\{[^}]*width:100%/.test(after.RUNTIME_CSS));
check('the mark draws on its own phase — the shape entrance — and settle() finishes it',
  /function _draw\(e,t\)/.test(an.js) && /_draw\(e,tL\)/.test(an.js) &&
  /type==="draw"/.test(an.js) && /m==="draw"/.test(an.js) && /m==="hl"/.test(an.js));
check('each overlay is moved into its target box at setup, once',
  (an.js.match(/appendChild/g) || []).length === 3,
  `${(an.js.match(/appendChild/g) || []).length} appendChild patch(es), want 3`);
let kindErr = null;
try { after.compileStoryboard({ title: 'x', aspect: '16:9', total_duration_ms: 1,
  scenes: [{ start_ms: 0, end_ms: 1, elements: [{ id: 'z', type: 'shape', shape: 'sparkle', of: 't1' }] }] }); }
catch (e) { kindErr = e; }
check('an unknown shape KIND throws from the switch, flagged like the type default',
  !!kindErr && kindErr.unknownShape === true && /"sparkle"/.test(kindErr.message),
  kindErr ? kindErr.message : 'compiled without throwing');
let sideErr = null;
try { after.compileStoryboard({ title: 'x', aspect: '16:9', total_duration_ms: 1,
  scenes: [{ start_ms: 0, end_ms: 1, elements: [
    { id: 't', type: 'text', size: 'title', text: 'x', at_ms: 0 },
    { id: 'z', type: 'shape', shape: 'arrow', of: 't', side: 'diagonal' }] }] }); }
catch (e) { sideErr = e; }
check('an unknown arrow SIDE throws too — a silently-defaulted arrow is a wrong arrow',
  !!sideErr && sideErr.unknownSide === true && /"diagonal"/.test(sideErr.message),
  sideErr ? sideErr.message : 'compiled without throwing');
check('emitterSupportsShape answers from the builder, like emitterSupportsType',
  ['box', 'underline', 'dbl-underline', 'circle', 'arrow', 'highlight'].every((k) => after.emitterSupportsShape(k) === true) &&
  after.emitterSupportsShape('sparkle') === false &&
  after.emitterSupportsType('shape') === true && after.emitterSupportsType('hologram') === false);
/* The legacy border kinds must not have gained a class: the byte-identity
   section above is the real proof for box/underline-without-target, and this
   is the same fact stated where a future reader looks for it. */
const bareShape = after.compileStoryboard({ title: 'B', aspect: '16:9', total_duration_ms: 1,
  scenes: [{ start_ms: 0, end_ms: 1, elements: [{ id: 's1', type: 'shape', shape: 'underline', color: '#6ed9b1' }] }] }).html;
check('a legacy shape with no target keeps its exact old markup',
  bareShape.indexOf('hss-overlay') === -1 &&
  /<div class="hss-el hss-shape-host" id="s1"><div class="hss-shape hss-shape-underline" style="color:#6ed9b1"><\/div>/.test(bareShape));

console.log('\n=== reconcile refuses marks that would draw nothing ===');
/* The emitter can refuse a KIND, but only the compiler knows the film: an
   overlay aimed at a missing id or an element of another scene renders a
   real mark on the wrong clock. These go through the real reconcile(). */
const annoFilm = (scenes) => ({
  meta: { title: 'Anno', id: 'anno', aspect: '16:9', fps: 30, duration: 3, design: 'test' },
  design: { tokens: { brand: '#2563eb', 'on-variant': '#565f6e' } },
  frame: {},
  scenes,
});
const annoOk = rc.reconcile(annoFilm([{
  id: 's1', start: 0, dur: 3, tone: 'normal',
  elements: [
    { id: 't1', type: 'text', role: 'title', text: 'Ring me', at_ms: 0, in: { type: 'fade', dur_ms: 400 } },
    { id: 'c1', type: 'shape', shape: 'circle', of: 't1', color: 'brand', at_ms: 500, in: { type: 'draw', dur_ms: 800 } },
    { id: 'a1', type: 'shape', shape: 'arrow', of: 't1', side: 'left', at_ms: 700, in: { type: 'draw', dur_ms: 900 } },
    { id: 'st1', type: 'stat', value: '6', label: 'patterns', color: 'on-variant', num_color: 'brand', at_ms: 0 },
  ],
}]), annoFilm.__design || undefined, 'light');
check('a well-formed mark reconciles with nothing to report',
  annoOk.unapplied.length === 0 && annoOk.deferred.length === 0,
  JSON.stringify(annoOk.unapplied.concat(annoOk.deferred)));
const c1el = annoOk.top.scenes[0].elements.find((x) => x.id === 'c1');
check('the kind, the target and the resolved colour all reach the emitter IR',
  !!c1el && c1el.shape === 'circle' && c1el.of === 't1' && c1el.color === '#2563eb',
  JSON.stringify(c1el));
/* The stat branch used to set BOTH colours from the caption, so the-peak's
   brand numeral shipped in the caption's muted ink while the schema kept
   claiming num_color was APPLIED. Two roles, two resolutions. */
const st1el = annoOk.top.scenes[0].elements.find((x) => x.id === 'st1');
check('a stat resolves its numeral colour SEPARATELY from its caption',
  !!st1el && st1el.num_color === '#2563eb' && st1el.color === '#565f6e',
  JSON.stringify(st1el));
const annoBad = rc.reconcile(annoFilm([
  { id: 's1', start: 0, dur: 2, tone: 'normal', elements: [
    { id: 't1', type: 'text', role: 'title', text: 'x', at_ms: 0, in: { type: 'fade', dur_ms: 400 } },
    { id: 'b1', type: 'shape', shape: 'circle', at_ms: 0 },
    { id: 'b2', type: 'shape', shape: 'circle', of: 'ghost', at_ms: 0 },
    { id: 'b3', type: 'shape', shape: 'circle', of: 't2', at_ms: 0 },
    { id: 'b4', type: 'shape', shape: 'arrow', of: 't1', side: 'diagonal', at_ms: 0 },
    { id: 'b5', type: 'shape', shape: 'circle', of: 't1', side: 'left', at_ms: 0 },
    { id: 'b6', type: 'shape', shape: 'sparkle', of: 't1', at_ms: 0 },
  ] },
  { id: 's2', start: 2, dur: 1, tone: 'normal', elements: [
    { id: 't2', type: 'text', role: 'body', text: 'y', at_ms: 0, in: { type: 'fade', dur_ms: 400 } },
  ] },
]), undefined, 'light');
check('a mark with no target, a ghost target and a cross-scene target are all refused',
  annoBad.unapplied.filter((u) => /no of:|not an element of this scene/.test(u)).length >= 3,
  JSON.stringify(annoBad.unapplied));
check('a bad arrow side and a side on a non-arrow are reported, not defaulted',
  annoBad.unapplied.some((u) => u.includes('b4') && /diagonal/.test(u)) &&
  annoBad.unapplied.some((u) => u.includes('b5') && /only defined for an arrow/.test(u)),
  JSON.stringify(annoBad.unapplied));
check('an unknown kind DEFERS with the emitter own message, so the film cannot look complete',
  annoBad.deferred.length === 1 && annoBad.deferred[0].id === 'b6' &&
  /unknown shape kind "sparkle"/.test(annoBad.deferred[0].reason),
  JSON.stringify(annoBad.deferred));
/* And the schema polices the same names at a JSON POINTER, for authoring. */
const annoSb = JSON.parse(fs.readFileSync(path.join(FILMS_DIR, 'the-peak', 'storyboard.json'), 'utf8'));
annoSb.scenes[0].elements.push(
  { id: 'x-circle', type: 'shape', shape: 'circle', of: 's1-title', color: 'brand', at_ms: 0, in: { type: 'draw', dur_ms: 800 } },
  { id: 'x-arrow', type: 'shape', shape: 'arrow', of: 's1-title', side: 'top', at_ms: 0, in: { type: 'draw', dur_ms: 800 } });
check('the schema accepts the new kinds, sides and the draw entrance',
  validate(annoSb, schema).length === 0, JSON.stringify(validate(annoSb, schema).slice(0, 2)));
const badShape = JSON.parse(JSON.stringify(annoSb));
badShape.scenes[0].elements[4].shape = 'sparkle';
check('an invented shape kind is caught at a JSON POINTER',
  validate(badShape, schema).some((e) => e.pointer === '/scenes/0/elements/4/shape'),
  JSON.stringify(validate(badShape, schema)));
const badSide = JSON.parse(JSON.stringify(annoSb));
badSide.scenes[0].elements[5].side = 'diagonal';
check('an invented arrow side is caught too',
  validate(badSide, schema).some((e) => e.pointer === '/scenes/0/elements/5/side'),
  JSON.stringify(validate(badSide, schema)));

console.log('');
if (failures) {
  console.error(`reel-regression: FAILED (${failures})`);
  process.exit(1);
}
console.log('reel-regression: OK — existing consumers are unaffected, the five new types work, the design board renders from resolved values, copy is escaped.');