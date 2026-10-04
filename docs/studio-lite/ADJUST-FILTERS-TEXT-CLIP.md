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
vig:{n:'Vignette',f:null,post:'vig'},      // a layer — clip.vig,   −1…1
grain:{n:'Grain',f:null,post:'grain'},    // a layer — clip.grain, −1…1
```

Vignette and Grain used to be chains like the rest, competing for `c.f` — which
meant tapping Grain deleted Vivid and then deleted itself, and there was no
arrangement of the two you could want. They are now **layers**: independent
per-clip strengths that `postFx()` draws once the frame is on the canvas, over
whichever chain is picked, so all three can be on at once.

They also appear on the **Adjust shelf**, and that reversal is worth recording
because the first argument against it was wrong. The idea was rejected on the
grounds that Adjust's slider is bipolar `−1…1` and neither effect has an honest
negative end. That was **wrong about both**. `−1` vignette is not an inverted
vignette, it is a *white* vignette — the edge lightened instead of darkened —
which is a real look, and the one you reach for to lift a subject off a dark
background. And grain's negative end is real too, once you stop reading it as
"less noise": the slider runs genuine grain at `+1`, nothing at `0`, and a
soft-focus look at `−1`, where the frame is desaturated and smoothed. "A
negative amount of grain is not a thing that exists" was only ever true if the
negative end had to mean *more* grain; the opposite corner of the same axis
(smooth, not textured) is a thing that exists and that this shelf wanted.

A mask has only one sign, so the negative half is spent on the opposite
operation — the same move Sharpen's negative end makes. It is one native pass:
the whole frame redrawn onto itself through `saturate() blur()`, with a few px of
overscan so the blur's source rectangle extends past the viewport (a 1:1 redraw
would sample transparency outside the canvas and ring the edge with a dark
halo). Both layers are therefore genuine centred sliders like the nine tonal
knobs. Both shelves read and write the same two fields (`clip.vig`,
`clip.grain`), so they cannot disagree.

**Softening that is not grain.** Reusing that path for a *separate* knob is what
Blur is: the same `soften()` redraw, with the desaturation left out and the
radius raised, so an out-of-focus frame no longer requires also adding film
grain. It is unipolar `0…1` — there is no negative blur, because Sharpen already
owns the other direction — which makes it the one Adjust knob whose floor is its
neutral. It is applied before the vignette and grain rather than after: blur is a
property of the picture, and softening the noise or the vignette's falloff would
be softening the wrong layer.

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

### A bipolar vignette, and why it is not an inverted one

The two ends of the vignette are both real, and the measurement says so. Mean
corner luma on the self-check's flat chart, against an untouched frame:

| `clip.vig` | corner luma | centre luma |
|---|---|---|
| `0` | **128.0** | 128.0 |
| `+1` (black) | **53.5** — −74.5 | 127.6 — −0.4 |
| `−1` (white) | **201.9** — +73.9 | 128.4 — +0.4 |

Symmetric to within 0.6 luma, and the centre moves by less than half a luma
either way: the falloff starts at 32% of the diagonal radius, so the middle of the
frame is untouched whichever direction the slider goes. `0` is a bit-exact no-op
(0 differing bytes), which is the property that lets the control sit on a shelf
where every slider is centred without lying about its own range.

That is the whole argument for the reversal. "A negative vignette is
meaningless" was an assumption; the thing it named — a lightened edge — is a
normal look with a normal name.

One consequence is worth naming: because the value is signed, **every "is this
layer on?" test had to change from `> 0` to `!= 0`** — the Filters shelf's lit
card, which layer the single slider is bound to, the stack line's count, and the
`draw()` gate that decides whether the frame takes the post pass at all. A
negative vignette is an effect, not an absence, and every place that treated the
sign as the switch was quietly dropping it. Tapping a lit Vignette card also had
to test magnitude to clear it, so tapping a `−70%` vignette switches it off rather
than flipping it to full black.

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

**And the Filters row still lurched the moment you picked a card.** `panel()`
carried the offset across the rebuild and then called `centerOn`, whose guard
skipped only when the selected card was *fully* inside the row. A card you had
scrolled out to almost always sits at an edge, so it failed the guard and got
centred: scrolled to `178` and tapping a card at the row's edge moved the row to
`338`. Centring is now for the sheet's **opening** only. `panel()` takes a
`fromRowTap` flag that the filter pick sets, and `adjSync` no longer centres at
all — both are only ever reached by a tap, and a tap defines a card the user can
already see, so there is nothing to bring into view. Only a rebuild nobody tapped
for (opening the sheet on a clip whose look is scrolled off) moves the row, and
it still does: picking `noir` with the row at 0 centres it to `667`.

A second, quieter shift came from the sheet's own height. Adding the "2 effects
together" line makes the panel overflow by 2px, a desktop scrollbar appears, the
row narrows ~17px and the scroll re-snaps — a `+9px` nudge on every layer tap,
and a `+9` the moment the line appears. `#panel` now reserves its gutter with
`scrollbar-gutter:stable`, so no content toggle can resize the row under it. Both
are properties of the panel rather than of Filters, which is why the fix lives in
`panel()` and the `#panel` rule rather than in the filter branch.

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

