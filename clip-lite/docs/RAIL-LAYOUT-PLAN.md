# The rail — preview on top, the sheet down the side

A plan for [`clip-lite-mock.html`](clip-lite-mock.html): a **fifth and sixth
layout state** for a large iPad, where the preview stays a wide band on top, the
timeline stays a wide band in the middle, and the **tools rail and the property
sheet move into a column down the right edge** (or the left).

This is the companion to [`IPAD-LAYOUT-PLAN.md`](IPAD-LAYOUT-PLAN.md). That plan
moves the *preview* — `left`, `right`, `full`. This one moves the *rail*, and
leaves the preview alone. The two are answers to different questions, and on a
landscape iPad the answer here is usually the better one; §1 says why, with
numbers.

**This is a plan.** Nothing of it is built. Every number below is a live
measurement — of the reference file, of the mock as it ships today, and of a
**candidate stylesheet injected into the live mock** (§4.4), so the projected
figures come out of the real engine rather than out of arithmetic. Where a
number is arithmetic it says so.

---

## 1. The verdict

**Add it.** Not as a replacement for `left`/`right`, and not for phones — as the
*landscape, widescreen* state that the side layouts are wrong for.

The reason is one measurement. At 1194×834 with the Adjust sheet open, the three
states report:

| state | canvas | timeline | the sheet |
|---|---|---|---|
| `top` (ships today) | **800×450** | **gone** — `body.es .dock{display:none}` | 960×364 popover at the bottom |
| `left` (side layout) | 454×255 | 704×323 | 684×323, bounded by `min(46dvh,50%)` |
| `rail` (this plan) | **771×434** | **798×250** | **320×834** inspector |

Read the first and third columns together. `top` gives the best picture and
throws the timeline away the moment you open a tool. `left` keeps the timeline
and pays for it with a canvas **three times smaller**. `rail` keeps the timeline
*and* a canvas within 7% of `top`'s — 335k px² against 360k — because at this
viewport the preview is height-limited by its band, so the sheet's 320px column
costs the picture **nothing at all**: the canvas is 771×434 both with the sheet
closed and with it open. It is not "a slightly better compromise". It is the
same picture, plus the timeline, plus a full-height sheet.

At 1366×1024 the same three states: `top` 983×553 with no timeline, `left`
522×294, `rail` **946×532** with a 970×300 timeline. There the band is wide
enough that the picture is *width*-limited, so the sheet costs 7% of the width
and 9% of the area — 503k against `top`'s 543k, still 3.2× `left`'s. §1.1 is the
boundary between those two cases, and it is closer than it looks.

The reference design reached the same conclusion, with the same ingredients —
`Parallax Maker Pro.html` is a preview band on top, a 240px timeline across the
bottom of the centre column, and a rail-plus-panel column on the right (§2). It
gets one thing wrong that we can avoid, and §1.1 is that.

### 1.1 Where the reference pays for it, and we would not

In the reference, opening the panel **shrinks the canvas**: 1080×608 → 790×445
at 1194×834. The panel column eats 300px of a 1121px centre column, and because
the canvas there is width-limited (`max-w-[1080px]` on a 16:9 picture, inside a
522px-tall workspace that is taller than the picture wants), it gives up width
it was actually using.

Our preview band is *shorter* than the canvas wants, so the picture is
**height-limited**, and a height-limited picture does not care how narrow the
band gets. At 1194×834 the canvas is 434 tall and needs `434 × 16/9 = 772`px of
band width; `.view`'s 24px of side padding puts the threshold at 796px of main
column. A **310px** sheet leaves 808 — free, with 12px to spare.

But that is one viewport, and the honest version is a table. Measured with
`--sw:clamp(280px,26vw,320px)`:

| viewport | `--sw` | canvas, sheet closed | canvas, sheet open | area kept | page |
|---|---|---|---|---|---|
| 1024×768 | 280 | 672×378 | 644×362 | **92%** | no scroll |
| 1194×834 | 310 | 771×434 | **771×434** | **100%** | no scroll |
| 1366×1024 | 320 | 1020×574 | 946×532 | **91%** | no scroll |

The middle row is the free one. The other two pay 8–9% of the picture's area for
a sheet that is on screen *with* the timeline instead of instead of it, and 8–9%
of a picture three times the size of `left`'s is a trade worth making — `left`
gives 522×294 at 1366×1024 against `rail`'s 946×532.

