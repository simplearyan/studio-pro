# Studio Lite — chrome plan: declutter, then let the preview own the top

**Status:** **M1–M3 and B1–B5 are applied to the mock.** §11 records M1–M3 and the four bugs it found;
§19 records B1–B5 — the header is an overlay, the preview band runs from y=0, and the icon and type
scales are retuned — with two predictions in §13–§15 corrected against the measurements. B6–B8 and
M4–M7 are still plans. **Part C**, the vertical budget that B1 made necessary, is
[`TIMELINE-SPACE-PLAN.md`](TIMELINE-SPACE-PLAN.md). Nothing has been applied to the app.
**Subject:** [`clip-lite-mock.html`](clip-lite-mock.html) — the working phone-editor prototype.
**Spec:** [`../STUDIO-LITE-PLAN.md`](../STUDIO-LITE-PLAN.md) §5.3 (touch ergonomics), §6.1 (layout by tier).
**Studies:** [`YT-CREATE-PATTERN-PLAN.md`](YT-CREATE-PATTERN-PLAN.md) (what the reference does),
[`CLIP-LITE-PATTERN-PLAN.md`](CLIP-LITE-PATTERN-PLAN.md) (what the prototype does).

**The complaint, precisely.** The dock has accumulated a control for every action instead of a
control for every *frequent* action. Snap, zoom out, zoom in, fit, frame back, frame forward, undo
and redo all sit permanently on screen, competing with play, split and delete. On a 6" phone that
is 21 always-visible controls, and — measured below — **three of them are not even in their own
row**. The fix is not to shrink them; it is to stop showing the rare ones.

---

## 0. The finding, in one paragraph

Two different problems are being described as one. The first is **density**: 21 interactive controls
are visible at rest, and six of them (frame back/forward, zoom out/in/fit) are actions a phone does
with a **gesture that already works** — pinch already zooms, and there is already a keyboard frame
step. The second is a **layout bug**: the zoom cluster is three 40px buttons inside a 40px row, so it
wraps and the "Fit all" button lands **on top of the filmstrip** (measured: 506, 546 and 586 px —
the last one is inside the timeline band). The plan therefore does two things: it moves the rare
controls into a **header overflow sheet** (which also gives the app a home for real settings), and it
adopts the idea behind the ⛶ button — **the header becomes an overlay over the stage and can fade
away**, which is worth ~96px of extra preview and timeline on the phone. Both changes are independent
and each one is shippable alone.

---

## 1. What is on screen now (measured in the running mock)

At 366×836, dark theme, one clip selected:

| Row | Height | Controls | Which |
|---|---|---|---|
| header `.bar` | 56px | 2 | theme, export |
| **preview band `.view`** | **434px (52%)** | — | canvas, ⛶ |
| transport `.ar` | 52px | 7 | delete, split, **prev-frame**, play, **next-frame**, undo, redo |
| actions `.tc` | 40px | 4 | **snap**, **zoom out**, **zoom in**, **fit all** |
| timeline `.tlw` | 182px (22%) | 1 | add-clip (+) |
| rail `.tools` | 68px | 7 | speed, volume, filter, rotate, duplicate, trim-start, trim-end |
| **total** | **216px of chrome** | **21** | |

Three measurements matter more than the rest:

1. **21 controls are always visible.** Nothing is hidden, so nothing is emphasised. Play — the one
   action that should be findable without looking — has the same weight as "Fit all".
2. **The actions row is broken.** `#zo`, `#zi` and `[data-a=fit]` measure 40px tall at `y = 506`,
   `546` and `586`. The row itself is 40px tall at `y = 546`. So **zoom-out sits in the transport
   row, zoom-in sits in the actions row, and Fit all sits inside the timeline**, on top of the
   filmstrip. It is a wrapping bug that reads as clutter.
3. **Chrome is 216px of 836 — 26% of the screen** — before anything is even scrolled. The user's
   instinct that the preview and the timeline want that space back is correct, and it is the same
   instinct the reference had when it made ⛶ a corner affordance rather than a menu item.

**What is safe to move, and why.** Every control below is either duplicated by a gesture the mock
already implements, or is a *setting* rather than an *action*:

| Control | Already reachable another way | Verdict |
|---|---|---|
| zoom out / zoom in | pinch on the lane area (2–240 px/s), `ctrl`+wheel | **move** |
| fit all | double-tap the timeline; also `ctrl`+wheel to zoom out | **move** |
| frame back / forward | `←` / `→` (1 frame), `shift`+`←`/`→` (1s); hold is the only unique bit | **move** (keep hold on the playhead) |
| snap on/off | nothing — but a snap *toggle* is a preference, not a per-edit decision | **move to a setting**, keep the marker + haptic |
| trim start / trim end | drag the trim handles; `[` / `]` | **move** |
| redo | nothing on touch | **keep** — undo without redo is a trap |
| delete, split, play, undo | — | **keep** |

---

## 2. The three references, and what each says

- **YouTube Create** (the phone editor worth copying) shows **no zoom buttons, no frame-step
  buttons and no snap toggle** at all. Its transport is five glyphs; its only "setting" affordance
  is a small blue dot whose meaning is still unknown (YT study §9 Q1 — the likely answer is a snap
  indicator). Everything the mock has bolted on, the reference either does with a gesture or does
  not do.
- **Clip Lite v1 → v8** shows the same drift in miniature: v1's add-clip affordance was an inline
  button in the track, v8 moved it to a single floating ⊕. The direction of travel was already
  *fewer, larger, better-placed*.
- **The ⛶ precedent.** The fullscreen button is already an **overlay on the preview** rather than a
  chrome row — and fullscreen is described in the YT study as *"removes chrome instead of adding a
  player"*. That is the pattern to extend to the header, and it is the user's suggestion.

---

## 3. The principle: three tiers, one rule

> **A control is visible only if it is used in most sessions. Everything else is one tap away and
> never absent from the same menu.**

| Tier | Meaning | Where it lives | Examples |
|---|---|---|---|
| **1 — always** | used in almost every edit | the dock, ≥44px | play, split, delete, undo, add-clip, the contextual rail |
| **2 — on selection** | only meaningful with a target | revealed by the selection, then ≥44px | trim handles, transitions, text style chips |
| **3 — settings & rare** | set once, or precision work | the **header ⋮ sheet** | snap, zoom, frame-step, trim-to-playhead, theme, aspect, export frame |

This is §5.3 rule 3 ("no hover-only affordances") read the other way round: in lite a control is
either always visible, or revealed by a gesture — and a **⋮ sheet is a gesture**. What is forbidden
is a control that exists only in a keyboard shortcut.

---

## 4. The three states of the chrome

This is the user's overlay idea, made explicit. Today there are two states (normal, fullscreen).
There should be **three**, and the middle one is the one that buys space without hiding anything the
user still needs.

