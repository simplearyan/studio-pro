# YouTube Create → Studio Lite — pattern study and adoption plan

**Status:** study + plan. Nothing here is built into the app yet.
**Mock:** [`yt-create-mock.html`](yt-create-mock.html) — the interactive version of everything below.
**Shared spec:** [`../STUDIO-LITE-PLAN.md`](../STUDIO-LITE-PLAN.md) — §2 jobs, §3 scope, §5 gestures, §6 tiers.
**Source material:** 8 screenshots of YouTube Create (Android), taken 2026-10-01, filed as local reference media at
`_demo_assets/images/yt-create-01-canvas-square.jpeg` … `yt-create-08-panel-text-art.jpeg` (717×1600 each, not committed — same
convention as every other still attached to a bug or a study).

**The question this answers.** Studio Lite is a phone-first app over the same project file; YouTube Create is the most
polished phone-first video editor in the wild. Which of its patterns do we take, which do we adapt to our model, and which
do we refuse?

---

## 0. The finding, in one paragraph

YouTube Create's phone editor is not a small desktop editor. It is built on two moves that a desktop editor cannot make:
**the preview is a band that only ever changes size** (the chrome beneath it never re-flows), and **the timeline's playhead
is pinned at the horizontal centre while the strip scrolls under your thumb** — so scrubbing is dragging film, not hunting a
playhead. Everything else follows from those two: property editors become "live preview on top, one control below, Cancel /
Done", animation becomes a grid of named presets instead of a keyframe track, and secondary tracks collapse into bars so the
video lane keeps its pixels. We should take the band, the pinned playhead, the collapsing lanes and the panel shell. We
should adapt the bottom rail (ours is navigation and must stay stable) and refuse the generative-AI tiles outright.

---

## 1. What each screenshot actually shows

| # | file | screen | what is on it | pattern it encodes |
|---|------|--------|---------------|--------------------|
| 01 | `yt-create-01-canvas-square` | editor, ~1:1 canvas | preview ≈ square, cropped to fill; ⛶ in the preview's bottom-right; transport (trash · scissors · play · undo · redo); `00:00 / 00:39`; timeline = filmstrip + green waveform + `+`, playhead dead centre; rail: Generate image · Sticker · Voiceover · Captions │ Canvas · Aspect ratio | the chrome block (transport / timecode / timeline / rail) is anchored; the preview is the only thing that resizes |
| 02 | `yt-create-02-canvas-9x16` | editor, 9:16 canvas | same project, same chrome, same rail; preview is now portrait and **taller**, and its bottom edge has not moved | changing the canvas ratio re-lays out the preview only; nothing below it shifts a pixel |
| 03 | `yt-create-03-fullscreen-preview` | fullscreen preview | video edge-to-edge; back arrow top-left, share top-right; bottom overlay = thin scrub track + white knob, `0:00 / 0:39`, ⛶ to exit | fullscreen **removes** chrome instead of adding a player; one tap from the preview |
| 04 | `yt-create-04-timeline-tracks` | editor, multi-track | title on the preview (`YOUR TITLE HERE`, rainbow + sparkles); timecode `00:06 / 00:39` with a ruler label (`00`) that has scrolled left; timeline stacks **two thin coloured bars → video filmstrip → green waveform**; playhead still pinned centre; rail now contextual: Overlay · Text · Sound · Generate video · Generate image · Sticker | overlay/text lanes **collapse into bars above the main lane**; the rail changes with selection |
| 05 | `yt-create-05-panel-rotation` | Rotation panel | live preview on top, thin scrub track with knob, centred ▶; panel title `Rotation`; one wide slider (centred = 0°); one square re-zero button; footer `Cancel` / `Done` | a property editor keeps the preview visible; one control per screen; one white primary |
| 06 | `yt-create-06-panel-start-finish` | animation panel | same preview/scrub; `Start` / `Finish` **tabs**; tile grid: `None` · `Dissolve` (ringed) · `Wipe vertical` · `Wipe vertical` · (second row partly visible); duration slider `0.2 s — 1.0 s — 2.0 s`; footer `Cancel` / `Reset` / `Done` | animation as a preset grid with a live thumbnail; in/out share one picker and one duration |
| 07 | `yt-create-07-title-edit-keyboard` | title editing | preview still live; one-line field `Your title here` with an `✕` clear; an accessory row (emoji · image · clipboard · gear · …); the system keyboard | text is edited **in place**, preview up, keyboard up — never a separate form |
| 08 | `yt-create-08-panel-text-art` | Text art panel | preview; scrub; play; panel title `Text art`; one row card: `Title` (muted label) over `Your title here` (value) | the style editor's entry point is the content itself; rows, not a form |

