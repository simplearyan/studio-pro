# Ruler guides — dots, 5-second labels, and a density that follows zoom

A plan for [`clip-lite-mock.html`](clip-lite-mock.html): put duration labels back on
the ruler, keep the dots, and make both respond to the timeline zoom so the
number of guides on screen follows how far in you are.

Follows the YouTube Create ruler in the attached screenshot: a dot roughly every
second, a timecode label every five, the current position in the middle, and
edges that fade out rather than stop dead.

**This is a plan, not an implementation.** Nothing here is built. The mock is at
`c9686af`.

> Every number in §4 and §11 in this document was produced by running the ladder
> arithmetic, not by working it out in my head. The first draft of this plan had
> two independent tick ladders and got four of its seven table rows wrong, and
> the design it described could not actually keep the dots on the labels — see
> §4.3. The tables below are the corrected ones.

---

## 1. What the reference actually does

Measured off the screenshot, where the playhead sits at 00:07 and the labels read
`00:05` and `00:10`:

| | reference |
|---|---|
| scale at that moment | 96.6 px/s (00:05 → 00:10 spans 483px) |
| **dot interval** | ~1s — a dot roughly every 96px |
| **label interval** | 5s — `00:05`, `00:10` |
| current position | large, centred: `00:07 / 00:30` |
| edges | fade to nothing over ~14–24px, not a hard cut |

**The dots divide the labels — five dots per labelled interval.** That is the
detail worth copying, because a ruler whose minor ticks do not land on its major
ticks is measurably harder to count against.

**The reference's playhead scrolls; ours does not.** In the reference's own
screenshots the readout pill tracks the playhead and moves with it. Ours is
pinned to the centre by design (the documented `tl.scrollLeft = t*pps`
convention), so our readout is always centred and the ruler is a **fixed
viewport strip with content sliding underneath it**. Every decision below is
built for that, not for a scrolling head. Moving the playhead off centre is a
separate change and is explicitly out of scope (§10).

---

## 2. What we have today

The ruler is split across two generations of the file, and only one of them is
alive.

**Live** — the `.ro` strip, 30px, in the dock above the scroll container:

```
.ro                    30px row, already counted in fitView()'s `chrome`
  #rl                  position:absolute, overflow:hidden — **no mask**
  #rd                  the ticks; transform: translateX(-scrollLeft) every frame
    #rd i              2px dot, --on2 at 0.55
  #time                centred readout, `00:00 / 00:00`, opaque --bg
```

**Dead** — leftovers from before the D1 declutter:

| | |
|---|---|
| `<div id="ruler">` | inside `.inn`, but `#ruler{height:0}` and nothing is ever emitted into it |
| `#ruler b{…}` | the label style — 11px, `--on2`, `translateX(-50%)`. **Never used.** |
| `#ruler i{…}` | an earlier 3px dot. **Never used.** |
| `$('#ruler').style.width` | still written in `renderTL()`, sizing a zero-height element |

The label stylesheet from the pre-declutter ruler is sitting in the file,
unused, waiting for exactly this. The current tick step is:

```js
const st = pps>=12 ? 1 : [2,5,10,30,60].find(v=>v*pps>=12) || 60;
```

One problem with it: the `pps>=12?1` branch means **at any usable zoom the dots
are every 1 second regardless of how long the timeline is**. On a 10-minute
project at pps 14 that is 600 dots at 14px, which renders as a solid line rather
than a row of guides. And there is no label tier at all.

---

## 3. The gap, stated

1. No duration labels. `00:05` exists nowhere on the timeline.
2. Dot density is not a function of pixel distance, only of a `pps>=12` cliff.
3. Nothing ties the two together, so there is no "guides" concept to customise.

---

## 4. Design

### 4.1 One ladder, chosen by pixels

Every guide is placed by **how many pixels it would occupy**, never by a raw
interval. One function walks a ladder and returns the first rung that clears a
pixel budget:

```js
const MAJOR=[.5,1,2,5,10,15,30,60,120,300,600];   // seconds
const SPLIT=[1,2,4,5,10];                          // minors per major
const LABEL_PX=56, DOT_PX=14;
const rung=(pps,px,l)=>l.find(s=>s*pps>=px);
```

