# Clip Lite → Studio Lite — an executable phone-editor prototype, studied

**Status:** study + plan. Nothing here is built into the app yet.
**Mock (current):** [`clip-lite-mock.html`](clip-lite-mock.html) — the second pass: text-art styles, a floating dot ruler, a real audio lane, a floating add button.
**Mock (first pass):** [`clip-lite-mock-v1.html`](clip-lite-mock-v1.html) — the same loop before those four changes; kept so the delta is visible, and left exactly as received.

The current mock has since been **retargeted toward YouTube Create** (§10): the type scale, the icon
set, the proportions and the rainbow title were all brought closer to the reference screenshot. §1
and §4 describe it as it stands now; §10 records what changed and why.
**Shared spec:** [`../STUDIO-LITE-PLAN.md`](../STUDIO-LITE-PLAN.md) — §2 jobs, §3 features, §5 gestures, §6 layout.
**Sibling study:** [`YT-CREATE-PATTERN-PLAN.md`](YT-CREATE-PATTERN-PLAN.md) — the screenshot study this one is deliberately matched against.
**Test media:** [`TEST-MEDIA.md`](TEST-MEDIA.md) — the two canonical local videos (portrait+audio, landscape+silent) to drive this mock with real media, plus the load snippet and a pass checklist.
**Follow-up (chrome):** [`CHROME-DECLUTTER-PLAN.md`](CHROME-DECLUTTER-PLAN.md) — the dock had
accumulated 21 always-visible controls, three of which wrapped out of their own row and landed on the
filmstrip. §1–§11 bring that to 16, drop the actions row and fix four bugs. **§12–§18 (Part B)** take
the newer direction: the header stops being a row at all and becomes an overlay, so the preview band
owns y=0 and a 9:16 canvas gets **288×512 instead of 257×456** — plus a smaller-glyph icon scale and a
louder readout.

**The question this answers.** The YouTube Create study read eight screenshots and derived
patterns. Clip Lite is the opposite kind of evidence: it is a **single HTML file that actually
edits video on a phone** — import, filmstrip, scrub, trim, split, reorder, text, filter, export.
So it answers a question screenshots cannot: *does the phone edit loop close in the browser, and
what is the smallest shape that closes it?* Where the two studies agree, the decision is settled;
where Clip Lite contradicts the current plan, the plan should be argued down rather than copied.

---

## 0. The finding, in one paragraph

Clip Lite is not a mockup — it is a **working reference implementation** of the phone edit loop
in one file with no framework, no build step and no server, and that is its main evidentiary
value. It independently arrives at the YouTube Create study's two load-bearing moves (**the
chrome block is anchored; the playhead is the strip's centreline**), which is the strongest
signal in either study that they are right. Its own contribution is a *third* panel answer the
plan does not currently hold: **the property editor is an in-flow bar that pushes up from the
dock, not a sheet that rises over the stage** — one tool at a time, live preview above it, and a
footer of `Cancel` / `Reset` / `Done`. It also settles two details cheaply: the ruler is a row of
**dots masked at the screen edges**, and **text overlays are a first-class lane** edited in place
with named style chips. We should take the dock composition, the in-flow property bar, the text
lane, the dot ruler and the snap-with-haptics. We should **adapt** the timeline gestures into the
plan's `@sp/ui/gestures` ladder, and we should **refuse** its shortcuts that only survive because
the prototype is small: whole-state JSON undo, `decodeAudioData` on the whole file, drawing text
straight onto the export canvas, and an export path that runs in real time.

---

## 1. What the prototype actually is

