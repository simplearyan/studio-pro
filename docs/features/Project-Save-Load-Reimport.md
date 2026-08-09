# Project Save / Load & Media Re-Import System

*Status: implemented and verified. Last updated with the split-preservation re-import rework (commit `f4c6635`).*

This document explains how projects are saved and restored as JSON, how missing media is re-imported, and the rules that keep clip windows, splits, links, and envelopes intact across the save → refresh → re-import round trip.

---

## 1. Overview

A project is a pure-data JSON: every clip's timeline window, transform, effects, speed, reverse, trim/fades, volume automation, embedded SFX, captions, markdown styles, and aspect ratio. **Media files themselves are never stored** — only the original file name. This keeps saves tiny, but it means after a page refresh (or loading a JSON on another machine) media clips come back as placeholders marked *missing* until the user re-imports the files.

Two complementary persistence mechanisms:

| Mechanism | Key / File | When |
|---|---|---|
| **Autosave** | `localStorage` (`PROJECT_AUTOSAVE_KEY`) | Automatically on every meaningful edit; restored on page load (`restoreAutosavedProject`) |
| **Manual save / load** | `.json` file download / file picker (`saveProjectToFile`, `importProjectFile`) | User-initiated, shareable |

### What survives a save/load round trip

- Clip window: `start`, `duration`, `sourceOffset` (split points survive exactly)
- Trim & fades: `trimStart` / `trimEnd` / `fadeIn` / `fadeOut` / fade-curve
- Speed: `userSpeed`, speed ramps, `reverse` (and preserve-pitch)
- Envelope: `volumeAutomation` keyframes + per-segment curves
- Transform, crop, mask, color, border-radius, blend modes
- Embedded element SFX (`sfx.buffer` is serialized as base64 `sfx.data` and re-decoded on restore)
- Captions / subtitle styles, markdown clip styles
- **Link state**: `linkedClipIds` is stored verbatim — a deliberately unlinked pair comes back unlinked

### What does NOT survive (by design)

- Media buffers, video elements, image elements, audio elements — replaced by re-import
- Runtime-only caches: `_mathLastGood`, `_mathLastExtrude`, `__vecLastSprite`, `_mathPreview` (blacklisted from serialization; stripped on restore so stale stubs can never reach `drawImage`)

---

## 2. The missing-media lifecycle

```
save (JSON / autosave)
   │  clip { type: video, fileName: "clip.mp4", start: 0, duration: 7.52, linkedClipIds: [...] }
   ▼
refresh / load JSON
   ▼
restoreClip(c)          ← every clip is rebuilt from plain data
   │  • isPlaceholder = true          (canvas shows the mock / "RE-IMPORT MEDIA" state)
   │  • _missingMedia  = true         (flagged for the re-import modal)
   │  • _reimportRestore = true       (PERSISTENT marker: this is a real clip needing
   │                                   its source, NOT a fresh mock — see §4)
   │  • fileName kept, fileUrl deleted
   ▼
re-import (any path — §3)
   ▼
source swapped in, window preserved, links untouched
```

`_reimportRestore` exists because `_missingMedia` is *transient*: a clip can be fed more than once during a single re-import run (companion pass + direct match), and the first feed clears `_missingMedia`. The persistent flag is what tells `loadAudioFileIntoClip` to preserve the saved window instead of resetting to the full source duration.

---

## 3. The three re-import paths

All paths converge on the same machinery, so behavior is identical everywhere.

### 3a. Re-import modal — file picker & drag & drop

- Triggered from the missing-media banner/modal (`showReimportModal`).
- `runReimport(files, opts)` is the shared core — used by:
  - **"Select Files"** picker (`reimportMediaFiles`)
  - **drag & drop** straight onto the missing-media list
  - **folder pick** (`reimportMediaFromFolder`, via `webkitdirectory`) and **File System Access** picker (`pickReimportFolder`)
- **Matching**: each file's name is normalized (`normFileName` — strips `(Audio)` suffix *first*, then the extension, then case) and matched against every still-missing clip.
- **Multi-match**: one source file feeds **every** still-missing clip with that base name — split halves and the linked/companion audio all share one filename, so one pick restores all of them. (`runReimport` loops the match, not just `findIndex`.)

