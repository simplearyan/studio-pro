# Studio Reel — Tailwind & expressive motion plan

Status: **plan only — nothing here is shipped.** Every claim about today's
behavior was read out of `storyboard.schema.json`, `docs/html-in-canvas/hic-storyboard.js`,
`docs/html-in-canvas/hic-frame.js`, `docs/html-in-canvas/test-renderer.html` or the
gate sources on 2026-10-07. Numbers (282 KB vendor file, 12 element types, 5
entrance types, 130 regression checks) are measured, not remembered.

Two questions, two answers up front:

1. **Can the reel use Tailwind like test-renderer?** Yes — but only the
   *build-time* half of what test-renderer does. The reel ships committed,
   self-contained HTML that gates measure as real paint; the runtime JIT that
   the editor pages use is exactly what the reel must not inherit. See §2.
2. **What more motion?** The schema already wrote the debt list: every field
   marked `DISCARDED` is a designed-but-unshipped feature — `ease`, `slot`,
   `scenes[].exit`, `scenes[].ambient`, `frame.beat`, `frame.safe`,
   `elements[].rotate`. Implementing those, plus a motion gate, is the bulk of
   this plan. See §3–§5.

---

## 0. Constraints that decide every recommendation below

These are not preferences; they are what the gates enforce today.

- **Animation is a pure function of `t`.** No wall clock, no CSS keyframes, no
  transitions — scrub, deep links and the exporter all disagree otherwise.
  The schema says it plainly in `$defs.entrance.description`. Any feature that
  cannot be expressed as `style(t)` does not ship.
- **Offline and self-contained.** KaTeX was vendored because offline `$$…$$`
  broke a gate; every script a preview loads is a `data:` URI (two-queens
  carries KaTeX that way), so the document makes no file or network request of
  its own. A CDN is a regression.
- **Legacy byte-identity.** `reel-regression` pins the five older films'
  outputs. New features must be opt-in: a film that adopts nothing must emit
  nothing new — no `RUNTIME_EDITS` entries for free.
- **Gates measure the final paint.** `reel-contrast` (384 nodes),
  `reel-extent` (219 boxes) and `reel-fidelity` read committed files in a real
  browser. Anything that compiles styles *after* first paint makes the gates
  measure a frame that never ships.
- **Schema honesty.** APPLIED means applied; DISCARDED means the compiler
  reports the loss. This plan's first job is shrinking the DISCARDED list, not
  growing a new vocabulary of lies.

---

## 1. Where Tailwind stands today (verified)

- **test-renderer / designs (the HIC pages)** load Tailwind as a *runtime*:
  `hic-frame.js` injects the vendored `public/vendor/tailwind-browser/index.global.js`
  (`@tailwindcss/browser` v4.3.3, **282,289 bytes**) only when the clip's markup
  actually uses utilities (regex on `bg- text- flex grid …` or a literal
  `tailwindcss` marker), because the Play-CDN MutationObserver warns on every
  DOM change otherwise. test-renderer's standalone export instead points at
  `cdn.tailwindcss.com` (its own comment: "utility coverage" differs between
  the two), and its `tailwind-cards` preset states the intent — *"Utility
  classes compiled to a static stylesheet — no runtime needed."*
- **The toolchain for compiling exists locally**: `node_modules/@tailwindcss/`
  contains `node`, `oxide` (+ the win32 native binary), `browser`, `postcss`.
  A programmatic v4 compile is drivable from plain Node without a CDN.
- **The reel schema has no free-markup element.** The 12 element types are
  structured (`text, latex, answer, cards, image, shape, stat, card, tiles,
  pills, credit, chart`); `buildElHtml` throws on anything else. Tailwind has
  nowhere to attach until that changes.

## 2. Tailwind for the reel — decision

### Route A (adopt): compile utilities at build time

`reel-compile --write-html` scans the generated document for utility
candidates, compiles them with `@tailwindcss/node` (oxide), and inlines one
stamped `<style>` block next to the emitter's `.hss-*` rules.

- **No candidates → no block → byte-identical output.** The five legacy films
  keep passing `reel-regression` with zero edits.
- Offline, deterministic, zero gate timing risk — contrast/extent see the same
  paint the file will always have. This is test-renderer's "static
  stylesheet" stance, which is the half of test-renderer the reel should copy.
- **Theme bridge:** the compile input declares `@theme` from the film's design
  tokens (`--color-ink`, `--color-brand`, `--radius-card`, font roles), so
  authored markup can say `bg-brand text-ink rounded-card` instead of hexes —
  the same tokens `design-preview.html` already renders.

### Route B (reject): runtime `@tailwindcss/browser` in previews

Rejected because a committed preview that *JIT-compiles on load* is a file
whose bytes are not its paint: the contrast gate would need a "styles settled"
barrier, first-paint flash becomes permanent in exports, and the 282 KB
runtime rides on every film for markup that usually needs zero utilities. If
an authoring-time playground ever needs it, it belongs in the scratch pages,
not in artifacts. The Play CDN is rejected outright — network.