| | |
|---|---|
| **Shape** | one `<style>` (~141 lines, minified) + ~32 lines of markup + ~365 lines of vanilla JS. No imports, no build, no dependencies. ~50KB on disk. |
| **Fonts** | Roboto (UI) + Anton (display, for the Rainbow/Comic title styles), pulled from `fonts.googleapis.com`. Every *other* page in `docs/studio-lite/` is offline/vendored; this one is not, so treat the CDN link as a prototype convenience, not a house pattern (§9 Q1). |
| **Icons** | inline SVG paths in one `ICON` map, rendered `fill:none; stroke:currentColor; stroke-width:1.6` — thin Material-Symbols-Outlined outlines, 24px. Colour is the only state (`--on` for controls, `--on2` for rail labels, `--acc` for the armed snap toggle). |
| **Theme** | its own CSS variables, light + dark via `prefers-color-scheme` **and** a `data-theme` override, toggled from the header. Not the repo's Material 3 layer. |
| **Media** | `<input type=file accept="video/*" multiple>` → `URL.createObjectURL` → a hidden `<video>` per source. Filmstrip frames are seeked and drawn to a canvas → `toBlob('image/jpeg', .6)`. The waveform is `decodeAudioData` → 25 peaks/second → an inline `<svg>` polyline. |
| **Playback** | one `<canvas>` composited per rAF; the audio is routed through `AudioContext → MediaStreamDestination` so export can capture it. |
| **Export** | `canvas.captureStream(30)` + the audio destination → `MediaRecorder` (`video/mp4;codecs=avc1` if supported, else webm) → a Blob download, behind a progress overlay with Cancel. |
| **State** | three flat arrays/objects — `clips[]`, `texts[]`, `proj{ar,bg}` — and a 40-deep undo stack of `JSON.stringify` snapshots. |

**What is genuinely proved.** The entire loop closes inside one file on a phone-sized viewport
with no framework: import → filmstrip + waveform → drag to scrub → trim → split → reorder →
add text → apply filter → export. Runtime cost is a rAF draw loop and a handful of listeners — it
is *not* a heavy app. That is direct support for §6.3's `shell JS ≤ 150KB gzip` and for P5's
"lite shell, vertical slice": the vertical slice is smaller than the plan assumes.

**What is deliberately missing.** Persistence (reload loses everything), accessibility, undo
granularity, a versioned project object, worker-based export, and any of Pro's colour/HIC layers.
Each omission is a place where Lite is *not* this file (§6).

---

## 2. What each surface shows

Read against the screenshots table in the sibling study, because several of these are the same
pattern reached a second time.

| # | Surface | What is on it | Pattern |
|---|---|---|---|
| 01 | **Header bar** | theme toggle · spacer · export (disabled until a clip exists) | chrome is two taps, nothing else |
| 02 | **Stage** | canvas preview; a floating "Add video" pill when empty; ⛶ in the corner; tap = play/pause | preview is the flex band; empty state is *on* the stage |
| 03 | **Transport row** | delete · split │ prev-frame · **play** · next-frame │ undo · redo | five-plus-two glyphs, fixed, always visible |
| 04 | ~~Actions row~~ → **readout row + ⋮** | the button row was removed after this study: snap, zoom and fit moved into the ⋮ sheet, and what is left above the timeline is a 30px **readout row** — the timecode centred, flanked by the ruler dots, carrying no controls | readout is `current / total`, not frames — see [`CHROME-DECLUTTER-PLAN.md`](CHROME-DECLUTTER-PLAN.md) §11 |
| 05 | **Timeline** | dot ruler · text lanes · video lane (filmstrip + trim handles + transition junctions) · audio lane (teal waveform) · **fixed centre playhead** | the strip scrolls; the playhead does not |
| 06 | **Tool rail** | contextual: `Add video · Text · Canvas` with nothing selected; `Edit text · Duplicate · Trim start · Trim end` with a text selected; `Speed · Volume · Filter · Rotate · Transition · Duplicate · Trim start · Trim end` with a clip selected | the rail is a function of the selection |
| 07 | **Property bar** | one tool at a time — header, one control group, footer `Cancel` / `Reset` / `Done`; preview stays live above | the panel the plan calls a "sheet", built as an in-flow bar |
| 08 | **Text editor** | a one-line field + four style chips (Rainbow · Plain · Neon · Comic) rendered live on the canvas | text style is chosen by looking at it, not by naming it |
| 09 | **Export overlay** | "Exporting video…", a progress bar, Cancel | export owns the screen while it runs |

