# Properties Panel — Option B: Flat Section Headers (CapCut-style)

**Status:** planned · not implemented · supersedes the Option A density pass as the next
round of tightening (A already landed: Basic tab 1,383 → 1,151 px).

**Goal:** strip the boxed card chrome (border + shadow + header band) so the panel reads as
one continuous CapCut-style property sheet, while keeping every section a collapsible
`<details>/<summary>` accordion that works identically in both docks.

**Target (est.):** Basic tab (text clip) 1,151 → ~900 px (≈ −35 %) in the 698 px viewport.

---

## 1. What stays the same (do NOT touch)

- **Accordion structure** — cards remain `<details id="cardX"> <summary> … </summary> <body>`.
  Collapse/expand, `State.ui.detailsState` save/restore, and the horizontal-dock force-open
  fix (`a2edeca`: `if (isHorizontal) { d.setAttribute('open', ''); return; }`) are all
  untouched — they operate on the element, not its classes.
- **Dock logic** — all `isHorizontal` branches, `w-[280px]` horizontal cards, the
  `propertiesCardContainer` (already `p-3 gap-3`), `scrollToPropertyCard` centering, and the
  jump-chips row (`3362e5c`, `propJumpChips`) keep working unchanged.
- **Group/sub-tab system** — Basic/Adjust/Effects/Media chips, `groupCardsHtml`,
  `PROP_GROUP_OF`, the 1/2/3/4 shortcuts, migration map — untouched.
- **DOM shape of rows** — the label/value/slider structure inside `propRow`/`propSlider`
  must not change: every `oninput` uses `this.previousElementSibling.querySelector('span')`
  chains. Only *classes* may change (see risks §4).

## 2. Exact class deltas (current → Option B)

### 2.1 Shared builders (`updateSidebarPanel`, ~line 8146)

**`propCard`** — `details`:

```
CURRENT:
<details id="…" class="group relative bg-white dark:bg-surface-800 border border-surface-300
  dark:border-surface-700 shadow-sm rounded-lg shrink-0 … overflow-hidden flex flex-col" …>

OPTION B:
<details id="…" class="group relative shrink-0 … overflow-hidden flex flex-col" …>
  (drop: bg-white dark:bg-surface-800, border …, shadow-sm, rounded-lg)
```

**`propCard`** — `summary` (becomes a slim divider row):

```
CURRENT:
<summary class="flex items-center justify-between px-3 py-2 ${isHorizontal ? '' : 'cursor-pointer'}
  list-none appearance-none select-none bg-surface-100 dark:bg-surface-800/80
  border-b border-surface-200 dark:border-surface-700" onclick="…">

OPTION B:
<summary class="flex items-center justify-between px-1 py-1.5 ${isHorizontal ? '' : 'cursor-pointer'}
  list-none appearance-none select-none" onclick="…">
  (drop: bg-surface-100 dark:bg-surface-800/80, border-b …)
```

Title inside the summary: `text-sm font-bold … gap-2` → `text-[10px] font-bold uppercase
tracking-widest text-surface-400 dark:text-surface-500 … gap-1.5`, icon `w-4 h-4` → `w-3 h-3`.
Chevron stays (still the collapse affordance in vertical dock).

**`propCard`** — `rightSlot` overlay (a11y Phase-3 pinned to the header band):

```
CURRENT:  <div class="absolute ${isHorizontal ? 'right-2.5' : 'right-10'} top-0 h-9 flex items-center z-10">
OPTION B: <div class="absolute ${isHorizontal ? 'right-2.5' : 'right-10'} top-0 h-7 flex items-center z-10">
  (h-9 = 36 px matched the px-3 py-2 header; py-1.5 header is ~28 px → h-7)
```

**`propCard`** — body:

```
CURRENT: <div class="px-3 py-2 flex flex-col gap-2 bg-surface-50 dark:bg-surface-900/50 flex-1 …">
OPTION B: <div class="px-1 pb-2 flex flex-col gap-1.5 bg-surface-50 dark:bg-surface-900/50 flex-1 …">
  (keep the subtle body tint so sections still read as grouped; top padding from the divider)
```

**`propRow`** — value chip → inline text (CapCut style, no chip box):

```
CURRENT: <span class="text-xs font-bold … bg-surface-100 dark:bg-surface-800 border border-surface-200
  dark:border-surface-700 px-1.5 py-px rounded">VALUE</span>
OPTION B: <span class="text-[10px] font-bold text-surface-700 dark:text-surface-200">VALUE</span>
  (label row keeps mb-1; keep the reset arrow as-is)
```

**`colorRow`** — same de-boxing for the swatch row: drop `border … rounded p-1 cursor-pointer
shadow-inner` → plain flex row, swatch `w-6 h-6` → `w-5 h-5`, hex text `text-xs` → `text-[10px]`.
Keep the invisible full-size picker input.

### 2.2 Hand-rolled cards (same chrome, same treatment)

All 14 hand-rolled summaries matching
`px-3 py-2 ${isHorizontal ? '' : 'cursor-pointer'} list-none appearance-none select-none
bg-surface-100 dark:bg-surface-800/80 border-b border-surface-200 dark:border-surface-700`
and their bodies `px-3 py-2 flex flex-col gap-2 bg-surface-50 dark:bg-surface-900/50 flex-1`
(Shape, Text Content, Typography, Sizing & Spacing, Background, Letter Styles, Source, Scene,
PC/Google Fonts, Speed, Extrude, Texture, SFX, Mask, …) get the §2.1 deltas. Inner label
margins `mb-1` → `mb-0.5` optional. Math-template / toggle rows keep their inner boxes
(they're content, not card chrome).

> Tip: implement the shared builders first, verify one migrated card (Stroke/Shadow), then
> sweep the hand-rolled summaries with the same class strings (the §2.1 patterns are
> copy-paste identical).

## 3. Collapse-by-default (optional follow-up)

Start only the primary card open per group (Transform / Color / Mask / Source), the rest
collapsed — respects `detailsState` when a saved value exists. Halves the initial paint
scroll; the jump chips make opening anything one click away. Keep the horizontal force-open.

## 4. Risks

1. **`previousElementSibling` selectors** — the value chip becomes inline text but must stay
   the *same DOM sibling* of the slider; only classes change, never element order.
2. **`rightSlot` alignment** — the header switches/Reset buttons must re-pin to the slimmer
   header (`h-9` → `h-7`); verify in both docks (screenshot).
3. **Horizontal cards** — at 280 px wide the divider headers are fine, but confirm body
   `px-1` doesn't crowd the sliders; keep `w-[280px]`.
4. **Touch targets** — labels/chips get smaller; keep the summary row ≥ 24 px tall and the
   jump chips ≥ 20 px (the plan's floor).
5. **`gap-1.5` body** — slider rows are already dense post-Option-A; don't go below `gap-1.5`
   or rows blur together.

## 5. Test plan

1. Vertical dock: every group renders; Basic = Transform, Opacity & Blending, Text Content,
   Typography, Sizing & Spacing with divider headers; measure `#propertiesCardContainer`
   scrollHeight (target ≤ ~950 px).
2. Accordions: click to collapse/expand; collapse in vertical → horizontal still force-opens
   (`a2edeca` regression); saved `detailsState` respected on re-render.
3. `rightSlot` toggles (Stroke/Shadow/Extrude enable switches) sit flush top-right, clickable
   in both docks.
4. Jump chips (`propJumpChips`) scroll + open cards; mini-rail in horizontal dock.
5. Slider drags still update value text (`previousElementSibling` chains intact).
6. `vite build` ✓, console clean, light + dark themes.
