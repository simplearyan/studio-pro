# Two Queens, One King — build notes

What the fourth design language cost, and what the Studio Reel HTML-in-Canvas
automation should change because of it.

Read with `Design.md` (the system) and `storyboard.json` (the film). This
file is about the pipeline.

**The film.** 8 scenes · 32 elements · 67 s · 2010 frames at 30 fps · 5 `latex`
elements · 1 `answer` · two compiled versions, `reel-preview-light.html` and
`reel-preview-dark.html`.

**Gates, both modes:**

| gate | light | dark |
|---|---|---|
| `reel-compile.cjs` | exit **1** — red only on 2 named design fields | exit **1** — same 2 |
| `reel-fidelity.cjs` | exit **0** — 19/19 elements, 8/8 scenes, 67000 ms | shared run |
| `reel-regression.cjs` | exit **0** | shared run |

Zero element colour literals in the storyboard: 20 authored token references,
8 scene tones, **0 hex values**. Both modes came from `--mode` alone.

---

## 1. Two themes, which the emitter cannot hold

A clip is not a stylesheet. `compileStoryboard` resolves `sb.background` to one
hex and `sb.theme` to one set of custom properties, both baked into `clip.html`
and `clip.css` at build time. There is no `prefers-color-scheme` hook, no mode
attribute, no runtime re-theme — and a *video* has exactly one look per
render, so "just let CSS decide" is not available either.

Material ships two token tables, so the film has to ship two clips.

**Fixed here:** `--mode light|dark` on `reel-compile.cjs`. `design.modes.<mode>`
may carry `tokens` (merged over the base table), `background`, `border` and
`elevation`; the merge happens *before* anything reads a colour, and the
original `sb.design` is never mutated, so compiling both in one process cannot
leak light into dark. An undeclared `--mode` is a hard error that prints the
modes the film does declare, rather than silently compiling the base table.

**Why this is cheap enough to be the default shape.** All 17 tokens differ
between the two tables, and **zero elements had to change**. The film authors
`color: "primary"` and `tone: "on-surface"` — never `#006c50` — so the swap is
a table lookup, not a second file. `reel-compile --mode dark` prints
`17 tokens overridden` precisely so that claim is checkable rather than
asserted.

**Still open → P4 in §4:** this is build-time only. One artefact that flips
theme at runtime would let a single clip serve both, and the mock's own
`data-theme` + `localStorage` toggle is 6 lines of runtime that the emitter has
nowhere to put.

## 2. RUNTIME_CSS is a dark-theme stylesheet

The single biggest surprise. Three films in, all near-black. Every literal in
`RUNTIME_CSS` had been written against that, and a light theme breaks them
**without a single error or warning** — the CSS is valid, the DOM is right, the
gate is green, and the frame is unreadable.

| literal | what a light theme did | status |
|---|---|---|
| `.hss-answer{font-size:34px}` | the film's climax rendered at 34px next to a 92px title | fixed |
| `.hss-meter{background:rgba(255,255,255,.10)}` | the meter *track* is white on white — reads as "no meter authored" | fixed |
| `.hss-tile-head` / `-body` / `.hss-panel-label` set no `color` | inherited the **host page's** text colour: black on a `#e0e3e0` surface | fixed |
| `.hss{…}` set no `color` | same root cause | fixed |

Three of these were found by looking at a frame, not by a gate — which is the
point. The fixes are one line each: `.hss{color:var(--hss-ink,#f8fafc)}`
(deliberately a *separate* rule so the legacy `.hss{}` stays byte-identical for
`reel-regression`), `--hss-meter-track`, and `font-size` plumbed onto `answer`
the way it already was for `text`.

Note what this cost. The `tiles` / `card` types were added earlier in this same
uncommitted R1 pass, and jan-suraaj and studio-pro-showcase both use them. Until
this session's `.hss{color:…}` rule landed, `.hss-tile-head`,
`.hss-tile-body` and `.hss-panel-label` set no `colour` at any level above
them — verified against `HEAD`, where `.hss{}`, `.hss-scene{}` and `.hss-el{}`
all lack a `color` declaration entirely — so those labels inherited the **host
page's** text colour. On a near-black panel that happens to look plausible, at
`opacity:.74`, which is exactly why it survived two films unremarked. It is
luck, not fidelity.

**Still open → P6:** nothing in the toolchain can compare two colours. A
contrast gate over `design.theme_map` × `design.background` would have caught
the meter track in milliseconds.

## 3. The stage background was a constant

`var bg = sb.background || '#0e1512'` — and `reconcile` never set
`sb.background` for *any* film. All three compiled films silently inherited a
dark green-black. For two near-black designs that is invisible; for a light one
it is a hard failure. It also meant `design.background` was reported as
unapplied in every film, when the honest answer was "the flat case was never
wired up".

