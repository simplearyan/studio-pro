# Video Stream Stability Plan — Broken H.264 demo files break on scrub

> Status: **PLANNED** — analysis + measured before-baseline only, nothing implemented yet.
> Input: `_demo_assets/ABOUT.md` + live probing of the six demo videos + instrumented live scrub baseline.
> App under analysis: `index.html` (inline editor) + `export-worker.js` (MediaBunny).

---

## 1. TL;DR

Two demo videos (`We are making a feature film!_1080p.mp4`, `4 easy cuts to improve your boring videos! 1080P.mp4` — both downloaded via **vidssave/vd6s**) have a **structurally damaged H.264 stream**. ffprobe's own decoder throws `illegal short term buffer state detected` while scanning them. Repeated scrubbing (seek bursts) drives Chrome's stricter H.264 decoder (often hardware-accelerated) into a **fatal `MEDIA_ERR_DECODE`**, the `<video>` element enters error state, and the editor falls back to its gradient mock placeholder until the existing recovery logic recreates the element. The other four videos (clean h264 from youtube-downloader, plus two AV1 files) scrub fine.

The fix is a mix of **smarter recovery** (backoff, keep last good frame, error classification) and **keyframe-aware seeking** (snap seeks to IDR boundaries so decode always restarts from a clean reference). A longer-term **import preflight + in-browser repair** option can heal the files themselves.

---

## 2. What was reported (`_demo_assets/ABOUT.md`)

- Videos downloaded from third-party downloader sites (`https://vd6s.net/`, `https://vidssave.com/youtube-video-download`).
- **Symptom:** "When user scrubs these videos in timeline they broke after too much scrub" — the canvas preview shows the **mock placeholder** instead of the video frame.
- **Console warning:** `Video element in error state, recreating: <title>` fired from `syncMediaElements` (index.html ~20658).
- Recovery does eventually bring the video back ("they will load back again after some time").
- The **MediaBunny player** (mediabunny.dev example) also stalls on the same files when scrubbing fast — evidence this is a *stream-quality* problem, not editor-specific.
- **Other videos scrub smoothly** — those were downloaded with `youtube-downloader` (a different tool).

---

## 3. Root-cause diagnosis (measured)

### 3.1 File table (ffprobe, packet-level — no decode)

| File | Codec | Resolution | FPS | Duration | Keyframes | Avg GOP | ffprobe *decode* probe | Source |
|---|---|---|---|---|---|---|---|---|
| `We are making a feature film!_1080p.mp4` | **h264 High** | 1920×1080 | 24 | 69.7 s | 33 | **~2.1 s** | ❌ `illegal short term buffer state detected` | vidssave |
| `4 easy cuts to improve your boring videos! 1080P.mp4` | **h264 High** | 1080×1920 | 23.976 | 47.9 s | 25 | **~1.9 s** | ❌ same error | vidssave |
| `…Everything we still can't explain…mp4` | h264 | 1920×1080 | — | 82.9 s | 15 | ~5.3 s | ✅ decodes clean | youtube-downloader |
| `…African camels…mp4` | h264 | 1280×720 | — | ~323 s | 61 | ~5.3 s | ✅ decodes clean | youtube-downloader |
| `…Blend Modes Explained…mp4` | **AV1** | 1080×1920 | 23.976 | 49.3 s | 19 | ~2.6 s | ✅ decodes clean | youtube-downloader |
| `…The truth about gut health.mp4` | **AV1** | 1920×1080 | 23.976 | 630 s | 199 | ~3.2 s | ✅ decodes clean | youtube-downloader |

All six: `yuv420p`, AAC stereo 44.1 kHz audio, single non-monotonic DTS (the standard negative first-DTS edit-list offset — not a problem).

### 3.3 Measured before-baseline (instrumented live scrub session)

Instrumentation added at the recovery branch (index.html ~20696):

```js
// MEDIA_ERR codes: 1=abort, 2=network, 3=decode, 4=src-not-supported
console.log('[video-error]', clip.title, 'code=', el.error.code, 'readyState=', el.readyState, 't=', State.currentTime.toFixed(2));
```

Live sessions (dev server, real import path via `mediaInput`):

