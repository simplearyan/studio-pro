# Adjust, Filters, and the caption timeline

Three additions to [`clip-lite-mock.html`](clip-lite-mock.html), all read off three
screenshots of YouTube Create on a phone: the **Adjust** shelf, the **Filters**
shelf, and what a selected caption looks like on the timeline.

Everything here is live-applied. The sheets are a view onto the clip, not a form
you submit — the player repaints while a thumb is still down, because the render
loop reads the same value the sheet is writing. That is the same rule the
existing property sheets already follow, and it is the reason these three needed
no commit step of their own.

---

## 1. Adjust — a shelf of knobs, not a form of fields

The reference puts four round buttons under the player — Brightness, Contrast,
Highlights, Shadows — with the chosen one ringed, its name under it, and one
slider below for whichever is lit. We ship **eight**, adding Saturation, Warmth,
Sharpen and Fade.

**The row is the control.** A slider with no choice of what it adjusts is one
control pretending to be eight. The row scrolls horizontally rather than
wrapping, so a ninth knob costs width and not a row of the dock's height — and
the dock has no slack to give (`[TIMELINE-SPACE-PLAN.md](TIMELINE-SPACE-PLAN.md)`
established that the band is already full).

Knob selection is module state, not clip state: it is a property of the sheet
you are looking at. Open Adjust on clip A, turn Highlights, Done, open it on
clip B — Highlights is waiting, not Brightness. Each knob keeps its own value on
the clip (`c.ad = {bright, ctr, high, shad, sat, warm, sharp, fade}`), and all
eight compose.

**Honest limits.** Highlights and Shadows cannot be done truthfully in CSS. A
real implementation masks by luminance. What ships here is a brightness paired
with an opposite contrast move, which reads the same way on a face and costs no
per-pixel pass. Worth knowing before anyone treats those two as equivalent to
the reference's. Sharpen used to be in the same category and no longer is — see
§4.

**Eight, and not twelve.** Exposure and Tint are the two obvious next knobs and
both were measured against `ctx.filter` before being declined:

- **Exposure** is the same axis as Brightness. `ctx.filter` has `brightness`, not
  an exposure stop, so a second knob would be a second name for the first
  slider.
- **Tint** cannot be an *independent* knob at all. Green↔magenta is only
  reachable by rotating the hue wheel, and `hue-rotate` composes by addition —
  a chain of two of them is one rotation of the sum. Warmth and Tint side by side
  would be one knob wearing two labels: push both to maximum and you have asked
  for 76° once, and pulling one back does not restore the other. A tint that is
  genuinely a different axis needs a per-pixel colour matrix.

The row is the control, and a control you have to hunt through is worse than a
smaller one. Vignette and Grain are the candidates that *would* be honest, but
they are looks rather than values, so they belong on the filter shelf where each
card already previews itself on a real frame.

**The glyphs have a rule now: no two knobs share a geometric family.** Highlights
shipped for a week as a smaller sun — Brightness's icon, one size down — and the
sunrise that replaced it was still a sun at 22px, which is the only size these are
ever drawn at. So each family is used exactly once: sun, half disc, **chevrons**,
crescent, drop, thermometer, sparkle, stacked lines. Chevrons are the only
angular glyph in the set, and every other knob is a curve.

---

## 2. Filters — eleven looks, each previewed on the real frame

The reference's shelf is a row of square cards, each showing a thumbnail of
**your** clip with that filter already on it, plus a `None` card carrying a
crossed disc. Adopted as-is, and extended from six looks to **eleven**.

**Filters are generators, not strings.** The reference has a strength slider and
so do we, and a fixed CSS string cannot be dialled. Each filter is a function of
`k`, written so that **`k = 0` is a provable no-op** — every multiplier lands on
`1` — and `k = 1` is the full look:

```js
moody:{n:'Moody',f:k=>`contrast(${1+k*.42}) saturate(${1-k*.44}) brightness(${1-k*.1})`}
```

That is what makes the slider honest. Dragging strength to zero is the *same as
having no filter*, not a weak version of one. Verified: at `fs=0` the emitted
chain is `contrast(1) saturate(1) brightness(1)`.

The card thumbnail is the frame under the playhead (`thumbAt()`), carrying that
filter's own CSS — so the eleven cards are eleven genuinely different pictures
of the same moment, which is the only way to choose a look. `None` is the
crossed disc rather than an unfiltered thumbnail, because an unfiltered card
next to seven filtered ones reads as *"there is no filter"*, not as *"this is the
filter you are on"*.

### The bug this found, and why it is written down

