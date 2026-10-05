# R0 — the reference film, and what the four artifacts could not say

**Phase:** R0 (spec-first, no compiler). **Status: gate passed.**
**Film:** *A Breath of Air* — the repo's shipped showcase,
`automation/html-in-canvas/examples/pollution-story.js`, 4 scenes, 26 s, 1920×1080, 30 fps.
**Artifacts:** [`Design.md`](Design.md) · [`Frame.md`](Frame.md) ·
[`Storyboard.md`](Storyboard.md) · [`storyboard.json`](storyboard.json) ·
[`Storyboard.html`](Storyboard.html)

> R0's rule is that it **ships no code**. The only executable thing here is
> `Storyboard.build.cjs`, the authoring aid that produced `Storyboard.html`; R1
> replaces it with the real compiler. It regenerates the committed reel
> byte-for-byte (`node Storyboard.build.cjs`). The measurement harness was
> throwaway and is not checked in.

---

## 1. The verdict

The film **can** be expressed as Markdown. Every word on screen, every colour,
every number and every timestamp is in the three documents, and the reel
compiled from them renders **byte-identical** to the film.

| check | result |
|---|---|
| frame count | reference 180 + 210 + 210 + 180 = **780**; reel **780** ✅ |
| per-frame pixels | **780 / 780 identical** (sha256 of every PNG) ✅ |
| mean luma, per scene | scene 1 **1.61**, scene 2 **16.46**, scene 3 **1.75**, scene 4 **55.67** — identical both sides, **max delta 0** over all 780 frames ✅ |
| HTML in `Storyboard.md` | **none** — the copy is plain text throughout ✅ |

So the format is *sufficient*. What follows is what it is **not yet expressive
enough to be pleasant**, and what that costs R1.

## 2. The design space is a lie in the plan, and the film is the proof

`Studio-Reel-Plan.md` §3.2 declares `design space: 800 × 450`. The film that
actually ships is authored in **output pixels**: a 104px title, a 620px orb, a
330px card, a 1180px grid, a 46px footer inset.

`Frame.md` declares `1920 × 1080`, because that is what the film is. This is the
roadmap's own "Two time models (design space vs output px)" risk, and it is
**already realised** — not as a future hazard but as the shipped corpus. R2 has
to pick: rescale the corpus, or redefine the design space. Whichever it picks,
the `text-overflow` and measure passes are the things that break, because a
layout engine that assumes 800×450 will lay out a 1920×1080 film differently.

## 3. There are no exits

The plan specifies `exit: fadeOut 0.3s`. The film uses **none** — all four scene
boundaries are hard cuts. `fade_out_ms` is 0 everywhere.

This matters beyond tidiness: `compileStoryboard` already implements scene
cross-fades (`sc.fo`, with `visibility` ramping over the last `fo` ms). So the
IR has a feature the reference film never exercises, and the reference film has
a behaviour — the hard cut — that nothing in the emitter reproduces, because a
reel is **one clip** and a one-clip reel cannot cut. §4 below is the same
problem wearing a different hat.

## 4. §3.5's IR does not match the emitter it claims to feed

The plan says `storyboard.json` is "internal, emitted by the compiler and
consumed by `hic-storyboard.js`", and shows it as `meta` / `tokens` / `frame` /
`scenes[{frame, start, dur, elements}]`.

`compileStoryboard` actually reads:

| §3.5 says | the emitter reads |
|---|---|
| `meta.title` | `sb.title` (top level) |
| `meta.duration` | `sb.total_duration_ms`, else `scenes[last].end_ms` |
| `scene.start` / `scene.dur` | `scene.start_ms` / `scene.end_ms` |
| — | `sb.background` — a single flat colour |
| — | `element.at_ms`, `element.in.{start_ms,dur_ms,type,overshoot,stagger_ms}` |
| — | element types `text · latex · answer · cards · image · shape` only |

`storyboard.json` here is written in the **§3.5 shape** as R0 specifies, and it
therefore **does not compile today**. Reconciling the two is R1's first job and
is smaller than it looks — but it must happen before anything else, because
every downstream phase assumes one IR.

## 5. Nine things the IR cannot yet say

Recorded in `storyboard.json` under `x_summary`, and repeated here because they
are the real output of this phase:

1. **Per-scene background.** Four gradients; the emitter has one `sb.background`
   for the whole reel. This is the single biggest gap — it is also the most
   visible thing in the film.
2. **`stat`** — a gradient-filled numeral over a caption, stacked. The emitter's
   `text` has a size and a colour, and no gradient fill.
3. **`card`** — a 330px panel carrying a numeral, a caption, *and* an
   independently-animated meter bar. The emitter's `cards` is a row of 56×78
   glyph tiles.
4. **`tiles`** — a **2×2 grid** of emoji + head + body. The emitter has no grid
   and no concept of an emoji glyph.
5. **`pills`** — a row of bordered chips.
6. **`credit`** — an absolutely-positioned footer at a specific inset.
7. **`ambient`** — infinite decorative loops with `ease-in-out`. The emitter has
   three hardcoded eases (`pop` cubic, `slide` ease-out, `fade` ease-out) and no
   loop concept.
