# Studio Lite — test media

**What this is for.** The canonical local video files to drive Studio Lite (and the
[`clip-lite-mock.html`](clip-lite-mock.html) reference prototype) against real media instead of
hand-built fakes. Use these — not ad-hoc stubs — so a bug found in one session reproduces in the next.

**Not committed.** `_demo_assets/` is gitignored ([`.gitignore:24`](../../.gitignore)), so these paths
exist only on the author's machine. Everything below is either a fact about the file (checkable with
`ffprobe`) or a fact about the mock (checkable in the browser).

**Where the mock is hosted.** Every page in this folder ships to GitHub Pages via the
`docs/studio-lite/*.html` glob in [`vite.config.js`](../../vite.config.js) — a new page needs no build
change. The folder has a directory index, so the bare URL works:

```
https://simplearyan.github.io/studio-pro/docs/studio-lite/                  ← index of the prototypes
https://simplearyan.github.io/studio-pro/docs/studio-lite/clip-lite-mock.html
```

**The assets above are NOT on Pages** — `_demo_assets/` is gitignored and therefore not in the
artifact. Use the deployed URL for **touch, real-device and font-layout testing** (paste a video from
the phone's own library), and `npm run dev` for anything that needs these exact two files.

---

## 1. The two assets

Both live in `_demo_assets/videos/` in this repo. Absolute paths, for copy-paste:

```
D:\Code\Antigravity\design_concepts\studios\studio-pro-editor\_demo_assets\videos\StudioPro_Export_MediaBunny - 2026-09-30T120521.213.mp4
D:\Code\Antigravity\design_concepts\studios\studio-pro-editor\_demo_assets\videos\StudioPro_Export_MediaBunny - 2026-09-30T083512.088.mp4
```

| | **A — `…T120521.213`** | **B — `…T083512.088`** |
|---|---|---|
| shape | **1080×1920 — portrait 9:16** | **1920×1080 — landscape 16:9** |
| duration | **20.01s** | **10.00s** |
| frame rate | 30/1 | 30/1 |
| video codec | h264 | h264 |
| audio | **aac** (stereo) | **none — no audio stream** |
| size | 26.7 MB (26,665,694 B) | 3.4 MB (3,441,011 B) |
| bitrate | 10.7 Mb/s | 2.75 Mb/s |

Re-measure any time with:

```bash
ffprobe -v error -show_entries format=duration,size,bit_rate \
  -show_entries stream=codec_name,width,height,r_frame_rate,codec_type \
  -of default=noprint_wrappers=1 "_demo_assets/videos/<file>.mp4"
```

**Why these two, and not one.** They are a deliberate pair — A is the portrait-with-audio case the
whole phone editor is designed around (it is the clip in the author's own screenshots), and B is the
two things A is not: **landscape**, and **silent**. Together they cover the branches that fake media
keeps missing: the aspect-ratio auto-detect on first import, the timeline's per-clip waveform, and the
no-audio path (which must render an empty lane rather than throw).

### What each one is for

| Test | Use | Expected |
|---|---|---|
| first-import aspect auto-detect (portrait) | **A** | `proj.ar === '9:16'` |
| first-import aspect auto-detect (landscape) | **B alone, after a reload** | `proj.ar === '16:9'` |
| filmstrip generation | **A** | 11 thumbnails (1 per 2s of a 20s clip, capped at 120) |
| waveform | **A** | ~501 peaks (25/second) in the audio lane |
| **no-audio clip** | **B** | 0 peaks — the waveform lane renders empty, no exception |
| multi-clip timeline | **A then B** | 2 filmstrips, 2 waveform lanes, **1 transition junction**, total **30.01s** |
| aspect locked after first import | **A then B** | ratio stays `9:16`; only the *first* import sets it |
| playback + film scroll | either | `t` advances in real time and `tl.scrollLeft` tracks the playhead |
| export | either | `MediaRecorder` over `captureStream`, mp4 if the browser supports `avc1` |

---

## 2. Loading them into the mock

The mock has no bundled sample — as a real app it expects the user to pick a file. For a scripted
test, feed its own `addFile()` instead of driving the hidden `<input type=file>` (which needs a real
user gesture). The Vite dev server serves the folder, so `fetch()` reaches it; **URL-encode the
spaces**.

```js
// in the page's console, with the dev server on :3000
const U = '/_demo_assets/videos/';
const name = 'StudioPro_Export_MediaBunny - 2026-09-30T120521.213.mp4';
const blob = await (await fetch(U + encodeURIComponent(name))).blob();
addFile(new File([blob], name, { type: 'video/mp4' }));
await new Promise(r => setTimeout(r, 2500));   // filmstrip + waveform are async
```

Verified: `GET /_demo_assets/videos/…` answers **HTTP 206, `video/mp4`** on the dev server, and the
snippet above produces the expected thumbnails/peaks in the table. `addFile` is a top-level `function`
in the mock's inline script, so it is reachable by name from the console like the rest of its state.

**Manual path:** tap the **⊕** (or the empty-state "Add video" pill) and pick the file. `addFile` runs
once per selected file and `multiple` is set, so both assets can be added in one go.

---

## 3. Traps worth not re-learning

- **Never stub a video element with a `<canvas>`.** The prototype's `pause()` calls `s.v.pause()` on
  every source unconditionally, and `activate()` calls `play()`. A canvas has neither, so the first
  clip added throws — and because the mock's render loop is `requestAnimationFrame(loop)` with `draw()`
  inside it, **one throw kills the loop for the rest of the page's life**: the timeline silently
  freezes with no error on screen. If a stub is unavoidable, give it `readyState`, `videoWidth`,
  `videoHeight`, a writable `currentTime`, and `play`/`pause`/`load` no-ops.
- **Assign sources before clips** when injecting state by hand. `draw()` reads `srcs[c.src].v` on the
  first frame after a clip exists.
- **Thumbnails and peaks are asynchronous.** `thumbs()` seeks the video frame by frame; a 20s clip
  takes a couple of seconds. Assert after a delay, not immediately after `addFile()`.
- **`peaks()` bails on files over 200 MB** (`if(f.size>2e8)return`). Both assets are well under, but a
  long screen recording will produce an empty waveform lane for a legitimate reason.
- **The dev server must be serving the whole workspace** for these URLs to resolve. `_demo_assets/`
  is under the Vite root, so `npm run dev` (default :3000) is enough; a single-file page server that
  serves only `docs/` will 404 them.

---

## 4. Pass checklist

Against the mock at a phone viewport (320 / 366 / 390), after loading **A then B**:

- [ ] preview is portrait, ratio `9:16`, no letterbox bars
- [ ] filmstrip thumbnails are visible in the video lane and scroll with the film
- [ ] the audio lane shows a waveform for **A** and is **empty** for **B**
- [ ] one transition junction sits between the two clips
- [ ] readout reads `00:00 / 00:30` at rest
- [ ] play advances the playhead and scrolls the film; pause stops both
- [ ] splitting, trimming and reordering each produce exactly one undo entry
- [ ] console is empty throughout

**Known-good baseline (measured 2026-10-02, 366×836):** A → `proj.ar 9:16`, 11 thumbs, 501 peaks,
`00:00 / 00:20`. A+B → 2 clips, total `30.01`, 2 filmstrips, 2 waveform lanes, 1 junction, playback
`t` 0 → 0.87s over 900ms.