1. **It is a bit-exact no-op at its rest.** Not *nearly* — 0 differing bytes against
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

**And the rows get their own check, because a scroll offset is not a pixel.** The
row-keeping bugs above are invisible to a filter string and to a pixel test: the
sheet rebuilt the row from a string (so it went back to `scrollLeft 0`) and then
re-centred the card you had just tapped. So the page carries four more assertions
in a **second, phone-sized instance** of the mock — the pixel checks want a 1px
offstage frame, and a row cannot be scrolled in one:

| shelf | what it does | before → after |
|---|---|---|
| Filters | tap a chain card at the row's edge | `187 → 187` |
| Filters | tap a layer card at the far end | `267 → 267` |
| Adjust | tap a knob at the row's edge | `178 → 178` |
| Filters | open the sheet on a look scrolled out of view | `0 → 667` |

The last row is the **positive control**: a rebuild nobody tapped for still has
to bring the selection into view, so a "fix" that merely switched centring off
fails there instead of passing quietly. The assertion is proven able to fail —
re-running the old behaviour in the same frame moves the row `187 → 347`.

Current result: **26 of 26 controls, 4 of 4 shelf rows and 4 of 4 layout checks
hold** — 13 knobs, 13 looks, neither shelf moving under the thumb, and the sheet's
own geometry measured rather than assumed (see §"The sheet's geometry" below).

Two of the three bugs it found were in the page's own claims, not the mock, and
that is worth saying too: Contrast at −1 legitimately *reduces* spread,
Saturation at −1 legitimately desaturates, and Fade at −1 legitimately *gains*
contrast. The first draft asserted all three move the same way at both ends,
which would have been a *wrong* test passing a *right* control — and a test that
is wrong in the convenient direction is how a suite stops being trusted.

---

## The sheet, restyled to the reference (and Blue tone)

The property sheet was rebuilt against the YouTube Create reference, and the
whole change is one idea: **the value belongs to the slider.** It used to be a
20px centred `<b>` on a line of its own with the track on the next line down —
two objects the eye had to pair up, and the pairing was exactly what the
reference makes free. Now there is one `.sl` block per slider: the number is
15px, right-aligned, directly above the track, 6px away from it. Measured at
393×844 on the Adjust sheet, the readout sits at `y690–706` and the track starts
at `y712`.

The track itself is styled rather than left native: a 4px fill-meets-thumb line
with a 22px white thumb, and the fill is computed against the thumb's *travel*
(the travel is inset by the thumb radius at each end, so a raw percentage stops
~11px short of the thumb at the far right). At `blue 0.6` the fill reads
`78.02%`, which is where the thumb is, not 80%.