**Fixed here:** `design.background = {type:'flat', base:'…'}` maps to
`sb.background` and is no longer reported. A *patterned* background is still
unsupported and still says so. A scene whose `background` names exactly the
base colour is no longer warned about either — it is the same fact written
twice, and in dark mode its authored hex is simply the light theme's spelling
of a field the mode has since moved.

**Still open → P1:** per-scene backgrounds. 4/4, 9/9 and 9/9 scenes in the
first three films asked for a background and got one colour for the reel. That
is 22 authored scene backgrounds discarded across three films, and it is now
the largest remaining gap.

## 4. LaTeX: no size, no colour, and a latch that could lose the maths

`case 'latex'` emitted `<div class="hss-latex" style="color:#ffffff">`. One
hardcoded colour and **no font-size at all**, so display maths rendered at the
page default — 16px of `\binom{52}{4}` on a 1920px stage. And `latex` was the
only type `reconcile` never assigned a colour to, because its branch did not
exist. The maths film could not restate its own equations.

Both fixed: `latex` now takes `font_size` / `font_weight` / `letter_spacing`
from the authored ramp exactly as `text` does (62px vs 16px, **3.9×**), and
takes a colour like every other type. `answer` got the same treatment.

**The latch is the one worth remembering.** `_hssSetup` did:

```js
if(_hssInit) return; _hssInit=true;
var root = …;
if(root && window.renderMathInElement){ … }
```

It latched *before* checking whether KaTeX had loaded. `_hssSetup` runs on
every frame, so the first frame that beat a hoisted `<script src>` latched the
flag and the maths never rendered — as literal `$$\binom{52}{4} = \frac{…}$$`
— for the entire clip, with no error, no warning, and a green gate. In the
standalone page the scripts are parser-blocking so it happens not to fire; in
`HicRenderer`'s external-script path it always does.

**Fixed:** probe first, latch only once the render actually happened, retry
every frame until then. `reel-regression.cjs` asserts the *order* — the guard
must appear before the latch — rather than the outcome, because the failure is
invisible from the outside.

**Still open → P5:** KaTeX is three CDN `<script>`/`<link>` tags injected at
compile time. An offline export renders raw LaTeX, and nothing checks for it.
The film should vendor KaTeX or the gate should fail when a `latex` element
coexists with no renderer.

## 5. Token names vs hardcoded names

The tone resolver looked colours up in `design.tokens`, which is right. The
**theme** mapper did not — it hardcoded `tok.coal` → ink, `tok.panel` → panel,
`tok.signal` → meter. Material says `on-surface` and `container`. So a brand
with none of the legacy names lost its ink and its panels and kept the runtime
defaults, with nothing reported. (This is the same bug as the hardcoded tone
names that made jan-suraaj's four brand colours all fall through to `#f8fafc`,
fixed in the previous pass — found again, one layer up.)

**Fixed:** `design.theme_map` names which token fills each role
(`{"ink": "on-surface", "panel": "container", …}`), with the legacy names as
the fallback so the three earlier films are byte-identical. A role that names
a token the design does not have now **fails the gate**: naming it is a claim
that the colour reaches the film.

The same pass gave `e.color` a meaning. Before, every `text` element in a
scene took the scene tone, so a film could not have a coloured overline beside
grey body copy — which is *the* Material section-label pattern. `e.color` now
accepts a hex **or a token name** and beats the tone; an unresolvable name is
reported rather than dropped.

**Still open → P2:** Material has five button variants (filled, tonal,
outlined, text, elevated) and two card variants. The emitter has an outlined
pill and one filled panel. `design.style` is still a string the gate reports and
ignores.

## 6. Layout is a column and nothing else

A scene lays elements out as one centred flex **column**. Three sibling cards
authored as a row stack vertically — which is why `group` exists. What is still
missing, and what this film wanted:

- **`max_width` is ignored** (it is in `IGNORED_BY_EMITTER`). The mock's
  paragraphs are `max-width: 44rem`. Measured: the widest authored element is
  `s1-lead` at **1445 px**, with 238 px of margin each side. A lead two words
  longer runs to the stage edge and nothing reports it.
- **No per-element radius.** `design.radius` maps one `--hss-radius`. Material
  uses `8 / 14 / 20 / 24 / 999` in the same screen; the film is 20px
  everywhere.
- **No gap control.** The scene gap is a hardcoded 26px.

## 7. Unescaped copy, once, on purpose

`latex` and `answer` copy is spliced into markup **without** escaping — LaTeX
needs its backslashes and its bare `&` alignment markers, and `esc()` would
turn `&` into `&amp;` and break `\begin{aligned}`. Those two types are
therefore the one place authored text can become markup.

