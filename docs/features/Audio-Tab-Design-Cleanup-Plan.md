# Audio Tab: Card + Panel Design Cleanup Plan

A design pass over the **Audio tab → Library** (and lightly, Track Mixer) to make the cards and layout feel clean, calm, and CapCut-like — consistent with the editor's existing design tokens (surface colors, brand accent, 10–14px type, rounded-md cards).

## Current pain points

- Rows are "card boxes" with borders + full-width hover borders — visually noisy when the list is long; selection uses a heavy purple border + tint that competes with the multi-select ring.
- The header stacks 4 actions (autoplay icon, Mock, Folder, Import) with mixed visual weight and inconsistent heights.
- The filter chips and the re-import banner sit close together; the amber banner is busy (icon + 2–3 buttons + status text).
- The detail panel is dense: name + 3 icon buttons + Add, then GROUP, then waveform — no visual grouping or hierarchy between "identity" and "trim" zones.
- Durations/names/durations use inconsistent type sizes; long names truncate without a visible hint in some spots.
- Hover gives little feedback on non-selected rows (only a border color change); no pressed/active state.

## Design principles (match the app + CapCut)

1. **One accent, one interaction.** Brand purple = the *selected* item and the primary action only. Everything else is neutral (surface grays). Hover = subtle (surface tint + border), never full color.
2. **Consistent rhythm.** Use the existing spacing scale (2/3/4/8): rows `p-2`, gaps `gap-2`, panel `p-4 gap-4`. Same radius (`rounded-lg`/`rounded-md`) and border color everywhere.
3. **Type hierarchy.** Row name = `text-sm font-medium`; duration = `text-[10px] font-mono text-surface-400` (keep). Panel title = `text-sm font-bold`. Section labels = `text-[10px] uppercase tracking-wider text-surface-400`.
4. **Less chrome, more clarity.** Remove boxy double-borders; prefer one border + one background layer. Empty space does the separating.

## Part A — Library list cards

- **Row base:** keep `rounded-lg` but switch hover from `hover:border-brand-300` to `hover:bg-surface-100 dark:hover:bg-surface-700/50` + `hover:border-surface-300` (quiet). Add `active:scale-[0.99]` or a pressed tint for click feedback (with `motion-reduce:transition-none`).
- **Selected state (single):** replace the full purple border+tint with a **2px left accent bar** + faint tint: `border-l-2 border-l-brand-500 bg-brand-50/40 dark:bg-brand-500/10` and keep the row's normal borders elsewhere. Reads as "selected" without boxing the row.
- **Multi-select state:** keep the ring, but soften to `ring-1 ring-brand-500/30` and a slightly stronger tint so it reads as "in a batch" vs "the one selected".
- **Duration:** keep right-aligned mono, but pad it with a small left margin and don't shrink it (`shrink-0` already) — consider a tiny waveform bar (see Part E, optional).
- **Hover pencil (rename):** keep; give it a rounded hover pill (already) and ensure the whole row's `title` isn't the only discoverability for drag — fine as-is.

## Part B — Header + filter chips

- **Header:** one height for all buttons (`h-7 px-2.5`); icon buttons get a consistent `p-1.5` square. Order stays: autoplay · Mock · Folder · Import. Give the autoplay button a **visible active state** (brand tint, already present) and a pressed state.
- **Chips row:** unify to `h-6 px-2.5 rounded-full text-[10px] font-bold`; active = `bg-surface-900 dark:bg-white text-white dark:text-surface-900` (current). Add **per-chip counts** (e.g. `SFX · 14`) in muted type — helps scanning long libraries. The `+` stays a `w-6 h-6` circle.
- **Banner:** restructure to a single row: `alert-triangle` icon + `"N sounds need re-import"` text + inline **Select Files** / **Last folder** text-link buttons; move the folder button into a compact `…` menu only when both actions fit badly on narrow widths. Status line stays as a quiet one-liner underneath.

## Part C — Detail panel

- **Identity zone:** name (`text-sm font-bold`) + rename/replace icons + play + Add — group them with a `gap-2` and put a hairline divider before the Group row so "what this sound is" vs "settings" is obvious.
- **Group row:** keep label-left/select-right, but widen the select hit area (`px-2 py-1.5`) and add a `cursor-pointer`.
- **Waveform zone:** give it a section label `Trim` (uppercase, muted) and put the waveform in the existing surface box. Trim handles stay, but reduce the white dot size slightly and add `group-hover` ring so they're discoverable. Playhead line: keep red but add a subtle glow.
- **Disabled (sfxMissing) state:** the amber note stays, but render the play/Add with `opacity-40` + a muted border so "disabled" reads before the text does.

## Part D — Empty states + Track Mixer

- **Empty library:** keep the dashed box + icon + copy, add a **primary Import button** inside it (one obvious action).
- **Empty group:** same pattern with the folder icon (current) — fine.
- **Track Mixer:** out of scope for the card pass; only align its selects/sliders to the same height/radius tokens so the two sub-tabs don't feel like different apps.

## Part E — Optional (later)

- **Row waveform thumbnails** (tiny 40px-wide bars of `audio.peaks` per row) — CapCut-style scannability; cost is one extra canvas/div per row, so gate it to groups with > 20 items or keep off by default.
- **Virtualized list** for 500+ item libraries (render only visible rows) — pairs with the scroll work already done.

## Implementation notes

- All changes live in `renderAudioLibrary` (header/chips/banner/list/detail markup) in `index.html`; no state changes.
- The light-select path (row class toggling) means the selected/accent classes must stay **single-source constants** — keep `audioLibApplyRowState`'s class strings in sync with the markup classes (documented inline).
- Verify with `npm run build`, then the live checklist: select/hover smoothness, scroll position kept after group switches, multi-select rings, missing-sound states, and both docks (vertical/horizontal sidebar).

## Out of scope

- Track Mixer redesign, export modal, other panels.
- Behavior changes (this is purely visual + micro-interaction).
