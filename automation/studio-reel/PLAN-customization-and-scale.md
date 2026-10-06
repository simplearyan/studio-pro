# Studio Reel — customization & scale plan

Written after the fourth film (two-queens, Material 3) and after auditing the
four existing films for **colour contrast** and **type size**. Every number
below was measured, not estimated.

The short version: the pipeline could express four different design languages
and none of them were guaranteed to be *legible*. 19 of 88 measured text nodes
across three films sat below WCAG AA, with a green build every time. That is
the class of bug this plan exists to close.

---

## 1. What the audit found

Measured with a real browser at the 1920 × 1080 design space, then reproduced
by `reel-contrast.cjs` in Node:

| film | text nodes | failures | worst |
|---|---|---|---|
| breath-of-air | 31 | 0 | 6.49:1 |
| jan-suraaj | 39 | **1** | **1.05:1** — `j9-cta`, `#0F0D0E` on `#0e1512` |
| studio-pro-showcase | 36 | **18** | **1.00:1** — 10 credits + 8 tile labels |
| two-queens (light) | 37 | 0 | 4.86:1 |
| two-queens (dark) | — | 0 | — |
| **total** | **142** | **19** | |

Three distinct causes, none of them a "wrong colour choice" — all three were
the pipeline silently picking the wrong token.

> **Later correction.** The 142 figure was itself an undercount: the gate's
> leaf-node pattern matched `<div>` only, and chips are `<span>`. With 25 more
> chips actually measured the total is **167**, still 0 failures — but the
> audit that motivated this plan had never looked at a quarter of the text in
> it. That is recorded here rather than quietly corrected, because it is the
> same failure the plan exists to close, one level down: *0 failures* for text
> nothing had measured.

**1a. `--hss-ink` was guessed from a token NAME.** The fallback chain was
`tok.white || tok.coal`. studio-pro-showcase has no `white` and calls its
background `coal`, so its ink became `#151217` — the page colour. Every
credit and tile label rendered the background colour on the background
colour, at literally 1.00:1. jan-suraaj escaped because it happens to have a
`white` token. Nothing reported it.

> **Fixed.** `theme_map` names the roles; `reel-contrast.cjs` proves the result.
> studio-pro-showcase now declares `"ink": "paper"` and 18 failures → 0.

**1b. The stage ink and the slab ink are different roles.** Once the stage ink
was correct, 7 slabs inverted: a bright yellow block carrying `#FBF6EC` type at
**1.43:1**. A slab is a bright surface with dark type; the stage is a dark
surface with light type. Material calls the second one *on-container*.

> **Fixed.** New theme role `slab-ink`, separate from `ink`. 7 → 0.

**1c. A misspelled field name.** `j9-cta` — jan-suraaj's final call to action
— authored `label_bg: "#FDCB0B"`. The emitter's field is `slab_bg`. The field
was dropped, leaving near-black text on a near-black stage at 1.05:1, for the
last 5 seconds of the film.

> **Fixed** the film. **Not fixed in the tool** — see §4 P3, because this is
> the failure mode with no gate: a name the emitter has never heard of is
> indistinguishable from a name it deliberately ignores.

---

## 2. Colour contrast — `reel-contrast.cjs` (shipped)

A fourth gate, alongside compile / fidelity / regression.

```
node automation/studio-reel/reel-contrast.cjs
node automation/studio-reel/reel-contrast.cjs --only jan-suraaj --mode dark
node automation/studio-reel/reel-contrast.cjs --min 7      # AAA-ish
```

- **WCAG 2.1 relative luminance**, sRGB properly de-gamma'd. Using raw 0–1
  channel values understates light colours badly enough to turn a 4.2:1 pair
  into a reported 9:1.
- **Correct threshold per element**: 3:1 for ≥24px or ≥18.66px bold, 4.5:1
  otherwise. Sizes are resolved at the **design-space** width, not the embed
  width — otherwise the same element passes at 1920 and fails at 512.