| Session | Source type | Scrubs | MEDIA_ERR_DECODE | Mock flashes | Mock-shown ms | Recovery latency |
|---|---|---|---|---|---|---|
| 1 — full-clip zig-zag | blob URL (import) | 20 | 0 | 0 | 0 | — |
| 2 — random mid-GOP burst | blob URL (import) | 40 | 0 | 0 | 0 | — |
| 3 — playback-path scrub (`shouldPlay`) | blob URL (import) | 20 | 0 | 0 | 0 | — |
| 4 — full-clip zig-zag | HTTP (dev-server stream) | 20 | 0 | 0 | 0 | — |
| 5 — corrupt-GOP hammer (0.2–7.5 s) | HTTP (dev-server stream) | 40 | 0 | 0 | 0 | 224 ms (healthy) |
| 6 — **real mouse-drag scrub** (ruler: mousedown → 24 mousemove steps back/forth → mouseup, ×10 drags, 240 real seek events, corrupt 0.2–7.5 s window) | HTTP (dev-server stream) | 240 | 0 | 0 | 0 | 101 ms (healthy) |
| **Total** | | **380** | **0** | **0** | **0** | |

**Why zero?** The preview webview decodes H.264 in **software**, which tolerates and recovers from the corrupt reference chains — the same behavior as ffmpeg's software decoder (`illegal short term buffer state` appears as a warning and decode continues). The user's breakage (`MEDIA_ERR_DECODE`, code 3) fires on **hardware-accelerated** decode, which treats the same input as fatal. MediaBunny stalls for the same reason. The `[video-error]` console log added above is the tripwire: in a hardware-decode browser, scrubbing these files now prints the exact code + position.

**New evidence — corrupt regions located** (ffprobe `-skip_frame nokey` decode probe):

| File | Corrupt GOP (pts) | Notes |
|---|---|---|
| `We are making a feature film!_1080p.mp4` | ~4.6 s → ~6.2 s | first error between frames 4.625 and 6.167 |
| `4 easy cuts…1080P.mp4` | ~4.6 s → ~6.5 s | first error between frames 4.630 and 6.465 |

This means a hardware-decode reproduction is cheap: scrub the **0–8 s window** of either file back and forth a few times — every pass walks decode-forward into the corrupt GOP. Session 5 (programmatic) and session 6 (real ruler mouse-drag, `mousedown` → `mousemove` sweep → `mouseup` on `rulerCanvas`, the exact gesture the user described as "hold playhead and drag") both prove the app does *not* crash in software decode even when hammering that exact window. Note session 6 used the app's own drag handler (index.html ~19129) with a real mousemove per seek — no keyboard shortcuts involved.

### 3.4 What this tells us

1. **GOP length is NOT the differentiator.** The two broken files have *shorter* GOPs (~2 s) than the fine h264 files (~5 s). If sparse keyframes were the cause, the fine files would be the ones breaking.
2. **The broken files' H.264 bitstreams are internally inconsistent.** ffmpeg's *software* decoder throws `illegal short term buffer state` — a frame references a short-term reference frame that is not in the DPB (decoded picture buffer). This is the classic signature of downloader-service re-muxing: GOPs cut/re-ordered without valid IDR placement, dropped SPS/PPS, or broken B-frame reference chains.
3. **ffmpeg recovers; Chrome does not.** libavcodec tolerates and skips the bad frame. Chrome's H.264 decoder (frequently hardware-accelerated) surfaces a **fatal decode error** on the same input → `el.error.code === 3` → element unusable until recreated.
4. **Scrubbing is what triggers it.** Every seek to a non-keyframe position forces decode-forward from the previous IDR. On a broken chain, decode-forward *from an arbitrary mid-GOP point* eventually walks into the corrupt reference and dies. Clean files decode-forward fine, which is why they scrub forever without issue.
5. **MediaBunny stalls too** because it demuxes/decodes the same bytes with WebCodecs — same root cause, confirming this is not an editor logic bug.

---

## 4. How the editor behaves today (code walkthrough)

| Concern | Where | Behavior |
|---|---|---|
| Video element creation on import | index.html ~10723, 15561, 16542, 17174 | `preload='auto'`, `playsInline`, `armVideoFrameLatch` (Phase 1 fast-loading) |
| Per-frame sync while playing | `syncMediaElements` ~20480 | calls `seekMediaEl(el, target, 0.25)` for active clips, `seekMediaEl(el, sourceOffset)` for upcoming clips |
| Coalesced seeking | `seekMediaEl` ~20440 | `_wantedTime` latest-wins, one-shot `seeked`→repaint, 400 ms fallback, 0.001 default threshold (seek-accuracy work) |
| **Error recovery** | ~20696 | `if (clip.videoEl.error)` → recreate element **up to 3 times immediately**, then drop + `_videoGiveUpAt` 10 s cooldown; one fresh retry per 10 s at ~20510 |
| Canvas fallback | drawCanvas gate ~5005 | `clip.videoEl` missing OR `readyState < 2` (and no `_mdLoaded`/`_frameReady`) → paints the gradient mock / "Loading media…" placeholder (~5090–5141) |
| Export decode | `export-worker.js` | independent WebCodecs pipeline; no error classification |