An earlier draft fixed `--sw` at 320px, and at 1024×768 that cost **19%** of the
canvas (672×378 → 604×340). The responsive `clamp` is not a refinement, it is the
thing that makes the state work on the 1024-wide iPad; 26vw resolves to 310 at
1194, which is also why the 1194 row stays at 100% rather than going backwards.
§13 asserts the ≥ 90% floor at all three viewports, so a future `--sw` that
overreaches turns a row red instead of quietly shrinking the picture.

### 1.2 What it is not

- **Not for phones.** The gate is `innerWidth >= 900 && innerWidth > innerHeight`.
  A phone cannot show a 320px sheet beside a preview; the existing 600px rule
  stays the floor for `left`/`right` and this state is never offered there (§9).
- **Not for portrait projects.** With a 9:16 project the picture wants a tall
  narrow band, which is exactly what `left`/`right` give it (measured 429×762 in
  a 478-wide column). A `rail` state would hand it a short wide band. The state
  is *available* with a portrait project but is not a good fit, and the auto rule
  in §9.2 does not pick it there.
- **Not a sixth mechanism.** It is one more `data-layout` value on the grid that
  R1 already shipped, reusing the `#split` divider element, the
  `:not([data-layout=top])` rule family, and the sheet's own scroll rules. §10 is
  the cost.

---

## 2. What the reference actually does

Not the picture — the mechanism. `Parallax Maker Pro.html`, 1891 lines, Tailwind
CDN in a `h-screen flex flex-col overflow-hidden` body.

```
header.h-14 md:h-16                                    ← 64px, full width
main.flex-1.flex.overflow-hidden
├─ centre column  (flex-1 flex flex-col)
│  ├─ #workspace        flex-1, items-center justify-center   ← the stage
│  │  └─ #canvasWrapper > #thumbnailCanvas  1280×720, max-w-[1080px]
│  └─ #timelineContainer  style="height:240px"   rounded card, #timelineResizer on its top edge
└─ aside #rightSidebar
   ├─ #sidePanel   w-[280px] md:w-[300px], collapsible to width:0
   │   #panelProperties · #panelLayers · #panelText · #panelImage · #panelAudio   (mutually exclusive)
   └─ vertical rail   w-[60px] md:w-[72px]   .rail-btn[data-target]  × 6
```

`railBtns.forEach(...)` sets `sidePanel.style.width` to `'0px'` or `''`, un-hides
the matching panel, and marks the button `.active`. There is no CSS grid and no
`data-layout` in this file at all — it is flex, a fixed 240px timeline, and one
sidebar whose width is switched in JS. **The lesson is the composition, not the
code**: preview on top, timeline docked below it, rail and panel as one column
beside both.

Measured, live:

| viewport | canvas | timeline | side panel | rail | page |
|---|---|---|---|---|---|
| 1194×834, panel closed | **1080×608** | 1105×240 @ y 586 | 1px | 72 @ x 1122 | no overflow |
| 1194×834, Properties open | **790×445** | 806×240 | **300** (aside 372 @ x 822) | 72 | no overflow |
| 1366×1024, panel open | **962×542** | 978×240 @ y 776 | 300 (aside 372 @ x 994) | 72 | no overflow |

So the reference's own rail is 72px, its panel is 300px, its timeline is a flat
240px — and the 300px column costs it 27% of the canvas's width and height. That
last line is the one we improve on, and §1.1 is why we can.

---

## 3. What we have today

`clip-lite-mock.html`, `16:9` project, one 10-second clip, one tool open where
stated. All measured.

| viewport | state | `.view` | canvas | `.tlw` | tools row | sheet |
|---|---|---|---|---|---|---|
| 1194×834 | `top`, closed | 1194×450 | **800×450** | 960×231 | 960×55, **scrollW 1038** | — |
| 1194×834 | `top`, Adjust | 1194×450 | 800×450 | **`display:none`** | — | 960×364 @ y 450 |
| 1194×834 | `left`, Adjust | 478×778 | 454×255 | 704×323 | 704×55 | 684×323 |
| 1366×1024 | `top`, closed | 1366×553 | 983×553 | 960×318 | 960×55 | — |
| 1366×1024 | `top`, Adjust | 1366×553 | 983×553 | **`display:none`** | — | 960×451 |
| 1366×1024 | `left`, Adjust | 546×968 | 522×294 | 808×418 | 808×55 | 788×418 |

Three things to notice, because they are the case for the change:

1. **`body.es .dock{display:none}`** — on a big screen, opening any tool deletes
   the timeline. That rule is right on a phone, where the sheet *is* the bottom
   half of the screen. On an iPad it hides the one thing the user is looking at
   while they edit. R6c fixed this for `left`/`right`; `top` still has it, and
   `top` is what a 16:9 project gets today.