Two things I could **not** identify from the screenshots, noted so nobody assumes they were analysed: a small blue filled
circle at the top-right of the timeline area in 01/02, and a `|◁▷|` glyph on the video lane at the playhead in 01/04. Both
look like snap/magnet and trim-bracket affordances respectively, but that is a guess.

---

## 2. Twelve patterns, and the five that carry the rest

**The load-bearing five (adopt these and the app feels phone-native):**

- **P1 — The preview is a band; only it changes size.** Evidence: 01 vs 02 — the canvas ratio went from ~1:1 to 9:16 and the
  preview grew upward while its bottom edge and every row below it stayed put. Consequence for us: the shell is
  `[top bar] [preview band, flexible] [chrome block, fixed]`, and a canvas change must not re-flow the chrome. A desktop
  editor does the opposite — it makes the stage take whatever is left and pushes the panels around.
- **P2 — The playhead is pinned at the horizontal centre; the strip scrolls under it.** Both 01 and 04 show the playhead at
  exactly the middle of the display. Scrubbing is a drag on the film, there is no scrub ruler in the editor, and zoom decides
  how much time is on screen. This is a thumb-native replacement for "grab the playhead and slide it" — a gesture that is
  genuinely hard on a 6" screen with a 2px target.
- **P3 — One panel at a time, and `Done` is the only white thing on the screen.** 05, 06, 08 all use the same shell: preview
  on top, one control group, `Cancel` (dark pill) / `Done` (white pill), plus `Reset` in the middle when the panel has one.
  No nesting, no tabs of tabs, no hidden apply.
- **P4 — The preview stays visible inside every panel.** Property editing on a phone is "look and adjust", not "fill a form
  and hope". Our current Inspector sheet (§6.1) shows fields over a *covered* stage — this is strictly better and cheap to
  adopt: the panel takes the bottom 45–55%, the preview keeps the top.
- **P5 — Secondary tracks collapse into bars.** Shot 04 stacks two ~12px coloured bars above the video lane. Each bar still
  shows *where* the clip is and *which kind* it is, at a tenth of the height. The video lane — the thing you are actually
  editing — keeps its full ~40px because the overlays are not competing for it.

**The rest:**

- **P6 — Presets in a ringed grid, with the current one visibly selected.** 06: named tiles with live thumbnails, the active
  one ringed in white. No keyframe editor appears anywhere in the eight screens. This is the same bet our plan already makes
  (§3 scope: a curated 12–16 presets shared with Pro).
- **P7 — Start and Finish are tabs of one picker,** sharing one duration slider (0.2–2.0s) and one `Reset`.
- **P8 — The rail is contextual.** 01/02 (nothing selected) offer create-before-you-have-clips actions; 04 (a clip selected)
  offers clip actions. Six items and a divider grouping creation actions from canvas actions.
- **P9 — Fullscreen is a corner affordance on the preview itself** (⛶, bottom-right of the frame), not a menu item.
- **P10 — Rare and destructive actions sit directly under the preview next to undo/redo** (trash, scissors) — always
  reachable, never in the way.
