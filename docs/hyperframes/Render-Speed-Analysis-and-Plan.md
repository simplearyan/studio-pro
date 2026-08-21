# Why HyperFrames Renders Fast — And How We Make Studio Pro Exports Fast Too

> **Date:** August 2026
> **Primary source:** HeyGen research post *"HTML to Video: How HyperFrames Solved AI Video Rendering"* (heygen.com/research/html-to-video) + github.com/heygen-com/hyperframes
> **Scope:** This doc is *speed-focused*. It answers three questions:
> 1. **Why** is a HyperFrames render faster than the video is long?
> 2. **Where** does Studio Pro's MediaBunny export spend its time today (with code refs)?
> 3. **How** do we get Studio Pro exports from real-time to *faster than real time* — concretely, in phases?
>
> Sibling docs: [HyperFrames-Deep-Dive.md](./HyperFrames-Deep-Dive.md) (architecture), [StudioPro-vs-Hyperframes-vs-Remotion.md](./StudioPro-vs-Hyperframes-vs-Remotion.md) (layer-by-layer comparison), [Roadmap-Programmatic-Video.md](./Roadmap-Programmatic-Video.md) (full product roadmap). The export pipeline internals live in `docs/export/`.

---

## TL;DR

**HyperFrames is fast because it never "plays" the video.** It renders the same way you print a book: for every frame it *positions* everything (one `seek(t)`), takes one screenshot, and moves on. Time never advances by itself, nothing waits on a wall clock, and the whole thing can be split across many machines. The math: **render time ≈ number of frames × cost of one frame — not duration.**

**Studio Pro is real-time because its export loop is a playback loop.** `startMediaBunnyExport` (`index.html:27501`) advances `State.currentTime` by wall-clock `elapsed` inside `requestAnimationFrame`, and video clips are played at 1× via fresh `<video>` elements because per-frame seeking was abandoned after persistent `Video seek error` events. A 60-second video therefore takes ≥ 60 seconds.

