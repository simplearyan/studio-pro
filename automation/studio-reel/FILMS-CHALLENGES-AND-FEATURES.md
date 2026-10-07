# Building the reel — challenges and features so far

*Seven films, one shared emitter, and a growing pile of gates. This is the
cross-film record: what had to be BUILT for each film, what went WRONG on the
way, and which check now keeps each wrong thing wrong-proof. Per-film detail
lives in each film's own `Design.md` / `NOTES.md`; this document is the map
between them.*

Last verified: all gates green on the current tree — reel-schema (7 films),
reel-compile, reel-fidelity, reel-regression (**130 checks**), reel-contrast
(**384/384 text nodes**), reel-extent (**219 element boxes**),
vendor-katex --check, `npm run build` (89 precache, 7550.89 KiB).

---

## 1. The films, and what each one forced

| # | film | subject / mock | what it demanded of the pipeline |
|---|---|---|---|
| 1–4 | `breath-of-air`, `jan-suraaj`, `studio-pro-showcase`, `two-queens` | the original four: the first film (no `style` declared, normal/alarm/positive tones), neo-brutalism on a dotted stage, synthwave brutalism on a dotted stage, and Material 3 with light+dark modes and the formulae | the IR itself: roles→sizes, tones→hex, seconds→ms, surfaces (flat + dots), fills/radii, modes, `slots`, and the first element types |
| 5 | `the-peak` | VOX editorial, UN population data | the `chart` element (columns/bars/line/donut), reference lines, the authorable axis floor, KaTeX vendoring for offline exports |
| 6 | `annotation-studio` | Annotation Studio Pro v1.3, light mode, annotation-as-design | the `shape` mark vocabulary: `circle` / `arrow` / `highlight`, overlays that aim at a target, the `draw` entrance, a throwing unknown-kind, the first light-mode film |
| 7 | `elements-annotator` | Vox Emphasis Animator v0.4, text + annotation | `dbl-underline` (double rule), reuse of the whole mark vocabulary with zero runtime change, the replaced-element sizing lesson |

## 2. Features that exist now, and the film that asked for them

### Element vocabulary
- **`chart`** (the-peak) — four kinds, inline SVG so every gate can see it,
  geometry computed once at compile time and carried on each mark as
  `data-*`, animated purely from `t` via `_chart`. 124 measured text nodes on
  that film against 13 before — labels became gate-visible the day charts
  stopped being canvas-shaped.
- **`ref` / `ref_label`** (the-peak) — a threshold drawn on the VALUE axis
  (so `bars` gets a vertical rule, not a line that reads as another series),
  drawn even with `grid: off`, clamped inside the plot, never allowed to set
  the scale.
- **`min` axis floor** (the-peak) — 0 stays the default so a truncated axis
  cannot happen by accident; a declared floor is APPLIED and PRINTED
  (`declared[]` inventory), because 18 seconds of movement inside a
  241-second space draws flat without it.
- **`shape` marks** (annotation-studio, elements-annotator):
  - `box`, `underline` — the legacy CSS-border kinds, byte-identical forever;
  - `circle` — stretched-ellipse ring, `preserveAspectRatio="none"` +
    `vector-effect="non-scaling-stroke"` + `pathLength="1"`;
  - `arrow` — fixed-pixel curved pointer from `side` (left/right/top/bottom),
    tip measured to land 2px inside its target;
  - `highlight` — alpha marker wipe driven by width;
  - `dbl-underline` — two draw-on rules in a fixed 12px bottom strip
    (elements-annotator), added with **zero runtime change** because it
    speaks the existing `data-k="draw"` vocabulary.
- **`unknownShapeError` / `emitterSupportsShape` / `unknownArrowSideError`**
  — the throwing-default philosophy one level down: an unknown *kind* used to
  reach the stylesheet as a class nobody wrote and render the default border.
  reel-compile asks the emitter (same as types), so the refusal message and
  the inventory can never disagree.
- **`in.type: "draw"`** — an entrance that pins the host at full opacity
  while the stroke or wipe carries the phase. Marks get their own clock:
  words land, pause, pen follows. That pause is the rhythm of films 6 and 7.

### Honesty machinery (compiler ↔ schema ↔ emitter)
- `buildElHtml` throws on unknown **types**; `emitterSupportsType()` asks the
  switch instead of a hand-kept `BUILDABLE` list.