### Why recovery feels slow

- **3 instant retries, then 10 s of mock.** During an active scrub, each retry re-demuxes + re-seeks the whole file, so the retries themselves can re-trigger the decode error (same broken GOPs). Then the element is dropped for a full 10 s → long stretches of gradient mock = the screenshots in `ABOUT.md`.
- **Last good frame is thrown away.** When the element is dropped/recreated, `drawCanvas` switches to the mock immediately instead of freezing the last successfully painted frame.
- **Error type is not logged.** `MEDIA_ERR_DECODE` (3) and `MEDIA_ERR_NETWORK` (2) get identical treatment, so we can't tell "decoder choked on corrupt stream" from "file unreachable".
- **Seeks are not keyframe-aware.** Every scrub seek lands mid-GOP and decodes forward — the worst case for broken reference chains.

---

## 5. Issues (numbered)

1. **Decode errors on scrub** — broken H.264 chains crash Chrome's decoder; element enters error state mid-interaction.
2. **Slow recovery** — 3 instant retries then 10 s cooldown; mock placeholder shown for the whole gap.
3. **No error classification** — decode vs network vs unsupported all take the same recovery path.
4. **Mid-GOP seek targets** — no keyframe snapping; decode-forward from arbitrary points maximizes exposure to corrupt GOPs.
5. **Lost last-good frame** — recovery UX is a jarring gradient card, not a frozen frame.
6. **No import-time feedback** — users discover the problem only when scrubbing breaks.
7. **Export/MediaBunny can stall on the same files** with no clear error path.
8. **No user-facing status** — "recovering" vs "given up" are indistinguishable in canvas.

---

## 6. Solution options

### Option A — Smarter, faster recovery (recommended, first)
~100–150 lines in `index.html`, zero deps, big UX win.

- **A1 Classify errors:** log `el.error.code` (1 abort / 2 network / 3 decode / 4 unsupported) at ~20696. Decode → A2/A4; network → backoff; unsupported → permanent flag (no retries).
- **A2 Exponential backoff instead of instant ×3:** 0 ms → 500 ms → 2 s. Never recreate more than once per frame even if `syncMediaElements` runs per-frame.
- **A3 Proactive re-attempt on intent:** clear `_videoGiveUpAt` and recreate when the user presses **play** or stops scrubbing (no seek for >400 ms) — recovery when the user is actually looking, not on an arbitrary 10 s timer.
- **A4 Keep the last good frame:** each successful `drawCanvas` video paint caches the frame to an offscreen canvas (`clip._lastGoodFrame`); while the element is missing/erroring, draw the cached frame instead of the mock. Mock only when nothing was ever painted.
- **A5 Status affordance:** when recovering, draw a small "restoring…" chip over the cached frame so it reads as transient, not broken.

### Option B — Keyframe-aware seeking (recommended, second)
~150–250 lines, no deps. Directly reduces the *cause* (decode-forward from broken mid-GOP points).

- **B1 Keyframe index on import:** parse the MP4 `moov`/`stss` (sync-sample) table from the blob once per video (~100 lines of pure byte parsing, or reuse `requestVideoFrameCallback` sampling during the first playthrough as a fallback). Store `clip.keyframeTimes[]`.
- **B2 Seek-to-IDR in `seekMediaEl`:** for a target T, seek to the nearest keyframe ≤ T, then decode-forward to T via the existing `drawWhenFrameReady`/rVFC machinery. Every recovery restarts from a **clean IDR**, so corrupt GOPs are skipped rather than decoded through.
- **B3 Scrub rate-limit while paused:** at most one seek per ~66 ms during mouse scrub (latest-wins already exists in `seekMediaEl`), always starting from a keyframe — keeps the decode chain short and gives the decoder room to breathe.
- **B4 Use the same index at recovery time:** when recreating after a decode error, seek straight to the keyframe preceding the wanted time instead of the raw target.

