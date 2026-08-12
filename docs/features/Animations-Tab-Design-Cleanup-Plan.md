# Animations Tab: Design Cleanup Plan

A design pass over the **Animations** sidebar panel to bring it in line with the
app's already-cleaned panels (Properties, Audio Library, Presets, Captions):
one accent, the shared `subTabBar()` segmented control, flat presets (no
gradients, no dark pills), readable type, and the app's card tokens.

## Current pain points (measured/verified live)

- **Three different "segmented bar" styles in one panel.** The main tabs
  (Transform / Text / Custom) are hand-rolled at **9px** with a white-card
  active + shadow + `ring-brand-500/20`; the In/Out/Loop sub-tab switcher is a
  second hand-rolled bar (11px, `rounded-xl`, same white-card + ring); and
  Properties already has a shared `subTabBar()` builder that does the same job
  with a single consistent style. Animations predates the builder and never
  migrated.
- **Heavy preset cells.** Grid cells are `minmax(74px, 1fr)` at 8px gap
  (measured 78×64px) with a **38px gradient purple preview box**
  (`bg-gradient-to-br from-brand-400 to-brand-600`), and the active state adds
  a **gradient background + `ring-2` + shadow** — the loudest active state in
  the app. The Presets cleanup already standardized on flat colors.
- **Dark pill labels on every cell.** Each preset shows its name in an
  **8px uppercase dark pill** (`bg-surface-900/85`, brand pill when active).
  This is the exact "dark pill" pattern that was already removed from the
  timeline badges and preset cards in favor of clean plain text.
- **Tiny type everywhere.** 9px tab labels, 8px cell labels, 8px easing labels.
  The app's minimum readable token is 10px (`text-[10px] font-bold`).
- **No panel header.** Animations opens straight into the tab bar. That matches
  the Properties panel (no header either), so this is optional — but the tab
  bar should sit in the same padded rail Properties uses.
- **In/Out/Loop bar duplicated.** The same sub-tab switcher renders inside both
  the Transform and Text cards — two identical-looking segmented bars stacked
  when a text clip is active. On a text clip the panel shows: main tabs, then
  Transform card (switcher), then Text card (another switcher).
- **Mixed card tokens.** Transform/Text cards and the keyframe editor use the
  old `rounded-xl p-3 shadow-sm` card; Properties cards are now
  `rounded-lg border-surface-200 dark:border-surface-700` (no big shadow).
- **Keyframe editor header** mixes an icon + title with a small text "Save
  Preset" button; the app's Save-Preset affordance is the heart in the top
  action header (this one is fine to keep as a secondary, just align its size).

## Design principles (match the app + CapCut)

1. **One segmented control, shared.** Reuse `window.subTabBar()` for the main
   tabs and the In/Out/Loop switcher exactly as Properties does — same track,
   same active/inactive classes, same icon colors. Delete the hand-rolled
   `activeMainTabClass` / `inactiveMainTabClass` / `activeSubTabClass` /
   `inactiveSubTabClass` strings and `animTabsHtml` / `subTabSwitcher`.
2. **Flat presets, one accent.** Brand = active cell only. No gradient
   previews, no gradient active backgrounds, no dark pills, no `ring-2`.
   Preview boxes become flat neutral/brand surfaces that still run the
   existing hover animation classes (the animation preview is the whole point
   of the panel — keep it, restyle the box).
3. **Readable type.** Minimum 10px for tabs and labels; cell names in plain
   centered text, not pills.
4. **Same cards as Properties.** `rounded-lg border-surface-200
   dark:border-surface-700`, no `shadow-sm` blob.
5. **CapCut-style density.** Animation thumbnails are the grid's primary
   content — slightly larger cells (~88px), a bigger preview zone, label
   underneath, check badge on the active cell.

## Part A — Migrate tabs to the shared `subTabBar()`