2. **The tools row already overflows at 1194.** `scrollWidth 1038` against
   `clientWidth 960` — the row is 8% wider than its box and is only usable
   because of the fade mask. Eight labelled tools at 76px is 608, but this row
   has fifteen entries including the `Format`/`Add` group.
3. **The canvas is 800×450 inside a 1194×450 band.** It is height-limited and
   using **67% of the width available to it**. The band is the constraint; the
   width is already free. That is precisely the slack a side column can take
   without touching the picture.

---

## 4. The proposed state

### 4.1 The areas

The body grid, right-handed variant:

```
body[data-layout=rail]
┌──────────────────────────────────────────────────┬─────────────┬──────┐
│                        bar                       │             │      │
├──────────────────────────────────────────────────┤             │      │
│                                                  │             │      │
│                      view                        │             │      │
│               (the preview band)                 │    panel    │ rail │
│                                                  │  (the sheet)│(tools)│
├──────────────────────────────────────────────────┤             │      │
│                       ro                         │             │      │
├──────────────────────────────────────────────────┤             │      │
│                      tlw          ← the timeline │             │      │
├──────────────────────────────────────────────────┤             │      │
│                       ar                         │             │      │
└──────────────────────────────────────────────────┴─────────────┴──────┘
      minmax(0,1fr)                12px      auto          --rw
```

```css
:root{--rw:64px;--sw:clamp(280px,26vw,320px)}
body[data-layout=rail]{
  display:grid;min-height:0;overflow:hidden;
  grid-template-columns:minmax(0,1fr) 12px auto var(--rw);
  grid-template-rows:auto minmax(0,1fr) auto clamp(240px,30vh,300px) auto;
  grid-template-areas:
    "bar  bar   panel tools"
    "view split panel tools"
    "ro   split panel tools"
    "tlw  split panel tools"
    "ar   split panel tools";
}
body[data-layout="rail-l"]{                       /* the mirror, one selector list */
  grid-template-columns:var(--rw) auto 12px minmax(0,1fr);
  grid-template-areas:
    "tools panel bar  bar"
    "tools panel split view"
    "tools panel split ro"
    "tools panel split tlw"
    "tools panel split ar";
}
```

Five rows, four columns, and the only thing that moves between the two variants
is which end the rail is on.

### 4.2 Why the timeline row is a fixed band and the preview is the `1fr`

`top` lets the preview take up to 54% and hands the rest to the dock, so the
preview is the greedy row and the timeline absorbs whatever is left. Here it is
the other way round, and deliberately: the timeline is a *docked* band whose
height is about legibility (lanes above `laneFloor`, the 164px floor
`fitView()` already computes), while the preview is the thing that should get
every spare pixel.

`clamp(240px, 30vh, 300px)` is the band. 30vh is 250 at 834 and 307 at 1024, so
it clamps to 250 and 300 — the same 240–300 range the reference uses. The floor
it has to clear is `laneFloor`, the 164px the ladder already computes from the
lanes themselves; the current `top` layout gives `.tlw` 231px at 1194×834, so 240
sits just above today's own figure and well above 164. Below **800** tall the
`30vh` term falls under the 240 floor and the clamp lifts it back up, which is
the point of writing it as a `clamp` rather than a `calc`.

The first attempt used `min(38vh,340px)` and the prototype measured the cost
immediately: at 1194×834 it took 317px, the preview band fell to **383**, and
the canvas came out **653×367 — smaller than `top`'s 800×450**. A state that
wants to be the landscape state cannot render the picture smaller than the one
it replaces. So the band is bounded, and the measurement is why (§4.4).

### 4.3 The panel column is `auto`, so it costs nothing when closed