---

## 3. Twelve patterns, and the five worth carrying

**The load-bearing five:**

- **C1 — The bottom dock is one component with four stacked rows.** Transport, readout/zoom,
  lanes, tool rail. Nothing floats, nothing is dragged, nothing is lost. This is the sibling
  study's P1 ("the chrome block is anchored") expressed as an actual DOM stack, and it is the
  shape §6.1 should adopt for tier A.
- **C2 — The playhead is the strip's centreline.** `tl.scrollLeft = t·pps`; the film moves under
  a fixed 2px line. Reached *independently* of the YouTube Create screenshots (P2). Two references
  converging on the same unusual choice is the strongest evidence in this study — §5.2's Tier-A
  "drag the film" is confirmed.
- **C3 — The property editor is an in-flow bar, not a modal sheet.** Header / one body / footer,
  `Cancel` restores a snapshot taken on open, `Done` commits one undo entry, `Reset` restores
  defaults without closing. Two consequences that a bottom sheet cannot match: the preview is
  **never covered**, and there is no drag-to-dismiss competing with the controls inside. This
  directly challenges §6.1's "everything else arrives in a sheet" (§5).
- **C4 — The tool rail is a pure function of the selection.** Nothing selected → create actions;
  text selected → text actions; clip selected → clip actions. Same as the sibling study's P8, but
  here it is *enforced in code* (`strip()` switches on `sel.k`), which is the cheapest possible
  implementation and worth copying verbatim in spirit.
- **C5 — Overlays are a lane, not a dialog.** Text clips live in coloured bars stacked above the
  video lane, each with trim handles, tap-to-edit. This is the sibling study's P5 (collapsing
  overlay lanes) taken one step further: the lane *is* the editing surface.

**The rest:**

- **C6 — Text presets are named canvas styles with live thumbnails.** Rainbow (per-character
  colour + sparkle), Plain (bottom caption, stroke), Neon (glow), Comic (Anton, hard outline).
  Matches P6 (presets in a grid) and matches the plan's §3 bet on curated presets — but note the
  style is *rendered canonically* (the canvas is the thumbnail), which is the same principle as
  the plan's "compile the preset, don't draw a picture of it".
- **C7 — Snapping is a first-class, visible, haptic toggle.** A dedicated button, a snap marker,
  `navigator.vibrate(6)` on capture, and an 8px tolerance converted to time by `8/pps`.
- **C8 — The ruler is dots, masked at the edges.** Cutouts on both sides keep the dots out from
  under the fixed controls; the dot row translates with the film (`translateX(-scrollLeft)`).
  Cheaper than YT Create's floating labels (P12) and than v1's fixed tick strip.
- **C9 — Export is an in-page overlay with Cancel**, and it is `captureStream` + `MediaRecorder`.
  Confirms §5.4's "MediaRecorder is the primary iOS path" — and exposes its cost (§6).
- **C10 — Scrubbing and playing share one scroll position.** `t` is *derived* from `scrollLeft`
  while scrubbing and *writes* it while playing, so the two never disagree. A small invariant
  that removes a whole class of stuck-playhead bugs.
- **C11 — Transitions are junctions between clips**, tapped directly, with one parameter
  (kind + duration). No transition track, no keyframes.
- **C12 — Speed, volume, filters and rotation are per-clip scalar properties**, each a single
  slider or chip row. This is the plan's "one control per screen" (§C3) at the data model too.

**Two deltas worth naming (v1 → v8), because they are cheap wins:**

1. **v1 draws text as one white bottom caption; v8 makes it a styled, layered element.** The
   upgrade costs ~40 lines of canvas code and turns "text" from a feature into a *set* of presets.