**A centre dot marks the neutral.** It is emitted only when the floor is
negative — a slider floored at zero has a neutral that sits under the thumb's
rest position, so a dot there would describe the thumb — and it is toggled live
by `adjSync`, because the knob switches without rebuilding the sheet. Rotation
(−180…180), the vignette, grain and every tonal knob get it; Blur, Opacity and
Volume, the three sliders whose rest is an end rather than a centre, do not.

**One knob does not rest at zero.** Opacity's neutral is 1 — a clip is opaque
until you say otherwise — which is the one place on this shelf where the numbers
are not all zero at rest, and it forced two things to be stated rather than
assumed. The changed-dot compares against `adjNeutral(k)` instead of 0, so
Opacity does not light its dot the moment the sheet opens; and the self-check
asserts the bit-exact no-op at each claim's **declared rest** instead of at 0,
so Opacity at 1 is 0 differing bytes while Opacity at 0 is 0 differing bytes from
nothing at all. A harness that assumed every neutral was 0 would have reported
Opacity as broken for being correct.

**A gradient track is the scale the label cannot say.** Blue tone ships
`linear-gradient(90deg,#d9a441,#f2f2f2 50%,#3f7fe0)`: amber → neutral → blue,
read left to right. That is a property of *which* knob is picked rather than of
its value, so `adjSync` re-writes `--gr` on every knob change — the first cut set
it only in the build path, which meant the ramp appeared only when the sheet was
built with Blue tone already selected, i.e. never.

**A knob that holds a value carries a dot.** The ring answers "which knob is the
slider on"; a small accent dot answers "which knobs hold a value". Without it,
the fact that you changed Warmth evaporates the moment you tap Brightness — the
ring moves and takes the evidence with it. Read from the clip via `adjMarks()`,
not from `adjKey`, so it survives selection changes; three set knobs (Warmth,
Vignette, Blue tone) reported correctly in the live check.

**The footer is three anchored slots, not three flex children.** Under
`space-between` the middle action drifted with whatever widths Cancel and Done
happened to carry, so "Apply to all" sat left of centre beside a wide Cancel.
`.ef` is now `grid-template-columns:1fr auto 1fr` with `l`/`m`/`r` slots, and the
middle action is centred on the sheet content itself: at 390px the panel content
spans `20…353`, its centre is `186.5`, and Apply to all centres at `186.5`, with
Cancel flush left and Done flush right. The middle action wears an outline
rather than a third fill — at reference distance a third solid pill competes with
Done. An empty `.m` still holds the column, which is what keeps Done pinned right
on the sheets with no middle action at all (Settings, Text).

### Blue tone cannot be a filter string, so it is not one

Blue tone is a white balance, and a white balance is a **channel move** —
`ctx.filter` has no per-channel control, so every filter-chain version of this
knob is a hue rotation wearing the name. It is therefore a third post field
(`clip.blue`) drawn over the picture box in `frameStage()`, the same route the
vignette and grain take and for the same reason: the thing cannot be said in the
filter string, so it is said after the frame. A fixed blue at `+v` and its amber
mirror at `−v`, alpha by magnitude, confined to the drawn picture's own
`x0,y0,w,h` box so the letterbox stays black. Bipolar like its neighbours, and
exactly neutral at 0.

The witness is the mid-grey plate's blue↔yellow axis (the mean of
`Bc = .866(G−B)`, negative for blue). The grey card has no colour to argue
about, so any offset there came from the slider: full strength reads
**−27.71 blue↔yellow**, `0` is **0 differing bytes**, and the amber end mirrors
it. This is the class of control most likely to ship as a knob that moves a
readout and nothing else, which is why it is asserted at both ends.

---

## The sheet's geometry

Every check above is blind to layout. A value could sit forty pixels above its
slider and still be "the readout"; the footer's middle action could drift left
and still be "three buttons"; a centre dot could appear on every slider and
still be "a dot". So the three promises the restyled sheet makes are asserted as
geometry, in the same phone-sized instance the row checks use — the 1px frame the
pixel checks run in could not report a gap at all.

