# Export First-Frame Shows "MOCK VIDEO" Card — Analysis & Fix Plan

## 1. Problem statement

A user imported a video from `_demo_assets/videos` ("Blend Modes Explained in 49 Seconds.mp4"),
scrubbed it, added a shape clip, and exported to `_exports/StudioPro_Export_MediaBunny6556.mp4`.
The **first frame of the exported file shows the editor's themed "MOCK VIDEO" placeholder card**
instead of the actual first video frame. Later frames are correct.

## 2. Evidence (measured from the actual export)

Probed with ffmpeg/ffprobe (the file is still in `_exports/`):

| Metric | Value |
|---|---|
| Container | MP4, H.264 + AAC |
| Resolution / fps | 1920×1080 @ 24 fps |
| Frames / duration | 1440 frames / 60.01 s |
| Size | 39.6 MB |

Frame-sampled average RGB (1×1 scale) and spot pixels:

| Timestamp | Avg RGB | Corner (TL/BR) | Center (960,540) | Verdict |
|---|---|---|---|---|
| t = 0.000 s (frame 1) | (60, 65, 64) | (35, 30, 32) dark | **(185, 246, 207) mint pastel** | MOCK card on dark bg |
| t = 0.100 s | (27, 25, 30) | — | — | real video (dark scene) |
| t = 0.500 s | (25, 23, 27) | — | — | real video |
| t = 2.000 s | (130, 131, 111) | — | — | real video (brighter scene) |
| t = 10.00 s | (23, 16, 13) | — | — | real video |

The mint center pixel is the **themed mock card's pastel palette fill** (`pal.bg`). The mock card is
drawn at a fixed `MD_MOCK_W × MD_MOCK_H = 640 × 360` (index.html:14650), so the dark surroundings
are the canvas background. Only **frame 1** is mocked in this export; frames from ~t=0.1 s onward
show real content.

## 3. Root cause (code trace)

### 3.1 The draw gate

`drawCanvas` (index.html:5100) draws the MOCK VIDEO card for a video clip when:

```js
clip.type === 'video' && (
    !clip.videoEl ||
    (clip.videoEl.readyState < 2 && !(clip.videoEl._mdLoaded || clip.videoEl._frameReady))
)
```

So the mock is the **honest placeholder**: shown whenever the video element has no decodable
frame yet (`readyState < 2` = below HAVE_CURRENT_DATA) and the `_frameReady` latch is not set.

### 3.2 The export swaps in fresh video elements that never get latched

`startMediaBunnyExport` (index.html:22480+) creates **brand-new** `<video>` elements for every
overlapping video clip, swaps them into `clip.videoEl`, and waits only for:

1. `onloadedmetadata` → readyState = 1 (HAVE_METADATA, **no frame decoded yet**)
2. initial seek to `clipSourcePos(clip, clipStartInExport - clip.start)` → `onseeked`

Nothing calls `armVideoFrameLatch(el)` (index.html:21095) on these fresh elements, so
`el._frameReady` stays `undefined`. The gate therefore only clears once the element **naturally**
reaches readyState ≥ 2 during real-time playback.

### 3.3 The capture races playback

`realtimeExportLoop` (index.html:22720) is started **16 ms** after the seeks settle. In its very
first iteration:

1. `frameElapsed = 0` → `State.currentTime = startTime` → frame 0 is the next target.
2. Staggered playback fires for the first time: `entry.el.currentTime = …` then `el.play()`.
3. `drawCanvas(exportCtx, exportW, exportH)` runs **in the same tick** — milliseconds before the
   just-started video can decode and paint its first frame → `readyState` is still 1 → **MOCK VIDEO card captured as frame 0**.

### 3.4 Why the mock is usually just one frame

After `play()` kicks in, the video decodes its first frame within ~1-2 loop iterations (40-80 ms),
readyState climbs to ≥ 2, and the gate clears — so only the very first frame(s) are affected in
normal (wall-clock paced) mode.

**Worse cases the same bug hits:**
- **Every video clip boundary** — the stagger calls `el.play()` and captures in the same
  iteration, so the first frame overlapping *each* video clip is at risk.
- **Fast export mode** (`State.exportFastMode`, 2 ms per frame) — the export outruns real-time
  playback; frames between the playhead and the video's real-time position can be mocked or stale.

## 4. Fix plan

### Phase A — Wait for a decodable frame before the loop starts (primary fix)

Replace the "wait for `onseeked`" block (index.html:22540ish, `seekWaits`) with a wait for a
**decodable frame**: readyState ≥ 2 **and** `videoWidth > 0`. Reuse the existing
`drawWhenFrameReady` / `armVideoFrameLatch` pattern (index.html:21107-21150) — it already
implements exactly this (event listeners + 16 ms readyState poll + bounded 400 ms fallback).

Concretely, add a small `awaitVideoFrame(el)` helper (Promise wrapper) and await it for every
export element *before* `worker.postMessage({ type: 'start' })` and before the loop launches.
This guarantees frame 0 (and the first frame of every clip) draws a real decoded frame.

### Phase B — Latch the fresh export elements (defensive)

Call `armVideoFrameLatch(el)` on each fresh export element right after `onloadedmetadata`.
This sets `el._frameReady = true` the moment the first frame decodes, so the drawCanvas gate
clears immediately even if the loop catches the element mid-load. It also keeps the live
preview's swap-in element consistent with the latch contract the gate expects.

### Phase C — Boundary-safe capture in the stagger loop (defensive)

In `realtimeExportLoop`, when a clip's playback starts at its timeline boundary (the
`entry.el.paused` branch), do **not** capture the frame in the same iteration if that element
isn't ready yet. Instead:

- Track a `pendingReady` set for elements whose `play()` just fired.
- When all elements overlapping the current `exportTime` are ready (or a bounded ~250-500 ms
  grace timeout passes), capture. Never draw the mock into the export: if the grace expires,
  capture the element's last decoded frame rather than the placeholder.

This also covers the fast-mode case (frames captured ahead of real-time playback) by holding the
capture until the video catches up.

### Phase D — Verification

1. **Re-export the same project** (Blend Modes video + shape clip, same range) and ffprobe frame 0:
   - Assert the center pixel is no longer a pastel card color, and frame 0's avg closely matches
     frame 1's avg (same scene).
2. **Boundary test:** move the video clip to start at t = 5 s, export, and assert no mock at the
   clip's first overlapping frame.
3. **Fast mode:** enable `State.exportFastMode`, export, and scan a few frames inside the clip for
   mock/stale frames.
4. **Manual sanity:** play the exported file in a player; first frame should be the actual content.
5. Confirm the mock card **still shows in the live editor** while a video is genuinely loading
   (the placeholder is desirable there — the fix must not suppress it for preview).

## 5. Notes / open questions

- **Other export paths:** the realtime/captureStream export path (if still present) also calls
  `drawCanvas`; check whether it has the same readiness race and apply the same wait if so.
- **No mock suppression during live preview:** the fix waits *before* capture; it should not
  change the placeholder behavior in the editor canvas.
- **Why only frame 1 mocked in this export:** normal mode's wall-clock pacing lets the video
  catch up almost immediately; the plan treats the general boundary case so it stays fixed for
  mid-timeline clips and fast mode too.
