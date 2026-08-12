# Studio Pro vs HyperFrames vs Remotion — From Animation to Rendering

> **Date:** August 2026
> **Scope:** A layer-by-layer comparison of how each system handles animation, time, rasterization, capture, encoding, determinism, video, audio, and distribution.

---

## 0. The Big Picture

All three tools share one foundational idea — **a frame is a pure function of time**:

- **Remotion:** React component rendered for frame `n` (`useCurrentFrame()`).
- **HyperFrames:** `window.__hf.seek(t)` positions every clip/tween; the browser then paints.
- **Studio Pro:** `drawCanvas(targetCtx, w, h)` draws the exact frame for `State.currentTime` onto a Canvas 2D context.

The difference is *where the pixels come from* and *how the clock is driven*:

| | Remotion | HyperFrames | Studio Pro |
|---|---|---|---|
| **Pixels from** | Browser DOM (React → HTML) | Browser DOM (HTML) | **Canvas 2D (owned by the app)** |
| **Clock driven by** | Frame number (pure) | `seek(t)` called by renderer | Wall-clock rAF during playback; real-time during export |
| **Needs headless Chrome?** | Yes | Yes | **No** (but currently renders in a visible tab) |

> **⭐ The key insight for Studio Pro:** because it owns the rasterizer, it is the *only* one of the three that can render frames at CPU/GPU speed **without a browser-capture layer at all**. HyperFrames and Remotion fight Chrome's compositor for determinism; Studio Pro can sidestep that fight entirely — its bottleneck is (a) the wall-clock playback/export loop and (b) video-clip playback. Both are fixable.

---

## 1. Authoring Model

| | Remotion | HyperFrames | Studio Pro |
|---|---|---|---|
| **Format** | React/TSX components | Plain HTML + `data-*` attributes | GUI timeline (clips in `State.clips`), Markdown script |
| **Who writes it** | Developers | Humans + AI agents | Creators in the browser; Markdown is a text path |
| **Build step** | Bundler (Webpack/Vite) | None | None (single-file app) |
| **Portability** | Node project | Single HTML file | Project JSON + embedded media; **no standalone composition file** |
| **Human-readable?** | Yes (code) | Yes (code) | No — JSON blob, mostly machine-read |
| **Agent-editable?** | Yes (files) | Yes (files) — designed for it | **Not directly** — agent would have to write the JSON |

**Studio Pro's Markdown → video generator is the seed of an agent-authoring story.** Today a human writes Markdown and the editor builds the timeline. HyperFrames' bet is that the *same text-driven authoring* can be reversed into a file format that agents write directly. Studio Pro's `mdHeadingClip()` / `mdTextClip()` builders are effectively a **Markdown → clip-model compiler** — a natural bridge to a composition file format (see Roadmap Phase 4).

---

## 2. Animation System

| | Remotion | HyperFrames | Studio Pro |
|---|---|---|---|
| **Primitive** | Interpolated values from `frame` (`interpolate()`, `spring()`, `Easing`) | Library timelines driven through a `FrameAdapter` | `calculateAnimationState(clip, clipTime, timeLeft, w, h)` |
| **Model** | Declarative per-frame math | Seekable paused timelines (GSAP default) | **Imperative per-frame math — already a pure function of time** |
| **Keyframes** | `interpolate(frame, [in], [out])` | GSAP keyframes / CSS `@keyframes` via WAAPI | `clip.keyframes[prop]` + `getInterpolatedValue()` with per-keyframe easing |
| **Easing** | `Easing.*` (huge library) | GSAP/Anime easing | `EASING` map: linear, easeIn/Out, easeInOut, elastic, bounce |
| **Loop/ambient** | `loop()` helper | Timeline repeats / CSS infinite | `animLoop`: pulse, float, shake, spin |
| **Text/letter animation** | Per-letter via spans + `@remotion/transitions` style helpers | Via CSS/GSAP on split spans | Built-in per-letter presets (typewriter, letterPop, letterFade, rotate, bounce) + stagger |
| **Custom runtime** | React props | Any lib with a `FrameAdapter` | Keyframe editor UI (add/delete/seek keyframes, per-property reset) |