`MAJOR` is 1-2-5-10-15-30 above a second because those are the intervals a person
reads without counting. `56px` is a `00:05` label (~32px at 11px) plus 24px of
air; `14px` is a dot plus enough gap to read as separate rather than as a rule.

### 4.2 The minor tier is *derived*, not chosen

This is the part the first draft got wrong, so it is worth being explicit.

The obvious design is two independent ladders — a major one for labels and a
minor one for dots, each with its own pixel budget. **It does not work.** The
two ladders have no reason to divide each other, so at some zooms the dots stop
landing on the labels. Measured, on the independent-ladder version:

| pps | major | minor | dots per label |
|---|---|---|---|
| 120 | 0.5s | 0.2s | **2.5 — does not land** |

A ruler whose minor ticks fall between its major ticks is measurably harder to
read, and it is the one property the reference gets right.

So the minor step is **derived from the major one**: the largest subdivision that
still clears the dot budget.

```js
const major = rung(pps,LABEL_PX,MAJOR);
const k     = [...SPLIT].reverse().find(q=>major/q*pps>=DOT_PX) || 1;
const minor = major/k;
```

Every `SPLIT` value divides the interval by construction, so the dots *always*
land on the labels. The cost is that the minor step is sometimes not a round
number — `7.5s` at minimum zoom, `0.125s` at high zoom. That is not a defect; it
is what a real ruler does, subdividing a round interval into halves and quarters.
It is strictly better than a round dot interval that misses the labels.

### 4.3 The result, computed

| pps | major | px | k | minor | px | dots/label | labels on a 378px strip |
|---|---|---|---|---|---|---|---|
| 2 | 30s | 60 | 4 | 7.5s | 15 | 4 | 6.3 |
| 5 | 15s | 75 | 5 | 3s | 15 | 5 | 5.0 |
| **15.1 (Fit, 20s clip)** | **5s** | **76** | **5** | **1s** | **15** | **5** | **5.0** |
| 30 | 2s | 60 | 4 | 0.5s | 15 | 4 | 6.3 |
| 60 | 1s | 60 | 4 | 0.25s | 15 | 4 | 6.3 |
| 120 | 0.5s | 60 | 4 | 0.125s | 15 | 4 | 6.3 |
| 240 | 0.5s | 120 | 5 | 0.1s | 24 | 5 | 3.1 |

Every row is an integer subdivision, and the label count stays in a **3–6 band
across two orders of magnitude of zoom**. That is the property that matters:
zooming changes *which* times are labelled, never how crowded the strip is.

**The default comes out on its own.** `fitZoom()` sets
`pps = tlWidth*0.8/total`; at 378px wide with a 20s clip that is
`378*0.8/20 = 15.1`, and the ladder above gives **5-second labels and 1-second
dots** — what was asked for, and what the reference shows — with no magic number
anywhere. The requirement is a consequence of the geometry rather than a constant
tuned to hit it. Same reasoning that killed the measured-gutter bug in `c9686af`:
derive from pixels, never from a threshold someone can sit on.

### 4.4 Label text

| step | format | example |
|---|---|---|
| ≥ 1s | `fmtT` — the app's existing `mm:ss` | `00:05` |
| < 1s | `fmt` — the app's existing `m:ss.d` | `00:07.5` |
| ≥ 600s | `fmtT`; the readout already carries the total | `10:00` |

Reusing the two formatters already in the file rather than adding a third means a
ruler label and the transport readout can never disagree about how a time is
written.

### 4.5 Emission is windowed, not exhaustive

The first draft emitted every tick from 0 to `total`. Computed worst case — a
10-minute project at maximum zoom — that is **6 000 minor dots and 1 200
labels**, which is not a rendering problem, it is a hang.

So emit only what can be seen, plus one screen of margin on each side:

```js
/* Ticks are absolute, so the visible set is a window in time. Two screens of
   margin means a scroll of half a screen never empties the strip. Node count is
   then bounded by the strip, not by the project: ~68 at DOT_PX on a 378px
   viewport, whatever the length. */
const half=rl.clientWidth/2, W=rl.clientWidth;
const lo=Math.max(0,Math.floor((tl.scrollLeft-half)/pps));
const hi=Math.min(total,Math.ceil((tl.scrollLeft-half+W)/pps));
```

