# Phase 2 — "Prefetch" Explained Simply

> A plain-language companion to **Phase 2** in `docs/video/Video-Preview-Fast-Loading-Plan.md`.
> What it does, why it matters, and how much code it touches.

## 1. The problem, in one sentence

Today the video player only *starts loading a clip's picture* when the playhead is
**already inside** that clip — so when you land on a clip, its first frame takes a
moment to appear, and long scrub-drags ask the decoder for hundreds of frames it
has to catch up on.

## 2. What "prefetch" means (the idea)

**Prefetch = start loading the next thing *before* you need it.**

Think of a coffee shop: you don't want to start grinding beans after the customer
reaches the counter. You grind *ahead* so the coffee is ready when they arrive.
Phase 2 does the same for video frames:

- **Look-ahead while paused (2.1).** Even when you're *not* playing — just moving
  the playhead — if a clip starts within ~1.5–2 s ahead of the playhead, the editor
  pre-warms that clip's video element (loads its first frame) in the background.
  By the time you actually reach the clip, its picture is already there.

- **Forward pre-seek inside a clip (2.2).** When you're sitting *inside* a clip,
  after showing the exact frame you asked for, the editor also silently asks the
  element for a frame ~0.5 s *further ahead*. So the very next frame you need is
  already in the buffer, not just the one under the playhead.

  ⚠️ **Design constraint (from the seek-accuracy work):** a single `<video>`
  element has one `currentTime`, so the +0.5 s pre-seek would become the
  *displayed* frame (latest-wins coalescing) — the preview would sit ahead of the
  playhead. Two options when implementing:
  - **Option A (simplest):** apply 2.2 only to *upcoming* clips (before the
    playhead enters them), not the clip under the playhead — i.e. merge 2.2 into
    2.1 and drop the in-clip forward seek.
  - **Option B:** use a hidden second `<video>` element per clip as the prefetch
    buffer (seek *it* +0.5 s ahead), leaving the visible element on the exact
    frame. More memory, more plumbing — probably not worth it pre-WebCodecs.

- **Coalesce scrubs (2.3).** During a drag, the mouse fires many "moved" events
  per second. Currently the editor issues a video seek on *every* one — a seek
  storm. Instead, it only seeks when the playhead has actually moved ≥ ~0.15 s
  (and does a final exact seek on release). Fewer, bigger seeks = less decoder
  thrash, snappier preview.

- **Smarter "frame ready" signal (2.4).** Where supported, use
  `requestVideoFrameCallback` instead of guessing with a timeout — the browser
  literally tells you "this exact frame is ready to paint," so previews land at
  the right time instead of one frame late. (This is a nice-to-have layer on top
  of the others; the timeout fallback stays.)

## 3. What it benefits

| Situation today | After Phase 2 |
|---|---|
| Land on a clip → blank/"Loading…" beat before the picture | Frame already warming while playhead approaches → near-instant |
| Long scrub drag → stutters, decoder churns through every pixel | Seeks batched into meaningful steps → smooth drag |
| J/L or click jumps between clips → each new clip loads from scratch | Neighboring clips pre-warmed → jump lands on a ready frame |
| (Combined with Phase 1) first frame never gets wiped | Same guarantee, now *ahead* of the playhead too |

It does **not** change how audio works, how export works, or the overall look of
the UI. It's invisible plumbing that makes video previews feel instant.

## 4. How much change — small and low-risk

All work is inside three existing functions in `index.html` — no new files, no new
dependencies, no UI changes:

| Piece | Where | Rough size |
|---|---|---|
| 2.1 look-ahead while paused | `syncMediaElements` `isUpcoming` branch (~20410) | ~5 lines (widen the condition to `!State.isPlaying` + 1.5–2 s window) |
| 2.2 forward pre-seek | `syncMediaElements` paused branch (~20644) | ~6 lines; **Option A** (merge into 2.1, no in-clip seek) is the recommended starting point |
| 2.3 coalesce scrubs | ruler drag handler `updateTimeFromMouse` (~19115/19286) | ~10 lines (accumulate delta, seek on threshold + pointerup) |
| 2.4 rvfc readiness | `drawWhenFrameReady` (~20295) | ~6 lines (prefer `requestVideoFrameCallback`, keep timeout) |

**Estimate: ~25–30 lines changed across 3–4 call sites.** Each piece is
independent and can be shipped/rolled back on its own. The risk is low because it
reuses the seek machinery that Phase A–C of `Video-Seek-Accuracy-Plan.md` just
hardened (coalescing + repaint-on-seeked already prevents the dropped-seek and
stale-frame bugs this could otherwise introduce).

## 5. How we'll know it worked

Reuse the measurement harness from `Video-Preview-Fast-Loading-Plan.md` §3.5:

- **Look-ahead:** place the playhead 1.5 s before a clip, wait 300 ms, then check
  the clip's `videoEl.readyState` — should be ≥ 2 *before* the playhead enters it.
- **Forward pre-seek:** inside a clip, read `videoEl.currentTime` — should be
  ~0.5 s *ahead* of the playhead's exact frame.
- **Scrub coalescing:** instrument `seekMediaEl` call count during a 3 s drag —
  should drop from dozens to a handful.