8. **`ease` as data** — the film uses five distinct curves. See §7.
9. **A title size that varies per scene** — the ramp has one size per role, but
   the film runs 104 / 96 / 82 / 78.

## 6. The copy budget was never tested

`Frame.md` inherits `≤ 12 words per beat, ≤ 2 lines`. The film's longest lead is
11 words and **nothing wraps**. So the constraint is untested at its edge — the
layout pass of R2 will hit its first real overflow on film number two, not on
this one. R0 cannot claim the budget is right; it can only record that the
reference film never needed it.

## 7. Two bugs found in the existing pipeline, not in the reel

Both predate Studio Reel. Both are *reproduced faithfully* by the reel — the gate
requires it — and both are worth fixing on their own merits.

### 7.1 `animation-direction: reverse` is silently dropped

`orb-b` is authored `animation: drift 11s ease-in-out infinite reverse`. The
adapter parses `direction` into the spec (`generateWAAPIAdapter` copies it) and
the emitted runtime then **never reads it** — `progressAt()` and `run()` use
`dur`, `iter`, `fill`, `delay`, `ease`, `steps`, and `direction` is dead. The
orb drifts the same way as `orb-a` in the shipped MP4.

### 7.2 A stagger declared on a sibling selector never arrives

`.stat:nth-child(1) { animation-delay: 1.2s }` and `:nth-child(2) { 1.5s }` are
meant to stagger the two statistics. But `compileKeyframes` only creates a spec
for a rule that has an `animation:`/`animation-name:` declaration, and
`:nth-child(n)` has only `animation-delay` — so no spec is made, the delay is
stripped from the stylesheet by the rebuild, and `.stat`'s own spec carries
`delay: null`. **Both statistics enter together at t=0.**

The same applies to the scene 2 cards (`.c1/.c2/.c3`), the scene 3 grid cells
(`.g1`–`.g4`), and the scene 4 pills (`.a1`–`.a3`): every declared stagger in
the film is authored and then dropped. The film *looks* right because each
group's members are near-identical, so the loss is invisible.

**R0's copy of the IR records the rendered truth** (`at_ms: 0`), not the
authored intent, because the IR describes what will render. Fixing 7.2 properly
means teaching the adapter that a bare `animation-delay` refines the spec for
the same base selector — which would *change the film*, and so is deliberately
**not** done inside R0.

## 8. What compiling one reel from four clips actually required

Not in the plan, and the most mechanical part of the phase:

1. **Namespace the keyframes.** Four scenes each define `fadeUp` with a
   different distance (28 / 26 / 24 / 26px). In one stylesheet the last wins and
   three scenes animate the wrong distance. Every `@keyframes` must be renamed
   per scene, and every `animation:` reference with it.
2. **Scope the selectors.** `.kicker` exists in all four scenes with different
   sizes and colours, so each rule needs its scene as an ancestor — and the
   scene root itself (`.scene`) needs `.scene.sN`, not `.sN .scene`, or it stops
   matching itself and the scene silently loses its background and its centring.
3. **Subtract the scene start.** The reference captures four clips each
   `0..duration` and places them on a timeline; a reel has one `t`. Scene 2's
   frame 0 is `onFrame(0)` in the reference and `onFrame(6000)` in the reel. The
   boundaries land exactly on frames here only because every scene is a whole
   number of seconds — **a reel with a 6.5s scene needs frame-indexed bounds,
   not millisecond ones.**
4. **Take the stripped half of the CSS.** `htmlToHicCode` keeps
   `compiled.css`, not the authored CSS, because a still-running `@keyframes`
   beats the inline styles `onFrame` writes. A reel that shipped its authored CSS
   would animate on the wall clock and be wrong every frame.

Two of these cost a full 780-frame render each to find, because neither shows up
in any static check: a mis-scoped selector still *compiles* (selectors are opaque
strings to `compileKeyframes`), and a shadowed `SPECS` table still *runs* (the
IIFE is syntactically fine). Only the frame diff catches them. **That is the
argument for R0's gate being a render and not a test.**

### 8.1 And one thing the gate could NOT catch

The first passing build wrapped each scene in an extra `<div class="scene sN">`
around the film's own scene root. Both elements matched `.scene.sN`, so the
flex centring and the background gradient were applied twice — and the render
was **still 780/780 byte-identical**, because applying the same centred layout
twice lands in the same place.

So the gate passed on a DOM that was structurally wrong, and it passed for a
while before it was noticed by reading the output rather than the pixels. The
wrapper was removed and the gate re-run (780/780 again).

**A pixel gate cannot see structure.** R1 needs a structural assertion beside
the render — one scene root per scene, no wrapper elements — or the next person
to "fix" the DOM will do it again and the gate will cheer.

## 9. Gate

**PASS.** 780/780 frames byte-identical; max luma delta 0; frame counts equal;
no HTML in `Storyboard.md`.

The format can express the film. R1 is unblocked.
