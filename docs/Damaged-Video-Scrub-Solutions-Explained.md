# Fixing the Broken-Video Scrub Issue — Solutions Explained Simply

> A plain-language companion to the issue in `_demo_assets/ABOUT.md` and the deeper
> technical plan in `docs/Video-Stream-Stability-Plan.md`.
> What's wrong, why it happens, and the four ways to fix it — with effort and payoff
> for each. **No code changed; this is a decision doc.**

---

## 1. The problem, in one sentence

Two demo videos downloaded from third-party sites (`We are making a feature film!_1080p.mp4`,
`4 easy cuts to improve your boring videos! 1080P.mp4`, both from **vidssave/vd6s**) have a
**damaged H.264 video stream** — so when you scrub them hard in the timeline, the browser's
video decoder gives up (`MEDIA_ERR_DECODE`, error code 3), the video element dies, and the
canvas shows the gray "mock video" placeholder until the app's recovery logic rebuilds it.

The other four demo videos scrub fine — they were downloaded with a different tool
(`youtube-downloader`) and their streams are clean.

---

## 2. Why it happens (the honest explanation)

A video file is a chain of frames that reference each other (P/B frames point back to earlier
"reference" frames). The two broken files were **re-muxed sloppily by the downloader site**:
somewhere around the 4.6–6.5 s mark, frames reference pictures that were never delivered —
like a building whose 3rd floor is missing but the 5th floor is bolted onto it anyway.

- **Software decoders** (ffmpeg, and the webview we test in) shrug it off: they skip the bad
  frame, hide the crack, and keep going.
- **Chrome's hardware-accelerated decoder** is strict: it sees the missing reference and
  declares the whole stream broken → the element enters a fatal error state.

**Scrubbing makes it worse:** every scrub-seek lands mid-stream and forces the decoder to
"decode forward" from the previous keyframe — which means it walks right into the damaged
section over and over. This is also why the MediaBunny demo player stalls on the same files:
it decodes the same bytes. **It is not an editor bug — the files are genuinely damaged.**

