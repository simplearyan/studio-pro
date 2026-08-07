# Video Seek Accuracy — Root Cause Analysis & Fix Plan

> **Status:** ✅ **Implemented (Phases A–C) and verified live** — see §5.4 for
> after-numbers. No commit yet.
> **Symptoms reported (intermittent, not every time):**
> 1. **J / L shortcuts** sometimes need a *second* press before the correct frame appears.
> 2. **Mouse click-to-seek** on the ruler sometimes shows a *different* frame — but
>    **drag**-seeking usually converges, and **splitting the clip always loads the correct frame**.
> 3. Happens with already-imported, fully-loaded clips — not just fresh imports.

---

## 1. The one-line summary

The editor has **two different video-seek code paths with different guarantees**:

| Path | Used by | Waits for a decoded frame? |
|---|---|---|
| `drawWhenFrameReady()` (~20295) | split, duplicate, import | ✅ Yes (polls `readyState ≥ 2 && videoWidth > 0`, listens `seeked`/`loadeddata`, 16 ms poll + 400 ms fallback) |
| `seekMediaEl()` (~20384) | J/L, `,`/`.`, ruler click & drag, playback sync | ❌ **No** — fire-and-forget `currentTime` set, immediate `drawCanvas()` |

Splitting *always* shows the right frame because split uses the **waiting** path.
Every other seek uses the **fire-and-forget** path — and that path has two latent
bugs that explain both symptoms.

---

## 2. Root cause A — overlapping seeks are silently dropped (`el.seeking` guard)

```js
// seekMediaEl, ~20412
if (!el.seeking && Math.abs(el.currentTime - targetTime) > thresh) {
    try { el.currentTime = targetTime; } catch (_) {}
}
```

Setting `videoEl.currentTime` is **async**: the element flips `el.seeking = true`
and only fires `seeked` once the frame is actually decoded. While `el.seeking`
is true, the guard above **bails out and drops the new seek entirely**.

**J/L symptom:** press **L** → `currentTime = T1` (element starts seeking) →
press **L** again quickly → `el.seeking` is still `true` → the seek to `T2` is
**skipped**, `State.currentTime` moves to `T2`, but the `<video>` element stays
at `T1` (or its previous frame). The canvas keeps drawing the stale frame until
the *next* press finally lands after `seeked` fired — "I had to press twice".

This is inherently **intermittent**: it only triggers when a second seek arrives
inside the decode window (~tens of ms, longer for slow sources / far seeks).

