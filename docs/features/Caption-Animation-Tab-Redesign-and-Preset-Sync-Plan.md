# Caption Animation Tab: Redesign + Caption↔Text Preset Sync Plan

Two related goals, one plan:

1. **Part A** — Redesign the caption **Animation** tab (inside the Captions
   panel) to be cleaner and CapCut-style: animated preset tiles instead of a
   wall of text buttons, grouped sections, a tidy contextual controls strip,
   and the app's shared card/tab tokens.
2. **Part B** — Make the caption animation vocabulary **bidirectionally
   shareable** with text clips: a caption preset applied from the Animation
   tab should be applicable to a regular text clip from the ANIMATIONS tab
   (and vice versa), with identical rendering on both paths.

**Feasibility answer up front: yes.** The two systems already share most of
the plumbing (verified against the code — line refs below). What's missing is
a small reverse-mapping table, a per-word draw hook in the text-clip renderer,
and the UI that surfaces caption presets in the ANIMATIONS Text card.

---

## Current state (verified live)

### The caption Animation tab (`animCard`, `renderSubtitlesPanel`, ~L16838)

- **15 flat text buttons** in a 4-col grid (5-col in horizontal dock): None,
  Fade Up, Pop, Letter Pop, Letter Fade, Typewriter, Word Glow, Color
  Highlight, Scale Pop, Underline Sweep, Gradient Sweep, Shake Emphasis,
  Stretch, Bounce, Rotate. No icons, no previews — a dense text wall.
- **Contextual controls** stack below the grid as conditional rows:
  Whole-caption-duration toggle, Highlight color, Pop/Stretch scale (word
  presets), and Letter motion → Travel / Pop scale / Rotate (letter presets).
  The panel height jumps as you switch presets; the rows are hard to scan.
- **In / Out / Dur** selects and an **Easing** select sit at the bottom —
  secondary timing controls visually equal to the preset grid.
- Mixed vocabularies in one grid: whole-caption (fade/pop), per-letter
  (letterPop/letterFade/bounce/rotate/typewriter), and per-word karaoke
  (wordHighlight/wordColor/wordPop/wordUnderline/wordGradient/wordShake/
  wordStretch) are not grouped.

### The text-clip ANIMATIONS panel (~L9970)

- Main tabs **Transform | Text | Custom**; the Text card has **In/Out/Loop**
  sub-tabs, each a `renderPresetGrid` (L9868) of **animated tiles** — a
  preview zone running a CSS animation class (`preview-typewriter`,
  `preview-slide-up`, …), an `Aa` glyph or brand block, plain label, check
  badge on the active tile (L9868–9905).
- Text-in presets (L9846): None, Typewrite, Flash, Snap, Odometer, Slide Up,
  Scale Fade — driven per letter in the clip renderer's `animTextIn` branches
  (L4788–4830).

### Bridges that already exist

| Bridge | Location | What it does |
|---|---|---|
| `TEXT_LETTER_TO_PRESET` | L3291 | text→caption letter map: `typewriter→typewriter`, `scaleFade→letterPop`, `slideUp→letterFade`, `odometer→rotate`, `randomSnap→bounce` |
| `ANIM_IN_TEXT_TO_CAPTION` / `ANIM_OUT_TEXT_TO_CAPTION` | L3289–3290 | whole-caption: `fade→fadeIn`, `zoomIn→scaleIn`, `pop→popIn`, `fade→fadeOut`, `zoomOut→scaleOut` |
| Caption renderer dual vocabulary | L19828–19841 | `drawSubtitlesOnCanvas` accepts caption `animPreset` AND text `animTextIn` values (falls back through `TEXT_LETTER_TO_PRESET`) |
| `subtitleEffectMap` | L6874 | synced caption clip edits from the ANIMATIONS tab (font, stroke, `animTextIn/Out/Ease/InDur/Stagger`, …) mirror into `sub.effects` via `setClipEffect` |
| `bakeSubtitleStyleIntoClip` / `convertSubtitleClipToText` | L16089+ | caption→text conversion retains the animation (via the bridge tables) |
| Caption per-letter renderer `drawCaptionLetters` | ~L19880 | letterPop/letterFade/bounce/rotate/typewriter with tunable travel/pop/rotate |
| Caption per-word renderer `drawCaptionWordGlow` | L19553 | the 7 word-karaoke presets, speech-timed sweep, pill via `drawTextBackground` |

### The two gaps

1. **No reverse map.** `TEXT_LETTER_TO_PRESET` goes text→caption only. There is
   no `PRESET_TO_TEXT_LETTER` (caption→text), so `convertSubtitleClipToText`
   and the ANIMATIONS Text card can't translate caption presets onto text
   clips.
2. **Word presets can't render on text clips.** `drawCaptionWordGlow` is only
   called from the caption overlay path. A text clip with `animTextIn =
   'wordGlow'` etc. would fall through to nothing (the clip renderer's
   `animTextIn` branches only know the 6 native text presets).

