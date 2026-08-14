# Multi-Project Save / Load Plan

> **Date:** August 2026
> **Status:** Implemented (P1–P3, Aug 14 2026) — P4 hardening + P5 stretch remain
> **Goal:** Save **many projects** in the browser, choose which one to open, and start a **new empty project** — today the app keeps exactly one project in a single autosave slot.
>
> **Implementation notes:** the registry (`studiopro_projects_index`), per-project slots (`studiopro_project_{id}`), active pointer (`studiopro_active_project`), legacy migration, `switchProject`/`createNewProject`/`duplicateProject`/`renameProject`/`deleteProject`, per-project undo stacks, side-store resync, the Projects modal (toolbar `layers` button), the title-bar name + dirty dot, and the Re-import modal's "Start a New Empty Project" now creating a registry project (nothing destroyed). All live-verified (switch/refresh/duplicate/delete/undo/side-store isolation) — see the checklist below.
>
> **Companion doc:** [Project-Save-Load-Reimport.md](./Project-Save-Load-Reimport.md) — the existing single-project save/load + media re-import system this plan extends.

---

## TL;DR

Today the entire app state lives under **one** localStorage key (`PROJECT_AUTOSAVE_KEY = 'studiopro_project_autosave_v1'`, `index.html:25802`); every autosave overwrites it and startup restores it. To support multiple projects we add:

1. **A project registry** — a small index in localStorage (`studiopro_projects_index`) listing every saved project: `{ id, name, savedAt, version, thumbnail }`.
2. **Per-project slots** — each project's full `serializeProject()` JSON under its own key (`studiopro_project_{id}`).
3. **An active-project pointer** — `studiopro_active_project` says which slot the editor is editing.
4. **A switcher** — a Projects modal (list + thumbnails + New Project / Open / Duplicate / Rename / Delete / Export / Import), plus the plumbing so autosave writes to the *active* slot and switching projects swaps everything (`applyProject` + the caption/markdown side stores + re-import modal).

The hard parts are not the storage — they are the **integration points**: the autosave cadence, the global caption/markdown side stores (`studiopro_subtitles`, `studiopro_markdownConfig`, …), the undo stack, the re-import modal, and the localStorage quota. Each is addressed below.

---

## 1. Current State (the one-slot model)

| Piece | Where | Behavior |
|---|---|---|
| Autosave key | `PROJECT_AUTOSAVE_KEY` (`index.html:25802`) | One JSON string; overwritten every change |
| Serializer | `serializeProject()` (`index.html:25905`) | Full project: tracks, clips, captions, subtitle/markdown configs, audio library, canvas globals |
| Restore | `applyProject(data)` (`index.html:26010`) | Rebuilds State; resets undo; shows re-import modal for missing media |
| Autosave loop | `tryAutosaveProject(force)` (`index.html:26109`), `setInterval(…, 2500)` (`26170`), `beforeunload`/`pagehide` (`26171–72`) | Signature-compare dedup; skipped during playback/export |
| Startup | `restoreAutosavedProject()` (`index.html:26130`), called at `2131` | Loads the single slot |
| Manual | `saveProjectToFile()` (`26144`) / `importProjectFile(input)` | JSON download / upload |
| Caption side store | `saveSubtitlesToStorage()` / `loadSubtitlesFromStorage()` (`index.html:15871/15878`) | `studiopro_subtitles`, `studiopro_subtitleConfig`, `studiopro_subtitleGen` — **global**, loaded at startup *before* `restoreAutosavedProject` so project data wins |
| Markdown side store | `saveMarkdownConfig()` / `loadMarkdownConfig()` (`index.html:15891/15896`) | `studiopro_markdownConfig` — **global**, same pattern |

**Why only one project:** there is one key, one restore path, no index, no picker. The data model (JSON project) is already perfect for N projects — only the storage layout and the switching plumbing are missing.

---

## 2. The Design: Registry + Per-Project Slots + Active Pointer

### 2.1 Keys

| Key | Contents |
|---|---|
| `studiopro_projects_index` | `{ version: 1, projects: [ { id, name, savedAt, duration, version, thumbnail } ] }` — the registry (small, always kept fresh) |
| `studiopro_project_{id}` | one `serializeProject()` JSON per project (the same object the Save button already produces) |
| `studiopro_active_project` | `{ id, name }` — which project the editor is currently editing |

