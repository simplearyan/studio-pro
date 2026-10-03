# iPad — a side-by-side studio layout, on a toggle

A plan for [`clip-lite-mock.html`](clip-lite-mock.html): on a large screen, put the
preview and the timeline **side by side** instead of stacked, let the header stop
behaving like a phone header, and give the property sheet the width the split
frees up. One icon in the header, hidden on phones.

Inspiration is `video-editor (13).html`, a later iteration of this same prototype
(same CSS variables, same `#panel`/`.tlw`/`.tools` structure) that already
implements exactly this. It was measured, not guessed at — see §1 — and most of
this plan is a port of its mechanism plus the four things it gets wrong or leaves
out for our file.

**This is a plan, not an implementation.** Nothing here is built. The mock is at
`ecc11dd` plus the uncommitted Sharpen work.

> Every "before" number in §2 and every "after" number in §1 was measured by
> running the real page at that viewport with the real test clip, not derived on
> paper. Where a number *is* arithmetic rather than measurement it says so.

---

## 1. What the reference does

Not a description of the picture — the mechanism, because the mechanism is what
we can copy.

**A grid on `body` with named areas, and a dock that stops being a box.**

```css
body{display:grid;grid-template-columns:minmax(0,1fr);
     grid-template-areas:"bar" "view" "panel" "ar" "tc" "tlw" "tools"}
.dock{display:contents}          /* the dock's children join the body grid */
```

`.dock` is a `display:flex` column today. In the reference it becomes
`display:contents`, so `.ar`, `.tlw` and `.tools` are laid out by the *body*
grid and can be placed in different columns. That one line is what makes every
other rule possible.

**Four states on one attribute**, with the preview's position as the only
variable:

| `body[data-layout]` | columns | areas |
|---|---|---|
| *(unset)* / `top` | `1fr` | `bar · view · panel · ar · tc · tlw · tools` — what we ship now |
| `left` | `var(--pw) 12px 1fr` | `bar bar bar` / `view split tc` / `view split tlw` / `view split ed` / `pb split tools` |
| `right` | `1fr 12px var(--pw)` | the mirror |
| `full` | `1fr` | `bar · view · pb` — everything else `display:none` |