---

## Part A — Redesign the caption Animation tab (CapCut-style)

### Design principles (match the app + CapCut)

1. **Tiles, not text buttons.** The ANIMATIONS `renderPresetGrid` cell is the
   app's established preset-tile token (animated preview + label + check
   badge). Reuse it — don't invent a third preset-cell style.
2. **Group by motion type.** CapCut groups entrance / letter / word effects.
   Three small section labels: **Entrance**, **Letters**, **Words (Karaoke)**.
3. **One contextual strip.** Replace the stacked conditional rows with a
   single bordered "Effects" strip that swaps its contents by preset type
   (Karaoke options for word presets, Letter motion for letter presets,
   hidden for entrance presets). Fixed-height feel, no panel jumping.
4. **Timing collapsed to a compact group.** In/Out/Dur/Easing live together
   under a divider as a 4-field grid, visually secondary to the tiles.
5. **Shared tokens.** `subTabBar()` style segmented control where tabs appear,
   `rounded-lg border-surface-200 dark:border-surface-700` cards, 10px min
   type, brand accent only on the active tile.

### Concrete steps

- **Step 1 — Animated tile grid.** Build `captionPresetTileHtml(preset, label,
  icon, previewClass)` mirroring `renderPresetGrid`'s cell (L9868): preview
  zone with an `Aa` glyph running a CSS `preview-*` animation, label, active
  check badge. Map each of the 15 caption presets to a `previewClass`:
  - Entrance: `preview-fade-in`, `preview-pop`
  - Letters: `preview-typewriter`, `preview-slide-up` (letterFade),
    `preview-pop` (letterPop), `preview-bounce`, `preview-rotate`
  - Words: `preview-word-glow` (pulse), `preview-word-color` (accent flash),
    `preview-word-pop`, `preview-word-underline`, `preview-word-gradient`,
    `preview-word-shake`, `preview-word-stretch`
  (Add the handful of missing keyframes to `style.css` — the 
  `preview-typewriter` / `preview-slide-up` classes already exist.)
- **Step 2 — Grouped sections.** Render three labeled strips inside the card:
  Entrance (None, Fade Up, Pop) → Letters (Letter Pop, Letter Fade,
  Typewriter, Bounce, Rotate) → Words (the 7 word presets). Each strip is
  `grid-cols-4` (5 in horizontal dock) of tiles. Same active/inactive styling
  as `renderPresetGrid`.
- **Step 3 — Contextual Effects strip.** Replace the inline conditional rows
  (whole-caption toggle, highlight color, pop/stretch scale, letter motion)
  with one `border`-divided section that shows:
  - word presets → Whole-caption duration toggle, Highlight color, Pop scale
    (wordPop) / Stretch scale (wordStretch)
  - letter presets → Letter motion (Travel, Pop scale, Rotate)
  - entrance presets → nothing (strip collapses)
  Keep the same `State.subtitleConfig.*` write handlers; only the markup
  changes.
- **Step 4 — Timing group.** Move In/Out/Dur/Easing into a compact
  `grid-cols-3` (In, Out, Dur) + full-width Easing block under a top divider,
  restyled to the panel's small select token.
- **Step 5 — Per-caption card parity.** The per-caption Properties card gets
  the same tile grid + Effects strip, writing per-caption overrides via
  `setSubCaptionAnim`/`setClipEffect` instead of `State.subtitleConfig`
  (reuse the existing `applyCaptionPreset` scope plumbing).
- **Verification:** screenshot the tab in vertical + horizontal docks; assert
  preset switch keeps the panel height stable; check active tile highlight
  tracks `cfg.animPreset`; `node --check` + `npm run build` + live click tests
  on all 15 tiles.

---

## Part B — Bidirectional caption↔text preset sync

### B1. Reverse letter map (caption → text)

Add next to `TEXT_LETTER_TO_PRESET` (L3291):

```js
const PRESET_TO_TEXT_LETTER = {
  typewriter: 'typewriter', letterPop: 'scaleFade', letterFade: 'slideUp',
  bounce: 'randomSnap', rotate: 'odometer'
};
```

Wire it into:
- `convertSubtitleClipToText` / `bakeSubtitleStyleIntoClip` (L16089): when
  baking a caption's `animPreset` onto the text clip, write
  `PRESET_TO_TEXT_LETTER[animPreset]` into `clip.effects.animTextIn` (keep the
  existing forward map for the reverse direction).
- `applyCaptionPreset` (L16601): already sets caption-side values; extend the
  comment/table so a text preset applied to a caption keeps its letter
  identity through both directions (already true via `TEXT_LETTER_TO_PRESET`).

Result: converting a caption using Bounce/Rotate/Letter Pop/Letter Fade into
a text clip yields Snap/Odometer/Scale Fade/Slide Up — the nearest native text
equivalents, rendered identically in spirit.