### What ships with it: `type: "html"` element

Tailwind is only useful where classes can live. Add one element type:

- `type: "html"` — a raw markup block (no `<script>`; utilities and a scoped
  `<style>` allowed), sized like `card` (layout, align, max_width), rendered
  verbatim by `buildElHtml`.
- Fidelity maps it as passthrough; contrast walks its text nodes (already
  generic); extent budgets its box like any element; regression gains a
  fixture check.
- This is also the general escape hatch every film has wanted for tables,
  code cards and one-off compositions that don't fit the 12 structured types.

**Phasing:** T1 = `html` element + candidate scan + compile + inline style
(gates: schema enum +1, fidelity, contrast, extent, regression + a new check
*"utilities are compiled, never loaded"* — assert no `tailwindcss` script/CDN
string in any preview). T2 = `@theme` token bridge. T3 (non-goal unless
requested) = any runtime escape hatch.

---

## 3. Motion today — the honest inventory

**Entrances** (`$defs.entrance`): `fade`, `slide` (word-staggered `translateY`),
`pop`, `slot`, `draw` (shape marks only — dashoffset/wipe). Fields: `start_ms`,
`dur_ms`, `from_x`, `from_y`, `from_scale`, `overshoot`, `stagger_ms`.

**Curves**: the runtime hardcodes exactly three (ease-out, back, else fade) —
which is why `ease` is `DISCARDED — see above` in the schema. `slot` falls into
the fade branch and loses `from_scale`.

**Scenes**: cross-fade on a fixed curve (`scenes[].exit` DISCARDED);
`scenes[].ambient` DISCARDED in full — although `$defs.ambient` is already
fully designed (kind, opacity, size, blur, place anchors, loop
{name/dur_ms/iterations/y/from_scale}); `frame.beat` (`hold`/`long` seconds)
and `frame.safe` DISCARDED; `scene.tone` discarded as a colour source;
`elements[].rotate` discarded because the runtime owns `transform` every frame
— the schema itself notes it "needs a composite, not a declaration."

**Data motion**: bars/columns grow from the baseline, meters sweep width at
`meter_at_ms`, chart entrance staggers per bar (`chart_in.stagger_ms`), stat
numbers scale-in, marks draw themselves, highlight sweeps its width.

**Everything is `f(t)`** — the property the whole gate suite leans on.

## 4. What to add — ranked, with touchpoints

Each item lists what it changes: **S**chema, **E**mitter, **C**ompile/reconcile,
**G**ates.

### P0 — Easing library + fix `slot` (do first; everything else leans on it)
- Emitter curve table: `linear, out, in, inout, back, elastic, bounce` plus a
  named cubic-bezier set (`out-quad`, `out-quart`, `out-expo`…), evaluated in
  the same `style(t)` pass. Schema: `ease` becomes an enum of those names —
  first DISCARDED field to go APPLIED. C: reconcile rejects unknown names.
  G: regression pins sampled outputs (e.g. `back(0.3) = literal`), existing
  contrast/extent untouched. S+E+C+G, small.
- Fix `slot`: apply `from_scale` so slot ≠ fade. G: +2 regression checks
  (markup + probe).
- Why first: exits, paths, count-ups, ambient loops all need curves; adding
  them under three hardcoded curves multiplies rework.

### P0.5 — `reel-motion.cjs`, the missing gate dimension (see §5)
Land it right after P0 so every later phase arrives gated.

### P1 — Exits and scene transitions
- `element.exit {type, start_ms, dur_ms}` — `fade | slide | shrink | mask`,
  composed in the same pass as entrances (exit windows must stay inside the
  scene; reconcile already knows scene bounds).
- Un-discard `scenes[].exit` with a real vocabulary: `cut, dissolve, wipe,
  push, iris` (per-side for wipe/push). Cross-fade stays the default so
  legacy films stay byte-identical.
- G: contrast samples mid-film — exits must never drop text below the floor at
  the sampled `t` (the gate already asserts floors; verify sample points don't
  land inside an exit). Regression +~8 checks.

### P2 — Text motion depth
- Letter-level stagger (word-level already exists inside `slide`), `blur-in`
  per word, typewriter with a caret for `typeStep` copy, emphasis pulse (a
  bounded loop on one word — `iterations` fixed, still `f(t)`).
- E+S; G: probes via reel-motion (motion-occurs + determinism).

### P3 — Data motion
- Stat count-up: digits roll from 0 to `value` with the chosen curve, timed to
  `meter_at_ms`/`chart_at_ms`.
