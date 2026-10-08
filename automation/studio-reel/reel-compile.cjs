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
 * Step 3 is answered by the emitter, not by a list here. buildElHtml() used to
 * have no `default` case, so an element type it did not know silently emitted
 * `<div class="hss-el" id=…></div>` — an empty div, no warning, no error. This
 * script kept `BUILDABLE`, a hand-kept copy of the switch's case labels, and
 * asked that instead; it had already drifted once (the emitter grew `chart`
 * and nothing forced the copy to follow). The emitter now throws on an unknown
 * type and exports emitterSupportsType(), which runs the switch itself, so
 * "can the emitter build this?" and "what does the emitter say?" are the same
 * question asked once — and step 5's inventory is the emitter's own answer.
 *
 * Usage:
 *   node automation/studio-reel/reel-compile.cjs                 # compile + gate
 *   node automation/studio-reel/reel-compile.cjs --write-clip    # also emit .reel-clip.json
 *   node automation/studio-reel/reel-compile.cjs --write-html    # also emit a standalone reel page
 *   node automation/studio-reel/reel-compile.cjs --write-scenes  # also emit scenes-preview.html (all scenes, settled)
 *   node automation/studio-reel/reel-compile.cjs --write-design  # also emit design-preview.html (the style board)
 *   node automation/studio-reel/reel-compile.cjs --only <film>   # pick one film
 *   node automation/studio-reel/reel-compile.cjs --mode dark     # swap design.modes.dark into the tokens
 *
 * A design system that ships two themes (Material's light/dark, an OS
 * high-contrast pair) cannot be expressed by one compiled clip, because the
 * emitter holds ONE background colour and ONE set of theme variables for the
 * whole reel. So a film authors both modes side by side and the mode is a
 * compile-time choice: same storyboard, same scenes, same timing, one
 * resolved token table. --mode default is 'light'.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');
const EMITTER = path.join(ROOT, 'docs/html-in-canvas/hic-storyboard.js');

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

/* ── TYPE SCALES ───────────────────────────────────────────────────────
 * A film should not have to hand-author nine ramp steps to get readable type.
 * These are the four shapes that actually recur, named for what they are FOR
 * rather than for a look. Sizes are 1920x1080 design-space px, which is what
 * frame.ramp already uses.
 *
 * `poster`      one enormous word per frame; body exists only for a caption
 * `editorial`   headline + standfirst + prose, the newspaper/magazine shape
 * `documentary` long-form captions and quotes, legibility over impact
 * `data`        numerals and labels dominate; dense, small display
 *
 * A preset is a FLOOR, not a replacement: frame.ramp entries win, so a film
 * can take `editorial` and still override two roles. */
const TYPE_SCALES = {
  poster: {
    display: { size: 140, weight: 800, tracking: '-2px', case: 'upper' },
    display_hi: { size: 112, weight: 800, tracking: '-2px', case: 'upper' },
    title: { size: 108, weight: 800, tracking: '-2px' },
    title_hi: { size: 76, weight: 700, tracking: '-1px' },
    lead: { size: 34, weight: 400 }, lead_hi: { size: 30, weight: 400 },
    body: { size: 26, weight: 400 }, body_hi: { size: 24, weight: 400 },
    overline: { size: 22, weight: 500, tracking: '0.16em', case: 'upper' },
    tag: { size: 17, weight: 700, tracking: '0.08em', case: 'upper' },
    mono: { size: 22, weight: 500, tracking: '0.06em', case: 'upper' },
    math: { size: 62 }, math_sm: { size: 40 }, answer: { size: 108, weight: 700 },
  },
  editorial: {
    display: { size: 96, weight: 500, tracking: '-0.01em' },
    display_hi: { size: 80, weight: 500, tracking: '-0.01em' },
    title: { size: 92, weight: 500, tracking: '-0.01em' },
    title_hi: { size: 58, weight: 500, tracking: '-0.01em' },
    lead: { size: 32, weight: 400 }, lead_hi: { size: 30, weight: 400 },
    body: { size: 26, weight: 400 }, body_hi: { size: 24, weight: 400 },
    overline: { size: 22, weight: 500, tracking: '0.16em', case: 'upper' },
    tag: { size: 17, weight: 500, tracking: '0.08em', case: 'upper' },
    mono: { size: 22, weight: 500, tracking: '0.06em', case: 'upper' },
    math: { size: 62 }, math_sm: { size: 40 }, answer: { size: 108, weight: 500, tracking: '-0.02em' },
  },
  documentary: {
    display: { size: 84, weight: 600, tracking: '-0.01em' },
    display_hi: { size: 72, weight: 600, tracking: '-0.01em' },
    title: { size: 76, weight: 600, tracking: '-0.01em' },
    title_hi: { size: 52, weight: 600, tracking: '-0.005em' },
    lead: { size: 36, weight: 400 }, lead_hi: { size: 34, weight: 400 },
    body: { size: 30, weight: 400 }, body_hi: { size: 28, weight: 400 },
    overline: { size: 22, weight: 600, tracking: '0.14em', case: 'upper' },
    tag: { size: 18, weight: 600, tracking: '0.08em', case: 'upper' },
    mono: { size: 22, weight: 500, tracking: '0.06em', case: 'upper' },
    math: { size: 58 }, math_sm: { size: 38 }, answer: { size: 92, weight: 600 },
  },
  data: {
    display: { size: 88, weight: 700, tracking: '-0.02em' },
    display_hi: { size: 72, weight: 700, tracking: '-0.02em' },
    title: { size: 72, weight: 700, tracking: '-0.01em' },
    title_hi: { size: 46, weight: 600, tracking: '-0.005em' },
    lead: { size: 28, weight: 400 }, lead_hi: { size: 27, weight: 400 },
    body: { size: 24, weight: 400 }, body_hi: { size: 23, weight: 400 },
    overline: { size: 20, weight: 600, tracking: '0.14em', case: 'upper' },
    tag: { size: 17, weight: 600, tracking: '0.08em', case: 'upper' },
    mono: { size: 21, weight: 500, tracking: '0.06em', case: 'upper' },
    math: { size: 56 }, math_sm: { size: 38 }, answer: { size: 96, weight: 700 },
  },
};

/* Theme roles a film can point at a token, and the emitter theme key each one
 * lands in. `design.theme_map` names WHICH token fills each role, because the
 * token names are the brand's: Material says "on-surface" where synthwave
 * brutalism says "coal". Hardcoding coal/white meant a brand with neither
 * lost its ink colour and silently kept the runtime default - the same class
   of bug as hardcoding the first film's tone names. A role named here that is
   NOT in this set fails the gate rather than being dropped. */
const THEME_ROLES = {
  panel: 'panel', ink: 'ink', meter: 'meter', 'meter-track': 'meter-track',
  accent: 'accent', 'num-a': 'num-a', 'num-b': 'num-b', 'slab-ink': 'slab-ink',
  /* The tonal surface: a filled panel and a tonal panel are the same component
     in two treatments, and the difference is the container colour, which is a
     THEME role rather than a per-element literal — otherwise re-theming loses
     it and the dark mode of a Material film shows light-mode tonal fills.
     `fill`/`fill-ink` are container/on-container: a filled block is a bright
     field carrying dark type, which is the slab-ink trap one level up. */
  'fill-tone': 'fill-tone', fill: 'fill', 'fill-ink': 'fill-ink', outline: 'outline',
  /* the chart roles. A categorical palette belongs to the design language, not
     to one chart: five graphics that each picked their own blue are five
     graphics that do not look like one publication. Declared here so
     `design.theme_map` can point them at tokens the same way every other role
     is pointed — which is what makes them swap with `--mode`. */
  s1: 's1', s2: 's2', s3: 's3', s4: 's4', s5: 's5', s6: 's6',
  'chart-grid': 'chart-grid', 'on-variant': 'on-variant',
};

/* The four visual treatments a component can take, and the four components
 * that have one. `filled` is the panel surface, `tonal` the low-emphasis
 * container, `outlined` the border, `text` the bare label — Material's four,
 * which is where the vocabulary comes from. Everything else in the design
 * (`design.style: "neo-brutalism"`) is a NAME for a combination of these, which
 * is why it was reportable and unactionable for so long. */
const FILLS = ['filled', 'tonal', 'outlined', 'text'];
const FILL_COMPONENTS = { card: 'card', tiles: 'tile', pills: 'pill', answer: 'answer' };
const FILL_RADIUS = { pill: 'radius-pill', card: 'radius-card', tile: 'radius-tile', answer: 'radius-answer' };

/* How a group's contents are arranged. `row` is the centre-column model that
 * has always existed; `grid` is what a two-column "given | solving" solve
 * needs, which `row` cannot express because a wrapping flex row is not a grid
 * and `columns` on a row is silently nothing. */
const LAYOUTS = ['row', 'grid'];
const ALIGNS = ['start', 'center', 'end'];

/* DEFER_REASON used to live here: a hand-written apology per type the emitter
 * could not build, keyed by type name. Five of its six entries went stale the
 * moment the emitter grew cases for those types, and the sixth was keyed to a
 * type that already built — a table of reasons is a table that can disagree
 * with the thing it describes. The reason now comes from the emitter's own
 * error (see emitterSupportsType), which is the code that refuses.
 */
/* Recursively find which authored fields the emitter never reads. Kept as data
 * so the note cannot rot into a claim: every one of these is present in the IR
 * and provably discarded by the emitter. */
const IGNORED_BY_EMITTER = [
  'tokens (the emitter has no token resolver; colours are literals per element)',
  'frame  (design space, safe areas, type ramp — the emitter is stage-relative and hardcodes its own type ramp)',
  'scenes[].background (now APPLIED per scene — flat, dots and gradient recipes; an unknown type is still reported)',
  'scenes[].ambient (no decorative-layer concept at all — 3 layers in this film)',
  'scenes[].exit, scenes[].tone, scenes[].frame',
  'elements[].role, .place, .value, .small, .items, .width (role drives the ramp and the font; columns now reach a grid group)',
  'elements[].rotate (a static rotation cannot be applied: the runtime OWNS transform on every frame — _ap writes scale()/translate() — so any authored angle would be overwritten 60 times a second. It needs a composite, not a declaration.)',
];

/* Resolve one role's type step: frame.ramp wins, a named preset fills the
   gaps, `type_scale.scale` multiplies, `type_scale.overrides` patches
   individual roles, and `type_scale.min_px` becomes a FLOOR so the text
   stays legible when the film is embedded somewhere narrower than the
   design space. Returns null when the role has no step at all, which is how
   the caller tells "authored at the runtime default" from "authored". */