This has a consequence the rest of the plan depends on: **`paintRuler()` becomes
its own function**, called from `renderTL()` and from the scroll handler,
throttled so it re-runs only when the window has moved by at least one minor
step. At `DOT_PX=14` and full scroll speed that is a re-render every three or
four frames, and it rewrites a bounded number of absolutely-positioned nodes —
no layout, because every one of them is a `left` on an already-sized box.

The alternative — an exhaustive pass plus a node cap — was the first draft's
answer and it is worse: the cap has to widen the minor step, which breaks the
subdivision the whole design rests on.

---

## 5. The centre exclusion — the one real hazard

> **Superseded three times; this section now describes what ships.** It is left in
> place because the reasoning is still the reasoning. Four positions have been
> tried here, in order, and the first three are wrong for reasons worth keeping.

The readout `00:07 / 00:30` is ~106px wide and sits dead centre, on top of the
ruler. A label underneath it must not compete with it. Three ways to arrange
that, and what happened to each:

**1. Skip the label in JS when it would collide.** The original plan:

```js
const GUARD = 56 + labelHalfWidth();   // 56px window + half the label
if (Math.abs(pad + i*pps - half) < GUARD) continue;   // readout owns this space
```

Correct in principle, and it is what the reference appears to do — in its
screenshot there is no `00:07` label, because `00:07` is where the readout is.
Shipped, and **wrong**: the playhead is pinned to the centre, so a label crosses
that fixed spot continuously as the timeline moves. The DOM changed under a
stationary pixel, and labels popped out of existence and back — the flicker that
was reported on the ruler. Removing and re-adding nodes mid-scroll is the defect,
not the collision.

**2. A mask on `#rl`, fading a 100px window at the centre.** Also shipped, and
wrong for a subtler reason: the mask's geometry is in screen pixels while the
labels' geometry is in seconds per pixel. A fixed window therefore behaves
differently at every zoom — at one label interval it swallowed a label whole, at
the next it swallowed none of it. A mask on a scrolling strip is always a fixed
shape pretending to describe moving content.

**3. The readout is opaque and the mask is gone.** `#time` carries
`background:var(--bg)` and sits above the strip. `.dock` and `.ro` are both
transparent, so what is behind the strip *is* `--bg` and the patch is invisible —
no per-theme tuning, and `#rl` needs no mask at all. A label passing behind the
readout and continuing out the other side is what a readout on top of a ruler
looks like.

At 2s labels and pps 60 (120px between labels against a 106px patch) nothing is
ever cut. At 1s labels a label can be half-covered and a fragment shows; that is
the accepted cost of not masking, and the one-value alternative is a 11px ramp on
the patch's own gradient.

**4. What ships at the two ends: nothing at all.** This one took four attempts,
and the reasons the first three failed are why it is right.

The mask also faded the strip's **two ends** — `transparent 0 14px, #000 24px` —
so labels near an edge were always meant to disappear, and that part was doing
real work: at pps 48 *every* scroll position had a half-drawn label at the right
edge. With the mask gone there were three candidates:

- **Skip** any label not wholly inside the strip. Correct on paper, and it *pops*:
  a 27px label goes from fully drawn to nothing in one scroll step, which reads
  as a glitch rather than as an edge.
- **Fade** each label with a per-label `opacity` ramp over the last 14px — the
  mask's own effect, computed per label so it could not be zoom-inconsistent.
  Smooth, and still wrong: it makes a timecode *vanish* while the ruler is
  plainly still there, at the exact moment you are trying to read it. "Never
  hide" is the correct instinct for a readout.
- **Clip.** Emit the label at full strength and let the strip's `overflow:hidden`
  end it. That is a scroll container doing what a scroll container does, and it
  is what ships:

```js
for(let j=m0;j<=m1;j++){const x=pad+j*major*pps-sc;
  if(x+hw<0||x-hw>W)continue;                      // wholly outside: invisible anyway
  h+=`<b style="left:${pad+j*major*pps}px">${tickLabel(j*major)}</b>`}
```

The skip is left in only because `overflow:hidden` would hide those labels
anyway and dropping the nodes keeps the count down — it is decided *before* the
HTML is built, so nothing is ever added or removed after paint and the flicker of
approach 1 cannot come back. No opacity is written at all.

