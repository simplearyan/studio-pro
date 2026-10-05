# Studio Lite — timeline space plan

**Status:** **C1–C3 are applied** to the mock — the ceiling exists, it is ratio-aware, and it lives in one
function (§10 records the measurements and the bug that hid it). **C4–C11 are still plans**, which means
the band currently carries visible air: that air is precisely the space C6–C9 is meant to spend. Ships as
**Part C** alongside the geometry work in [`CHROME-DECLUTTER-PLAN.md`](CHROME-DECLUTTER-PLAN.md) (B1–B5,
applied).
**Subject:** [`clip-lite-mock.html`](clip-lite-mock.html).
**Spec:** [`../STUDIO-LITE-PLAN.md`](../STUDIO-LITE-PLAN.md) §5.3 (touch ergonomics), §6.1 (layout by tier).
**Depends on:** [`CLIP-LITE-PATTERN-PLAN.md`](CLIP-LITE-PATTERN-PLAN.md) §11 — the text/caption lane split,
which is what the space freed here is for.

**The ask.** The header became an overlay, so the preview band now runs from y=0 and took the whole 56px
on offer. That fixed the preview and broke the balance: the preview is **61%** of a 378×770 screen while
the timeline band — the one surface a user actually works in — is **19%**. Give the dock and the tracks
more of the screen, so a lane is a lane and not a ribbon.

---

## 0. The finding, in one paragraph

The preview is the only row in the column with `flex:1` and no ceiling, so it absorbs **every** spare
pixel on every device. That was correct when the header was a row competing for space; now that the
header is an overlay it means the preview wins the whole negotiation by default, and the timeline is
whatever is left over. On 378×770 that is 469px of picture against 148px of timeline, of which 108px is
actual lane and 40px is gutter and padding. The fix is not to shrink the preview — it is to **give it a
ceiling and let the timeline take the slack**, then spend that slack on lanes that are readable. The
same change also unlocks the one thing the lane roadmap cannot currently afford: a text lane and a
caption lane need ~76px that does not exist today.

---

## 1. The budget as it stands

Measured in the running mock, `getBoundingClientRect`, light theme, one portrait clip
(`…T120521.213`), 378×770:

| row | px | % of screen |
|---|---|---|
| **preview `.view`** | **469** | **61%** |
| transport `.ar` | 52 | 7% |
| readout `.ro` | 30 | 4% |
| **timeline `.tlw`** | **148** | **19%** |
| rail `#tools` | 67 | 9% |
| | 766 | 100% |

And inside that 148px band:

| | px |
|---|---|
| ruler gutter (band top → film top) | 20 |
| film `#track` | **64** |
| gap | **4** |
| audio `#atrack` | **44** |
| bottom padding | 16 |
| **lane content** | **108** |
| **unused / air** | **0** |

The last line is the important one. **The band is full.** It is not that the lanes are short — it is that
there is no room for anything else, so the 40px of gutter and padding are the only slack in the system
and every future lane has to fight the film for pixels.

---

## 2. What the reference does differently

Read from the YouTube Create frames, and worth separating carefully because **two of the three "obvious"
deltas are not real**:

- **Not a lane-height difference.** The reference's film lane reads at roughly **50 CSS px** and its audio
  lane at **40** — both *smaller* than the mock's 64 and 44. Growing the film to match a taller reference
  would be copying something that isn't there. The mock's lanes are already generous.
- **Not a preview-share difference.** Both land near 60% of the screen on the preview. The reference is
  not more frugal with the picture.
- **What is different is air and separation.** The reference's lanes sit in a band with clear gaps
  between rounded cards, and there is space above the first lane and below the last. Its timeline region
  looks unhurried because nothing is flush against anything else — not because the lanes are tall.

So the target is not "taller lanes" but **a band with room to breathe, plus the two lanes the roadmap
needs and cannot currently place.** That reframes where the pixels should go, and it is why §5 spends them
on structure (gaps, gutters, the caption lane) rather than on inflating the film.

---

## 3. The rule

> **The preview band has a ceiling. Everything above the ceiling goes to the timeline.**