/* ── SURFACES ─────────────────────────────────────────────────────────
 * A background declaration -> the CSS `background` shorthand. Kept in ONE
 * place because a design's reel background, a mode's reel background and a
 * scene background all go through it: three copies of a gradient recipe would
 * drift, and drift here means a light mode that is 2% different from the dark
 * one in a way nobody notices until export.
 *
 * `dots` is the repeating grid three films author; `gradient` is the flat
 * two-stop case; anything else is reported rather than silently flattened. */
const SURFACES = {
  flat: (d) => (d.base ? 'background:' + d.base : null),
  /* every recipe returns a COMPLETE declaration list starting with a property
     name. Returning a bare value here once produced
     `background:background-image:…`, which is silently ignored by CSS — the
     exact "valid-looking, renders nothing" class this layer exists to remove. */
  dots: (d) => (d.base ? 'background:' + d.base + ';' : '')
    + 'background-image:' + patternImage('dots', d)
    + ';background-size:' + (d.size || '32px 32px') + ';background-repeat:repeat',
  /* a blueprinted grid: two crossing line sets in the ink colour */
  blueprint: (d) => (d.base ? 'background:' + d.base + ';' : '')
    + 'background-image:linear-gradient(' + (d.ink || '#fff') + ' ' + (d.weight || '1px') + ',transparent ' + (d.weight || '1px') + '),'
    + 'linear-gradient(90deg,' + (d.ink || '#fff') + ' ' + (d.weight || '1px') + ',transparent ' + (d.weight || '1px') + ')'
    + ';background-size:' + (d.size || '40px 40px') + ';background-repeat:repeat',
  gradient: (d) => (d.base ? 'background:' + d.base + ';' : '')
    + 'background-image:linear-gradient(' + num(d.angle, 0, 360) + 'deg,'
    + (d.from || d.a || '#000') + ' 0%,' + (d.to || d.b || '#fff') + ' 100%);background-repeat:no-repeat',
  /* breath-of-air authors the CSS function name as the type and the whole
     gradient body as `value`. Passing that through is honest — it is a
     verbatim CSS gradient the author wrote — but it is guarded the same way
     every other authored string that becomes CSS is. */
  'linear-gradient': (d) => (d.base ? 'background:' + d.base + ';' : '')
    + 'background-image:linear-gradient(' + cssOnly(d.value) + ');background-repeat:no-repeat',
  'radial-gradient': (d) => (d.base ? 'background:' + d.base + ';' : '')
    + 'background-image:radial-gradient(' + cssOnly(d.value) + ');background-repeat:no-repeat',
};

/* Authored copy reaches CSS here, so it gets the same guard the theme layer
   uses: a `;` or `}` would end the declaration and let the rest of the string
   become new rules. Reject rather than escape — a silently-dropped background
   is the exact failure this whole surface was added to remove. */
function cssOnly(v) {
  if (typeof v !== 'string' || !v) return null;
  if (/[;{}<>]/.test(v)) return null;
  return v;
}
function patternImage(kind, d) {
  if (kind === 'dots') return 'radial-gradient(' + (d.ink || 'rgba(255,255,255,.08)') + ' 1px, transparent 1.25px)';
  return null;
}/* Two consumers, two shapes — and conflating them is a bug I actually made:
 * the REEL root wants a bare COLOUR (its style string is assembled by the
 * emitter around `background:`), while a SCENE wants a complete DECLARATION
 * LIST. Returning the bare colour for both emitted `style="#f8faf8;"` on every
 * flat scene, which CSS ignores silently. Keep them apart. */
function surfaceColor(d) {
  if (!d || typeof d !== 'object') return null;
  return d.base || null;
}

/* A surface for one SCENE node. Returns a complete declaration list, or null
 * when the declaration names a recipe nobody implements. */
function compileSurface(d) {
  if (!d || typeof d !== 'object') return null;
  const make = SURFACES[d.type || 'flat'];
  if (!make) return null;
  return make(d);
}

function resolveRamp(sb, design, role) {
  if (!role) return null;
  const ts = (design && design.type_scale) || {};
  let step = (sb.frame && sb.frame.ramp && sb.frame.ramp[role]) || null;
  if (!step && ts.preset && TYPE_SCALES[ts.preset]) step = TYPE_SCALES[ts.preset][role] || null;
  if (!step) return null;
  const ov = (ts.overrides || {})[role];
  step = Object.assign({}, step, ov || {});
  if (step.size !== undefined) step.size = step.size * (ts.scale || 1);
  step.min_px = ts.min_px || 0;
  return step;
}

/* px at the 1920 design space → a stage-relative CSS length.
 *
 * `vw` is what makes a clip resolution-independent, and it is also why type
 * vanishes when the film is embedded small: 30px of design type is 1.563vw,
 * which is 8px in a 512px preview and 1.3px on a phone. `max(vw, Npx)` keeps
 * the film identical at its design size and legible below it. The floor is a
 * deliberate trade: a narrow embed gets bigger type and therefore more line
 * wraps, which is the correct failure for a thumbnail. */
function toLength(px, minPx) {
  const vw = (px / 19.2).toFixed(3) + 'vw';
  return minPx ? 'max(' + vw + ',' + minPx + 'px)' : vw;
}

/* Resolve --mode against design.modes.<mode> BEFORE anything reads the
 * tokens. A mode entry may carry `tokens` (merged over the base table),
 * `background` (replacing design.background) and `elevation` (replacing the
 * base elevation). Merging rather than swapping means a mode only has to name
 * what actually differs, which for Material is most of the palette and none
 * of the radii. Returns the design object to use - the ORIGINAL is not
 * mutated, so a film compiled twice in one process cannot leak light into
 * dark. */
function resolveMode(sb, mode) {
  const d = sb.design;
  if (!d || typeof d !== 'object') return { design: d, modes: [] };
  const declared = d.modes ? Object.keys(d.modes) : [];
  if (!declared.length) return { design: d, modes: [] };
  if (!declared.includes(mode)) {
    return { design: d, modes: declared, error: `mode "${mode}" is not declared; this film has ${declared.join(', ')}` };
  }
  const m = d.modes[mode];
  return {
    design: Object.assign({}, d, {
      tokens: Object.assign({}, d.tokens, m.tokens || {}),
      background: m.background || d.background,
      elevation: m.elevation || d.elevation,
      border: m.border || d.border,
      /* `type_scale` is declared per-mode in the schema, so merging it is the
       difference between the schema and the resolver agreeing. A mode may
         tighten type in dark mode without the film restating the ramp. */
      type_scale: m.type_scale || d.type_scale,
      radii: m.radii || d.radii,
    }),
    modes: declared,
    /* names every token the mode overrode, so the log proves the swap landed
       instead of leaving us to diff two hex strings by eye */
    swapped: Object.keys(m.tokens || {}),
  };
}

/* The emitter, loaded once per process. reconcile() asks the emitter whether it
 * can build an element type, so it needs the emitter — and reconcile is also
 * called directly by reel-contrast and reel-extent through __test, which never
 * went through main()'s single loadEmitter(). Memoised rather than threaded
 * through a fourth parameter: the answer is a pure function of the file, and a
 * caller that forgets to pass it would end up asking a list again instead of
 * the switch. */
let _emitterApi = null;
function emitterApi() { return _emitterApi || (_emitterApi = loadEmitter()); }

/* ── the vendored maths renderer ────────────────────────────────────────
 * Where `design.math.src` points when it is unauthored, and the three files a
 * clip needs from there. Written by automation/studio-reel/vendor-katex.cjs. */
const MATH_DEFAULT_SRC = 'vendor/katex';
const KATEX_FILES = { css: 'katex.min.css', js: 'katex.min.js', render: 'auto-render.min.js' };

/* `design.math.src` is spelled the way the SITE names the folder —
 * "vendor/katex", which is what Vite serves from public/ — while this script
 * has to find it on DISK, which is one directory above that URL. Both
 * spellings resolve, so the author never has to know which side of the
 * web-root seam they are standing on. */
function findKatexDist(src) {
  for (const dir of [path.join(ROOT, 'public', src), path.join(ROOT, src)]) {
    const files = {};
    for (const [k, f] of Object.entries(KATEX_FILES)) files[k] = path.join(dir, f);
    if (Object.values(files).every((f) => fs.existsSync(f))) {
      /* Summed BEFORE version/bytes are added, so the reduce never stats a
         field that was added to this very map one line earlier. */
      files.bytes = Object.values(files).reduce((a, f) => a + fs.statSync(f).size, 0);
      const mp = path.join(dir, 'katex.manifest.json');
      files.version = fs.existsSync(mp) ? (JSON.parse(fs.readFileSync(mp, 'utf8')).version || null) : null;
      return files;
    }
  }
  return null;
}

/* One <style> plus two data: URLs — the emitter's `sb.math` shape exactly.
 * The scripts are data: URIs rather than inline <script> bodies because
 * hic-frame.js mounts clip html with innerHTML, where an inline script never
 * runs; a data: URL is an EXTERNAL script, so it is hoisted and executed by
 * the renderer and by a plain document alike, with no server needed. See the
 * long note in hic-storyboard.js. Base64, so the attribute carries no quote
 * and no `<` that could break either parse. */
function inlineKatex(files) {
  const dataUrl = (f) => '<script src="data:text/javascript;base64,' +
    fs.readFileSync(f).toString('base64') + '"></script>';
  return {
    css: '<style>' + fs.readFileSync(files.css, 'utf8') + '</style>',
    scripts: [dataUrl(files.js), dataUrl(files.render)],
  };
}