| State | Header | Actions row | Transport | Timeline | Rail | When |
|---|---|---|---|---|---|---|
| **Normal** | in flow | **gone** (folded into ⋮) | full | full | full | default on ≥ 420px |
| **Focus** | **overlay over the stage**, auto-fades | gone | full, dims on idle | full | full | default on ≤ 380px, or after 2.5s of playback |
| **Fullscreen** | gone | gone | gone | gone | gone | ⛶ |

**Focus is what the user is asking for.** The header stops consuming a row: it becomes
`position:absolute` over the top of the preview band, so the canvas is drawn *underneath* it and the
stage gains the full 56px. Combined with folding the broken 40px actions row into ⋮ that is **96px
returned** — on a 700px viewport the preview band goes from ~52% to ~62%, or the timeline grows by
half a lane.

**Spec.**

```css
.bar{position:absolute;inset:0 0 auto;z-index:6;height:56px;
     background:linear-gradient(180deg,rgba(0,0,0,.55),transparent);
     transition:opacity .2s,transform .2s}
.bar.idle{opacity:0;transform:translateY(-8px);pointer-events:none}
```

- The gradient scrim is required: a bare overlay's icons are unreadable over a bright frame (the
  reference gets away with it because its preview is full-bleed and dark; ours is not always).
- **Auto-fade** after 2.5s with no pointer input *while playing*; any `pointerdown` restores it.
- **Tap rule (the trap to avoid):** if the chrome is hidden, the first tap **only** reveals it — it
  must not also toggle play. The mock already binds tap-to-play on the canvas, so this needs an
  explicit guard, or a tap that reveals chrome will also start playback and the user will fight it.
- **Never fade while paused or while a panel is open.** A paused user is a deliberating user.
- Fullscreen keeps its own behaviour (chrome removed, scrub + timecode remain), per the YT study.

---

## 5. The header, restructured

```
┌──────────────────────────────────────────────────────────┐
│ ☀            [ centre slot ]                 ⋮     ⤴    │
└──────────────────────────────────────────────────────────┘
```

- **Left — theme.** Unchanged. (Eventually back/close when Lite has a project browser.)
- **Centre — a contextual slot, empty by default.** Three candidates, and this is a decision (§10):
  1. **Export frame (PNG)** — the user's suggestion. A real gap: Pro can snapshot, phone Lite
     cannot. One tap while paused, replaces nothing.
  2. **Project readout** — `9:16 · 4 clips · 00:20`, the phone version of Pro's title bar. Cheap,
     always true, never wrong.
  3. **Nothing.** Quietest, and the strongest argument for keeping the slot is that it *stays*
     quiet until something deserves it.
  *Recommendation:* build the slot, default it to **the readout**, and put export-frame in ⋮. The
  readout answers "how long is this thing" without opening anything (the same win the YT study
  found in `mm:ss / mm:ss`), and a frame export is a rare action that does not earn a permanent
  slot.
- **Right — ⋮ then Export.** Export stays as the one filled/primary button. ⋮ opens the sheet below.

---

## 6. The overflow sheet

One component, reusing the property-bar shell (title / rows / `Done`), because it is the same
interaction: a temporary surface over a live preview.

| Row | Control | Persisted? |
|---|---|---|
| Snap | switch | **yes** — `lite:snap` |
| Zoom | `−  [slider]  +` and `Fit all` | remembered per project (`pps`) |
| Frame step | `⟨ ◀ ✚ ▶ ⟩` — a 44px stepper pair | no |
| Trim to playhead | two buttons: `Trim start` / `Trim end` | no |
| Aspect ratio | the 4-tile switcher (already a panel body) | **yes** — project |
| Export frame | a button (if it does not take the header centre) | no |
| Theme | switch (mirrors the header toggle) | **yes** |

Rules:
- Every row is ≥44px and shows its **keyboard equivalent** on iPad/desktop (§5.2 parity).
- The sheet is **the canonical home**: if a control is in tier 3, it is in this sheet. Nothing is
  gesture-only.
- ⋮ is 48px and sits in the thumb zone after the header overlays — verify it is still reachable with
  one hand in Focus (§5.3 rule 7).

---

## 7. Before / after

| | before | target | **actual after M1–M3 (§11)** |
|---|---|---|---|
| always-visible controls (clip selected) | 21 | 12 | **16** |
| — header | 2 | 2 | **3** (theme, ⋮, export) |
| — transport | 7 | 4 | **5** (delete, split, play, undo, redo) |
| — actions row | 4 | 0 | **0** (row removed) |
| — timeline | 1 (⊕) | 1 | 1 (⊕) |
| — rail | 7 | 5 | 7 — M6 not yet done |
| tier-3 controls in ⋮ | — | 9 | **8** + 2 switches |
| chrome height above the timeline | 148px | 120px | **138px** (see §11 note) |
| preview band | 434px | — | **450px** |
| timeline band | 182px | — | **176px** |
| controls that overlap another row | 3 | 0 | **0** |

**Two decisions this table forced.** Redo **stays** in the transport (§10 Q5 resolved: it keeps the
transport at 5, not 4, and the recovery path stays one tap). And the theme toggle **stays** in the
header rather than moving into ⋮ — it is a one-tap atmosphere control, and burying it would make
the sheet the only way to escape a theme you dislike.

Nothing is deleted. Nine controls change address, and three of them stop being drawn on top of the
filmstrip.

---

## 8. Build order

Each step is independently shippable and none of them depends on Studio Lite existing — the mock is
the reference implementation (`CLIP-LITE-PATTERN-PLAN.md` §7).

**M1 — fix the wrapping bug.** `.tc > span:last-child{flex:none}` and a `flex-wrap:nowrap` on the
row. Three controls stop overlapping the timeline. *Test:* `getBoundingClientRect().top` of every
`.tc` child equals the row's own `top`; no child's box intersects `.tlw`.

**M2 — remove the actions row.** Delete `.tc`'s snap/zoom/fit buttons and the `#rl`/`#rd` ruler's
row dependency; re-home the dot ruler onto the timeline band's top edge (it belongs there anyway —
in the reference the ticks sit adjacent to the film, not in a button row). Chrome drops 40px.

**M3 — the ⋮ sheet.** Build the shell, wire snap + zoom + frame-step + trim-to-playhead. *Test:*
every removed control is reachable in the sheet; the sheet is ≥44px per row; `Done` closes and
`Cancel` restores the snapshot, exactly like the property bar.

**M4 — Focus state.** Header becomes an overlay + auto-fade + the tap guard from §4. Use it as the
default under 380px. *Test:* tap once on a hidden chrome → header appears and playback is
**unchanged**; tap again → playback toggles. And: the canvas' rendered top never moves when the
header fades.

**M5 — the header centre slot.** Add the slot with the readout; move export-frame into ⋮ (or into
the slot, per §10).