| check | measured at 393×844 |
|---|---|
| the value is on the track's line | `6px` gap, `2px` inside the track's right edge, on all four slider sheets |
| the dot is on exactly the centred sliders | `11` bipolar, `2` floored at zero, `0` mismatches across 13 knobs |
| the same rule on Filters | look flat (`centred=false, dot=false`), layer centred (`true, true`) |
| the footer | middle action `0px` off the sheet's centre; Cancel and Done `0px` from its edges |

It reads `getBoundingClientRect` on the real nodes and drives the sheet through
its own click handler, so it tests the shipped markup rather than a description
of it. Two details are load-bearing:

- **The footer is measured against the `.ef` box, not against a padding sum.**
  `#panel` carries `scrollbar-gutter: stable`, which reserves space inside the
  content box; deriving the centre from `padding-left`/`padding-right` would land
  ~17px wide of the truth and report a correct footer as off-centre.
- **The dot is read from its computed `display`, not from the class that asks
  for it.** A rule that showed the dot on every slider would leave the class
  right and the picture wrong.

The probe is proven able to fail. Injecting three regressions into the frame —
`.sl{gap:40px}`, `display:flex` on `.ef`, and `display:block` on every dot —
fails **all four** checks; removing the injection returns **4 of 4**. A geometryassertion that cannot fail is a description, not a test.

---

## Four actions that change the clip, not its look

The rail gains **Reverse, Replace, Rearrange and Delete**, sitting together after
the property sheets in the order the reference groups them. None of them is a
filter or a value — they change *which* media a clip is or *where* it sits — so
no pixel and no filter string can see them, and each needs its own witness. They
are driven in the self-check the way a finger drives them: a real tap on the real
rail button, a real pointer drag over the real card.

### Reverse, and the one thing a media element will not do

Reversing a clip looked like it should be one line — `playbackRate = -1` — and it
is not, because the HTML spec puts the valid rate range at `[0, ∞)`: a negative
rate is not slow playback, it is a thrown exception. So a reversed clip is not
played, it is **seek-stepped**. The timeline becomes the clock and the element is
written to each frame: `t` advances by the real elapsed time and the source is
drawn from it walking *backwards*, which is the whole of what Reverse means.

One expression, `srcTime(c,at)`, owns that mapping, because four places need it
— the frame that is drawn, the frame a filmstrip samples, the frame a filter card
shows, and the seek when you scrub — and a reversed clip is exactly the case
where four copies would drift apart. Verified through the live loop: on a 6s
clip the source reads `6 / 3 / 0` where the timeline reads `0 / 3 / 6`, the
timeline advances while the source walks back, and at the clip's end it hands off
to the next clip rather than stalling. A reversed clip looks identical to a
paused one, which is why the rail button carries `.on` — the state cannot be read
off the picture. The known cost is stated in the code: a long reversed clip can
look steppy, because the element only moves when a frame asks it to.

### Replace keeps the cut and swaps the picture

Replace swaps the *media* under a clip and keeps everything about the edit: the
clip's id, its place in the order and its trim window stay; only `src` points
somewhere else. That is the difference between this and deleting the clip and
adding another — a rough cut against a bad take should not have to be rebuilt
when the good take arrives. The window is kept when the new media is long enough
and **clamped** when it is not, and the toast says which happened. Verified by
driving `replaceWith` directly: after replacing a 7s-window clip the id and order
are unchanged and `src` has moved; a 5s replacement clamps the window to `out 5`
with the toast "trimmed to the new length", and a 20s replacement keeps the
window at `out 5` with the plain toast.

The picker is shared with Add, so it has to know what it is picking *for*: a
`replacing` flag is set at the call site and read in `onchange`, and cleared on
every pick so a cancelled Replace cannot turn the next Add into one. The self-
check reads that flag through the rail's own Replace button rather than calling
the function.

### Rearrange is a live splice, which is why Cancel exists

