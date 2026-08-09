# Captions Style UI Cleanup Plan

Status: **Plan only — no implementation yet.** This document audits the current
Captions config & Style UI, defines a cleaner target design for both dock
orientations (vertical properties dock on the right/left, horizontal dock at the
bottom/top), and lays out the implementation steps.

---

## 1. Current state — why it feels cluttered

The Captions sidebar tab (`renderSubtitlesPanel`, `index.html` ~14727) has two
sub-tabs: **Captions** (import/list/overlap-fix) and **Style**. The Style tab
(`styleHtml`, ~14731–14841) is the problem:

### 1.1 One giant card, no section boundaries
Everything below the Quick Styles strip lives inside a **single** card with one
continuous vertical flow (~40 controls):

```
Info banner (amber)                       ← verbose, 3 lines
Quick Styles strip (14 preset tiles)      ← separate floating card
"Clear per-caption overrides" row         ← separate floating card
┌─ ONE CARD ────────────────────────────┐
│ Font + Size (2-col)                   │
│ Weight                                │
│ Color  (full-width block)             │
│ Scale  (label + slider row)           │
│ Stroke (toggle row)                   │
│ Shadow (toggle row)                   │
│ Background (toggle row)               │
│ Animation: In/Out/Dur (3 selects)     │
│  + Preset Animation (9 buttons)       │
│  + Whole-duration toggle             │
│  + Easing select                      │
│ Position + Offset (2-col)             │
└───────────────────────────────────────┘
```

There are no `details` accordions inside, so a user can't collapse anything and
can't scan to a section. Contrast with the **Markdown tab**, which already has
the clean pattern we want: one `details` card per section (Layout / Heading
Style / Text Style) and a **Style ⇄ Effects** sub-tab inside each card
(~15890–16030).

### 1.2 Inconsistent control rows in the shared builder
`captionStyleControlHtml` (`index.html` ~14567) renders 5 different row shapes
for related controls:

| Group | Row shape |
|---|---|
| `scale` | icon + label, then slider + value badge |
| `color` | stacked label + full-width color box |
| `stroke` / `shadow` / `bg` | checkbox toggle + inline color box + slider + badge |

Same visual family (fill effects), three different layouts. In the per-caption
card (`cardCaption`, ~8560) the same builder is reused, so the inconsistency
doubles.

### 1.3 The Animation block is a wall of tiny controls
In/Out selects + duration + 9 preset buttons (4-col) + full-span toggle +
easing = ~15 controls stacked with no grouping. This is the densest part of the
tab and the biggest source of "cluttered".

### 1.4 Missing UI for settings that already exist
`subtitleConfig` has `bgStrokeEnable`, `bgShadowEnable`, `bgExtrudeEnable`,
`textureEnable` and friends (~1110–1154) that have **no controls anywhere**.
They only surface through presets. A cleanup should surface them in an
"Advanced" accordion so global config is complete.

### 1.5 Horizontal dock is ignored
The per-caption card already adapts via `isHorizontal` (`State.inspector.dock`
bottom/top → card width `280px`, ~7933), but the **Style tab** always renders
one vertical column regardless of dock. In the horizontal dock the panel is
wide and the current design wastes it; in the vertical dock it's narrow and the
flat 40-control wall scrolls forever.

---

## 2. Design goals

1. **Mirror the Markdown panel** — one `details` accordion per section, a
   Style ⇄ Effects sub-tab inside the main Typography section, compact
   `text-[9px]` labels, 2-col grids.
2. **One row layout everywhere** — the shared `captionStyleControlHtml`
   builder emits a single consistent row shape (label + control + value), so
   the global tab and the per-caption card look identical.
3. **Collapsible by default** — "Animation" and "Advanced" start closed; the
   most-used controls (Typography, Fill, Position) stay open.
4. **Dock-aware layout** — the same HTML adapts: vertical dock = full-width
   stacked cards; horizontal dock = 2-column grid of compact cards.
5. **Less text** — replace the 3-line amber banner with a one-line hint (or a
   `title` tooltip), keep the "Clear overrides" action inside the section it
   belongs to.

---

## 3. Target information architecture (Style tab)

```
Captions ⇄ Style          ← existing sub-tab bar (keep)
┌─ Quick Styles (horizontal strip) ────────────────┐  keep as its own slim card,
│ 14 preset tiles                                   │  header: "Quick Styles · tap to apply"
└───────────────────────────────────────────────────┘
┌─ Typography  (details, open) ────────────────────┐
│  Style ⇄ Effects sub-tab (segmented, like markdown) │
│  Style:                                          │
│    Font | Weight      (2-col)                    │
│    Size  | Scale      (2-col, slider+value)      │
│    Color | (letter animation presets if Effects) │
│  Effects:                                        │
│    Stroke toggle + color + width                 │
│    Shadow toggle + color + blur                  │
│    Background toggle + color + opacity           │
└──────────────────────────────────────────────────┘
┌─ Animation  (details, closed) ───────────────────┐
│  Preset animation chips (9, 3-col in vertical,   │
│    5-col in horizontal)                          │
│  In / Out / Duration / Easing (2×2 grid)         │
│  Whole-duration (karaoke) toggle                 │
└──────────────────────────────────────────────────┘
┌─ Position  (details, open) ──────────────────────┐
│  Position (Bottom/Top) | Offset slider (2-col)   │
└──────────────────────────────────────────────────┘
┌─ Advanced  (details, closed) ────────────────────┐
│  Background box: stroke / shadow / extrude       │
│  Texture: enable + opacity + blend mode          │
│  Reset all per-caption overrides (footer action) │
└──────────────────────────────────────────────────┘
```