`grid-template-columns: … auto var(--rw)` — the panel's column is sized by the
panel. `#panel` carries `width:var(--sw)` (`320px`), and while `#panel[hidden]`
the column collapses to **0**. That is the reference's `sidePanel.style.width
= '0px'` collapse expressed as grid instead of JS, and it means a closed sheet
does not take a single pixel from the preview:

| 1194×834 | `.view` | canvas | `.tlw` | panel |
|---|---|---|---|---|
| `rail`, sheet closed | 1118×450 | 771×434 | 1118×250 | 0 |
| `rail`, Adjust open | 808×450 | **771×434** | 808×250 | **310×834** |

The canvas is identical — the free row of §1.1's table, which is one of three
rows and not a general promise. At 1024×768 the same sheet takes 8% of the canvas
and at 1366×1024 it takes 9%.

### 4.4 The prototype this came from

The numbers in §1, §4.3 and §5 are not derived — they are what the engine
produced. The candidate rules above were injected into the live mock as a
`<style>`, `document.body[data-layout]` was set to `rail` by hand, and the rects
were read with `getBoundingClientRect()`. So they are the real layout of the
real file, one stylesheet short of shipping. What the prototype does **not**
cover: `applyLayout()`'s gate, the header icon, the Layout sheet, and the two
`layDR`/`layDL` glyphs — those are §12's build order, and §13's rows are what
make each of them real rather than assumed. The rail's own rules (46px rows,
`.vd` hidden, `overflow-y:auto`) were part of the injected sheet, because §6
found them by measuring rather than by designing.

All six readings, sheet closed → open, with `--sw:clamp(280px,26vw,320px)`:
**1024×768** canvas 672×378 → 644×362, `.tlw` 948×240 → 628×240; **1194×834**
canvas 771×434 → 771×434, `.tlw` 1118×250 → 808×250; **1366×1024** canvas
1020×574 → 946×532, `.tlw` 1290×300 → 970×300. Page `scrollWidth`/`scrollHeight`
equal to the viewport in every one of the six, and `.eb` 699/699 at 1194×834.

---

## 5. The sheet in the rail

The sheet is the second reason to do this, and it needs less machinery than the
side layouts do, not more.

- **No `min(46dvh,50%)` bound.** That bound exists because in `left`/`right` the
  sheet shares the timeline column's tall row with the timeline, so it has to be
  told not to eat it. In `rail` the sheet's own column runs the full height and
  there is nothing to be greedy with. Measured: **310×834** at 1194×834 and
  **320×1024** at 1366×1024 — full height, no `align-self`, no `height`.
- **`overflow:hidden` on the panel, `overflow-y:auto` on `.eb`** — the same pair
  R6c introduced, and for the same reason: `Done`/`Cancel` must never scroll off.
  Measured `.eb` **699/699** at 1194×834 (Adjust, all thirteen knobs, no scroll)
  and **889/889** at 1366×1024. The 310×834 column is taller than the phone's
  388px sheet and taller than the side layout's 323px bound, so the sheets that
  scroll today scroll less here.
- **`width:auto`'s trap is already documented and does not apply.** R6c's bug —
  `@media(min-width:900px){#panel{width:min(960px,100%)}}` resolving `100%`
  against the body — is avoided here by setting `width:var(--sw)` explicitly on
  the rail rule. It must be set, not left to the grid, for exactly that reason.
- **`--sw` is `clamp(280px, 26vw, 320px)`, and §1.1 is why it is not one
  number.** The ceiling at 1194×834 is 322px (`1194 − 12 − 64 − 796`), and 320 is
  the top of the range; 280 is the floor and is the reference's own figure. A
  fixed 320 measured a **19%** canvas cost at 1024×768; the clamp resolves to 280
  there, 310 at 1194 and 320 at 1366, and holds the canvas at ≥ 90% of its closed
  size at all three. Crucially it is *not* `--pw`: the divider that splits
  preview from timeline and the divider that splits main from sheet are different
  dividers, and reusing `--pw` for both would make a drag in one state move a
  boundary in another.
- **A portrait project in `rail`** gives the sheet a full-height column and the
  preview a short wide band. Papering over it with a taller band is worse than
  the honest answer, which is §9.2's auto rule.

---

## 6. The tools become a vertical rail

This is the one place `rail` costs more than the side layouts, and it is also
where it fixes §3's second problem.

- **`.tools` goes `flex-direction:column`.** The row is
  `justify-content:space-around` with `flex:1;max-width:96px` children; in the
  rail it becomes `flex-direction:column;justify-content:flex-start`, children
  `flex:none;width:auto;min-width:0`, and the label spans hidden
  (`body[data-layout=rail] .tools button span{display:none}`). That is the same
  icon-only state §8 of the iPad plan already specifies for a measured overflow,
  here entered unconditionally because a 64px column cannot hold eight labels.
- **46px rows, and this is the number the prototype had to find.** Left alone,
  the fifteen tool buttons measure **26px tall** — far under the 44px touch target
  the self-check asserts everywhere else. Setting `min-height:44px` was not
  enough: the rail then measured **776px** of content at 900×700, because the
  `@media(min-width:900px)` rule sets `gap:8px` (14 × 8 = 112) and the two `<i
  class="vd">` group separators add their own height. The rail has to be a
  column of its own, so the fix is all three parts: **`.vd` hidden**, **`gap:2px`**,
  and **`height:46px`** with the vertical padding off. That measures **730px** of
  content — 15 × 46 + 28 + 12 — which fits the 768-tall iPad with 26px spare
  (measured `scrollHeight === clientHeight === 768` at 1024×768), keeps the
  target above 44px, and still leaves `overflow-y:auto` on the rail as the escape
  hatch for a shorter window.
- **`--rw` is 64px.** The reference's is 72; 64 holds a 24px glyph centred in a
  46px target with 9px of gutter, and it is 8px less taken from the picture. It
  is a `:root` variable so it is one number to change.
- **The vertical divider `.vd` between `Format` and the rest** is meaningless in
  a column and is hidden, as §8 of the iPad plan already says for the icon-only
  row.
- **What the rail does *not* do:** it does not become a second, different list of
  tools. It is the same `TOOLS` array, the same `data-t`, the same
  `strip()`/`panel()` wiring — only the flex axis and the label visibility
  differ, both scoped to the state.

---

## 7. The header control now cycles six

`LAYOUTS`, `layoutGlyph` and `LLBL` are the whole vocabulary, and all three grow:

```js
const LAYOUTS=['top','rail','rail-l','left','right','full'];
const layoutGlyph={top:'layT',rail:'layDR','rail-l':'layDL',left:'layL',right:'layR',full:'layF'};
const LLBL={top:'Preview top',rail:'Rail right','rail-l':'Rail left',
            left:'Preview left',right:'Preview right',full:'Preview only'};
```

- **The cycle order groups by what moves:** `top` (nothing), then the two rail
  states (the rail and the sheet move), then the two preview states (the preview
  moves), then `full` (everything but the preview goes). `shift+P` still jumps to
  `full`, and the header title already says "tap for <next>" so the order is
  self-describing.
- **Two new glyphs, `layDR` and `layDL`.** The existing four are "a rectangle
  with a divided edge, the divider moving". These two are a rectangle with the
  divider **near the top** *and* a narrow strip down one edge — the preview band
  and the rail in one mark, mirroring for `layDL`. Same 24px grid, same stroke.
- **The `#lay` gate stays 600px; the state's gate does not.** The icon appears
  wherever it does today, but `applyLayout()` refuses `rail`/`rail-l` below 900px
  or in portrait and falls back to `top` — §9. Two different numbers for two
  different questions; §7 of the iPad plan already argues for one gate per
  *decision*, and here there genuinely are two.

---

## 8. The Layout sheet

`tool=='layout'` currently renders four `.rt` tiles from `LAYOUTS`. It renders
six, from the same array, with the same `layoutGlyph[k]` icons and the same lit
tile — no new artwork (the tile *is* the header glyph, and §3.3 of the iPad plan
made that a feature).

- **The 6th tile needs the 3×2 to be a real grid.** Tiles are 96px wide; six in
  a row is 616px. That fits the sheet at 1194×834 (704) and in `top` (960), and
  **does not fit the 320px rail sheet** — so `.rts` needs `repeat(auto-fit,
  minmax(96px,1fr))` rather than its current fixed row, which is the one change
  to existing sheet CSS. In the rail that wraps to 3×2; in `top` and the side
  layouts it stays one row of six.
- **The rail tiles are gated, visibly.** When §9's gate fails (a phone, a
  portrait iPad) the two rail tiles are `display:none`, matching how the rail's
  Layout entry is already hidden by the same breakpoint as `#lay`. A tile that
  silently does nothing is the failure mode §3.2 warns about; a tile that is not
  there is honest.
