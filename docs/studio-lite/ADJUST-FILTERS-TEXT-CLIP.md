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

## 2. Filters — eleven chains and two layers, each previewed on the real frame

The reference's shelf is a row of square cards, each showing a thumbnail of
**your** clip with that filter already on it, plus a `None` card carrying a
crossed disc. Adopted as-is, and extended from six looks to **thirteen**.

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
filter's own CSS — so the thirteen cards are thirteen genuinely different pictures
of the same moment, which is the only way to choose a look. `None` is the
crossed disc rather than an unfiltered thumbnail, because an unfiltered card
next to twelve filtered ones reads as *"there is no filter"*, not as *"this is the
filter you are on"*.

### Two kinds of card, because `post` was doing two jobs

Eleven of the thirteen cards are **chains**: exactly one can be on, at one
strength. The other two are **layers**: both can be on, each with its own
strength, and both sit on top of whichever chain is picked. So `post` is a
*kind*, not an identity, and the clip needs two numbers that are not `f`/`fs`:

```js
vig:{n:'Vignette',f:null,post:'vig'},      // a layer — clip.vig,  0…1
grain:{n:'Grain',f:null,post:'grain'},    // a layer — clip.grain, 0…1
```

Vignette and Grain used to be chains like the rest, competing for `c.f` — which
meant tapping Grain deleted Vivid and then deleted itself, and there was no
arrangement of the two you could want. The obvious alternative, making them
Adjust knobs, was rejected: Adjust's slider is bipolar `−1…1`, and neither of
these has an honest negative end. `−1` vignette is not a weaker vignette, it is
an inverted one. They are looks, and a look's job is to be picked, so they stay
on the Filters shelf.

**One slider for three strengths** is the honest compromise, and it needs a
rule about which strength the slider is editing. The rule is, in order: the layer
you last tapped, if that layer is on; then any layer that is on; then the layer
you last tapped even at zero, so tapping a card arms its slider; then the chain.

```js
const lay=lays.includes(postKey)?postKey:null,
  active=(lay&&(c[F[lay].post]||0)>0?lay:null)||lays.find(k=>(c[F[k].post]||0)>0),
  sliderOn=active||lay||(c.f!=='none'?c.f:null);
sliderKey=sliderOn;
```

Two earlier versions of that rule were wrong in ways worth recording, because
both produced a sheet whose slider and readout disagreed. Reading `postKey`
alone let a chain card win over a layer that was up, and tapping `None` left the
slider holding `c.fs` — a strength for a look that is not there, so the only
visible control on the sheet was adjusting something invisible. Scanning `F`'s
order instead is not enough either: with both layers up, Vignette comes first, so
tapping Grain moved nothing.

`sliderKey` is written by `panel()` and read by the input handler, rather than
both deriving the answer. When each side decided for itself they disagreed: the
sheet bound the thumb to the vignette while the handler wrote `c.fs`.

### Three lit cards need a sentence

Three effects can be on at once — a chain look and both layers — and to someone
who tapped them by accident, three lit cards over a single slider read the same
as one lit card until you parse it. So when more than one effect is up, the sheet
says so in words and offers one tap out:

```
2 effects together — Vivid + Vignette          [ Clear all ]
```

The line is built from the same three fields the renderer reads (`c.f`, `c.vig`,
`c.grain`), so it cannot claim a stack the picture does not have. It is rewritten
by the input handler on every drag, not only when the sheet opens, because
dragging a layer down to zero is the moment the count changes — a summary written
once at open would still say "2 effects" after you had dialled one away. `Clear
all` arrives with the second effect and not the first: one is a choice, two is the
accident this exists for. It clears the look and both layers together, and Cancel
still restores the pre-sheet state, so it is not a point of no return.

`#sk` is always in the sheet's markup and hidden with the `hidden` attribute
until the second effect, rather than injected on demand — inserting it mid-drag
would move the slider under the thumb. Because `.stack` sets `display:flex`,
which would beat the UA `[hidden]` rule, there is an explicit
`.stack[hidden]{display:none}`.

Measured through the UI: Vivid alone leaves the line hidden; Vivid + Vignette
reads "2 effects together — Vivid + Vignette"; adding Grain gives "3 … Vivid +
Vignette + Grain"; dragging Grain back to `0` rewrites it to 2 and drops `grain`
from the clip; tapping `Clear all` empties the clip (`f:'none'`, `vig:0`,
`grain:0`) and hides the line again. With no look at all, Vignette + Grain reads
"2 effects together — Vignette + Grain". At 393 px the row is 336 px wide and the
page still does not scroll sideways.

### A card's CSS and a card's layers cannot share one attribute

A card shows the frame under the playhead with the effect drawn *on top of* it,
which is HTML, not CSS — `background-image` and `filter` cannot hold a second
element. So `cardStyle()` returns **two** things and they go in two places:

