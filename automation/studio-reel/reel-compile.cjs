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

/* Element types buildElHtml() actually has a `case` for. Anything else falls
 * through the switch with inner='' and emits an empty wrapper. Read off the
 * emitter's switch, not from the docs — this is the contract that matters. */
const BUILDABLE = new Set(['text', 'latex', 'answer', 'cards', 'image', 'shape',
  'stat', 'card', 'tiles', 'pills', 'credit']);

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

/* Why each type cannot be expressed, in the emitter's terms. stat/card/tiles/
   pills/credit were here until the emitter grew cases for them; anything still
   listed is genuinely outside its vocabulary. */
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
  'scenes[].background (now APPLIED per scene — flat, dots and gradient recipes; an unknown type is still reported)',
  'scenes[].ambient (no decorative-layer concept at all — 3 layers in this film)',
  'scenes[].exit, scenes[].tone, scenes[].frame',
  'elements[].in.ease (the runtime hardcodes three curves: _eo ease-out, _eb back, else fade. Every cubic-bezier in the IR is discarded)',
  'elements[].in.type "slot" (falls through to the fade branch, losing from_scale)',
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

function reconcile(sb, designIn, mode) {
  const deferred = [];
  const scenes = [];
  const warnings = [];
  const unsafe = [];
  const informational = [];
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
    for (const e of sc.elements) {
      if (!BUILDABLE.has(e.type)) {
        deferred.push({ scene: sc.id, id: e.id, type: e.type, reason: DEFER_REASON[e.type] || 'no emitter case' });
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
        el.num_color = hex;
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
        el.meter_at_ms = e.meter_at_ms || 0;
      } else if (e.type === 'tiles') {
        el.columns = e.columns || 1;
        el.items = (e.items || []).map((i) => ({ icon: i.icon, head: i.head, body: i.body }));
      } else if (e.type === 'pills') {
        el.items = e.items || [];
        el.color = hex;
      } else if (e.type === 'credit') {
        el.text = e.text;
        /* `place.bottom` / `place.align` are authored but the emitter pins the
           footer to bottom-centre; recorded so the loss is not silent */
        if (e.place && (e.place.bottom != null || e.place.align)) {
          warnings.push(`${e.id}: place.bottom/align ignored — the emitter pins the credit to bottom-centre`);
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
        if (e.in.overshoot !== undefined) el.in.overshoot = e.in.overshoot;
        if (e.in.stagger_ms !== undefined) el.in.stagger_ms = e.in.stagger_ms;
        el.in.start_ms = e.in.start_ms || 0;
        el.in.dur_ms = e.in.dur_ms || 600;
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
    for (const k of ['num-a', 'num-b', 'meter-track', 'slab-ink', 'fill', 'fill-ink', 'fill-tone', 'outline']) {
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
     P9. `latex` emits three CDN tags; an offline export renders raw `$$…$$`
     with no error and a green gate. The compiler cannot prove the network
     works, but it CAN refuse to ship a maths film that names no renderer at
     all — which is what an offline export actually produces. */
  const hasLatex = scenes.some((sc) => sc.elements.some((e) => e.type === 'latex' || e.type === 'answer'));
  if (hasLatex) {
    const src = (design && design.math && design.math.src) || 'cdn:jsdelivr katex@0.16.11';
    if (typeof src !== 'string' || !src.trim()) {
      unsafe.push('this film has latex/answer elements but design.math.src is empty — it would export raw `$$…$$`');
    } else if (/^cdn:/i.test(src)) {
      informational.push(`design.math.src="${src}" — a network fetch; an OFFLINE export renders raw $$…$$. Point it at a vendored file to render offline.`);
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
  const declared = (design && design.modes) ? Object.keys(design.modes) : [];
  const built = {};
  for (const name of declared) {
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
    for (const k of ['num-a', 'num-b', 'meter-track', 'slab-ink', 'fill', 'fill-ink', 'fill-tone', 'outline']) {
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
  if (declared.length) {
    top.modes = built;
    top.mode = built[mode] ? mode : declared[0];
    top.ui = { theme_toggle: true };
  }

  return { top: Object.assign(top, { scenes, theme, fonts }), deferred, warnings, unapplied, unsafe, informational };
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

  return {
    mode,
    bg: (top.modes && top.modes[mode] && top.modes[mode].bg) || top.background || '#0e1512',
    theme: Object.assign({}, theme),
    palette: tokens,
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
  /* the style board: a page that shows the design system on its own, with no
     animation and no timing. One file per film carrying EVERY declared mode,
     because comparing light against dark is the whole point — two files is
     how they drift. */
  const writeDesign = argv.includes('--write-design');
  const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
  const mode = argv.includes('--mode') ? argv[argv.indexOf('--mode') + 1] : 'light';

  const filmsDir = path.join(__dirname, 'films');
  const films = fs.readdirSync(filmsDir).filter((d) => fs.existsSync(path.join(filmsDir, d, 'storyboard.json')) && (!only || d === only));
  if (!films.length) {
    console.error('reel-compile: no film with a storyboard.json found');
    return 2;
  }

  const { compileStoryboard, buildStandalonePage, buildDesignPage } = loadEmitter();
  let failed = 0;

  for (const film of films) {
    const dir = path.join(filmsDir, film);
    const sb = JSON.parse(fs.readFileSync(path.join(dir, 'storyboard.json'), 'utf8'));
    console.log(`\n=== ${film} ===`);

    const resolved = resolveMode(sb, mode);
    if (resolved.error) {
      console.error(`  MODE: ${resolved.error}`);
      failed++;
      continue;
    }
    const { top, deferred, warnings, unapplied, unsafe, informational } = reconcile(sb, resolved.design, mode);

    if (resolved.modes.length) {
      const tag = resolved.swapped && resolved.swapped.length ? resolved.swapped.length : 0;
      console.log(`  mode           ${mode} (of ${resolved.modes.join(', ')})${tag ? ` — ${tag} token${tag === 1 ? '' : 's'} overridden` : ''}`);
      console.log(`  background     ${top.background || '(emitter default #0e1512)'}`);
    }

    // ── gate 1: the clip must have a real duration and name ──────────────
    const clip = compileStoryboard(top);
    const structural = [];
    if (!Number.isFinite(clip.dur) || clip.dur <= 0) structural.push(`dur is ${clip.dur} — the clip has no length`);
    if (clip.dur !== sb.meta.duration) structural.push(`dur ${clip.dur}s != authored ${sb.meta.duration}s`);
    if (clip.name !== sb.meta.title) structural.push(`name "${clip.name}" != authored "${sb.meta.title}"`);
    const scenesEmitted = (clip.html.match(/hss-scene/g) || []).length;
    if (scenesEmitted !== top.scenes.length) structural.push(`${scenesEmitted} scenes emitted, ${top.scenes.length} authored`);

    // ── gate 2: every element in the compiler's path must render ─────────
    // Counts hss-el wrappers that are EMPTY — i.e. buildElHtml fell through its
    // switch and produced <div class="hss-el" id="…"></div>. Counting
    // .hss-text instead would only work while text was the only buildable
    // type, and it silently stopped measuring anything the moment stat/card/
    // tiles/pills/credit arrived. This asks the question directly.
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
  __test: { resolveMode, reconcile, designBoard },
  main,
};

if (require.main === module) process.exit(main());