- **P11 — Text is edited in place**: one-line field, clear button, accessory row, preview live above the keyboard.
- **P12 — Ruler labels float and scroll with the film** instead of being a fixed tick strip (04 shows a lone `00` that has
  scrolled left of the timecode).

**Where the reference is worse than our spec, and we should not copy it:** the transport row and the rail are visually
tighter than our 44px floor (§5.3 rule 1) — the transport reads at roughly 30 CSS px of row height. Their tap targets are
bought back with padding, and it shows as a cramped row. Our version keeps the same layout with ≥44px targets; a phone
mockup is cheap, a missed tap is not.

---

## 3. Measurements, and how to read them

Read off 717×1600 JPEGs, ±2px. These phones are ~360 CSS px wide (20:9), so **divide by 2 for CSS px**. Where a number
drives a decision I say so; treat the rest as proportions.

| thing | screenshot px | CSS px | note |
|---|---|---|---|
| top bar (home / share / ⋮) | ~96 tall | 48 | two rows of icons on the right (share, ⋮) |
| preview band bottom edge | y ≈ **800** (50% of height) | — | fixed in 01 and 02 |
| preview box, ~1:1 canvas | 680 × 655 | 340 × 328 | 41% of screen height |
| preview box, 9:16 canvas | 425 × 760 | 213 × 380 | 47.5% — grew upward, bottom unchanged |
| transport row | ~60 | 30 | 5 glyphs, play centred — **tighter than our 44px floor** |
| timecode row | ~40 | 20 | mono, `mm:ss / mm:ss` |
| timeline region | ~390 | 195 | 24% of screen height |
| video lane (filmstrip) | ~80 | 40 | never collapses |
| audio lane (waveform) | ~65 | 32 | collapsible |
| collapsed overlay bar | ~25 | **12** | still shows kind + position + extent |
| rail row | ~110 | 55 | 24px glyph + 11px label |
| panel footer (Cancel/Done) | ~110 | 55 | pills, white primary on the right |

Time is shown as `mm:ss / mm:ss`, not frames. Our app shows `00:00.0` in the transport and `9:16 · 4 clips` in the title
bar; adopting `current / total` as the timeline's own readout is a small win — it answers "how long is this thing" without
opening anything.

---

## 4. Two structural changes to what we mocked last time

Last turn's mock (`mock.html`) is the tier/palette/feature study: a ruler with ticks, a playhead that moves, four lanes at
20px, a bottom dock of four destinations, and an inspector sheet. Comparing it against these screenshots, two things are
simply worse for a thumb:

**4.1 Phone scrubbing should be "drag the film", not "drag the playhead".** Our Tier A ruler has 2px tick lines and a 2px
playhead: fine with a mouse, closed to a finger. Change for Tier A: the playhead is fixed at the centre, the lane area is a
scroll/drag surface (`touch-action: pan-x` → we own the gesture), and time labels ride along with the film. Tiers B/C keep
the fixed ruler and the moving playhead — with a mouse, seeing the whole project and sliding the playhead is better.
**Trade-off to accept:** you can no longer see the whole timeline at once; zoom decides how much time is on screen.

**4.2 Overlay lanes collapse by default.** Our kind-lanes are all 20px tall, which is flat-correct but spends 80px of a
phone's height on four lanes where only one is being edited. Change: the main video lane is always full height; every other
lane gets a `data-collapsed` state at 12px (with its 44px target intact, halo included). Collapsed is the default for
overlays; tapping a bar expands it. Our textures survive the shrink — a 12px waveform is still a waveform, a 12px hatch is
still a hatch — which is why the kind-as-texture grammar from the last mock pays off here.

---

## 5. Feature-by-feature mapping