### 3b. Folder pick & remembered folder

- **Folder pick** (`webkitdirectory` / `showDirectoryPicker`): collects only `audio/* | video/* | image/*` files (a folder often contains `project.json`, `.srt`, thumbnails — those never count as unmatched).
- **Last-used folder memory** (File System Access API):
  - The `FileSystemDirectoryHandle` is persisted to **IndexedDB**, surviving reloads and restarts.
  - `showDirectoryPicker({ id: 'reimport-folder' })` makes even the dialog itself default to the last directory.
  - **"Re-import from last folder: \<name\>"** — a quick button in both modal states (initial + still-missing summary) when a remembered handle is granted; clicking re-requests permission if revoked and hides if denied.
  - Graceful fallback: browsers without the API just get the plain `webkitdirectory` picker.

### 3c. Per-clip Source card

- Each clip's **Source** card → "Import / Replace File" → `replaceClipSource(clipId, files)`.
- Goes straight through the loader — no `runReimport` — but the same preservation rules apply.
- The video branch feeds a still-missing audio companion from the same file via `findAudioCompanion` (explicit link first, normalized-name fallback second), **without writing links**.

---

## 4. Window preservation (`loadAudioFileIntoClip`)

The loader (`loadAudioFileIntoClip`) swaps the decoded buffer + peaks + audio element into a clip. What happens to the window depends on which kind of clip it is:

```
if (clip._reimportRestore)   → REAL restored clip: PRESERVE the window
    sourceOffset clamped to [0, fileDur - 0.05]
    duration   clamped to [0.1, fileDur - sourceOffset]
    trimStart/trimEnd clamped to the new file's span
    reverse / fades / automation untouched
else                         → FRESH mock placeholder: take the FULL source
    duration   = whole file
    sourceOffset = 0
    trimStart/trimEnd/reverse deleted, reverse buffer un-baked
```

This is the core fix behind the split-preservation behavior: a split audio clip (`sourceOffset 7.66s, duration 75.24s`) comes back **split** after re-import, and a fresh mock audio clip still loads full-length.

The video/image branches in `replaceClipSource` likewise just swap `videoEl`/`imageEl`, keep `start`/`duration`/`sourceOffset`/`_mdKeepMockSize` (card-sized footprint for markdown mocks), and reset retry/give-up state.

---

## 5. Companion feed & summary

A video and its extracted audio track share one source file, so re-importing the video should restore the audio too — and vice versa.

### How the pair is found (`findAudioCompanion`)

1. **Explicit link**: `linkedClipIds` → first audio clip that still needs a file.
2. **Name fallback**: normalized names equal — `clip.mp4 (Audio)` ↔ `clip.mp4` — for legacy projects saved *before* linking existed (guarded to clips that still need a file: `isPlaceholder || _missingMedia`).

### The two-pass companion feed in `runReimport`

After the direct name pass, a companion pass feeds any **still-missing** partner, in both directions:
- matched **video** → feed its **audio** companion, and
- matched **audio** (only when the file is actually a video) → feed its **video**.

