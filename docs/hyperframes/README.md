# HyperFrames — Analysis & Roadmap for Studio Pro

> **Date:** August 2026
> **Purpose:** Deep analysis of HeyGen's open-source **HyperFrames** (HTML → video) and **Remotion** (React → video), a side-by-side comparison with Studio Pro's own animation → rendering pipeline, and a phased plan for making Studio Pro produce programmatic, deterministic, agent-authorable video the way those tools do.

---

## TL;DR

HyperFrames and Remotion both solve the same problem with the same core trick:

> **Treat time as a pure input.** Every frame is a *function of time* — `seek(t)`, not "play and capture". Render deterministically: one seek → one frame → encode.

- **HyperFrames**: compositions are plain **HTML files** with `data-*` timing attributes and a `window.__hf.seek(time)` contract. Headless Chrome seeks frame-by-frame; FFmpeg encodes. Designed so **AI agents** (and humans) can write videos by writing HTML.
- **Remotion**: compositions are **React components** that are pure functions of the frame number (`useCurrentFrame()`). Headless Chrome renders each frame; FFmpeg encodes. The original "videos as code" pioneer.
- **Studio Pro**: an in-browser WYSIWYG editor that draws to a **Canvas 2D** context. Its `drawCanvas()` is *already a seek function* — it renders the exact frame for `State.currentTime`. What it lacks is the deterministic render *loop*, the faster-than-real-time export path, and the "composition as a file that agents can edit" format.

**The opportunity:** Studio Pro is closer to HyperFrames than it looks. Because it owns the rasterizer (Canvas 2D), it doesn't need headless Chrome at all — it can render frames at CPU speed, far faster than real time, in the browser itself. The roadmap below turns `drawCanvas()` into a true `seek()` contract, pre-decodes video frames (HyperFrames' JPEG-flipbook trick), and exports the timeline as a self-contained, agent-editable HTML composition.

---

## Documents

| Doc | Contents |
|---|---|
| [HyperFrames-Deep-Dive.md](./HyperFrames-Deep-Dive.md) | Full architecture analysis of HyperFrames: authoring model, the seek contract, frame adapters, the headless-Chrome capture pipeline, determinism engineering, video-in-video, parallel rendering, agent skills, and the package ecosystem. |
| [StudioPro-vs-Hyperframes-vs-Remotion.md](./StudioPro-vs-Hyperframes-vs-Remotion.md) | Side-by-side comparison **from animation to rendering**: authoring model, animation system, time model, rasterizer, capture, encoding, determinism, video handling, audio, distribution. |
| [Roadmap-Programmatic-Video.md](./Roadmap-Programmatic-Video.md) | The phased plan to make Studio Pro create videos like HyperFrames and Remotion: deterministic seek contract → FTRT export → video pre-decoding → HTML composition export → agent authoring loop → (optional) CLI/headless/cloud. |

---

## One-Paragraph Summary of Each

### HyperFrames (HeyGen, Apache 2.0)
"Write HTML. Render video." A composition is an HTML file: `<div data-composition-id data-width data-height>` + `.clip` elements with `data-start` / `data-duration` / `data-track-index` + a `window.__hf = { duration, seek(t) }` object. The renderer **never calls play()**. It calls `seek(0)`, screenshots, `seek(1/30)`, screenshots, … for every frame. Animation libraries plug in via a 3-method `FrameAdapter` (GSAP is default because its timelines are already paused-and-seekable). Rendering is headless Chrome (`HeadlessExperimental.beginFrame` for atomic layout→paint→composite→screenshot on Linux; heuristics on macOS/Windows), with heavy determinism engineering: local fonts, time quantization, no `Date.now()`, no unseeded `Math.random()`, video pre-extracted to JPEG flipbooks by FFmpeg. Ships 19 agent skills, a catalog of blocks, and AWS Lambda rendering.

### Remotion (source-available)
"React → video." A composition is a React component rendered inside a virtual `<Sequence>`; frames are pure functions of `useCurrentFrame()`. Rendering uses headless Chrome per frame + FFmpeg encoding, with a Rust compositor serving `OffthreadVideo` frames on demand. Mature cloud rendering via Remotion Lambda. The main trade-off: authoring requires a React project + bundler, which is what made HeyGen move to plain HTML.

### Studio Pro
An in-browser, single-file (27k-line `index.html`) Canvas-2D video editor: multi-track timeline, Markdown → video generator, captions, per-letter text styling, keyframe editor, scenes (nested compositions), and WebCodecs-based MediaBunny export. `drawCanvas(targetCtx, w, h)` renders the exact frame for `State.currentTime`; `calculateAnimationState(clip, clipTime, timeLeft, w, h)` computes animation values *purely as a function of clip-relative time* — already the HyperFrames shape. The gaps: playback/export are wall-clock real-time, video clips must play at 1x, shake uses `Math.random()`, and there is no composition-file format or headless path.

---

## The Core Strategic Choice

| | HyperFrames / Remotion | Studio Pro |
|---|---|---|
| **Rasterizer** | Browser DOM + CSS (needs headless Chrome capture) | Canvas 2D (owns the pixels) |
| **Render speed** | Fast — frame seeking is cheap, Chrome capture is the bottleneck | Currently real-time only — but *could* be CPU-bound fast because drawing is cheap |
| **Determinism** | Enforced by contract + flags | Not yet enforced, but the render function is already pure |
| **Agent authoring** | Native (HTML/React files) | Not yet — but the Markdown → timeline generator is a head start |
| **Ecosystem** | CLI, catalog, Lambda, skills | Single-file app |

**The plan's north star:** make Studio Pro's timeline *exportable as a self-contained HTML composition with a `seek()` contract* — the best of both worlds. Users keep the WYSIWYG editor; agents and automation get a portable, deterministic, renderable file.