**Measured at 1194×834** (iPad Pro 11" landscape), reference file, `left`,
`--pw:40%`:

| | value |
|---|---|
| grid columns | `477.6px 12px 704.4px` |
| header | **56px**, one row |
| preview area | **478×710** |
| timeline column | 704 wide, `.tlw` `max-height:none` inside a `minmax(0,1fr)` row |
| lanes present | film 64 + audio 50 = 114 |

**The toggle is a header icon.** `<button class="ib" id="lay">` with four
hand-drawn glyphs (`layL` / `layT` / `layR` / `layF` — a rectangle with a
divided edge, the divider moving), cycled by click or the `p` key, with
`shift+P` jumping straight to `full`. It is hidden below 600px. The icon changes
to show the state you would get *if you tapped again*, so the control is
readable without a label.

**The auto rule** is one line and worth stealing verbatim:

```js
const eff=()=>{const w=innerWidth,h=innerHeight;
  if(w<600)return'top';
  return (w>=900&&w>h)||(w>h&&h<500) ? 'left' : 'top'}
```

Landscape **and** at least 900 wide gets the split; a phone never does; a
landscape phone (short and wide) does. `addEventListener('resize',applyLayout)`
means rotating an iPad re-decides — verified: 1194×834 reports `left`, 834×1194
reports `top`.

**The divider is real.** `#split` is a 12px grid column with
`role="separator"`, `aria-orientation="vertical"`, `tabindex=0`,
`cursor:col-resize`, pointer capture on drag, arrow-key nudging at 2% per press,
double-click to reset to 40%, and `--pw` clamped to **0.28–0.6**. The width is
persisted. The important part is the clamp: the reference does not decide for you
whether the picture or the timeline matters more, it gives you a handle and a
range.

**Four more things it does that we do not:**

- **The panel becomes a popover** in side mode: `position:fixed`,
  `width:min(420px,46vw)`, anchored bottom-right, `border-radius:20px`, a
  shadow, and the dock is *not* hidden.
- **The transport leaves `.ar`.** `.ar` is `display:contents` in side mode and
  the play controls move to their own `pb` area on the tools row, so the column
  gets its vertical pixels back.
- **The tool labels are conditional on the column, not the viewport**:
  `display:none` on the `<span>`, restored at `min-width:1180px`, with the
  buttons dropping to `min-width:52px`.
- **`@media(pointer:coarse){#zo,#zi{display:none}}`** — an iPad has no hover and
  no scroll wheel, so the zoom steppers are noise there.

Two things it gets wrong that we should not copy:

- **The lane stack leaves the column half empty.** `.tlw` is the `1fr` row but
  `.tl` is `flex:0 1 auto`, so 114px of lanes sit at the top of a ~570px row.
- **`--pw` is a percentage of the whole viewport**, so on a notched iPad the
  divider lands under the inset.

---

## 2. What we have today

Measured on our mock, `9:16` clip (the 20s portrait test clip), at three real
iPad viewports:

| viewport | device | header | preview area | video shown | dead space each side | video as % of screen | dock as % of height | timeline |
|---|---|---|---|---|---|---|---|---|
| 1194×834 | Pro 11" landscape | **116** | 1194×450 | **253×450** | **471** | **11.4%** | 43.6% | 960×223 |
| 1366×1024 | Pro 12.9" landscape | **116** | 1366×553 | **311×553** | **528** | **12.3%** | 44.0% | 960×310 |
| 834×1194 | Pro 11" portrait | 116 | 834×645 | 363×645 | 236 | 23.5% | 46.0% | 834×408 |

**On a large iPad in landscape, the video is 11% of the screen.** That is the
whole complaint, and it has three separate causes:

**(a) The stage is full-width and the picture is not.** A 9:16 canvas in a
1194-wide stage is 253 wide, so 471px on each side is background. The stage is
`flex:1` across the full width, and nothing about the layout says the picture
should be given the width instead of the timeline.

**(b) The header is a phone header at 116px.** `GUT_RATIO` is a test on the
*project's* aspect (`9:16 ≤ 9/16` → gutter), so a portrait clip on a 1194px iPad
gets the phone's treatment: `body.gut .bar{height:auto}` with the export/more
buttons stacked in a column (`flex-direction:column;gap:14px`). 56px of header
becomes 116. The fix from the header-icon bug was correct for what it was
measuring — a phone in portrait — but it keys on the wrong thing: the gutter is a
decision about **how much room is left over**, not about the shape of the video.
On a landscape iPad there is 471px of slack; there is nothing to reserve.

**(c) The dock is capped and centred.** `@media(min-width:900px){.dock{width:min(960px,100%);margin:0 auto}}`
means the timeline is 960 wide on a 1194 screen — 234px handed to nobody — while
the *vertical* budget it fights for is what the preview is losing.

The arithmetic if the split lands: at 1194×834 with `--pw:40%` the preview
column is 478 wide and ~700 tall, so a 9:16 canvas renders at **≈394×700**
(derived from the measured column, not measured on a loaded clip) against today's
253×450 — **2.5× the picture, 11.4% → ~27% of the screen**. The timeline column
is 704 wide instead of 960, which is a real loss and is why the divider needs to
be draggable rather than fixed (§4.4).

---

## 3. The shape of the change

One attribute, four states, ported from the reference. Then the five places our
file has to change shape, which is where all the risk is.

- **R1** `body[data-layout]` ∈ {`top`, `left`, `right`, `full`}, with `.dock`
  becoming `display:contents` in the side states only.
- **R2** A header icon `#lay` cycling the four states, hidden below 600px.
- **R3** A Settings row so the state is discoverable and readable in words. The
  header icon alone is a mystery on first run; the reference has no Settings and
  we do, so we can do better than the reference here.
- **R4** `fitView()` learns a second branch for the column (§5).
- **R5** The gutter stops keying on the project ratio (§6).
- **R6** The sheet moves into the timeline column instead of hiding the dock (§7).
- **R7** The tool row adapts to the *column* width, not the viewport, and gets a
  collapse affordance (§8).
- **R8** `--pw` clamped 0.28–0.6, draggable, persisted, keyboard-nudgeable.
- **R9** `env(safe-area-inset-*)` on the root, and `--pw` resolved against the
  inset box rather than the raw viewport.
- **R10** `pointer:coarse` drops `#zo`/`#zi`.
- **R11** `view-transition` on the two regions, guarded by
  `prefers-reduced-motion:reduce`.
- **R12** Keyboard: `p` cycles, `shift+P` toggles full.

### 3.1 The one decision that is yours — the default

The user asked for a toggle, so the safe default is `top`: nothing changes until
someone taps the icon. But "adaptive" implies it should just happen on an iPad.

| default | behaviour | cost |
|---|---|---|
| `top` (recommended to ship first) | today's layout everywhere until tapped | the iPad owner has to find the icon |
| `auto` = `(w>=900 && w>h) ? 'left' : 'top'` | an iPad in landscape gets the split on load | **also** flips every desktop browser ≥900 wide — including your 1370×836 screenshot |
| `auto` gated on `pointer:coarse` | iPads only | needs the coarse-pointer test, and a desktop touchscreen gets it too |

Recommendation: ship `top`, then flip the default to `auto` once the split has
survived a few days of real use. The toggle is the feature; the default is a
one-line change later.

---

## 4. The grid

### 4.1 Areas

```css
body[data-layout=top]{grid-template-rows:auto minmax(0,1fr) auto auto auto auto}
body[data-layout=left]{grid-template-columns:var(--pw) 12px minmax(0,1fr);
  grid-template-rows:auto auto minmax(0,1fr) auto auto;
  grid-template-areas:"bar bar bar" "view split ro" "view split tlw" "view split ed" "pb split tools"}
body[data-layout=right]{ /* mirror */ }
body[data-layout=full]{grid-template-areas:"bar" "view" "pb";}
```

Our rows are `.ar` (transport + delete/split/undo/redo), `.ro` (ruler strip +
timecode), `.tlw`, `.tools` — the reference splits `.ar` into `.ed` and `.pb`
because in side mode the transport wants to sit *beside* the tools rather than
above them. Same split here: `.ed` (the four edit buttons) becomes its own row in
the column, `.pb` (play + prev/next frame) joins the tools row.

### 4.2 The header is a different animal in each state

Ours is `position:absolute;inset:0 0 auto;z-index:7` — it floats over the
picture, which is deliberate and good on a phone (the sun and the export arrow
sit on the video). The reference's is a grid row.

**Keep the overlay in `top`; make it a row in the side states.** An absolutely
positioned grid child leaves the flow, so the header can overlay the preview
column in `top` and become `grid-area:bar` in `left`/`right`/`full` without
touching the phone. The cost is that in side mode the header no longer overlaps
the picture, so the preview loses 56px it has today — which the split more than
pays back (§2).

### 4.3 `#split`

Port the reference's: 12px column, separator role, `cursor:col-resize`, pointer
capture, arrow keys at 2%, double-click resets to 0.4, persisted in
`lite:pw`. Two changes:

- Clamp against the **inset box**, not `innerWidth`, so a notched iPad's 44px
  inset is not eaten by the picture.
- On `dblclick`, reset to 0.4 **and** re-run `fitView()` — the preview column
  width changed, so the ladder in §5 has to re-derive.

### 4.4 Do not hardcode 40%

704px of timeline instead of 960 is a real loss of scrub width. The reference's
answer is the right one: `--pw` is a handle, not a decision. Ship the clamp at
0.28–0.6 and let the person decide whether this cut is a talking head or a
timelapse.

---

## 5. `fitView()` — the actual work

This is the risk, and it should be done first, alone, behind the toggle.

Today, in the stacked layout:

```js
chrome = .ar + .ro + #tools + 4          // only measured while the dock is laid out
lanes  = laneFloor                        // ditto
want   = clamp(inner*d[1]/d[0] + pt + pb, floor, cap)   // the height this canvas would use at full width
avail  = body.clientHeight - chrome
band   = clamp(avail - want, lanes, lanes + BAND_AIR)
view   = avail - band
v.style.flex = '0 0 ' + view + 'px'
```

In a side layout two of those inputs mean something different:

- **`want` is wrong.** It is the height the canvas *would* use at full stage
  width; in a 478px column the canvas is width-limited and its height is
  `colW * d[1] / d[0]`. So the side branch is
  `want = min(want, colInner * d[1] / d[0])` — and for a 9:16 clip in a
  478-wide column that is the *binding* constraint, not the ceiling.
- **`avail` is the column, not the body.** `avail = view.clientHeight`, and
  `chrome` is 0 because the preview column is structurally independent of the
  dock. The whole `if(dock.offsetHeight)` guard and the `laneFloor`/`chrome`
  caching exist so that *opening a sheet does not resize the picture* — in side
  mode that property is free, because the sheet is in the other column. That is a
  genuine simplification, and it is the strongest argument for the split beyond
  the pixels.

Rules for the branch:

- The stacked ladder must not change by a pixel. It is a documented derivation
  (`CHROME-DECLUTTER-PLAN.md` §20, the C2 ladder) and a silent 1px drift there
  is exactly the regression we do not want while adding a second path.
- The branch is selected on `body.dataset.layout`, not on width, so the
  `eff()` rule and the ladder can never disagree about which layout is live.
- `fitView()` is called from `refresh()`, `panel()`, and the resize path, so the
  branch must be safe when the dock is hidden (§7 changes when it is hidden).
- Measure, don't eyeball: the `top` layout must still report 450/553/645px of
  preview at the three viewports in §2, and `left` must report the column
  heights the grid actually produced.

---

## 6. The gutter stops keying on the project

```js
// today
document.body.classList.toggle('gut', AR[proj.ar][0]/AR[proj.ar][1] <= GUT_RATIO);
// proposed
const phoneStage = v.clientWidth < 600;      // the stage, not the project
document.body.classList.toggle('gut', AR[proj.ar][0]/AR[proj.ar][1] <= GUT_RATIO && phoneStage);
```

A portrait project on a phone still gets the gutter and the 116px header; a
portrait project on a 1194px iPad gets the flat 56px header and the full stage
width. `fitView()` reads the class *before* measuring anything (that ordering is
load-bearing and documented), so the `phoneStage` read has to happen in the same
place, after the class toggle.

Header height goes 116 → 56 at every iPad size, and that is 60px of picture back
before the split is even considered.

---

## 7. The sheet moves into the column

`body.es .dock{display:none}` — opening any sheet today hides the timeline, which
is correct when the sheet *is* the bottom half of the screen and absurd in side
mode, where it would leave the whole right column empty.

In the side states:

- The dock stays. Only the tools row hides while a sheet is open.
- **The panel docks to the bottom of the timeline column, at that column's width**,
  rather than floating as a 420px popover. The width that matters is a function
  of the divider, because `--pw` sizes the *preview* and the timeline column is
  what is left:

  | `--pw` at 1194 wide | timeline column | Adjust shelf (614px) | Filters shelf (870px) |
  |---|---|---|---|
  | 0.28 | 848px | fits | scrolls by 22px |
  | 0.40 (default) | 704px | fits | scrolls |
  | 0.60 | 466px | scrolls | scrolls |

  A 420px popover would scroll the Adjust row at *every* divider position, and
  scrolling it is the exact bug fixed in `ADJUST-FILTERS-TEXT-CLIP.md`. Following
  the column means one handle buys both the bigger picture and a roomier sheet —
  which is the "use the space" part of the request — and where the column is
  genuinely too narrow the row scrolls, which is what a 353px phone does today
  and is not a defect.
- `full` has no column, so entering `full` closes the sheet, and `Cancel`/`Done`
  return to the layout you came from.
- `.es` must no longer imply "the picture may not move" in side mode — with the
  panel inside the column, the preview column's height is untouched by
  construction. `fitView()`'s `chrome` cache stays as it is for `top`.

---

## 8. Tools

The dock's tools are the *width* argument for the whole change, so they have to
follow the column rather than the viewport.

- **Labels follow the column, not `@media(min-width:1180px)`.** The reference's
  viewport breakpoint is wrong for a column: at 1194 wide with `left`, the
  column is 704, and eight labelled tools at 76px is 608 — it fits, but only just,
  and at `--pw` 0.5 it does not. Measure: after `strip()`, if
  `#tools.scrollWidth > #tools.clientWidth`, drop the labels
  (`body[data-layout] .tools button span{display:none}`, `min-width:52px`) and
  re-measure. That is the same "measure, don't breakpoint" rule the header-icon
  fix ended up with.
- **A collapse affordance.** Port `.tcol` + `body.tmin`: a chevron at the end of
  the row that hides every tool button, so the column can be all timeline. The
  chevron rotates 180° when collapsed, and it is the one control that must stay
  visible in `tmin`.
- **The transport moves to the tools row** (§4.1), so the column gives up one
  row. `#play` is already 56px; the row is 68px, so they share it.
- **`pointer:coarse` hides `#zo`/`#zi`.** An iPad has no wheel; `Fit` and the
  `Settings` zoom row are the way in. This is the reference's rule and it is
  correct for the device.
- **The vertical divider is not needed in the tools row** — the `.vd` element
  that separates `Format` from the rest is meaningless when the labels are off.
  Hide it in the icon-only state, as the reference's `tmin` rule does.

---

## 9. The timeline in a 704px column

- **`Fit` is already correct.** `fitZoom()` derives `pps` from
  `tl.clientWidth`, so `Fit` re-derives itself when the column narrows. At
  `pps=60` the column shows 11.7s instead of 16s — which is another reason the
  open item "default to `Fit`" should be closed before or with this.
- **The ruler survives.** Label spacing is `max(LABEL_PX, W/LABELS)` =
  `max(56, 704/7)` = 100px, so 7 labels across the column, comfortably above the
  56px floor. The 10–90px playhead mask is unchanged.
- **What to do with the ~450px of empty column below two lanes.** The reference
  leaves it. Recommendation: **leave it for the preview**, i.e. the lanes stay
  content-sized (`flex:0 1 auto`) exactly as the reference has them, and the
  slack is the picture getting taller. The alternative — stretching the lanes to
  fill — would give a 380px-tall film lane for a 20-second clip, which is not
  more legible, only bigger. If a third lane (freeze frames, or a second audio
  track) ever ships, the room is already there.
- **Waveform and filmstrip both key off `pps`**, so the narrower column is a
  pure zoom change and needs no code.

---

## 10. Safe areas, and the two iPad details nobody remembers

- **`env(safe-area-inset-*)` on the root.** We have `100dvh` but no insets; the
  reference has all four. A landscape iPad with a notch puts 44px under the
  export button. Cheap, and it is the difference between "works on iPad" and
  "works on my iPad".
- **Rotation re-decides the layout** via the existing resize path, and the
  `ResizeObserver` on `#tl` already re-renders the timeline when the column
  changes width. The `top` layout must come back cleanly.

---

## 11. Risks

| | risk | mitigation |
|---|---|---|
| 1 | **`fitView()` drifts.** Two ladders means two sets of numbers, and the stacked one is load-bearing for four verified viewport sizes. | Build R4 first, alone, behind the toggle, and re-measure the three viewports in §2 byte-for-byte before touching anything else. |
| 2 | **The sheet empties the column** (`body.es .dock{display:none}`). | R6 ships in the same commit as the grid, not later. |
| 3 | **The 8-knob shelf outgrows a popover.** | Panel is column-width, not `min(420px,46vw)`. Checked at `--pw` 0.28 (column 848), 0.40 (704) and 0.60 (466). |
| 4 | **The header overlay fights the grid row.** | Overlay only in `top`; the states are mutually exclusive by attribute. |
| 5 | **The divider lands under a notch.** | R9 before R8, and clamp against the inset box. |
| 6 | **A layout that only works in one browser.** | The reference's whole mechanism is plain CSS grid + `grid-template-areas`. No `:has()`, no container queries, no `dvh` requirement (we already have the `@supports` pattern if needed). |
| 7 | **Zoom in a narrower column feels broken** if `Fit` isn't the default. | Close the "default to Fit" item in the same pass. |

---

## 12. Build order

Each step is independently verifiable and leaves the app working.

| | step | done when |
|---|---|---|
| R1 | `.dock{display:contents}` + the `top` area map, no behaviour change | 393×844 and 462×836 are pixel-identical |
| R2 | `body[data-layout]` with `left`/`right`, no toggle yet — forced by a constant | the three §2 viewports report the §2 arithmetic picture sizes |
| R3 | `fitView()` side branch | `left` preview = the grid's own row height; `top` unchanged from §2 |
| R4 | the gutter's width test | header 116 → 56 at 1194×834, 1366×1024, 834×1194; phones unchanged |
| R5 | `#split` + `--pw` + persistence | drag, arrows, dblclick, and a reload all hold the width |
| R6 | sheet into the column; `dock` no longer hides in side states | Adjust and Filters open with the timeline still visible, and the panel is exactly the column's width |
| R7 | the `#lay` header icon + `p` / `shift+P` | cycles 4 states, hidden below 600px |
| R8 | the Settings row | state readable in words, and it writes the same key the icon does |
| R9 | tool labels from a measurement, `.tcol`/`tmin`, transport on the tools row | no horizontal scroll in the tools row at any `--pw` |
| R10 | safe-area insets | landscape notch: no control under the inset, at 1194×834 and 1366×1024 |
| R11 | `pointer:coarse` zoom rules | the steppers are gone on a touch device, `Fit` remains |
| R12 | view transitions, guarded | the switch animates; `prefers-reduced-motion` kills it |
| R13 | flip the default to `auto` (§3.1) — **separate decision, separate commit** | — |

---

## 13. Verification

Every row is a measurement, not a look.

| | check |
|---|---|
| `top` unchanged | 320×700, 347×770, 352×780, 357×836, 366×836, 378×770, 387×836, 393×852, 462×836, 834×1194, 1194×834, 1366×1024, 1280×800 — preview height, canvas rect, `scrollHeight === clientHeight` identical to `ecc11dd` |
| `left` / `right` | the same 13 viewports plus 1024×768, 1080×810, 1133×744, 1194×834, 1366×1024 — no overflow anywhere, `document.body.scrollWidth === innerWidth` |
| the win | video area at 1194×834 in `left` is **≥2.2×** the `top` figure, and video-as-%-of-screen goes from 11.4% to ≥25% |
| header | 56px at every viewport ≥600 in every state |
| the divider | `--pw` 0.28 / 0.4 / 0.6 at 1194×834 and 1366×1024; survives reload; arrow keys move it 2% |
| the sheet | the panel's width equals the timeline column's at every `--pw`; Adjust's eight knobs need no horizontal scroll at `--pw` 0.28 and 0.40 and do scroll at 0.60, which is the phone's behaviour and not a defect; the timeline is still on screen behind the sheet |
| tools | no horizontal scroll in `#tools` at any `--pw`, labels on or off as measured |
| rotation | 1194×834 → 834×1194 → 1194×834 returns to `left` with the picture and timeline intact |
| touch | `pointer:coarse` emulation: zoom steppers hidden, every target ≥44px, nothing overlapping |
| themes | dark and light at 1194×834 in all four states |
| build | `npm run build` clean; no new console errors beyond the known dev-only `sw.js` 404 |

---

## 14. Out of scope

- **A free-floating playhead.** The reference has a `free` mode
  (`body.free` + a drag-to-seek head) which is genuinely better on a wide
  timeline. It is a separate change, it alters the documented
  `tl.scrollLeft = t*pps` convention, and it is not needed for the split.
- **A vertical divider**, for lane height versus picture height. The split is
  horizontal; the reference's is too.
- **The freeze-frame tool** the reference has and we do not.
- **Persisting the project to IndexedDB**, which the reference also does. Worth
  having; unrelated to layout.
- **Making `top` the only phone layout forever.** If the split works it may deserve
  a phone presentation too (a landscape phone hits `(w>h && h<500)` in the
  reference's rule). Not now.