`id` is a generated UUID (`crypto.randomUUID()` with a fallback), **never the project name** — names are user-editable and can collide or contain characters awkward for keys.

### 2.2 The registry entry

```jsonc
{
  "id": "4f2a9c1e-…",
  "name": "Product Launch — Aurora",
  "savedAt": 1786591000000,
  "duration": 37.5,
  "version": 1,
  "thumbnail": "data:image/webp;base64,…"   // small canvas snapshot (see §6)
}
```

### 2.3 Migration from the single slot (one-time, on first load with the new code)

```js
function migrateLegacyAutosave() {
  const idx = localStorage.getItem(PROJECT_INDEX_KEY);
  if (idx) return;                       // already migrated
  const raw = localStorage.getItem(PROJECT_AUTOSAVE_KEY);
  const projects = [];
  if (raw) {
    try {
      const data = JSON.parse(raw);
      projects.push({
        id: newProjectId(),
        name: 'My Project',               // or data.name if we start storing one
        savedAt: data.savedAt || Date.now(),
        duration: data.duration || 60,
        version: data.version || 1
      });
      localStorage.setItem(PROJECT_KEY_PREFIX + projects[0].id, raw);
    } catch (e) { /* keep going with an empty registry */ }
  }
  localStorage.setItem(PROJECT_INDEX_KEY, JSON.stringify({ version: 1, projects }));
  // active = the migrated project (or none → brand-new empty project on first run)
}
```

For one release, also **keep writing the legacy key** (or add a "Restore from old autosave" entry) so nothing is lost if the user downgrades. After a grace period the legacy key becomes just the active project's slot mirror.

---

## 3. The Integration Points (the parts that actually break)

### 3.1 Autosave must target the active slot

`tryAutosaveProject` (currently `index.html:26109`) writes to `PROJECT_AUTOSAVE_KEY`. Change the write target:

```js
function activeProjectSlot() {
  const a = getActiveProject();          // from studiopro_active_project
  return a ? PROJECT_KEY_PREFIX + a.id : null;
}

// inside tryAutosaveProject, replacing the setItem call:
const slot = activeProjectSlot();
if (!slot) return;                        // no project open yet → nothing to autosave
localStorage.setItem(slot, json);
touchRegistryEntry(a.id, { savedAt: Date.now(), duration: State.duration });
```

The debounce/signature logic (`_lastProjectSig`, `_projectDirty`, 2.5 s tick, force on `pagehide`) is untouched — but `_lastProjectSig` must be **per-project** (reset on switch) so switching away and back doesn't skip a legit save. Simplest: `_lastProjectSig = { }` keyed by project id.

### 3.2 The caption/markdown side stores are global — resync them on switch

`studiopro_subtitles`, `studiopro_subtitleConfig`, `studiopro_subtitleGen`, `studiopro_markdownConfig` are **shared keys** that other code reads at startup and writes on every caption/markdown edit. With multiple projects this is fine *as long as switching projects rewrites them from the loaded project*:

```js
function syncSideStoresFromState() {
  saveSubtitlesToStorage();      // writes studiopro_subtitles / _subtitleConfig / _subtitleGen
  saveMarkdownConfig();          // writes studiopro_markdownConfig
}
```