Verified at 357, 393 and 728 wide across the full scroll range at pps 15.7, 48,
60, 120 and 240 — ~25,000 label reads: **zero faded, zero hidden while partly
visible, zero inline `opacity` attributes**, and the label counts are unchanged
(4 at `Fit`, 7 at 728px, 5 at 393px). A label 1.7px over the left edge renders at
computed `opacity: 1`.

**The two details from the original plan are both still right:**

- **Measure `#rl`, do not reuse `pad`.** `pad = tl.clientWidth/2` and
  `rl.clientWidth/2` are equal today only because `.ro` and `.tl` are both
  full-width children of a paddingless dock. That is a coincidence, and §4.5
  needs the real width anyway. The §20 lesson from the gutter bug, again.
- **Measure the label half-width from a real node**, once, rather than assuming
  18px — and take the **widest** one, not the first. `00:01.5` is a character
  wider than `00:02`; a half-width taken from the short one misjudged every long
  label, which is how a build briefly shipped labels lying about their own width.
because `00:07` is where the readout is.

---

## 6. Customisation

### Automatic first, and it needs no control

The ladder already responds to `pps`, so pinch, `ctrl+wheel`, the Settings
`⊖ ⊕` pair and `Fit` all change the guide count with **no new UI**. Per the
declutter pass, a control for something that already does the right thing is
clutter, not a feature.

### The one explicit control: pin the interval

What automatic cannot do is *disagree*. Somebody trimming to a 30s music bed
wants `00:30` labelled at every zoom, not `00:02` because they pinched. One row
in the existing Settings sheet, cycling through:

```
Ruler interval              [ Auto ]
```

`Auto → 1s → 5s → 10s → 30s → 1m → Auto`, a chip in the same shape as the
existing `Fit` chip, persisted to `localStorage` under `lite:ruler` beside
`lite:snap` and `lite:theme`.

When pinned, the **major** step is forced and the **minor** step is still
`major/k` from §4.2 — so the subdivision guarantee holds while pinned, and
pinning can never produce a solid line of dots. Pinning 5s at maximum zoom gives
five dots per label, not the automatic hundreds.

View state, not document state: **not** in `snap()`, **not** in undo history.
Changing a guide interval should not be undoable, exactly like `snapOn`.

### Optional, probably not

The Settings zoom row currently reads `N s across`. Appending `· 5s guides` would
make both settings legible in one place. Cheap, but one more thing to keep in
sync — worth it only if the pinned state turns out to be easy to forget.

---

## 7. Cleanup that comes with it

| | |
|---|---|
| delete `<div id="ruler">` | zero height, never populated |
| delete `#ruler{height:0}` and the `$('#ruler').style.width` write | sizing a dead element |
| delete `#ruler b{…}` and `#ruler i{…}` | superseded by the `#rd` rules below |
| add `#rd b{…}` | the label style, revived — this is the rule the dead `#ruler b` was written for |
| add `#rd b::after` | a 1px stem under a labelled mark, so a major reads differently from a plain dot |

```css
#rd b{position:absolute;top:1px;font-size:11px;font-weight:400;font-variant-numeric:tabular-nums;
      color:var(--on2);transform:translateX(-50%);white-space:nowrap;pointer-events:none}
#rd b::after{content:"";position:absolute;left:50%;top:14px;width:1px;height:5px;
             background:var(--on2);opacity:.55}
```

Dot and label share a position, so the label costs no extra layout.

---

## 8. Risks