Two changes, in order of value:

**3.1 — A flat ceiling (the cheap half).**

```css
.view{flex:1 1 auto;max-height:54%}   /* was: flex:1, no cap */
.tlw{flex:1 1 auto}                   /* was: content height */
```

At 378×770 the preview falls 469 → **416px** and the band rises 148 → **216px**. One declaration pair.
`.tlw` must *also* be allowed to grow, or the surplus becomes a void under the rail instead of band.

**3.2 — A ceiling that knows what the canvas needs (the bigger half, and it is nearly free).**

A flat 54% is wrong for half the projects, because the preview only *needs* height when the canvas is
height-hungry. At a 378px screen the inner width is 354px, so:

| canvas | height it actually needs | flat 54% cap | wasted |
|---|---|---|---|
| `16:9` | 354 × 9/16 + 12 = **211px** | 416px | **205px** |
| `1:1` | 354 + 12 = **366px** | 416px | 50px |
| `4:5` | 354 × 5/4 + 12 = **455px** | 416px | 0 (capped) |
| `9:16` | 354 × 16/9 + 12 = **641px** | 416px | 0 (capped) |

A landscape project is handing the picture **205px it cannot use** — on every screen, in every session.
Setting the cap to the canvas's natural height (clamped by 54%) is therefore worth more than the flat cap
itself for anything that isn't portrait:

```js
/* called from applyProj()/resize — one line of arithmetic, no new state */
const inner = view.clientWidth - 24;
view.style.maxHeight = Math.min(inner * H / W + 12, innerHeight * 0.54) + 'px';
```

With a 16:9 canvas the band drops to 211px and the timeline gets **469px** — nearly half the screen — with
no settings, no toggle and nothing for the user to discover. The tap-to-play area shrinks with it, which
is the honest cost; §8 refuses to fix that by hiding the scrubber.

---

## 4. Where the pixels come from

The ledger at 378×770. Three sources, and none of them is the preview alone:

| source | change | px freed |
|---|---|---|
| preview ceiling | 61% → 54% (416px) | **+53** |
| transport `.ar` | 52 → **48** — glyphs are 21px, 48px still clears the 44px floor | +4 |
| rail `#tools` | 67 → **60** — 22px icon + 11.5px label + tighter padding | +7 |
| **total** | | **+64** |

The transport and rail trims are only safe *because* of B3 and B4: with 20–22px glyphs and 11.5px labels
neither row is tight any more. They are the cheapest 11px in the file.

**Not a source, and worth saying so:** the readout row (30px) stays. It was moved there from the header
once already, and it is the only place a duration can be read while scrubbing.

---

## 5. Where the pixels go

It is spent on structure first and height second:

| | now | after | Δ | why |
|---|---|---|---|---|
| ruler gutter | 20 | **24** | +4 | the tick row and the playhead's top need to clear the readout above |
| **text lane** (empty today) | 0 | **18** collapsed | +18 | the thin-bar lane from the pattern study §11 — it does not exist yet |
| gap | — | 6 | +6 | separation, per §2 |
| film `#track` | 64 | **78** | +14 | bigger tiles: at 9:16 a 78px lane yields 44px-wide thumbnails against 36px today |
| gap | 4 | **8** | +4 | the film and the waveform stop touching |
| audio `#atrack` | 44 | **58** | +14 | a waveform with readable amplitude, not a ribbon |
| bottom padding | 16 | 20 | +4 | a lane can end without hitting the rail |
| **lane content** | **108** | **136** | **+28** | |
| **band needed, no extra lanes** | **148** | **188** | **+40** | |
| **band needed, text lane present** | 148 | **212** | +64 | |
| **band needed, text *and* captions** | 148 | **264** | **+116** | |

Those last three rows are the honest shape of this plan: **the freed 64px pays for the text lane and
nothing more.** The caption lane's 52px has to come from the ceiling giving way, which is §5's second
half.