**Related threshold bug:** the default `thresh = 0.1 s`. The `,` / `.` keys seek
by **1/30 s ≈ 0.033 s** — *below the threshold*, so a single frame-step is
rejected by the very same guard. The playhead moves; the video never does.
(J/L is configured as **5 s** / Ctrl = **10 s**, not 5 frames — the frame keys
are `,`/`.`; worth confirming against the user's mental model.)

---

## 3. Root cause B — no repaint when the seek actually completes

`seekMediaEl` sets `currentTime` and returns. The caller (`seekTimelinePlayhead`,
ruler `updateTimeFromMouse`, `syncMediaElements`) then calls `drawCanvas()`
**immediately — on the same tick**, when the element still shows the *old* frame.
There is **no `seeked` → `drawCanvas()` hook for already-loaded elements**:

- `armVideoFrameLatch` (~20277) attaches `seeked` → `drawCanvas()` — but only
  when the latch is armed (fresh elements) and it stops after first fire.
- The markdown path's `seeked` listener (~15563) only sets `_mdLoaded = true`;
  it does **not** repaint.
- `drawWhenFrameReady`'s `seeked` listeners are removed on finish.

So for a normal clip, after the element finishes decoding the new frame, **nothing
paints it**. The canvas keeps whatever was on it from the fire-and-forget draw.

**Click vs drag symptom:** a **click** issues one seek + one stale draw, then
nothing re-paints → wrong frame persists. A **drag** issues a seek + draw on
every `mousemove`; eventually one move lands *after* the seek completed, so the
frame "catches up" mid-drag. Same reason a J/L double-press eventually fixes
itself (the second press happens after `seeked`, so the stale draw is correct).

**Why playback hides it:** during playback the RAF `loop` re-runs
`syncMediaElements` + draw every frame, so the correct frame gets painted by the
next animation frame — the bug is only visible in the **paused preview**.

---

## 4. Proposed fix — one unified "seek & wait-for-frame" path

Folding both behaviors into a single helper that every seek path uses gives all
seeks the split-path guarantee. Reuse `drawWhenFrameReady`'s proven wait
machinery instead of writing new logic.

### Phase A — coalescing seek with repaint (`seekMediaEl` rework)

Replace the dropped-seek guard with a **latest-wins coalescing** design:

1. Always record the desired target: `el._wantedTime = targetTime`.
2. If `el.seeking` is false and the target differs → set `currentTime = targetTime`
   and arm a **one-shot `seeked` → repaint** listener (see Phase B).
3. If `el.seeking` is true → do **not** drop it; leave `_wantedTime` set. The
   `seeked` handler from step 2 checks `_wantedTime` and, if it differs from
   `currentTime`, issues one more seek (loop capped, e.g. 3 iterations, so a
   live/erratic source can't spin).
4. Frame-step callers pass a frame-rate-aware threshold: `thresh = min(0.1, 1/fps/2)`
   or simply `0.001` so a 1/30 s step is never rejected.

This removes both Root Cause A defects: rapid J/L presses now converge to the
**latest** target, and `,`/`.` steps actually seek.

### Phase B — repaint-on-frame-ready helper (reuse `drawWhenFrameReady`)

`drawWhenFrameReady(el, targetTime)` already does the right thing — it sets
`currentTime`, waits for a decodable frame, then `drawCanvas()`. Make it the
single primitive:

- Route all paused seeks through it: `seekTimelinePlayhead`, ruler
  `updateTimeFromMouse` (click + drag), and the paused branch of
  `syncMediaElements`.
- When available, use `requestVideoFrameCallback` (Chrome/Edge) for exact
  frame-sync repaints, falling back to the existing `seeked` + poll.
- Keep the immediate `drawCanvas()` for non-video changes (playhead, text,
  shapes, audio-only moves) — only defer the *video-containing* paint until the
  frame is ready. `drawWhenFrameReady`'s `finish()` already calls `drawCanvas()`,
  so the caller should pass `repaint: false`-style intent or simply not draw when
  a video wait was registered (the `refreshFreshVideoPreview` pattern:
  `if (!waiting) drawCanvas()`).

### Phase C — wire every seek call site

Exact call sites found:

| Call site | Current behavior | After |
|---|---|---|
| `seekTimelinePlayhead(delta)` — **J/L**, `,`/`.` | seek + immediate draw | seek + frame-ready repaint |
| Ruler `updateTimeFromMouse` (~19115, ~19286) | seek + immediate draw | seek + frame-ready repaint (keep immediate draw of overlays) |
| `syncMediaElements` playing branch (~20629, `seekMediaEl(el, targetTime, 0.25)`) | per-frame seek | keep per-frame (RAF covers it); harmless to reuse helper |
| `syncMediaElements` paused branch (~20644/20647) | seek | frame-ready repaint |
| `refreshFreshVideoPreview` / split / import | ✅ already correct | unchanged |

### Phase D — guard against regressions

- Keep `armVideoFrameLatch` for fresh-element placeholder behavior (Phase 1
  work) untouched.
- Cap the coalescing loop and clear `_wantedTime` on `error`/`emptied` so a dead
  source can't hammer the network (mirrors existing `_videoGiveUpAt` logic).
- During playback the RAF loop repaints anyway — the new `seeked` hook must be
  cheap (one-shot, removed after firing) so it doesn't stack listeners per frame.

---

## 5. Measured before-numbers (live, 2026-08-07)

Harness: MDN `flower.mp4` (5.055 s, H.264, blob URL) imported through the real
`#mediaInput` path, fully loaded (`readyState 4`), paused. Probes: wrapped
`window.seekMediaEl` (logged every call + whether the `el.seeking` guard dropped
it) and wrapped `renderCanvas`' `drawImage` (timestamped every video paint).
All measured on the current build, **before** any fix.

### 5.1 Dropped seeks (Root Cause A) — CONFIRMED

Two `seekMediaEl` calls back-to-back (second inside the first's decode window):

```
call 1: target=1.0  el.currentTime=3.0  el.seeking=false  dropped=false  -> currentTime=1.0 issued
call 2: target=4.0  el.currentTime=1.0  el.seeking=true   dropped=true   -> currentTime=4.0 NEVER set
result after 700 ms: el.currentTime = 1.0  (State wanted 4.0)   drops: 1
```

A second seek arriving while `el.seeking` is true is **silently discarded** —
the element never reaches the requested time. This is the "had to press twice"
mechanism, measured directly.

### 5.2 Stale frame after a single seek (Root Cause B) — CONFIRMED

Far seek `0.0 s → 5.0 s` (forces a real decode cycle), then 900 ms with no input:

```
canvas hash at frame 0.0 (baseline):        1094010424
canvas hash immediately after click-seek:   1094010424   <- SAME as frame 0.0 (stale!)
canvas hash 900 ms later:                   1094010424   <- STILL frame 0.0
video element final state:                  currentTime=5.0, seeking=false
repaints during the 900 ms window:          1, and it painted while seeking=true (old frame)
```

The canvas was **still showing frame 0.0 a full 900 ms after the element reached
5.0** — the correct frame decoded, nothing repainted it. (On tiny local blobs
the decode window is sometimes shorter than one tick, so the stale draw can
happen to be right — that's the "sometimes, not every time" part.)

### 5.3 Frame-step keys (`,`/`.`) rejected by the threshold — CONFIRMED

Aligned at 2.0 s, single `.` press (= +1/30 s = 0.0333 s):

```
State.currentTime: 2.0000 -> 2.0333   (playhead moved 0.0333 s)
el.currentTime:     2.0000 -> 2.0000   (video never moved; elStep = 0)
seekMediaEl call: target=2.0333, threshold=0.1, |target - el.currentTime| = 0.0333 <= 0.1 -> skipped
```

A single frame-step is **always rejected** by the `0.1 s` threshold — the video
can only catch up after the playhead drifts far enough (>0.1 s).

### 5.4 After-numbers (measured post-fix, 2026-08-07)

Same harness, same clip. The fix (Phases A–C) was implemented and re-measured:

1. **Dropped seeks → coalesced:** two back-to-back calls
   (`seekMediaEl(el, 1.0); seekMediaEl(el, 4.0)`):
   - *Before:* `el.currentTime` ended at **1.0** (4.0 dropped), zero repaints.
   - *After:* `el.currentTime` ended at **4.0** (latest-wins re-seek on `seeked`),
     canvas repainted with frame 4.0 at **+80 ms** (`canvasMatchesEl: true`).
2. **Single click-seek:** `0.0 → 3.2 s`, no input after:
   - *Before:* canvas stuck on frame 0.0 for 900 ms+.
   - *After:* one-tick stale flash at t=0, then **repaint at +24 ms** to the
     correct frame 3.2 (canvas hash matched the known frame-3.2 value).
3. **Frame step:** single `.` press at 2.0 s:
   - *Before:* `elStep = 0` (rejected by the 0.1 s threshold).
   - *After:* `elStep = 0.0333` — element moved exactly 1/30 s.
4. **J/L rapid fire:** `j` then `l` 50 ms apart → `el.currentTime (5.0) ==
   State.currentTime (5.0)`, converged after the second press (first press's
   seek was coalesced, not dropped).

Note: the probe's old "drops" counter still reports 1 for test 1 because the
second call *arrives* while `el.seeking` is true — but the seek is no longer
lost; it is remembered in `el._wantedTime` and applied when `seeked` fires.
The meaningful metric is convergence to the latest target + a real repaint,
both verified above.

Reuse the live-preview harness approach from `Video-Preview-Fast-Loading-Plan.md`:

---

## 6. Out of scope (future phases)

- **WebCodecs canvas preview** (decodes ahead, instant seeks) — already planned
  in `Video-Preview-Fast-Loading-Plan.md` (Phase 3). This plan is the pragmatic
  `<video>`-element fix that ships first.
- Frame *exactness* at non-keyframe boundaries (seeking lands on the nearest
  keyframe until the decoder catches up) — inherent to `<video>`, eliminated by
  the WebCodecs phase.

---

*Plan written after live code analysis of `index.html` (seekMediaEl ~20384,
drawWhenFrameReady ~20295, seekTimelinePlayhead ~17492, ruler handlers ~19112,
syncMediaElements paused branch ~20644). §5.1–5.3 measured live on the current
build (MDN flower.mp4 via #mediaInput, wrapped seekMediaEl + canvas paint
probes). No code changes made; nothing committed.*