Candidate sources: explicit links **plus** normalized-name matches. A `linkedDone` guard prevents double-feeding across the internal feed (`replaceClipSource`'s `findAudioCompanion`) and the explicit companion pass.

### Summary accounting

A detection pass snapshots which clips were missing *before* the run, then counts any that got restored as companions, so the summary is accurate:

- `N files re-imported`
- `M audio track(s) linked from video` (or `M video linked from audio` for the reverse)
- `K unmatched (not in project)` in folder mode (no name list — a folder can hold many unrelated files)

### Links are never written during re-import

Re-import **restores media but preserves the saved link state**. A pair that was deliberately unlinked (right-click → Unlink) stays unlinked after re-import. New imports still create linked pairs at creation time; only re-import is read-only about links.

---

## 6. Serialization hygiene (why saves never break the canvas)

| Field | Why handled |
|---|---|
| `_mathLastGood`, `_mathLastExtrude`, `__vecLastSprite`, `_mathPreview` | Runtime caches holding `HTMLImageElement`/canvas refs. `JSON.stringify` turns them into `{}` — a truthy stub that used to crash `drawImage` mid-frame and leak the canvas transform ("canvas breaks in two halves"). Blacklisted from saves, stripped unconditionally in `restoreClip`, and guarded in the sprite builders (`nodeName !== 'IMG'/'CANVAS'`). |
| `sfx.data` | Embedded SFX *is* serialized (base64) so it round-trips; the decoded buffer is reconstructed on restore. |
| `linkedClipIds` | Stored verbatim — link state is user intent, not derived. |

Defense in depth: `drawCanvas` resets the transform (`setTransform`) before clearing every frame and wraps each clip's draw in try/catch, so a single bad clip logs an error instead of corrupting the frame.

---

## 7. Verified behavior (test matrix)

Test project: `_demo_assets/projects/studio-pro-project (3).json` — a video split in two halves, each with a split audio companion, **all unlinked** (user right-clicked → Unlink, then split the audio, then saved).

| Scenario | Result |
|---|---|
| Re-import single MP4 via modal file picker | All 4 clips restored; windows identical (video 7.52s / 75.38s@7.52, audio 7.66s / 75.24s@7.66); `linkedClipIds` empty (unlink respected) |
| Re-import via **folder pick** | Same — all 4 restored, windows intact, no links |
| Re-import via each clip's **Source card** | video1 restores + audio1 companion (7.66s, no link); video2 restores + audio2 companion (75.24s@7.66, no link); 0 missing |
| Fresh **mock** audio clip load | Still takes the full source duration (mock reset path unaffected) |
| Re-import video-only, companion by **name** (unlinked pair) | Audio auto-filled from the same file, `(Audio)` suffix title, pair stays unlinked |
| Re-import audio matched **first** | Video fed from the same file by name; pair stays unlinked |
| Folder contains non-media files | `project.json`/`.srt`/notes filtered out; never counted unmatched |
| Math clip in a saved project | Stubs stripped on restore; formula re-rasterizes; canvas unified |

---

## 8. Key functions (index.html)

| Function | Role |
|---|---|
| `serializeProject()` / `applyProject(data)` | JSON out / in; `applyProject` builds lanes before clips so the timeline renders immediately |
| `restoreClip(c)` | Rebuilds a clip from plain data; sets `isPlaceholder`/`_missingMedia`/`_reimportRestore`; strips runtime caches; re-decodes embedded SFX |
| `restoreAutosavedProject()` | `localStorage` autosave restore on load |
| `saveProjectToFile()` / `importProjectFile(input)` | Manual JSON download / upload |
| `showReimportModal()` / `hideReimportModal()` | Modal lifecycle; renders the "still missing" summary + Select More Files / Select Folder / last-folder button |
| `runReimport(files, opts)` | Shared core: name-matching (multi-match), direct pass, companion pass (both directions), summary, auto-hide when 0 missing |
| `replaceClipSource(clipId, files)` | Per-clip source swap (image/video/audio); video branch feeds its audio companion; never writes links |
| `loadAudioFileIntoClip(clip, file, url, opts)` | Buffer decode + peaks; **the** window-preservation decision point (`_reimportRestore` vs fresh mock) |
| `findAudioCompanion(videoClip)` | Explicit link first, normalized-name fallback second |
| `normFileName(name)` | Normalizes for matching — `(Audio)` suffix stripped *before* the extension |
| `pickReimportFolder()` / `lastReimportFolderBtnHtml()` | File System Access picker + IndexedDB-persisted handle + quick re-import button |

---

## 9. Constraints & future notes

- **Browser privacy**: the browser never exposes a JSON's originating folder path, so "remember last folder" is the closest equivalent — one pick (usually the JSON's folder) and everything matches.
- **Permission lifecycle**: an in-memory handle from a pick works immediately; the IndexedDB copy powers the button after reload. `requestPermission` runs inside the click handler (browsers require a user gesture).
- **Performance**: saves exclude media by design, so they're small and autosave is cheap; re-decoding embedded SFX on restore is the only heavier step and is async.
- **Tauri / desktop future**: the same JSON + re-import model maps cleanly to a native file dialog or a "media folder" project convention — see `docs/video/Cross-Platform-Tauri-MediaBunny-Plan.md`.
