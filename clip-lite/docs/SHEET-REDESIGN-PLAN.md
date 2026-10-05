# The sheets — one row grammar, real sections, icons that mean something

A plan for [`clip-lite-mock.html`](clip-lite-mock.html), about the three sheets in
the screenshots: **Settings**, **Export** and **Adjust**. They already share a body
(`.eb`), a title (`.eh`) and a footer (`.ef`) — which is the whole point of a sheet
system — and then disagree with each other about everything inside that body.

This is the *inside* of the sheet. [`IPAD-LAYOUT-PLAN.md`](IPAD-LAYOUT-PLAN.md) §7.1
decides how tall a sheet is allowed to be in the split layout; this decides what is
in it. The two interlock: §7.1 takes the body from 418px to ~322, and the first
finding below is that a body is mostly empty already.

**This is a plan.** Nothing here is built.

> Every number below was measured on the real page at the stated width with a clip
> selected, not read off the CSS. Where a number is arithmetic it says so.

---

## 1. What is there now, measured

### 1.1 Every sheet centres its content, so every sheet is mostly holes

At 704px (the split layout's timeline column), with the body 418px tall:

| sheet | body | content | void above | void below | empty |
|---|---|---|---|---|---|
| **Speed** | 418 | 48 | **185** | **185** | **88%** |
| **Export** | 418 | 155 | **132** | **132** | 69% |
| **Settings** | 418 | 222 | **98** | **98** | 47% |
| **Adjust** | 418 | 120 | 71 | 71 | 57% |
| **Filters** | 418 | 156 | 62 | 62 | 63% |

On a 357px phone the same shape holds: Speed is 218 of body with 85px of void above
its one slider.

The cause is one line — `.eb{flex:1;display:flex;align-items:center;justify-content:center}`,
and `.eb.st` (the Settings body) keeps `justify-content:center` in its column
variant. **The distance from the title to the first control is therefore a function
of how few rows the sheet has.** Speed puts one slider in the vertical middle of a
418px body; Export puts three rows in the middle of one. Nothing is anchored, so
there is no fixed place the eye can go when a sheet opens.

This is also why the sheets look like they have no structure: with content floating
free, a section heading would have nothing to align to.

### 1.2 Six row idioms for one idea

"A label with a control on it" is drawn six different ways:

| idiom | used by | height | shape |
|---|---|---|---|
| `.sr` | Settings rows | **44** | hairline underline, radius 0 |
| `.xr` | Export rows | **52** | radius 12, hover fill |
| `.car .kn` | Adjust knobs | **66** | 46px circle, radius 50% |
| `.car.fcards` | Filters cards | **102** | 64×82 box, radius 10 |
| `.rt` | Aspect / Layout tiles | square + label | radius 16 |
| `.swt` | Canvas swatches | **40** | radius 50% |

Six hit heights, five radii, three label sizes, and two of them (`.sr` and `.xr`)
are the *same thing* — label left, value and control right — differing only in
padding, radius and whether there is a hover. A person cannot learn the rhythm
because there is no rhythm: 44 next to 52 next to 66 next to 102.

### 1.3 The Adjust row is thirteen things in insertion order

Thirteen knobs, 1004px of row needed, **584px available** in the sheet's own column
(measured `scrollWidth` 1004 against `clientWidth` 584) — so about **five knobs are
off-screen**, and on a 357px phone `clientWidth` is 302, so **three of the thirteen
are visible**. There is no cue that the rest exist: `.car{scrollbar-width:none}`
and, unlike the tool row, no mask.

They also arrive in insertion order, which mixes four different kinds of control:

| kind | knobs | what it is |
|---|---|---|
| tone | Brightness, Contrast, Highlights, Shadows, Saturation, Warmth | a curve on the picture |
| detail | Sharpen, Blur | a spatial filter |
| look | **Fade** | a *look* — and the Filters sheet already has a card called Fade |
| finish | Vignette, Grain, Blue tone, Opacity | a post pass over the finished frame |

Fourteen names for thirteen slots, because **"Fade" is two different controls in
two different sheets**, and neither of them is wrong on its own:

```js
F.fade  : k => `contrast(${1-k*.28}) brightness(${1+k*.12}) saturate(${1-k*.26})`
ADJ.fade: v => `contrast(${1-v*.38}) brightness(${1+v*.2})`
```

Same word, same intent (lower contrast, lift the blacks), different curves, and
two different places to reach it. A person who fades a clip from the Adjust shelf
and a person who fades it from Filters get different pictures and no way to know
that is what happened. This is the one item in this plan that is a *correctness*
problem rather than a layout one, and it is measured, not inferred: `ADJ.fade` has
a real `f` and `look()` pushes it (line 1188), so the knob does work.

### 1.4 Eight rows have no icon, and the shelf's icons break the row's own rule

Measured against the glyph map (50 entries): **every one of Settings' five rows and
Export's three rows is text-only.** Nothing there is scannable; you read five lines
to find "Snap to edges".

The thirteen Adjust knobs *do* carry glyphs, and the glyphs are inconsistent in a
way that matters more than taste:

- **`ctr` (Contrast) is a half-filled disc, `vig` (Vignette) has a filled centre,
  `grain` is eight solid dots — while `sun`, `high`, `shad`, `sat` and `warm` are
  stroked outlines.** In a shelf whose entire selection vocabulary is a ring around
  the knob (`.car button.on .kn{border:2px solid var(--on)}`), a glyph that is
  half-solid reads as a *second* selected state. In the screenshot, Brightness
  wears the ring and Contrast is half-black — the row appears to have two
  selections.
- **`blue` (Blue tone) is a cloud.** It reads as weather, not as colour temperature.
- **`opacity`** is a blobby outline that reads as a ghost, not as alpha.
- **Fade's bars** are the Adjust knob's only mark for a look that also exists as a
  Filters card — a card whose mark is a live CSS preview of the look, not a glyph.
  So the two controls that mean the same thing look nothing like each other.

### 1.5 The footer has three different shapes

Three pills (Adjust, Filters: Cancel / Apply to all / Done), two (Export: Cancel /
Export; Settings: Done alone; Rearrange: Cancel / Done), one (Layout: Done alone).
The middle slot is usually an empty `.m` that exists only to hold the centre. And
**Reset** — the action that undo-es a slider — is a pill in the footer, so it sits
in the same rank as Cancel and Done even though it is not a navigation action.

---

## 2. The redesign

Four moves, in this order of importance: **anchor the body**, **one row**, **name
the sections**, **icon it**. Each is independently verifiable and each leaves the
app working.

### 2.1 Anchor the body — the sheet grows downward, not outward

```css
.eb{flex:1 1 auto;display:flex;align-items:stretch;flex-direction:column;
    justify-content:flex-start;gap:0;flex-wrap:nowrap;padding-top:var(--gat);}
```

`align-items:stretch` + `justify-content:flex-start` is the whole change: content
starts where the title ends and the leftover space collects *below* the last row
instead of being split above and below it. `.eb.st` becomes redundant — the base
rule is now the column the settings body was asking for.

What that buys, measured at 704: the top void goes 185 / 132 / 98 / 71 / 62 →
**0 for every sheet**, and the first control of every sheet sits at the same y.
The bottom void stays, and that is correct — a sheet with four rows *should* have
room below them, and it is the space a fifth row would grow into.

It also has to land before [`IPAD-LAYOUT-PLAN.md`](IPAD-LAYOUT-PLAN.md) §7.1
(R6b). A 322px body with a centred one-slider Speed sheet is 185px of hole; anchored,
the same sheet is a slider under its title and honest about being short.

### 2.2 One row — `.rw`

```css
.rw{display:flex;align-items:center;gap:12px;min-height:56px;padding:0 4px;
    border-bottom:1px solid color-mix(in srgb,var(--on) 7%,transparent)}
.rw:last-child{border-bottom:0}
.rw .ri{width:18px;height:18px;flex:none;color:var(--on2)}       /* the row's icon */
.rw .rl{flex:1 1 auto;min-width:0;font-size:15px;color:var(--on)} /* the label */
.rw .rc{display:flex;align-items:center;gap:8px;flex:none}        /* the control */
.rw .rv{font-size:13px;color:var(--on2);font-variant-numeric:tabular-nums}
```

Settings' `.sr` and Export's `.xr` both become `.rw`. That retires two CSS blocks
and, more importantly, gives every control the one height the app already trusts
elsewhere: **56px rows with a 44px floor on anything tappable inside them**, which
is what `.sr` already did for its pills and what `.chip` (32) and `.xo .chip` (36)
currently do not.

The shelves keep their own row type. A knob is not a row: it is a 46px target with
a label under it, and it is the right shape for choosing *which* value a slider
edits. The point is not that everything looks the same; it is that **a row and a
shelf are the only two grammars**, and today's six collapse into those two.

### 2.3 Sections — `.sec`

```css
.sec{padding-top:var(--sech)}                  /* 18 */
.sec>h4{margin:0 0 2px;padding:0 4px;font-size:11px;font-weight:600;
        letter-spacing:.08em;text-transform:uppercase;color:var(--on2)}
```

The first section in a sheet carries no heading — the title is its heading, and a
sheet with one heading under one title says nothing twice.

- **Settings** gets three sections instead of five loose rows: **Timeline** (zoom,
  ruler interval), **Editing** (step one frame, snap to edges), **Storage** (saved
  project, Clear). The reason is not tidiness: zoom and the ruler are properties of
  the *timeline*, snap and frame-step are properties of *your editing*, and Clear is
  the only destructive control in the app. They are three different things and the
  sheet currently presents them as one list.
- **Export** gets one section, **Output**, and a summary line (2.5).
- **Adjust** gets three sections and loses a duplicate (2.4).

### 2.4 Adjust — three sections, twelve knobs, one fewer word for "Fade"

| section | knobs | row width @78/knob |
|---|---|---|
| **Tone** | Brightness, Contrast, Highlights, Shadows, Saturation, Warmth | 468 |
| **Detail** | Sharpen, Blur | 156 |
| **Finish** | Vignette, Grain, Blue tone, Opacity | 312 |

**Fade becomes one control.** A look belongs to Filters — that sheet already draws
it as a live preview of the curve, which is a better control than the Adjust knob's
bars — so the Adjust entry goes and `F.fade` keeps the word. Because `ADJ.fade`'s
curve is real, this is a *merge* and not a deletion, and it needs the one line of
migration the plan asks for: on load, a clip with `ad.fade` set gets `f='fade'` and
`fs` set from `ad.fade` (clamped to 0…1), so an old project keeps its look under
the surviving control. Deleting the entry without that line would silently drop an
effect from every project that used it — which is exactly the class of bug the
`del` glyph was, only with a picture attached.

The arithmetic is the argument for sectioning as well as the grouping: the widest
section is 468px against the sheet's 584px, so **the ADJUST row stops scrolling
horizontally at the sheet's own width** — five off-screen knobs become zero. On the
357px phone `clientWidth` is 302, so Tone still scrolls; that is unavoidable with
six knobs on a phone, and the fix is to stop hiding it: give `.car` the same
mask-image fade the tool row has, so the cut-off knob is visibly cut off.

### 2.5 Export — say what you get

Export currently reports its three settings and nothing about their consequence,
even though the app already knows most of it. `resDims()` is the real output size —
measured: **1920 × 1080** for a 16:9 project at High, **608 × 1080** for 9:16,
**1080 × 1080** for 1:1, **864 × 1080** for 4:5 — and it is derived from the
project's own aspect rather than stored. So:

- **A summary line** under the rows, read from the same functions the exporter
  reads: `608 × 1080 · 30 fps · MP4 · ≈ 20 MB`. The pixels come from `resDims()`,
  the fps from `EXP.fps`, the format from `EXPFMT` — three values that cannot
  disagree with the export because they *are* the export's inputs.
- **The estimate is the one genuinely new number**, and it has to come from the
  encoder's own bitrate × the project's duration. Two candidates are wrong and
  worth naming so nobody reaches for them: the storage row's byte count is the
  **stored project including the media blobs**, a different quantity entirely; and
  `resDims()`' pixel count is not a size. Today `runExport()` passes one hardcoded
  `videoBitsPerSecond: 8e6`, which at the 20s test clip is ~20 MB.

The summary line also exposes something the sheet currently hides: **Resolution
changes the pixel count but not the bitrate.** Low — 480p and High — 1080p are both
encoded at 8 Mbps, so the estimate will not move when Resolution does. That is
either a defect in the exporter or a deliberate constant, and the sheet is the
place the question becomes visible — the plan is to say so on the line rather than
to silently model a size that the encoder is not producing.
- **Icons** on the three rows (2.6), so the sheet is scannable before it is read.
- **The open row's options stay under that row** (they already do) — the current
  behaviour reflows the rows below, which is right; what is wrong is that the rows
  have no icon to hold their place while they move.

### 2.6 Icons — six new glyphs, six already drawn and unused

Measured: the glyph map has 50 entries and not one of the eight text-only rows
resolves to any of them. The set needed is smaller than it looks, because half of
the marks already exist and are simply not used in a row:

| row | today | proposed |
|---|---|---|
| Timeline zoom | none | **`zo`** — already drawn for the zoom buttons in this same sheet |
| Step one frame | none | **`prev` / `next`** — already drawn *beside the label* on that row |
| Snap to edges | none | **`snap`** — already drawn, used by the snap toggle in the timeline |
| Ruler interval | none (the value chip says `≣5s`) | new **`ruler`** |
| Saved project | none | new **`store`** |
| Frame rate | none | new **`fps`** |
| File format | none | new **`file`** |
| Resolution | none | new **`res`** |
| sheet title: Settings | none | new **`cog`** |
| sheet title: Export | none | **`up`** — the header's own export arrow |
| sheet title: Adjust | none | **`adjust`** — already drawn |

Six new glyphs, six reuses. Every one of them is drawn in the app's existing
vocabulary: `ruler` is the timeline's own tick strip reduced to five marks; `fps`
is `next`'s chevron over two sprocket holes; `file` is the page-plus-fold already
implied by `up`'s tray; `res` is a frame with corner ticks; `store` is a stacked
disc; `cog` is eight teeth around a circle.

**And the rule the shelf broke:** in a shelf, the only solid mark is the selection
ring. So **Contrast loses its filled half**, **Vignette's centre becomes a stroked
circle**, **`blue`'s cloud is replaced** by a tint drop, and **`opacity` gets a
checkerboard half** — the standard alpha mark — rather than a ghost. Grain keeps
its specks, and that is the one stated exception: the dots *are* the thing the
glyph depicts, where a half-disc is not "contrast" and a cloud is not "cool".

**The contract, and the bug it comes from.** `ic(n)` interpolates `ICON[n]` into an
`<svg>`; a name the map does not have renders the string `undefined` inside an svg,
which is not an exception, not a warning, and not a console message — it is a blank
square with a label under it. That is exactly what had happened to the rail's
**Delete**: `LBL.del` existed, `ICON.del` never did. It is fixed on disk
(`ICON.del=ICON.trash`, and `ICON.layout=ICON.layL` for the same hole in the Layout
entry), and the durable half of the fix is a row in
[`selfcheck.html`](selfcheck.html) that fails on any blank glyph — see §5.

### 2.7 The frame — title, close, and a footer you can predict

- **The title becomes a row**: `[tool icon] Title` left-aligned, `×` on the right.
  The `×` and Cancel do the same thing (which is what a close affordance is for),
  and putting it in the title is what lets the footer be uniform.
- **The footer is always two pills**: the quiet one on the left (`Cancel`, or
  `Close` for Settings, which has nothing to cancel), the loud one on the right
  (`Done`, or `Export`). **Reset moves out of the footer** and becomes a `Reset`
  text button beside the title, because it is not navigation and because the
  middle footer slot is currently an empty div on most sheets purely to hold a
  centre that only two sheets use.
- `Apply to all` keeps the middle slot — it is the one action that is genuinely
  about more than the object the sheet is about, and the sheet even says so in a
  line above the row. It is the only thing allowed to be there.

---

## 3. Tokens

Nine numbers, declared once, so the sheets cannot drift apart again:

```css
:root{
  --gat:16px;    /* sheet body top pad, under the title            */
  --sech:18px;   /* gap above a section heading                    */
  --rw:56px;     /* a row                                          */
  --tap:44px;    /* the floor for anything tappable                */
  --ri:18px;     /* a row's icon                                   */
  --kn:22px;     /* a shelf's icon                                 */
  --rad-row:12px;--rad-card:16px;--rad-pill:22px;
}
```

The rule behind them: **one row height, one icon size per context (18 in a row, 22
in a shelf), one tap floor, three radii by role — row, card, pill.** Today's 8 /
10 / 12 / 16 / 18 / 22 / 50% are seven radii for three roles.

---

## 4. Risks

| | risk | mitigation |
|---|---|---|
| 1 | **Anchoring the body changes every sheet's height feel at once.** | It is one rule and it removes space, so nothing can be pushed out of the body by it. Verified as numbers, not looks: top void 0 on all five sheets, and the content height unchanged per sheet. |
| 2 | **`.eb.st` is referenced by `settingsSheet()` and the selectors for the settings rows.** | §5 lists it; the class is removed in the same change that removes the rule, and the Settings sheet is one of the five measured in the check. |
| 3 | **Merging the two Fades changes what an existing project looks like** if the migration is wrong. | The migration is one line and is checked in §6 by round-tripping a clip with `ad.fade` through save/load and asserting it renders the same picture (the self-check's persistence section already has the harness). `ADJ.fade` and `F.fade` are not identical curves, so the assertion is "close and in the same direction", stated as a tolerance, not equality. |
| 4 | **New glyphs are the cheapest thing to get wrong** — a cog at 18px is mulch. | Every new glyph is drawn at both sizes it is used at (18 in a row, 22 in a shelf) and checked at 100% zoom; the check also asserts the map resolves, which is a different failure from a glyph being ugly. |
| 5 | **A 56px row makes a five-row Settings sheet 280 + headings ≈ 320px**, taller than §7.1's 322px bound. | It fits exactly; and if a sixth row ever arrives, the body scrolls (`#panel{overflow-y:auto}`), which is already the phone's behaviour. This is the reason §2.1 and §7.1 must be read together. |
| 6 | **Section headings add a second type style** to a sheet that has one. | One 11px/600/uppercase/`--on2` heading, one size, no exceptions; it is smaller and quieter than a row label (15px) so it groups without competing. |
| 7 | **The size estimate becomes a promise the exporter may not keep** — it is a bitrate × duration, and the bitrate is a constant. | Label it `≈` and derive it on every paint from `EXP` and `total`, so it can only ever be as wrong as the encoder is; and because it will not move with Resolution, say *why* on the line rather than hiding the discrepancy. The check asserts the estimate is unchanged by `EXP.res`, so the constant is a known fact rather than a surprise. If the exporter later models bitrate per resolution, the line updates itself. |

---

## 5. Build order

Each step is independently verifiable and leaves the app working.

| | step | done when |
|---|---|---|
| **S1** | `.eb` anchored (2.1); `.eb.st` removed | top void is **0** on Speed, Export, Settings, Adjust and Filters at 704; content heights unchanged |
| **S2** | `.rw` introduced; Settings and Export rows move onto it | both sheets' rows measure 56px with a 44px floor on their controls; `.sr` and `.xr` have no remaining users |
| **S3** | the six new glyphs, the five reuses, and the four shelf corrections (2.6) | every row and every rail button draws; Contrast's fallback disc is gone; the blank-glyph row in `selfcheck.html` passes **and is shown to fail** when `ICON.del` is deleted |
| **S4** | the title row + `×`, the two-pill footer, Reset beside the title (2.7) | every sheet's footer has exactly two pills; Reset is reachable on Speed, Volume, Filters, Adjust, Rotation, Transition, Aspect, Canvas and Settings |
| **S5** | Adjust sectioned, the two Fades merged with their migration, `.car` mask added (2.4) | the Adjust row needs no horizontal scroll at 704; 12 knobs, three headings; a clip saved with `ad.fade` set still renders faded after a reload; on 357 the scroll is visibly cut |
| **S6** | Export's summary line (2.5) | the line reads from `resDims()` / `EXP` / the duration and changes when any of the three changes |
| **S7** | Settings sectioned, Storage separated (2.3) | three headings, `Clear` in its own section, still two-tap armed |

---

## 6. Verification

| | check |
|---|---|
| the void | at 704 in the split layout, and at 357 on the phone: the top void of Speed, Export, Settings, Adjust and Filters is **0**, down from 185 / 132 / 98 / 71 / 62 |
| the row | Settings and Export rows are 56px ±1, their in-row controls are ≥44px, and no `.sr` / `.xr` rule is left in the stylesheet |
| the sections | Settings has 3 headings, Export 1, Adjust 3; the first section in each sheet has none |
| the shelf | at 704 the Adjust row's `scrollWidth` ≤ `clientWidth` and it has 12 children; `ADJ.fade` is gone from the shelf while `F.fade` still renders; a clip with `ad.fade` set round-trips through save/load and still renders faded, measured against its pre-merge picture within the stated tolerance |
| the icons | every `#tools` button and every `.rw .ri` resolves to a non-empty glyph that is not `undefined`; the number of `ICON` entries ≥ 55; `ctr`, `vig`, `blue` and `opacity` contain no `fill="currentColor"` except the stated grain exception |
| the footer | every sheet has exactly two `.ef` pills; Reset exists in the title row for the nine tools that have a default |
| Export's summary | the line contains the pixel size from `resDims()`, the fps from `EXP.fps` and the name from `EXPFMT`; setting `EXP.res` 1080 → 480 changes the pixels **1920 × 1080 → 854 × 480** on a 16:9 project and **608 × 1080 → 270 × 480** on 9:16; the estimate changes with the duration and does *not* change with `EXP.res`, which is asserted rather than assumed so the constant bitrate stays a known fact |
| the phone | 393×844 with all eleven tools: the sheet's own rows are unchanged in height, the body still scrolls rather than clips, and every existing row in [`selfcheck.html`](selfcheck.html) still holds — 26 controls, 4 shelf rows, 4 sheet-layout, 7 panel, 8 iPad-layout, 7 persistence, 6 pointer, plus whatever S3 adds |
| the pair | `IPAD-LAYOUT-PLAN.md` §7.1's bound (R6b) is applied **after** S1, and the sheet at 322px with each of the eleven tools has a top void of 0 |
| build | `npm run build` clean; no new console errors beyond the known dev-only `sw.js` 404 |

---

## 7. Out of scope

- **A sheet that remembers its scroll position per tool.** Real, small, unrelated.
- **Reordering the sheets into a hierarchy** (a Settings entry that opens Export's
  settings, and so on). The three sheets are peers and should stay peers.
- **Animating the sections in.** Every sheet is one paint today; view transitions
  already have an owner in `IPAD-LAYOUT-PLAN.md` R11.
- **Re-drawing the *timeline* icons.** The rail's vocabulary is a separate set with
  its own study; this plan only fixes the four shelf marks that collide with the
  selection ring and fills the eight rows that have nothing.