```js
return {css:`background-image:url(${thumbAt(c)});filter:${chain}`,layers:postLayers(c,P)};
```

Returning both as one string and quoting it into `style=` made the `<i>` markup
part of the attribute value, where only the last layer parsed — so with a
vignette and grain both up, **every one of the thirteen cards showed the grain
alone**. No error, no warning; the shelf simply lied about all twelve looks at
once.

The layers shown are the ones *currently on the clip*, which is why the eleven
chain cards look alike while a vignette is up. That similarity is the truth: they
all produce that same vignette on top. Hiding it would promise a Vivid clip with
the vignette still on.

> A second, dumber bug in the same edit: the fix dropped `cardStyle`'s closing
> `}`, so the following `const pct=…` merged into its body and every later
> `P` became a redeclaration. **After any edit that moves a brace in a minified
> script, re-run the syntax check — it catches this in one second and the
> browser only tells you at load.**

### Vignette and Grain — the two looks `ctx.filter` cannot spell

Eleven of the thirteen are filter chains. These two are not, and the reason is
worth stating because it is a hard limit rather than an oversight: the whole CSS
filter vocabulary is brightness, contrast, saturate, hue-rotate, blur, grayscale,
sepia, invert, opacity and drop-shadow. **None of them can reach the edge of a
picture or add a pixel that was not in it.** A vignette darkens corners; grain
lays noise over the frame. Neither is expressible, so both are drawn by
`postFx()` once the frame is already on the canvas — the same bargain Sharpen
makes, and for the same reason.

```js
function postFx(c){
  const kv=c.vig||0,kg=c.grain||0;
  if(kv<=0&&kg<=0)return;
  ...
}
```

Both run, in that order, every frame, and both read their strength from the clip
independently — which is the whole mechanism. **A vignette is a tone change and
grain is a texture change**, so the noise belongs on top of the darkened frame
rather than under it. Grain last also happens to be the only order that matches
what the cards show, since a card's layers composite with the noise on top.

The early-out is not a micro-optimisation, it is the no-op guarantee: at zero the
function returns before touching a pixel, which is why all thirteen controls can
still claim 0 differing bytes.

**The gradient is sized off the diagonal**, not the width. A radius from the
width alone leaves a 9:16 frame with dark top and bottom edges and bright sides,
which is a different look and not the one named Vignette. Measured as mean luma
in eight radial shells at full strength: `0.000, 0.000, −1.0, −10.0, −22.2,
−34.0, −16.0, −0.6` from the centre outward — monotone, centre untouched. The
outermost shell barely moves because that ring is already at luma 1.2: it is the
black surround, and black cannot get darker.

> **A probe at the canvas corner would have reported "no effect"** for exactly
> that reason. The first measurement of this effect did, and looked like a
> regression. Measure the region you mean, not the corner of the buffer.

**Grain's tile is centred on 128**, which is the part that matters: `overlay`'s
gain runs with distance from *both* ends, so a mean-128 field is
mean-preserving. Measured drift in mean frame luma across six probes is
**+0.16/255** at full strength — grain changes the texture of a frame, not its
exposure. The flip side, which is worth knowing before filing a bug: the gain
peaks *at* mid-grey and falls away in crushed shadow and blown highlight
(measured noise sd 0.71 at base luma 7.5, 8.70 at 150.6, 9.33 at 128.0, 6.01 at
188.4). So grain is near-invisible in the letterbox of a letterboxed clip — which
is correct, since visible noise crawling in the surround reads as a broken
player — and it also goes quiet in a crushed night shot. **If the grain slider
ever reads as doing nothing, look at the blacks before the code.**

The tile is built once and reused, so a paused frame and a playing one are the
same picture — which is also what makes it measurable: two consecutive draws of a
paused frame differ in **0 of 921,600** pixels.

### The blank Grain card, and what it was actually about

The Grain card rendered as an empty grey square. The computed style showed
`background-image` **empty** while `background-size` beside it was intact —
`cover, 120px`, a noise size for a layer that did not exist.

The cause is a CSS tokenizer rule: an unquoted `url()` token ends at the first
`)`. The card's noise was an inline `feTurbulence` SVG, and that data URI
contains the SVG's own `filter="url(#n)"`. The `)` closed the `url(` early, the
value became a bad-url token, and **the entire declaration was dropped silently**.
Nothing errored, nothing logged, and the property sitting next to it kept its
value — which is why it read as a card with a noise size and no noise on it.

Quoting the URL would have fixed it. The better fix removes the second noise
generator: the card now exports **the tile the player actually draws**. The two
textures did not match — `feTurbulence` is a different distribution from the ±40
field `grain()` builds — so "what the card shows is what the player draws" was
true by resemblance rather than by construction. It is now true by construction.

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