2. **v1's ruler is a fixed tick strip inside the scroll; v8's is a masked dot row that rides the
   film.** v8 is better on a phone: no 2px touch targets, no tick labels fighting the controls.

**Where the prototype is worse than our spec, and should not be copied:**

- **Filters run through `ctx.filter` on the live canvas** (CSS filter strings). Fine for a
  preview; it must not be the render path — Pro owns colour correction and the HIC layer.
- **Text is drawn directly onto the export canvas.** There is no separation between "what the
  user sees" and "what renders", which is exactly the seam §4.1 exists to keep.
- **Undo is whole-state JSON snapshots.** Correct at 10 clips, wrong at Pro's scale — no
  selection restore, no labels, and it serialises the entire project on every commit.
- **The waveform decodes the whole file** (`decodeAudioData`, capped at a 200MB input). A long
  phone clip will not fit; §5.4's "never decode full video for a filmstrip" has an audio twin.
- **Export is real-time.** A 5-minute edit takes 5 minutes to export because `MediaRecorder`
  records the live stream. The plan's Worker/FTRT path exists precisely to escape this.
- **No persistence, no accessibility, no `prefers-reduced-motion`, no quota handling.** All are
  §5.4 / §7-P0 obligations.
- **The CDN font link** breaks the offline/precache contract the rest of the folder keeps.

---

## 4. Measurements

The prototype is plain CSS px on a fluid viewport, so these are design values rather than
read-off pixels — the useful part is the *ratios* and which ones clear the 44px floor.

> **Superseded in part.** The chrome-declutter pass ([`CHROME-DECLUTTER-PLAN.md`](CHROME-DECLUTTER-PLAN.md)
> §11) replaced the actions row with a 30px readout row, and the ⋮ sheet took over snap / zoom /
> frame-step / fit. Rows that no longer exist — the actions-row controls, and the row heights around
> them — are recorded there instead. The lane and control measurements below still hold.

| thing | value | clears §5.3 `44px`? |
|---|---|---|
| header bar | 64px | — |
| icon button | 48×48 | yes |
| play button | 48×48 (30px glyph) | yes |
| transport row | 48px buttons, no fixed row height | yes |
| video lane | **64px** (`#track`; 72px ≥ 900px) | n/a — a surface, not a control |
| audio lane | **44px** (`#atrack`) | n/a |
| text lane | 14px collapsed → **34px** selected | no — 34 < 44 |
| video trim handle | **18px** wide, full lane height | no — needs the 12px slop rule (§5.3.1) |
| text trim handle | **14px** wide, lane height | no — smallest target in the file |
| transition junction | **36×36** | no — smallest control in the file |
| tool rail item | 68px min-width, icon + label | yes |
| property-bar footer pill | **44px** | yes |
| timeline min-height | 132px base → **140px** | — |

**Three numbers to fix on adoption.** The transition junctions (36px) and both trim handles
(18px on video, 14px on text) sit under the floor, and §5.3 rule 1 already prescribes the fix: keep
the visual affordance small and pad the **hit target** to 44px (the 12px slop, applied
generously). Everything else — every button, the rail, the property-bar pills — already clears
44px, which is unusual for a prototype and worth noting: someone was thinking about thumbs.

---

## 5. The one place this study argues with the plan

§6.1 fixes tier A as: *"Everything else arrives in a **sheet** that rises from the dock,
draggable between 50% and 92%."* Clip Lite does not do that, and for the property editor it is
the worse choice:

| | bottom sheet | in-flow property bar (Clip Lite) |
|---|---|---|
| preview while editing | covered or half-covered | **always fully visible** |
| dismiss gesture | drag-down — competes with sliders inside the sheet | none needed; `Cancel` / `Done` |
| thumb travel | to the sheet's top edge, then to a control, then down | the bar is at the bottom, controls are already there |
| one-at-a-time tools | possible but not forced | **structural** — `tool` is a single value |
| re-layout on open | the stage re-flows | the dock grows; the stage shrinks by the bar's height |

