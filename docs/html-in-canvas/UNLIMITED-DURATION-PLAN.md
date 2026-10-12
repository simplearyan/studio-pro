# Unlimited clip duration — plan

**Problem:** the user "still can't create or import animations longer than 5
seconds," and prompts-engineer reads as if 5s is a hard limit. Written from the
source on 2026-10-10; every line number is verified, not guessed.

## 0. Root causes (measured, not assumed)

The **engine has no duration limit** — `onFrame(t)` is pure and arbitrary-length.
Every 5s ceiling is a *tooling* default or an arbitrary clamp:

| # | where | what | line(s) |
|---|---|---|---|
| 1 | test-renderer `#mhDur` field | styled **invisible at rest** (transparent bg + transparent border) → renders as plain text `5 s · 800×450`; user can't tell it's editable | `.mh-dur` rule |
| 2 | test-renderer `openCustomModal` | clamps custom stage to **60s** | `Math.min(60, …)` · 960 |
| 3 | test-renderer AI-reply duration marker | clamps pasted AI `dur` to **60s** | `Math.min(60, …)` · 1982 |
| 4 | test-renderer storyboard import | allows **600s** — inconsistent with #2/#3 | 1681 |
| 5 | test-renderer `setClipDuration` | field ceiling **600s** (fine, but see #2/#3 mismatch) | 1275 |
| 6 | prompts-engineer `#fDur` slider | **hard 30s max** — a slider alone can't reach long values | `max="30"` · 949 |
| 7 | prompts-engineer module 8 | **collapsed by default** (`open:false`) + default `duration: 5` + all recipes `duration: 5000` → generated `CLIP DURATION: 5000 ms` always, unless the buried slider is found | 566, 949, 1333–1337 |

**On the user's file (the smoking gun):** `Clip_Flow_Canvas_Long_code.json`
declares `"duration": 5000`, but its `onFrame` is a **15-second**
choreography — the code's own comment reads *"Long-form test: 15000 ms
clip. Choreography runs 2.6x slower (13 s), then holds 2 s"* and the time
windows run to 15000. So this is a **15s animation mislabeled as 5s**: import
reads `data.duration` with **no clamp** (line 1651) and correctly trusts the
wrong 5000, cutting off 10s of authored motion. This is exactly the failure
the duration field exists to fix — the user imports, sees "5 s", and has no
way to know (or a visible control to fix) that the file meant 15s. It also
means the *upstream* tool that exported this JSON wrote a `duration`
mismatched to its own `onFrame` — worth flagging to whoever produces these
files, but out of scope here (the duration field + a mismatch hint cover it
client-side).

**The honesty point that shapes the fix:** *extending the duration of an
existing clip does not create new motion* — it replays the same `onFrame(t)`
for longer, holding the final frame's state for the tail. For genuinely longer
**motion**, the choreography itself must span the longer time. So the fix has
two halves: (A) let the user **set** any duration everywhere, and (B) when they
want long motion, **prompt for it** at that duration (prompts-engineer's
`CLIP DURATION` line already tells the AI to "choreograph to complete within
that time" — it just needs a duration > 5s to be reachable).

## 1. test-renderer — make the field real and obvious

**1a. Restyle `#mhDur` so it reads as a control, not text.** Replace the
transparent-at-rest treatment with a visible M3 outlined field: filled
`--md-surface-container-highest` pill, `--md-outline-variant` border, a
`timer` Material Symbol prefix, the number, and a `s` unit — plus a
`title`/caption "Clip duration — playback, scrubbing and export follow it."
Keep it compact in the header meta row but unambiguously interactive
(hover raises border to `--md-outline`, focus to `--md-primary`).

**1b. Add quick-pick durations** beside the field — `5s 10s 15s 30s 60s`
chips (`.hic` secondary-container style) that call `setClipDuration(n)` — plus
`+`/`−` steppers (±1s, shift ±5s). Long values stay typeable in the field;
the chips cover the common cases in one click.

**1c. Lift the two silent 60s truncators to 600s** so nothing disagrees with
the field: `openCustomModal` (#2) and the AI-reply marker (#3) become
`Math.min(600, …)`, matching storyboard import (#4) and `setClipDuration`
(#5). One ceiling (`MAX_CLIP_SEC = 600`) declared once at the top of the
script and referenced by all four — so the next person changes one number.

**1d. Export-time hint** (non-blocking): when duration > 30s, show a one-line
note near the export button — "frame-exact MP4 renders every frame; a 60s
clip ≈ 20× a 5s clip" — so a long export is expected, not a hang. WebM stays
wall-clock (≥ duration).

## 2. prompts-engineer — lift the cap and surface duration

**2a. Replace the 30s slider with slider + number entry.** Keep the slider
for 1–30s (its useful range) but add a `#fDurNum` number input
(`min 0.5`, `max 600`) wired to the same `S.m8.duration`, so 45s / 120s are
typeable. `peDur()` (1487) and `peScrub.max` (1514/1527/1603) already follow
`S.m8.duration` — no change needed downstream; the generated `CLIP DURATION:
<dur> ms` line (489) and the prompt builder pick up the larger value
automatically.

**2b. Surface duration out of the collapsed module.** Either open module 8 by
default (`S.m8.open = true`) **or** (preferred) hoist a compact duration
control — `⏱ [ 5 ] s` — into the always-visible preview/scrub bar next to
`#peScrub`, so the user sees and changes clip length without expanding a
module. Both the top-bar control and `#fDur`/`#fDurNum` write the same
`S.m8.duration` + `refresh()`.

**2c. De-default the 5s recipes.** Keep the three recipes' authored 5000ms as
*starting* values, but make sure loading a recipe doesn't stomp a duration the
user already typed (load order: recipe sets duration only if the user hasn't
touched the field this session — a small `S._durTouched` flag).

## 3. Import — make long durations survive and be visible

- `fillPanesFromImport` already calls `setClipDuration(code.dur)`; with 1c the
  hic-code path (`data.duration` → seconds, no clamp at 1651) and the
  storyboard path (600s at 1681) both land consistently.
- After a long import, the field (#1a) now *shows* the real length instead of
  static text — so "why is it 5s?" becomes self-answering.
- Add a one-line toast after import when duration > 30s: "Imported at 45s —
  the stage will hold the final frame after the choreography ends," so a
  stretched clip isn't mistaken for missing motion.

## 4. Non-goals

- No change to `onFrame` semantics or the export pump (both already unbounded).
- No raise of the 600s field ceiling without a reason — 10 min is already
  beyond any sane single clip; frame-exact export of 600s @30fps = 18 000
  frames is a patience wall, not a code wall (hence the 1a/1d hints).
- The five bundled `PRESETS` in test-renderer keep their authored `dur: 5` —
  they are sting templates; the field lets any of them be lengthened.

## 5. Verification

1. **test-renderer (browser):** open a preset → the duration control is
   visibly a field (not text) → set 60s via chip, via typing, via +/− →
   `PRESETS[key].dur`, `modalSlider.max`, `ovTotal`, meta line all agree →
   mid-playback change still wraps (the `tickModal` in-loop read). Import the
   user's `Clip_Flow_Canvas_Long_code.json` → stays 5s (its real length) →
   type 30s → timeline follows, toast shown.
2. **prompts-engineer (browser):** set 45s via the number field and via the
   hoisted top-bar control → generated prompt's `CLIP DURATION: 45000 ms` →
   preview scrubber max = 45000 → load a recipe after setting 20s → duration
   stays 20s (2c).
3. **Battery (unchanged behavior):** `reel-schema · fidelity · contrast ·
   extent · regression · motion · style` + `--pack-check all` all exit 0 —
   the automation contract reads `PRESETS[key].dur` and is unaffected by the
   control's styling; the fixture export gate still PASSes.
4. **Regression guard:** a 5s preset exported before and after 1a–1c must be
   byte-identical (the caps only bite above 5s).

## 6. Effort

S (test-renderer) + M (prompts-engineer), no schema/engine/automation changes.
The only cross-cutting edit is declaring `MAX_CLIP_SEC` once (1c) and keeping
the four duration writers on `setClipDuration`/`S.m8.duration`.