- **Opacity is composited, not ignored.** `.hss-credit` is drawn at 0.75,
  `.hss-tile-body` at 0.74. A 4.6:1 pair drawn at 0.74 composites under 3:1.
- **Host surface is resolved by the browser**, not enumerated. An inline
  background wins, a filled variant wins over the class default, and
  `color-mix()` resolves — because these come from `getComputedStyle` on the
  real page rather than from a table of the emitter's rules. The brutalist
  name-slab is an `.hss-text` with its own background, and measuring it
  against the stage reports 1:1 for a perfectly legible heading.
- **Gradient numerals are skipped and counted**, so an empty result can never
  pass for a pass.
- **It measures in a real browser, via CDP.** The gate used to hand-read
  compiled markup and tabulate the cascade — `HOST_SURFACE`, `FILL_SURFACE`,
  `FILL_INK`, `CSS_INK`, `SVG_PX`, `TONAL_INK_MIX`, `TEXT_ALPHA`, plus
  `assertEmitterContract()` to check the tables still matched `RUNTIME_CSS`.
  Those six tables enumerated what the emitter *did*, so they were only ever as
  true as they were written, and a new component was silent rather than wrong.
  They are gone. `getComputedStyle` resolves the cascade that shipped —
  inherited custom properties, inline styles, `color-mix()`, `[data-mode]`
  rules, the authored ramp's real `font-size` — and the WCAG maths stayed in
  Node, because `reel-compile` borrows it for the design board's chips.
- **What it cannot see, it counts.** A `background-image` has no colour to
  read, so nodes under a gradient are measured against the nearest opaque
  colour beneath it and reported as `on a background-image` rather than
  silently passed. 133 of 289 today, all of them dark washes over a dark
  stage; sampling the painted pixel from a screenshot is what would close it.

Validated against a browser at 1920 × 1080: **exact agreement** on both
failing films before the fixes, and on both after.

Why Node and not a browser: `reel-fidelity` reads compiled markup with no
Chromium, so this gate can run in CI on every commit. The one thing it cannot
do is measure *geometry*, which is why `reel-extent` (P4) exists alongside it
and does open a browser — the two split on whether the thing being checked is a
closed set. Colour resolution is; text wrapping is not.

The cascade table grew with the component variants (P6): `filled` paints
`--hss-fill` with `--hss-fill-ink`, `tonal` paints `--hss-fill-tone`, and the
other two paint nothing. Those, and the chip's ink, are asserted against
`RUNTIME_CSS` on every run — the assertion is what caught the chip reading the
wrong variable.

---

## 3. Type size — `design.type_scale` (shipped)

### The problem

Sizes are emitted as `vw`: `frame.ramp.size / 19.2`. That is what makes a clip
resolution-independent, and it is also why type vanishes when the film is
embedded anywhere smaller than the design space. Measured on jan-suraaj at a
512 px stage:

| | rendered | |
|---|---|---|
| `lead_hi`, 30 px at 1920 → `1.563vw` | **8.0 px** | illegible |
| with `min_px: 18` → `max(1.563vw,18px)` | **18.0 px** | legible, 2.25× |

A film is authored and exported at 1920 × 1080. A preview pane, a web embed, a
thumbnail strip and a phone are all smaller, and today every one of them gets
proportionally illegible text.

### The feature

```json
"design": {
  "type_scale": {
    "preset": "documentary",
    "scale": 1.35,
    "min_px": 16,
    "overrides": { "display": { "size": 150 } }
  }
}
```

- **`preset`** — four named type systems, chosen by *purpose* rather than
  look, so a film says what it is instead of nine hand-tuned numbers:
  - `poster` — one enormous word per frame, body is only a caption
  - `editorial` — headline + standfirst + prose; the newspaper shape
  - `documentary` — long captions and quotes, legibility over impact
  - `data` — numerals and labels dominate, dense and compact
- **`scale`** — a single multiplier on the whole ramp. Verified on jan-suraaj:
  `documentary × 1.35` with `display` forced to 150 emitted
  `max(10.547vw,16px)` / `max(6.750vw,16px)` / `max(2.109vw,16px)`.