| YouTube Create | Studio Lite equivalent | verdict | spec |
|---|---|---|---|
| canvas ratio switch (01→02) | `project.canvas.ratio` — 9:16 · 1:1 · 4:5 · 16:9, live preview | **Adopt** | new; must round-trip (§3.1) |
| Canvas (background fill for letterboxing) | canvas background token | **Adopt** | pairs with ratio |
| ⛶ fullscreen preview | immersive preview: chrome hides, scrub + timecode remain | **Adopt** | new |
| transport under the preview (trash · trim · play · undo · redo) | same row; trim = the gesture map's "split"/"edge" actions | **Adapt** — keep 5 glyphs, fix the target size | §5.3 |
| playhead pinned centre + scroll-scrub | Tier A timeline gesture | **Adopt** | §5.2 |
| collapsible text/overlay lanes (04) | `data-collapsed` per lane; video lane never collapses | **Adopt** | new |
| aspect-ratio readout in the timeline | `mm:ss / mm:ss` + zoom level | **Adopt** | new |
| Rotation panel (05) | clip transform: rotate (Pro has it), slider 0–360 + re-zero | **Adopt** | §3 |
| animation presets grid + Start/Finish tabs (06) | the 12–16 shared presets, In/Out tabs, duration 0.2–2.0s, Reset | **Adopt** — and the tiles can render from `src/engines/hic/adapters/waapi.js` so a thumbnail is a real frame of the preset, not a picture of one | §3, plan §4 |
| title field (07) | text clip content, one line, live, clear button | **Adopt** | §3 |
| Text art rows (08) | text style rows: font · size · colour · align · preset | **Adopt** | §3 |
| Sticker · emoji library | image clip | **Refuse** for v1 — a library is a content business | §2.3 |
| Voiceover | record path via MediaRecorder (iOS has no WebCodecs MP4 — §5.4) | **Defer** to v1.1 | §5.4 |
| Captions | the CC clip + auto-caption on import | **Adapt** — keep as a clip, not a rail destination | §3 |
| Generate image / Generate video | — | **Refuse** for v1: network + model + cost, and it is not one of the three jobs (§2.2). Revisit as an explicitly opt-in network feature. | §2.3 |
| one project, no project browser | J1 open-and-finish: open a project, fix it, export | **Adopt** (already true) | §2.2 |

---

## 6. Component specs

**The shell.** `[top bar 48] [preview band, flexible] [transport 44+] [timecode 20] [timeline ~195] [rail 56]`. The chrome
block below the preview is `position: sticky`-equivalent: it does not re-flow when the canvas ratio changes.