function reconcile(sb, designIn, mode) {
  const deferred = [];
  const scenes = [];
  const warnings = [];
  const unsafe = [];
  const informational = [];
  /* Choices that ARE applied but are invisible unless printed: a non-zero axis
     floor, most of all. The default is 0 precisely because a truncated axis
     is a lie the reader cannot see — so a film that lifts it is making an
     editorial decision the log should show, not a bug the log should hide. */
  const declared = [];
  /* Declared with the other inventories rather than with the theme block
     below, because the scene loop now reports on it too: a bad `fill` is found
     while walking elements, and a lexical `const` declared further down is in
     its TDZ for the whole loop. */
  const unapplied = [];
  const design = designIn || sb.design;

  /* A scene's `tone` names a colour in ITS OWN design's vocabulary. JAN
     Suraj's tones are yellow/saffron/green/blue; breath-of-air's are
     normal/alarm/positive. Resolving against the film's own tokens is what
     makes a second brand's palette reach the film at all — hardcoding the
     first film's tone names is how every element came out the default
     #f8fafc regardless of what the brand said. */
  const designTokens = (design && design.tokens) || {};
  const toneHex = (tone) => {
    const t = designTokens[tone];
    if (typeof t === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(t)) return t;
    if (tone === 'normal' && designTokens.paper) return designTokens.paper;
    return TONE_HEX[tone] || DEFAULT_HEX;
  };

  /* An element may name its own colour, and the name is either a literal hex
     or a TOKEN in the film's own palette. Before this, `text` took the scene
     tone and `latex`/`answer` took NOTHING — the emitter hardcodes #ffffff
     and #6ed9b1. So a maths film could not restate the equation in ink, and
     the moment a design's background stopped being near-black the maths was
     white-on-white. `e.color` beats the scene tone; an unresolvable name is
     reported rather than silently dropped. */
  const HEX = /^#[0-9a-fA-F]{3,8}$/;
  const resolveColor = (c) => {
    if (typeof c !== 'string' || !c) return null;
    if (HEX.test(c)) return c;
    const t = designTokens[c];
    if (typeof t === 'string' && HEX.test(t)) return t;
    warnings.push(`unresolvable colour "${c}" — not a hex and not a token in design.tokens; falling back to the scene tone`);
    return null;
  };

  const top = {
    title: sb.meta.title,
    id: sb.meta.id,
    aspect: sb.meta.aspect,
    fps: sb.meta.fps,
    total_duration_ms: Math.round(sb.meta.duration * 1000),
  };

  /* Theme roles are resolved from the MODE-RESOLVED design, and a role that
     names a token the design does not have is a hard gate failure rather
     than a silent fallback to the runtime default. */
  const themeMap = (design && design.theme_map) || {};
  const role = (r) => {
    const name = themeMap[r];
    return name ? designTokens[name] : undefined;
  };

  /* The stage surface. The emitter holds ONE colour plus an optional repeating
     image, so both a flat fill and a dot grid are expressible. Before this,
     every film inherited the emitter's #0e1512 default — three near-black
     designs where nobody noticed, and a light design would have been
     unreadable. Supporting the PATTERN matters for more than looks: a film
     whose surface is the emitter's default instead of its own token cannot be
     re-themed at all, so `--mode light` was structurally impossible for the
     three dotted films until now. */
  const PATTERNS = {
    dots: (d) => 'radial-gradient(' + d.ink + ' 1px, transparent 1.25px)',
  };
  const bgDecl = design && design.background;
  const resolvedBg = surfaceColor(bgDecl);
  if (resolvedBg) top.background = resolvedBg;
  let patternApplied = false;
  if (bgDecl && bgDecl.type && bgDecl.type !== 'flat') {
    const make = PATTERNS[bgDecl.type];
    if (make && bgDecl.ink) {
      top.background_image = make(bgDecl);
      top.background_size = bgDecl.size || undefined;
      patternApplied = true;
    }
  }

  /* The base table's background, before any mode overrode it. A scene that
     names exactly that colour is stating the same fact twice, so it is not a
     loss — including in dark mode, where the mode's background has since
     moved on and the scene's authored hex is simply the light theme's
     spelling of the same field. */
  const baseBg = (sb.design && sb.design.background && sb.design.background.type === 'flat')
    ? sb.design.background.base : null;
  /* Scenes whose authored background was the reel's own, and so follows the
     mode instead of pinning the light theme's hex. Reported because dropping an
     authored field should always be visible. */
  const repeatedStageBg = [];

  for (const sc of sb.scenes) {
    const out = {
      id: sc.id,
      start_ms: Math.round(sc.start * 1000),
      end_ms: Math.round((sc.start + sc.dur) * 1000),
      elements: [],
    };
    /* Per-scene surface and layout now REACH the film. This was the single
       largest discarded authored field across four films (30 scene
       backgrounds), and it also made a light variant structurally impossible:
       a film whose scenes all named the reel's own background was fine, but
       the emitter still held one colour for the whole reel. */
    const scBg = compileSurface(sc.background);
    /* A scene that names EXACTLY the reel's own flat background is stating the
       same fact twice. That was harmless while every film had one background —
       and it stops being harmless the moment a film declares runtime modes,
       because the scene's authored hex is the LIGHT theme's spelling of that
       field and the mode has since moved on. Emitting it painted `#f8faf8`
       over a `#101412` dark stage: every scene of the dark preview was the
       wrong colour while the tiles inside it were correctly dark. Drop it, so
       the mode's stage shows through.
       Only for films that DECLARE modes — without them the authored hex and
       the stage are the same colour and removing it would change the markup
       for no reason. */
    const repeatsStage = !!(design && design.modes && Object.keys(design.modes).length > 1)
      && baseBg && sc.background && sc.background.type === 'flat' && sc.background.base === baseBg;
    if (repeatsStage) repeatedStageBg.push(sc.id);
    else if (scBg) out.bg = scBg;
    else if (sc.background && sc.background.type && sc.background.type !== 'flat' && sc.background.base) {
      warnings.push(`${sc.id}: background type "${sc.background.type}" has no emitter recipe — using the reel background`);
    }
    if (sc.gap !== undefined && sc.gap !== null) out.gap = sc.gap;
    if (sc.background && sc.background.type && !SURFACES[sc.background.type] && !compileSurface(sc.background)) {
      warnings.push(`${sc.id}: background type "${sc.background.type}" is not implemented (known: ${Object.keys(SURFACES).join(', ')})`);
    }
    if (sc.ambient && sc.ambient.length) {
      warnings.push(`${sc.id}: ${sc.ambient.length} ambient layer(s) ignored — no decorative-layer concept`);
    }
    /* Every id in THIS scene. A shape annotates a sibling: the overlay is
       moved into the target's box at setup, so `of` naming a missing id or an
       element of another scene would move the mark into a host that hides on
       a different clock — rendered, and wrong, with nothing reporting it. */
    const sceneIds = new Set(sc.elements.map((x) => x.id));
    for (const e of sc.elements) {
      /* Asked of the emitter's switch, not of a list here. The reason is the
         emitter's own message, so the inventory cannot describe a refusal
         differently from the refusal itself. */
      if (!emitterApi().emitterSupportsType(e.type)) {
        deferred.push({ scene: sc.id, id: e.id, type: e.type, reason: emitterApi().unknownTypeError(e.type).message });
        continue;
      }
      const el = { id: e.id, type: e.type, at_ms: e.at_ms || 0 };
      const hex = resolveColor(e.color) || toneHex(sc.tone);
      if (e.type === 'text') {
        const size = ROLE_SIZE[e.role] || 'body';
        el.size = size;
        el.color = hex;
        el.text = e.text;
        /* Resolve the role to a FAMILY NAME from the film's own font map.
           A brand's Hindi display face (Khand) is a different role from its
           Hindi body face (Hind); leaving both on the body font is how a
           film ends up readable but toneless — and it is invisible, because
           the text still renders. */
        const ff = (design && design.fonts) || {};
        const fam = ff[e.role] ? ff[e.role].family
          : (e.role && /hi$/.test(e.role) ? (ff.body_hi && ff.body_hi.family) : (ff.display && ff.display.family));
        if (fam) el.font = `'${fam}',sans-serif`;
        const ramp = resolveRamp(sb, design, e.role);
        if (ramp && ramp.tracking) el.letter_spacing = ramp.tracking;
        /* Carry the authored ramp step. The runtime's three fixed sizes are not
           a type ramp: a brand whose display is 140px was rendering at 18px. */
        if (ramp && ramp.size) el.font_size = toLength(ramp.size, ramp.min_px);
        if (ramp && ramp.weight) el.font_weight = ramp.weight;
        if (ramp && ramp.case === 'upper') el.upper = true;
        /* the brutalist slab: display type reversed out of a brand block */
        if (e.slab_bg) {
          el.slab_bg = e.slab_bg;
          /* slab ink is NOT the stage ink — a slab is a bright block with dark
             type. Sharing one role put paper on yellow at 1.43:1. */
          el.slab_ink = e.slab_ink || role('slab-ink') || designTokens.ink;
        }
      } else if (e.type === 'latex' || e.type === 'answer') {
        /* `latex` and `answer` copy is spliced into markup WITHOUT escaping -
           LaTeX needs its backslashes and its bare `&` alignment markers
           intact, so esc() would turn `&` into `&amp;` and break `aligned`.
           That makes these the one element type where authored text can
           become markup, so an angle bracket here is a hard failure with the
           id named, not a warning. */
        if (/[<>]/.test(String(e.text == null ? '' : e.text))) {
          unsafe.push(`${sc.id}/${e.id} — ${e.type} copy contains < or > and is emitted unescaped`);
        }
        el.text = e.text;
        el.color = hex;
        /* the maths needs a size as much as a colour: the runtime has no
           font-size on .hss-latex, so an unsized equation is 16px tall on a
           1920px stage */
        const ramp = resolveRamp(sb, design, e.role);
        const px = e.font_size || (ramp && ramp.size);
        if (px) el.font_size = (typeof px === 'number' ? toLength(px, ramp ? ramp.min_px : 0) : px);
        if (ramp && ramp.weight) el.font_weight = ramp.weight;
        if (ramp && ramp.tracking) el.letter_spacing = ramp.tracking;
      } else if (e.type === 'stat') {
        /* The authored stat is a gradient-filled numeral over a caption. The
           emitter carries the numeral's colour as --hss-num-a and takes the
           second gradient stop from CSS, so one authored colour is what it
           can hold — the full two-stop ramp is still unrepresented. */
        el.value = e.value;
        el.label = e.label;
        /* The numeral and the caption are TWO colours: the-peak authors a brand
           numeral over a muted caption, and a single `hex` for both silently
           painted the numeral in the caption's ink — while the schema kept
           claiming num_color was APPLIED. Resolve it against the film's own
           tokens, fall back to the caption colour so an unauthored stat is
           unchanged. */
        el.num_color = resolveColor(e.num_color) || hex;
        el.color = hex;
      } else if (e.type === 'card') {
        /* Sibling cards share a `group` so the emitter wraps them in one row.
           Without it a scene's flex COLUMN stacks them, and the authored
           layout - three panels side by side - never happens. */
        el.group = 'panels';
        el.big = e.big;
        el.small = e.small;
        el.color = hex;
        /* the meter is a SECOND animation on the same node: it gets its own
           phase, carried as meter_in, and its own offset from at_ms */
        el.meter_pct = e.meter ? e.meter.pct : 0;
        el.meter_color = e.meter_color || hex;
        el.meter_in = e.meter ? { type: 'slide', dur_ms: e.meter.dur_ms || 900 } : { type: 'slide', dur_ms: 900 };
        /* The meter's curve comes from the emitter's EASE_EXPR table — the
           same table that GENERATES the runtime resolver — so an unknown
           name is reported with the emitter's own message instead of
           silently running the fallback curve. */
        if (e.meter && e.meter.ease !== undefined) {
          const easeApi = emitterApi();
          if (easeApi.emitterSupportsEase(e.meter.ease)) el.meter_in.ease = e.meter.ease;
          else unapplied.push(`${sc.id}/${e.id} — meter ease: ${easeApi.unknownEaseError(e.meter.ease).message}`);
        }
        el.meter_at_ms = e.meter_at_ms || 0;
      } else if (e.type === 'tiles') {
        el.columns = e.columns || 1;
        el.items = (e.items || []).map((i) => ({ icon: i.icon, head: i.head, body: i.body }));
      } else if (e.type === 'pills') {
        el.items = e.items || [];
        el.color = hex;
      } else if (e.type === 'cards') {
        /* The one element type reconcile had NO branch for. The emitter
           renders `(e.items || [])`, so items stopped existing right here
           and the row shipped EMPTY — three authored cards as an empty div,
           green through every gate, until reel-motion's motion-occurs probe
           asked what the entrance was moving and the answer was nothing.
           label/accent/muted are exactly the fields the emitter's case
           reads; accent resolves against the palette like every other
           colour in this function. An empty cards row is the same silent
           loss as a mark with no target, so it fails the build rather than
           rendering a hole. */
        el.items = (e.items || []).map((c) => ({
          label: c.label,
          accent: resolveColor(c.accent) || c.accent,
          muted: c.muted,
        }));
        if (!el.items.length) {
          unapplied.push(`${sc.id}/${e.id} — cards with no items renders an empty row (the emitter draws nothing without them)`);
        }
      } else if (e.type === 'chart') {
        /* The first element whose payload is DATA. Every number that reaches
           the emitter lands in an SVG coordinate, and a coordinate that parses
           as NaN does not throw — it removes the mark, silently, from a film
           that still exits 0. So the values are coerced to finite numbers
           HERE, where a wrong one can be named, rather than in the emitter
           where it can only be swallowed.

           Series colours resolve against the mode in force, which is what
           makes a five-colour editorial palette swap with the theme instead
           of being the one hand-picked hex that does not. */
        el.chart = e.chart || 'columns';
        el.title = e.title;
        el.subtitle = e.subtitle;
        el.kicker = e.kicker;
        el.source = e.source;
        el.unit = e.unit;
        el.decimals = e.decimals;
        el.categories = (e.categories || []).map((c) => String(c));
        el.stacked = !!e.stacked;
        el.area = !!e.area;
        el.grid = e.grid;
        el.legend = e.legend;
        el.values = e.values;
        el.dots = e.dots;
        el.min = e.min;
        el.max = e.max;
        if (typeof e.min === 'number' && e.min > 0) {
          declared.push(`${sc.id}/${e.id}: axis floor ${e.min} — a TRUNCATED axis, declared. ` +
            `The default is 0 so this cannot happen by accident; the film is choosing it so its threshold is visible.`);
        }
        el.series = (e.series || []).map((s) => {
          const vals = (s.values || []).map((v) => Number(v));
          if (vals.some((v) => !isFinite(v))) {
            warnings.push(`${sc.id}/${e.id}: a series value is not a finite number and would drop the mark silently`);
          }
          return {
            name: s.name,
            values: vals.map((v) => (isFinite(v) ? v : 0)),
            color: resolveColor(s.color),
          };
        });
        el.segments = (e.segments || []).map((g) => ({ color: resolveColor(g.color) }));
        /* the marks are a SECOND animation on the same node, exactly like the
           card's meter: they need their own phase, and `stagger_ms` here is
           the per-bar delay that is the difference between a chart and a
           block that changes size */
        el.chart_in = {
          type: (e.chart_in && e.chart_in.type) || 'slide',
          dur_ms: (e.chart_in && e.chart_in.dur_ms) || 1400,
          stagger_ms: (e.chart_in && e.chart_in.stagger_ms) || 0,
        };
        /* Same contract as the meter's curve: asked of EASE_EXPR, reported
           with the emitter's own words when unknown. */
        if (e.chart_in && e.chart_in.ease !== undefined) {
          const easeApi = emitterApi();
          if (easeApi.emitterSupportsEase(e.chart_in.ease)) el.chart_in.ease = e.chart_in.ease;
          else unapplied.push(`${sc.id}/${e.id} — chart_in ease: ${easeApi.unknownEaseError(e.chart_in.ease).message}`);
        }
        el.chart_at_ms = e.chart_at_ms || 0;
      } else if (e.type === 'credit') {
        el.text = e.text;
        /* `place.bottom` / `place.align` are authored but the emitter pins the
           footer to bottom-centre; recorded so the loss is not silent */
        if (e.place && (e.place.bottom != null || e.place.align)) {
          warnings.push(`${e.id}: place.bottom/align ignored — the emitter pins the credit to bottom-centre`);
        }
      } else if (e.type === 'html') {
        /* The raw markup block. Unlike `text`, nothing rescues a mistake in
           it: the payload IS the element, so it is carried verbatim and the
           two ways it can be wrong are hard failures with the id named
           rather than warnings. A <script> would make every committed
           preview a program rather than a document — the runtime defect
           class Route B was rejected for — so it is `unsafe` and not passed
           on; empty markup renders an empty wrapper, the exact silent loss
           the throwing default exists to prevent, so it is `unapplied` and
           not passed on either. Utility classes inside are compiled into
           the clip's stylesheet later, by attachUtilities(), never loaded
           at runtime. */
        const rawHtml = e.html == null ? '' : String(e.html);
        if (/<script/i.test(rawHtml)) {
          unsafe.push(`${sc.id}/${e.id} — html markup contains <script and is emitted verbatim`);
          continue;
        }
        if (!rawHtml.trim()) {
          unapplied.push(`${sc.id}/${e.id} — html markup is empty (renders an empty wrapper; a block must carry markup)`);
          continue;
        }
        el.html = rawHtml;
      } else if (e.type === 'shape') {
        /* The annotation marks. The KIND vocabulary lives in the emitter —
           the CSS it can actually draw — and is asked the same way the type
           list is, so an unknown kind defers with the emitter's own message
           instead of rendering the default border nobody drew.

           The rest of this branch exists because a mark without a target
           draws NOTHING: the wrapper is an in-flow zero-height div, so
           `circle` with no `of` renders an invisible box and the film looks
           complete minus one annotation. That is the silent-loss class this
           pipeline exists to remove, so it is `unapplied` (a failed build
           with the id named), and the element is not passed on. */
        const api = emitterApi();
        const kind = e.shape || 'box';
        if (!api.emitterSupportsShape(kind)) {
          deferred.push({ scene: sc.id, id: e.id, type: e.type, reason: api.unknownShapeError(kind).message });
          continue;
        }
        if (!e.of) {
          unapplied.push(`${sc.id}/${e.id} — a "${kind}" mark with no of: target draws nothing (a scene is a centred column; a mark can only attach to an element)`);
          continue;
        }
        if (e.of === e.id) {
          unapplied.push(`${sc.id}/${e.id} — of points at the mark itself`);
          continue;
        }
        if (!sceneIds.has(e.of)) {
          unapplied.push(`${sc.id}/${e.id} — of "${e.of}" is not an element of this scene; an overlay moved into another scene's host hides on that scene's clock`);
          continue;
        }
        el.shape = kind;
        el.color = hex;
        el.of = e.of;
        if (kind === 'arrow') {
          const sides = Object.keys(api.ARROW_SIDES);
          const side = e.side !== undefined && e.side !== null && e.side !== '' ? e.side : 'left';
          if (!sides.includes(side)) {
            unapplied.push(`${sc.id}/${e.id} — ${api.unknownArrowSideError(side).message}`);
            continue;
          }
          el.side = side;
        } else if (e.side !== undefined && e.side !== null && e.side !== '') {
          unapplied.push(`${sc.id}/${e.id} — side is only defined for an arrow mark, not "${kind}"`);
        }
      }
      /* Per-element box: a design system's radius and measure scale has to
         reach the film. `max_width` was in IGNORED_BY_EMITTER until now —
         the widest authored element in two-queens is 1445px across a 1920
         stage and a lead two words longer would have run to the edge with
         nothing to report it.
         `design.text_width` is the scalable half: a measure expressed ONCE per
         role (Material's `max-width:44rem` prose) instead of repeated on every
         paragraph. An explicit e.max_width still wins. */
      if (e.radius !== undefined && e.radius !== null) el.radius = String(e.radius);
      const roleWidth = design && design.text_width ? design.text_width[e.role] : undefined;
      const mw = e.max_width !== undefined && e.max_width !== null ? e.max_width : roleWidth;
      if (mw !== undefined && mw !== null) el.max_width = mw;
      if (e.gap !== undefined && e.gap !== null) el.gap = e.gap;

      /* ── COMPONENT VARIANTS + LAYOUT (P6/P7) ────────────────────────
         `design.style` was reported "not implemented" on all four films, and
         it could not be implemented as written: a style language is a NAME
         for a set of treatments, and the useful thing to author is the
         treatment. `fill` is that — filled / tonal / outlined / text — and
         `design.fills` sets the film's default per component so it is stated
         once rather than on all 32 elements.

         A value outside the vocabulary FAILS rather than being dropped. That
         is the whole point of P3 in miniature: an emitter that ignores an
         unknown `fill` renders the element, so the film looks complete and
         the variant is simply not there. */
      const fillDefaults = (design && design.fills) || {};
      const fillName = e.fill !== undefined && e.fill !== null ? e.fill : fillDefaults[e.type];
      if (fillName !== undefined && fillName !== null) {
        if (!FILL_COMPONENTS[e.type]) {
          unapplied.push(`${sc.id}/${e.id} — fill is only defined for ${Object.keys(FILL_COMPONENTS).join(' / ')}, not "${e.type}"`);
        } else if (!FILLS.includes(fillName)) {
          unapplied.push(`${sc.id}/${e.id} — fill "${fillName}" is not one of ${FILLS.join(' / ')}`);
        } else {
          el.fill = fillName;
        }
      }
      if (e.align !== undefined && e.align !== null) {
        if (!ALIGNS.includes(e.align)) unapplied.push(`${sc.id}/${e.id} — align "${e.align}" is not one of ${ALIGNS.join(' / ')}`);
        else el.align = e.align;
      }
      /* Group layout. `columns` is only meaningful on a grid, so on a row it
         is reported instead of being accepted and ignored — a silently
         dropped column count is exactly how a "two-column" mock renders as
         one wide row with nobody asking why. */
      if (e.layout !== undefined && e.layout !== null) {
        if (!LAYOUTS.includes(e.layout)) unapplied.push(`${sc.id}/${e.id} — layout "${e.layout}" is not one of ${LAYOUTS.join(' / ')}`);
        else el.layout = e.layout;
      }
      /* `columns` on a `tiles` element is the TILES grid — its own
         grid-template-columns, honoured since the type was added, and set
         above. On anything else it means the GROUP's column count, which is
         only meaningful for a grid layout; on a row it is reported rather
         than accepted and dropped, because a wrapping flex row that was
         authored as four columns renders as one wide row and nobody asks why. */
      if (e.columns !== undefined && e.columns !== null && e.type !== 'tiles') {
        if (el.layout !== 'grid') unapplied.push(`${sc.id}/${e.id} — columns: ${e.columns} needs layout: "grid"; a row wraps, it does not divide`);
        else el.columns = Number(e.columns);
      }

      if (e.in) {
        el.in = { type: e.in.type };
        if (e.in.from_x !== undefined) el.in.from_x = e.in.from_x;
        if (e.in.from_y !== undefined) el.in.from_y = e.in.from_y;
        /* from_scale is the slot's scale-in and the group entrances' scale
           half — carrying it is what stops the slot from rendering at full
           size for the whole entrance. On a single fade/slide/pop the
           emitter ignores it, and the schema says so. */
        if (e.in.from_scale !== undefined) el.in.from_scale = e.in.from_scale;
        if (e.in.overshoot !== undefined) el.in.overshoot = e.in.overshoot;
        if (e.in.stagger_ms !== undefined) el.in.stagger_ms = e.in.stagger_ms;
        /* The curve vocabulary lives in the emitter's EASE_EXPR table — the
           one that GENERATES the runtime resolver — so this pattern and what
           the clip can actually run cannot drift. Unknown name: reported
           with the emitter's own message (unapplied fails the build), like
           an unknown fill. */
        if (e.in.ease !== undefined) {
          const easeApi = emitterApi();
          if (easeApi.emitterSupportsEase(e.in.ease)) el.in.ease = e.in.ease;
          else unapplied.push(`${sc.id}/${e.id} — ${easeApi.unknownEaseError(e.in.ease).message}`);
        }
        el.in.start_ms = e.in.start_ms || 0;
        el.in.dur_ms = e.in.dur_ms || 600;
      }

      /* A scene shorter than its own choreography hides content — with dur
         defaulting to 3s this is the trap the default creates: an entrance
         that would land at 5s never plays inside a 3s scene. Every element of
         every shipped film ends at or before its scene's edge (checked across
         all 7 films / 220 elements), so this warning only ever fires for
         genuinely broken timing, never as noise on legacy films. */
      const sceneMs = sc.dur * 1000;
      const lastBeat = Math.max(
        el.in ? el.in.start_ms + el.in.dur_ms : 0,
        el.at_ms || 0,
        el.meter_at_ms || 0,
        el.chart_at_ms || 0
      );
      if (lastBeat > sceneMs) {
        warnings.push(`${sc.id}/${el.id}: choreography runs to ${lastBeat}ms but the scene is ${sceneMs}ms — the tail never plays (raise dur or pull the timing in)`);
      }

      out.elements.push(el);
    }
    scenes.push(out);
  }

  /* ── design → theme/fonts ──────────────────────────────────────────
     The emitter emits sb.theme as CSS custom properties and sb.fonts as a
     <link>. Mapping here is what makes a second brand's colours and type
     reach the film at all. Anything in `design` that has NO mapping is
     reported, because a silently-dropped design field is how a film ends up
     green and wrong. */
  const theme = {};
  const fonts = [];

  if (design && typeof design === 'object') {
    const d = design;
    const f = d.fonts || {};
    if (f.display) fonts.push({ family: f.display.family, href: d.font_href });
    else if (d.font_href) fonts.push({ href: d.font_href });

    const tok = d.tokens || {};
    if (f.display) theme['font-display'] = `'${f.display.family}',sans-serif`;
    if (f.display_hi) theme['font-display-hi'] = `'${f.display_hi.family}',sans-serif`;
    if (f.body_hi) theme['font-body'] = `'${f.body_hi.family}',sans-serif`;
    if (f.mono) theme['font-mono'] = `'${f.mono.family}',monospace`;

    /* radius / border / shadow are what make a style read as itself. A theme
       that carries colours but not these still looks like the default. */
    if (d.radius !== undefined) theme.radius = String(d.radius === 0 ? '0' : d.radius);
    if (d.border) theme.border = d.border;
    if (d.elevation && d.elevation.md) theme.shadow = d.elevation.md;

    /* Per-component radius. One --hss-radius cannot carry a system using
       8/14/20/24/999 in one screen, so `design.radii` states each one and the
       rest fall back to the global — a film that sets only `radius` keeps the
       exact radii it had. Unknown keys fail: a radius nobody implements is
       the same silent default as a colour nobody resolves. */
    if (d.radii && typeof d.radii === 'object') {
      for (const [k, v] of Object.entries(d.radii)) {
        if (!FILL_RADIUS[k]) unapplied.push(`design.radii.${k} — no component called "${k}" (known: ${Object.keys(FILL_RADIUS).join(', ')})`);
        else theme[FILL_RADIUS[k]] = String(v);
      }
    }

    /* Token-backed roles. `theme_map` wins; the legacy token names stay as the
     * fallback so the three existing films are byte-identical.
     *
     * The ink chain used to be `tok.white || tok.coal`, which is a guess with
     * no evidence behind it: a palette whose background token happens to be
     * named `coal` had its INK set to that background, and every credit and
     * tile label on the stage was painted in the page colour at 1.00:1. A
     * palette's ink cannot be inferred from its token NAMES — it has to be
     * declared, which is what `theme_map.ink` is for. The longer chain below
     * is only a better guess than before, not a fix; `reel-contrast.cjs` is
     * what proves it. */
    if (role('panel') || tok.panel) theme.panel = role('panel') || tok.panel;
    const inkHex = role('ink') || tok.ink || tok.white || tok.paper || tok.coal;
    if (inkHex) theme.ink = inkHex;
    const meterHex = role('meter') || tok.signal;
    if (meterHex) theme.meter = meterHex;
    const accentHex = role('accent');
    if (accentHex) theme.accent = accentHex;
    /* Filled from THEME_ROLES, not from a second hand-kept list.
       This was `['num-a', …, 'outline']` — nine names — while THEME_ROLES had
       twenty. A role could therefore be declared in `theme_map`, validated
       against the schema, checked against the token table, reported as applied
       by every diagnostic in this file, and still never reach the film: the
       emitter would fall back to its own default and the board would show the
       default too. That is the same defect as `baseBg` and the slab ink — a
       list maintained beside the thing it must match. Deriving it makes the
       two impossible to disagree, and a new role cannot be half-added. */
    const setExplicitly = new Set(['panel', 'ink', 'meter', 'accent']);
    for (const k of Object.keys(THEME_ROLES)) {
      if (setExplicitly.has(k) || theme[k] !== undefined) continue;
      const v = role(k);
      if (v) theme[k] = v;
    }

    /* A named role that resolves to nothing is a broken design, not a
       fallback: naming it is a claim that the colour reaches the film. */
    for (const r of Object.keys(themeMap)) {
      if (!THEME_ROLES[r]) {
        unapplied.push(`design.theme_map.${r} — no emitter theme key called "${r}" (known: ${Object.keys(THEME_ROLES).join(', ')})`);
      } else if (!designTokens[themeMap[r]]) {
        unapplied.push(`design.theme_map.${r} -> token "${themeMap[r]}" is not in design.tokens`);
      }
    }/* recorded, not applied — a pattern the emitter has no recipe for. `dots` is
     applied above and deliberately not listed; `blueprint`/`grid` are not. */
    if (d.background && d.background.type && d.background.type !== 'flat' && !patternApplied) {
      unapplied.push(`design.background.type="${d.background.type}" — no emitter recipe for this pattern (known: ${Object.keys(PATTERNS).join(', ')})`);
    }
    if (d.hover) informational.push('design.hover — a video has no hover; kept so the design record stays complete, never applied');
    if (d.style && !d.fills) informational.push(`design.style="${d.style}" — naming the style language; per-element variants come from elements[].fill (design.fills sets the defaults)`);
    if (repeatedStageBg.length) {
      informational.push(`${repeatedStageBg.length} scene background(s) (${repeatedStageBg.join(', ')}) named the reel's own flat background; they follow --mode instead of pinning the light theme's hex, which would paint the wrong colour over a dark stage`);
    }

    /* `elements[].style` is the other half of that vocabulary and it is
       ADVISORY — it names the component ("slab", "label", "display") so a
       reader can tell what a scene is made of. It is not the visual switch,
       and silently reading one as the other is how a label turns into a
       filled block in a film that meant it as a caption. Reported ONCE per
       film with the distinct values, not once per element: 40 identical lines
       is noise, and noise is a red nobody reads. */
    const styleNames = new Set();
    for (const sc of sb.scenes || []) for (const e of sc.elements || []) if (e.style) styleNames.add(e.style);
    if (styleNames.size && !d.fills) {
      informational.push(`elements[].style — advisory component names (${[...styleNames].sort().join(', ')}); the applied variant is elements[].fill, defaulting from design.fills`);
    }
  }

  /* ── RAMP MONOTONICITY ────────────────────────────────────────────────
     P5. `type_scale` makes it trivial to author a ramp that inverts — set
     `body: 40` and the body is larger than the title, and nothing reports it
     because every value is individually valid. A type system is an ORDER as
     well as a set of sizes, so assert the order. Roles not authored under a
     film are skipped rather than guessed. */
  const HIERARCHY = ['display', 'title', 'title_hi', 'lead', 'lead_hi', 'body', 'body_hi', 'overline'];
  const sizes = [];
  for (const role of HIERARCHY) {
    const step = resolveRamp(sb, design, role);
    if (step && step.size !== undefined) sizes.push({ role, px: Math.round(step.size) });
  }
  for (let i = 1; i < sizes.length; i++) {
    if (sizes[i].px >= sizes[i - 1].px) {
      unapplied.push(`type ramp inverts: "${sizes[i - 1].role}" is ${sizes[i - 1].px}px but "${sizes[i].role}" below it is ${sizes[i].px}px — a larger step must be larger`);
    }
  }

  /* ── MATHS RENDERER ───────────────────────────────────────────────────
     P9. `latex` used to emit three jsDelivr tags; an offline export rendered
     raw `$$…$$` with no error and a green gate. The compiler cannot prove the
     network works, and — unlike the original version of this check — it no
     longer has to guess: `design.math.src` defaults to the KaTeX dist that
     lives in this repo (public/vendor/katex, written by vendor-katex.cjs), and
     the renderer is INLINED into the clip so the clip can render with no
     network at all.

     Only `latex` counts. `answer` used to be listed here too and it is a plain
     text takeaway with no delimiters — counting it meant the-peak, a film with
     no formulae at all, was nagged on every compile about a maths renderer it
     could not use. */
  const hasMath = scenes.some((sc) => sc.elements.some((e) => e.type === 'latex'));
  let mathBlob = null;
  let mathInfo = null;
  if (hasMath) {
    const src = (design && design.math && design.math.src) || MATH_DEFAULT_SRC;
    if (typeof src !== 'string' || !src.trim()) {
      unsafe.push('this film has latex elements but design.math.src is empty — it would export raw `$$…$$`');
    } else if (/^cdn:/i.test(src)) {
      informational.push(`design.math.src="${src}" — a network fetch; an OFFLINE export renders raw $$…$$. Point it at a vendored copy ("vendor/katex") to inline it.`);
    } else {
      const files = findKatexDist(src);
      if (!files) {
        unsafe.push(`design.math.src="${src}" names no KaTeX dist — expected katex.min.css, ` +
          `katex.min.js and auto-render.min.js under public/${src} (or the repo root). ` +
          `Run: node automation/studio-reel/vendor-katex.cjs`);
      } else {
        mathBlob = inlineKatex(files);
        mathInfo = { src, version: files.version, bytes: mathBlob.css.length +
          mathBlob.scripts.reduce((a, s) => a + s.length, 0) };
      }
    }
  }

  /* ── RUNTIME MODES ───────────────────────────────────────────────────
     * `--mode` used to mean "compile ONE of the two". It now means "which one
     * bakes in", and every declared mode ships in the same clip as a
     * [data-mode] rule, so one artefact answers the viewer's OS instead of two
     * files drifting apart. The emitter owns the repaint; this side owns
     * resolving each mode's surface and token table through the SAME
     * resolver, which is why two-queens' light and dark are provably the same
     * film rather than two lookalikes. */
  const modeNames = (design && design.modes) ? Object.keys(design.modes) : [];
  const built = {};
  for (const name of modeNames) {
    const m = design.modes[name];
    if (!m) continue;
    const tokens = Object.assign({}, design.tokens, m.tokens || {});
    const roleOf = (r) => (m.theme_map || design.theme_map || {})[r]
      ? tokens[(m.theme_map || design.theme_map)[r]] : undefined;
    const t = {};
    if (design.fonts) {
      const f = design.fonts;
      if (f.display) t['font-display'] = "'" + f.display.family + "',sans-serif";
      if (f.display_hi) t['font-display-hi'] = "'" + f.display_hi.family + "',sans-serif";
      if (f.body_hi) t['font-body'] = "'" + f.body_hi.family + "',sans-serif";
      if (f.mono) t['font-mono'] = "'" + f.mono.family + "',monospace";
    }
    const ts = m.type_scale || design.type_scale;
    if (ts && ts.preset) { /* the preset carries sizes, not colours */ }
    if (design.radius !== undefined) t.radius = String(design.radius === 0 ? '0' : design.radius);
    if (m.border || design.border) t.border = m.border || design.border;
    const elev = m.elevation || design.elevation;
    if (elev && elev.md) t.shadow = elev.md;
    if (roleOf('panel') || tokens.panel) t.panel = roleOf('panel') || tokens.panel;
    const ink = roleOf('ink') || tokens.ink || tokens.white || tokens.paper || tokens.coal;
    if (ink) t.ink = ink;
    const meter = roleOf('meter') || tokens.signal;
    if (meter) t.meter = meter;
    const accent = roleOf('accent');
    if (accent) t.accent = accent;
    /* the same derivation as the base theme above, for the same reason: a mode
       that names a role the hand-kept list forgot would render the base
       theme's colour under a dark label. */
    for (const k of Object.keys(THEME_ROLES)) {
      if (t[k] !== undefined) continue;
      const v = roleOf(k);
      if (v) t[k] = v;
    }
    /* per-component radii and the tonal surface are part of the THEME, so
       every mode carries them too — otherwise a light/dark pair renders two
       different component systems, which is the exact drift --mode was added
       to stop. The base theme is the floor; a mode overrides key by key. */
    for (const k of Object.keys(FILL_RADIUS)) {
      const r = roleOf(FILL_RADIUS[k]) || (design.radii && design.radii[k]) || theme[FILL_RADIUS[k]];
      if (r !== undefined && r !== null) t[FILL_RADIUS[k]] = String(r);
    }
    /* the base theme is the floor; a mode overrides it key by key */
    const merged = Object.assign({}, theme, t);
    built[name] = {
      theme: merged,
      bg: surfaceColor(m.background || design.background) || top.background || '#0e1512',
      bg_image: null,
    };
  }
  if (modeNames.length) {
    top.modes = built;
    top.mode = built[mode] ? mode : modeNames[0];
    top.ui = { theme_toggle: true };
  }

  return {
    /* `math` is null unless this film has a `latex` element, so a clip with no
       formulae carries none of the ~700KB renderer. The emitter falls back to
       its CDN tags when it is absent, which keeps every non-film caller of
       compileStoryboard working exactly as before. */
    top: Object.assign(top, { scenes, theme, fonts, math: mathBlob }),
    mathInfo, deferred, warnings, declared, unapplied, unsafe, informational,
  };
}