- Replace `animTabsHtml` with `subTabBar([...Transform/Text/Custom], State.activeAnimMainTab, 'setAnimMainTab')` (vertical mode: the horizontal `px-4 py-2` rail like Properties; horizontal dock: keep `animLayoutNav` but give it the same item styling as Properties' `propertiesLayoutNav`).
- Replace `subTabSwitcher(...)` with `subTabBar([...In/Out/Loop], State.activeAnimSubTab, 'setAnimSubTab')` — one call, reused inside the Transform and Text cards identically (the builder keeps them visually identical by construction).
- Delete the four `*MainTabClass` / `*SubTabClass` constants and the two hand-rolled bar templates.
- Text tab's disabled state (non-text clip) keeps `disabled` + muted classes — the builder accepts a per-tab `disabled` flag or we pass a pre-disabled tab object.

## Part B — Preset cells (`renderPresetGrid`)

- **Grid:** `repeat(auto-fill, minmax(88px, 1fr))` at 8px gap (from 74px). Cells grow ~78px → ~88px, preview zone 38px → ~52px.
- **Preview box:** replace the gradient block with a flat two-tone surface —
  `bg-surface-200 dark:bg-surface-700` with a small brand icon centered (or a
  solid `bg-brand-500` flat box, no gradient). Keep the `previewClass`
  animation classes and the `group-hover:scale-105` behavior unchanged.
- **Text preview:** keep the `Aa` glyph; drop the gradient underline if any.
- **Active state:** remove gradient bg + `ring-2` + `shadow-sm`. Use the flat
  chip-style active: `border-brand-500 bg-brand-500/10 ring-1 ring-brand-500/40`
  (same as the app's selected chips) + the existing small check badge.
- **Label:** delete the dark pill. Plain centered text
  `text-[10px] font-semibold text-surface-600 dark:text-surface-300`, active →
  `text-brand-600 dark:text-brand-400`, `truncate` — 10px minimum.
- **"None" cell:** unchanged (ban icon), but restyled to match the flat
  inactive cell.
- Easing selector (`renderEasingSelector`): `grid-cols-3` stays; labels 8px →
  10px; active state = same flat chip style (no shadow/ring-2); curve SVG keeps
  brand color when active.

## Part C — Cards (`transformCard`, `textCard`, `createPropGroup`)

- Card shell: `rounded-xl p-3 shadow-sm hover:shadow-md` →
  `rounded-lg border border-surface-200 dark:border-surface-700` (no shadow, no
  hover shadow — matches Properties `propCard`).
- `createPropGroup` accordion headers: keep the chevron + toggle behavior, but
  use the app's header text token (`text-[10px] font-bold uppercase
  tracking-widest text-surface-500 dark:text-surface-300`) for the group title
  instead of 11px sentence case; body gap/padding match Properties.
- Sliders already use `.custom-slider` (shared) — no change.

## Part D — Custom keyframe editor (`renderCustomKeyframeEditor`)

- Card shell → the Properties card token (`rounded-lg`, `border-surface-200`).
- Header: icon + "Keyframes" title + Save Preset — restyle Save Preset as the
  app's small secondary button (`h-6 px-2 rounded-md text-[10px] font-bold
  bg-surface-100 dark:bg-surface-800 ...`).
- Property rows: `rounded-lg` + `border-surface-100 dark:border-surface-700/60`
  (from the current mixed tokens); the keyframed highlight
  (`bg-brand-50/30 dark:bg-brand-950/10` + brand border) stays — it's the one
  place color communicates state, but flatten the border to `border-brand-300
  dark:border-brand-500/40`.
- Optional organization (defer if noisy): split properties into **Motion**
  (offset/scale/rotate/opacity) and **Audio** (volume/echo/…) groups with the
  same accordion as Part C — CapCut groups keyframe properties by axis.

## Implementation notes

- All markup lives in `index.html`: `animTabsHtml`, `subTabSwitcher`, the four
  tab-class constants, `renderPresetGrid`, `renderEasingSelector`,
  `createPropGroup` / `renderAnimPropGroup`, `transformCard` / `textCard`, the
  horizontal `animLayoutNav`, and `renderCustomKeyframeEditor`.
- `subTabBar` already supports `rail=true` (vertical nav) and takes
  `{key, label, icon, title}` tabs — Properties' `propTabs` is the template to
  copy for the animations tabs.
- Verify with `npm run build`, then the live checklist: main tabs and In/Out/Loop
  render identically to Properties' sub-tabs; cells ~88px with flat previews and
  plain 10px labels; active cell shows only the check + brand tint; hover still
  plays the animation preview; accordions collapse; keyframe editor rows render;
  both docks (vertical + horizontal) clean; console has no errors.

## Out of scope

- Animation behavior, effects, and the keyframe engine itself (unchanged).
- The preview-animation CSS classes (`preview-*`) — reused as-is.
- The Properties panel and its `subTabBar()` usage (already consistent).
- Adding new animation presets or categories.