**Preview band.** The frame is `aspect-ratio: var(--canvas-ratio)` and sized `max-height: 100%; max-width: 100%` — the
bottom-anchored box from 01/02. ⛶ sits inside the frame's bottom-right at 44×44. During playback the chrome dims to 20%
after 2s of no input (the reference doesn't do this; we need it because our chrome is heavier).

**Timeline (Tier A).** Playhead: 2px, `--md-error`, fixed at 50% of the lane area, drawn *over* the film. Lanes: main video
`40px` (fixed, unscrollable) + overlay/audio lanes `12px` collapsed / `44px` expanded. Drag on the lane area with
`touch-action: none` owns the gesture; the film translates by `dx`, time = `start + dx / pxPerSecond`. Release: snap the
film so a clip edge or the playhead lands on a tick (tolerance 8px), then settle with a 120ms ease. Zoom: pinch on the lane
area, 2–40 px/second, remembered per project.

**Panel shell.** One component, N bodies: `{ title, body, commit, revert, hasReset }`. Opens over the bottom 45–55%; the
preview band stays visible and *live* (the panel writes to the same state the preview reads). `Cancel` restores the snapshot
taken on open; `Done` keeps it; `Reset` restores the panel's defaults without closing. Footer targets ≥44px; `Done` is the
only element with the inverse (white) fill.

**Animation panel.** `Start` / `Finish` tabs; grid of 3 columns × N rows of 88×64 tiles with a 2px ring on the active one;
duration slider 0.2–2.0s in 0.1 steps with the value above the knob and both bounds labelled; `Reset` clears both tabs.
Preview: tapping a tile plays it once on the preview via the WAAPI adapter's compiled `onFrame`, so what you see is the
preset, not a drawing of it.

---

## 7. Build plan

Phases are ordered so each one is shippable and testable on its own. Until the Studio Lite app exists, the mock in this
folder is the reference implementation of each phase.

**Phase 1 — canvas + preview band + fullscreen.** `project.canvas = { ratio, background }`; the preview band sizing; the
ratio switcher (4 tiles, live); fullscreen enter/exit with chrome removal. *Test:* switch ratio 9:16 → 1:1 → 16:9 and assert
every element below the preview band has an unchanged `getBoundingClientRect().top` (that is P1 as a test), and that the
project round-trips the new keys untouched (§3.1).

**Phase 2 — the timeline.** Pinned playhead, drag-to-scrub, film transform, zoom, snap-on-release, lane collapse. *Test:*
pointerdown → move → pointerup produces exactly one undo entry; `pointercancel` ends the drag; a collapsed lane's 44px
target still hits above the neighbouring lane.

**Phase 3 — the panel system.** One shell, six bodies (Aspect, Canvas, Rotation, Animation, Title, Text art). Snapshot on
open, commit on Done, restore on Cancel. *Test:* change a value, Cancel, assert the state is byte-identical to the snapshot;
change, Done, assert one undo entry.

**Phase 4 — animation presets, for real.** Feed the tiles from the shared preset list; compile each with
`src/engines/hic/adapters/waapi.js`; play a tile on tap. *Test:* every preset in the grid compiles and produces a distinct
first/mid/last frame; the preview and the export agree (§ the WAAPI adapter's scrub exactness checks).

**Phase 5 — text.** The one-line field with a clear button, live preview, keyboard-safe layout (`visualViewport`, §5.4), the
accessory row, and the Text art rows bound to the same text style object the inspector already edits.

**Phase 6 — the long tail.** Voiceover (MediaRecorder), captions from import, sticker → image clip. Each needs its own
decision doc; none of them block Phases 1–5.

**Phase 7 — hardening.** Keyboard/switch-control parity, `prefers-reduced-motion` on the preset previews, and a 4× CPU
throttle check against the §6.3 budget (first interactive < 2.5s).

---

## 8. Refusals, and the reason each one exists

- **Generate image / Generate video.** Network, credentials, cost per render, and an ML surface to maintain — for a feature
  that is not one of the three jobs (§2.2). If it ever lands it is opt-in, online-only, and clearly not part of the local
  editor.
- **Sticker / emoji libraries.** Our answer to "put a graphic on the video" is an image clip from the camera roll, which
  round-trips through Pro like every other clip.
- **A ruler with numeric ticks on the phone.** Shot 01 and 04 show why: pinned playhead + floating labels does the same job
  with a tenth of the pixels and no 2px touch targets.
- **A second theme.** YouTube Create is dark-first because YouTube is. Studio Lite inherits the shared Material 3 layer
  (§3.11) and stays light-first, with the variable-swap dark. The mock page in this folder is deliberately *not* an argument
  to re-skin the product — it uses the reference's own dark palette so the layouts can be judged honestly.

---

## 9. Open questions

1. What are the blue circle at the timeline's top-right (01/02) and the `|◁▷|` glyph on the video lane (01/04)? Snap toggle
   and trim bracket are guesses.
2. Does `Finish` get its own duration, or do the two tabs share the single 0.2–2.0s value? The screenshot only shows the
   `Start` tab selected.
3. Is the rail horizontally scrollable? Six items fit at 360px only if each is ~60px wide including its label, and the last
   label is clipped at the screen edge in 01.
4. Does collapsing a lane survive a project save? Our version should store it as view state per app, not in the project file
   (it is not content).
5. Shot 04's ruler label reads `00` while the timecode reads `00:06` — is the scale in seconds, or in "clips"? Worth one more
   screenshot before we copy the readout.