/* ── DESIGN BOARD ─────────────────────────────────────────────────────
 * A style page that shows the film's design system WITHOUT playing the film:
 * the palette, the theme roles, the type ramp at its real sizes, every
 * component in every fill, and each scene's surface.
 *
 * The rule that decides where it lives: it is built from the SAME resolved
 * values the clip compiles from — `theme`, `modes`, the reconciled ramp — not
 * from `design.tokens` read again on the side. A style board assembled
 * independently is a second opinion about the design, and the day the two
 * disagree nobody can tell which one the film actually used. Here the board
 * shows a wrong colour if and only if the film ships that wrong colour.
 *
 * One entry per DECLARED mode, so a Material film gets light and dark side by
 * side rather than two files to keep in step. */
function designBoard(sb, mode, designIn, top, theme) {
  /* `design` is optional: a film with no design block (breath-of-air) still
     gets a board, and the board has to say "runtime defaults" instead of
     crashing on `design.theme_map`. Mirrors reconcile's `designIn || sb.design`
     for the same reason — one film, two readers, one answer. */
  const design = designIn || sb.design || {};
  const tokens = (design && design.tokens) || {};

  /* which roles each token was assigned to — "container serves panel AND
     fill-tone" is the fact a designer needs and cannot read off the film */
  const roleUse = {};
  for (const r of Object.keys(THEME_ROLES)) {
    const name = (design.theme_map || {})[r];
    if (!name) continue;
    (roleUse[name] = roleUse[name] || []).push(r);
  }

  /* the ramp roles this film ACTUALLY used, resolved through the same
     resolveRamp the elements go through, so the sample on the board is the
     size that ships */
  const used = new Set();
  for (const sc of sb.scenes) for (const e of sc.elements) if (e.role) used.add(e.role);
  for (const k of Object.keys((sb.frame && sb.frame.ramp) || {})) used.add(k);
  const ramp = [...used].map((r) => {
    const step = resolveRamp(sb, design, r);
    if (!step) return null;
    return {
      role: r,
      /* already scaled by resolveRamp — multiplying here again would apply
         type_scale.scale twice and print a size the film never uses */
      px: step.size ? Math.round(step.size) : null,
      weight: step.weight || null,
      tracking: step.tracking || null,
      case: step.case || null,
      family: (design.fonts && design.fonts[r] && design.fonts[r].family)
        || (r === 'mono' && design.fonts && design.fonts.mono && design.fonts.mono.family)
        || (design.fonts && design.fonts.display && design.fonts.display.family)
        || null,
      min_px: (design.type_scale && design.type_scale.min_px) || 0,
      used: sb.scenes.some((sc) => sc.elements.some((e) => e.role === r)),
    };
  }).filter(Boolean).sort((a, b) => (b.px || 0) - (a.px || 0));

  const bg = (top.modes && top.modes[mode] && top.modes[mode].bg) || top.background || '#0e1512';

  /* The ratio of every token against THIS board's stage.

     Borrowed from reel-contrast rather than reimplemented: a second copy of
     the WCAG maths is a second thing to get wrong, and it drifts in silence —
     the same argument that makes `theme_map` a single colour resolver.

     It is a SWATCH-level fact, not a gate. A token used on a panel is not
     required to clear the stage, so nothing here fails a build; reel-contrast
     is what fails a build. Getting these in means a reader can see that
     `outline-var` is 2:1 on the stage and understand why it is only ever a
     border, instead of the board promising a ratio and printing nothing —
     which is what it did while the call passed a literal `null`. */
  const ratioVs = {};
  const roleRatio = {};
  try {
    const { parseColor, contrast } = require('./reel-contrast.cjs');
    const bgc = parseColor(bg);
    if (bgc) {
      const vsBg = (v) => {
        const c = parseColor(v);
        return (c && c[3] >= 1) ? +contrast(c.slice(0, 3), bgc.slice(0, 3)).toFixed(2) : null;
      };
      for (const name of Object.keys(tokens)) { const r = vsBg(tokens[name]); if (r !== null) ratioVs[name] = r; }
      /* the resolved roles too: a token's ratio says whether the PIGMENT is
         legible, the role's says whether the thing the emitter actually paints
         is. Only the second one is the pairing the film ships. */
      for (const k of Object.keys(theme)) { const r = vsBg(theme[k]); if (r !== null) roleRatio[k] = r; }
    }
  } catch (e) {
    /* a board with no ratios is worse than one with them and better than a
       crash: this page is a preview, and the gate that matters is elsewhere */
  }

  return {
    mode,
    bg,
    theme: Object.assign({}, theme),
    palette: tokens,
    paletteRatio: ratioVs,
    themeRatio: roleRatio,
    roleUse,
    ramp,
    /* `declared` is the one bit the board cannot infer from empty maps: an
       absent design block is not a design whose palette happens to be empty,
       and a reader needs to know which one they are looking at. */
    declared: !!(designIn || sb.design),
    fills: (design.fills) || {},
    radii: (design.radii) || (design.radius !== undefined ? { all: design.radius } : {}),
    radius: design.radius !== undefined ? String(design.radius) : null,
    /* every surface the film actually paints: the stage plus each scene's own
       background declaration, so a scene that follows the mode reads as "same
       as stage" rather than silently missing from the board */
    surfaces: sb.scenes.map((sc) => ({
      id: sc.id,
      decl: sc.background || null,
      css: compileSurface(sc.background),
    })),
    counts: {
      scenes: sb.scenes.length,
      elements: sb.scenes.reduce((a, s) => a + s.elements.length, 0),
      duration: sb.meta.duration,
      types: [...new Set(sb.scenes.flatMap((s) => s.elements.map((e) => e.type)))].sort(),
    },
  };
}
/* The timeline is a chain of durations — this is what makes "set one scene's
 * duration" a single-field edit. Before it, every scene carried hand-computed
 * `start` seconds and meta carried a hand-computed `duration`, so lengthening
 * scene 3 meant rewriting the start of every later scene and the meta total,
 * and one stale number either overlapped a scene (gate 3 fails) or left dead
 * air (a black gap on export). It runs on the raw IR right after parse, so
 * reconcile, every gate and every page writer see one consistent timeline.
 *
 * THE RULE, stated the way the schema states it: durations are the source of
 * truth. Omitted fields are DERIVED (dur defaults to DEFAULT_SCENE_DUR, start
 * chains from the previous scene, duration is the chain's end). Authored fields
 * that AGREE with the chain change nothing — all seven shipped films chain
 * exactly, so this function is a no-op on every committed storyboard and the
 * regression gate stays byte-identical. Authored fields that DISAGREE are
 * reported as losses and the chain wins: the alternative is freezing retimed
 * films behind hand-recomputed numbers, which is the defect this removes. */