- reconcile validates `shape` kinds, requires `of`, forbids cross-scene
  overlays (the mark would hide on the wrong scene's clock), validates
  `side`, and reports everything as `deferred`/`unapplied` with the emitter's
  own wording.
- Schema enums mirror the emitter for authoring (`type`, `shape`, `side`,
  entrance `draw`), caught at a JSON POINTER — while the emitter stays the
  contract.
- `num_color` resolved separately from the caption colour — it was silently
  dropped while the schema claimed APPLIED (film 6 surfaced it; the-peak's
  brand numeral was the visible casualty).

### Infrastructure
- KaTeX vendored at `public/vendor/katex` (katex@0.16.11, sha256 manifest),
  fonts as inlined data-URI, scripts as `data:` URLs, `design.math.src`
  defaulting local — a clip renders maths with no network.
- `reel-contrast` measures in a **real browser over CDP** (shared `cdp.cjs`
  with reel-extent) — the tabulated cascade (six tables + a contract check)
  is gone; a browser resolves the cascade that actually shipped, and a gate
  that cannot run exits non-zero rather than skipping.
- `reel-extent` measures every element at its scene MID-frame in a real
  browser; `.hss` is `overflow:hidden`, so an overflow is a silent crop —
  this gate is the only thing that sees it.
- One colour resolver (`theme_map` → tokens → per-mode), one ramp resolver,
  one film auto-discovery: every gate finds `films/*/storyboard.json` itself.

## 3. Challenges, one at a time — symptom, fix, proof

### 3.1 An unknown type rendered an empty div with a green exit code
**Symptom:** `buildElHtml` fell out of its switch with `inner === ''`;
the film was correct minus one element, no warning anywhere.
**Fix:** a throwing `default` carrying an `unknownType` flag; reel-compile
defers the element with the emitter's own message; `emitterSupportsType()`
replaced the duplicated `BUILDABLE` list.
**Proof:** regression section "the silent-empty-div fallback is now a hard
failure" — the baseline's silent loss is still asserted (as history), the
working tree must throw.

### 3.2 Offline exports rendered raw `$$…$$`
**Symptom:** three jsDelivr tags; no network → `_hssSetup` retried forever,
the formula stayed source text, gate green.
**Fix:** `vendor-katex.cjs` pins the dist with a sha256 manifest; the
compiler INLINES css/fonts/js into the clip (`sb.math`), `--check` verifies.
**Proof:** both `data:` scripts present with katex BEFORE auto-render,
inlined CSS byte-equals the vendored file, a film with no formulae ships
none of it.

### 3.3 The contrast gate was six tables that could drift
**Symptom:** tabulated cascade re-enumerated the emitter's rules by hand; the
day a component changed, the tables were silent or wrong (the same failure
mode as `BUILDABLE`).
**Fix:** measure `getComputedStyle` in headless Chrome over CDP; keep only
the WCAG maths in Node (one copy, borrowed by the design board).
**Proof:** 384 text nodes across 7 films; no browser / protocol failure exits
non-zero.

### 3.4 Canvas charts would have been invisible to every gate
**Fix:** charts are inline SVG — DOM for extent, `<text>` for contrast;
geometry computed ONCE at compile time and carried as `data-*`, so the
runtime only ever knows progress, never scale.
**Proof:** every chart regression assertion matches coordinates, not prose.

### 3.5 A threshold chart needs a truncated axis; a truncated axis is a lie
**Fix:** `min` became authorable with 0 still the default; an authored floor
above 0 is applied AND printed as a `declared` line.
**Proof:** floor fixtures assert the threshold lands where the floor says,
ticks print the floor, stacked charts keep their zero, and an unauthored
chart still starts at 0.

### 3.6 The overlay move lived in `onFrame` — settle-only pages drew marks across the whole stage
**Symptom (film 6, found by LOOKING at scenes-preview):** the scenes page
settles without ever calling `onFrame`, so overlays never moved into their
targets: every ring sized itself to the SCENE (a giant ellipse over the whole
stage) and every highlight painted the entire scene amber. Every gate was
green — they all run `onFrame`.
**Fix:** the patch moved INSIDE `_hssSetup`, the one hook every consumer
runs, guarded by `parentNode` so it is a true once-only move (appendChild
reinserts even when the node is already there — a reinsert per overlay per
frame would invalidate layout 60×/s).
**Proof:** regression counts the appendChild patches; the scenes pages of
films 6 and 7 now show every mark on its target.

### 3.7 The arrow drew ACROSS the words it pointed at (class nobody styled)
**Symptom:** CSS said `svg.hss-arrow-l/r/t/b`, markup said
`hss-arrow-left/right/top/bottom` — the horizontal anchor never matched, so
the svg fell back to static position and spanned the target. No gate compares
emitted classes to styled classes.
**Fix:** CSS renamed to the emitted classes; regression now asserts
**every side the emitter emits has an anchor rule**, because a styled class
and an emitted class are one contract.
**Proof:** measured tip = `overlay.x + 8` = 2px inside the target card.

### 3.8 A viewBox is not a width (film 7's double rule rendered 100px)
**Symptom:** `.hss-dbl` used `left:0; right:0` with no width — an
abs-positioned SVG is a REPLACED element, so it sized to its viewBox (100px)
and `right` was ignored; a 100px rule under a 260px headline.
**Fix:** explicit `width:100%`; regression asserts the rule WITH its width —
the position half alone looks complete and measures wrong.
**Proof:** strips now measure target + 12px, sitting 3px below.

### 3.9 The arrowhead would be squeezed by any aspect ratio
**Fix:** the arrow is a FIXED-pixel 160×56 (or 56×160) svg anchored to one
edge — never a host-relative viewBox — so the head cannot collapse into a
sliver no matter how wide the target is. Symmetric heads tolerate the
remaining axis stretch; the ring goes the other way (stretch on purpose,
uniform stroke via `non-scaling-stroke`) because an ellipse stays an ellipse.

### 3.10 A highlight with `mix-blend-mode` would have painted an opaque block
**Why:** the overlay carries `will-change: opacity` → it is a stacking
context → stacking contexts ISOLATE blending, so a multiply child would blend
against an empty group and cover the words.
**Fix:** plain alpha (`.hss-hl{opacity:.4}`) composites against the text the
old-fashioned way. The rule that pairs with it: highlights only ever sit on
display-size type (AA needs 3:1 there), ink stays `#131720`.

### 3.11 Light mode broke two colour assumptions the dark films never hit
- A panel label at 0.75 opacity on brand blue measured **3.61:1**; blue-700
  measured **4.48:1**; blue-800 `#1e40af` measures **5.64:1** — fixed by
  MEASURING in the gate, not by arithmetic on paper (the hand calculation was
  4.7 and the browser said 4.48).
- Muted `on-variant` at .78 opacity under a stat label lands near 3.6:1 on
  white — film 6 gives that label ink instead.
- Film 7's rose floor is 4.27:1, passing as bold-large text (20px/700); the
  film's own NOTES record the threshold reasoning so nobody "fixes" it
  unnecessarily.

### 3.12 `num_color` was dropped while the schema claimed APPLIED
**Symptom:** the stat branch resolved ONE colour for numeral AND caption, so
the-peak's authored brand numeral shipped in the caption's muted ink.
**Fix:** resolve `num_color` against the film's tokens, fall back to the
caption colour; regression asserts two roles, two resolutions.

### 3.13 Regeneration can relabel a film with the wrong mode
**Rule:** a dark pass over ALL films writes single-mode boards labelled dark.
Order is mandatory: `--mode dark --only two-queens` FIRST, then the light
pass over everything. Gates re-run after any `--write-*` (regenerated
previews contain the current CSS).

### 3.14 The baseline must not be HEAD
**Rule:** regression compares against a PINNED baseline (`baf1d56`), never
HEAD — otherwise the suite compares the new emitter to itself the moment the
change lands. Intentional runtime edits are declared in `RUNTIME_EDITS`;
everything else must stay a superset, additive lines only. Legacy html is
asserted byte-identical (after the documented `;`/`var()` normalisation).

### 3.15 The preview compositor died mid-session
**Symptom:** screenshot capture returned "produced no frames" for every tab,
reloads included. Film 7's visual pass had to proceed without eyes.
**Fallback used:** geometry probes (box vs target, padding, parenting),
computed styles (ink values), and animation probes (`onFrame(t)` mid-phase →
`dashoffset` 0.4705 vs theoretical 0.471, width 87.5% vs 87.5%). The CDP
gates launch their OWN Chrome and were unaffected.
**Lesson:** screenshots are review sugar; the gates and probes are the
evidence.

## 4. The working method these films produced

1. **Ask the implementation, don't copy it** — `emitterSupportsType`,
   `emitterSupportsShape`, one theme resolver, one colour resolver. Two lists
   describing one thing WILL drift, and they drift toward silent loss.
2. **Measure, don't arithmetic** — contrast, tip positions, strip widths,
   animation phases: all verified in a browser, numbers quoted from the
   measurement, not from the design intent.
3. **Fail at the place that knows** — throwing defaults (types, kinds, sides),
   `deferred`/`unapplied` inventories, `declared` prints for choices that are
   applied but invisible.
4. **Everything is a function of `t`** — no CSS transitions, no wall clock:
   scrub, deep links, the exporter and the frame-diff gate all agree because
   there is one timeline.
5. **Marks are elements with their own clocks** — annotation lands after the
   sentence it annotates; that pause is the house style of films 6 and 7.
6. **Provenance ships in the repo** — each film keeps the exact mock under
   `reference/` and a NOTES table mapping every claim to a line in it.
7. **Regenerate in order, re-run gates after writing, pin the baseline.**

## 5. Known gaps (honest list)

- A mark's overlap INTO its target (ring −14px, rule −9px, arrow tip +2px) is
  design intent no gate measures; extent skips absolutely-positioned children
  when measuring the host.
- The highlighter's alpha sits outside the contrast gate's backdrop model
  (it measures text against ancestors, not against a translucent sibling).
  Authoring discipline covers it; it is not machine-checked.
- Webfonts come from Google Fonts — offline, extent warns that boxes were
  measured in a fallback face.
- Arrow sides `top`/`bottom` are implemented and regression-checked but
  unused by any film (they need vertical gap headroom a centred column rarely
  has).
- Screenshot capture depends on the Preview panel's compositor, which is not
  part of any gate (see 3.15).