- Line charts draw progressively (reuse the mark's dashoffset machinery);
  verify donut sweep exists before adding anything.
- `mark_at` reference line and `series` cap — both already on the "Still open"
  list in `PLAN-customization-and-scale.md`; fold them in here so the chart
  work happens once. C+G accordingly.

### P4 — Camera, parallax, ambient, beat
- **Composite transform pass**: one per-element `style(t)` that composes
  camera (scene zoom/pan — Ken Burns), layer depth (each element gains an
  optional `layer` → parallax offset), and beat punch. This is the same
  "needs a composite" fix the schema asked for `rotate` — ship `rotate` as a
  keyed part of that composite in the same change.
- Ship `$defs.ambient` as designed: drifting grids/particles/breathing
  gradients behind scenes, loops expressed as `f(t, iterations)` — decorative
  layers that never touch the wall clock.
- `frame.beat` becomes APPLIED: pacing intent (`hold`/`long`) drives ambient
  pulses and entrance quantization.
- E+S+C; G: extent box count grows (ambient layers are boxes? — decide:
  decorative, `visibility:hidden` at measure time or excluded explicitly in
  the extent walk, stated in the gate, not assumed).

### P5 — Keyframe paths (largest expressiveness win)
- `in.kf: [{t_ms, x, y, s, r, o, e}]` — a mini timeline per element, evaluated
  by the same pass: arcs, orbits, whips, wobble. Multi-keyframe is how
  "complex and expressive" happens without inventing twenty entrance types.
- Motion-path travel (arrow along an SVG path): precompute points at compile
  time so runtime stays a table lookup — no `getPointAtLength` per frame.
- E+C (validate monotonic `t_ms`, in-scene bounds); G: regression fixtures +
  reel-motion determinism on a kf-heavy scene.

### P6 — Marks, surfaces, production furniture
- New mark kinds: `bracket`, `wavy-underline`, `pin` (callout), plus
  sketch-boil (port the app's `sketchBoilingBucket`/jitter idea into the
  emitter as a boiling outline, still `f(t)`).
- Surface `effect`: grain, glow pulse, gradient sweep — one additive field,
  not five new surfaces.
- Production: end-card/outro template, lower-thirds, chapter ticks + progress
  bar (both fed by `frame.beat` once P4 lands).
- Each: E+C+G with the same fixture pattern the six mark kinds used.

## 5. The gate that makes all of this safe — `reel-motion.cjs`

Today's gates know *where* things are and *what colour* they are; none knows
whether anything *moved*. A CDP gate in the `reel-contrast` mold adds three
probes per film:

1. **Determinism** — render frame at `t` twice (fresh runtime each time) →
   identical frame hash. This is the pure-`t` contract as a single check; it
   catches wall-clock and CSS-transition regressions before contrast does.
2. **Motion occurs** — hash at `t_enter-1` vs `t_enter+1` must differ for
   every element with an entrance; hash after settle must equal the next
   frame's (it stopped).
3. **Coverage report** — which entrance/exit/easing/ambient/kf values each
   film actually exercises, printed like the FILMS doc index, so dead
   features are visible (the way `series` wrapping was).

Plus a **motion-gallery fixture film** in the two-queens pattern (one scene
per enum value) — the film that adopts every feature so regressions in any
branch have a victim. Regression grows by roughly one check per feature
shipped (130 → ~150 by P2).

## 6. Phasing

| Phase | What | Touches | Size |
|---|---|---|---|
| T1 | Tailwind compile + `html` element | S,E,C,G | M |
| P0 | Easing enum + `slot` fix | S,E,C,G | S |
| P0.5 | `reel-motion.cjs` + gallery film | G | M |
| P1 | Element exits + scene exit vocabulary | S,E,C,G | M |
| P2 | Text motion depth | S,E,G | M |
| P3 | Count-ups, line draw, `mark_at`, series cap | S,E,C,G | M |
| P4 | Camera/parallax/ambient/beat + composite `rotate` | S,E,C,G | L |
| P5 | Keyframe paths + motion paths | S,E,C,G | L |
| P6 | Marks, surface effects, end cards | S,E,G | M–L |
| T2 | `@theme` token bridge for Tailwind | E,C | S |

Order rationale: P0 first because curves are load-bearing; P0.5 immediately
after so P1+ land behind a gate; the Tailwind track (T1/T2) is independent and
can interleave — it touches no animation code. S/M/L are relative sizes, not
day counts.

## 7. Non-goals (rejected on purpose)

- No CSS keyframes/transitions/wall-clock anywhere — the contract, not a style
  choice.
- No Play CDN; no runtime JIT inside committed previews (§2 Route B).
- No rewriting the existing `.hss-*` chrome in utilities — regression risk,
  zero expressive gain; Tailwind styles *authored* markup only.
- No legacy film changes unless a film opts into a feature (then the normal
  RUNTIME_EDITS discipline applies).
- No audio in reels (gates are visual; keeps the contract one sentence long).
- `scene.tone` stays discarded as a colour source — per-element `color` already
  won that argument; do not revive it as a second colour pipeline.

## 8. Adoption path for authors

When a phase ships: field lands in the schema (APPLIED, with the caveat in its
description — the existing convention), one fixture proves it in the
motion-gallery film, Design.md of the next real film demonstrates it in
context, FILMS-CHALLENGES-AND-FEATURES.md records the symptom→fix→proof if it
bit us. Authors never get a field that does nothing; that rule is why this
plan is a list of DISCARDED fields instead of a wishlist.
