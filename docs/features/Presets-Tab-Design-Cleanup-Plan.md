# Presets Tab: Design Cleanup Plan

A design pass over the **Presets** sidebar panel to bring it in line with the app's
already-cleaned panels (Audio Library, Properties, export modal) and CapCut's
preset browser: one accent, quiet hovers, compact cards, and a single obvious
action per card.

## Current pain points (measured/verified live)

- **Header is decorated, not clean.** The panel header uses an icon tile
  (`w-8 h-8 rounded-lg` + brand tint + `shadow-sm` + border) next to an
  `font-extrabold` title and an "N templates" subtitle — while the rest of the
  app (e.g. Audio Library after Phase B) uses a plain `text-sm font-bold` heading.
  The tile + shadow reads as chrome, not hierarchy.
- **Filter bar speaks a different design language.** `material-segmented` uses
  `flex: 1` buttons at 11px with an **indigo tint** active state
  (`rgba(129,140,248,.16)` bg / `#a5b4fc` text). Every other panel uses the
  app's chip token: `h-6 px-2.5 rounded-full text-[10px] font-bold`, active =
  solid `surface-900`/`white`, inactive = `surface-100`/`surface-800`. Six
  `flex:1` segments also cramp on a narrow sidebar.
- **Cards are bigger and rounder than the app's tokens.** Grid cells are
  `minmax(118px,1fr)` at 14px radius (measured: 126px cells, 14px radius);
  the app's cards use `rounded-lg` (8px) and tighter gaps (8–10px).
- **Category tag on every thumbnail** (`preset-card-cat`: blurred dark pill,
  8px uppercase) adds noise — the filter bar already tells you the category.
- **Heavy hover overlay: 4 circular buttons on a dark blur.** Verified 84
  overlay buttons for 21 cards. CapCut shows at most one affordance on hover
  (an add button); secondary actions live in a right-click menu.
- **Empty state** has no primary action (dashed box + text only) — the Audio
  Library plan's Part D established the pattern of a primary button inside it.

## Design principles (match the app + CapCut)

1. **One accent, one interaction.** Brand purple = active filter + primary card
   action only. Hover = quiet surface tint, never full-color overlays.
2. **Same tokens as the rest of the app.** Chips `h-6 px-2.5 rounded-full
   text-[10px] font-bold`; cards `rounded-lg` + `border-surface-200
   dark:border-surface-700`; headings `text-sm font-bold`.
3. **Fewer affordances, more clarity.** Click a card = add. Right-click = the
   extended menu (apply/export/delete), same pattern as the Audio Library rows.
4. **Compact grid.** CapCut preset grids are dense: ~96–110px cells, 8–10px
   gaps, so more presets are visible without scrolling.

## Part A — Header

- Drop the icon tile + subtitle; use the panel header pattern from the other
  tabs: `<h3 class="text-sm font-bold text-surface-900 dark:text-white">Presets</h3>`
  with the storage actions right-aligned.
- Keep the count but make it a quiet one-liner under the title
  (`text-[10px] text-surface-500 dark:text-surface-400`) or drop it entirely
  (the filter chips already imply scope).
- Storage buttons (Import/Export/Restore): unify to the app's icon-button
  token `h-7 w-7` squares (currently `material-icon-btn` 30px circles) with
  `p-1.5` hover pills. Tooltips stay.
- Remove `shadow-sm`/`border` from any remaining icon chrome.

## Part B — Filter chips (replace `material-segmented`)

- Replace the segmented control with the app's chip row:
  `flex items-center gap-1.5 flex-wrap shrink-0`, chips `h-6 px-2.5
  rounded-full text-[10px] font-bold`.
- Active = `bg-surface-900 dark:bg-white text-white dark:text-surface-900`
  (solid, like the Audio Library chips); inactive = `bg-surface-100
  dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-200
  dark:hover:bg-surface-700`.
- Drop `flex:1` so chips size to content and wrap; keep the small icons
  (`w-3 h-3`), which distinguishes this from the audio chips without noise.
- Delete the `.material-segmented` CSS block once the markup no longer uses it
  (or leave it if other panels still reference it — check first).

## Part C — Cards

- **Grid:** `repeat(auto-fill, minmax(96px, 1fr))` with `gap: 8px` (from
  118px/12px) — measured cells drop ~126px → ~100px, roughly 25% more presets
  per viewport.
- **Radius:** `14px` → `rounded-lg` (8px) to match card tokens.
- **Hover:** remove `translateY(-2px)` + indigo border + big shadow. Quiet
  hover: border to `surface-300`/`surface-700` + a faint surface tint; keep a
  tiny lift (`translateY(-1px)`) or drop it. `active:scale-[0.98]` stays.
- **Category tag:** remove `.preset-card-cat` from the thumbnail (filter chips
  communicate category). Simplifies the DOM and removes the blur pill.
- **Hover overlay → single action.** Replace the 4-button dark-blur overlay
  with:
  - A single **+** button pinned to the card's top-right corner on hover
    (small `w-6 h-6 rounded-full bg-white/90 dark:bg-surface-800/90` pill with a
    subtle shadow) — "Add to timeline" is the primary action.
  - The **check** (apply to selected), **download** (export), and **trash**
    (delete) move into a right-click context menu on the card, reusing the
    app's existing context-menu pattern (`audioLibContextMenu`-style fixed
    menu). Card right-click = `oncontextmenu="showPresetMenu(id, x, y)"`.
  - Optional: double-click a card = apply style to the selected clip when
    compatible (CapCut's apply gesture) — nice-to-have, not required.
- **Name:** keep centered 10.5px `font-semibold` ellipsis; nudge to `text-[10px]`
  for the denser grid. Two-line names still ellipsize.
- **Thumbnail:** keep 4:3 + `object-fit: cover`; keep the clip-theme fallback
  colors from the previous cleanup (no gradients).

## Part D — Empty state

- Keep the dashed box + icon + copy, but add a **primary "Save Preset" button**
  inside (the heart in the top action header already triggers the flow — this
  gives the empty state one obvious action), matching the Audio Library plan's
  Part D pattern.

## Part E — Optional (later)

- **Right-click context menu** could later gain "Duplicate" and "Move to
  category" once preset management grows.
- **Search field** above the grid for large preset libraries (CapCut has
  search) — defer until presets exceed ~50 items.

## Implementation notes

- Markup lives in `renderPresetsLibrary()` (`window.renderPresetsLibrary`, the
  single `html` template) in `index.html`; card styles live in
  `src/styles/style.css` (`.preset-card*`, `.material-segmented`,
  `.material-icon-btn`).
- Check whether `.material-segmented` / `.material-icon-btn` are used by other
  panels before removing the CSS — if shared, keep the classes and only stop
  using them here.
- New `showPresetMenu(id, x, y)` reuses the existing context-menu element
  pattern (`audioLibMenuEl`/`clampAudioLibMenu`/`attachAudioLibMenuClose`
  equivalents) or a dedicated `#presetContextMenu`.
- Verify with `npm run build`, then the live checklist: chips wrap on narrow
  sidebar, cards reflow at ~100px, hover shows only the + button, right-click
  menu shows apply/export/delete, add-to-timeline still works, both docks
  (vertical/horizontal) render clean.

## Out of scope

- Preset behavior/save/export logic (unchanged).
- The top action-header heart (already the Save-Preset entry point).
- The Properties panel's preset-affiliated cards.