- **`min_px`** — the legibility floor. It is a deliberate trade: a narrow embed
  gets bigger type and therefore more line wraps, which is the right failure
  for a thumbnail.
- **`overrides`** — patch individual roles. `frame.ramp` still wins over the
  preset, so an existing film can adopt a preset and keep its own numbers.

**This directly answers "how do I change text size for the jan-suraj reel".**
Today it is 18 hand-authored `at_ms`/`font_size` pairs in a storyboard. After
this it is one `type_scale` block, no code, and the contrast gate re-checks the
result at the new size.

### What is still missing in the type layer

- **Line height and measure.** `.hss-text` has no `line-height`, and
  `max_width` is in `IGNORED_BY_EMITTER`. The widest authored element in
  two-queens is 1445 px across a 1920 stage; a lead two words longer runs to
  the edge and nothing reports it.
- **A scale lock.** A design can currently ship a ramp where `body` is larger
  than `title_hi`. Nothing checks the ramp is monotonic.

---

## 4. What else the pipeline needs, ranked

### P1 — Per-scene backgrounds (the largest remaining loss) — **shipped**
`sc.bg` is emitted verbatim on the scene node, with `sc.gap` beside it, through
one `SURFACES` table shared with the reel background and a mode's background
(`flat` / `dots` / `blueprint` / `gradient` / `linear-gradient` /
`radial-gradient`). An authored string that reaches CSS goes through `cssOnly()`
first, because `background:background-image:…` is silently ignored and a
gradient that renders nothing is indistinguishable from one that worked.

**One consequence worth stating, because it was found by looking at a
screenshot rather than by a gate:** a scene that names *exactly* the reel's own
flat background is stating the same fact twice — and once a film declares
runtime modes that fact is wrong in every mode but the one it was authored in.
two-queens names `#f8faf8` on all eight scenes, so `--mode dark` painted a
light stage under correctly-dark tiles. The compiler now drops a scene
background that repeats the reel's own, so the mode's stage shows through, and
says how many it dropped. (`baseBg` was computed for exactly this purpose and
never wired — the intent was in a comment, the code was not there.)

### P2 — Runtime theming, so one clip serves both modes — **shipped**
`sb.modes` compiles every declared theme into **one** clip: each mode's custom
properties plus its own `--hss-stage` land as `[data-mode]` rules, and
`sb.ui.theme_toggle` adds a `◐` button. The flip is an event listener bound
once inside `_hssSetup`, never per frame — a frame is a pure function of its
timestamp, and a mode switch mid-render would break the property the whole
pipeline rests on.

### P3 — An IR schema, so misspelled fields fail — **shipped**
`storyboard.schema.json` (draft 2020-12, `additionalProperties:false` on every
object) plus `reel-schema.cjs`. Every field is annotated **APPLIED** or
**DISCARDED**, which is the split this item was for, in the place a tool can
read it.

Two decisions:

- **No ajv.** It is in `node_modules` — transitively, via vite's tree, which is
  not a promise. A gate that breaks when a dependency's version changes is a
  gate people disable. 180 lines and nothing instead.
- **`assertSupportedKeywords()`.** Hand-rolling a validator has one real risk:
  silently ignoring half the schema. That is the worst failure mode available,
  because it reports green for a document that does not conform. So the
  interpreter refuses to run if the schema uses a keyword it does not
  implement, and a self-test proves it rejects five malformed cases — including
  the real `label_bg` defect — before it validates a single film.

`reel-regression.cjs` reintroduces `label_bg` into two-queens and asserts it
fails at `/scenes/6/elements/1/label_bg`.

### P4 — A stage-extent gate — **shipped**
`reel-extent.cjs` measures every element's box at each scene's **mid-frame** —
not its start, where a `slide` entrance is legitimately off-stage and reporting
that would make the gate useless. `.hss` is `overflow:hidden`, so an overflowed
element is silently cropped, and that is the whole failure this exists for.

