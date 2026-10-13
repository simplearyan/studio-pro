# Prompt flexibility plan — length · aspect · continuous motion · transitions

A follow-up to `PROMPT-STABILITY-PLAN.md`. That plan made the contract *stable*
(purity, no text mutation, transform/opacity-only, length discipline). This one
makes it *flexible*: the AI should feel free to author a longer clip, compose for
whatever aspect it was handed, run a continuous camera-glide when the idea calls
for it, and cut between scenes with a **deliberate, varied** transition instead of
always the same crossfade.

Everything here is grounded in two clips the owner produced with the current
prompt — `Clip_Flow_Hook_code.json` (5 s, two discrete scenes) and
`Clip_Flow_Annotate_code.json` (declares 10 s, continuous camera-glide). Both are
*well built* (timing tables, pure helpers, transform/opacity-only, guarded
lookups, `display:none` culling). The plan codifies what they do right and fixes
the one real bug they expose.

## 0. Evidence (measured, not assumed)

| what | Hook | Annotate | why it matters |
|---|---|---|---|
| declared `duration` | 5 000 ms | **10 000 ms** | the editor honors this number |
| actual `T.dur` span in JS | `[0, 5000]` ✅ | **`[0, 5000]`** ❌ | Annotate animates only the first half → **frames 5–10 s are a frozen dead tail** |
| scene model | 2 discrete scenes (`sceneA[0,2800]`, `sceneB[2300,5000]`) | 1 continuous camera-glide (`camX` = −360 px then −240 px) | both models are legitimate and already in use |
| scene transition | overlap crossfade + scale-down (`aOut[2300,2800]`) | n/a — no cut, the camera *is* the transition | the one transition Hook has is a crossfade; nothing tells the AI to vary it |
| offscreen culling | `display:none` on finished scene | `display:none` on `txt`/`sB`/`tiles` once past | correct today, but only as a side-effect of rule 12 — never generalized to "hide when fully offscreen" |
| aspect | 16:9 (no `ds` marker) | 16:9 (no `ds` marker) | rule 3 is now generated, but nothing *composes* for the aspect |

**Root cause of the dead tail:** the CLIP DURATION line says *"Choreograph the
animation to complete within that time."* Read as a **ceiling**, an AI aiming for
"two nice scenes" fills ~5 s and stops — then the declared 10 s drags a static
frame for 5 s. The instruction is honest but invites under-filling. There is no
counter-instruction that says *the timeline must be fully occupied*.

## 1. Length freedom — "fill the whole span, and you may ask for more"

Two coordinated edits so the number is read as a **target to fill**, never a cap.

**1a. The CLIP DURATION line (`:550`) stops being a ceiling.**

```
CLIP DURATION: {dur} ms. This is your timeline — occupy all of it. Choreograph
so the last beat lands at (or within ~150 ms of) the declared end; a clip that
finishes early and freezes is a defect. If your idea genuinely needs more room,
use the full span you were given and pace it — do not compress into the first
half.
```

**1b. A LENGTH section makes >5 s explicit and normal.** Add a `LENGTH:` header
block after SCENE PACING (same tint machinery as SCENE PACING — register the
label in `ACC` at `:797` and `SEC_ICONS` at `:803`):

```
LENGTH:
Any duration is fine — 3 s stings to 60 s explainers. Longer is not "too much";
a 20-30 s clip is normal. Fill every second with motion or intentional hold.
Never stop animating early and freeze on the last frame.
```

This directly answers "they can create longer animation more than 5 seconds …
don't restrict". The bands in `scenePacing` (`:532`) stay — they just read as
*pacing guidance for the length you have*, not a suggestion to stop.

## 2. Aspect fluency — compose, don't just resize

Rule 3 already emits the right `W x H` and `ds` marker (stability plan §4). What's
missing is **composition** guidance so a 9:16 clip is actually laid out for a
tall frame instead of a 16:9 layout squeezed into it. Fold one sentence into the
generated rule 3 (`:519`), keyed off `dsLabel`:

- **16:9 / 1:1** — "compose horizontally; side-by-side or centered."
- **9:16 / 4:5** — "compose vertically; stack elements top-to-bottom, keep key
  content in the middle 70 % of the height (top/bottom are UI-safe zones), avoid
  long horizontal side-by-side rows."

No new section — it rides the existing generated rule so the aspect and its
layout advice can never drift apart.

## 3. Continuous motion + offscreen culling — a second first-class scene model