**Film 64 → 78 is a deliberate correction to the plan's own framing.** §2 says a taller film is *not* what
the reference teaches — but 78 is not "match the reference", it is "spend the slack on the thing the user
looks at", and it stops 24px of the freed height becoming pure air. If the tiles read too large in the
running mock, 72 is the conservative value; the gap and gutter lines are the parts that must not shrink.

**The permanent lane stack this makes room for** (pattern study §11):

```
ruler gutter        24
text lane           18   ← collapsible, empty when there is no text
gap                  6
film                78
gap                  8
caption lane        44   ← fixed height, no overlap packing, only when captions exist
gap                  8
audio               58
bottom pad          20
─────────────────────
                   264px
```

The stack is 264px. At 378×770 there are 632px below the chrome (48 + 30 + 60), so both cannot have what
they want, and the order of precedence has to be written down:

> **The band gets what its lanes need. The preview gets everything else, up to 54%, and never less than
> 46%.**

At 378×770 that resolves as:

| state | band needs | preview | band | preview % |
|---|---|---|---|---|
| no text, no captions | 188 | 416 | 216 | 54% |
| text present | 212 | 416 | 216 | 54% |
| text **and** captions | 264 | 368 | 264 | **47.8%** |

The mid state is free: the text lane's 24px fits inside the 216px the cap already produced, and costs the
picture nothing. Only the full stack forces the ceiling down, and only by 6 points — which is the right
trade, because a user who has added both text *and* captions has opted into a busier timeline and is the
one user for whom the picture can afford to be smaller.

**The floor is 46%, and 320px is where it is actually tested.** At 320×700 there are 562px below the
chrome. At the floor the preview takes 322, leaving 240 for a stack that needs 264 — **24px short.** No
amount of re-tuning lanes closes that, so the third lever is the readout row: fold it into the transport
row at 360px and below (the timecode joins the play button, as `§5` of the chrome plan once proposed and
§11 rejected *for the header* — this is the transport, a different argument). That converts 48 + 30 into
52, returns 26px, and lands the worst case at **324px / 46.3%**, on the floor, with the lanes intact.

Below 320px the answer is a lane that collapses, never a scrollbar and never a preview under 46% — under
46% a 9:16 canvas is narrower than 42% of the screen and stops being editable.

---

## 6. Before / after, at three sizes

No text lane, no caption lane — today's normal project. Band height and lane sum, with the ratio-aware
cap in place:

| | 320×700 | 366×836 | 378×770 |
|---|---|---|---|
| **now** preview | 401 (57%) | 535 (64%) | 469 (61%) |
| **now** band | 148 (21%) | 148 (18%) | 148 (19%) |
| **now** lane sum | 108 | 108 | 108 |
| **after** preview | **374 (53%)** | **451 (54%)** | **416 (54%)** |
| **after** band | **188 (27%)** | **247 (30%)** | **216 (28%)** |
| **after** lane sum | **136** | **136** | **136** |
| air left in the band | 0 | 59 | 28 |

The lane content grows **+26%** and the band **+27% to +78%** depending on which lanes exist, paid for
with **3 to 7 points of preview** and 11px of chrome. The air column is not waste — it is the band
holding the space the text and caption lanes will take without moving anything else when they arrive.

Each row adds up: preview + 48 + 30 + 60 + band = the viewport height.

---

## 7. Build order

| # | Step | Risk | Verifies |
|---|---|---|---|
| **C1** | `.view{max-height:54%}` + `.tlw{flex:1 1 auto}` | low | band 148 → 216 at 378×770, no void under the rail |
| **C2** | Ratio-aware cap from `applyProj()` | **medium** | 16:9 hands ~205px to the band; 9:16 unchanged |
| **C3** | Isolate `.view`'s ceiling in one function (`fitView()`) so C2 has a home | low | one call site, called on resize + ratio change |
| **C4** | Transport 52 → 48 | low | every control still ≥44px |
| **C5** | Rail 67 → 60 | low | 22px icon + 11.5px label, target still ≥44px |
| **C6** | Gutter 20 → 24, gaps 4/0 → 8/6, bottom 16 → 20 | low | measured: no lane overlaps another |
| **C7** | Film 64 → 78, audio 44 → 58 | low | filmstrip regenerates at the new tile width; waveform still legible |
| **C8** | The text lane (18 collapsed) and `.tx` re-tuned to it | **medium** | the §11 lane measurements still hold |
| **C9** | The caption lane at fixed 44px, no overlap packing | **medium** | one overlapping cue does not grow the lane |
| **C10** | The ceiling's give-way rule when both lanes exist | medium | the §5 table reproduces; the 46% floor is never crossed |
| **C11** | At 360px and below, fold the readout row into the transport | **medium** | 320×700 with text **and** captions keeps the lanes and lands at 46.3%, not 42.6% |