### B2. Word karaoke presets on text clips (new render branch)

The clip renderer's per-letter loop (L4788) needs a word-preset branch.
Because `drawCaptionWordGlow` already handles a **non-karaoke mode**
(`offs = null` → entrance sweep with its ~0.5s floor, L19572), a text clip can
reuse it as-is:

- **Data:** extend `textInOptions` (L9846) with the 7 word presets as new
  `animTextIn` values (`wordGlow`, `wordColor`, `wordPop`, `wordUnderline`,
  `wordGradient`, `wordShake`, `wordStretch`) — or, cleaner, a separate
  `wordTextInOptions` group rendered as its own "Words" section in the Text
  card's In sub-tab.
- **Render:** in `drawTextClip`, when `animTextIn` is a word preset, skip the
  per-letter loop and call `drawCaptionWordGlow(ctx, line, y, shimEf, shimCfg,
  t, animTextInDur, fontSize, null, mappedPreset)` per wrapped line — with
  `shimEf` carrying the clip's fill/stroke/shadow/bg/word* effect values
  (word presets already read `ef.bgColor`, `highlightColor`, `wordPopScale`,
  `wordStretchScale`, and the pill goes through `drawTextBackground`, which
  works off a clip shim).
- **Timing:** no per-word speech timing exists on a static text clip — the
  sweep uses the clip's `animTextInDur` entrance window (the existing
  non-karaoke path). Note this in the UI tooltip ("sweeps the clip's
  animation duration — word-by-word speech timing is only available on
  captions").
- **Effects strip:** the ANIMATIONS Text card gains the same contextual
  controls (highlight color, pop/stretch scale) when a word preset is active,
  writing `clip.effects.highlightColor` / `wordPopScale` / `wordStretchScale`.

### B3. Shared per-letter engine (optional hardening)

`drawCaptionLetters` (caption) and the clip renderer's `animTextIn` branches
duplicate letter-motion math (travel/scale/rotate). Extract the per-letter
state computation (`letterStateFor(preset, idx, t, dur, ease, opts) → {alpha,
dx, dy, scale, rot}`) into one shared helper used by both renderers. This is
what guarantees "identical animation on both paths" by construction instead of
by map approximation. Do this **after** B1+B2 land (keeps the diff reviewable).

### B4. Round-trip tests

- Caption with `bounce` → convert to text clip → text clip has
  `animTextIn = 'randomSnap'` → renders Snap. Convert back → `bounce`.
- Text clip with `animTextIn = 'wordGlow'` → synced into a caption →
  `drawSubtitlesOnCanvas` renders the word glow (already works via
  `TEXT_LETTER_TO_PRESET` fallback? **no** — `wordGlow` isn't in that table;
  add the 7 word values to `TEXT_LETTER_TO_PRESET` as identity mappings so the
  existing caption fallback covers them: `wordGlow:'wordHighlight'`, etc.).
- ANIMATIONS Text tab on a synced caption clip: set a word preset →
  caption overlay renders it (via `subtitleEffectMap` + the caption fallback).

### B5. UI surfacing

- ANIMATIONS Text card In sub-tab: add the **Words** tile section (B2).
- Caption Animation tab: tiles now visually match the ANIMATIONS tiles
  (Part A), so a user sees the same preset family in both places and can
  apply it to either a caption or a text clip with one tap.

---

## Implementation order

1. **Part A steps 1–3** (tiles + grouping + contextual strip) — pure UI on
   `renderSubtitlesPanel`; no renderer changes; biggest visible win.
2. **B1** reverse map + conversion wiring (~20 lines + tests).
3. **B2** word-preset branch in `drawTextClip` + `wordTextInOptions` group in
   the ANIMATIONS Text card.
4. **B4** identity entries for the 7 word values in `TEXT_LETTER_TO_PRESET`
   so caption fallback covers text-set word presets.
5. **B3** shared per-letter engine refactor (optional, after 1–4 verified).
6. Full verification pass: `node --check`, `npm run build`, live tile clicks
   on both panels, caption→text→caption round trip, export path smoke test.

## Risks / notes

- **Word presets on text clips lack speech timing** — they sweep the clip's
  animation duration. This is the correct semantic (no transcription data),
  and the tooltip should say so.
- **Tile preview CSS** — add the missing `preview-word-*` and
  `preview-bounce`/`preview-rotate` keyframes in `style.css`; keep them
  cheap (transform/opacity only) since tiles run in the panel, not the canvas.
- **Panel height stability** (Part A) — the contextual strip should reserve a
  fixed min-height per preset family so switching presets doesn't reflow the
  grid (CapCut keeps tiles rock-steady).
- **Per-caption card parity** — Part A step 5 doubles the markup; factor the
  tile + strip builders into helpers shared by the global tab and the
  per-caption card (same pattern as `captionStyleControlHtml`).