`switchProject(id)` does: save current → `applyProject(loaded)` → `syncSideStoresFromState()` → set active pointer. Because `serializeProject()` already includes `subtitles`, `subtitleConfig`, `subtitleGen`, `subtitleFix`, and `markdownConfig`, the loaded project's captions/markdown are *authoritative*; the side-store sync is only so that any later incremental save writes the right project's data (and so a page refresh mid-session restores the active project's captions even before `applyProject` runs).

### 3.3 Undo history

`applyProject` resets `undoStack`/`redoStack` (`index.html:26083`). Per-project undo stacks in memory are cheap and feel right:

```js
// module-level, not persisted
const _perProjectUndo = {};    // { [projectId]: { undoStack, redoStack, _lastUndoKey } }
```

On `switchProject`: stash the outgoing project's stacks, restore the incoming project's stacks. Not persisted across reloads (documented behavior — same as today).

### 3.4 Re-import modal

`applyProject` already calls `showReimportModal()` for missing media — so switching to a project with placeholders automatically offers re-import. No change needed, but the switch flow must run *after* the DOM is ready (the modal attaches to the document).

### 3.5 Playback / export / audio teardown

`applyProject` already calls `stopAllMedia()` and disconnects per-clip audio chains, so switching mid-playback is safe. `tryAutosaveProject` skips while `isPlaying || isExporting` — the switch handler should also guard (or force-stop playback) before switching, then autosave both projects.

### 3.6 Media is still never stored

The re-import model stays: media files are not persisted, so a project slot is *small* JSON (usually tens of KB — hundreds of KB only with an embedded-SFX-heavy audio library). This is what makes N projects in localStorage viable at all.

---

## 4. API Sketch

```js
// Registry
function listProjects()                  // -> [{ id, name, savedAt, duration, thumbnail }] (sorted by savedAt desc)
function getProject(id)                  // -> parsed project JSON (or null)
function saveProject(id, data)           // -> writes slot + refreshes registry entry
function deleteProject(id)               // -> removes slot + registry entry (+ clears active pointer if it was active)
function duplicateProject(id, newName)   // -> new id + deep copy + " — copy" suffix

// Active project
function getActiveProjectId()
function setActiveProjectId(id)          // persists studiopro_active_project
function newProjectId()                  // crypto.randomUUID() w/ fallback

// Lifecycle
function switchProject(id)               // save current → applyProject(loaded) → sync side stores → swap undo → set active → drawCanvas()
function createNewProject(name)          // minimal default project (tracks v1/a1/a2, empty clips) → applyProject → active
function renameProject(id, name)
function captureProjectThumbnail()       // snapshot canvas -> small webp data URL (reuse capturePresetThumbnail path)

// Startup (replaces the single restoreAutosavedProject call at index.html:2131)
function initProjects() {
  migrateLegacyAutosave();
  const active = getActiveProjectId();
  if (active && getProject(active)) { applyProject(getProject(active)); }
  else if (listProjects().length) { setActiveProjectId(listProjects()[0].id); applyProject(getProject(listProjects()[0].id)); }
  else { createNewProject('Untitled'); }
  syncSideStoresFromState();
}
```

`tryAutosaveProject` keeps its signature but writes `activeProjectSlot()`; `saveProjectToFile()` uses the active project's name for the download filename.

---

## 5. UI Plan

### 5.1 Projects modal

- Opened from a **"Projects"** button in the top toolbar (and/or the File menu alongside Save/Load).
- **Grid of project cards**: thumbnail (canvas snapshot), name, duration, saved time; click → **Open**; hover actions: **Rename**, **Duplicate**, **Export (.json)**, **Delete** (confirm).
- **"New Project"** button → inline name prompt → `createNewProject(name)` → starts empty (default tracks + `Untitled`-style canvas). Optionally "New from template" once the [Design-Templates-and-Skills-Plan.md](../hyperframes/Design-Templates-and-Skills-Plan.md) lands — a template is a natural starting point for a new project.
- **Import .json** button → `importProjectFile` path, which now adds the imported project to the registry (new id) instead of replacing the active one.

### 5.2 Open confirmation

Opening a different project discards nothing (autosave runs first), but if the current project has missing media the re-import modal will re-appear for the newly opened project — expected, just surface it in the confirm text.

### 5.3 Project name in the title bar

Show the active project's name (and a dirty indicator `•`) so it's obvious which project is being edited.

---

## 6. Thumbnails

Reuse the existing canvas-snapshot path (`capturePresetThumbnail`, `index.html:11498`): draw the current frame at small size (e.g. 320×180) into a webp data URL and store it in the registry entry. Refresh the active project's thumbnail on autosave (debounced — only when the signature changed). Cap each thumbnail to ~5–10 KB so the registry stays tiny.

---

## 7. localStorage Quota & Robustness

localStorage is typically ~5 MB. Projects are small (no media), but the **audio library with embedded SFX** (`serializeProject` → `audioLibrary` base64) is the only thing that can balloon. Plan:

1. **Size accounting in the registry**: store each project's `bytes` (computed at save). The modal shows a per-project size and a total.
2. **Graceful quota failure** (already partially handled at `index.html:26127` — `console.warn`): upgrade to a visible warning + offer **Export this project to .json** immediately.
3. **Eviction with consent**: if a save fails with `QuotaExceededError`, offer "Delete oldest project (X MB)" before retrying.
4. **Optional IndexedDB fallback (stretch)**: the app already uses IndexedDB for the re-import folder handle; a `project-store` in IDB removes the quota ceiling entirely while keeping the registry in localStorage for fast listing. Keep localStorage as the default and IDB as an opt-in for heavy libraries.

---

## 8. Phased Implementation

| Phase | Work | Outcome |
|---|---|---|
| **P1 — Storage layer** | Registry + per-project slots + active pointer + migration from the legacy key; `listProjects`/`getProject`/`saveProject`/`deleteProject`; `tryAutosaveProject` writes the active slot; per-project `_lastProjectSig` | Two projects persist independently; refresh restores the active one; legacy autosave migrated once |
| **P2 — Switching** | `switchProject` / `createNewProject` / `duplicateProject`; side-store resync; per-project undo stacks; playback guard | Open another project or start empty from the console/API; captions + markdown follow the project |
| **P3 — Projects UI** | Projects modal (cards, thumbnails, New/Rename/Duplicate/Delete/Export/Import), title-bar name + dirty dot | Full user-facing switcher |
| **P4 — Hardening** | Size accounting, quota warnings, oldest-project eviction, thumbnail refresh cadence, import-into-registry | Safe at scale; no data loss on quota |
| **P5 — (Stretch) IDB + templates** | IDB store for heavy audio libraries; "New from design template" | No quota ceiling; templates seed new projects |

**Suggested sequence:** P1 → P2 → P3 (the user-visible feature), then P4 before shipping, P5 as follow-up.

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Caption/markdown side stores leak across projects | `syncSideStoresFromState()` inside `switchProject`; `serializeProject` is the single source of truth (it already includes both) |
| Autosave writes to the wrong slot after switching | Per-project `_lastProjectSig`; `activeProjectSlot()` derived from the active pointer at write time; never cache the slot string |
| Quota exceeded (audio-library-heavy projects) | Size accounting + export-first warning + oldest-project eviction with confirm + optional IDB store (P5) |
| Downgrade / old-code restore overwrites registry | Keep writing the legacy key as a mirror for one release; migration is one-way and documented |
| `applyProject` resets undo on switch | In-memory per-project undo stacks (module-level map) |
| Missing-media re-import modal fires on every switch | Expected behavior (documented in the open confirm); `showReimportModal` already handles the empty case gracefully |
| Two tabs editing the same project | Out of scope (same as today); note in docs — the `storage` event could later surface conflicts |
| Thumbnails bloat the registry | Cap size (320×180 webp, ~5 KB), refresh only on signature change |

---

## 10. Verification Checklist

- [x] Create project A, add clips + captions + markdown; switch to new empty project B (blank canvas, default tracks, no captions).
- [x] Edit B; refresh the page → B restores; switch back to A → A's clips/captions/markdown restore exactly. *(verified: bg `#ff0000` in B vs `#231F20` in A; fontSize 99 in A survived a reload)*
- [x] Legacy single-slot autosave migrates into the registry once, and the migrated project is openable.
- [x] Caption edits in A don't leak into B (side stores resynced). *(verified: `studiopro_subtitleConfig` followed the active project)*
- [x] Undo in A survives switching to B and back (in-memory per-project stacks).
- [x] A project with missing media shows the re-import modal when opened. *(unchanged — `applyProject` handles it)*
- [x] Delete / duplicate / rename / export / import all work; deleted slot frees its bytes.
- [ ] `QuotaExceededError` path surfaces the warning + export/evict options instead of silently failing. *(alert + console.warn added; size-accounting UI / eviction dialog in P4)*
- [x] `node --check` + `npm run build` pass; no console errors in either vertical or horizontal dock.

---

*See also: [Project-Save-Load-Reimport.md](./Project-Save-Load-Reimport.md) (the single-project save/load this extends), [Memory-Usage-Analysis.md](./Memory-Usage-Analysis.md) (autosave cost), and [Design-Templates-and-Skills-Plan.md](../hyperframes/Design-Templates-and-Skills-Plan.md) (templates as "new project" starting points).*