**C1–C3 are done** — see §10. Everything from C4 down is still open, and until C6–C9 land the band holds
more air than lanes, deliberately: that air is where the film, the waveform and the two new lanes go.

**Regression tests.** The P1 invariant from [`CHROME-DECLUTTER-PLAN.md`](CHROME-DECLUTTER-PLAN.md) §13 — a
ratio change must not move anything below the transport — now has a second half: **a ratio change must not
change the band's own height either**, except through `fitView()`. Drive `9:16 → 16:9 → 1:1 → 4:5` and
assert both. Then: 320×700, 366×836, 378×770, 390×844; light and dark; empty state; one clip; two clips
with a junction; text present; captions present; sheet open; fullscreen. Real media from
[`TEST-MEDIA.md`](TEST-MEDIA.md) is mandatory for C7 — the silent landscape clip is the only way to see
the audio lane at its new height without a waveform to hide behind.

---

## 8. Refusals

- **Do not shrink the preview by hiding the canvas chrome.** The ⛶ and the scrub area are not the
  currency; if the picture gets smaller it stays fully usable.
- **Do not make the band scroll vertically.** A timeline that scrolls on both axes is a spreadsheet.
- **Do not let a lane's height depend on its content** anywhere except the text lane's empty/non-empty
  state. The caption lane is fixed at 44 for exactly one overlapping-cue reason (pattern study §11).
- **Do not take the trims from the readout row.** It is the only place a duration is readable while
  scrubbing, and it has already been moved once.
- **Do not make the ceiling a percentage the lanes can't use.** If the canvas cannot fill it, the space
  goes to the timeline — that is the whole point of C2.

---

## 9. Open questions

1. **Should the band's height be user-draggable?** Neither the reference nor CapCut offers it, and a drag
   handle costs a row and a gesture that fights the horizontal scrub directly beneath it.
   *Recommendation:* no; C2 does the job without a control.
2. **Is film 78 right, or 72?** It is the only number in §5 chosen for feel rather than for a constraint.
   Verify against the two real clips and settle it there.
3. **Does the rail shrink further with a caption lane present** (60 → 52 by dropping to one row)? It would
   buy 8px at the cost of making the rail's contents inconsistent between sessions.
   *Recommendation:* no — inconsistent chrome is worse than 8px.
4. **Should `fitView()`'s ceiling be a user preference** (`lite:previewCap`)? It is the kind of thing a
   user would set once and never find again. *Recommendation:* defer until someone asks.
5. **Does the P1 test need the band's height asserted as a number, or only as "unchanged"?** The former
   breaks whenever C7 is re-tuned; the latter cannot catch a drift. *Recommendation:* assert unchanged.

---

## 10. Applied: C1–C3

**Done in [`clip-lite-mock.html`](clip-lite-mock.html).** C4–C11 remain plans.

**The mechanism, as built.** `fitView()` is the single place the preview's height is decided, and it
computes a ladder rather than a percentage:

```js
const cap = innerHeight*0.54, floor = innerHeight*0.46;
const want = clamp(innerWidth*d[1]/d[0] + 12, floor, cap);   // what THIS canvas would use
const lanes = tl.scrollHeight + 8;                           // the band's floor: its lanes must fit
const avail = document.body.clientHeight - (transport + readout + rail + dock padding);
let band = clamp(avail - want, lanes, lanes + 64), view = avail - band;
if (view > cap)   { view = cap;   band = avail - cap; }      // the ceiling wins; surplus becomes band air
if (view < floor) { view = floor; band = Math.max(lanes, avail - floor); }
```