**M6 — trim the rail.** Drop `trim start` / `trim end` from the rail (they are handle gestures plus
`[`/`]`), leaving speed / volume / filter / rotate / duplicate.

**M7 — persistence + hardening.** `localStorage` for snap and theme; `prefers-reduced-motion` on the
fade; verify one-handed reach of ⋮ in Focus; re-run the 320/366/390 sweep in both themes.

---

## 9. Refusals

- **Do not hide a control behind a gesture that has no visible alternative.** Pinch-zoom is fine to
  *add*, but zoom must still exist in ⋮ — a phone with a cracked digitiser, or a user on a
  trackpad, still has to be able to zoom.
- **Do not auto-hide the chrome while paused.** Media players that do this make the user tap twice
  for every decision.
- **Do not put tier-1 controls in ⋮.** Split and undo are used every session; burying them to reach
  12 controls would be a worse app with a better screenshot.
- **Do not shrink the buttons to fit more in.** §5.3's 44px floor is not negotiable, and it is why
  this is a *placement* problem rather than a size problem.
- **Do not build a settings *page*.** One sheet, no nesting (YT study P3: "no tabs of tabs").

---

## 10. Open questions

1. **Header centre: export-frame, project readout, or empty?** Recommendation above is the readout.
   The user's suggestion of export-frame is the better *feature*; it is the weaker *header citizen*
   if it is a rare action.
2. **Is Focus the default on every phone, or only ≤380px?** Auto-fading chrome on a large phone is
   a nice flourish; as the default it could feel like the app is hiding from the user.
3. **Does the actions row come back in landscape / on a tablet?** On a 900px-wide surface there is
   room for the zoom cluster; the tier-B spec already switches to a pinned inspector. Probably yes —
   but it should be a *deliberate* tier rule, not an accident of `@media`.
4. **Where does the dot ruler go?** Moving it onto the timeline band top edge is the right call, but
   it then competes with the text lanes for the first 14px. Options: put it *under* the last lane,
   or make it a 12px gutter above the video lane.
5. **Is undo-without-redo acceptable on touch?** The plan keeps redo. If redo moves to ⋮, the
   transport is 3 controls — but the recovery path becomes two taps, which is the one case where
   saving a button costs more than it saves.

---

## 11. Applied: M1–M3, and the four bugs it found

**Done in [`clip-lite-mock.html`](clip-lite-mock.html).** The actions row is gone; ⋮ opens a settings
sheet holding snap, zoom, frame-step and fit-all; and the dot ruler rides the film. The JS is
otherwise untouched, so the loop, the gestures and the export path are unchanged.

**One thing the first cut got wrong, and the fix.** The timecode was parked in the header centre to
buy back the row outright. That was a mistake in both directions: the header is the wrong place for a
*transport* readout (it belongs next to the ruler, where the reference puts it), and it left the sheet
as the only place to read a duration while scrubbing. It now sits in a **30px readout row between the
transport and the timeline**, centred, with the dot ruler masked out around it so the ticks flank the
clock — which is exactly the reference's structure. That row carries **no buttons**, so the clutter
that started this plan does not come back with it. `Trim to playhead` was also dropped from the sheet:
it is two gestures (drag a handle) plus `[` / `]`, and it was the one row that duplicates a control
already living on the clip itself.

**Measured at 366×836, dark, one clip selected** (browser, `getBoundingClientRect`):

| | before | after |
|---|---|---|
| always-visible controls | 21 | **16** |
| chrome above the timeline | 148px | **138px** |
| — header | 56px | 56px |
| — transport | 52px | 52px |
| — actions row | 40px | **0** |
| — readout row | (none) | **30px** |
| preview band `.view` | 434px | **450px** |
| timeline band `.tlw` | 182px | **176px** |
| controls overlapping another row | 3 | **0** |

The honest headline is therefore **−5 controls and +16px of preview**, not the −40px the first cut
claimed: six buttons left the chrome, one (⋮) joined it, and the readout row costs back 30px while
carrying none. That is the right trade — the space went to the preview, and the buttons that were
competing with play are gone — but it is a different claim from "40px reclaimed", so the plan's §7
target of 108px was wrong and is corrected here.

The sheet renders four 48px rows with hairline separators, keeps the preview above it, and its
controls were driven end-to-end: the snap switch flips and persists to `localStorage`, the slider and
the ± buttons stay in sync, `Fit all` measures the viewport when the timeline is hidden, frame-step
advances exactly 1/30s, and Done closes and restores the dock without moving the playhead.
Re-verified at **320×700, 366×836 and 390×844** with no console errors, and every row's controls stay
inside the frame at 320px (the range input needed `min-width:0` to beat
`#panel input[type=range]{min-width:140px}`).

It was then re-run against **real media** rather than stub sources — the two canonical files in
[`TEST-MEDIA.md`](TEST-MEDIA.md): a 1080×1920 20s clip with audio, then a 1920×1080 silent one. That
exercised the paths a stub cannot reach — the filmstrip (11 real thumbnails), the waveform (501 peaks,
and an empty lane for the silent clip), and live playback advancing `t` — with the decluttered chrome,
zero console errors.

**Four bugs found — three of them mine, one of them yours**

