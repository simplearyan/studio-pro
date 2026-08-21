# WebCodecs Video Decode for the Fast (FTRT) Export — Plan

> **Date:** 2026-08-17
> **Status:** Plan — no code yet
> **Scope:** `index.html` (`startFTRTExport` pool machinery at ~30745–30820, `drawCanvas` pool hook at ~6234) + a **new** `src/workers/video-decode-worker.js` (module worker, vite-bundled like `export-worker.js` at index.html:29932).
> **Goal:** replace the M1b per-frame `seekExportVideo(el) + createImageBitmap(el)` pool capture (measured **~31–32 fps decode ceiling** — see `M1-FTRT-Export-Plan.md` §7.2) with **WebCodecs `VideoDecoder` running in a dedicated worker**, so video timelines in the Fast tab decode as fast as the machine's decoder allows (expected **2–10× real-time at 1080p**, ~1–2× at 4K on the GT 740), with **deterministic** frames (M0 parity hook) and the same bounded-memory sliding-window pool on the main thread.

---

## 1. Why (the current bottleneck)

M1b's pool is **decode-bound**, not encode-bound: every captured frame does a full `el.currentTime` seek → `seekExportVideo` settle (event loop + `seeked` wait) → `createImageBitmap(el)` (readback + copy). Measured live: **31–32 fps capture** at 1080p on the dev machine (§7.2 of the M1 plan). That caps a 24 fps export at ~1.3× and risks slipping below 1× on the GT 740.