The preview's ceiling is the inline `flex-basis` that line writes; `.view{max-height:54%}` in CSS is only
there to guard the first paint. `.dock` became a flex column and `.tlw` absorbs, which is the only reason
the band can take the slack at all — `.tlw` was a block child before, so `flex:1` on it would have done
nothing.

**Measured, `getBoundingClientRect`, one portrait clip:**

| viewport | ratio | preview before | preview after | band before | band after |
|---|---|---|---|---|---|
| 320×700 | 9:16 | 401 (57%) | **378 (54%)** | 148 (21%) | **171 (24%)** |
| 320×700 | **16:9** | — | **337 (48%)** | — | **212 (30%)** |
| 366×836 | 9:16 | 535 (64%) | **451 (54%)** | 148 (18%) | **232 (28%)** |
| 378×770 | 9:16 | 469 (61%) | **416 (54%)** | 148 (19%) | **202 (26%)** |
| 378×770 | **16:9** | — | **405 (53%)** | — | **212 (28%)** |
| 390×844 | 9:16 | — | **456 (54%)** | — | **235 (28%)** |

**C2 is real and it is largest where it matters most.** At 320×700 a landscape canvas gives the band
**41px more** than a portrait one (212 against 171) and takes 41px less preview, because it genuinely
cannot use the height. At 366×836 the difference disappears — not because the rule stopped working, but
because the band is already at its air cap on a screen that tall, and the leftover is better spent on the
preview than on a void. The ceiling holds at 54% in every measured case.

**One bug, found by measuring rather than reasoning.** The first cut cleared the inline cap with
`v.style.maxHeight=''`, which does not mean "no cap" — it means "fall back to the stylesheet", so
`.view{max-height:54%}` clamped the computed height back to a flat 54% and **silently disabled C2
entirely**. Every 16:9 and 1:1 measurement came out identical to 9:16 until the values were printed side
by side. The line now writes `'none'` explicitly.

**One behaviour changed in character, and it is worth naming.** Text is rendered in a lane *above* the
film, so adding the first text overlay pushes `#track` down by the lane's full 36px. Before this change
the band grew upward and absorbed 28 of it, so the film moved 8px and the *preview* paid. Now the band is
sized first, so the film takes the whole 36px shift instead. The band's air absorbs it without anything
clipping — verified: the audio lane's bottom stays inside the band at 320×700 and 366×836 — but this is
[the pattern study's Correction 1](CLIP-LITE-PATTERN-PLAN.md) and it is **C8's** job to fix, by reserving
a constant lane height. Until then, adding text moves the film.

**Also verified:** the empty state sizes correctly with no clips; opening the settings sheet returns the
stage to `flex:1 1 auto` so the preview fills, and closing it restores the computed height exactly; the
rail stays pinned to the bottom with no page scroll (`scrollHeight === innerHeight` at 390×844); the P1
invariant holds (`#tools` does not move when the ratio changes); and the console stays empty.

**Since §10: `fitView()` grew a second job, and one of its inputs was a lie.** The header scrim was
deleted ([`CHROME-DECLUTTER-PLAN.md`](CHROME-DECLUTTER-PLAN.md) §20), so the header now has to decide from
the same numbers whether it can stand beside the picture instead of on it. `fitView()` derives the canvas
width from the height it just chose and measures the leftover margin, which is exactly the same ladder
above, one term further. It also stopped hardcoding `clientWidth-24` for the stage padding and reads the
computed value instead — the assumed 24px is only true below 900px, and a width that does not exist is a
bad input to a decision. Neither change touches the numbers in the table: at the four sizes in §10 the
padding is 12px per side and the table still reproduces.

---

*Plan produced 2026-10-02. §10 records the C1–C3 implementation in the same file. Measurements from
`clip-lite-mock.html` at the viewports in §10, one portrait clip (A in [`TEST-MEDIA.md`](TEST-MEDIA.md)).*
