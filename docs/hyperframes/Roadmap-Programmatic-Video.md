# Roadmap: Making Studio Pro Create Videos Like HyperFrames & Remotion

> **Date:** August 2026
> **Goal:** Turn Studio Pro from a *real-time, in-browser WYSIWYG editor* into a tool that can also **render deterministically, faster than real time, from a portable composition file** — the two properties that make HyperFrames and Remotion attractive for automation and AI agents.
>
> **North star:** Studio Pro keeps its GUI. But the timeline becomes exportable as a self-contained **composition file** (a `seek()`-based document, HTML or JSON+manifest) that (a) plays standalone in any browser, (b) renders faster-than-real-time in the Studio Pro engine, and (c) can be written/edited by AI agents — the HyperFrames authoring model, powered by Studio Pro's superior Canvas renderer.

---

## Guiding Principle

Everything below rests on one observation from the comparison doc:

> **`drawCanvas(targetCtx, w, h)` is already a seek function.** It draws the exact frame for `State.currentTime`. HyperFrames and Remotion spend their engineering budget making the *browser* deterministic; Studio Pro only needs to make its *loop* deterministic.

So the roadmap is mostly about **clock hygiene, video pre-decoding, and file formats** — not about rewriting the renderer.

---

## Phase 0 — Determinism Hygiene (Foundation)

**Effort:** Small · **Do first** · No user-visible change, everything else depends on it.

### 0.1 Quantize time to frames
Add a single helper mirroring HyperFrames' `quantizeTimeToFrame` and route every seek through it:

```js
function quantizeTimeToFrame(t, fps = State.fps || 30) {
  return Math.round(t * fps) / fps;
}
```

Apply it in: `seekTimelinePlayhead()`, the rAF `loop()`, scrub handlers, keyframe navigation (`getInterpolatedValue` already uses `clip.start + prev.time`), and the export loop. The goal: *preview and export always compute the same nominal time the same way.*

### 0.2 Kill `Math.random()` in the frame path
The shake loop animation:

```js
if (type === 'shake') { animX += (Math.random() - 0.5) * 10; animY += (Math.random() - 0.5) * 10; }
```

Replace with the project's **existing seeded PRNG pattern** (`puzzleSeedFromId(id)` + `mulberry32`, already in `index.html`): seed from `clip.id` (+ frame index for evolution) so every run produces identical shake. Audit for any other `Math.random()` / `Date.now()` / `performance.now()` calls reachable from `drawCanvas()`.