Today the prompt implies discrete scenes (SCENE PACING talks only about scene
counts). Annotate proves a **continuous camera-glide** is a strong alternative:
one `world` container translated on X, parallax layers at fractional speed,
content revealed by camera position rather than by scene swaps. Make it explicit.

**3a. A SCENE MODEL section** (register `SCENE MODEL` in `ACC`/`SEC_ICONS`),
offering both models so the AI picks by intent:

```
SCENE MODEL:
Pick one and commit:
- DISCRETE SCENES — 1-3 scenes, each fully composed, joined by ONE deliberate
  transition (see TRANSITIONS). Best for a single idea with clear beats.
- CONTINUOUS GLIDE — one wide "world" wider than the stage, translated on X or Y
  by a camera function; parallax layers move at a fraction (e.g. 0.3x) for depth;
  content is revealed by camera position, not scene swaps. Best for a journey,
  a scroll, or "one thing leads to the next".
Both are valid. Do not mix halfway — a glide that also hard-cuts defeats itself.
```

**3b. Offscreen culling becomes a stated rule, not a side-effect.** Extend rule
12 (`:528`) with one clause — the correct instinct both clips already showed:

```
Anything fully outside the stage for the current time gets display:none
(finished scenes, content the camera has left behind). A glided-past element
still costs raster time every frame unless you hide it.
```

This generalizes Annotate's `txt.style.display = t < T.txtOut[1] ? "block" : "none"`
into a rule the AI applies everywhere, and it keeps the per-frame raster small on
long clips.

## 4. Transition variety — name the cut, don't default to a crossfade

Hook's only transition is an overlap crossfade. Nothing in the prompt asked for a
*kind* of transition, so the AI reached for the generic one. Add a TRANSITIONS
section (register in `ACC`/`SEC_ICONS`) with a small vocabulary so the AI chooses
consciously and varies across a series:

```
TRANSITIONS:
When you use DISCRETE SCENES, the join between them is a designed beat — pick a
specific one, don't default to a plain crossfade:
- WIPE — a mask slides across, revealing the next scene (clip-path or a wrapper).
- SLIDE/PUSH — outgoing scene exits as the incoming one enters (translateX/Y).
- SCALE-MORPH — outgoing scales/fades down as incoming scales up (Hook's join).
- CUT — hard cut on a beat, no blend; strong when scored to music.
- WHIP — fast blurred pan that lands on the new scene.
Give the join 300-600 ms and land it on a timing-table entry. Across a multi-clip
series, vary the transition between clips so it doesn't read as one effect on loop.
```

## 5. Where it lands in `prompts-engineer.html`

| change | site | notes |
|---|---|---|
| CLIP DURATION line reworded | `:550` | occupy-the-span + no-freeze |
| LENGTH section | after `:552` | register `LENGTH` in `ACC:797` + `SEC_ICONS:803` |
| aspect composition clause | generated rule 3, `:519` | keyed off `dsLabel`, 9:16/4:5 get vertical advice |
| SCENE MODEL section | new, after SCENE PACING | discrete vs continuous-glide; register label |
| offscreen-culling clause | rule 12, `:528` | one added sentence |
| TRANSITIONS section | new, after SCENE MODEL | 5 named transitions + variety note |

Every new header must be added to **both** `ACC` and `SEC_ICONS` (the same
mistake that caused the `SCENE PACING` infinite-loop bug — an unrecognized
`XXX:` header stalls the tint loop). The tint loop's never-stall guard from the
stability fix already protects against a miss, but registering is what makes them
*render as sections* rather than plain text.

## 6. Verification

1. **Dead-tail regression:** build a 20 s prompt — the LENGTH block must say any
   duration is fine, and CLIP DURATION must read "occupy all of it". Ask Claude
   for a 20 s clip on that prompt; import it; the authored-length probe must land
   near 20 s, not 5 s.
2. **Aspect:** set the frame bar to 9:16 — rule 3 must carry the vertical
   composition clause and the `ds` marker; 16:9 keeps the horizontal one.
3. **Scene model:** both SCENE MODEL options present; a glide brief produces one
   `world` container, a discrete brief produces N scenes + one named transition.
4. **Transitions:** the section lists all five and the variety note.
5. **No tint regression:** every new header renders as a section (no infinite
   loop, console clean) — the never-stall guard plus correct `ACC` registration.

## 7. Non-goals

- No renderer changes. No new duration cap logic — the editor already adopts the
  true authored length via the probe; this plan only fixes the *instructions* that
  caused the AI to under-fill in the first place.
- Not touching the stability rules 8-11; rule 12 gains one clause and that's all.
