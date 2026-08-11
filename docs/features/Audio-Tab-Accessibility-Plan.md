# Audio Tab: Accessibility Plan

Goal: get the **Audio tab** (Library + Track Mixer) to zero DevTools/Lighthouse form issues and make the whole panel keyboard-usable. Current baseline from the audit: **12 form fields without `id`/`name`, 5 fields with no associated label** — plus interactive rows that are mouse-only.

## Phase 1 — Form fields: id/name + labels (the 12 + 5 audit hits)

Every form control in the audio tab gets a unique `id` (or `name`) and an associated `<label>`/`aria-label`:

| Control | Location | Fix |
|---|---|---|
| Group `<select onchange="setAudioLibItemGroup">` | detail panel | `id="audioLibItemGroupSel"` + `<label for>` ("Group") or `aria-label="Group"` |
| Group `<select onchange="setAudioLibMultiGroup">` | multi-select panel | `id="audioLibMultiGroupSel"` + label ("Move to group") |
| Hidden file inputs (Import, Folder, re-import Select Files/Folder) | header + banner | `name`/`id` + `aria-label` ("Import audio files", "Import a folder", …) — hidden inputs still count |
| Dynamic inputs created in `pickAudioLibraryImportFiles/Folder`, `startAudioLibFileReplace`, `startAudioLibRowRename` | pickers + rename | set `id` + `aria-label` at creation time |
| Volume / Pan / Reverb `<input type="range">` | Track Mixer | `id` + `<label for>` per slider + `aria-valuetext` |
| Track select(s) in the mixer | Track Mixer | `id` + label |

**Effort:** small — mostly adding attributes to the existing markup + the 3 dynamic-input creators. Verification: DevTools "form fields without id/name" and "no label" counts → **0**.

## Phase 2 — Icon-only buttons: aria-label

Every icon-only button needs an `aria-label` (they currently rely on `title`):
autoplay (headphones), row rename pencil, detail rename + replace, play/stop, delete (row menu + batch panel + folder menu), close, new-group `+`, re-import Last folder, group-chip delete.

**Effort:** small — one attribute each. `title` stays for the mouse tooltip.

## Phase 3 — Keyboard: rows, menus, trim

- **Library rows are clickable `<div>`s** — give them `role="button"`, `tabindex="0"`, `aria-selected` (single) / `aria-pressed` (multi), and `onkeydown` for **Enter/Space = select, Delete = delete, ArrowUp/Down = move selection** (mirroring the existing audio-tab arrow handling). Add a visible `focus-visible:ring` so the focus travels.
- **Context menu** (`showAudioLibContextMenu`) opens on `contextmenu` only — add Shift+F10 / Menu-key support on the focused row, and make the menu items real focusable buttons (they already are `<button>`s) with Escape to close.
- **Trim handles** (`startAudioLibTrim` is `onmousedown`-only) — add `tabindex="0"` on both handles + **Left/Right arrow** to nudge `inPoint`/`outPoint` by one frame, Home/End to reset. This is the biggest item (~half a day).
- **Drag-to-group / drag rows** remain mouse-only (native DnD has no keyboard story) — provide the context-menu "Move to group" as the accessible alternative (already exists ✓).

**Effort:** medium — rows + menu are small; trim arrows are the main chunk.

## Phase 4 — Semantics + live announcements

- Wrap the list in `role="list"` with `role="listitem"` rows (or switch to real `<ul>/<li>`).
- **aria-live="polite"** on: the import progress line, the re-import status line, the amber missing banner, and the multi-select "N sounds selected" panel — screen readers hear state changes instead of nothing.
- Give the panel a proper heading (`aria-labelledby` on the section) and `aria-expanded` on the group chips' folder menu trigger.
- Selected-row announcement: when `aria-selected` changes, include the sound name in the row's accessible name (name span already there).

**Effort:** small.

## Phase 5 — Contrast + focus visibility

- Check muted text (`text-surface-400/500`) against the dark surfaces — bump the smallest type (durations, `text-[10px]` labels) to `text-surface-400` minimum and add `aria-hidden="true"` to purely decorative icons.
- Add a global `focus-visible` ring style for the audio tab (brand ring), and `motion-reduce` guards for the hover transitions.

**Effort:** small.

## Verification checklist

1. DevTools audit (the two issues from the screenshot) → **0 resources** for both.
2. Tab through the audio tab: every row, button, select, and slider is reachable and shows a focus ring; Enter/Space selects; arrows move selection; Delete deletes; Escape closes menus.
3. Screen-reader smoke test: select a row → name + "selected" announced; import progress and re-import status announced via aria-live; group select announces label + value.
4. Trim handles: arrows move in/out points and the waveform + handles update.
5. `npm run build` clean; no regressions in the light-select path (row toggling must not clobber the new attributes — keep class/attribute changes in `audioLibApplyRowState`).

## Suggested order

Phase 1 → 2 → 4 (quick, gets the audit to zero) → 5 → 3 (rows/menus) → trim arrows last if time allows.
