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
the reference's.

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
| Shell | no console errors; `scrollHeight === clientHeight` at 378×836; `npm run build` clean |

The known dev-only service-worker 404 and the `willReadFrequently` warning from
the pixel probe are not app errors.

**Not committed.** The tree is dirty at `ec6fa66` with
[`clip-lite-mock.html`](clip-lite-mock.html), the reserved-gutter fix from the
header-icon bug, and this file.