### 0.3 Decouple playback clock from render
Keep the rAF `loop()` for interactive playback (that's fine), but make the *export* loop advance time by **frame index**, not wall-clock `elapsed`. This is the seed of Phase 1.

### 0.4 Font determinism audit
HyperFrames pins fonts because network `@import` is a coin flip. Studio Pro's risk is lower (Canvas text draws whatever is loaded) but the same class of bug exists. Document which fonts are used per clip and **warn/fallback** if a clip's font isn't loaded before export. (Full font embedding is Phase 5.)

### 0.5 Enforce preview=render
Add a "parity check" test mode: render the same second of timeline via the scrub path and via the export path and diff the canvases pixel-wise (or hash). CI/regression style, runnable from the console. This is Studio Pro's equivalent of HyperFrames' sha256 manifest.

**Exit criteria:** two consecutive exports of the same timeline produce identical frames at identical timestamps (hash-compare a few frames), and shake is deterministic.

---

## Phase 1 — Faster-Than-Real-Time (FTRT) Export

**Effort:** Medium · The headline feature: export a 60s video in ~10–20s instead of 60s.

### 1.1 Frame-synchronous seek loop
Replace the `realtimeExportLoop` (rAF, wall-clock `elapsed`) with a **seek-and-capture loop**:

```js
for (let frame = 0; frame < totalFrames; frame++) {
  const t = quantizeTimeToFrame(exportStart + frame / fps, fps);
  State.currentTime = t;
  drawCanvas(exportCtx, exportW, exportH);
  const bitmap = await createImageBitmap(exportCanvas);   // already async + GPU-safe
  await sendFrameToWorker(bitmap, frame);                 // already has backpressure
}
```

The renderer (text, shapes, math, scenes, effects, animations) is fully CPU-drawable — this loop runs as fast as `createImageBitmap` + encode allow. **The only blocker is video clips** (Phase 1.2) — without it, static/anim-only timelines already go FTRT.

### 1.2 Deterministic video: the frame flipbook
Replace "fresh `<video>` elements played at 1x" with the HyperFrames approach, adapted to the browser:

1. **Pre-decode pass:** before capture, for each video clip overlapping the export range, decode frames at export FPS into an `ImageBitmap[]` pool (WebCodecs `VideoDecoder`, or `createImageBitmap(videoEl)` with frame stepping; `OffscreenCanvas` if available). Store as `clip._framePool` — or, to save memory, a lazy LRU keyed by frame index.
2. **Render pass:** in `drawCanvas()`, when a video clip is active, `ctx.drawImage(pool[frameIndex])` instead of `drawImage(videoEl)`. This keeps object-fit/positioning logic untouched — only the pixel source changes.
3. **Memory ceiling:** cap the pool (e.g., 2× the decode-ahead window) and decode on demand behind the current frame. For 1080p, an `ImageBitmap` is ~8MB; a 2s lookahead at 30fps is ~60 frames ≈ 500MB — so implement a sliding window, or downscale pool frames to export resolution.

> **Note:** WebCodecs gives a *deterministic decoder output path* and works in Workers (decoding doesn't block the main-thread draw). `createImageBitmap(videoEl)` is simpler but needs a DOM-attached element. Prefer WebCodecs for the export path; keep `createImageBitmap` as the fallback.

### 1.3 Keep audio as-is
The `OfflineAudioContext` pre-render is already deterministic and already runs before the frame loop. Just send chunks on the *frame* schedule (already timestamped in µs — MediaBunny muxes by timestamp, so speed is irrelevant to sync).

### 1.4 Yield to the event loop
Keep a small `await`/`setTimeout(0)` every N frames so the UI stays responsive and the browser can GC the frame pool. Optionally add the existing `framesInFlight` backpressure (already implemented post-BSOD fix) so we never outrun the encoder.

**Exit criteria:** an all-shapes/text/math timeline exports FTRT; a video-inclusive timeline exports FTRT with deterministic video frames; audio stays in sync (spot-check a few timestamps).

---

## Phase 2 — Parallel & Off-Threat Rendering (Scaling)

**Effort:** Medium-High · Optional but high-value.

### 2.1 OffscreenCanvas in a dedicated render worker
Studio Pro owns its rasterizer — so unlike HyperFrames (which needs one Chrome per shard), Studio Pro can render chunks **in Web Workers**:

- Move (or mirror) the `drawCanvas` pipeline into a worker using `OffscreenCanvas` + `transferToImageBitmap`/`createImageBitmap`.
- Split the timeline into **chunks** (e.g., 5-second spans), render each chunk in a worker, and concatenate encoded segments in the main worker (MediaBunny's `Output` supports feeding segments, or use one worker per chunk and mux after).
- This mirrors HyperFrames' N-Chrome-process split, minus the "video decoder exhaustion" gotcha — WebCodecs per worker is cheap.

### 2.2 Video pre-decode in parallel workers
Decode video pools across workers *before* the draw pass (like FFmpeg pre-extraction). Each chunk worker gets its own pool.

**Exit criteria:** N workers render N chunks concurrently; total export time scales sub-linearly with worker count; memory stays bounded.

---

## Phase 3 — The Composition File Format (the "HyperFrames moment")

**Effort:** Medium-High · This is the strategic differentiator: **"Export Timeline as Composition".**

### 3.1 Define a Studio Pro Composition (`.spcomp`)
A self-contained document with a `seek()` contract, inspired by HyperFrames but matched to Studio Pro's data model:

```jsonc
{
  "format": "studio-pro-composition",
  "version": 1,
  "width": 1920, "height": 1080, "fps": 30, "duration": 12.0,
  "backgroundColor": "#0b0b0f",
  "assets": [ { "id": "a1", "type": "image|video|audio|font", "uri": "data:..." } ],
  "tracks": [ { "id": "t1", "type": "video", "clips": [ { "clipId": "c1", "start": 0.0, "duration": 6.0 } ] } ],
  "clips": {
    "c1": { "type": "text", "text": "Launch day", "trackId": "t1",
            "effects": { "fontFamily": "Rubik", "fontSize": 60, "fillColor": "#ffffff",
                         "animIn": "fadeIn", "animInDur": 0.5, "animInDelay": 0 },
            "keyframes": { "scale": [ { "time": 0, "value": 1, "ease": "easeOut" },
                                      { "time": 2, "value": 1.5 } ] } }
  }
}
```

Rules it must honor (borrowed from HyperFrames' contract):
- **Assets are embedded** (data URIs / base64) or resolved from a manifest — no network at render time.
- **No `Math.random()`, no `Date.now()`** in any effect; all seeded.
- **Time is quantized** to `fps` in the seek contract.
- **Fonts embedded or pinned** (Phase 5).

### 3.2 The seek contract
The composition file *is* the `window.__hf` equivalent:

```js
function seek(composition, t) {
  const q = quantizeTimeToFrame(t, composition.fps);
  // for each clip active at q → calculateAnimationState(clip, clipTime, timeLeft, w, h)
  // → drawCanvas(exportCtx, w, h)
}
```

Studio Pro's serialization already exists (`serializeProject()` / `applyProject()` in `index.html`) — this is a **typed, portable projection** of that state plus an embedded-asset manifest.

### 3.3 Player parity
Bundle a tiny `<script>` with the composition that renders `seek(t)` into a canvas given a playhead — the standalone player. Same code drives preview and render (enforced parity, Phase 0.5).

**Exit criteria:** `File → Export Composition` produces a single file that plays in any browser tab by double-click, and that Studio Pro can re-import losslessly (round-trip test).

---

## Phase 4 — Agent Authoring Loop (the "Remotion moment")

**Effort:** Medium · Builds directly on Studio Pro's existing Markdown → video generator.

### 4.1 Reverse the Markdown pipeline
Studio Pro already compiles Markdown → clips (`mdHeadingClip`, `mdTextClip`, position tags, per-slide timing, audio refs). Add the inverse direction:

- **Markdown → composition file:** run the existing generator, then serialize to `.spcomp`. Now an agent can iterate: *write Markdown → render composition → preview → edit → render*.
- **Composition file → Markdown:** a `spcomp` → Markdown exporter (best-effort) closes the loop so agents can "read" existing timelines.

### 4.2 Timeline → Markdown → timeline round-trip
The existing `_mdGenerated` flags and `mdPosOffsets`/`mdStackOffsets` metadata make this tractable — generated clips already remember their script origin.

### 4.3 Agent skills (optional, stretch)
Document the composition contract in a `skills/` folder (or a plain `AGENTS.md` guide) so coding agents can author `.spcomp` directly — Studio Pro's answer to HyperFrames' `/hyperframes-core` skill. Combined with a CLI (Phase 5), this is the full agent loop.

**Exit criteria:** an agent can generate a `.spcomp` (or Markdown → `.spcomp`) and Studio Pro renders it without GUI interaction.

---

## Phase 5 — Headless / CLI / Cloud (Optional but Powerful)

**Effort:** Medium-High · Only worth it once Phases 0–3 are solid.

### 5.1 CLI wrapper
A thin Node CLI (`studio-pro render project.spcomp --out out.mp4`) that boots the existing render pipeline headlessly. Two credible paths:

- **`jsdom`-free Canvas in Node:** `node-canvas` doesn't match the browser canvas exactly — risky.
- **Headless Chromium via Puppeteer:** load the app (or a slim render-only page) with a URL fragment pointing at the composition, drive `seek()`/capture via CDP. This reuses *everything* and matches HyperFrames' approach. Deterministic mode: CDP `HeadlessExperimental.beginFrame` on Linux is available to us too, but since Studio Pro owns pixels we mostly need `captureScreenshot` of the canvas element only.
- **Simplest:** `npx vite build` a render-only entry, `puppeteer` loads it, `page.evaluate(() => seekAndRenderFrame(i))` per frame with `createImageBitmap` piped to MediaBunny in the page or a Worker. Deterministic because time is quantized (Phase 0) and video is pre-decoded (Phase 1).

### 5.2 Font embedding
For CLI/cloud parity, embed fonts (base64 `@fontsource` style, like HyperFrames) or pre-load and `document.fonts.ready` before render — so a headless render produces identical text to the browser tab.

### 5.3 Cloud / parallel (stretch)
Either (a) a Lambda/deployable render service that runs the CLI in Docker (HyperFrames-style), or (b) keep everything client-side and push parallel chunk rendering (Phase 2) as the "cloud" — many browsers exporting chunks and stitching. The latter is unique to Studio Pro's browser-first architecture.

---

## Suggested Ordering & Milestones

| Milestone | Phases | Outcome | Est. size |
|---|---|---|---|
| **M1 — Deterministic core** | 0 | Repeatable exports, seeded shake, quantized time | Small (days) |
| **M2 — FTRT export** | 1 | Export 60s in ~15s; video clips deterministic | Medium (1–2 wks) |
| **M3 — Composition format** | 3 | Portable `.spcomp` + standalone player + round-trip | Medium (1–2 wks) |
| **M4 — Agent loop** | 4 | Markdown ↔ composition ↔ render automation | Medium (1 wk) |
| **M5 — Parallel workers** | 2 | Multi-worker chunk rendering | Medium-High (2 wks) |
| **M6 — CLI/headless** | 5 | `studio-pro render file.spcomp` | Medium (1–2 wks) |

**Recommended sequence:** M1 → M2 → M3 → M4 first (all in-browser, all build on each other, no new infra). M5 and M6 are additive scale-out; they're where "like HyperFrames/Remotion" becomes "with a CLI and cloud".

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Video frame pools blow memory | Sliding-window decode (2s lookahead), downscale to export res, LRU eviction |
| Canvas text rendering differs headless vs in-tab | Font embedding + `document.fonts.ready` gate; parity check (Phase 0.5) |
| WebCodecs decoder variance across machines | Quantized time + parity hash; fall back to `createImageBitmap(videoEl)` |
| Composition format drifts from `State` model | Generate `.spcomp` from `serializeProject()` (single source of truth); round-trip test in CI |
| Worker `drawCanvas` refactor is invasive | Mirror pipeline first (keep main-thread path), then A/B diff both outputs frame-by-frame |
| Export UX regressions (progress, cancel) | Keep the existing progress/cancel plumbing; only the time source changes |

---

## What "Done" Looks Like

A user (or an AI agent) can:

1. Build a timeline in the GUI — or write Markdown — or paste a `.spcomp`.
2. Hit **Export** and get a deterministic MP4 **faster than real time**, identical to the preview frame-for-frame.
3. **Export Timeline as Composition** and hand the single file to anyone — it plays standalone, and an agent can edit it by changing JSON/HTML.
4. (Optional) Run `studio-pro render project.spcomp` in CI or on a server for automated pipelines.

That is the HyperFrames/Remotion experience — but with a WYSIWYG editor on top, a Canvas renderer that never fights the browser compositor, and zero servers required.