const DEFAULT_SCENE_DUR = 3;
function normalizeTimeline(sb) {
  const notes = [];
  const discards = [];
  if (!sb || !Array.isArray(sb.scenes)) return { notes, discards };
  const TOL = 1e-6;
  let cursor = 0;
  let noDur = 0;
  let noStart = 0;
  sb.scenes.forEach((sc, i) => {
    const id = sc.id || `scene ${i + 1}`;

    const durOK = typeof sc.dur === 'number' && Number.isFinite(sc.dur) && sc.dur > 0;
    if (!durOK) {
      if (sc.dur !== undefined) discards.push(`${id}: dur=${JSON.stringify(sc.dur)} is not a positive number of seconds — defaulted to ${DEFAULT_SCENE_DUR}s`);
      else noDur++;
      sc.dur = DEFAULT_SCENE_DUR;
    }

    const startOK = typeof sc.start === 'number' && Number.isFinite(sc.start);
    if (startOK) {
      if (Math.abs(sc.start - cursor) > TOL) {
        discards.push(`${id}: authored start=${sc.start}s but the previous scenes chain to ${cursor}s — chain wins (omit start to stop reporting)`);
        sc.start = cursor;
      }
    } else {
      if (sc.start !== undefined) discards.push(`${id}: start=${JSON.stringify(sc.start)} is not a number of seconds — derived ${cursor}s from the chain`);
      else noStart++;
      sc.start = cursor;
    }

    cursor += sc.dur;
  });

  if (sb.meta) {
    const durOK = typeof sb.meta.duration === 'number' && Number.isFinite(sb.meta.duration);
    if (durOK) {
      if (Math.abs(sb.meta.duration - cursor) > TOL) {
        discards.push(`meta.duration=${sb.meta.duration}s but the scenes chain to ${cursor}s — chain wins (omit duration to stop reporting)`);
        sb.meta.duration = cursor;
      }
    } else {
      if (sb.meta.duration !== undefined) discards.push(`meta.duration=${JSON.stringify(sb.meta.duration)} is not a number of seconds — derived ${cursor}s from the chain`);
      sb.meta.duration = cursor;
    }
  }

  if (noDur) notes.push(`${noDur} scene(s) without dur — default ${DEFAULT_SCENE_DUR}s each`);
  if (noStart) notes.push(`${noStart} scene(s) without start — chained from the previous scene`);
  if (notes.length) notes.push(`timeline ${sb.scenes.length} scene(s), ${cursor}s`);
  return { notes, discards };
}