**Proposal (not applied to the plan yet):** split what §6.1 calls "everything else" into two
surfaces —

1. **In-flow property bar** (Clip Lite's shape) for **any editor bound to the current selection**:
   speed, volume, filter, rotation, transition, text content and style, canvas ratio. One at a
   time, live preview above, `Cancel` / `Reset` / `Done`.
2. **Rising sheet** stays for **non-modal, list-shaped things**: the project browser, export
   options, add-media, settings — anything that is not "adjust the thing I just tapped".

This keeps §6.2 intact (a drag still collapses the chrome and grows the stage) while removing the
only surface in the plan that covers the preview during the most common task. It should be a
written decision in §6.1 before any Lite code is written, because it is cheap now and expensive
after P5.

**The other, smaller amendment:** §5.2's gesture map should name **tap-on-junction → transition**
and **long-press → reorder** explicitly (Clip Lite implements both; the plan implies them but
does not spell out the junction tap).

---

## 6. Feature-by-feature mapping

| Clip Lite | Studio Lite equivalent | verdict | spec |
|---|---|---|---|
| anchored bottom dock (transport / readout / lanes / rail) | tier-A shell | **Adopt** | §6.1 |
| playhead fixed at the strip centre | Tier-A timeline gesture | **Adopt** — confirms P2 | §5.2 |
| in-flow property bar with Cancel/Reset/Done | new: replace the sheet for selection-bound editors | **Adopt** | §6.1 (amend) |
| contextual tool rail keyed to selection | the dock's `Add` / `Inspect` / `Clips` / `Export`, made selection-aware | **Adapt** — keep the four destinations, add the selection-keyed rail | §6.1 |
| masked dot ruler riding the film | Tier-A ruler | **Adopt** | new |
| collapsing, colored overlay lanes | `data-collapsed` lanes (plan already has this) | **Adopt** — and colour the lane by clip kind | §3.4 |
| named text styles, live on canvas (Rainbow/Plain/Neon/Comic) | the shared text presets, rendered from the real renderer | **Adopt** | §3, §3.3 |
| per-clip speed / volume / filter / rotation, one control each | clip properties, phone edition | **Adopt** | §3.3 |
| transitions as tappable junctions, kind + duration | transition property on a clip | **Adapt** — model it as a clip property, keep the junction tap | §3.3 |
| snap toggle + haptic + marker | timeline snap, already implied | **Adopt** | §5.2 |
| `captureStream` + `MediaRecorder` export, in-page overlay + Cancel | iOS primary export path | **Adopt the UI; keep the engine** — not the real-time recorder for long edits | §5.4, §3.9 |
| aspect + background on a flat `proj` | `project.canvas.{ratio,background}` | **Adopt the feature, refuse the model** — must round-trip (§3.1) | §3.1 |
| auto-aspect from the first import | import convenience | **Adopt**, but as a default the user can override | §3.1 |
| whole-state JSON undo (40 deep) | `@sp/core` undo with labels | **Refuse** | §4.6 |
| `ctx.filter` colour on the live canvas | Pro's colour correction + HIC render | **Refuse as the render path** | §4.1 |
| text drawn straight onto the export canvas | `@sp/render` text layer | **Refuse as architecture** | §4.2 |
| `decodeAudioData` over the whole file | streamed / windowed waveform | **Refuse** | §5.4 |
| CDN fonts | vendored, offline, precached | **Refuse** | §6.4 |
| no persistence | project file round-trip | **Refuse** | §3.1 |

---

## 7. Component specs

**The tier-A dock (adopting C1).** Four stacked rows inside one component:
`[transport 56] [actions 40] [timeline ~140–195, flexible] [tool rail 56]`. The property bar, when
open, sits above the transport row and never overlaps the timeline. The whole dock is
`position: sticky`-equivalent: opening a property or switching ratio must not re-flow it.

**The fixed playhead (C2).** A 2px line at 50% of the lane area, drawn over the film. The lane
scroller owns the gesture (`touch-action: none`); `t = scrollLeft / pps` while scrubbing, and
`scrollLeft = t · pps` while playing (C10). Snap on release: tolerance 8px folded into time,
haptic on capture, then settle.

**The property bar (C3).** One component, N bodies, contract
`{ title, body, commit, revert, defaults }`. Opens by pushing the stage up by its own height.
Snapshot on open; `Cancel` restores; `Done` commits exactly one labelled undo entry; `Reset`
restores that tool's defaults without closing. Footer targets padded to ≥44px; `Done` is the only
inverse-filled element.

**The tool rail (C4).** `rail(selection)` returns one of three sets — empty / text-selected /
clip-selected — each item ≥44px wide with a label. No item is hover-gated.

**The text lane (C5) and the text editor.** A text clip is a bar in its own lane above the video
lane (`14px` bar, `34px` expanded on select), colour-keyed by index, with trim handles. Tapping it
opens the property bar with a one-line field plus the style chips; the field keeps the keyboard up
via `visualViewport` (§5.4) with the preview still live above it.

**The ruler (C8).** A dot row at `pps`-derived spacing, translated by `-scrollLeft`, with edge
masks so it never sits under the transport or the rail. No numeric ticks on the phone.

---

## 8. Build plan

Folded into the existing phases so this study produces *amendments*, not a second roadmap.

**Amend §6.1 (before P5).** Adopt the four-row dock and the in-flow property bar; reserve the
sheet for list-shaped, non-modal surfaces. *Test:* open every selection-bound editor and assert
the preview canvas's bounding box is never covered and its `top` never moves when a property opens.

**P5 — lite shell, vertical slice.** Build the slice to exactly this prototype's loop, because it
is the proven-viable minimum: import → filmstrip + waveform → scrub → trim → split → reorder →
export. *Test:* the slice reproduces the prototype's loop on a mid-phone at tier A within §6.3's
frame budget.

**P6 — feature build-out.** In order of demonstrated value: text presets (rendered from the real
renderer, not a picture of them), per-clip speed/volume/filter/rotation, transitions as a clip
property with a junction tap, then canvas ratio + background with a **versioned, round-tripping**
`project.canvas` (§3.1).

**P-export (with §3.9).** Take the prototype's overlay + Cancel UI. Do **not** take real-time
`MediaRecorder` as the only engine — it must remain the fallback, with the Worker path as primary
where the platform allows.

**Hardening (with P7).** `prefers-reduced-motion` on the preset previews and the snap marker;
keyboard/switch parity for every tool; a quota check before export, not during.

---

## 9. Open questions

1. **Do we vendor Roboto + Anton** into `public/fonts/` so these mocks (and the real app's display
   presets) stay offline, or accept the CDN link as a prototype-only convenience? The rest of
   `docs/studio-lite/` is CDN-free; this study is the exception.
2. **Does the property bar push the stage or overlay it?** Clip Lite grows the dock and lets the
   stage shrink (a push). Overlaying the bottom of the stage would keep the frame size fixed but
   hide part of it — the push looks right, but it should be a decision, not a default.
3. **Are the trim handles acceptable** — 18px wide on video, 14px on text, both shorter than the
   44px floor — if their hit targets are padded out to the lane, or does every handle need a visible
   44px treatment? §5.3 rule 2 (offset handles) suggests the former; this needs one thumb test.
4. **Do we keep two mocks in the folder** (`clip-lite-mock.html` + `clip-lite-mock-v1.html`) once
   the current one is adopted into P5, or collapse to one and let git hold the first pass? Kept for
   now so the v1→v8 delta stays reviewable.
5. **Where does the filmstrip thumbnail cache live** — `IndexedDB` per §5.4, or recomputed per
   session like the prototype? Per-clip frame count here is capped at 120 at ~2s spacing, which is a
   reasonable starting budget to carry over.

---

## 10. The retarget pass

The two mocks arrived byte-identical from the author's local prototype (`video-editor (8).html` →
`clip-lite-mock.html`, `video-editor (7).html` → `clip-lite-mock-v1.html`). Both are still readable
as that prototype; `-v1` is untouched, and the current mock keeps every behaviour (the JS only
changed where §10.3 says so). What was retargeted, against the YouTube Create reference screenshot:

**10.1 Type scale.** The reference is denser than the prototype was. Body 14px → 13.5px;
the timeline readout 18px bold → **13px, weight 500**, tracking `.02em`; rail labels stay 11px but at
`--on2` instead of white; panel title 18px/700 → 16px/500; the big slider value 24px → 20px; empty
state 16px → 15px; clip and text-lane labels 12px → 11px.

**10.2 Icons.** Every glyph was redrawn as a thin outline (`fill:none; stroke-width:1.6`, round caps
and joins) — a consistent Material-Symbols-Outlined set instead of the mixed filled/outlined
originals: the trash, scissors, chevrons, undo/redo, the magnet, the magnifiers, the rotate and
transition arrows, the aspect bracket and the four-corner fullscreen mark. `play` / `pause` stay
filled, as in the reference. The armed snap toggle is now the **accent colour** (`--acc`, blue)
rather than a filled grey circle, which is what the reference does with its blue timeline dot.

**10.3 Proportions (“not too big”).** Play button 56 → **48** (glyph 40 → 30); the add-clip button
a 42px rounded square → a **44px white circle** (the reference's control); video lane 76 → **64**;
audio lane 50 → **44**; transition junction 40 → **36**; video trim handle 22 → **18**; rail item
64 → 68px min-width; panel min-height 300 → 260. Nothing gained weight.

**10.4 Cleaner surfaces.** The fullscreen ⛶ lost its dark circle and is now a bare outline mark in
the preview corner (as in the reference), the preview radius went 16 → 8px with tighter side
padding, and the dark tokens were moved to the reference's near-black (`--bg #0f0f0f`,
`--sf #1c1c1c`). A `--acc` token was added to both themes.