- **The footer stays `Done` alone**, for the reason the iPad plan gives: Layout
  is the one sheet that commits on tap and cannot be un-tapped, so Cancel and
  Reset would both mean Done.

---

## 9. Gates, defaults, and the auto rule

### 9.1 Two gates

| state | offered when | falls back to |
|---|---|---|
| `left`, `right`, `full` | `innerWidth >= 600` (unchanged, R2) | `top` |
| `rail`, `rail-l` | `innerWidth >= 900` **and** `innerWidth > innerHeight` | `top` |

900 rather than 600 because 900 is where the state stops paying for itself, and
that is measured rather than asserted. The gate's own boundary case, 900×700,
reports a canvas of **551×310** with the sheet closed and **520×293** with it
open — 89% of the area, the worst of any viewport the state is offered at (the
three target iPads report 92%, 100% and 91%, §1.1). It degrades quickly below
that, because the sheet's 280px and the rail's 64px are a fixed cost against a
shrinking band; at 600 wide the fixed cost is most of the screen.

The `innerWidth > innerHeight` half is the honest statement of "this is a
landscape state": in portrait the band is short *and* the sheet's column is
pointless, because there is no width to spare. The reference arrives at the same
place from the other direction with its `(w>h && h<500)` split.

The resize handler already reverts a side layout below 600px; it gains the same
revert for the rail states, so rotating a 16:9 iPad into portrait lands on `top`
rather than on a squeezed rail.