**Highlights and Shadows were both doing the opposite of their names.** This is
the one the [self-check page](selfcheck.html) caught, and it is the second time a
knob has lied on this shelf, so the finding is written up rather than patched.

Neither knob can be expressed in `ctx.filter` — there is no highlight or shadow
recovery in the vocabulary — so both were faked with a `brightness()` plus a
counteracting `contrast()`, and **the counter-term was winning**. Measured on
paired flat patches, old **Highlights at +1** moved the highlight end by
**−9 luma** and the shadow end by **+29**: it brightened the shadows and dimmed
the highlights. On every exposure pair tried (235/30, 200/45, 160/60, 245/20).

The fix is the **sign of the contrast term**, which is what decides which end of
the range the knob actually pushes — `contrast()` scales distance from mid-grey,
so raising it lifts highlights and drops shadows together, and lowering it does
the reverse. Highlights is now contrast **up**, Shadows contrast **down**:

```js
high:{n:'Highlights',i:'high',f:v=>`brightness(${1+v*.12}) contrast(${1+v*.2})`},
shad:{n:'Shadows',i:'shad',f:v=>`brightness(${1+v*.15}) contrast(${1-v*.28})`},
```

Measured, new Highlights at +1 on the 235/30 pair: highlight **+20**, shadow
**−16**. At −1: highlight **−45**, shadow **+16**. New Shadows at +1: shadow
**+30**, highlight **−16**. Both now move their own end further than the other,
in the direction the label promises.

The knob is still a two-stop approximation and not a real tone curve — it cannot
*recover* a blown highlight, only push it further — and that is exactly why the
self-check exists: a curve this easy to get backwards will get backwards again
the next time someone tunes it by eye.

---

## The self-check — a control whose only output is a number needs a pixel test

Sharpen shipped as `contrast() saturate()` and survived review because the
readout moved. [selfcheck.html](selfcheck.html) is the thing that stops that
class of bug from recurring, and it found two real liars on its first run.

It loads the mock in an iframe and calls the **real** `look()` and `frameStage()`
inside it — a copy of the filter strings would only prove the copy is
self-consistent. It measures against a synthetic 720×1280 chart with a known flat
field, 1px/2px/3px step edges, flat colour patches, and highlight/shadow plates:
deterministic, no media file, no decoder in the way.

Every control must prove three things:

1. **It is a bit-exact no-op at zero.** Not *nearly* — 0 differing bytes against
   no knob at all. "Nearly" is where surprises live.
2. **It moves its own metric, in the direction its name promises** — at *both*
   ends of its slider, because a control that honours only half its range is
   half broken and a single-end check cannot see it.
3. **For spatial controls, it still does that as displayed.** Sharpen scored +9%
   acutance on the canvas and **−5%** as displayed, because 720px of canvas shown
   in 257px gets averaged by the browser and averaging cancelled the boost. So
   every control is measured twice, and a control whose two answers disagree in
   *sign* is flagged — that disagreement is the failure mode that hides.

The claim list is hand-written per knob, because it is the claim the label makes,
written down so it can fail. And the page iterates the **live `ADJ` keys**, not
the claim list: a knob added to the mock with no claim written for it appears as
an explicit `unclaimed` failure rather than quietly going unchecked.

**Layers get a fourth assertion, which the first version of this page could not
have written.** A layer is only honest if it *stacks*, and neither half of that
is visible in the layer's own test:

- *It still does its own thing over a grade.* Vignette darkens corners **−74.5**
  luma on a bare clip and **−78.0** on a Vivid one; grain lifts mid-plate sd
  **+11.56** and **+11.01**.
- *The grade is still there underneath.* This is the half that matters, and
  `onTop` alone cannot see it: a vignette that wiped the look and redrew the
  edges would still measure about the same corner delta. So Vivid's own loudest
  signature is checked against the bare clip with the layer up — **+93 chroma
  with the vignette on, +111 with grain on, +111 with neither.** The vignette
  reads lower because it darkens the outer edges where the red patch sits; the
  grain reads identical because it is mean-preserving.

Before the layers were split out, a per-layer test would have passed while the
shelf was still broken, because each layer was individually fine and only the
*pair* was broken.

Current result: **21 of 21 controls hold** — 8 knobs and 13 looks.

Two of the three bugs it found were in the page's own claims, not the mock, and
that is worth saying too: Contrast at −1 legitimately *reduces* spread,
Saturation at −1 legitimately desaturates, and Fade at −1 legitimately *gains*
contrast. The first draft asserted all three move the same way at both ends,
which would have been a *wrong* test passing a *right* control — and a test that
is wrong in the convenient direction is how a suite stops being trusted.

---

## Verified