WebCodecs `VideoDecoder` decodes **encoded chunks straight to `VideoFrame`s** with no DOM element, no event-loop seek settle, and no per-frame readback — typically 100–400 fps for 1080p H.264 on integrated/entry GPUs, and it works off the main thread. It also removes the last **non-deterministic** piece of the capture path: element frame snapping becomes an explicit sample-index mapping (M0's *same input → same output*).

## 2. Architecture

```
                ┌────────────────────────────── main thread ──────────────────────────────┐
 fileUrl ─fetch─▶ ArrayBuffer ─transfer─▶ video-decode-worker ─┐                            │
   (blob:/http)                          VideoDecoder          │ VideoFrame (transferable)  │
                                        + minimal demuxer      ▼                            │
                                        (keyframe-aware)   clip._framePool (Map<idx,ImageBitmap>)│
                                            ▲                  │                            │
                                            │ backpressure     ▼ drawCanvas hook (~6234)    │
                                            │ (decode window)  ├── compositing (text/effects/grade) │
   encode worker (unchanged) ◀─createImageBitmap(exportCanvas) ─┘                            │
        VideoSampleSource ◀────────────────── worker 'frame' msg (unchanged protocol)         │
```

- **New `video-decode-worker.js`** (module worker, one per export, shared by all in-range clips): owns `fetch`-ed file bytes, demuxes the container, runs one `VideoDecoder` per clip, and emits `VideoFrame`s for the exact source samples the export grid needs.
- **Main-thread pool stays the single source of truth** for `drawCanvas` (the hook at ~6234 is untouched — `clip._framePool` keeps its `Map<exportFrameIndex, ImageBitmap>` shape, so preview and the compositing path don't change).
- **Encode worker stays byte-for-byte untouched** — decode worker is separate so decode load can never trip the encode-side ack-based stall watchdog (8 s, §3.3 of the M1 plan).
- **`VideoFrame` is transferable** → zero-copy postMessage; the main thread converts to `ImageBitmap` for pool storage (same `.close()` eviction semantics as M1b) and closes the frame.

## 3. Demuxing — the real work

`VideoDecoder` needs **demuxed encoded chunks** (`EncodedVideoChunk`s) plus the decoder `description` (the `avcC` box for H.264). The app has no demuxer. Two options:

| Option | What | Pros | Cons |
|---|---|---|---|
| **A. `mp4box.js`** (npm, in the decode worker) | Battle-tested MP4 parser incl. **fragmented** files | Handles YouTube-downloaded/fragmented MP4s (real user files); small API; already have an npm-bundled worker | New dependency (consistent with `mediabunny` usage); ~100 KB in the worker bundle |
| **B. Minimal inline demuxer** (new `src/workers/mp4-demux.js`) | Parse `ftyp/moov/mdat`, sample tables (`stts/stsc/stsz/stco|co64/stss/ctts`), build a sample index, slice `mdat` | Zero deps; full control; ~300 lines | Only clean (non-fragmented) MP4s; fragmented files (common from YouTube DL tools) need `moof/traf` handling → much harder; no test corpus |

**Recommendation: Option A (`mp4box.js`) with Option B as a fallback when the file is a clean MP4 and mp4box is unavailable offline.** Concretely: Phase A spikes both; if mp4box handles the user's real files (fragmented included) with acceptable decode speed, ship A only. The worker is PWA-precached so offline works either way.

Key decode-side pieces regardless of option:

1. **Sample index** → for any source time `t`, the nearest decodable sample: walk `stts` (run-length decode-to-timeline), find the sample index, then back up to the **last keyframe** (`stss`) before it. `VideoDecoder` must decode from that keyframe and **discard** samples before the target (per-chunk `decode()` is sequential — a "seek" = `flush()` + re-decode from the keyframe, or decode-and-skip when the target is within the already-decoded GOP).
2. **Decoder config** — from the container's `avcC`/`hvcC`/`vpcC` (`codec` string + `description`); gate with `VideoDecoder.isConfigSupported()` and `codecs` support probing (H.264 is universally available in Chromium; HEVC often not).
3. **Timestamp mapping** — the export grid maps through the *existing* `clipSourcePos` (sourceOffset + speed-ramp integral, index.html:6849) so `ensurePoolFrame`'s `Math.floor(clipSourcePos(clip, t) * fps)` key stays valid. The decode worker only needs `(clipId, srcT)` → returns the frame for the nearest sample to `srcT`.

## 4. Worker protocol (additive; encode worker untouched)

```
main → decode worker:
  { type: 'decode-start', clipId, fileBytes: ArrayBuffer,   // transferred
    codecHint: 'avc'|'vp9'|'auto' }
  { type: 'decode-frame', clipId, exportIndex, srcT }       // request slot in the window
  { type: 'decode-cancel' }
  { type: 'decode-stop' }

decode worker → main:
  { type: 'decode-ready', clipId, durationSec, sampleCount, supported: true }
  { type: 'decode-frame-ready', clipId, exportIndex, frame: VideoFrame }  // transferred
  { type: 'decode-error', clipId, error }
  { type: 'decode-unsupported', clipId, reason }            // → fallback ladder
```

**Backpressure:** the main thread requests at most `WINDOW` frames ahead of `poolState.consumed` (the same 6-frame discipline as M1b). The decode worker holds no more than `WINDOW + 2` decoded `VideoFrame`s per clip (decode-ahead is bounded; frames not yet requested are closed in the worker). Eviction on the main thread keeps the existing `_map`/`.close()` loop.

## 5. Fallback ladder (order of preference)

1. **WebCodecs path** — only after the preflight succeeds: `fetch(fileUrl)` → `ArrayBuffer` works, `VideoDecoder.isConfigSupported` passes, demux yields a sample index, and the **parity check** (§6) passes.
2. **Current M1b element-seek pool** (unchanged code path) — any WebCodecs failure at preflight *or mid-export* (decode-error) drops the clip back to the element pool; export continues, slower but correct.
3. **MediaBunny** — unchanged last resort (reversed clips already route here; user's manual choice; stall watchdog).

The mid-export fallback is per-clip: a failing decoder for clip B must not abort an export where clip A is fine.

## 6. Determinism + parity (M0 tie-in)

- **Preflight parity check** (before the pump starts): decode the first 8 export-grid frames via WebCodecs **and** via the element path; hash each (`drawCanvas`-independent pixel hash, e.g. 64×36 `getImageData` rolling hash — the same approach used to verify M1b motion) and compare. Match ⇒ WebCodecs path. Mismatch ⇒ element pool (records a `console.warn`).
- **Mid-export invariant:** every pool slot is written by exactly one source (WebCodecs or element), never mixed for the same `(clipId, exportIndex)` — the parity preflight guarantees this by construction.
- **Note the honest caveat from the roadmap docs:** hardware decoders can vary frame output across machines; the parity preflight only protects the *current* machine, which is the only one that matters for a single export.

## 7. Phases & acceptance criteria

| Phase | Deliverable | Done when |
|---|---|---|
| **A. Decode spike** | `src/workers/video-decode-worker.js` + demuxer: feed the demo film's `ArrayBuffer`, emit `VideoFrame`s at a target sample grid | Worker logs frame counts/timestamps for the demo film; `VideoDecoder.isConfigSupported('avc')` probed; fragmented vs clean MP4 handling decided (mp4box vs inline) |
| **B. Pool wiring** | `decode-start/frame` protocol; `prefetchVideoPool` picks WebCodecs when ready, else the existing element path; drawCanvas unchanged | A video FTRT export completes **using the decode worker** (console confirms), pool eviction/close correct, build passes |
| **C. Parity + fallback** | Preflight parity check; per-clip mid-export fallback to element pool; `decode-unsupported` path | Forced-failure test (mock `isConfigSupported=false`) exports successfully via element pool; parity mismatch test routes to element pool |
| **D. Benchmark + docs** | Re-run the Compare probe and a real video FTRT export on the Fast tab; record × real-time vs the M1b numbers (§7.2) | `docs/hyperframes/M1-FTRT-Export-Plan.md` gains a §7.3 with the WebCodecs numbers; GT 740 30 s graded-video run completes with the watchdog armed |

**Acceptance criteria (overall):**
- [ ] 10 s video @ 24 fps 1080p exports **faster than the M1b element-pool time** (dev machine: < 4.7 s wall for 6 s of video, i.e. > 1.28×) — measured and logged.
- [ ] 30 s graded-video FTRT export completes on the **GT 740** without TDR (watchdog armed; scratch-canvas discipline kept from P0).
- [ ] Deterministic: two identical FTRT exports produce identical frame hashes (M0 harness).
- [ ] Encode worker diff is **zero**; MediaBunny loop untouched.
- [ ] Every fallback rung is exercised in a test (WebCodecs → element pool → MediaBunny) and the UI never hangs.

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Decoder unavailable (HEVC / old Chromium) | `isConfigSupported` probe → element pool fallback; H.264/VP9 only in v1 |
| Fragmented MP4s from download tools fail an inline demuxer | Prefer `mp4box.js` (handles fragmentation); inline demuxer only for clean files |
| Hardware-decode output variance | Parity preflight on the current machine; M0 frame-hash invariant |
| Decode + encode in one worker trips the stall watchdog | **Separate decode worker** — encode worker's ack cadence unchanged |
| `fetch(fileUrl)` fails (weird schemes, revoked object URLs) | Preflight failure → element pool; element already tolerates bad URLs |
| Memory with multiple 4K clips | Same 6-frame window discipline per clip; `VideoFrame.close()` in worker + `ImageBitmap.close()` on main; per-clip decode-ahead cap |
| Speed ramps / sourceOffset mapping drift | Decode requests use the *same* `clipSourcePos` integral the drawCanvas hook uses (single shared mapping) |

## 9. Out of scope (this pass)

- Reversed clips — still routed to MediaBunny (their element-resync machinery is a separate M-track item).
- Video **audio** tracks through the decode worker (audio stays on the deterministic `preRenderExportAudio` path).
- HEVC/AV1 decode targets (v1 = H.264 + VP9, matching the encode side).
- Scrubbing-time WebCodecs preview (this is export-only; live preview keeps elements).

## 10. Docs to update alongside

- `M1-FTRT-Export-Plan.md` — §7.3 outcome + the "known honest limits" paragraph in §7.2 pointing at this plan.
- `Render-Speed-Analysis-and-Plan.md` — mark the WebCodecs-in-worker item in the frame-pool section as planned/shipping.
- `Agent-Authoring-and-Automation-Plan.md` — §C.2/C.3 note that the deterministic video path (WebCodecs) is now the export capture path.