### 9.2 The auto rule grows an input

§3.1 of the iPad plan leaves one decision to the owner: whether the default
becomes `auto`. The rail changes the shape of that decision, because now the
project's own aspect is an input:

| project | landscape iPad | portrait iPad | phone |
|---|---|---|---|
| `16:9`, `1:1`, `4:5` | **`rail`** | `top` | `top` |
| `9:16` | `left` (or `right`) | `top` | `top` |

The reasoning is the one in §1.2: a widescreen project wants a widescreen band
with room beside it, and a portrait project wants the tall column `left`/`right`
already give it. This is a recommendation for R13, not a change in it — R13
already exists and is already "a separate decision, separate commit".

---

## 10. What it costs, and what it does not touch

**Reused by construction, no new code:**

- `body[data-layout]:not([data-layout=top]) .dock{display:contents}` and the
  whole `.bar`/`.view`/`.ro`/`.tlw`/`.ar`/`.tools` placement family — `rail` is a
  non-`top` value, so it inherits all of it.
- The gutter neutralisation for a 9:16 project (`body[data-layout]:not([data-layout=top]).gut …`).
- The sheet's `overflow:hidden` / `.eb{overflow-y:auto}` / `.eb.st{justify-content:flex-start}`
  / `.eh/.ef{flex:none}` pair.
- `fitZoom()` derives `pps` from `tlWidth()`, so the 1118/970-wide timeline is a
  pure zoom change — 11.2s and 9.7s visible at `pps=60`, no code.
- The `ResizeObserver` on `#tl`.
- `#lay`, `cycleLayout`, the `p`/`P` keys, the Layout sheet's commit branch.

**New code:** the two `grid-template-areas` blocks, the panel's `grid-area` and
`width`, the rail's `flex-direction`, its 44px rows and its `overflow-y`, three
entries in each of `LAYOUTS`/`layoutGlyph`/`LLBL`, two ICON entries, two new
tiles' worth of gate logic, and the `.rts` wrap. That is the whole change: it is
the same size as R1/R2 were, and it is one attribute value.

**Not needed:** a `fitView()` branch. The plan's R3 was never built for
`left`/`right` because "the inline `flex` it writes is simply ignored by the
grid", and the same holds here — the grid sizes the preview band, and `fitView()
still owns the `gut` class, the `laneFloor` cache and the filmstrip re-layout,
all of which keep working because the dock is still laid out. The one wrinkle is
that `.tools`' height now feeds `chrome`, a number only the ignored `top` path
uses; it is harmless, and §13's last row asserts the `top` numbers did not move.

---

## 11. Risks

