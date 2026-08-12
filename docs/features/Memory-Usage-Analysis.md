# StudioPro Memory Usage — Analysis & Fix Plan

> Why the editor tab used **3.9 GB** of RAM in testing, what that means for
> performance, whether the deployed GitHub Pages site behaves the same, and a
> phased plan to bring it down.

---

## 1. TL;DR (the short version)

- A video editor in the browser is naturally memory-hungry — CapCut web,
  Clipchamp, and Figma all run at 1–4 GB. So some usage is **normal**.
- **But** StudioPro's 3.9 GB was higher than it needs to be. The two biggest
  avoidable causes were:
  1. **Decoded audio kept in RAM** — a 10-minute stereo song is ~220 MB once
     decoded. 16 tracks ≈ 1.2 GB at import time.
  2. **Autosave garbage churn** — every 2.5 seconds the app re-encodes every
     live audio buffer to WAV and re-serializes the whole project, even when
     nothing changed. This keeps the browser's memory "high-water mark" pinned
     high and causes the laggy-UI feeling.
- **The deployed GitHub Pages site uses the same memory.** Memory usage is
  driven by the data you load (audio + video), not by where the page is hosted.
- The fixes in Section 5 can realistically cut the audio portion ~8× and remove
  most of the autosave churn.

---

## 2. What was measured (the test session)

Chrome reported **"High memory usage: 3.9 GB"** for the StudioPro tab while:

- The **Audio Library** held **16 imported sounds** (~55 minutes of audio total,
  tracks up to 10:30 long).
- A **1080p video** was loaded in the canvas preview and playing.
- DevTools was attached to the tab.
- The project was autosaving every 2.5 seconds.

---

## 3. Where the memory actually goes (the breakdown)

### 3.1 Decoded audio — the biggest chunk (~1.2 GB at import peak)

**In simple terms:** when you import an audio file, the browser has to turn the
compressed file (mp3/aac) into raw sound waves the app can play. That raw form
("PCM") is stored as numbers — and it's *huge*.

- A **10-minute stereo track at 44.1 kHz** = ~**220 MB** of raw audio.
- Your 16 tracks totaled ~55 minutes → **≈1.17 GB** if all decoded at once.

**What the code does:**
- `AudioContext.decodeAudioData()` decodes at full quality (full sample rate,
  all channels, float32) — that's what makes a 10-min track ~220 MB.
- The import flow decodes **3 files at a time** (`CONCURRENCY = 3`) and only
  runs the memory cap (`AUDIO_LIB_MEM_CAP = 384 MB`) **after the whole batch
  finishes**. So the peak is hit during every folder import, no matter what.
- After the batch, an LRU eviction trims decoded buffers down to the 384 MB
  cap (keeping the selected sound). Evicted sounds re-decode on demand the
  next time you click them — which is why selecting a big sound can feel slow.

**The key fact:** 55 minutes of audio costs ~1.2 GB *just decoded*. Most of the
3.9 GB is audio, one way or another.

### 3.2 Autosave churn — the sneaky one (likely 1–2 GB of "invisible" memory)

**In simple terms:** the app saves your project automatically every 2.5
seconds. To save, it has to build a big text description of everything. But
right now it also **re-encodes every live audio buffer into a WAV file** as part
of that description — creating a ~100 MB temporary copy *every 2.5 seconds*,
even when you haven't changed anything.

**What the code does:**
- `setInterval(() => tryAutosaveProject(), 2500)` fires every 2.5 s.
- `tryAutosaveProject()` runs `JSON.stringify(serializeProject())` **first**,
  and only then checks whether the text changed (the signature comparison).
  So the expensive serialization runs every tick regardless.
- `libraryItemToJSON()` / `clipToJSON()` call `audioBufferToWavBytes(a.buffer)`
  for every item that has a live decoded buffer — allocating the full WAV
  bytes (tens to hundreds of MB) every single tick.

**Why this is so damaging:** the browser's JavaScript engine (V8) never fully
returns memory once it has grown. Constant big allocations make the heap's
"high-water mark" climb and stay. So even after you stop editing, the tab keeps
most of the memory it ever peaked at. This is likely the biggest *avoidable*
portion of the 3.9 GB.

### 3.3 The 1080p video playing in the preview (~300–600 MB)

**In simple terms:** playing a 1080p video means the browser keeps several full
frames in memory (each frame is ~8 MB of pixels) plus decoder buffers and GPU
textures. A playing 1080p clip typically costs 300–600 MB.

### 3.4 Everything else (a few hundred MB, normal)

- The preview canvas + offscreen canvases (waveforms, thumbnails).
- The DOM: timeline clips, 16 audio rows, ~1,000 SVG icons.
- The JavaScript state (project data, embedded base64 strings).
- Chrome's process overhead + DevTools attached to the tab.

### Rough total for the test session

| Source | Rough size |
|---|---|
| Decoded audio (peak, then capped) | ~0.4–1.2 GB |
| Autosave churn / V8 heap that never returns | ~1–2 GB |
| 1080p video decode + GPU | ~0.3–0.6 GB |
| Canvas, DOM, state, process overhead | ~0.2–0.5 GB |
| **Total** | **≈ 2.5–4 GB** (matches the 3.9 GB reading) |

---

## 4. What this means for performance

- **Laggy UI.** With a multi-GB heap, the browser's garbage collector pauses
  the page for 50–200 ms at a time. This is the "selecting audio files feels
  slow" experience — the app isn't doing more work, the *collector* is.
