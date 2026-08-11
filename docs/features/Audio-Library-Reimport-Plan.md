# Audio Library: Folder Delete + Re-import Plan

Two related improvements to the **Audio tab → Library** panel (`index.html`, single-file app).

## Part A — Deleting a folder deletes its files

**Current behavior:** Right-clicking a group chip (SFX / Music / Yt / custom) opens a "Delete Folder" menu, but `deleteAudioLibGroup(g)` only *ungroups* the sounds (`a.group = ''`) — they stay in the library and keep showing under **All**. The menu even says *"they'll become ungrouped."*

**Goal:** Deleting a folder should also remove the sounds inside it, so the **All** list reflects the deletion.

### Changes

1. **`deleteAudioLibGroup(g)` → delete, not ungroup.** Collect the group's ids and hand them to the existing `deleteAudioLibSounds(ids)` core (it already does the cleanup correctly: stops playback, subtracts `_audioLibDecodedBytes`, clears `_audioLibBufferCache`, drops the selection, prunes the multi-select, re-renders). Then clear the group filter if it pointed at the deleted folder.
2. **Menu copy + confirmation.** The label becomes `Delete Folder` → destructive (deletes N sounds). Add a lightweight two-click confirm in the menu so an accidental click can't wipe files:
   - First click turns the button into a red **"Click again to confirm — delete N sounds"** state (with a small timeout ~2.5s to reset).
   - Second click runs the delete.
   - Update the sub-copy: `N sounds inside — they'll be deleted from the library. Timeline clips are not affected.`
3. **Filter reset.** If the deleted folder was the active filter, reset to **All** (same as today).
4. **Timeline clips are untouched.** Clips added from the library carry their own decoded copy — consistent with the existing per-item delete.

## Part B — Re-import button for missing audio files

**Why it's needed:** Large sounds (> `SFX_EMBED_MAX`, 800 KB) save into the project as `sfxMissing` — their name/group/trim survive, but after reopening the project they can't play or be added to the timeline (buttons are disabled with the amber *"re-import it from your computer"* note). The media re-import modal (for project clips) exists at open, but there is no equivalent for the audio library, and the user may have **renamed** a sound — so matching must use the *original* filename, not the current name.

### Design

- **No opening-screen modal** — a **Re-import button in the Audio Library header** (next to Mock / Folder / Import) plus an inline **"N sounds need re-import" banner** that appears only when `sfxMissing` items exist. Clicking the banner/button opens a file picker (multi-file **and** folder, reusing the remembered last-folder handle from the media re-import flow when available).
- **Match by original filename** so a renamed sound still re-links:
  - Persist a new `sourceName` field (original `file.name` at import time) in `libraryItemToJSON` and `restoreAudioLibrary`.
  - Both rename paths (detail-panel pencil and row hover-pencil) only touch `name`, so `sourceName` survives renames.
  - Matching uses the existing `normFileName` helper (lowercase, strip extension, strip the ` (Audio)` companion suffix) on **`sourceName`**, falling back to **`name`** for legacy items saved before this change. Extension-insensitive: a re-picked `song.mp3` matches an item whose source was `song.wav`.
- **Hydration, not re-import-as-new:** a matched file **decodes and refills the existing item** — buffer, live `File`, fresh peaks/duration (clamping trim points to the new duration), `sfxMissing = false`, `_lastUsed` bumped, `_audioLibDecodedBytes` accounted, eviction re-checked. The item's id, group, trim window, and position in the list are preserved. (If the file is still > 800 KB it simply isn't re-embedded — it plays fine for the session.)
- **Progress + summary:** reuse the `_audioLibImport` progress bar already in the header ("Re-importing 3/4…"), then a status line: `✓ Re-imported 3 of 4 missing sounds — skipped 1 unmatched (noise.mp3)`. Unmatched files are skipped, never added as new entries.
- **No missing sounds → button does nothing visible** (or a subtle "nothing to re-import" tooltip). Re-importing a *healthy* item (replacing its file) is out of scope for v1 — the per-alt **Replace** flow already covers that pattern for script sounds, and can be extended later.

### Files touched

- `index.html` only — `libraryItemToJSON` / `restoreAudioLibrary` (`sourceName`), header buttons + missing-banner markup, new `reimportAudioLibraryFiles(files)` + `countAudioLibMissing()` + picker/folder handlers, `deleteAudioLibGroup` rewrite + group-menu confirm state.

## Verification (manual + live)

1. Import a folder with >800 KB files → reload project → sounds show as missing (amber note, disabled play/add).
2. Rename one missing sound → Re-import the folder → **both** re-link (renamed one by `sourceName`), trim points preserved, play + Add work.
3. Re-import with an unmatched file → skipped, reported in the status line, nothing new added.
4. Right-click a group chip → Delete Folder → second click confirms → sounds gone from the group **and** from All; filter resets; console clean; `vite build` passes.
5. Timeline clips added from deleted sounds still play (independent copies).

## Out of scope / future

- Replacing a healthy sound's file from the library (per-item Replace button) — script-sounds Replace is the existing pattern to copy.
- Remembering the exact audio folder separately from the media folder handle.