Dragging a card over another **splices `clips` immediately**, so what you see is
the order you are building; Done is a formality. That is exactly why Cancel has
to exist — it restores the snapshot the sheet took when it opened, so a live edit
is still a reversible one. The drag listens on the window rather than on the row,
because the row is re-rendered on every swap and a card-bound listener would be
thrown away mid-gesture; it holds the clip's **id**, not its index, for the same
reason. Verified: two cards render with the selected one drawn as a circle and no
Reset (the footer's middle slot is empty for this sheet); a drag moves `1,2` to
`2,1` with the selection following to the second card; Cancel restores `1,2`.

### A name collision the verification caught

The file-picker door was first called `pick`, which is also the name of the
timeline's own clip-selection function some four hundred lines below. Both are
function declarations, so the later one **hoisted over** the earlier: Add and
Replace silently called the timeline's `pick`, which dereferences an element it
was never handed. It read as working until the Replace button was driven in the
self-check and armed nothing. The fix is a rename — the picker is `pickFile`, and
the timeline's `pick` is untouched — and the self-check now asserts the flag the
button sets, which is the assertion that would have caught it a commit earlier.

### The value is live under the thumb

The readout and the changed-dot are driven by `input`, which a range fires on
every move of a held thumb — so both follow the value mid-drag and neither waits
for the pointer to come up. That is the whole difference between a live value and
a label that happens to have moved, and it is now asserted: the self-check
dispatches the same `input` events a held thumb produces, with no `pointerup`
between, and reads both the readout and the dot back at rest, mid-drag and at
rest again.

What the drag lacked was a **visible** cue that the number is the value you are
*setting*. The sheet now carries a `held` state: `pointerdown` on a slider puts
`#panel` into it and the readout takes the accent colour (a `.12s` fade, cleared
on `pointerup` anywhere — a range keeps receiving the drag after the pointer has
left its own bounds — and on `pointercancel`, so an interrupted gesture cannot
leave the sheet stuck lit). Verified in the live sheet: rest `#fff`, held
`#8ab4f8` (the theme accent), rest again `#fff`.

Two adjacent paths were fragile and are hardened. The slider now sets
`touch-action:none`, so a touch or pen drag can never be read as a pan of the
sheet's own scroll container, leaving the value behind. And the global shortcut
handler used to exempt only `type=='text'` fields, so an arrow key on a *focused
range* was intercepted and nudged the playhead while the thumb you were on never
moved — it now exempts any `INPUT`. Verified with real key presses: `ArrowRight`
on the focused Brightness slider takes it `0 → 0.02`, the readout to `+2`, the
changed-dot on, and the playhead stays put.

---


## Verified

| | |
|---|---|
| Adjust | 13 knobs — the eight tonal ones, Vignette and Grain (which write `clip.vig`/`clip.grain` rather than the Adjust bag so the Filters shelf shows the same number), Blue tone (`clip.blue`), Blur (`clip.blur`) and Opacity (`clip.opacity`); per-knob values retained, all compose; footer `Cancel / Apply to all / Done` in three anchored slots |
| Opacity | the one knob that rests at 1, so it declares its neutral and the no-op is asserted there: `0` differing bytes at full, half lands the frame exactly halfway to the project background (mean `127.35 → 63.71`), `0` leaves nothing but the backdrop (mean `<2`), monotone between; it is an alpha on the picture in `frameStage()` rather than a post effect, so the backdrop shows through instead of being replaced |
| Blur | unipolar `clip.blur`, applied in `postFx()` before the vignette and grain as a redraw-through-`blur()`: acutance `0.581 → 0.044` and step-edge sd `6.45 → 1.53` at full, frame mean held `127.35 → 127.32`, corner probe `128.0 → 127.73` (no edge halo), `0` is 0 differing bytes; monotone at half strength (`0.124` acutance); stacks with a look, vignette, grain and Blue tone in one render |
| Soften, shared | the negative-grain end and Blur call one `soften(a, desat, rad)` helper, so "soft" cannot mean two things; grain passes `desat .85 / rad 2.2`, Blur passes `desat 0 / rad 7` |
| Sheet layout | value right-aligned 6px above a 4px track with a 22px white thumb; fill meets the thumb (`blue 0.6` → `--p 78.02%`, not 80%); centre dot on every negative-floor slider and none on Volume (the only slider still floored at zero); gradient track on Blue tone rewritten on knob change; a changed-value dot on 3 set knobs (Warmth, Vignette, Blue tone); Apply to all centred on the content (`186.5` of `20…353`), Cancel flush left, Done flush right |
| Volume mute | a one-tap Mute chip beside the slider, the same chip as `Rotate 90°`: starts at `80%` showing `Mute`; one tap → `vol 0`, readout `0%`, video `volume 0`, slider `0`, chip `Unmute`; a second tap → back to exactly `0.8`; dragging the slider to `0` flips the chip to `Unmute` and dragging up flips it back, so the chip and the slider can never disagree |
| Blue tone | bipolar white balance drawn over the picture box on `clip.blue`: +1 pushes the mid-grey plate blue (**−27.71 blue↔yellow**, negated axis), −1 amber, `0` is **0** differing bytes; survives the sharpen/grade path |
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
| Filter row never jumps | scrolled to `178` and tapping a card at the row's edge leaves it at `178` (it used to centre to `338`); a layer tap leaves it at `107/187/267/427` across four offsets (each used to drift `+9`); the stack line appearing no longer shifts it; Adjust taps move `0px`; opening the sheet on an off-screen pick still centres (`0 → 667`) |
| Row checks in the self-check | `selfcheck.html` carries the four probes as live assertions in a second phone-sized mock: Filters edge tap `187 → 187`, Filters layer tap `267 → 267`, Adjust tap `178 → 178`, and the positive control `0 → 667`; the old behaviour in the same frame moves `187 → 347`, so the assertion can fail |
| Sharpen is a mask, not a curve | acutance +41% at full res, +14% as displayed, −27% at `−1`; flat field beside the edge is bit-identical at every amount; `sharp 0` is 0 differing bytes against no knob at all, including with a grade and a 90° rotation |
| Vignette | radial-shell mean luma `0.000, 0.000, −1.0, −10.0, −22.2, −34.0, −16.0, −0.6` centre→edge at full strength, and `0, 0, −1.3, −11.5, −25.5, −40.2, −18.8, −0.5` on top of Vivid — the falloff survives the grade; `vig=0` is 0 differing bytes; centre probe moves −0.4 while corners move −74.5; the negative end is a white vignette — corners **+73.9** at `−1`, symmetric with the black end, centre still ±0.4 |
| Grain | bipolar. `+1`: mean luma drift +0.16/255 across six probes (mean-preserving), mid-plate sd **+11.5**; `−1`: red-patch chroma **142.5 → 20.9** (desaturated) and step-edge sd **6.45 → 3.05** (smoothed) with the frame mean held at 127.35 and the corner probe unmoved at 128.0, so the blur's overscan leaves no edge halo; repeat draws of a paused frame differ in 0 of 921,600 pixels; `0` is 0 differing bytes |
| Grain card | shows the player's own exported tile; at `+1` `background-image` parses to 2 layers with `background-blend-mode: normal, overlay` (the unquoted-`url()` drop is fixed); at `−1` it carries no noise layer and the thumbnail takes `saturate(0.57) blur(0.80px)`, so the card shows the softening the clip will get |
| Filter shelf at 357 and 393 | 13 cards, `scrollHeight === clientHeight`, no page-level horizontal scroll, shelf scrolls 677px (393) / 713px (357) |
| Highlights / Shadows | corrected sign; at `+1` Highlights moves the highlight end +20 and the shadow end −16, Shadows moves the shadow end +30 and the highlight end −16, on all four exposure pairs |
| Sheet geometry | four DOM measurements, at 393×844, driven through the sheet's own click handler: the readout sits **6px** above its track and **2px** inside the track's right edge on all four slider sheets (Speed, Volume, Adjust, Rotation); the centre dot is on exactly the **11 bipolar** knobs and neither the **2** floored at zero; on Filters the strength slider is centred for a layer and flat for a look; and the footer's middle action is **0px** off the sheet's centre with Cancel and Done **0px** from its edges. Proven able to fail — injecting `.sl{gap:40px}`, `display:flex` on `.ef` and `display:block` on every dot fails **all four**, and removing the injection returns **4 of 4** |
| Self-check | 26 of 26 controls hold; every knob is 0 differing bytes at rest (which is 1, not 0, for Opacity) and checked at both ends of its slider — including both ends of the bipolar vignette; Sharpen reads +98.7% canvas / +77.9% shown, same sign; both layers are additionally measured over a graded clip, for their own effect and for the grade surviving |
| Rail order | the four clip actions sit together on a selected clip, in the reference's order — `speed · volume · filter · adjust · rotate · trans · reverse · replace · rearrange · dup · del · ts · te` — with Transition present only once the clip has a predecessor |
| Reverse | a reversed clip is **seek-stepped**, because negative `playbackRate` is outside the spec's `[0, ∞)` range: the timeline advances while the source walks back (on a 6s clip the source reads `6 / 3 / 0` where the timeline reads `0 / 3 / 6`) and hands off to the next clip at the end; one `srcTime` maps the drawn frame, the filmstrip, the card thumbnail and the scrub; the rail button carries `.on`, the only place the state shows on a paused frame |
| Replace | swaps the media under a clip and keeps its id, order and cut; verified: a 5s file against a 7s window clamps `out → 5` with the toast “trimmed to the new length”, a 20s file keeps `out 5` with the plain toast; the `replacing` flag routes the next pick to `replaceWith` and is cleared on every pick, so a cancelled Replace cannot hijack the next Add |
| Rearrange | a live splice: a drag moves `1,2 → 2,1` with the selection following to the second card, and Cancel restores `1,2`; the selected card is drawn as a circle, the footer's middle slot is empty (no Reset), the listener lives on the window and is keyed by clip id so a swap re-rendering the row cannot drop the gesture |
| Delete | the rail's trash removes the **selected** clip, not the last one (2 → 1, leaving the other), matching the header's action |
| Clip-action checks | `selfcheck.html` gains a fifth section — six probes in the same phone-sized mock, driven through the real rail buttons and a real pointer drag: rail order, Reverse, Rearrange, Delete, Replace and the live readout, all **6 of 6** |
| Readout is live under the thumb | the readout and the knob's changed-dot are driven by `input`, which a range fires on every move, so both follow the value mid-drag rather than settling on release: asserted by dispatching the same input events a held thumb produces, with no `pointerup` between, and reading both back at rest (`0`, dot off), mid-drag (`+42`, dot on) and at rest again; the readout also takes the accent while the pointer is down (`#fff → #8ab4f8 → #fff`), and `ArrowRight` on a focused slider moves the thumb (`0 → 0.02`, readout `+2`, dot on) instead of nudging the playhead |
| Determinism | all 13 looks at `fs=0` are 0 differing bytes against `f:'none'`; the same settings rendered twice differ in **0** of 921,600 pixels |
| Sharpen leaves no outline | 9:16 clip in a 16:9 project: the backdrop outside the picture is unchanged and the edge pixels are the frame's own, not a bright rim |
| Icons | Filters and Adjust are a funnel and a three-rail mixer, checked side by side in both themes at 393×844 and 357×836; the thirteen knob glyphs use thirteen different geometric families — sun, half disc, chevrons, crescent, drop, thermometer, sparkle, bokeh circles, stacked lines, frame-with-bright-centre, dot scatter, cloud, ghost |
| Values still reach the pixels | centre 80×80 sample sums 931917 at Sharpen +0.24, 766885 at +0.90, 931917 on the way back |
| Shell | no console errors; `scrollHeight === clientHeight` at 378×836; `npm run build` clean |

The known dev-only service-worker 404 and the `willReadFrequently` warning from
the pixel probe are not app errors.