Why a browser and not Node, when every other gate here is pure Node: **neither
of these can be tabulated.** `reel-contrast` used to tabulate colour — six
tables of the emitter's rules — and it has since been rewritten to drive a
browser for exactly the reason below. Geometry was there from the start: text
wraps, fonts substitute, a grid resolves. Tabulating layout would mean
reimplementing it, and a reimplementation that disagrees with Chromium reports
overflows that do not exist while missing the ones that do.

Both gates now share `cdp.cjs` for finding Chrome and speaking the protocol;
each keeps its own question, which is genuinely different: one asks where a box
ends, the other asks what colour a glyph paints.

**Zero dependencies, on purpose.** Headless Chrome over the DevTools Protocol,
using Node 22's built-in `fetch` and `WebSocket`, launched with
`--remote-debugging-port=0` and reading the port Chrome actually chose from
`DevToolsActivePort`. A gate needing a 60 MB install and a matching browser
build is a gate that quietly stops running. **It exits non-zero if no browser
is found** — a geometry gate that skips itself is worse than no gate.

Measured at 1920 × 1080, 122 boxes across four films, all inside the stage:

| film | boxes | tightest side | tightest vertical |
|---|---|---|---|
| breath-of-air | 22 | 289 px | 238 px |
| jan-suraaj | 35 | **154 px** (`j6-head`) | 289 px |
| studio-pro-showcase | 33 | 154 px (`p2-head`) | 157 px |
| two-queens | 32 | 340 px | 224 px (`s4-over`) |

154 px is the scene's own 8 % padding — the floor, not a defect. The
hand-measured "238 px side margin" in the first draft of this plan is
superseded by the numbers above, which are produced by a gate rather than once
by a person.

Credits are `position:absolute; left:0; right:0`, so they span the stage by
design. They may **touch** the edge but never cross it, so they are checked for
overflow like everything else and **exempt from `--min`**. Applying the
headroom requirement to them made every credit on every film fail the moment
`--min` was above zero — a gate that fails on the design working as intended is
a gate people disable.

`--min` therefore has two distinct failure modes, reported separately and named
accurately: **OVERFLOWS THE STAGE** (content outside it, and therefore cropped
by `overflow:hidden`) and **LESS HEADROOM THAN --min** (inside it, but closer
than asked). Reporting both as "cropped" would misdescribe half of them.

**The gate reports the stage colour it measured and fails if that is not the
theme `--mode` resolved.** Building it exposed that a `--mode dark` run had
been measuring the light stage and printing perfectly plausible numbers under a
dark label — the mode pinning was needed and the check was needed more.

**It had one more bug, found by reading the exit code rather than the film:**
launching used `existsSync` then `readFileSync`, and Chrome keeps
`DevToolsActivePort` open for writing, so on Windows the read threw `EBUSY`
roughly one run in three. An intermittently-failing gate gets retried until
people stop reading it. Existence is a hint; a *readable pair of lines* is the
fact. Five consecutive clean runs after the fix.

### P5 — A ramp-monotonicity check — **shipped**
`HIERARCHY` walks the ramp in order and any step not smaller than the one above
it is a `DESIGN FIELDS NOT APPLIED` failure. A type system is an ORDER as well
as a set of sizes; this is the reason `type_scale` is safe to expose.

### P6 — A component/variant vocabulary — **shipped**
`elements[].fill: filled | tonal | outlined | text`, with `design.fills`
setting the default per component **once** rather than on all 32 elements. A
style NAME is not actionable; a treatment is. `design.style` became
informational and is suppressed when `fills` is present. Per-element `style`
stays advisory and is reported once per film with its distinct values, not once
per element — 40 identical lines is noise, and noise is a red nobody reads.

**A value outside the vocabulary fails the build.** That is the point: an
emitter that ignores an unknown `fill` renders the element, so the film looks
complete and the variant is simply not there.

`design.radii` gives pill / card / tile / answer their own radius, each falling
back to `design.radius`. two-queens now states `8 / 20 / 20 / 24`, which is
what its mock's own CSS says (`.chip` 8, `.card` 20, `.answer` 24).