1. **The wrap bug (M1's target).** Removing the row removed the bug with it, but the fix it needed was
the missing `display:flex` on the zoom wrapper: each `.ib` is `display:grid` (block-level), so the
three buttons stacked 40/40/40 inside a 40px row.
2. **Fit all computed from a hidden timeline.** With the sheet open the dock is `display:none`, so
`tl.clientWidth` is 0 and `fit` clamped to the *minimum* zoom (2 px/s) — the opposite of fitting.
Fixed with a `fitZoom()` that falls back to the viewport width.
3. **Frame-step zeroed the playhead.** `nudge()` writes `tl.scrollLeft`; on a hidden timeline that is
forced to 0, and the scroll handler then dutifully set `t = 0`. Fixed by only writing `scrollLeft`
when the element has an `offsetParent`, and by bailing out of the scroll handler when it does not.
4. **Closing *any* panel reset the playhead — pre-existing, and it affected the property panels too.**
`refresh()` calls `renderTL()` *before* `panel()`, so the timeline was still hidden on the frame that
measured it: `#inn`'s padding computed from a 0-width client as `0px`, and `t` collapsed to 0. Fixed
by dropping the `es` class before `refresh()` in both `closeEdit()` and the sheet's Done.

**A fragility worth naming.** The first time this was tested, a single thrown exception inside
`draw()` stopped `requestAnimationFrame(loop)` for the rest of the page's life — the timeline froze
with no visible error. A render loop that cannot survive one bad frame is a bad loop; the app version
should wrap the frame body in a `try/catch` that reports once and keeps ticking.

**Still to do:** M4 (the Focus overlay + auto-fade), M5 (the header centre slot — now that the
timecode has moved out, the slot is free for the project readout or an export-frame button), M6 (drop
trim-start/end from the rail), M7 (persistence beyond snap, `prefers-reduced-motion`, the one-handed
reach check on ⋮).

---

## 12. Part B — what the two screenshots establish

Two frames of the same app, same project, different **canvas** — and the difference between them is
the whole of Part B.

**Frame 1 — a portrait canvas.** The video sits inset with black bars down both sides, the header is
a row of icons along the top, and the transport / readout / timeline / rail stack below it. Structurally
this is where the mock already is.

**Frame 2 — a canvas that wants vertical room.** The preview now runs **from the very top edge of the
content area**, and the header icons — home, share, ⋮ — are **drawn on top of the picture**, not above
it. Nothing below the preview moved: same transport, same readout at the same height, same timeline,
same rail. The preview simply ate the header.

That is the observation, and it generalises into a rule the plan did not previously hold:

> **The preview band is measured from y = 0 to the top of the transport row. Everything inside that
> band — the header, the ⛶ — is an overlay, not a row.**

**Why this is not just §4's Focus state.** §4 treated the overlay as a *mode* on small screens or after
idle. The screenshots show it as the **resting** state: the reference's header is an overlay on a
normal-size phone with the app sitting still and nothing playing. Focus should therefore be promoted
from an optional state to **the default geometry**, with auto-fade as a separate, later refinement
(M4/§4 stays the fade behaviour; Part B takes the geometry).

The user's phrasing names the consequence exactly: *"when the aspect ratio changes to 9:16 it takes
the space of the header."* Today, switching to 9:16 makes the canvas **smaller** — it is height-bound,
so it narrows and leaves letterbox. With the header as an overlay the band is 56px taller, so a
portrait canvas gets **288×512 instead of 257×456** and finally reads at a sensible size on a phone.

---

## 13. The geometry change, with the arithmetic

Measured in the running mock at **366×836, dark, one clip selected** (`getBoundingClientRect`):

| row | top | height |
|---|---|---|
| header `.bar` | **0** | 56 |
| preview `.view` | **56** | 478 |
| transport `.ar` | 534 | 56 |
| readout `.ro` | 590 | 30 |
| timeline `.tlw` | 620 | 148 |
| rail `#tools` | 768 | 68 |

**Chrome above the timeline: 620px. Canvas: 257×456** in a 342×456 inner band (the band is height-bound,
so the canvas is narrow and the remaining 85px of width is letterbox).

The change is two declarations:

```css
body{position:relative}
.bar{position:absolute;inset:0 0 auto;z-index:7;height:56px;padding:0 6px}
.view{padding-top:0}
```

The header leaves the flow; `.view` becomes the first flex child and starts at 0.

**Applied and measured.** The table below is the running mock at **366×836** with one portrait clip,
not a prediction:

| | before | after |
|---|---|---|
| header consumes a row | 56px | **0** |
| preview band `.view` | 478px | **535px** |
| **canvas (9:16)** | **257×456** | **294×523** |
| canvas area | 117,192 px² | **153,762 px² (+31%)** |
| transport / readout / band / rail tops | 534 / 590 / 620 / 768 | **539 / 591 / 621 / 769** |
| controls visible | 16 | **16** |

**One prediction in this section was wrong, and the correction matters.** It claimed chrome above the
timeline would fall 620 → 564. It does not move at all: `.view` is `flex:1`, so it absorbs the freed
56px and **everything below the preview stays within 1px of where it was**. The gain is real but it is
entirely the preview's — the rows below do not shift, which is why the P1 invariant below holds for
free rather than needing to be defended.

+14.4% linear, +31% area on the single element the user is actually looking at, for two lines of CSS and
no new controls. At 320×700 the same move is worth 56 of 700px — **8% of the screen**.

**And that is exactly the problem the next plan has to solve.** Because the preview is the only row with
`flex:1` and no ceiling, it now takes every spare pixel on every device: 61% of a 378×770 screen against
19% for the timeline band. B1 fixed the preview and broke the balance — see
[`TIMELINE-SPACE-PLAN.md`](TIMELINE-SPACE-PLAN.md), which is Part C and is where this thread continues.

**The scrim was not optional — until the icons were moved out from under it.** This section originally
called a scrim mandatory: an overlay whose icons sit on a bright frame is unreadable, so it was painted
on `.bar::before`, 84px tall with a plateau to 40px, tied to `--bg`. That reasoning is sound and the
conclusion was wrong, because it treated "the icon overlaps the frame" as a fixed fact. **Reversed — see
§20.** The scrim is gone entirely and the header paints nothing; readability is bought with geometry
(icons into the margin) instead of paint — and after D4, with no per-icon chip at all.

**The tap guard (from §4, still required).** The canvas already binds tap-to-play. If the chrome is
auto-hidden, the first tap must **only** reveal it — otherwise waking the chrome also toggles playback
and the user fights the app every time.

**The P1 test, now a regression test rather than a principle.** Changing the canvas ratio and re-fitting
the preview must not move a single element below the transport row. Concretely: drive 9:16 → 16:9 →
1:1 → 4:5 and assert that the `top` of `.ar`, `.ro`, `.tlw` and `#tools` is byte-identical before and
after each switch. Today that holds by construction; after Part B it must still hold, because the header
is the only thing that moved out of the column.

---

## 14. Icons — smaller glyphs, identical targets

The reference's chrome icons look **lighter and calmer** than the mock's, and it is not because they
are heavier: it is because they are **smaller inside generous padding**. At a 2× screenshot the rail
and header glyphs read at roughly **20–22 CSS px**, with the tap target bought entirely by padding.
The mock renders every glyph at **24px** — measured `svg{width:24px}` — so it is the glyphs, not the
buttons, that are oversized. That is the "too big" the user keeps pointing at.

**Do not shrink the targets.** §5.3's 44px floor stands. Shrink the *drawing*:

| role | today | proposed | target (unchanged) |
|---|---|---|---|
| header `☀` `⋮` `⤴` | 24px | **20px** | 44px (`#theme`, `#more`, `#export`) |
| transport `trash` `cut` `undo` `redo` | 24px | **21px** | 48px (`.ib`) |
| play / pause | 30px | **26px** | 48px (`.play`) |
| ⊕ add-clip | 24px | **22px** | 44px (`#addf`) |
| rail glyphs | 24px | **22px** | 73×52 button |
| preview `⛶` | 24px | 20px | 44px (`#fs`) |

**Compensate the stroke, or "smaller" becomes "faint".** `stroke-width` is in viewBox units, so moving
from a 24px render to a 22px render thins every painted stroke from 1.6 device px to 1.47 — a 8% loss of
weight, which at 11px labels already reads as washed out. Set the rail/transport group to
`stroke-width:1.75` at 22px, which paints at exactly the 1.6px the mock has today: **smaller glyph,
identical weight.** (This is the whole trick; it is why the reference can be daintier *and* clearer.)

**Two optical-size problems in the current set**, both visible in the ICON table:

1. **The chevrons are undersized.** `prev`/`next` are `M15 6 9 12l6 6` — a **6×12** mark in a 24 box,
   where `dup`, `ts`, `te` and `aspect` fill 12–20 units. Next to a 18×12 rect the chevrons read as
   two-thirds scale. They need scaling to ~**8.5×14** (and the same for the ⋮-sheet frame steppers).
2. **`trans` and `speed` are open arcs** that read lighter than the closed shapes around them. Same
   fix: grow the mark ~10%, do not thicken the stroke.

**One inconsistency worth a decision.** `more` (`⋮`) is the only glyph drawn with `fill:currentColor;
stroke:none`. That is correct for a kebab and matches the reference, so it stays — but it means the
⋮ must never be scaled below 20px or its r=1.7 dots (≈2.8 painted px) blur into a bar. Note it and
floor it.

**Keep `fill` for play/pause.** The reference's play is a solid triangle against an outline set; that
contrast is what makes "the one button that should be findable without looking" findable. Do not
"clean" it into an outline.

---

## 15. Type — the reference is *louder* at the readout, not at the labels

The mock's type is quieter than the reference's in one place and busier in another, and separating the
two is what "cleaner fonts" means here.

**The readout is the loudest thing in the reference.** `00:00 / 00:39` spans roughly **90 CSS px** of
the screenshot for a 14-character string — about **18–19px**. The mock renders it at
**13px/500 in an 81×19 box**, which makes the one number the user checks constantly the smallest text
on screen. It should be the *largest* UI text in the dock.

| element | today | proposed | why |
|---|---|---|---|
| readout `#time` | 13px / 500 (`b` 700-ish) | **15px / 500**, `font-variant-numeric:tabular-nums` | halfway to the reference; tabular stops it jittering |
| readout colour split | both `--on` | current `--on`, total **`--on2`** | the reference dims the total; the hierarchy is free |
| rail labels | 11px / 500 | **11.5px / 500** | the reference's are ~12–13; ours are the floor of legible |
| panel / sheet title | 16px / 500 | 16px / **600** | it is a surface heading, not a row label |
| sheet row labels | 13px | 13px, `--on2` | unchanged, but dimmer than the control beside it |
| empty state | 15px | 15px | unchanged |

**What "clean" does *not* mean here.** It does not mean a smaller readout with wider tracking (that is
what the mock had before §11 and the user rejected it), and it does not mean thinning the labels below
11px. The single highest-value change in this table is the **15px readout with a dimmed total** — it is
one declaration pair and it makes the whole dock read as if it were designed rather than filled in.

**Font source.** The mock loads Roboto from the CDN (open question §10). The screenshots are Roboto, so
the metrics match — but a CDN that fails leaves the fallback stack with different widths and the 30px
readout row visibly re-wraps. Vendoring the two weights to `docs/studio-lite/fonts/` is the change that
makes the mock's type *reliable* as well as clean, and it is a prerequisite for trusting any of the
measurements above on a fresh machine.

---

## 16. Four smaller details from the screenshots

1. **`⛶` lives in the letterbox, and stays there.** In frame 1 it sits in the black bar to the right of
the portrait video — outside the picture, at ~24 CSS px with no circular background. The mock already
puts it in the band corner and already dropped the dark circle (§10), so this only needs the glyph at
20px and a faint rounded-square ring, which is what the reference actually draws.
2. **The audio lane is a card, not a band.** The reference's waveform is a **rounded filled teal
rectangle with a white waveform**, sized and positioned to the clip — not a full-bleed lane stretching
the width of the timeline. This is a real difference in how a clip's audio *reads*: a card says "this
clip has audio, here it is"; a band says "this row is audio". **Marked optional** — it is the one item in
Part B that changes timeline semantics rather than chrome, and it deserves its own before/after.
3. **Tick dots flank the readout.** The reference has two small dots to the right of the timecode, on
the same baseline — the ruler's ticks continuing past the (masked) clock. The mock masks the ruler
around the readout but draws no continuation. Cheap, and it is what makes the readout look *placed*
rather than *inserted*.
4. **The rail scrolls in both, but only the reference advertises it.** In the reference's frame 1 the
first label is clipped mid-word ("erate image"), which is what tells you the row scrolls. The mock
restored an edge fade at 320px (§11); the reference's cut-off label is the stronger signal and costs
nothing. Consider letting the first item be partially cut by default on narrow widths instead of
padding it flush.

---

## 17. Build order for Part B

Each step is independently shippable and independently verifiable.

| # | Step | Risk | Verifies |
|---|---|---|---|
| **B1** | Header → `position:absolute`; `.view` starts at y=0 | **low** | band 478→534, canvas 257×456→288×512 |
| **B2** | Gradient scrim (dark + light), legibility over a bright frame | low | `☀ ⋮ ⤴` readable over a white sky |
| **B3** | Glyph scale + stroke compensation + chevron/arc normalization | low | 22px glyphs paint the same 1.6px stroke |
| **B4** | Type scale: 15px tabular readout, dimmed total, 11.5px rail labels | low | readout box ~90×22, no jitter while scrubbing |
| **B5** | `⛶` ring + 20px glyph | low | stays in the letterbox at every ratio |
| **B6** | Auto-fade + tap guard (this is §4/M4's behaviour) | **medium** | first tap reveals, second taps play |
| **B7** | Audio lane as a rounded card | **medium** | silent clip renders no card; multi-clip sums correctly |
| **B8** | Tick dots flanking the readout | low | dots track the ruler while scrolling |

**Test matrix for every step:** 320×700, 366×836, 390×844; light and dark; empty state; one clip; two
clips with a transition junction; property sheet open; fullscreen; and the **P1 regression test** from
§13. The two real files in [`TEST-MEDIA.md`](TEST-MEDIA.md) are mandatory for B7 — the silent landscape
clip is the branch that matters, and a stub cannot reach it.

---

## 18. Refusals and open questions for Part B

**Refusals**

- **Do not put the readout back in the header.** It was tried and rejected (§11); the header-centre slot
  stays free (§5, §10) for the project readout or export-frame.
- **Do not shrink any glyph below 20px, or any target below 44px.** Compact means the drawing, not the
  control.
- **Do not depend on the scrim alone for legibility.** If a frame is bright enough that the icons still
  disappear, the answer is a stronger scrim, never a lighter icon.
- **Do not auto-fade the chrome while paused or while a panel is open.**
- **Do not let the overlay swallow the ⛶ or the ⊕.** They are inside the band; if the header fades, they
  must not fade with it.

**Open questions**

1. **Does the overlay become the geometry at *all* widths, or only ≤ 420px?** The screenshots say all
   widths; the desktop mock has a 960px centred dock and plenty of room. *Recommendation:* overlay
   everywhere — the inconsistency costs more than the 56px is worth on a wide screen.
2. **Does the canvas extend *under* the scrim, or stop below it?** Frame 2 says under. Under is prettier
   and matches the reference, but it means the top ~40px of the picture is always partly behind chrome.
   *Recommendation:* under, with the scrim fading to fully transparent by 56px.
3. **Is the readout 15px or the reference's 19px?** 19px is closer to the reference but adds 6px to a row
   that carries no buttons. 15px is the value the plan currently commits to.
4. **Does the audio lane become a card (B7), or stay a band?** It is the only change here that alters
   timeline semantics, so it may belong in the Studio Lite plan rather than the chrome plan.
5. **Vendor the fonts before or after Part B?** Before, strictly — B4's measurements are meaningless on
   a machine that silently fell back to `system-ui`.

---

## 19. Applied: B1–B5, and the two corrections it forced

**Done in [`clip-lite-mock.html`](clip-lite-mock.html).** B1 (header overlay), B2 (scrim), B3 (icon
scale), B4 (type scale) and B5 (the fullscreen mark). B6–B8 remain plans.

**Measured after, at 366×836 with the portrait clip from [`TEST-MEDIA.md`](TEST-MEDIA.md):**

| | before | after |
|---|---|---|
| preview band `.view` | 478px | **535px** |
| canvas (9:16) | 257×456 | **294×523** |
| canvas area | 117,192 px² | **153,762 px² (+31%)** |
| header covers the canvas | none | **56px (11% of the frame)** |
| transport / readout / band / rail tops | 534 / 590 / 620 / 768 | **539 / 591 / 621 / 769** |
| controls visible | 16 | **16** |

**The icon scale is compensated, and it is checkable.** Glyphs are 20px in the header, 21px in the
transport, 22px on the rail, 26px for play (was 24/24/24/30). Because `stroke-width` is in viewBox
units, each group carries its own value — 1.92, 1.83, 1.75, 1.92 — so every group paints **exactly
1.60 device px**, verified in the browser. Smaller icons, identical weight.

**Type:** the readout is 15px/500 tabular (14px at 360px and below), rail labels 11.5px, the sheet
title 600. The `.ro` row stayed at 30px, so the readout got louder without spending a pixel it had
already spent.

**The ⛶ is a bare glyph again** — 20px. The ring this paragraph originally recorded was removed
again in §20: three things came off that glyph in a row, all mine (the chip, the drop-shadow, the
ring), and what survives is the crop marks in the icon's own colour.

**Two corrections to this plan, both from measuring rather than reasoning:**

1. **A scrim that finishes inside the bar does not cover the icon row.** The first cut faded
   84% → 0 across the 56px header, which leaves the bottom of the 48px icon row at about **0.13
alpha** — precisely where the ⋮ and ⤴ sit. It looked fine over a dark frame and washed out over a
   bright one. The scrim moved to `.bar::before`, 84px tall with a plateau to 40px, so the whole row
   holds better than 0.5 while the wash still ends 16% down a 523px frame. *(Superseded by §20 — the
   scrim is deleted outright rather than tuned.)*
2. **`chrome above the timeline` was the wrong metric and the prediction from it was wrong.** §13
   claimed 620 → 564px. Because `.view` is `flex:1`, nothing below the preview moves at all — the
   preview simply absorbs the freed 56px. Corrected in §13, and it is the reason Part C exists: a row
   with `flex:1` and no ceiling takes every spare pixel on every device.

**Still to do:** B6 (auto-fade + the tap guard), B7 (the audio lane as a rounded card), B8 (tick dots
flanking the readout), and all of [`TIMELINE-SPACE-PLAN.md`](TIMELINE-SPACE-PLAN.md).

---

## 20. Applied: B2r — the scrim is gone, and the header learned to move

**The reversal.** §13 and §19 both argued that a bare overlay over a picture is unreadable, and both
were wrong, because both assumed the icons have to sit on the picture. The reference never does that:
its icons live in the **black margin beside** the frame, on the app's own chrome, and the frame is left
completely clean. Once the arrangement is allowed to change with the aspect ratio there is a third
option that neither section considered — put the icons where the frame is not — and it costs nothing.

**`.bar` now paints nothing at all.** No background, no `::before`, no gradient of any kind; verified
in the browser that `background-image` is `none` on `.bar` and every descendant, and that `.bar::before`
does not exist. A 9:16 frame runs clean to `top: 0` under the icons.

**The arrangement, at 9:16 — the reference's read.** ⌂ alone at the far left, ⋮ at the far right on the
top line, ⤴ sharing directly underneath it down the same margin, ⛶ bottom-right. Icons are **bare**,
thin and bare: the glyph sits on `--bg` (white in light theme, `#0f0f0f` in dark), so the contrast is
the app's own and never the frame's. The bar grows from 56px to 116px to hold the stack, which is free —
it is absolutely positioned over the stage and out of flow.

**There is no chip anywhere.** An earlier cut of this section gave the ratios that run canvas to the
edge (16:9, 1:1, 4:5) a 36px rounded chip in `--bg` on each button, as a readability fallback. It is
deleted. Once the arrangement is allowed to move with the ratio, the ratio only decides *where* the icons
sit, never what they look like — and a chip made the header read as a row of cards, which is the exact
clutter this pass exists to remove. The icons are bare in both states, and hover is the app's original
48px wash again. Delete nothing to restore it; there is nothing left to restore.

**`body.gut` is measured, not keyed to a ratio string.** `fitView()` already knows the preview's height
and the ratio, so it derives the canvas width from the same rule the box uses
(`max-width:100%; max-height:100%`) and measures the gap **to the body edge** — the bar spans the body,
so that is the space the icons actually get. `GUT_MIN=52` is the 44px button plus the bar's 4px padding
plus 4px of air. 9:16 is the only ratio that clears it, but a hardcoded `proj.ar==='9:16'` would break
the moment the ceiling moved, and the failure would be an icon on somebody's face.

**Measured, 9:16 with the portrait clip from [`TEST-MEDIA.md`](TEST-MEDIA.md):**

| | 320×700 | 366×836 | 378×770 | 390×844 |
|---|---|---|---|---|
| canvas | 206×366 | 247×439 | 227×404 | 250×444 |
| margin each side | **57px** | **60px** | **75px** | **70px** |
| icon box → canvas edge | **9px clear** | **12px clear** | **27px clear** | **22px clear** |
| arrangement | margin, stacked | margin, stacked | margin, stacked | margin, stacked |
| chip on icon | none | none | none | none |

Every other ratio at 378×770 measures a 12–14px margin (below `GUT_MIN`), so `body.gut` is off and all
three icons take the chip — asserted for 16:9, 1:1 and 4:5, in both themes, with the chip resolving to
`white/0.76` + a `#0f0f0f` glyph in light and `#0f0f0f/0.76` + a white glyph in dark.
*(Superseded: the chip never shipped. See "There is no chip anywhere" above.)*

**Three smaller things this pass had to fix to get there:**

1. **`fitView()` was assuming a 24px stage padding** (`v.clientWidth-24`), which is only true below 900px.
   It now reads the real padding, so the desktop `32px` gutter is included in the width the canvas plans
   for. Without this the measured gap on a wide screen is wrong by 40px and the decision is made on a
   number that does not exist.
2. **`.bar` is `pointer-events:none` with `auto` back on the buttons.** It is an overlay over the stage;
   an overlay should not eat taps aimed at the picture beneath it.
3. **Entering and leaving fullscreen re-fits.** `.view.fs` drops the padding to 0, so the gap computed
   from it is fiction — `#fs` and `Escape` both call `fitView()` again. A 9:16 round trip returns to
   byte-identical geometry (250×444 → 390×693 → 250×444).
4. **The canvas lost its 8px radius.** The preview is the picture, not a card, and once the header
   stopped covering its top edge the rounded corners were the last thing making it look like a UI
   surface floating over the page. `canvas{border-radius:0}` and the `.view.fs canvas{border-radius:0}`
   override that existed only to undo it are both gone — fullscreen is now the same declaration rather
   than a special case, which is the point. The offscreen thumbnail canvas in `thumbs()` is created but
   never appended, so the global selector never touched it; the filmstrip keeps its radius from
   `.film{overflow:hidden}` and `.clip`.
5. **The theme is now a stored choice instead of a fresh guess every visit.** `#theme` wrote
   `data-theme` and nothing else, so closing the tab threw the decision away and the app followed the
   OS again — a user who picks dark on a light laptop got it back on every reload. It reads and writes
   `lite:theme`, alongside the existing `lite:snap` key and behind the same `try/catch`, because
   private mode throws on write and the theme must still apply when it does.

   The read happens in a **6-line script in `<head>`**, before the first paint, not in the main script:
   reading it later shows the OS theme for a frame and then flips, which is the one thing a dark-mode
   toggle must never do. Until the user chooses, the CSS media query still follows the OS untouched —
   JS only takes over once there is something stored to take over with.

   It also pins the two `theme-color` metas by stripping their `media` and writing one colour, so the
   browser's own chrome stops second-guessing the app. **The favicon cannot follow**, and this is the
   one documented gap: it is an SVG data URI, which has no access to `localStorage`, so a stored dark
   theme on a light OS keeps the red mark. The alternative was a second copy of the path in JS, free
   to drift from the one in the markup, for an 8px tab glyph.

   Verified all three states by reloading with the browser's colour scheme emulated against it: stored
   `dark` on a light OS renders dark on first paint, stored `light` on a dark OS renders light, and no
   stored value leaves the attribute unset with both metas still media-scoped.

**Verified:** no page scroll at any of the four sizes, sheet open/close round-trips with the flag intact,
the empty state falls back to 16:9 and therefore to the single-row arrangement, console clean, build passes. The screenshots
in the Preview panel are the authority for how it reads; the numbers above are the authority for where
every pixel landed.

---

## 21. Open: opening a property sheet resizes the preview

**The symptom.** Tapping any tool in the rail and having the sheet open makes the picture jump and
grow, and the header icons lose their arrangement. It reads as the app flinching.

**Measured, 378x770, dark, one 9:16 clip:**

| | `.view` height | inline flex | canvas | `body.gut` |
|---|---|---|---|---|
| sheet closed | **416** | `0 0 416px` | 234x416 | **true** |
| Settings sheet open | **504** | `1 1 auto` | 284x504 | **false** |

+88px of height, +50px of width, **+47% of canvas area** — while the user is adjusting a property. And
the header's margin arrangement (`body.gut`) goes false for the duration, so the icons fall back to
the single row exactly when the user is in a property sheet.

**One cause, not two.** `fitView()` abandons its computation when the dock is hidden:

```js
if(!dock.offsetHeight){v.style.flex='1 1 auto';return}   // sheet open — the stage fills
```

That branch predates C1-D3, when `.view` had no ceiling and "fill" meant "sensibly fill". Now that the
preview's height is a *computed* number, "fill" means "take whatever the sheet left over" — and what
the sheet leaves over is a function of **its content height**, not of the viewport. So the same clip
previews at one size behind the Format sheet and another behind the taller Settings sheet. Measured:
Settings open gives `.view` 504; a taller sheet gives 416. The preview size became a function of which
tool you tapped.

The `gut` flip is the same dead branch: the gutter measurement sits *after* the return, so it is
simply not executed while a sheet is open. Same for `laneH`/`paintFilms()`.

**Why it looks like a shift rather than a resize.** At 9:16 the canvas is height-bound, so it scales.
At 16:9 / 1:1 / 4:5 it is width-bound, so a taller `.view` cannot make it bigger — it only moves, because
`.view` centres it vertically. Verified at 16:9: canvas top 121 closed, 108 with a sheet open, size
unchanged. Same bug, two different-looking symptoms, which is why this reads as two problems.

**Closing returns exactly** — the ladder is a pure function of its inputs and the sheet height returns to
0 — so this is a round-trip flicker, not a drift. That also makes it cheap to test for.

**The fix, in order:**

- **P1 — the preview's height must stop being a function of the sheet.** Delete the
  `flex='1 1 auto'` branch and always write `0 0 Npx`, so the preview's height is a pure function of the
  viewport and the ratio in every state. This is the whole fix; P2-P4 are consequences of taking it
  seriously.
- **P2 — decided: the preview is PINNED. It never resizes for any sheet, and the sheet scrolls
  instead.** The rule to implement: `view = clamp(want, floor, min(cap, innerHeight*VIEW_CEIL))`, with
  `avail` used only as a guard against overflow, never as a reason to shrink. Rationale — the picture is
  the thing being judged while a property is adjusted, and a judge that moves under you while you are
  adjusting it is worse than one that is slightly too large for a very tall sheet. It also matches how
  most editors behave. The rejected alternative was to let the preview *yield* and shrink to fit, which
  avoids overflow on small phones but reintroduces exactly the resize this section exists to remove,
  only for tall sheets instead of all of them.
- **P3 — the sheet takes the scroll instead.** `#panel` needs `flex:0 1 auto; min-height:0; overflow-y:auto`
  so a tall sheet shrinks within the space the pinned preview leaves and scrolls there. Its current
  `min-height:260px` is a floor that would fight this. `#panel.set` already has
  `max-height:64vh; overflow-y:auto`, which is the shape to generalise.
- **P4 — one exit from `fitView()`.** The gutter measurement and the filmstrip re-layout currently live
  past a `return`, so both are skipped in one whole class of states. Move them above every exit, or
  delete the early returns. This is the part that would be easy to leave behind and expensive to
  rediscover.
- **P5 — reconcile the CSS guard.** `v.style.maxHeight='none'` is written on every call, which is right
  (the stylesheet's 54% is a first-paint guard), but it means the inline path and the stylesheet
  permanently disagree. Say so once in the comment rather than leaving it as a trap.
- **P6 — round-trip regression test.** For every sheet the rail can open (Format, Settings, Rotation,
  Speed, Volume, Filter, Transition, Text), assert `.view` height, the canvas rect and `body.gut` are
  identical before open and after close. The current bug would fail this on the first sheet.

**Status: analysed and specified, deliberately not implemented.** The pinned-vs-yield question is
resolved above; what remains is the edit.

---

## 22. Open: the Settings sheet is not one of the property sheets

**The finding.** Every property sheet in the mock is the same three parts: an `.eh` title, an `.eb`
content block, an `.ef` footer with Cancel / Reset / Done. Settings is all three of those plus a fourth
thing — `.eb.st` — which switches the content to a left-aligned hairline list with its own padding, its
own `.sr` rows and its own `.sw` toggle. Two design systems stacked in one panel, and Settings is the
one that looks borrowed.

**And the primary action is below the fold.** Measured with §21's pinned preview:

| | space below preview | sheet wants | scrolls | Done visible |
|---|---|---|---|---|
| 378x770 | 354 | 329 | no | yes, 6px spare |
| **320x700** | **322** | **329** | **yes, 7px** | **no — 1px below the fold** |

`#panel.set{max-height:64vh}` is a magic number that does not know how much room the preview left. That
room is `100vh - previewHeight`, which §21 made a stable number and which the mock now knows. The cap
is both wrong and, after P3, redundant: `flex:0 1 auto; min-height:0; overflow-y:auto` already sizes the
sheet to what is left and scrolls it.

**Why it does not read as clean, specifically:**

1. **Four rows, four unrelated idioms.** A toggle, a slider flanked by two icon buttons, a pair of
   chevron buttons, and a chip. Zoom and Frame step are *the same control* — a minus/plus pair on a value
   — so they look identical while doing different things. That is worse than either being distinct.
2. **No value anywhere.** The other sheets lead with a 20px `<b>` readout (`2×`, `100%`, `0°`). Settings
   shows only a 13px `--on2` label, so the quietest text on screen belongs to the settings you are least
   likely to check. You cannot see your current zoom or frame step at all.
3. **A command wearing a row's clothes.** "Fit timeline" is an action, not a setting; it shares a hairline
   and a label with three things that persist state.
4. **It is mis-scoped as a whole.** All four rows act on the *timeline*, which is visible on screen while
   this sheet is open. The sheet is called "Settings", which promises app-wide.
5. **It overrides the sheet's own padding** (`4px 18px 6px` against the standard `20px 20px 16px`, and
   `.eh{padding:12px 0 6px}`), so its title sits closer to the top edge than Format, Rotation or Speed.

**The plan:**

- **S1 — make Settings a peer.** Delete `.eb.st`, `.sr`, `.sg`, `.sw` and `#panel.set`'s padding
  overrides, and build it from `.eh` / `.eb` / `.ef` like every other sheet. One language, one set of
  rules to keep consistent. This is the whole of "clean" — the inconsistency is the clutter.
- **S2 — a real footer.** Settings renders `<span></span>` + Done, right-aligning with an empty
  placeholder. Give it the standard Cancel / Reset / Done. Cancel is no longer optional anyway: P3 made
  the sheet scrollable, and a scrollable sheet whose only exit is below the fold is a trap.
- **S3 — delete the 64vh cap** and let the leftover do the sizing. The number is now knowable and the
  flex rules already handle it.
- **S4 — budget the rows so it fits without scrolling at 320x700.** 4 x 48px rows + title + footer is
  329 against 322. Either 44px rows (−16) or drop a row. Target: no scroll on any tested size.
- **S5 — give every row a value**, reusing the `<b>` readout the other sheets already have. Zoom reads
  **seconds across the screen** (`5.8 s across`), not px/second: pps is a rendering detail, and the user
  is asking "how much timeline can I see". It rounds to a tenth under 10s and to the second above it,
  because "167.3 s" is false precision. `tl.clientWidth` is 0 while this sheet is open (the dock is
  hidden), so the value uses the same fallback `fitZoom()` uses — otherwise it would read 0/0.
- **S6 — one stepper, used twice — revised: zoom is a stepper, and the slider is gone.** The slider was
  the wrong control for this value: linear across 2-240 px/s, but 2 shows ~173s of timeline (a 20s clip
  40px wide) and 240 shows ~1.4s, so both ends are unusable and ~75% of the travel is dead. It also
  made the row do four jobs in 338px. Zoom is now the magnifier `−/+` pair at 1.25x steps plus the `Fit`
  chip — Fit covers the coarse jump, the pair covers fine, and the row matches "Step one frame". The
  pair disables itself at the range bounds so the limit is visible rather than silently ignored. (The
  timeline already had pinch-to-zoom and ctrl+wheel zoom, which is the real reason a slider was
  redundant: the surface itself is the direct control and this row is the precise fallback.)
- **S7 — group by subject, and stop lying about scope.** Either retitle the sheet to "Timeline" so the
  four rows mean something, or split it: three persisting settings plus one command, with Fit promoted
  out of the list.
- **S8 — verify.** Sheet fits with no page scroll and Done fully visible at 320x700 / 366x836 / 378x770 /
  390x844, both themes, with the P1 pin holding.

**Open question, and it is the bigger one.** Should three of these four rows exist at all? Zoom and frame
step are *navigation on a visible timeline*, not settings — a pinch or a long-press on the timeline
would serve both without a sheet. If they move there, Settings becomes one row (snap to edges) and the
clutter is gone rather than restyled. That is the endpoint this whole document is pointing at, but it is
a behavioural change, not a layout one, so it is not assumed here.

**Status: implemented** (S1, S3-S8), with two deliberate departures recorded above: no Cancel button,
and `.sr` kept as the list primitive. Verified at 320x700 / 366x836 / 378x770 / 390x844 in both themes —
the sheet no longer scrolls anywhere and Done is never below the fold.

---

*Plan produced 2026-10-02; §11 records M1–M3, §19 records B1–B5, §20 records B2r (the scrim deleted and
the header rearranged), §21 analyses the sheet-resize bug and specifies the pinned fix without
implementing it, §22 does the same for the Settings sheet, §12–§18 are Part B (the screenshot-driven
geometry, icon and type pass). Measurements taken from `clip-lite-mock.html` at 320x700 / 366x836 /
378x770 / 390x844, both themes, one clip selected.*