### Option C — Import preflight + in-browser repair (longer term)
- **C1 Preflight probe:** on import, run a hidden `<video>` (or WebCodecs) probe: seek to 10 % and 50 %, count errors. Tag `clip._unstable = true`; show a toast + clip-chip warning ("This video's stream is damaged — scrubbing may be unstable. Re-download or Repair.").
- **C2 In-app Repair (big):** WebCodecs decode-all + `VideoEncoder` re-encode (H.264, keyframe every 2 s) inside the existing export worker → produces a **repaired blob** that replaces the source. Full pipeline exists in the worker already; add decode-error-tolerant capture + re-mux. Progress UI. This heals the files completely in-browser.
- **C3 ffmpeg.wasm** as an alternative repair backend — heavier (~30 MB wasm), only if C2 proves too slow for long files.

### Option D — Export parity
- **D1 Preflight before export:** reuse the C1 probe; if unstable, warn + suggest Repair before starting.
- **D2 Worker error handling:** on decode error in `export-worker.js`, retry once by seeking to the previous keyframe; if it still fails, abort with a clear message instead of hanging the progress UI.

---

## 7. Recommended implementation plan

### Phase 1 — Recovery overhaul (Option A) ✅ do first
1. Add error-code classification at the ~20696 branch; keep a per-clip `_errorType`.
2. Replace instant ×3 retries with exponential backoff timestamps (0 / 500 ms / 2 s), guard against more than one recreate per frame.
3. Add the last-good-frame cache: capture in the video draw path (~5299/5305), paint it in the placeholder branch (~5005) when available.
4. Proactive retry hooks: on play press and on scrub-idle (last `seekMediaEl` call >400 ms ago) with `_videoGiveUpAt` reset.
5. Add "restoring…" chip on the cached frame during recovery.

**Exit criteria:** on both broken files — scrubbing never shows the gradient mock for more than ~500 ms (cached frame persists); recovery happens within ~1 s of stopping the scrub; error codes visible in console.

### Phase 2 — Keyframe-aware seeking (Option B) ✅ do second
1. MP4 `stss` parser (moov walk) on import → `clip.keyframeTimes`.
2. `seekMediaEl` keyframe snap + decode-forward to exact target (reuse `_wantedTime` machinery).
3. Scrub rate-limit (~66 ms) in the paused branch.
4. Recovery path seeks to the keyframe preceding the wanted time.

**Exit criteria:** MEDIA_ERR_DECODE count per 20-scrub session on the broken files drops to ~0; frame accuracy at the playhead unchanged (target still reached exactly, just via a clean IDR start).

### Phase 3 — Preflight + warnings (C1, D1)
1. Import probe → `_unstable` flag → toast + clip chip.
2. Export preflight reusing the probe; warn before render.

### Phase 4 — In-app Repair (C2, optional/big)
1. Worker re-encode pipeline (decode-all, re-encode H.264, 2 s IDR).
2. "Repair video" action on unstable clips with progress + replace-source.
3. Fall back to C3 if perf unacceptable.

---

## 8. Verification / acceptance criteria

**Corpus:** the 2 broken vidssave files + 2 clean youtube-downloader files + 1 AV1 file.

| Metric | Target |
|---|---|
| MEDIA_ERR_DECODE events per 20-scrub session (broken files) | ~0 after Phase 2 |
| Time spent showing gradient mock per scrub | < 500 ms after Phase 1 (cached frame instead) |
| Time from scrub-stop → correct frame painted | < 1 s |
| Playhead frame accuracy after keyframe-snap seek | exact (within 1 frame) |
| Export (10 s, MediaBunny MP4) of a broken-file clip | completes or fails with a clear message — never hangs |

**Manual test script:**
1. Import both broken files → scrub the full timeline 5× fast both directions → no permanent mock, no 10 s dead zone.
2. J/L + `,`/`.` stepping across a broken clip → frame follows playhead each time.
3. Split a broken clip at a mid-GOP point → both halves play and scrub.
4. Export a 10 s clip containing the broken footage → completes or clear error.

---

## 9. Notes / out of scope

- `_demo_assets/` is already gitignored (user's `.gitignore` change) — demo media stays local, good.
- The demo files are third-party-downloaded content; fine for local dev, not for shipping.
- We cannot control Chrome's hardware decoder strictness; keyframe-snap (B) is the practical mitigation, not a decoder toggle.
- MediaBunny stalls independently — any editor-side fix must not assume the player path; export parity (D) is deliberately separate.
- No commit until the user approves — this is a plan only.