- **Scrub/scroll jank.** Same cause — pauses mid-scrub.
- **Tab crash risk.** Chrome kills tabs that grow past ~4 GB, especially on
  8 GB machines. Your other tabs get evicted first.
- **Battery drain** on laptops (constant GC + decode work).
- **Everything above gets worse** the more audio you import — memory grows
  roughly linearly with total audio minutes.

---

## 5. Will the deployed GitHub Pages site use the same memory?

**Yes.** The deployed site runs the exact same code. Memory usage is driven by
**what data you load**, not by where the page is hosted:

- A fresh, empty project on the deployed site: ~150 MB. Light.
- Import the same 16 sounds + the 1080p clip on the deployed site: **the same
  multi-GB usage** as localhost.

So if you want to *verify* a memory fix, test on the deployed page too — the
numbers will match.

---

## 6. Is this normal? What other sites use this much?

Chrome shows the "High memory usage" warning on any tab above roughly 1.5 GB.
Sites that commonly run this heavy:

- **Browser video editors** — CapCut web, Microsoft Clipchamp, Descript,
  WeVideo: typically 1–4 GB.
- **Design tools** — Figma on big files: 1–3 GB.
- **3D / games** — Sketchfab, Spline, cloud gaming, browser games: 1–4 GB.
- **Maps** — Google Maps with heavy use: 0.5–1.5 GB.
- **Big documents** — large Google Docs/Sheets, heavy Gmail sessions: 0.5–2 GB.

**Conclusion:** 3.9 GB is on the high side but *within the normal range* for a
video editor with 55 minutes of audio loaded. The goal isn't to make it tiny —
it's to avoid the *avoidable* parts (audio peak + autosave churn).

---

## 7. Bonus finding — "13 sounds need re-import"

While investigating, we found why big imported sounds show **"need re-import"**
after refreshing:

- The project JSON can only **embed small sounds** (≤ **800 KB** of WAV, the
  `SFX_EMBED_MAX` cap). A music track is multi-MB, so it **cannot** be embedded.
- Those big sounds save as `sfxMissing` and, after a page refresh (no live file
  anymore), must be re-imported from disk. This is *by design* and documented in
  `Audio-Library-Reimport-Plan.md`, but it means big imports never survive a
  reload.

This is a **usability** issue, not a memory issue — listed here because it shows
up in the same screenshots. Fixing it (e.g. storing audio in IndexedDB instead
of the project JSON) is a separate feature from the memory fixes below.

---

## 8. The fix plan (in simple terms, cheapest first)

### Phase 1 — Stop the autosave churn (biggest win, smallest effort)

**Problem:** every 2.5 s the app re-encodes live audio buffers to WAV and
re-serializes the whole project, even when nothing changed.

**Fix:**
- **Cache the encoded WAV** per audio item (encode once, reuse until the buffer
  changes). No more 100 MB transient allocation every tick.
- **Check a cheap "did anything change?" signature before serializing**, or
  serialize only when a dirty flag is set — skip the whole stringify when the
  project is idle.
- **Expected result:** removes most of the 1–2 GB of V8 heap slack and the
  GC pauses. This is the fix that makes the UI feel smooth again.

### Phase 2 — Decode preview audio at reduced quality (8× smaller)

**Problem:** 55 minutes of full-rate audio ≈ 1.2 GB.

**Fix:** decode the audio-library buffers for **preview** at a reduced rate
(mono, 22.05 kHz) — that's ~**8× smaller** (~150 MB for the same library).
Trim, waveform, and preview playback all work fine at that quality. Decode at
**full rate only during export** (the export already runs its own offline
render), so exported audio keeps full quality.

**Expected result:** audio portion drops from ~1.2 GB peak to ~150 MB.

### Phase 3 — Evict during import, not after

**Problem:** the import decodes the whole batch before the 384 MB cap kicks in.

**Fix:** run the LRU eviction **after each file** (or every couple of files)
inside the import loop instead of once at the end. The cap holds the whole
time, so the peak never spikes to 1.2 GB.

**Expected result:** import peak ≈ 384 MB instead of ~1.2 GB.

### Phase 4 (future / bigger) — Move audio persistence to IndexedDB

**Problem:** the project JSON can only embed small sounds (800 KB cap), which
is why big tracks "need re-import" after refresh.

**Fix:** store audio blobs in **IndexedDB** (like the remembered-folder handles
already are) instead of base64 inside localStorage. This also removes the
base64 string copies from every serialization.

**Expected result:** big sounds survive a refresh, and the project JSON stays
small.

### Phase 5 (optional) — Lower the video preview cost

**Problem:** a playing 1080p video costs 300–600 MB.

**Fix options:** cap the preview decode resolution, or pause/unload the video
element's decode buffers when the tab is hidden or the clip isn't on screen.

**Expected result:** 200–400 MB saved while not actively watching the preview.

---

## 9. How we'll know it worked (acceptance checks)

| Check | Before | After (target) |
|---|---|---|
| Tab memory with the 16-sound test project | 3.9 GB | ≤ ~2 GB |
| Selecting audio in a 250-item library | ~200 ms (GC pauses) | < 20 ms, no jank |
| Folder import of 16 big files (peak) | ~1.2 GB spike | ≤ ~400 MB |
| Memory while idle (no editing) | stays high | returns to baseline |
| Exported audio quality | full | unchanged (full rate at export) |

---

## 10. Out of scope (not part of this plan)

- Preset / export / captions memory (not measured as problems).
- The "big sounds need re-import" UX redesign (that's Phase 4's IndexedDB
  work, tracked separately in `Audio-Library-Reimport-Plan.md`).