Two new theme roles came out of this and are worth naming separately:
`fill` / `fill-ink` are a container and its **on-container** colour. Sharing one
`--hss-ink` between the stage and a filled block is the slab bug one level up.

All of it is **appended** to `RUNTIME_CSS`, never folded into an existing
declaration. Same specificity, later in the sheet: it wins where a variant is
authored and changes nothing where it is not, and every legacy declaration
stays byte-for-byte present — which is what `reel-regression` asserts, so
"additive" is checkable rather than claimed.

### P7 — Real layout — **shipped**
`max_width`, `align`, `gap` and a `row | grid` choice per group, with
`columns`. `design.text_width` states the measure once per role (Material's
`max-width:44rem` prose) instead of repeating it on every paragraph.

`align` is a class on the host **and on everything inside it**, because
`.hss-text` and `.hss-stat-label` set `text-align` themselves — setting it on
the host alone would move the block and leave the words centred. It also
carries `align-self`, so `start` means the cross-axis start of the scene, not
just the text alignment inside it.

`columns` requires `layout: "grid"`. On a row it is **reported**, not accepted:
a wrapping flex row that was authored as four columns renders as one wide row
and nobody asks why.

### P8 — Stop reporting `design.hover` as a failure — **shipped**
Informational, beside `IGNORED_BY_EMITTER`. `reel-compile.cjs` now **exits 0**
on all four films — a gate with nothing red to say should say so.

### P9 — Vendor KaTeX — **shipped (vendored AND inlined)**
A film with `latex` elements and an empty `design.math.src` is a hard failure,
because that is exactly what an offline export produces: raw `$$…$$` with no
error and a green gate. A `cdn:` src stays informational — the compiler cannot
prove the network works, and a gate that pretends otherwise is worse than one
that says what it does not know.

Vendoring is done, and the design changed on the way. `design.math.src`
**defaults to `vendor/katex`** — the dist at `public/vendor/katex`, written by
`automation/studio-reel/vendor-katex.cjs` (katex@0.16.11, pinned, with all 20
@font-face rules rewritten to carry their woff2 face as a base64 data URI and
the woff/ttf fallbacks dropped, because a clip is a portable fragment and has no
`fonts/` directory to bring along).

The compiler reads those three files and hands them to the emitter as `sb.math`,
which splices **one `<style>` and two `<script src="data:text/javascript;base64,…">`
into the clip**. Data: URLs rather than inline `<script>` bodies, and that is
load-bearing: `hic-frame.js` mounts clip html with `innerHTML`, where an inline
script **never executes** — only external `<script src>` tags are hoisted. A
data: URL is external, so the same markup runs through the renderer *and* from
`file://` with no server, which is what "offline export" has to mean to be true
(verified in headless Chrome: all five formulas typeset on the clip page *and*
on the scenes board, with zero network).

Only `latex` triggers it. `answer` used to be counted here and has no
delimiters, so the-peak — a film with no formulae at all — was nagged about a
renderer it could not use. A film that has none now ships none of the ~722KB.

The related latch bug is fixed: `_hssSetup` probes `renderMathInElement`
*before* latching `_hssInit`, so a `<script>` resolving after the first
`onFrame` no longer loses the maths for the whole clip. `reel-regression`
asserts the ordering.

---

## 4b. Bugs found while building this, that no gate was looking for

Worth keeping because they are the argument for the whole exercise. Four of the
five were found by *reading* output — a screenshot, a computed style — and none
by a gate that was already green.

1. **Per-scene backgrounds pinned the light theme.** All eight two-queens
   scenes named the reel's own `#f8faf8`; in dark mode that painted a light
   stage under dark tiles. The code computing the fact needed to fix this,
   `baseBg`, existed with a comment describing exactly the fix — and was never
   called. An intent in a comment is not an implementation.
2. **`.hss-pill`'s ink was read from the wrong variable.** `reel-contrast` took
   a chip's colour from `--hss-ink`; the cascade takes it from `--hss-pill`.
   It passed, because the two happened to have enough contrast against the
   stage. Asserting the cascade against `RUNTIME_CSS` is what turned that luck
   into a checked fact.