**The good news: Studio Pro is architecturally *better positioned* for speed than HyperFrames.** HyperFrames must fight the browser compositor for every frame (that's most of its engineering). Studio Pro **owns its rasterizer** — `drawCanvas(targetCtx, w, h)` draws the exact frame for `State.currentTime` synchronously. It inherits none of Chrome's capture races. The only reasons it's not already faster-than-real-time are (a) the export clock is wall-clock, and (b) video clips play at 1×. Both are replaceable without touching the renderer.

---

## 1. Why HyperFrames Renders Fast — the Six Pillars

### 1.1 Seek, don't play (the one trick)

Every composition exposes exactly one contract:

```js
window.__hf = {
  duration: 10,
  seek: (timeSeconds) => { /* position every clip, tween, and video */ }
};
```

The renderer **never calls `play()`**. It calls `seek(0)`, screenshots, `seek(1/30)`, screenshots, … until it has 300 frames for a 10-second 30fps clip:

```js
for (let i = 0; i < totalFrames; i++) {
  const time = quantizeTimeToFrame(i / fps, fps);
  await page.evaluate(t => window.__hf.seek(t), time);
  const { buffer } = await beginFrameCapture(page, options, frameTicks, interval);
  writeFileSync(`frame_${i}.jpg`, buffer);
}
```

**The speed consequence:** each frame is *independent*. The renderer can't run "behind" real time because it isn't racing time at all. Frame 147 can be rendered in whatever milliseconds it takes — there is no lower bound set by the video's duration.

### 1.2 `HeadlessExperimental.beginFrame` — one atomic frame per call

The naive `page.screenshot()` races the compositor (it returns before fonts/tweens/videos settle). Their fix is a CDP method that runs **one layout → paint → composite → screenshot cycle atomically**:

```js
await cdp.send("HeadlessExperimental.beginFrame", {
  frameTimeTicks, interval,
  screenshot: { format: "jpeg", quality: 80, optimizeForSpeed: true }
});
```

The compositor is paused until the next request. One call, one frame, no retries, no flaky frames. (This requires `chrome-headless-shell` on Linux with `--deterministic-mode --enable-begin-frame-control` and a stack of flags that disable every async scheduling source; macOS/Windows fall back to `captureScreenshot` + "did the frame land" heuristics.)

**The speed consequence:** no wasted work. Because the compositor only advances when asked, there is no settle time to wait for — the screenshot is returned by the same call that produced the frame.

### 1.3 Video is pre-decoded to a JPEG flipbook — Chrome never decodes at render time

Playing `<video>` during capture is nondeterministic and slow (headless decoders skip frames, stall at `readyState: 0`, and drop frames under load). Their solution removes decoding from the critical path entirely:

1. **Pre-extract:** before capture, FFmpeg converts every `<video>` into numbered JPEGs at the target fps — a 5s clip at 30fps becomes 150 files.
2. **Swap:** during capture, each active video is hidden and an `<img>` sibling is injected with that frame's bytes as a data URI, style-cloned (`position`, `transform`, `opacity`, `objectFit`, …) so animations keep working.
3. From the animation library's perspective nothing changed — it's a still image that changes every frame. **A flipbook.**

**The speed consequence:** per-frame cost for video content drops from "decode a frame of video" to "display a JPEG". Decode cost is paid *once*, ahead of time, in parallel with nothing else blocking. This also makes video **deterministic** (same JPEGs → same pixels).

### 1.4 Determinism hygiene = no wasted retries

- **Time quantization:** `Math.round(t * fps) / fps` on *every* seek, in preview and render, so two code paths computing the "same" nominal time can't differ by a pixel.
- **No `Date.now()`, no unseeded `Math.random()`, no network at render time** — part of the author contract.
- **Fonts:** Google Fonts `@import` is rewritten to local base64-embedded `@fontsource` copies so a render never waits on (or races) the network.
- **Warmup loop + custom polling** to keep Chrome's event loop alive under begin-frame control.

**The speed consequence:** a render never re-does a frame because it was wrong. Determinism is a *performance* feature: no heuristics, no retries, no pixel-hash loops, no font races in production.

### 1.5 Parallelism — N Chrome processes, one chunk each

Long renders are split across N Chrome processes; each worker renders its share of frames; FFmpeg concatenates the per-worker MP4 chunks. In the cloud (`@hyperframes/aws-lambda`) this scales horizontally: a 5-minute video can be rendered in wall-clock seconds if you throw enough machines at it.

The one gotcha (honest and relevant to us): **video-heavy compositions can time out in parallel mode** because Chrome can't seek multiple `<video>` elements simultaneously without exhausting decoders — so video-heavy renders drop to a single worker. (With the flipbook, only the pre-extraction is video-bound; capture itself is cheap.)

**The speed consequence:** rendering is embarrassingly parallel. Frames are independent → the only scaling question is "how many workers and how fast can each one capture + encode."

### 1.6 Cheap per-frame capture

JPEG quality 80 screenshots of the page — the frame is captured as a compressed JPEG, not a raw RGBA buffer, and the bytes go straight to disk. Per-frame cost is dominated by layout/paint/composite (browser work) + JPEG encode, which modern Chrome does in a few ms to tens of ms.

---

## 2. Where Studio Pro Stands Today (with code refs)

### 2.1 The renderer — already a seek function (our hidden superpower)

```js
drawCanvas(targetCtx, w, h)   // renders the exact frame for State.currentTime
calculateAnimationState(clip, clipTime, timeLeft, w, h)  // pure time → state
```

`drawCanvas` is called by preview *and* export. Preview and export already share the same draw path — Studio Pro's equivalent of HyperFrames' "same `window.__hf` in preview and render." And because we draw to a Canvas 2D context we own, **there is no compositor race, no screenshot heuristics, no beginFrame flags, no pixel-hash diffs.** A frame is just: `set State.currentTime → drawCanvas → read pixels`.

### 2.2 The export loop — wall-clock real-time (the bottleneck)

`startMediaBunnyExport` (`index.html:27501`) drives a `requestAnimationFrame` loop:

- Time advances by **wall-clock elapsed**: `State.currentTime = startTime + elapsed` — a playback clock.
- Frames are captured at the target fps with a precision scheduler (`nextCaptureTime = frameIndex * 1000/fps`), **throttled to one frame per 33ms** at 30fps.
- `MAX_IN_FLIGHT = 5` (`index.html:27834`) backpressures the encoder.
- Frame pixels are read with `await createImageBitmap(exportCanvas)` (`index.html:28039`) — already the async, GPU-safe read (the `transferToImageBitmap` BSOD fix).
- Audio was pre-rendered deterministically by `OfflineAudioContext` before the loop (`index.html:27566`) — this part is already correct and already "free" of the real-time constraint.

**The consequence:** export wall time ≈ timeline duration, period. Fast Mode only raises encoder throughput within the same 1× window (`MAX_IN_FLIGHT = 3`, no GPU yield) — it does not make the clock faster.

### 2.3 Video clips — forced 1× playback (the second bottleneck)

Per-frame seeking of `<video>` was abandoned after persistent `Video seek error` events. Instead, fresh DOM-attached `<video>` elements are seeked **once** to the clip's start and played naturally at `playbackRate = clipSpeed(clip)` (`index.html:27742`), with a rate-correction nudge each frame for speed-ramp clips (`index.html:27987`). This is what pins export to real time: the export cannot run faster than the video elements play, and a clip with speed ramps gets a complex live PLL instead of deterministic per-frame placement.

### 2.4 Audio — already deterministic and fast

`OfflineAudioContext` pre-render produces one contiguous PCM buffer; chunks are timestamped in µs and the MediaBunny worker muxes by timestamp — **speed is irrelevant to sync**. This is strictly better than HyperFrames' FFmpeg volume/pan mix and needs no changes in a fast export (only the send schedule changes).

---

## 3. The Speed Comparison

| | HyperFrames | Studio Pro (MediaBunny) today | Studio Pro (target) |
|---|---|---|---|
| **Clock** | Frame index (`seek(i/fps)`) | Wall-clock `elapsed` in rAF | Frame index (`for frame …`) |
| **Per-frame work** | `seek` + beginFrame + JPEG | `drawCanvas` + `createImageBitmap` + encode | `drawCanvas` + `createImageBitmap` + encode (same) |
| **Video content** | Pre-decoded JPEG flipbook | 1× live `<video>` playback | Pre-decoded `ImageBitmap[]` pool (flipbook) |
| **Determinism** | Enforced (sha256, flags, quantized time) | Not enforced (`Math.random()` shake, float time) | Enforced (seeded PRNG, quantized time, parity hash) |
| **Parallelism** | N Chrome processes + FFmpeg concat; Lambda cloud | None (single main-thread loop) | Web Workers per chunk (OffscreenCanvas) |
| **Rasterizer battle** | Fights Chrome compositor (big engineering cost) | **None — owns Canvas 2D** | Same (the advantage stays) |
| **Speed vs duration** | Independent of duration (bounded by frames × cost) | `wall time ≥ duration` | `wall time ≪ duration` (target 3–10×) |

**The asymmetric opportunity:** HyperFrames' whole engineering effort (§1.2, §1.4) exists to make *Chrome's* pixels deterministic. Studio Pro has none of that tax — its per-frame cost is `drawCanvas + readback + encode`, and all three are already implemented. What's missing is only the *loop* (frame-index instead of wall-clock) and the *video source* (flipbook instead of 1× playback).

---

## 4. The Physics of a Frame (why the plan works)

Per-frame budget today (30fps export, 1080p):

```
drawCanvas (CPU/GPU)   ~2–15 ms   ← pure function of time; can run back-to-back
createImageBitmap      ~2–8 ms    ← async GPU readback (already non-blocking)
worker encode (avc)    ~10–40 ms  ← runs in parallel; backpressured by MAX_IN_FLIGHT
------------------------------------------------------------
wall-clock gate        33 ms      ← THIS is the only thing enforcing 1× speed
```

If we drop the 33ms wall-clock gate and run the loop back-to-back, throughput is bounded by `drawCanvas + readback` on the main thread ≈ **20–60 fps of capture** — i.e., **1× to 2× FTRT immediately** for timelines without video (text/shapes/math/scenes already dominate typical Markdown → video output). Add video flipbooks (decode-ahead, so capture never waits on a decoder) and the same budget holds with video in the timeline. Add per-chunk Workers and throughput scales with core count.

HyperFrames gets its speed from the *same* arithmetic: each frame is `seek + beginFrame + JPEG` — independent, parallelizable, and not bounded by duration. The difference is they had to build a capture layer; we already have a synchronous rasterizer.

---

## 5. The Plan — Making Our Exports Fast

Order matters: each phase is independently shippable and builds on the previous. Phase 0 is invisible but everything depends on it. The headline user-facing milestone is **Phase 1: FTRT export**.

### Phase 0 — Clock hygiene (foundation, small, invisible)

1. **Quantize time to frames** — mirror HyperFrames' `quantizeTimeToFrame` and route every seek through it (scrub, rAF loop, keyframe navigation, export). Prevents preview/export pixel drift that would otherwise surface the moment we seek by frame index.
2. **Kill `Math.random()` in the frame path** — the `shake` loop animation uses `Math.random()`; replace with the project's existing seeded PRNG pattern (`puzzleSeedFromId(id)` + `mulberry32`, seeded from `clip.id` + frame index).
3. **Decouple the export clock from the wall clock** — the export loop advances by *frame index*, not `elapsed`. This is the seed of Phase 1 and is where the rAF loop is retired for export.

**Exit criteria:** two consecutive exports hash-identical at a few sampled frames; shake deterministic; scrubbing and export agree frame-for-frame.

### Phase 1 — Faster-than-real-time export (the headline)

Replace `realtimeExportLoop` (rAF + wall-clock) with a **seek-and-capture loop**:

```js
for (let frame = 0; frame < totalFrames; frame++) {
  const t = quantizeTimeToFrame(exportStart + frame / fps, fps);
  State.currentTime = t;
  drawCanvas(exportCtx, exportW, exportH);
  const bitmap = await createImageBitmap(exportCanvas);   // already async + GPU-safe
  await sendFrameToWorker(bitmap, frame);                 // keep MAX_IN_FLIGHT backpressure
  if (frame % 30 === 0) await new Promise(r => setTimeout(r, 0));  // keep UI alive, let GC run
}
```

- **Timelines without video export FTRT on day one** — the renderer (text, shapes, math, scenes, effects, animations) is fully CPU-drawable, and the loop above runs as fast as `drawCanvas + readback + encode` allow (target: 60s video in ~20–40s).
- **Audio is untouched** — the `OfflineAudioContext` buffer is already deterministic and timestamped; send chunks on the frame schedule (muxing is by timestamp, so speed is irrelevant to sync).
- Keep the existing progress/cancel plumbing; only the time source changes.

**Exit criteria:** all-shapes/text/math timeline exports FTRT; progress bar still accurate; audio in sync (spot-check timestamps).

### Phase 1.2 — Deterministic video: the in-browser flipbook (the hard part)

This is the direct port of HyperFrames §1.3, adapted to a browser that already owns the pixels. It is what lets *video-inclusive* timelines go FTRT.

1. **Pre-decode pass** (before capture): for each video clip overlapping the export range, decode frames at export FPS into an `ImageBitmap[]` pool. Prefer **WebCodecs `VideoDecoder`** (deterministic decoder output, works in a Worker, doesn't block the main-thread draw); fall back to `createImageBitmap(videoEl)` with frame stepping (needs a DOM-attached element).
2. **Render pass:** in `drawCanvas()`, when a video clip is active, `ctx.drawImage(pool[frameIndex])` instead of `drawImage(videoEl)`. Object-fit/positioning/transform code stays untouched — only the pixel source changes (exactly HyperFrames' img swap, but with zero file I/O and zero JPEG artifacts).
3. **Memory ceiling:** an 1080p `ImageBitmap` is ~8MB. Use a **sliding window** (decode 1–2s ahead of the playhead, evict behind) or downscale pool frames to export resolution. Never hold the whole clip.
4. **Speed-ramp clips:** a clip's `clipSpeed`/ramp maps output frame index → source frame index; the pool lookup is `pool[map(clipTime)]`. The live `playbackRate` PLL (`index.html:27987`) is deleted from the export path entirely.

**Exit criteria:** a timeline with multiple video clips exports FTRT with deterministic frames; memory stays bounded (< ~1GB); speed-ramp clips render correctly.

### Phase 2 — Parallel chunk rendering (scaling)

Our analogue of HyperFrames' N Chrome processes — but without the Chrome processes and without their "video decoder exhaustion" gotcha (WebCodecs per worker is cheap).

1. **OffscreenCanvas in a render Worker:** mirror (or move) the `drawCanvas` pipeline into a Worker using `OffscreenCanvas`, drawing directly in the worker and transferring `ImageBitmap`s to the encoder. This removes the main-thread readback from the critical path.
2. **Chunk the timeline:** split into 5–10s spans; one Worker per chunk (each with its own video frame pool); concatenate encoded segments in the final mux (MediaBunny's `Output` supports feeding segments, or mux per-worker then concat).
3. Video pre-decode happens in parallel workers *before* the draw pass — HyperFrames' FFmpeg pre-extraction, in-process.

**Exit criteria:** N workers render N chunks concurrently; total time scales sub-linearly with worker count; memory stays bounded.

### Phase 3 — Capture-path micro-optimizations (grinding)

- **Benchmark `createImageBitmap` vs `transferToImageBitmap` in a Worker** — `transferToImageBitmap` from an `OffscreenCanvas` (worker-side) avoids the main-thread pipeline flush that caused the GT 740 BSOD; in a worker context it's the fast path.
- **Skip redundant redraws:** if the frame's content hash is unchanged (static gap between animations), reuse the previous bitmap — free frames on long stills.
- **Adaptive resolution:** if `createImageBitmap` averages > 50ms, temporarily drop the export canvas to 50% and upscale at encode (already documented in `Export-Comparison-Kenichi-vs-StudioPro.md`).
- **Avoid the intermediate canvas:** where possible draw directly to an `OffscreenCanvas` at export resolution instead of a scaled copy.

### Phase 4 — Determinism enforcement (make fast = make repeatable)

- Parity check: render the same second through the scrub path and the export path; hash-diff the pixels (Studio Pro's sha256 manifest).
- Route all exports through quantized time (Phase 0) and the flipbook (Phase 1.2) so the FTRT path is *also* the deterministic path.
- Document the "author contract" for effects: no unseeded randomness, no `Date.now()`, time is quantized.

### Phase 5 — Composition file + headless + cloud (the scale-out that compounds)

Once FTRT + parity exist in the browser, the same `seek()` loop becomes a **composition file** (`.spcomp`, per `Roadmap-Programmatic-Video.md` Phase 3) that can be rendered by a slim headless page — and then chunked across Lambda/CI machines like HyperFrames does. The in-browser speedups (Phases 0–3) carry over 1:1 to any headless/cloud render, because they're all just "for frame → seek → draw → encode."

---

## 6. What to Steal vs What We Already Do Better

| Steal from HyperFrames | Already better in Studio Pro |
|---|---|
| Seek-don't-play loop (frame index clock) | Owns the rasterizer — no compositor fight, no capture heuristics |
| Video flipbook (pre-decode, swap stills) | WebCodecs decode → `ImageBitmap[]` (no JPEG files, no artifacts) |
| Time quantization on every seek | `OfflineAudioContext` deterministic audio pre-render (HyperFrames mixes with FFmpeg) |
| Parallel chunked rendering | Web Workers + OffscreenCanvas (no Chrome per shard, no decoder-exhaustion gotcha) |
| Determinism contract (no `Date.now()`/`Math.random()`, sha256 parity) | Scene/pre-comp system; `drawCanvas` already the shared preview/export path |
| Font pinning (base64 `@fontsource`) | — (needs an audit; see Roadmap Phase 0.4) |

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Video frame pools blow memory | Sliding-window decode (1–2s lookahead), downscale to export res, LRU eviction |
| WebCodecs decoder variance across machines | Quantized time + parity hash (Phase 0/4); fall back to `createImageBitmap(videoEl)` stepping |
| Per-frame seeking of `<video>` regresses to `Video seek error` | The flipbook *never seeks a live video element during capture* — that's the entire point of Phase 1.2; keep the 1× path as a fallback option until flipbook lands |
| Worker `drawCanvas` refactor is invasive | Mirror pipeline first (keep main-thread path), A/B diff outputs frame-by-frame |
| Export UX regressions (progress, cancel, GPU safety on old cards) | Keep existing progress/cancel plumbing + `MAX_IN_FLIGHT` backpressure + `createImageBitmap` (never `transferToImageBitmap` on the main thread) |
| Speed-ramp clips during fast export | Frame-index → source-frame mapping in the pool lookup; remove the live PLL from the export path |

---

## 8. Suggested Milestones & Expected Payoff

| Milestone | Work | Payoff |
|---|---|---|
| **M0 — Clock hygiene** | Quantize time; seeded shake; frame-index export clock | Repeatable exports; foundation |
| **M1 — FTRT export** | Seek-and-capture loop replacing rAF wall-clock | Text/shape/math/scene timelines: 60s video in ~20–40s (1.5–3×) |
| **M1.2 — Video flipbook** | WebCodecs pre-decode → `ImageBitmap[]` pool | Video-inclusive timelines FTRT + deterministic video |
| **M2 — Parallel workers** | OffscreenCanvas render worker + chunked export | Scales with cores: 60s video in ~10–20s on a 4–8 core machine |
| **M3 — Parity + composition** | Hash-diff preview vs export; `.spcomp` render loop | FTRT path is provably identical to preview; portable to headless/cloud |

The quickest win is M0+M1: **a 60-second captions/text slideshow video currently takes 60+ seconds to export; the same timeline exports in ~20–40s with a frame-index loop and zero video clips.** M1.2 removes the last real-time dependency (video), and M2 turns remaining time into "how many cores do you have."

---

*See also: [MediaBunny-Export-Architecture.md](../export/MediaBunny-Export-Architecture.md) (current pipeline), [MediaBunny-Export-Modes.md](../export/MediaBunny-Export-Modes.md) (FPS/Fast Mode), [Export-Comparison-Kenichi-vs-StudioPro.md](../export/Export-Comparison-Kenichi-vs-StudioPro.md) (createImageBitmap vs transferToImageBitmap), [Roadmap-Programmatic-Video.md](./Roadmap-Programmatic-Video.md) (full product roadmap).*