function loadEmitter() {
  const src = fs.readFileSync(EMITTER, 'utf8');
  const shim = { exports: {} };
  vm.runInNewContext(src, { module: shim, console, require, window: {}, document: {} }, { filename: 'hic-storyboard.js' });
  return shim.exports;
}

/* ── build-time utilities (plan §2, Route A) ─────────────────────────────
 * The pipeline compiles Tailwind utilities ONCE, here, from the generated
 * document: every `class="…"` attribute in clip html is scanned, handed to
 * oxide (via @tailwindcss/node), and whatever actually compiles ships as ONE
 * stamped CSS block appended to the clip's stylesheet (`top._tw`, spliced by
 * compileStoryboard next to the emitter's own .hss-* rules). Offline and
 * deterministic — no network, no CDN, no @tailwindcss/browser at runtime
 * (Route B, rejected: it makes every preview's paint depend on a script
 * fetching and JIT-compiling at load, which is precisely what the gates
 * cannot measure).
 *
 * The no-candidates path returns zero bytes WITHOUT loading the compiler:
 * legacy films' class attributes are all `hss-*` (the emitter's own
 * vocabulary, never a utility), so they never touch the toolchain and their
 * artifacts stay byte-identical. Everything that survives that filter is
 * still decided by oxide, not by a hand-kept utility regex beside it — the
 * same doctrine the switch and the shape vocabulary follow: ask the thing
 * that implements it.
 *
 * The block rides on `top`, not on a local string, because every consumer
 * re-compiles from `top` internally (buildStandalonePage among them) — a
 * block held only in main() would leave the standalone page and the clip json
 * disagreeing about the stylesheet, and a gate that measures a page the file
 * will not ship is worse than no gate.
 *
 * Returns { block, unrecognized, tokens }. `unrecognized` is non-empty only
 * when candidates existed but NOTHING compiled — a whole block of classes
 * that silently did nothing — reported as informational (not a failure:
 * custom classes living in a scoped <style> are legitimate there, and a
 * mistyped utility is indistinguishable from one by design). */
