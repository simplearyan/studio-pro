# Audio Import Performance

How the Audio Library imports files, why large folders used to be slow,
what was fixed, and the options for moving decode off the main thread.

## The pipeline

When files are imported (single picker or **Folder** import), each one goes
through four steps:

1. **Read** — `file.arrayBuffer()` pulls the whole file into memory.
2. **Decode** — `AudioContext.decodeAudioData()` turns the bytes into PCM.
   For video files (mp4/mkv/…) this also extracts the audio track.
3. **Peaks** — a 200-point waveform is computed from channel 0.
4. **Push** — the item lands in `State.audioLibrary` (file, buffer, peaks,
   duration, group) and the UI re-renders.

## Why large folders were slow (fixed)

| Cause | Cost | Fix |
|---|---|---|
| **Images processed** — the folder picker ignores the input's `accept`, so `.jpg` thumbnails were selected too; each was read and handed to `decodeAudioData` (which failed). | Wasted reads + console "Skipped non-audio file" noise | `isImportableAudioFile()` filters by MIME type + extension **before any read** — images never enter the pipeline |
| **Strictly sequential** — files decoded one after another in a `for…await` loop. | 14 files with several 5–10 min tracks serialized; each big decode is hundreds of ms | Bounded concurrency pool (`CONCURRENCY = 3`) so decodes overlap |
| **Full-sample peak scan** — the waveform loop iterated *every* sample (10-min track ≈ 26M floats). | ~100–300 ms per long file just to draw 200 bars | `computePeaks()` stride-subsamples (≤ ~200×256 samples scanned); a 10-min track now computes peaks in ~5 ms |
| **UI froze until the end** — one re-render after the whole folder. | No feedback during long imports | Re-render every 4 files so the list grows live |

Measured after the fix: a 7-file folder imports in ~180 ms; a simulated
10-min channel computes peaks in ~5 ms with zero image warnings.

## Can decode move to a Web Worker?

**Not the decode itself — not with current browsers.** `AudioContext` and
`OfflineAudioContext` are main-thread-only APIs; there is no in-browser way
to run `decodeAudioData` in a Worker. The main thread will always own audio
decoding (and therefore the "extract audio from video" step).

What *can* move to a worker today: the other O(n) work — peak computation,
WAV encoding (`audioBufferToWavBytes`), and base64 conversion. After the
stride-peaks fix this work is negligible, so a worker would add little for
imports specifically.

## Future option: ffmpeg.wasm in a worker

If background decoding (or decoding formats `decodeAudioData` can't handle)
becomes a priority, the real path is a WASM decoder:

- **ffmpeg.wasm** (`@ffmpeg/ffmpeg` + `@ffmpeg/core`) runs entirely in a
  Web Worker — decode/transcode video audio off the main thread, and it
  handles far more codecs/containers than the browser decoder (it also
  fixes the occasional mp4 that `decodeAudioData` rejects, e.g. the BBC
  Hindi files that currently fail).
- **Costs to plan for:** ~25–30 MB wasm download (cacheable, can be
  lazy-loaded only when needed), slower *per-file* decode than native
  Chrome codecs, and copy overhead transferring PCM back to the main
  thread (use `Transferable`/`SharedArrayBuffer` to avoid copies).
- **Hybrid:** keep `decodeAudioData` as the fast path; fall back to
  ffmpeg.wasm only when native decode throws.

## Implementation notes

- `importAudioFilesIntoLibrary(files, group)` owns the pool + filter;
  `handleAudioLibraryImport` (single files) and
  `handleAudioLibraryFolderImport` (folder, groups by top-level folder
  name) both route through it.
- `computePeaks(channelData, 200)` lives beside it and is shared with the
  restore path (persisted peaks), so both stay consistent.
