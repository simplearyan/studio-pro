# Video Scrub Recovery — How We Fixed the Stuck "Restoring…" Loop

**Scope:** the demo file `We are making a feature film!_1080p.mp4` (and similar
third-party-downloaded videos) gets stuck on one frame after scrubbing, with the
console flooding `[video-error] … code= 3` (MEDIA_ERR_DECODE) clusters.

**Status:** implemented and verified live in `index.html`.

---

## 1. Why the file is broken (the root cause)

The video's H.264 stream is **structurally damaged**: cheap third-party downloader
tools (vidssave / vd6s style sites) re-mux the stream and destroy parts of the
frame-reference chain (corrupt GOPs — groups of frames that reference each other).
A decoder cannot paint a frame whose referenced keyframes are missing.

- Chrome's **hardware decoder treats this as fatal** → `code= 3` on seek into the
  corrupt region, the video element enters error state.
- Software decoders (ffmpeg, the preview webview's decoder) **skip-and-recover** —
  they tolerate the damage, which is why the same file plays clean in other contexts.

So this is **not an editor bug**: any strict decoder hits the same wall. But the
editor *was* making it much worse (see §2).

## 2. What the editor was doing wrong (three compounding bugs)

The recovery code had three flaws that turned one decode error into an endless loop:

1. **The error zone was anchored to the drifting element, not the playhead.**
   The element plays forward through a corrupt region and errors at each advancing
   position (`errT= 23.62 → 24.58 → 24.74`). Each new error position was treated as
   a "different zone", which **reset the give-up counters** — so the give-up
   (which stops retrying) never fired.

2. **A "parked > 400 ms ⇒ wake recovery" reset ran while the user was still parked
   on the broken spot.** It cleared the give-up and recreated the element every
   half-second; each fresh element was re-seeked straight onto the corrupt GOP and
   errored again — the error clusters in the console.

3. **The cooldown retry fired even while the playhead was parked in the same zone.**
   It recreated the element and re-seeked it into the exact broken region that just
   failed — instant re-error, loop forever.

## 3. The fix (all in `index.html`)

### 3.1 Zone anchored to the playhead — give-up actually sticks

The corrupt zone is now anchored to `clipSourcePos(playhead)` on the first error and
**never re-anchored to the drifting element position**. Forward-play errors inside
the same region accumulate on the same zone counter, so after 2 errors within 1.5 s
the zone gives up (`_videoGiveUp`) and stops recreating. Moving the playhead away
(> 1.2 s from the zone) resets it for a fresh attempt.

### 3.2 Removed the scrub-idle spam reset

The `parked > 400 ms ⇒ resetVideoRetryIntent` path is gone. Recovery is now driven
only by:

- **Moving the playhead to a different zone** → recreates immediately at the new
  (clean) position, or
- **Pressing play** → `togglePlay` calls `resetVideoRetryIntent`, which now also
  recreates the element immediately (landing at the safe position and playing
  forward).

### 3.3 Zone-gated cooldown retry

The cooldown re-attempt only fires when the playhead has moved > 0.6 s away from the
recorded error zone. Parked on a broken spot = no recreation, no error spam.

### 3.4 Forward-play recovery (the actual "restore")

A recreated element is marked `_videoRecovering` and the corrupt-region gate lets it
**play forward through the damage once** instead of holding it frozen at the safe
position. When the stream is decodable (as in the software-decoding preview
webview), the element crosses the broken GOP and the video visibly restores. If it
re-errors mid-crossing, the zone give-up (3.1) freezes the last-good frame cleanly.

### 3.5 Honest status chip

- **"Restoring…"** while retries are in flight.
- **"Video unavailable — move playhead or press play"** once a zone gives up, so the
  frozen state reads as intentional and tells the user how to recover.

### 3.6 Last-good-frame freeze

`clip._lastGoodFrame` caches the last successfully painted frame; while the element
is missing/erroring, `drawCanvas` draws the frozen frame with the same
crop/fit/transform instead of flashing the mock placeholder.

## 4. What was verified live

- Parked on a broken spot → give-up fires, element dropped, **no recreation and no
  error spam while parked**.
- Scrubbing to a clean position → immediate recreation, element decodes clean
  (`readyState= 4`, no error).
- Pressing play after give-up → immediate recreation at the safe position, marked
  recovering, plays forward.
- Real-file forward-play through both known corrupt zones (≈15–20 s, ≈25–31 s)
  completes without error on the software-decoding preview webview.

## 5. The honest limit (important)

The editor can now **dodge and hide** the damage, but it cannot make a strict
hardware decoder decode a structurally broken GOP. On machines where even a clean
forward-play attempt fails, the video freezes on the last good frame with the chip —
that is the best in-browser behavior possible. Making the *file* playable requires
repairing it: re-encode with ffmpeg (native sidecar or `ffmpeg.wasm` — the "C2"
option in `docs/Damaged-Video-Scrub-Solutions-Explained.md`), or re-downloading it
with a proper tool.

## 6. Files

- `index.html` — the recovery logic (all of §3).
- `docs/Damaged-Video-Scrub-Solutions-Explained.md` — full options analysis, updated
  with the implementation status (§3.5).
- This file — the how-we-fixed-it write-up.