| risk | assessment | mitigation |
|---|---|---|
| **Text inside a per-frame transformed layer.** `#rd` gets `translateX()` every rAF frame; today it holds only 2px dots. | Low. The layer composites once and the transform is compositor-only — no re-layout, no re-raster per frame. | Measure with a long timeline and a continuous scroll. If text raster is the cost, the fallback is a second non-transformed layer positioned by `left` at low frequency — **not** a canvas, which would cost text crispness and selection. |
| **Node count.** Unbounded if ticks are emitted exhaustively — 6 000 on a 10-minute project at max zoom. | **Real.** | §4.5 windowing, not a cap. Bounded at ~68 nodes regardless of project length. |
| `paintRuler()` on scroll adds work to a path that today does none. | Medium. | Throttle to one re-render per `DOT_PX` of travel. Reuse the existing scroll handler rather than adding a listener. |
| Labels colliding with the readout. | **Real** — see §5. | The readout is opaque and sits on top; no mask, and nothing is skipped, because both of those were tried and both flickered or lied at some zoom. |
| Labels cut by the strip's own edges. | **Real** — at pps 48 every scroll position had one. | Clip, and nothing else: full strength, `overflow:hidden` ends it. Skipping popped and fading hid a timecode. |
| The guard assumes a fixed label half-width. | `10:00` is wider than `00:05`. | Measure once from a real node, per repaint, from the first label. |
| Minor steps are not round numbers (`7.5s`, `0.125s`). | Cosmetic, and deliberate. | §4.2. Subdividing a round interval is what a ruler does; a round dot interval that misses the labels is worse. |
| The `15` rung reads oddly beside `10` and `30`. | Cosmetic. | Deliberate: at pps≈5 a 30s label leaves two labels on screen and a 10s leaves four crowded ones. **Worth a second opinion before shipping** — it is the one rung that exists purely to keep the strip readable. |
| Ruler work must not change band height. | — | The ruler lives in `.ro`, which `fitView()` already counts in `chrome`. Any pixel of growth here is a regression to the preview, and `TIMELINE-SPACE-PLAN.md` has no slack to give. |

---

## 9. Out of scope

Named so they are decisions, not omissions:

- **Moving the playhead off centre.** The reference scrolls; we pin. Changing
  that is a different feature and would invalidate the fixed-strip geometry here.
- **Frames.** `Step one frame` exists at 1/30s, so a frame counter is a
  reasonable future rung, but `f70` in a timecode ladder is a different idea
  from this one.
- **A draggable ruler head** that scrubs.
- **Minute-and-hour formatting** past an hour. `fmtT` renders `60:00`; correct,
  if plain.
- **The main Studio Pro editor.** This is the Studio Lite mock only. The ladder
  is worth porting and the picker worth sharing.

---

## 10. Work items

| | item | risk |
|---|---|---|
| **R1** | Delete the dead `#ruler` element, its two CSS rules and the `style.width` write | low |
| **R2** | `MAJOR`, `SPLIT`, `LABEL_PX`, `DOT_PX`, `rung()`; the derived minor step | low |
| **R3** | `paintRuler()` — windowed emission, majors with `<b>`, minors with `<i>`, the §5 guard, throttled scroll hook | **high** — the whole feature, and the only item that can fail in a way a still will not show |
| **R4** | `#rd b` and `#rd b::after` styles | low |
| **R5** | Settings row: `Ruler interval` cycle chip, `lite:ruler` persistence, pinned major still subdividing | low |
| **R6** | Verify | — |

R3 is the one that matters. "Labels appear at 5s" and "labels appear at 5s
**and never collide with the readout and never exceed ~70 nodes**" look
identical in a screenshot.

---

## 11. Verification

No automated tests exist for this mock, so this is a measurement list. Read the
values out of the live page; do not eyeball them.

**Density ladder** — at each `pps`, assert what was actually emitted against
§4.3: major step, minor step, and an **integer** `major/minor` at every row.

**The default is the contract** — `Fit` on a 20s clip at 378px must give
`pps≈15.1`, majors every 5s, minors every 1s. If that one line holds, the rest
of the ladder follows from the arithmetic.

**Collisions** — readout at 00:07, labels on 5s: assert no `<b>` box intersects
the ±56px centre window, at every `pps` in §4.3, and that the guard still holds
for a `10:00` label.

**Windowing** — a 10-minute project at max zoom: node count under 80. Scroll the
full length and assert the strip never shows a gap, including at full speed.

**Zoom response** — label count on screen stays in 3–6 from pps 2 to pps 240. A
count past 8 means `LABEL_PX` is too small.

**Shell** — `scrollHeight === clientHeight` at 320×700, 357×836, 378×770,
390×844. The ruler must not cost the band a single pixel; it lives in `.ro`,
which `fitView()` already counts, so any growth here is a regression to the
preview. Both themes.

**Regression** — drag, trim, split, snap-to-playhead and undo must read the same
geometry as before. `snapV()` and the trim maths share `pps` with the ruler and
must not acquire a second source of truth for it.

---

## 12. Status

Not started. The mock is at `c9686af`; the tree is clean as of that commit apart
from this plan and the hub link.