**Analysis of Studio Pro's animation engine (`calculateAnimationState`):**

```js
function calculateAnimationState(clip, clipTime, timeLeft, w, h) {
  let animAlpha = 1, animScale = 1, animX = 0, animY = 0, animRot = 0;
  const easeFn = EASING[clip.effects.animEase] || EASING.easeOut;
  if (clip.effects.animIn && clip.effects.animIn !== 'none') {
    const dur = clip.effects.animInDur || 1;
    const delay = clip.effects.animInDelay || 0;
    if (clipTime < delay + dur) {
      const p = easeFn(clamp((clipTime - delay) / dur));
      // fade → animAlpha *= p; slide → animY += (1-p) * dist; pop → scale with sine overshoot; ...
    }
  }
  // ... animOut using timeLeft, animLoop using clipTime ...
  return { animAlpha, animScale, animX, animY, animRot, mosaicLevel, puzzleLevel, puzzleDir };
}
```

This is **structurally identical to Remotion's `interpolate(frame, ...)`** and **conceptually identical to a HyperFrames `seek()` implementation**: given `clipTime`, it deterministically returns the full animation transform state. The output is a set of canvas transform parameters rather than CSS properties, but the *time→state* mapping is pure.

**The one determinism bug in the current code:** `animLoop === 'shake'` uses `Math.random()`:

```js
if (type === 'shake') { animX += (Math.random() - 0.5) * 10; animY += (Math.random() - 0.5) * 10; }
```

Every frame of every export produces different pixels. The puzzle-blocks path already solved this correctly with a **seeded PRNG** (`puzzleSeedFromId(id)` + `mulberry32`) — the shake path should use the same pattern (see Roadmap Phase 0).

---

## 3. Time Model & Playback

| | Remotion | HyperFrames | Studio Pro |
|---|---|---|---|
| **Frame source of truth** | Frame number | Seconds, quantized to frames | `State.currentTime` (seconds) |
| **Playback** | N/A (render-time only) | `seek()` via postMessage bridge in Studio iframe | rAF loop: `State.currentTime += (now - lastRenderTime)/1000` |
| **Scrubbing** | Dev preview re-renders | `seek(t)` — exact same code as render | `drawCanvas()` after setting `State.currentTime` — exact same code as export |
| **Deterministic?** | Yes (pure frame math) | Yes (enforced) | **No** — wall-clock `dt` + `Math.random()` shake |
| **Time quantization** | Implicit (integer frames) | `Math.round(t * fps) / fps` on every seek | **Not applied** — `State.currentTime` is a raw float |

**The good news:** Studio Pro's *render* path is already seek-based (`drawCanvas()` reads `State.currentTime`), and its scrub path already shares code with its export path (both call `drawCanvas(exportCtx, exportW, exportH)`). It's only the *playback clock* that is wall-clock — which is fine for interactive playback, and must simply be bypassed for deterministic export (Phase 1).

---

## 4. Rasterization / Frame Generation

| | Remotion | HyperFrames | Studio Pro |
|---|---|---|---|
| **Renderer** | React reconciler → DOM | HTML + CSS → DOM | `drawCanvas()` → Canvas 2D |
| **Frame output** | Chrome compositor screenshot | Chrome compositor screenshot (`beginFrame` or `captureScreenshot`) | `canvas` → `createImageBitmap()` (async) |
| **Determinism fight** | Chrome scheduling | Chrome scheduling (flags, warmup, heuristics) | **None needed** — pixels are drawn synchronously by the app |
| **Vector/text fidelity** | Browser's (excellent) | Browser's (excellent) | Canvas 2D text/shapes (good; `fontWeight` per letter, MathJax images, etc.) |
| **3D / shaders** | CSS 3D, WebGL via libs | WebGL via Three.js / TypeGPU adapters | Canvas 2D only today (3D extrude is simulated with layered shadows) |