| | |
|---|---|
| Adjust | 8 knobs, per-knob values retained, all compose; footer `Cancel / Apply to all / Done` |
| Filters | 13 cards, 12 carrying real frames, each pre-filtered with its own chain; strength `0%` is a no-op, `100%` is the full look |
| Layers stack | `f:'vivid'` with `vig:1` and `grain:1` keeps all three lit and paints all three; what the app's rAF loop painted is byte-identical to a manual `frameStage` render at the same settings (**0** differing pixels of 921,600), and removing the two layers changes **736,100** |
| Layer independence | None → Grain → Vivid → Vignette → Grain off keeps `c.f` alive throughout; tapping a layer never reads or writes `c.f`; `Apply to all` copies `vig`/`grain` alongside `f`/`fs` |
| Slider binds to one thing | tapping Grain arms the grain slider, Vignette arms the vignette, tapping a look leaves the slider on whichever layer is up, and tapping `None` with no layer up shows the prompt instead of a dead strength |
| Stack is named | the sheet names what is on once two effects are up and hides the line below that: Vivid → hidden; +Vignette → "2 effects together — Vivid + Vignette"; +Grain → 3; dragging Grain to `0` rewrites it to 2 live; `Clear all` returns the clip to `f:'none'`/`vig:0`/`grain:0`; layer-only reads "Vignette + Grain"; no page horizontal scroll at 393 px |
| Cards show both layers | with vignette and grain up, all 12 non-`None` cards carry **2** `<i>` layers (24 total), the grain one `mix-blend-mode: overlay` — the `style=`-attribute bug that showed grain alone is fixed |
| Apply to all | 2 clips → both `{bright, warm}` + `moody@0.6`; objects cloned, not aliased |
| Adjust is real | centre pixel `[255,209,167]` → `[255,255,217]` at `bright +0.6`, `[178,146,119]` at `−0.6` |
| Caption move | drag `+0.5s` steps the start and the tooltip together; snaps to the playhead |
| Caption trim | left and right handles move start and duration; badge live at every step |
| Cancel / Done / undo | Cancel reverts the sheet; Done commits; undo restores; redo repopulates |
| Row keeps its place | at 393×844 the row sits at `scrollLeft 261` with Warmth selected, taps Sharpen at the same 261, re-taps the visible knob without moving it, and re-centres only an off-screen pick (Fade picked at 0 → 261) |
| Sharpen is a mask, not a curve | acutance +41% at full res, +14% as displayed, −27% at `−1`; flat field beside the edge is bit-identical at every amount; `sharp 0` is 0 differing bytes against no knob at all, including with a grade and a 90° rotation |
| Vignette | radial-shell mean luma `0.000, 0.000, −1.0, −10.0, −22.2, −34.0, −16.0, −0.6` centre→edge at full strength, and `0, 0, −1.3, −11.5, −25.5, −40.2, −18.8, −0.5` on top of Vivid — the falloff survives the grade; `vig=0` is 0 differing bytes; centre probe moves −0.4 while corners move −74.5 |
| Grain | mean luma drift +0.16/255 across six probes (mean-preserving); mid-plate sd +11.5; repeat draws of a paused frame differ in 0 of 921,600 pixels; `fs=0` is 0 differing bytes |
| Grain card | shows the player's own exported tile; `background-image` parses to 2 layers with `background-blend-mode: normal, overlay` — the unquoted-`url()` drop is fixed |
| Filter shelf at 357 and 393 | 13 cards, `scrollHeight === clientHeight`, no page-level horizontal scroll, shelf scrolls 677px (393) / 713px (357) |
| Highlights / Shadows | corrected sign; at `+1` Highlights moves the highlight end +20 and the shadow end −16, Shadows moves the shadow end +30 and the highlight end −16, on all four exposure pairs |
| Self-check | 21 of 21 controls hold; every knob is 0 differing bytes at zero and checked at both ends of its slider; Sharpen reads +98.7% canvas / +77.9% shown, same sign; both layers are additionally measured over a graded clip, for their own effect and for the grade surviving |
| Determinism | all 13 looks at `fs=0` are 0 differing bytes against `f:'none'`; the same settings rendered twice differ in **0** of 921,600 pixels |
| Sharpen leaves no outline | 9:16 clip in a 16:9 project: the backdrop outside the picture is unchanged and the edge pixels are the frame's own, not a bright rim |
| Icons | Filters and Adjust are a funnel and a three-rail mixer, checked side by side in both themes at 393×844 and 357×836; the eight knob glyphs use eight different geometric families — sun, half disc, chevrons, crescent, drop, thermometer, sparkle, stacked lines |
| Values still reach the pixels | centre 80×80 sample sums 931917 at Sharpen +0.24, 766885 at +0.90, 931917 on the way back |
| Shell | no console errors; `scrollHeight === clientHeight` at 378×836; `npm run build` clean |

The known dev-only service-worker 404 and the `willReadFrequently` warning from
the pixel probe are not app errors.