async function attachUtilities(top) {
  const doc = emitterApi().compileStoryboard(top);
  const seen = new Set();
  const tokens = [];
  /* three attribute spellings: double-quoted, single-quoted, unquoted —
     authored markup can use any of them. An escaped quote inside the value
     (&quot;) cannot terminate the match, so copy that merely mentions
     class=" never contributes a token. */
  const re = /class\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m;
  while ((m = re.exec(doc.html))) {
    const raw = m[1] !== undefined ? m[1] : (m[2] !== undefined ? m[2] : m[3]);
    for (const t of String(raw).split(/\s+/)) {
      if (!t || seen.has(t)) continue;
      seen.add(t);
      if (!/^hss(?:-|$)/.test(t)) tokens.push(t);
    }
  }
  if (!tokens.length) return { block: '', unrecognized: [], tokens: 0 };

  const css = await compileUtilities(tokens);
  if (!css) return { block: '', unrecognized: tokens, tokens: tokens.length };

  const block = '/*! reel: utilities compiled at build time — ' + tokens.length
    + ' candidate token(s), inlined as CSS; no Tailwind runtime, no CDN, no network */\n' + css;
  top._tw = block;
  return { block, unrecognized: [], tokens: tokens.length };
}

/* Theme + utilities ONLY — deliberately no preflight. Preflight would reset
 * margins, line-height and font-size document-wide, which is a fine default
 * for a page Tailwind owns and a surprise for a stage the emitter owns: one
 * html element would change the paint of every OTHER element in the film, and
 * the gates would be measuring a side effect of a stylesheet layer nobody
 * authored. The theme half is not optional — utilities compile against
 * --color-*, --spacing and the font scale, so a compile without it silently
 * loses every theme-referencing utility. Layer declarations first, matching
 * what Tailwind itself emits, so utilities cascade over theme vars and the
 * emitter's unlayered .hss-* rules always win on their own elements.
 * Probed live before writing this: one FRESH compiler per document (build()
 * accumulates candidates across calls on the same compiler), one build(). */
async function compileUtilities(tokens) {
  const { compile } = require('@tailwindcss/node');
  const SOURCE = [
    '@layer theme, utilities;',
    '@import "tailwindcss/theme.css" layer(theme);',
    '@import "tailwindcss/utilities.css" layer(utilities);',
  ].join('\n');
  const fresh = () => compile(SOURCE, { base: ROOT, onDependency() {} });
  const none = (await fresh()).build([]);
  const css = (await fresh()).build(tokens.slice().sort());
  /* Oxide's verdict on tokens that compile to nothing (junk, hss-*, custom
     classes) is that they equal a build with zero candidates — the byte-
     identical comparison that keeps "no candidates" true in every case, not
     just the empty-scan one. */
  return css === none || !css.trim() ? '' : css;
}