**Why this matters for Studio Pro:** HyperFrames spent enormous engineering effort forcing Chrome to produce identical pixels (`--deterministic-mode`, begin-frame control, warmup loops, font pinning, pixel-hash heuristics). Studio Pro draws its own pixels — it inherits **none** of those problems. A Studio Pro "render" is just: `for each frame: set State.currentTime; drawCanvas(exportCtx, w, h); grab bitmap`. The only rasterization risks are async texture/video reads, already handled with `createImageBitmap()` + DOM-attached fresh video elements.

---

## 5. Capture & Encoding Pipeline

| | Remotion | HyperFrames | Studio Pro (MediaBunny) |
|---|---|---|---|
| **Capture** | Headless Chrome per frame | Puppeteer/CDP per frame (JPEG) | rAF loop → `createImageBitmap(canvas)` |
| **Video encode** | FFmpeg | FFmpeg | **WebCodecs via MediaBunny** (H.264/VP9) |
| **Audio encode** | FFmpeg (mix on server) | FFmpeg (mix in producer) | OfflineAudioContext pre-render → AAC/Opus chunks in worker |
| **Speed** | Faster-than-real-time (typically 5–20 fps rendered) | Faster-than-real-time | **Real-time only** (47s video = 47s export) |
| **Deterministic frames** | Yes | Yes | No (wall-clock) |
| **Runs where** | Node + Chrome (or Lambda) | Node + Chrome (or Lambda) | In-browser tab (main thread draws) |

**The single biggest gap: export speed.** Both HyperFrames and Remotion are *faster than real time* because they don't play anything — they seek and capture. Studio Pro's export is real-time because:

1. The export loop advances `State.currentTime` by wall-clock `elapsed` (mirroring playback).
2. Video clips are played at 1x via real `<video>` elements (per-frame seeking was abandoned after persistent `Video seek error` events).

Both are fixable without changing the renderer (Phase 1–2 of the roadmap).

---

## 6. Video-in-Video Handling

| | Remotion | HyperFrames | Studio Pro |
|---|---|---|---|
| **Approach** | Rust compositor decodes on demand → HTTP to `<OffthreadVideo>` | FFmpeg pre-extracts frames → JPEG flipbook `<img>` swap | Fresh DOM-attached `<video>` elements, seeked once, **played at 1x** |
| **Deterministic?** | Yes | Yes | **No** (real-time playback, decode variance) |
| **Speed cost** | Decode on demand (fast) | Pre-decode all (fast) | **Forces real-time export** |
| **Blob/stream URLs** | Supported | Limited | Supported (used today via `clip.fileUrl`) |

Studio Pro's real-time video playback is the main thing standing between it and faster-than-real-time export. The HyperFrames flipbook (pre-extract to frames, swap in stills) is directly applicable — and in the browser, Studio Pro can do even better than JPEG files: **decode each video frame to an `ImageBitmap` via WebCodecs or `createImageBitmap(videoEl)`** and swap those in during the seek loop, avoiding both the file I/O and the JPEG artifacts.

---

## 7. Audio

| | Remotion | HyperFrames | Studio Pro |
|---|---|---|---|
| **Mix** | Server-side (FFmpeg) from imported assets | FFmpeg producer mixes tracks | `OfflineAudioContext` pre-render to a single PCM buffer |
| **Per-clip DSP** | Media assets processed in code | Volume/pan via `data-*` | Full Web Audio graph: gain, pan, ducking, vocal-pocket, fades, effects |
| **Sync** | Frame-accurate via server | Frame-accurate | Chunk timestamps (µs) into MediaBunny worker |

**Studio Pro is ahead here** — its Web Audio graph (auto-duck, vocal-pocket EQ, volume ducking, per-clip gain/pan/fades) plus the `OfflineAudioContext` pre-render is a richer, already-deterministic pipeline than HyperFrames' basic volume/pan. The only known limitation: audio embedded in video clips isn't extracted (documented in `docs/export/MediaBunny-Export-Architecture.md`).

---

## 8. Nested Compositions / Scenes