> Status check (what's already in the code today):
> - ✅ A `[video-error] code= 3` console tripwire was added so errors are now visible.
> - ❌ The four fix tracks below are **not implemented yet** — recovery is still the old
>   "3 instant retries, then 10 s of mock video" behavior.

---

## 3. The fixes — four options, from cheap to ambitious

### Option A — Smarter, faster recovery (recommended first) · ~100–150 lines, no dependencies

**The idea:** when a video dies, don't show a gray box for 10 seconds. Instead:

| Change | What it does | Why it helps |
|---|---|---|
| **A1 — Classify the error** | Log whether it was decode (3), network (2), or unsupported (4) | We stop treating a broken file like a missing file |
| **A2 — Backoff instead of a 3× instant retry storm** | Retry at 0 ms → 500 ms → 2 s instead of 3 times instantly | The instant retries re-seek into the same broken spot and die again — spacing them out gives the decoder time to recover |
| **A3 — Retry when the user actually cares** | Clear the cooldown and rebuild when the user presses **Play** or stops scrubbing | Recovery happens when you're looking, not on an arbitrary timer |
| **A4 — Keep the last good frame** | Freeze the last painted frame on an offscreen canvas and show it while recovering | You see the video, not a gray mock — the jarring flash is gone |
| **A5 — "Restoring…" chip** | Small overlay on the frozen frame during recovery | It reads as "loading", not "broken" |

**Payoff:** the mock video basically disappears from the experience; recovery is under a second
instead of up to ten.

### Option B — Keyframe-aware seeking (recommended second) · ~150–250 lines

**The idea:** don't let scrubbing decode *through* the broken part — jump over it.

- **B1 — Build a keyframe index at import:** read the MP4's keyframe table (`stss`) once per
  video (~100 lines of byte parsing) and remember where each keyframe is.
- **B2 — Snap seeks to a keyframe:** every scrub target becomes "seek to the keyframe just
  before it, then decode forward to the exact frame". Decoding always restarts from a *clean*
  anchor, so broken GOPs get skipped instead of walked through.
- **B3 — Rate-limit scrub seeks:** at most one seek per ~66 ms during a mouse drag, always from
  a keyframe — short decode chains, room for the decoder to breathe.
- **B4 — Use the same snap when recovering:** after a decode error, rebuild at the keyframe
  before the wanted time instead of the raw target.

**Payoff:** attacks the *cause* — on clean files it changes nothing, on broken files it makes
`MEDIA_ERR_DECODE` events approach zero.

### Option C — Import preflight + in-browser repair (ambitious) · C1 ~50 lines, C2 big

- **C1 — Warn at import:** when a video is added, probe it silently (seek to 10 % and 50 %,
  count errors). Tag it "unstable" and show a small warning: *"This video's stream is damaged —
  scrubbing may be unstable."* At least the user learns before it breaks.
- **C2 — Repair the file in the browser:** use the existing export worker's WebCodecs pipeline
  to **decode everything and re-encode a clean copy** (H.264, keyframe every ~2 s), then replace
  the source with the healed file. This permanently fixes the file — scrubbing becomes smooth,
  exports stop stalling. Progress UI included. (`ffmpeg.wasm` is a heavier alternative backend.)
- **C3 — Just re-download cleanly** is the zero-code answer for these two demo files
  (they're only for testing), but it doesn't fix other users' files.

**Payoff:** C1 is cheap insurance; C2 is the only fix that heals the file itself, in-browser,
no user action beyond one click.

### Option D — Export parity · small

- **D1 — Preflight before export:** reuse the C1 probe; warn "this clip may fail to render"
  and offer Repair before starting a long export.
- **D2 — Worker error handling:** if the export decoder hits a decode error, retry once from the
  previous keyframe; if it still fails, abort with a clear message instead of hanging.

**Payoff:** broken clips can't silently produce a broken export.

---

## 3.5 Implementation status (what actually shipped)

**Option A (recovery overhaul) is implemented in `index.html`** and verified live:

- **A1 — Error classification:** decode (3) vs network (1/2) vs unsupported (4) recorded on the clip.
- **A2 — Backoff ladder:** 0 ms → 500 ms → 2 s via `tryRecreateVideo`; no more 3× instant retry storm.
- **A4 — Last-good-frame freeze:** `clip._lastGoodFrame` keeps the last painted frame; recovery draws it with the same crop/fit/transform instead of flashing the mock.
- **A5 — Status chip:** "Restoring…" while retrying, "Video unavailable — move playhead or press play" once a zone gives up.
- **Forward-play recovery (new):** a recreated element is *allowed to play forward through the damaged GOP once* (`_videoRecovering`) instead of being held frozen — this works whenever the region is decodable (observed in the software-decoding preview webview: plays clean through both corrupt zones).
- **No infinite loops (new, from real user sessions):** three changes stop the error-cluster loops seen in the logs (23.62 → 24.58 → 24.74 → 12.72…):
  1. The corrupt zone is anchored to the **playhead** (not the drifting element position), so forward-play errors in the same region count toward the same zone's give-up instead of resetting it each time.
  2. The old "parked > 400 ms ⇒ wake recovery" reset is **removed** — it recreated the element every half-second while the user was parked on the broken spot, producing the error spam.
  3. The cooldown re-attempt only fires once the playhead **moves to a different zone**; moving away (or pressing play) recreates immediately.

**The honest limit:** the editor's hardware decoder on some machines cannot decode these corrupt GOP regions at all — even a clean forward-play attempt fails. In that case the editor now freezes the last-good frame with the chip (no error spam), and recovers when the user scrubs to a clean region or presses play. That is the best an in-browser editor can do for a structurally damaged stream; making the region playable requires **repairing the file** (Option C2 / re-encode — see §5).

---

## 4. Recommended order

1. **Phase 1 — Option A** (recovery overhaul): fastest win, kills the mock-video UX.
2. **Phase 2 — Option B** (keyframe-aware seeking): reduces the errors at the source.
3. **Phase 3 — C1 + D1** (preflight + warnings): tell the user before it bites.
4. **Phase 4 — C2** (in-browser repair): the "heal the file" feature, when time allows.

> For the two demo files specifically: A + B make them behave acceptably in the editor;
> C2 (or re-downloading cleanly) makes them perfect. The `docs/Video-Stream-Stability-Plan.md`
> has the full measured baselines (380 scrub events, corrupt-GOP locations, per-file table)
> and the exit criteria for each phase.

---

## 5. How this interacts with the future Tauri desktop app

The same damage triggers the same failure in any strict decoder — Chrome, Edge, a Tauri webview,
or WebCodecs in MediaBunny. Moving to a Tauri app **does not fix the files**; it gives us two
new levers:

- **Native `ffmpeg` sidecar** (the natural Tauri move): repair (C2) and exports can shell out
  to a real ffmpeg binary — faster than in-browser WebCodecs and tolerant of these streams,
  exactly like the software decode we already observe. Best long-term home for the repair
  feature.
- **Consistent decode path**: a Tauri webview can be configured to decode software-first
  (as the preview webview does today), avoiding the hardware-decode fatality — a mitigation,
  not a cure.

In short: A + B fix the *experience* everywhere today; C2/fmpeg-sidecar fixes the *files*
everywhere tomorrow.

---

## 6. Decision table (quick reference)

| Option | Fixes | Effort | Do first? |
|---|---|---|---|
| **A — Smarter recovery** | Mock-video flash, 10 s dead zone | ~100–150 lines | ✅ Yes |
| **B — Keyframe-aware seek** | The decode errors themselves | ~150–250 lines | ✅ Yes (after A) |
| **C1 — Import preflight warning** | Surprise factor | ~50 lines | 👍 Nice |
| **C2 — In-browser repair** | The files themselves | Big (worker re-encode) | Later / Tauri ffmpeg |
| **D — Export parity** | Broken exports | Small | With C1 |

**Bottom line:** Options A + B are the 90 % fix for the user-visible problem and are purely
editor-side. Options C + D are the remaining 10 % (knowing it's broken before it breaks, and
healing it). The files themselves are the root cause — any decoder-strict browser will hit
them; no amount of editor logic can make a damaged stream *not* damaged, it can only dodge it
(B) or hide it better (A) until it's repaired (C2).