3. **25 chips were never measured.** The leaf-node pattern matched `<div>`
   only, and `.hss-pill` is a `<span>`. "0 failures" for text the gate had
   never looked at — which is exactly the failure mode `reel-contrast` was
   written to prevent, inside the gate written to prevent it.
4. **A fixture could not detect its own typo.** The regression check for a
   typo'd component radius matched `--hss-radius-pill`, a string present in
   every clip's fallback chain whether or not the theme set it. It passed
   because it could never fail. Matching the *declaration* (`--hss-radius-pill:`)
   made it a real test. The same class of thing inside the extent gate: a
   documented sub-pixel `TOLERANCE` that was declared and never applied, and a
   `--min` documented as "any margin fails" when it meant "any negative margin".
   A comment describing behaviour is not the behaviour.
5. **A dark run measured the light stage.** `reel-extent --mode dark` reported
   plausible geometry for the wrong theme. The stage now reports its own
   computed background and the gate compares it with what the compiler
   resolved.
6. **A gate that failed one run in three.** `existsSync` + `readFileSync` on a
   file Chrome holds open for writing is a race, and on Windows it throws
   `EBUSY` rather than returning a short file. Found by reading an exit code
   that had nothing to do with the film.

---

## 5. The shape of the pipeline now

```
storyboard.json
  │
  ├─ reel-schema.cjs     every authored field is one the schema declares   ← new
  ├─ reel-compile.cjs    IR → emitter contract; modes, type scale, tokens, fills
  │    ├─ --write-clip    reel-clip[-<mode>].json   the IR the page plays
  │    ├─ --write-html    reel-preview[-<mode>].html  the film, animated
  │    ├─ --write-scenes  scenes-preview.html        every SCENE, static   ← new
  │    └─ --write-design  design-preview.html        the STYLE, static     ← new
  ├─ reel-fidelity.cjs   every element and scene boundary survived
  ├─ reel-contrast.cjs   every text pair meets WCAG AA
  ├─ reel-extent.cjs     every element fits the stage it ships into         ← new
  └─ reel-regression.cjs existing consumers are byte-identical
```

The five answer five different questions — *is this even a real field*, *did it
compile*, *did the content survive*, *is it legible*, *does it fit*, plus *did
anyone else's output change*. The gap this plan closes is that the first four
were all satisfiable by an unreadable, cropped film with a misspelled field.

### The design board — `design-preview.html` (shipped)

`reel-preview.html` shows the animation and therefore shows the style only by
playing the film. Reviewing a palette means watching 70 seconds of motion, and
comparing two modes means opening two files. `--write-design` emits one static
board per film carrying **every declared mode side by side**: the stage sample,
surfaces per scene, every token with the roles it serves and its measured
contrast, the theme roles as resolved, the type ramp at design-space sizes, the
radii, and each component in all four fills.

Two properties make it trustworthy rather than decorative. It is built from the
**same** `resolveMode` + `reconcile` output the clip compiles from, so the board
shows a wrong colour if and only if the film ships that wrong colour. And it
renders the component samples inside the real `RUNTIME_CSS` with the real
`.hss-*` classes, so the board cannot show a pill that the film does not draw.
A film with no `design` block still gets a board — labelled *runtime defaults*
— rather than a crash, which is what the first run of this did.

### The scenes board — `scenes-preview.html` (shipped)

The preview answers *how does it move*, the design board answers *what is the
design system*. This answers the third question: *what does each scene actually
look like?* Every scene, settled, in order, with nothing playing.

It is a contact sheet, not a screenshot and not a smaller preview. Each stage is
a real `.hss` root carrying the **same compiled stylesheet** and the **same
compiled scene markup** the film ships, and the finished state comes from
`settle()` — the emitter's own inverse of `_chart`, sharing one copy of the
statements. So a chart cannot be half-drawn here and full in the film, and a
component cannot look right here and wrong there.