| | Remotion | HyperFrames | Studio Pro |
|---|---|---|---|
| **Primitive** | `<Sequence>` + `<Composition>` nesting | Nested compositions (`data-composition-id`), tracks | `scene` clips → recursive offscreen-canvas render |
| **Semantics** | Pre-comps | Sub-compositions | Nested timelines with breadcrumb navigation |
| **Render** | Recursive React tree | DOM nesting | Recursive `drawCanvas(offCtx)` with per-scene `opaqueBg`/`bgColor` |

Studio Pro's scene feature (documented in `docs/features/Scene-Composition-Feature.md`) is functionally a **pre-composition system with an opaque/transparent background toggle** — same concept as HyperFrames compositions and Remotion Sequences. The recursive offscreen-canvas render is already a pure function of time. This is a strong foundation for the composition file format.

---

## 9. Determinism Scorecard

| Requirement | Remotion | HyperFrames | Studio Pro today |
|---|---|---|---|
| Frame is pure function of time | ✅ | ✅ | ✅ (`drawCanvas` + `calculateAnimationState`) |
| Time quantized to frames | ✅ | ✅ | ❌ |
| No wall-clock in frame path | ✅ | ✅ | ❌ (rAF `dt` in playback; `elapsed` in export) |
| No unseeded randomness | ✅ | ✅ | ❌ (`shake` uses `Math.random()`) |
| Fonts pinned/bundled | ✅ (bundler) | ✅ (`@fontsource` rewrite) | ⚠️ (system fonts + MathJax; needs audit) |
| Preview = render (same code) | ✅ | ✅ (sha256 enforced) | ⚠️ (same `drawCanvas` function, not enforced) |
| Video deterministic | ✅ (Rust compositor) | ✅ (flipbook) | ❌ (real-time playback) |
| Deterministic audio | ✅ | ✅ | ✅ (OfflineAudioContext) |

---

## 10. Distribution & Automation

| | Remotion | HyperFrames | Studio Pro |
|---|---|---|---|
| **CLI** | `npx remotion render` | `npx hyperframes render` | ❌ none (browser-only) |
| **Cloud** | Remotion Lambda (mature) | AWS Lambda packages | ❌ none |
| **CI-friendly** | ✅ | ✅ (deterministic by contract) | ❌ (needs a live browser tab) |
| **Agent skills** | Community (MCP servers) | 19 built-in skills + frame.md | ❌ none (Markdown generator is the seed) |
| **Embeddable player** | `<Player>` React | `<hyperframes-player>` web component | Preview canvas in-app |

---

## 11. Summary: What Studio Pro Already Has vs What It's Missing

### Already has (genuine strengths)
- ✅ **Pure time→frame render function** (`drawCanvas` + `calculateAnimationState`) — the hardest part, already solved
- ✅ **Preview and export share the same draw path**
- ✅ **Seeded PRNG pattern** for puzzle blocks (proven deterministic animation)
- ✅ **OfflineAudioContext** deterministic audio pre-render
- ✅ **Scene/pre-composition system** with opaque/transparent modes
- ✅ **Markdown → timeline compiler** (text-driven authoring seed)
- ✅ **WebCodecs encoding** (MediaBunny) — no FFmpeg dependency needed in-browser
- ✅ **No headless-Chrome determinism fight** (owns the rasterizer)

### Missing (the roadmap)
- ❌ Determinism hygiene: time quantization, no `Math.random()` shake, no wall-clock in export
- ❌ **Faster-than-real-time export** (seek loop instead of rAF playback loop)
- ❌ Deterministic video handling (pre-decoded frame flipbook instead of 1x playback)
- ❌ A **portable composition file format** (HTML or JSON+manifest) that plays standalone and is agent-editable
- ❌ Headless/offline render path (Worker/OffscreenCanvas, or a CLI wrapper)
- ❌ Agent authoring loop (timeline ↔ composition file round-trip; design tokens)
- ❌ Parallel/chunked rendering (Web Workers per chunk)

The roadmap document turns each "missing" item into a phased, implementable plan.