**10.5 The rainbow title.** The reference's sticker is letters that are individually rotated, each
with a heavy white outline over a dark drop shadow, plus small star sparkles. The canvas drew the
prototype's version (flat per-character colour + offset shadow). It now draws the reference's:
each glyph enters a `save/translate/rotate/restore`, gets a `fs*0.15` white `strokeText` first, then
a dark offset fill, then the coloured face — with a deterministic per-letter drift so the line is
playful rather than mechanical. This is the one behaviour change (a canvas draw, not state).

**10.6 Responsive.** `body` is `100dvh` (with a `100%` fallback) so iOS Safari's toolbar cannot
clip the dock; a `≤360px` breakpoint tightens the rail, transport padding, readout and add button.
Verified at 320×700, 366×836 and 390×844, light and dark, with a synthetic two-clip project —
layout holds, the rail scrolls, the panel fits, and the console stays empty.

**Not changed:** the CDN font link (§9 Q1), the gesture model, the export path, the state model —
those are §5–§6 findings about the prototype's *architecture*, not its look.

**Known follow-up.** The retarget fixed how the controls *look*; it did not question how many there
are. The measurements in §4 assume every control on screen; in the running mock the actions row has
grown a zoom cluster that wraps out of its own row. See [`CHROME-DECLUTTER-PLAN.md`](CHROME-DECLUTTER-PLAN.md).

---

## 11. Lane architecture — the text / caption split (proposed, not built)

**The proposal:** text overlays live in a **collapsible lane above** the video (thin bars, expanding on
selection, as the reference does); captions live in a **permanently expanded lane below** the video.
**Verdict: yes — the asymmetry is principled — but three corrections, and one rule has to be written
down or it will be violated by the next lane someone adds.**