One stage per row at full page width, which is the only layout where the
runtime's `vw`-based type resolves the way it does in the film. Two stages side
by side would each be half a viewport wide and every piece of type inside them
would be twice the size it should be — a contact sheet that quietly
misrepresents every slide on it.

### The chart element — `columns` / `bars` / `line` / `donut` (shipped)

The IR could carry a number but not a series, so a data story had no way to draw
one. `chart` is a new element type; the fifth film is built almost entirely out
of it.

**SVG, not canvas.** The reference implementation is a canvas animator and
canvas is the obvious choice. It is also a black box to every gate here:
`reel-extent` measures boxes, `reel-contrast` measures text nodes, and a
rasterised chart is neither. Inline SVG is DOM — and the decision paid for
itself immediately, because `reel-contrast` then measured **124** text nodes on
the new film instead of 13.

**Geometry at compile time, progress at runtime.** Every number needed to move a
bar rides on the bar as a `data-*` attribute the emitter wrote. The runtime knows
only how far through the animation it is, never what the scale is. A second
geometry model in the SB literal is two answers to one question, and they diverge
the first time one is edited — the meter reads `data-pct` for the same reason.

**The chart owns its headline.** `title` / `subtitle` / `kicker` / `source` live
on the element, not as sibling `text` elements. As siblings they can be reordered
or edited apart, and a number ends up under a sentence describing a different
number. A number without its provenance is the thing a data story exists to fix.

**The categorical palette is a theme role** (`s1…s6`, `chart-grid`,
`on-variant`). Five graphics that each picked their own blue are five graphics
that do not look like one publication — a fact about the *design*, not about any
one `series` entry.

Every gate reports what it did **not** check, and the ones that could be wrong
about the emitter say so instead of measuring anyway: `reel-contrast` names
every node it could not sample because it sits on a `background-image`,
`reel-schema` asserts its keyword coverage against the schema, `reel-extent`
reports the stage colour it actually measured. A gate that cannot fail is
indistinguishable from a gate that passed.

**The rule that makes it scale:** the emitter never guesses. If a design does
not declare a role, the gate fails rather than falling back to a token name
that happened to match. The `coal` bug, the slab-ink bug and the `label_bg`
bug are all the same mistake — *a plausible-looking default in place of a
declaration*. Defaults are for the first film; after that they are debt.

### Still open

- **`elements[].rotate`.** Discarded, and now with the reason written down:
  the runtime *owns* `transform` on every frame, so an authored angle would be
  overwritten sixty times a second. It needs a composite, not a declaration.
- **`scenes[].ambient`, `frame.safe`, `frame.beat`.** Accepted by the schema,
  reported as discarded. There is no decorative-layer or safe-area concept.
- **`design.type_scale` on a live film.** Shipped and gate-tested, but no film
  has adopted a preset yet — the four still carry hand-authored `frame.ramp`
  entries, which win over a preset by design.
- **`layout: "grid"` and `align`.** Shipped and gate-tested; no film uses them
  yet, because none of the four mocks has a scene that needs them. The
  two-column "given | solving" solve grid is the first thing that will.
- **The design board is not wired into `npm run`.** `--write-design` is invoked
  by hand and its output is checked into each film directory; nothing
  regenerates it on build, so it can drift from `storyboard.json` the moment a
  token changes and nobody re-runs the compiler.
- **`series` is uncapped.** Six chart colours are defined; a seventh series
  wraps back to `--hss-s1` and silently repeats a colour. The schema should
  reject a series count above the palette size rather than let a chart imply a
  distinction it does not draw.
- **No reference line on a chart.** "2.1 is replacement" wants a rule across the
  plot at a value the axis can name. `min`/`max` set the scale; there is no
  `mark_at`.
- **The donut's legend is drawn twice** — SVG swatch rows beside the ring and
the HTML legend above the plot. `legend: false` suppresses the second, but the
  default is wrong for donut specifically.
- **Fonts in the fifth film are stand-ins.** VOX's Balto and Alright Sans are
  licences, so the film ships Archivo and Libre Franklin and says so in its
  Design.md rather than shipping a lookalike silently.