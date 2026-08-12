# Captions & Markdown — Horizontal-Dock Responsive Plan

**Status:** Plan (not implemented)
**Area:** `renderSubtitlesPanel` (~L16301) and `renderMarkdownPanel` (~L17319) in `index.html`
**Date:** Aug 2026

---

## 1. The problem

When the Properties inspector is docked **top or bottom** (horizontal mode), the
**Captions** and **Markdown** tabs do not adapt — they keep rendering as tall
vertical columns inside a wide, short horizontal strip:

- The caption list / style cards / markdown textarea / sound rows stack vertically,
  wasting the horizontal space and crushing content into a cramped column.
- Cards with `w-full` become unusable (e.g. style sections squeezed into ~256px of
  height while the rest of the strip is empty).
- Switching sub-tabs re-renders the panel and the layout never recovers.

Measured live (dock = `top`, both panels):

| Panel | `sidebarContent` classes | Dock-aware? |
|---|---|---|
| Captions | `flex flex-col w-full …` (always) | ✗ (has a partial `isHoriz` used only for 2 inner grids) |
| Markdown | `flex flex-col w-full …` (always) | ✗ (no dock awareness at all) |
| Properties / Audio / Animations / Presets | `flex-row`/`flex-col` chosen at render | ✓ |

## 2. Root cause

The inspector dock toggle (`btnDockInspector` → `applyInspectorLayout`) adds
`flex-row flex-nowrap overflow-x-auto` to `sidebarContent` for top/bottom docks.
But:

1. **The panels overwrite the class list.** Every render sets
   `sidebarContent.className = 'flex flex-col …'`, so the direction is hardcoded
   to column regardless of dock.
2. **Even when both classes end up on the element** (dock adds `flex-row` after
   the render sets `flex-col`), Tailwind emits `.flex-col` *after* `.flex-row` in
   the compiled CSS, so **column wins** — the panel stays vertical in a horizontal
   dock.

The four dock-aware panels (Properties L10904, Audio L10607, Animations L10290,
Presets) each compute
`const isHorizontal = State.inspector.dock === 'bottom' || State.inspector.dock === 'top'`
and set their own direction — only *one* of `flex-row`/`flex-col` is ever present,
so there's no conflict.

**Related latent bug found while auditing:** `renderCustomKeyframeEditor` (L11299)
reads `State.inspector.isHorizontal` — but that property is **never set anywhere**,
so the keyframe editor never knows about the horizontal dock.

## 3. Design approach (CapCut-style, consistent with the app)

Same contract as the four dock-aware panels, so all six tabs behave identically:

- **Vertical dock (left/right):** unchanged — tall column, cards `w-full`.
- **Horizontal dock (top/bottom):** the panel becomes a row:
  - Compact sub-tab chips stay on top (a slim, full-width strip).
  - Content flows as **fixed-width cards that scroll horizontally** (like
    Properties' `w-[280px]` cards) *or* as a **responsive multi-column grid**
    (`grid-cols-2` / `grid-cols-3`) that fills the wide strip — pick per sub-tab
    based on content shape (lists & editors scroll; forms & chips grid).
  - Everything still scrolls vertically within each card when the strip is short.

**Markdown — Content sub-tab (CapCut split):** scripts & actions in a narrow left
column, the markdown textarea filling the rest — a true two-pane editor.

## 4. Implementation phases

### Phase 1 — Dock-aware containers (the core fix)

In both render functions:

1. Add `const isHorizontal = State.inspector.dock === 'bottom' || State.inspector.dock === 'top';`
   at the top (mirrors Audio L10607).
2. Set `sidebarContent.className` with the direction:
   `flex ${isHorizontal ? 'flex-row items-stretch gap-3 p-3 w-full flex-1 min-h-0 overflow-hidden' : 'flex-col w-full flex-1 min-h-0 bg-surface-50 dark:bg-surface-900'}`.
3. The inner wrapper (currently `flex flex-col w-full flex-1 min-h-0`) becomes
   `flex flex-col w-full flex-1 min-h-0 overflow-hidden` in horizontal mode so the
   sub-tab bar stays a full-width strip and the content area flexes.

**Fix the latent keyframe-editor bug:** replace `State.inspector.isHorizontal`
(L11299) with the same `dock === 'bottom' || dock === 'top'` check (or set the
flag in `applyInspectorLayout`).

### Phase 2 — Per-sub-tab horizontal layouts

**Captions (`renderSubtitlesPanel`):**
- `captionsHtml` — in horizontal mode the list becomes a **fixed-width
  `w-[320px]` card column that scrolls vertically**, while the Generate card /
  Auto-Fix card flow beside it (CapCut caption panel: list left, controls right).
  Simplest robust version: keep the existing single-column content but switch the
  container to `grid grid-cols-2` when `isHorizontal`, with the list card spanning
  one column.
- `styleHtml` — already uses `isHoriz ? 'grid grid-cols-2 gap-3' : 'flex flex-col'`
  — extend to `grid-cols-2`/`grid-cols-3` when the strip is wide enough (or keep
  2 and let the grid fill). Make it read from the new shared `isHorizontal`.
- Replace the hand-rolled `isHoriz` const with the shared one.

**Markdown (`renderMarkdownPanel`):**
- `contentHtml` — horizontal mode = **split**: left column `w-[220px] shrink-0`
  (Scripts strip, Generate/Clear buttons, missing-sounds hint) + right flex-1
  (the textarea). Vertical mode stays as today.
- `styleHtml` — **Properties-style horizontal strip** (decided after the grid pass): fixed-width `w-[280px]` cards in a `flex-row overflow-x-auto no-scrollbar` strip, exactly like `propertiesCardContainer`. Each `<details>` card gets `w-[280px]` in horizontal mode, `w-full` in vertical. Verified: Captions Style = 5 × 280px cards; Markdown Style = 6 × 280px outer cards (Heading/Text effect sections nest inside).
- `mediaHtml` — sound rows become `grid grid-cols-2` in horizontal mode (rows are
  already compact and horizontal-friendly).

### Phase 3 — Clean design pass (optional but recommended)

- Migrate the hand-rolled sub-tab bars (Captions/Style, Content/Style/Media) to the
  shared `subTabBar()` builder — same segmented control as Properties/Animations
  (like Animations Part A did), deleting the per-panel `activeBtnClass`/
  `inactiveBtnClass` duplicates.
- Normalize card token: the panels still use `rounded-lg shadow-sm border` details
  — align to the app's `rounded-lg border` token used elsewhere.
- Ensure both docks re-render cleanly on toggle (already the case — the dock button
  calls `updateSidebarPanel()` before `applyInspectorLayout()`; Phase 1 makes the
  panels self-manage their direction so the two never fight).

## 5. Verification

1. `npm run build` passes.
2. Live: dock top/bottom → **Captions** tab → check Captions & Style sub-tabs lay
   out horizontally (list + controls side by side / 2-col grid), then dock
   right/left → back to the tall column, no layout shift artifacts.
3. Same cycle for **Markdown** (Content split-pane, Style grid, Media grid).
4. Toggle sub-tabs in each dock — layout stays correct after re-renders
   (`sidebarContent` keeps the right direction class).
5. Both themes (light + vscode-dark); console clean; no `flex-col`+`flex-row`
   conflict left on `sidebarContent` in horizontal dock.
6. Keyframe editor (Custom tab, Animations) still lays out fine in both docks after
   the `State.inspector.isHorizontal` fix.

## 6. Acceptance criteria

- [ ] In horizontal dock, `sidebarContent` carries exactly one direction class
      (`flex-row` or `flex-col`, never both)
- [ ] Captions: Captions + Style sub-tabs usable in horizontal dock (no crushed
      column; list/editor or grid fills the strip)
- [ ] Markdown: Content = split editor; Style + Media = responsive grids
- [ ] Vertical dock: pixel-identical to today (no regressions)
- [ ] `vite build` passes; console clean; both themes verified
- [ ] Keyframe editor uses the dock check (not the never-set flag)

## 7. Out of scope

- The dock/timeline resizing logic itself.
- Rewriting the caption generation / markdown parsing logic.
- The Audio Library, Presets, Properties, Animations panels (already dock-aware).