async function main() {
  const argv = process.argv.slice(2);
  const writeClip = argv.includes('--write-clip');
  const writeHtml = argv.includes('--write-html');
  /* the style board: a page that shows the design system on its own, with no
     animation and no timing. One file per film carrying EVERY declared mode,
     because comparing light against dark is the whole point — two files is
     how they drift. */
  const writeDesign = argv.includes('--write-design');
  const writeScenes = argv.includes('--write-scenes');
  const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
  const mode = argv.includes('--mode') ? argv[argv.indexOf('--mode') + 1] : 'light';

  const filmsDir = path.join(__dirname, 'films');
  const films = fs.readdirSync(filmsDir).filter((d) => fs.existsSync(path.join(filmsDir, d, 'storyboard.json')) && (!only || d === only));
  if (!films.length) {
    console.error('reel-compile: no film with a storyboard.json found');
    return 2;
  }

  const { compileStoryboard, buildStandalonePage, buildDesignPage, buildScenesPage } = loadEmitter();
  let failed = 0;

  for (const film of films) {
    const dir = path.join(filmsDir, film);
    const sb = JSON.parse(fs.readFileSync(path.join(dir, 'storyboard.json'), 'utf8'));
    console.log(`\n=== ${film} ===`);

    /* Chain the timeline before anything reads it — reconcile, the gates and
       the page writers all see the same normalized start/dur/duration. */
    const timeline = normalizeTimeline(sb);

    const resolved = resolveMode(sb, mode);
    if (resolved.error) {
      console.error(`  MODE: ${resolved.error}`);
      failed++;
      continue;
    }
    const { top, mathInfo, deferred, warnings, declared, unapplied, unsafe, informational } = reconcile(sb, resolved.design, mode);
    /* A chain-wins override is a discarded authored value — it belongs in the
       same report every other loss prints in. Derived-only films get the quiet
       `timeline` line instead: a documented default is not a loss. */
    for (const d of timeline.discards) warnings.push(d);
    if (timeline.notes.length) console.log(`  timeline         ${timeline.notes.join(' · ')}`);

    if (resolved.modes.length) {
      const tag = resolved.swapped && resolved.swapped.length ? resolved.swapped.length : 0;
      console.log(`  mode           ${mode} (of ${resolved.modes.join(', ')})${tag ? ` — ${tag} token${tag === 1 ? '' : 's'} overridden` : ''}`);
      console.log(`  background     ${top.background || '(emitter default #0e1512)'}`);
    }

    /* ── build-time utilities (plan §2, Route A) ──────────────────────────
       Scanned from the GENERATED document, after reconcile, so only elements
       that actually ship contribute candidates — and BEFORE the clip
       compiles, so clip json, the standalone page and the scenes preview all
       inline the same stylesheet the gates will measure. No candidates → no
       block → zero bytes: legacy films do not move. */
    const tw = await attachUtilities(top);
    if (tw.block) {
      console.log(`  utilities      ${(tw.block.length / 1024).toFixed(1)}KB compiled at build time (${tw.tokens} candidate token${tw.tokens === 1 ? '' : 's'}, no runtime)`);
    } else if (tw.unrecognized.length) {
      informational.push(`class tokens compiled to no utility rule: ${tw.unrecognized.join(', ')} — custom classes in a scoped <style> are expected here; a mistyped utility lands in this list too`);
    }

    // ── gate 1: the clip must have a real duration and name ──────────────
    const clip = compileStoryboard(top);
    const structural = [];
    if (!Number.isFinite(clip.dur) || clip.dur <= 0) structural.push(`dur is ${clip.dur} — the clip has no length`);
    if (clip.dur !== sb.meta.duration) structural.push(`dur ${clip.dur}s != authored ${sb.meta.duration}s`);
    if (clip.name !== sb.meta.title) structural.push(`name "${clip.name}" != authored "${sb.meta.title}"`);
    const scenesEmitted = (clip.html.match(/hss-scene/g) || []).length;
    if (scenesEmitted !== top.scenes.length) structural.push(`${scenesEmitted} scenes emitted, ${top.scenes.length} authored`);

    /* ── the maths renderer must actually have landed ──────────────────────
       This is the check the old design could not make. `design.math.src`
       could name a renderer, the gate could pass on it, and the clip could
       still have shipped without one — the two ends of this pipeline did not
       share a value. `top.math` is built here and spliced by the emitter, so
       assert both halves: the blob exists AND the clip html carries it. */
    if (top.math && !/<script src="data:text\/javascript;base64,/.test(clip.html)) {
      structural.push('design.math.src resolved to an inlined KaTeX, but the clip html carries no data: script — the emitter did not splice sb.math');
    }

    // ── gate 2: every element in the compiler's path must render ─────────
    // Counts hss-el wrappers that are EMPTY. buildElHtml now throws rather
    // than falling out of its switch, so an empty wrapper no longer means
    // "unknown type" — it means a type that DOES have a case and still built
    // nothing, e.g. `cards` with an empty item list. That is a different bug
    // and still a bug, so the count stays; step 3 is what catches the
    // unknown-type case now. Counting .hss-text instead would only work while
    // text was the only buildable type, and it silently stopped measuring
    // anything the moment stat/card/tiles/pills/credit arrived.
    const inPath = top.scenes.reduce((a, s) => a + s.elements.length, 0);
    const wrappers = (clip.html.match(/<div class="hss-el[^"]*" id="[^"]+"[^>]*>/g) || []).length;
    const empty = (clip.html.match(/<div class="hss-el[^"]*" id="[^"]+"[^>]*><\/div>/g) || []).length;
    if (wrappers !== inPath) structural.push(`${wrappers}/${inPath} in-path elements produced a wrapper`);
    if (empty) structural.push(`${empty} element(s) rendered as an EMPTY div — buildElHtml has no case for the type`);

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
    console.log(`  elements       ${wrappers - empty} rendered, ${empty} empty, ${deferred.length} deferred, ${authored} authored`);
    console.log(`  round trip     ${wrappers + deferred.length}/${authored} accounted for`);
    if (mathInfo) {
      const kb = (n) => (n / 1024).toFixed(0) + 'KB';
      console.log(`  maths          katex@${mathInfo.version || '?'} inlined from "${mathInfo.src}" ` +
        `— ${kb(mathInfo.bytes)} in this clip's html, no network`);
    }

    if (structural.length) {
      console.log('  STRUCTURAL FAIL:');
      for (const w of structural) console.log(`    - ${w}`);
      failed++;
    } else {
      console.log('  structural     OK — duration, name, scene count and every in-path element check out');
    }

    if (unsafe.length) {
      console.log(`  UNSAFE COPY (${unsafe.length}):`);
      for (const u of unsafe) console.log(`    - ${u}`);
      failed++;
    }

    if (unapplied.length) {
      console.log(`  DESIGN FIELDS NOT APPLIED (${unapplied.length}):`);
      for (const u of unapplied) console.log(`    - ${u}`);
      failed++;
    }

    if (informational.length) {
      console.log(`  authored but N/A for a film (${informational.length}):`);
      for (const w of informational) console.log(`    - ${w}`);
    }

    if (declared.length) {
      console.log(`  DECLARED — applied, and invisible unless printed (${declared.length}):`);
      for (const d of declared) console.log(`    - ${d}`);
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
      const outFile = path.join(dir, resolved.modes.length > 1 ? `reel-clip-${mode}.json` : 'reel-clip.json');
      fs.writeFileSync(outFile, JSON.stringify({ name: clip.name, dur: clip.dur, ds: clip.ds, html: clip.html, css: clip.css, js: clip.js }, null, 2));
      console.log(`  wrote          ${path.relative(ROOT, outFile)}`);
    }
    if (writeHtml) {
      // A clip that passes every structural gate but renders nothing is still
      // a failure, so the standalone page is the artefact to actually look at.
      const outFile = path.join(dir, resolved.modes.length > 1 ? `reel-preview-${mode}.html` : 'reel-preview.html');
      fs.writeFileSync(outFile, buildStandalonePage(top));
      console.log(`  wrote          ${path.relative(ROOT, outFile)}`);
    }
    if (writeDesign) {
      /* One board per film carrying every declared mode, each built from its
         OWN resolved design — so the dark column is the dark palette, not the
         light one relabelled. */
      const boardNames = (sb.design && sb.design.modes && Object.keys(sb.design.modes).length)
        ? Object.keys(sb.design.modes) : [mode];
      const boards = boardNames.map((m) => {
        const rm = resolveMode(sb, m);
        const rec = reconcile(sb, rm.design, m);
        return designBoard(sb, m, rm.design, rec.top, rec.top.theme);
      });
      const outFile = path.join(dir, 'design-preview.html');
      const page = buildDesignPage({
        title: sb.meta.title,
        id: sb.meta.id,
        fonts: top.fonts,
        boards,
        /* the animation preview is one click away, and the two are the same
           data — a board that cannot get you to the film is half a tool */
        preview: resolved.modes.length > 1 ? `reel-preview-${mode}.html` : 'reel-preview.html',
      });
      fs.writeFileSync(outFile, page);
      console.log(`  wrote          ${path.relative(ROOT, outFile)}  (${boards.length} mode${boards.length === 1 ? '' : 's'}: ${boards.map((b) => b.mode).join(', ')})`);
    }
    if (writeScenes) {
      /* One stage per scene, settled and unplayed. The markup is the SAME
         compiled scene the clip ships — handed over as markup, not re-rendered
         — so a component cannot look right on this page and wrong in the film.
         The scene list comes from `top`, the emitter-facing storyboard, because
         that is what `clip.sceneHtml` was compiled from and the two must be
         indexed by the same array. */
      const stageBg = resolved.modes.length ? null : (top.background || sb.background || null);
      const stageMode = resolved.modes.length ? mode : null;
      const ratio = top.aspect === '9:16' ? '9 / 16' : (top.aspect === '1:1' ? '1 / 1' : '16 / 9');
      const scenes = clip.sceneHtml.map((html, i) => {
        const sc = top.scenes[i];
        const types = [...new Set((sc.elements || []).map((e) => e.type))].sort();
        return {
          index: i + 1,
          id: sc.id,
          start: (sc.start_ms / 1000).toFixed(1),
          end: (sc.end_ms / 1000).toFixed(1),
          dur: ((sc.end_ms - sc.start_ms) / 1000).toFixed(1),
          elements: (sc.elements || []).length,
          kinds: types.join(' '),
          html,
          bg: stageBg,
          mode: stageMode,
          ratio,
          note: stageMode ? `settled · not animated · ${stageMode}` : 'settled · not animated',
        };
      });
      const outFile = path.join(dir, 'scenes-preview.html');
      fs.writeFileSync(outFile, buildScenesPage({
        title: sb.meta.title,
        id: sb.meta.id,
        /* the film's own stylesheet and runtime, unmodified */
        css: clip.css,
        js: clip.js,
        /* the same inlined KaTeX the clip carries: this page embeds the
           scenes' own markup, so a `$$…$$` formula here would otherwise show
           up raw while the film shows it set — two artefacts disagreeing
           about what a scene looks like, which is the whole defect class the
           boards exist to close. */
        math: top.math,
        fonts: top.fonts,
        scenes,
        preview: resolved.modes.length > 1 ? `reel-preview-${mode}.html` : 'reel-preview.html',
        board: 'design-preview.html',
      }));
      console.log(`  wrote          ${path.relative(ROOT, outFile)}  (${scenes.length} scene${scenes.length === 1 ? '' : 's'}, settled)`);
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

/* reel-contrast.cjs borrows resolveMode + reconcile rather than keeping its
 * own copy. A second resolver would drift, and a contrast gate that measures a
 * different palette than the one that actually ships is worse than no gate at
 * all. Exported for exactly that reason, and nothing else. */
module.exports = {
  /* normalizeTimeline joins the test surface for the same reason reconcile
     did: the timeline chain is logic the gates must agree with, and a second
     copy of it in a test would only prove the copy. */
  __test: { resolveMode, reconcile, designBoard, normalizeTimeline, DEFAULT_SCENE_DUR, attachUtilities },
  main,
};

/* main() awaits attachUtilities(), so it hands back a promise — exiting
 * synchronously here would print OK and exit 0 before a single film compiled
 * (and an unhandled rejection would be a silent nonzero at best). The two
 * outcomes are the same ones the sync script had: an exit code, or a loud
 * failure with the reason. */
if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error('reel-compile: FAILED — ' + ((err && err.stack) || err));
      process.exit(1);
    },
  );
}