The first cut had two functions, `fStr(c)` and `adjStr(c)`, concatenated as
`fStr(c)+adjStr(c)`. The no-filter case makes `fStr()` return the literal string
`none`, so an adjustment on a clip with no filter produced:

```
nonebrightness(1.45) contrast(1.63) saturate(1.765)
```

which is not a filter chain at all. **Canvas drops an unparseable `ctx.filter`
declaration silently**, so every adjustment did *nothing* — while looking
perfectly functional, because the value readout updated on every input event and
the readout is the only part of the sheet you can see.

It was caught by reading a pixel of the canvas, not by looking at the sheet.
`look(c)` now collects the parts, joins them with a space, and returns `none`
only when the list is empty — nothing interpolates a bare keyword any more.

> The general lesson: **a control whose only visible output is a number needs a
> pixel test.** A slider that cannot affect the render is indistinguishable from
> one that can, right up until someone looks at the actual picture.

---

## 3. Captions — select, drag, and know how long it is

The reference's third screenshot is a selected caption with an orange outline,
a `00:03` badge on its lower-left corner, and the playhead sitting right beside
its leading edge.

**Duration on the block.** A caption's length is the one number you cannot see by
looking at it — the block's *width* is the length, and width is exactly what you
are dragging. So it is written on the block, in the app's own `mm:ss` timecode
(`fmtT`, not `fmtS`) so the badge, the sheet and the transport readout all read
`00:03` rather than mixing `0:03` into the one place a caption's own numbers
live. The badge is rewritten **during** the drag, not just when it settles — a
length that changes under your thumb but not on screen is worse than no badge.

**The caption sheet repeats it** (`Shows 00:00 – 00:03 · 3.0s`) for when the
sheet has covered the timeline. It is written in both places that can show it,
because the sheet is built *before* `renderTL()` next runs and filling it only
from the timeline leaves it blank on first open.

**Drag to move the start, with the playhead as the guide.** Moving a caption was
already possible; what was missing was the *guidance*. The tooltip now reports
the offset from the playhead rather than an absolute clock time, because "line
this caption up with that word" is an offset, not a timestamp:

```
+0.5s from playhead · 3.0s long
At playhead · 3.0s long
```

Snapping to the playhead was already in `snapV()`; it is now visible rather than
mysterious. Verified: `snapV` probed at `t ± 0.05` returns exactly `t` both ways.

---

## Shared: "Apply to all"

Both shelves end in `Cancel · Apply to all · Done` instead of the usual
`Cancel · Reset · Done`. Matching a grade across a multi-clip timeline by hand
means opening the sheet once per clip, which is the reason the reference has the
button and the reason we do.

It copies the filter, the strength **and** the adjust object to every other clip.
The source clip is skipped and the object is spread, never aliased — a shared
`c.ad` would make the next drag on one clip move all of them. It refuses on a
single clip (`Only one clip to apply to`) rather than silently succeeding.

---

## 4. Sharpen is now actually sharpening

`sharp:{f:null}` is the entry: it is the one adjustment in the row with no filter
chain, because an unsharp mask is `out = A + k·(A − blur(A))` and **no CSS filter
can express a difference at all**. The frame is graded onto one surface, a blurred
copy goes on another, and a per-pixel loop is the entire operator.

It shipped for a week as `contrast(1.5) saturate(1.3)`, which is a tonal curve
wearing the name of a spatial effect. It reads as "crisper" on a smooth frame and
does nothing whatsoever to an edge — the only reason it survived is that the
readout moved, which is the same failure this file already documents for the
`nonebrightness()` bug: **a control whose only visible output is a number needs a
pixel test.**

**The canvas-native version was tried first and measured worse than doing
nothing.** Canvas can only difference images as an *absolute* value, so the cheap
route is `A + k·|A − B|` composited with `'lighter'`, and it does sharpen the
full-resolution frame (+9% edge slope on synthetic steps). But the preview is 720px
of canvas shown in **253px**, so the browser averages it — and averaging cancels
an unsigned boost. Measured as *displayed*, that same setting scored **−5%
acutance**: the control was making the picture softer. A signed mask survives the
averaging because the boost and the cut sit on opposite sides of the edge and stay
opposite after a box blur. This is the pixel-probe lesson one level up — a number
on the canvas is not the number the user is looking at.

Constants are measured, not chosen. Sweeping radius against amount on synthetic
1px/2px/3px step edges, acutance climbs to a peak and then *falls back* as the
overshoot starts eating the transition it was meant to steepen — so the
strongest-looking setting is the weakest one. **2px and 0.8** sit on that peak.