| | risk | mitigation |
|---|---|---|
| 1 | **The preview band is the whole bet** — if it is shorter than the picture wants, the canvas is smaller than `top`'s and the state has no reason to exist. | The band clamp is `clamp(240px,30vh,300px)` because `min(38vh,340px)` measured 653×367 at 1194×834 against `top`'s 800×450. The verification row asserts the canvas is **≥ 90% of `top`'s area** with the sheet open (measured 100% at 1194×834, 92% at 1024×768, 93% at 1366×1024) **and** that the timeline is still on screen — a red row if the band gets greedy or the column gets fat. |
| 1a | **The sheet's cost is only free at one viewport.** A fixed `--sw:320` measured 19% of the canvas at 1024×768 and 100% at 1194×834 — a single number cannot be right for both. | `--sw` is the responsive `clamp(280px,26vw,320px)` (§5), and the ≥ 90% floor is asserted at **all three** viewports, so a future width that is fine at 1366 and wrong at 1024 turns a row red instead of quietly shrinking the picture. |
| 2 | **`grid-template-columns: … auto` with a hidden panel could still reserve space** in a browser that treats `auto` differently. | `#panel[hidden]` is `display:none`, which contributes nothing; the prototype measured a 0-width column and an unchanged canvas. The self-check asserts the canvas width is identical with the sheet closed and open. |
| 3 | **15 tools do not fit a short rail at a touch-legal target.** Measured: 776px of content at `min-height:44px` (the ≥900 `gap:8px` plus the two `.vd` separators), against 768px of rail. | All three parts in §6: `.vd` hidden, `gap:2px`, `height:46px` ⇒ **730px** measured, which fits 1024×768 with 26px spare at a 46px target. A row asserts `scrollHeight ≤ clientHeight` there and ≥ 44px targets everywhere; `overflow-y:auto` covers a shorter window, and if the list ever grows past 15 the answer is the iPad plan's `.tcol`/`tmin` collapse, not a shorter target. |
| 4 | **Six states is a lot to cycle through to get back to `top`.** | The cycle order groups by what moves, the header title names the next state, `shift+P` is a one-key escape to `full`, and the Layout sheet puts all six on screen at once — which was R3's whole point. |
| 5 | **`--sw` and `--pw` being different dividers** invites a drag in one state moving a boundary in another. | Two variables, two writes, and the verification row asserts a `--pw` change does not move the sheet. |
| 6 | **A portrait project in `rail` looks broken.** | The state is available but the auto rule (§9.2) never selects it, and §9.1's landscape gate means a rotated iPad leaves the state entirely. |
| 7 | **A second gate drifts from the first.** | One constant per state, and a verification row asserting 899×700 offers no rail tile while 900×700 and 1024×768 do — the same "one gate per decision" rule §7 of the iPad plan set. |

---

## 12. Build order

Continuing the iPad plan's R-numbers; each step is independently verifiable and
leaves the app working.

| | step | done when |
|---|---|---|
| R14 | `body[data-layout=rail]` + `rail-l` areas, forced by a constant, no toggle | the §4.4 prototype numbers reproduce from the shipped stylesheet: 1194×834 canvas 771×434 both closed and open, `.tlw` 1118→808, no page scroll; `top`/`left`/`right`/`full` byte-identical |
| R14a | `--sw`'s cost curve, measured rather than assumed | a fixed 320 is measured against a fixed 280 at 1024×768 and 1194×834, the 796px main-column threshold is confirmed by widening `--sw` until the canvas shrinks, and `clamp(280px,26vw,320px)` is adopted only if it holds ≥ 90% at all three viewports |
| R15 | the panel's `grid-area`/`width:var(--sw)`/`overflow`, `--sw`/`--rw` in `:root` | Adjust's `.eb` measures 699/699 at 1194×834, the panel is 310×834 there, and the canvas is unchanged by opening the sheet; at 1024×768 the sheet is 280 wide and the canvas keeps ≥ 90% |
| R16 | `.tools` becomes a column, 46px rows, `gap:2px`, vertical padding off, labels off, `.vd` hidden | the rail is 64px; at 1024×768 `#tools.scrollHeight ≤ clientHeight` (measured 730 vs 768) with every target ≥ 44px; the `.vd` separators are gone |
| R17 | `LAYOUTS`/`layoutGlyph`/`LLBL` + the two `layDR`/`layDL` glyphs + the header title | the header cycles six, and the title names the next state at each |
| R18 | the 900/landscape gate in `applyLayout()` + the rotation revert | 899×700, 700×900 and 834×1194 all land on `top`; 900×700, 1024×768 and 1194×834 hold `rail`; ↗ then ↘ returns to `rail` |
| R19 | the Layout sheet's 6 tiles + `auto-fit` tiles + the gated rail tiles | six tiles at 1194×834 in `top`, the two rail tiles absent on a phone, a rail tile tap moving `data-layout` and the header glyph |
| R20 | fold `rail` into R13's `auto` (§9.2) — separate decision, separate commit | — |

---

## 13. Verification

Each row is a measurement, not a look; the first column is the state under test.