Rationale:
- **Typography** is what people edit 90% of the time → first, open.
- **Animation** is dense → collapsed until needed (mirrors the markdown
  Effects sub-tab philosophy).
- **Advanced** holds the never-exposed-but-supported settings; also the natural
  home for the "Reset overrides" action so it stops floating alone.
- The amber banner becomes a one-line hint inside the Quick Styles header
  (`title` tooltip on a small info icon), removing ~3 lines of vertical noise.

---

## 4. Dock-aware layout

Reuse the existing `isHorizontal` check (`State.inspector.dock === 'bottom' ||
'top'`, `index.html` ~7933) in `renderSubtitlesPanel`.

### 4.1 Vertical dock (right/left — current, narrow)
- Keep the current single-column `flex flex-col gap-3 p-3` scroll.
- Cards are full-width; inner controls use 2-col grids (as today).
- Accordions collapsed by default except Typography + Position.

### 4.2 Horizontal dock (bottom/top — wide)
- The panel is wide and short: render the section cards in a **2-column
  responsive grid** (`grid grid-cols-2 gap-3`), cards `min-w-0`.
- Inside each card, controls switch from 2-col to **4-col grids** for compact
  rows (Font | Weight | Size | Scale), and preset chips go 5-col.
- The Quick Styles strip and the caption list can share the row in this mode
  (strip on the left, list on the right) — the wide panel finally gets used.

### 4.3 Per-caption card (`cardCaption`, properties)
- Same shared builder ⇒ same row shape for free.
- In horizontal dock it already caps at `280px`; the plan keeps that but makes
  the inner grids collapse to 2-col compact (already true via the shared
  builder's small row height).

---

## 5. Shared builder unification (`captionStyleControlHtml`)

Emit **one row shape** for all five groups (scale / color / stroke / shadow /
bg):

```
┌──────────────────────────────────────────────┐
│ [toggle?] Label      [color] [slider] [value]│
└──────────────────────────────────────────────┘
```

- `color` becomes an inline row (label + color box + nothing else), matching
  stroke/shadow/bg — not a full-width block.
- `scale` keeps label + slider + `%` badge but uses the same row container.
- The row component is a single small helper (`styleRow(label, control, opts)`)
  so future groups (texture, extrude) reuse it without new markup.
- Row density drops enough that the whole Fill section fits in one open card
  without scrolling in the vertical dock.

---

## 6. Implementation steps

### Phase 1 — Structure (no behavior change)
1. Split the single Style card into the four `details` sections
   (Typography / Animation / Position / Advanced) using the existing markdown
   card markup as the template.
2. Add the **Style ⇄ Effects** segmented sub-tab to the Typography card
   (backed by new `State.subtitleFxTab` = `'style' | 'effects'`, persisted in
   `studiopro_subtitleConfig`).
3. Move the "Clear per-caption overrides" row into the Advanced section footer.
4. Replace the amber banner with a one-line hint + `title` tooltip.

### Phase 2 — Builder unification
5. Rewrite `captionStyleControlHtml` to the single `styleRow` shape for all
   five groups (keep `put`/`putToggle` wiring identical — data model and
   handlers unchanged).
6. Verify the global tab and `cardCaption` render the same rows; no logic
   changes to `subtitleConfig`, `sub.effects`, or `setClipEffect`.

### Phase 3 — Dock-aware layout
7. Compute `isHorizontal` in `renderSubtitlesPanel`; apply 2-col card grid +
   wider inner grids in horizontal dock, single column otherwise.
8. Re-check `cardCaption` at `280px` in horizontal dock; tighten inner grids
   if the shared rows overflow.

### Phase 4 — Advanced controls (optional follow-up)
9. Surface `bgStrokeEnable` / `bgShadowEnable` / `bgExtrudeEnable` /
   `textureEnable` toggles + their values inside Advanced using the shared
   `styleRow` builder (keys already exist in `subtitleConfig`; no data change).

### Validation
- Syntax check (`node --check` on the inline scripts) + `vite build`.
- Live: vertical dock — Style tab sections collapse/expand, sub-tab switches,
  global changes still re-render captions on canvas.
- Live: toggle inspector to bottom dock — cards reflow to 2 columns, nothing
  overflows, per-caption card still fine at `280px`.
- Regression: apply a caption preset → global and per-caption overrides behave
  exactly as before (only markup changed).

---

## 7. Non-goals / invariants

- **No data-model changes**: `subtitleConfig`, `sub.effects`,
  `SUBTITLE_EFFECT_KEYS`, `setClipEffect`, and the sync/bake mirror logic stay
  untouched.
- **No handler rewrites**: every `onchange`/`oninput`/`onclick` string is
  carried over verbatim; only container markup changes.
- **Captions sub-tab (list / generate / overlap-fix) is out of scope** — it's
  already organized; only the Style sub-tab is being restructured.
- The horizontal-dock Captions list/strip sharing (4.2) is a stretch goal —
  ship the Style-tab reflow first.

---

## 8. Open questions

1. Should the Effects sub-tab include the **letter-preset chips** (Letter Pop /
   Word Glow / Typewriter) or should they live only in the Animation section?
   (Recommendation: Animation — they're timing, not style.)
2. For Advanced's texture controls: show texture **picking** now (add file
   input) or only enable/opacity/blend for presets that already set a texture?
   (Recommendation: ship toggles first, texture picker as a follow-up.)
3. Keep the per-caption card's Position as bottom/top only, or add the 8-point
   positions the markdown panel supports? (Recommendation: keep bottom/top —
   captions are meant to be bottom-anchored; changing this is a behavior
   change, not UI.)