| | full canvas | as displayed (253px) |
|---|---|---|
| `sharp +1` | +41% | +14% |
| `sharp −1` | −29% | −27% |

The radius is a constant and the knob is the multiplier: a radius that grows with
the value changes *what* is sharpened (fine grain at one end, edges at the other)
as well as how much, so the slider would stop meaning one thing. A mask has only
one sign, so the negative end is a real `blur()` — soften is what the other end
of the same axis means.

Cost is two readbacks and one write of the picture's bounding box per frame, paid
only while the knob is off zero, with both scratch surfaces `willReadFrequently`
so the pixels stay on the CPU. The readbacks are cached on (frame time, grade,
geometry), so dragging the slider on a paused frame costs only the ~6ms loop
rather than the blur and the two transfers. Export goes through `captureStream` on
this same canvas, so the mask is in the recorded file.

---

## Two bugs these shelves shipped with

**Selecting a knob scrolled the row away from it.** The row was rebuilt from a
string on every selection change — the slider underneath belongs to whichever
knob is lit, so the code called `panel()`. A rebuilt row starts at
`scrollLeft 0`, so a knob you had scrolled out to and tapped jumped back off the
left edge while remaining the selected one, with the slider now sitting under a
different name than the one you were holding. Selection writes in place instead
(`adjSync`): the ring, the label weight, the value and the readout all go onto
nodes that already exist, so the row is not touched. The rebuild path cannot go
away — picking a filter has to add and remove the strength slider — so `panel()`
now carries the scroll offset across the rebuild, and re-centres the selection
only when it is not already visible. Re-centring unconditionally would be the
same jump in the other direction: every tap on a visible knob would yank the row.

**Filters and Adjust had the same icon.** Both were two rails with a travelling
dot, differing only in where the dots sat. That is not a distinction anyone can
make at 22px, two buttons apart in the dock — and it is the difference between
the shelf of eleven looks and the shelf of eight values. They are now different
shapes: a filter is the one control in the app that narrows a set down to one, so
it is a funnel; an adjustment is a value you move, so it is a mixer — three
rails, a taller silhouette than the funnel beside it. Neither metaphor is
borrowed from the other, and neither appears anywhere else in the map.

**Highlights was a smaller sun.** Brightness is a sun; Highlights was the same
eight rays around a smaller disc, one size down — the same picture twice in one
row. It is a light *source* now: a dome rising off a horizon, a different
silhouette (flat base, no full disc) that pairs with the crescent below it as the
light-from-above / light-from-below pair the two knobs actually are.

---

## Verified

| | |
|---|---|
| Adjust | 8 knobs, per-knob values retained, all compose; footer `Cancel / Apply to all / Done` |
| Filters | 11 cards, 10 carrying real frames, each pre-filtered with its own chain; strength `0%` is a no-op, `100%` is the full look |
| Apply to all | 2 clips → both `{bright, warm}` + `moody@0.6`; objects cloned, not aliased |
| Adjust is real | centre pixel `[255,209,167]` → `[255,255,217]` at `bright +0.6`, `[178,146,119]` at `−0.6` |
| Caption move | drag `+0.5s` steps the start and the tooltip together; snaps to the playhead |
| Caption trim | left and right handles move start and duration; badge live at every step |
| Cancel / Done / undo | Cancel reverts the sheet; Done commits; undo restores; redo repopulates |
| Row keeps its place | at 393×844 the row sits at `scrollLeft 261` with Warmth selected, taps Sharpen at the same 261, re-taps the visible knob without moving it, and re-centres only an off-screen pick (Fade picked at 0 → 261) |
| Sharpen is a mask, not a curve | acutance +41% at full res, +14% as displayed, −27% at `−1`; flat field beside the edge is bit-identical at every amount; `sharp 0` is 0 differing bytes against no knob at all, including with a grade and a 90° rotation |
| Sharpen leaves no outline | 9:16 clip in a 16:9 project: the backdrop outside the picture is unchanged and the edge pixels are the frame's own, not a bright rim |
| Icons | Filters and Adjust are a funnel and a three-rail mixer, checked side by side in both themes at 393×844 and 357×836; the eight knob glyphs use eight different geometric families — sun, half disc, chevrons, crescent, drop, thermometer, sparkle, stacked lines |
| Values still reach the pixels | centre 80×80 sample sums 931917 at Sharpen +0.24, 766885 at +0.90, 931917 on the way back |
| Shell | no console errors; `scrollHeight === clientHeight` at 378×836; `npm run build` clean |

The known dev-only service-worker 404 and the `willReadFrequently` warning from
the pixel probe are not app errors.