**Why the asymmetry is principled.** They are different objects with different density and different
editing gesture. A text overlay is authored, sparse (0–5 items), moved *on the canvas* — so the lane is
only a marker plus two trim handles, and 14px is the honest height. A caption is generated, dense (a cue
every 2–4s for the whole duration), and edited *in the lane* — so the lane **is** the editing surface and
collapsing it would hide the thing being edited. Collapse policy should follow density; the two
densities differ by an order of magnitude.

**The rule to record.** Spatial position must mean one thing, applied to every future lane:

> **Above the video = layers that composite over the picture and are positioned on the canvas**
> (text, stickers, PiP). **Below the video = streams derived from or attached to sound**
> (captions, voiceover, music, the waveform).

A rule this makes unavoidable and which should be intended: **it puts captions under text overlays** in
z-order. That matches the usual default (burned-in captions sit under decorative text), but it is an
implication, not an accident, and it should be written down as one.

**Correction 1 — the text strip needs a reserved constant height.** Measured in the running mock with one
real clip (`getBoundingClientRect`, 366×836):

| project state | `#track` top | `#ttrack` top / height | timeline band top |
|---|---|---|---|
| no text | 640 | 640 / **0** | 620 |
| 2 non-overlapping texts (1 row) | **648** | 612 / 36 | **592** |
| 3 texts, one overlap (2 rows) | 648 | 596 / 52 | **576** |
| text cleared | 640 | 640 / 0 | 620 |

Two things to read out of that. The filmstrip **moves 8px down** the first time text is added, under a
playhead that does not move — the vertical version of the P1 invariant in
[`CHROME-DECLUTTER-PLAN.md`](CHROME-DECLUTTER-PLAN.md) §13. And the band is **bottom-anchored**, so it
grows *upward*: adding text costs the preview band 28px, and a second packed row costs 16px more. Thin
bars fix the first cost but not the second — the fix is a **constant reservation** (always reserve the
collapsed 14px whether or not text exists), so the film never moves.

**Correction 2 — the caption lane must be fixed height with no overlap packing.** The current
`lanes()` packs non-overlapping items onto rows and returns the max level, and `#ttrack` height is
`n*16+20`. That is right for sparse text and **wrong for captions**: one cue that runs 100ms into the
next makes the lane 16px taller, and because the band grows upward, that single sloppy cue permanently
costs 16px of preview **for the entire project**. Captions will hit this constantly. Cap the lane at a
fixed row count and let an overlap either wrap within the row or be prevented on import — do not let
one bad cue resize the timeline forever.

**Correction 3 — "never collapse" means "never collapse *while captions exist*".** An empty caption
lane that still charges 34px is exactly the failure §1 of the chrome plan was written to remove. The
lane should collapse to a labelled strip when the project has no captions and expand the moment one
exists.

**The cost of the split, stated honestly.** Two lanes on opposite sides of the spine means "where are my
words?" has two answers. Mitigation: the rail item that opens Text should highlight the lane above, and
the one that opens Captions the lane below, so the mapping is taught on the first tap rather than
discovered.

**What it costs in pixels, which nothing above pays for.** The stack this section describes is 264px
tall — ruler gutter, text lane, film, caption lane, audio. The timeline band is **148px today and full**:
its two lanes take 108 and the other 40 are gutter and padding, with no slack anywhere. So this section
cannot be built until the vertical budget is rebalanced. See
[`TIMELINE-SPACE-PLAN.md`](TIMELINE-SPACE-PLAN.md), which finds ~64px from the preview's ceiling and
11px of chrome, then pins the preview's floor at 46% so the worst case still leaves a usable picture —
and shows that at 320px the full stack needs one more lever (folding the readout row into the
transport) before it fits above that floor.

---

*Study produced 2026-10-02. Nothing built. `clip-lite-mock-v1.html` is byte-identical to
`video-editor (7).html`; `clip-lite-mock.html` is `video-editor (8).html` with the §10 retarget. §11 is a
proposed lane architecture, not an implementation.*
