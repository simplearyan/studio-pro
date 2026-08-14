# Re-import Media Modal — Redesign

> **Date:** August 2026
> **Status:** Plan → Implemented
> **Goal:** Make the Re-import Media modal cleaner and better organized, and replace the in-modal project `<select>` with a button that opens the Projects modal (the single, proper place to switch projects).

---

## 1. Why redesign

The current modal grew organically and reads as a wall of stacked controls with no visual hierarchy:

| Issue | Current behavior |
|---|---|
| **Long intro paragraph** | A wordy explanation of filename matching sits at the top before any actionable content. |
| **Project `<select>`** | A raw dropdown with a stale-value problem (after switching, the select still renders inside the OLD modal until it re-renders) and no affordance that this is a *switch-project* action. |
| **Flat action stack** | Select Files, Select Folder, Start New Project, Skip for now are all siblings — no grouping into "actions" vs "footer". |
| **Mixed meta + actions** | The missing-clips list, the project row, and the action buttons all share one column with uneven spacing. |
| **No section labels** | Nothing tells the user what each group is. |

---

## 2. New design (CapCut-style clarity)

```
┌──────────────────────────────────────┐
│ 📥 Re-import Media               ✕   │   header (icon + title + close)
├──────────────────────────────────────┤
│ PROJECT                              │   section label
│ [layers] My Project      [Switch ▾]  │   active project name + button → Projects modal
├──────────────────────────────────────┤
│ MISSING MEDIA · 3 clips              │   section label + count
│ [film] camels.mp4                video│   compact type chips (kept)
│ [image] poster.jpg               image│
│ [music] track.wav                audio│
├──────────────────────────────────────┤
│ [📂 Last folder: Videos]              │   optional quick-reuse row (kept)
│ [⬆  Select Files]                   │   primary action (brand, full-width)
│ [🗀  Select Folder]                  │   secondary action (outlined)
├──────────────────────────────────────┤
│ [file-plus] Start a New Empty Project │   quiet footer link (divider above)
│ Skip for now                          │
└──────────────────────────────────────┘
```

### Key decisions

1. **Project `<select>` → "Switch project" button.**
   - The Projects modal is the single place to browse, switch, duplicate, rename and delete projects. Duplicating that as a dropdown inside the re-import modal was redundant and produced stale option state.
   - The button opens `showProjectsModal()`; picking a project there runs `switchProject(id)`, which (via `applyProject` → `showReimportModal`) re-renders this modal for the newly chosen project automatically.
   - Edge case handled: if the chosen project has **no missing media**, the re-import modal now **closes itself** instead of silently showing the previous project's list.

2. **Section labels** ("PROJECT", "MISSING MEDIA · N", implicit Actions / footer) give the eye three clear zones instead of one long column.

3. **Shortened summary.** The filename-matching explanation is folded into a one-liner under the MISSING MEDIA label ("Files are matched to clips by filename automatically.").

4. **Footer grouping.** "Start a New Empty Project" and "Skip for now" sit below a divider as quiet, low-priority exits — the destructive/blank-slate action is visually demoted from the primary re-import actions.

5. **Drop-anywhere hint** (the existing drag & drop overlay highlight) is untouched — it already works on the whole window.

---

## 3. Implementation notes

- All changes live in `showReimportModal()` (`index.html`) — the modal markup is built in JS, so the redesign is one template swap.
- `showReimportModal()` gains the empty-guard: `if (!missing.length) { hideReimportModal(); return; }` so switching to a clean project closes the stale modal.
- The "Switch project" button: `onclick="showProjectsModal()"` — reuses the existing Projects modal (no new state).
- `lastReimportFolderBtnHtml()` stays as the optional quick-reuse row.
- No storage/model changes — this is presentation-only.

---

## 4. Verification checklist

- [ ] Modal opens with the new layout when a project has missing media.
- [ ] "Switch project" opens the Projects modal; picking a project re-renders the re-import modal for that project's missing list.
- [ ] Picking a project with no missing media closes the re-import modal.
- [ ] Select Files / Select Folder / last-folder row still re-link media by filename.
- [ ] "Start a New Empty Project" still creates a registry project and switches.
- [ ] Drag & drop anywhere still re-imports; `node --check` + `npm run build` pass; no console errors.