| | check |
|---|---|
| the bet | `rail`, 16:9, one clip, sheet open: the canvas is 771×434 = 334k at 1194×834, i.e. **≥ 90% of `top`'s 800×450 = 360k** (measured 93%), **and** `.tlw` ≥ 164. `top` reaches 360k only by deleting the timeline and `left` reaches 116k, so the row fails a `rail` that drifts below 90% and cannot be satisfied by either other state |
| the sheet's cost | measured at all three: 1024×768 canvas 672×378 → 644×362 (**92%**), 1194×834 771×434 → 771×434 (**100%**), 1366×1024 1020×574 → 946×532 (**91%**). A fall below 90% at any of the three is red |
| the free row | the 1194×834 canvas is 771×434 with the sheet **closed and open** — identical, because the 310px column leaves 808 against §1.1's 796px threshold |
| the timeline stays | `rail` with a sheet open: `.tlw` ≥ `laneFloor` (164) and both lanes have non-zero height, at 1194×834 and 1366×1024 |
| the band is bounded | `.tlw`'s row resolves to `clamp(240,30vh,300)` ±2 at 1024×768, 1194×834, 1366×1024 — measured 250 at 834 and 300 at 1024; arithmetic at 768 (`30vh` 230 is below the 240 floor, so 240) |
| the rail | the rail column is 64px and does **not** scroll at 1024×768; every button rect ≥44px; `#tools`' scrollWidth ≈ clientWidth |
| the sheet | 310×834 at 1194×834, 280×768 at 1024×768 and 320×1024 at 1366×1024; `.eb` is `overflow-y:auto`, `#panel` is `overflow:hidden`, the footer is on screen, and `.eb.scrollHeight ≥` its content |
| the two dividers | dragging `--pw` in `left` does not move `rail`'s sheet, and vice versa |
| the gates | `rail` refused at 899×700, 700×900 and 834×1194; held at 900×700, 1024×768 and 1194×834; the rail tiles are absent below 900 and in portrait |
| rotation | 1194×834 → 834×1194 → 1194×834 returns to `rail` with the picture and timeline intact |
| touch | `pointer:coarse`: every rail target ≥44px, nothing overlapping, the zoom steppers still gone and `Fit` still there |
| themes | dark and light at 1194×834 in all six states |
| no regression | `top` at 393×844, 462×836, 834×1194, 1194×834, 1366×1024 reports the §3 numbers exactly; `left`/`right`/`full` untouched |
| build | `npm run build` clean; no new console errors beyond the known dev-only `sw.js` 404 |

### 13.1 The rows the self-check gains

Six rows in [`selfcheck.html`](selfcheck.html)'s `layframe` (`LW`) section, next
to the six layout rows already there. Each is written so that breaking the rule
turns it red, and each names the injection that must fail it:

| row | asserts | the injection that must fail it |
|---|---|---|
| the column is free | `rail`, 1194×834, Adjust open: the canvas rect equals its rect with the sheet closed, to the pixel | `grid-template-columns:minmax(0,1fr) 12px 320px var(--rw)` ⇒ the closed case is 320px narrower ⇒ **red** |
| the timeline survives | `rail` with a sheet open: `.tlw` ≥ 164 and the film lane's height > 0 | `body[data-layout=rail].es .dock{display:none}` (the `top` rule) ⇒ `.tlw` rect 0 ⇒ **red** |
| the band is bounded | `.tlw`'s row height = `clamp(240,30vh,300)` ±2, not `max` of the terms | `grid-template-rows:… auto min(38vh,340px) auto` ⇒ 317 ≠ 250 at 1194×834 ⇒ **red** |
| the rail is reachable | the rail's button rects are all ≥44px tall and `#tools.scrollHeight <= #tools.clientHeight` at 1024×768 | the current `flex:1;max-width:96px` row ⇒ 26px targets and a scrolling rail ⇒ **red** |
| the gate is two | 900×700 and 834×1194 land on `top`; 1194×834 holds `rail` | dropping the `innerWidth>=900` half ⇒ 900×700 holds `rail` ⇒ **red** |
| six states, six tiles | `LAYOUTS.length === 6`, the Layout sheet renders six tiles with exactly one lit, and the tile count matches the header's cycle length | `LAYOUTS.slice(0,4)` in the tile map ⇒ five tiles for six states ⇒ **red** |

These join the existing `26/26 · 4/4 · 4/4 · 7/7 · 20/20 · 7/7 · 6/6` — the
iPad section grows from 14 rows to 20 — and the count in
[`index.html`](index.html)'s self-check card is re-taken from the run, not
hand-edited.

---

## 14. Out of scope

- **Dragging the rail's divider to set `--sw`.** R5's drag code is parameterised
  by variable, so it is a small follow-up, but a fixed 320px is easier to verify
  and is the reference's own choice.
- **Reordering or splitting the rail.** Fifteen tools in one column is already
  the tightest thing here; a second rail column is a different design.
- **A free-floating playhead**, which the reference has and the iPad plan already
  defers.
- **A rail for portrait projects.** §1.2 and §9.2 say no; the tall column
  `left`/`right` give a 9:16 project is the right answer and does not need
  replacing.
- **Making the rail the phone's layout.** A 320px sheet beside a phone preview is
  a different app; the 600px floor stays.