Rather than invent a LaTeX-aware escaper, `reel-compile` now **fails** on
`<` or `>` in `latex`/`answer` copy and names the element. `answer` did gain
`esc()`, which is byte-identical for the regression fixture.

## 8. The mock's own bug, not propagated

`reference/two-queens-mock.html:377` marks option **B**
(`\binom{52}{4} = 270{,}725`) as `data-correct="true"`; option A is
`52 × 51 × 50 × 49`, which counts ordered draws and is wrong. But
`reference/two-queens-mock.html:439` prints **"✓ Matches option A"**. The film
says **option B**. Copying the badge verbatim would have put a contradiction on
screen for 8 seconds.

---

## 9. What to change in the automation, ranked

**P1 — Per-scene backgrounds.** The largest remaining loss: 22 authored scene
backgrounds discarded across three films, 8 more here. Make `scenes[].background`
an expression of `design.tokens` (so it re-themes with `--mode`) rather than a
literal, and let a gradient or a pattern be a value on the scene node.

**P2 — A component/variant vocabulary.** `design.style` currently fails the
gate as a string nobody reads. Turn it into `elements[].fill:
"filled"|"tonal"|"outlined"|"text"` and let the four R1 types honour it. Also
give each of `pill / card / tile / answer` its own radius, because the runtime
has one `--hss-radius` for all of them.

**P3 — Real layout.** `max_width`, `align`, `gap`, and a row/column/grid choice
per group. The centre-column-plus-`group` model cannot express the mock's
two-column "given | solving" solve grid or its `max-width: 46rem` prose.

**P4 — Runtime theming.** `sb.modes` emitted as real CSS custom properties on
`.hss`, plus an optional in-clip toggle, so one artefact serves light and dark.
Build-time `--mode` stays as the export path.

**P5 — Fail when the maths has no renderer.** Gate `latex` elements on a
resolved KaTeX source (vendored or CDN), and add a *content* assertion — the
emitted clip must contain no `$$` after the first `onFrame`. That single check
catches the latch bug class permanently.

**P6 — A contrast gate.** Walk `theme_map` × `background` and every
`e.color` × its host surface, compute WCAG contrast, fail below 3:1. It is ~40
lines and it would have caught the meter track, the `.hss` colour inheritance,
and the `latex` `#ffffff` before a single frame was rendered.

**P7 — A stage-extent gate.** Measure every element's `getBoundingClientRect()`
at each scene's mid-frame and fail on overflow. Cheap, and it turns
"the lead line ran to the edge" from a thing you notice into a thing the build
tells you about. Measured for this film: 31 non-credit elements, tightest side
margin **238 px**, tightest vertical margin **224 px**.

**P8 — `hover` should stop being a gate failure.** `design.hover` is reported
unapplied in all four films and always will be: a video has no hover. It is
noise that trains you to ignore the red. Either drop it from the design schema
or move it to an informational list beside `IGNORED_BY_EMITTER`.
---

## 10. What shipped for this film

The §9 list is now implemented. What changed **in this film**, as opposed to in
the tool, is three blocks and the removal of two per-element overrides:

```json
"theme_map": { …, "fill": "primary-container",
                   "fill-ink": "on-primary-container",
                   "fill-tone": "container" },
"fills": { "tiles": "tonal", "pills": "tonal",
           "card": "filled", "answer": "filled" },
"radii": { "pill": "8px", "card": "20px", "tile": "20px", "answer": "24px" }
```

Those are the mock's own numbers, read off its CSS rather than invented:
`.chip` is `tertiary-container` at `border-radius:8px`, `.card.tonal` is
`--container` at `20px`, and `.answer` is `--primary-container` at `24px` with
`--on-primary-container` on it. Before this, the film had to state
`radius:"20px"` on `s2-tiles` and `radius:"24px"` on `s7-card` individually,
and `design.style:"material 3"` was reported as "not implemented" on every run.

### A dark-mode bug this film was carrying

All eight scenes authored `{type:'flat', base:'#f8faf8'}` — the reel's own
background. Per-scene backgrounds are now applied, so that authored hex painted
**over** the dark stage: `--mode dark` produced a light `#f8faf8` field with
correctly-dark tiles inside it. Every scene, both contrast and extent gates
green.

The compiler already computed the fact needed to fix this — `baseBg`, "the base
table's background, before any mode overrode it" — with a comment describing
the exact fix. It was never called. A scene that repeats the reel's own flat
background now follows the mode instead, and the compiler names how many it
dropped.

Found by taking a screenshot of the dark preview and noticing the background
was the wrong colour. No gate was looking, because every assertion in the
pipeline was true.
