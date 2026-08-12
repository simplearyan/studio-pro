# HyperFrames — Deep Dive

> **Date:** August 2026
> **Source:** github.com/heygen-com/hyperframes · hyperframes.heygen.com · HeyGen research post *"HTML to Video: How HyperFrames Solved AI Video Rendering"* (June 2026)
> **License:** Apache 2.0

HyperFrames is an open-source framework by HeyGen that turns **HTML, CSS, media, and seekable animations into deterministic MP4 videos**. It was built because LLMs are excellent at writing HTML — so HeyGen made HTML itself the video format, with a rendering pipeline that forces headless Chrome to produce the same pixels on every run.

---

## 1. The Pitch

> "Write HTML. Render video. Built for agents."

A composition is a plain HTML file. It plays as-is in a browser (no build step), it previews in the HyperFrames Studio with live reload, and it renders to a deterministic MP4 via the CLI or cloud.

```html
<div id="stage" data-composition-id="launch" data-start="0" data-width="1920" data-height="1080">
  <video class="clip" data-start="0" data-duration="6" data-track-index="0"
         src="intro.mp4" muted playsinline></video>

  <h1 id="title" class="clip" data-start="1" data-duration="4" data-track-index="1">Launch day</h1>

  <audio data-start="0" data-duration="6" data-track-index="2" data-volume="0.5"
         src="music.wav"></audio>

  <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
  <script>
    const tl = gsap.timeline({ paused: true });
    tl.from("#title", { opacity: 0, y: 40, duration: 0.8 }, 1);
    window.__timelines = window.__timelines || {};
    window.__timelines.launch = tl;
  </script>
</div>
```

Key features of the authoring model:

- **`data-composition-id` / `data-start` / `data-width` / `data-height`** — the stage/composition envelope.
- **`class="clip"`** + **`data-start` / `data-duration` / `data-track-index`** — a clip's place on the timeline (tracks are implicit via `data-track-index`).
- **`window.__hf = { duration, seek(timeSeconds) }`** — the single runtime contract (see §2).
- **Any animation library** — GSAP, Lottie, Three.js, Anime.js, CSS/WAAPI, TypeGPU — as long as it can be *paused and seeked* (see §3).

---

## 2. The One Trick: Seek, Don't Play

Every composition exposes exactly one thing to the runtime:

```js
window.__hf = {
  duration: 10,
  seek: (timeSeconds) => { /* position every clip, tween, and video */ }
};
```

**The renderer never calls `play()`.** It calls `seek(0)`, screenshots, `seek(1/30)`, screenshots, `seek(2/30)`, screenshots — 300 frames for a 10-second 30fps video. Time never advances on its own; nothing is driven by `requestAnimationFrame`. The browser's job is to hold a fixed frame until the next one is requested.

This one abstraction collapses two systems into one codebase:

- **Studio preview** — runs the same `window.__hf` inside an iframe with a `postMessage` bridge for play/pause/scrub. Scrub → `seek(t)`.
- **Headless render** — runs the same `window.__hf` via Puppeteer/CDP. Frame 147 → `seek(147 / fps)`.

Same code path. Same output. Preview/render parity is *enforced* by verifying a sha256 of the runtime bundle against a manifest before rendering.

---

## 3. Frame Adapters (the animation plugin system)

Animation libraries plug in through a three-method interface:

```ts
interface FrameAdapter {
  id: string;
  init?: (ctx) => Promise<void> | void;
  getDurationFrames: () => number;
  seekFrame: (frame: number) => Promise<void> | void;
}
```

- **GSAP is the default** because its timelines are already *paused-and-seekable* by design: `timeline.pause()` then `timeline.totalTime(t, false)` is exactly the needed functionality.
- **Lottie, CSS via WAAPI, Three.js clocks, Anime.js** all fit the same shape.

**What doesn't fit** — anything that insists on owning the clock:

- CSS keyframe animations without a controller
- `<video>` elements (they decode on their own schedule)
- Canvas libraries running their own `requestAnimationFrame`

For those, either wrap them in an adapter that takes the clock away, or **pre-render them to frames and replay them as images** — the same trick used for video (§6).

---

## 4. Capture: Controlling Chrome Frame by Frame

The naive first version was four lines of Puppeteer:

```js
await page.evaluate(t => window.__hf.seek(t), time);
await page.screenshot({ path: `frame_${i}.jpg` });
```

Four hard problems emerged:

### 4.1 `Page.captureScreenshot` races the renderer
The call returns an image as soon as the *compositor* is willing to hand one over — not when "layout is done, fonts are loaded, the GSAP tween committed its final style, and the GPU finished painting." Fix: "did the frame land" heuristics — poll `document.fonts.ready`, wait for computed styles, compare pixel hashes. This is the macOS/Windows path.

### 4.2 `HeadlessExperimental.beginFrame` gives real control (Linux)
A CDP method that runs one **layout → paint → composite → screenshot** cycle atomically and returns the result:

```js
await cdp.send("HeadlessExperimental.beginFrame", {
  frameTimeTicks,
  interval,
  screenshot: { format: "jpeg", quality: 80, optimizeForSpeed: true }
});
```

One call, one frame. The compositor is paused until the next request. The response includes `hasDamage` (did anything visually change?). No race conditions because there is no concurrent render pipeline settling in the background.

This requires a specific Chrome build + flags:

```
--deterministic-mode
--enable-begin-frame-control
--run-all-compositor-stages-before-draw
--disable-threaded-animation
--disable-threaded-scrolling
--disable-checker-imaging
--disable-image-animation-resync
--enable-surface-synchronization
```

Every flag disables a source of async scheduling (threaded compositor, threaded scrolling, incremental image decoding, image-animation resync, vsync surface timing). With `--deterministic-mode` even `performance.now()` is driven by the `frameTimeTicks` you pass in. **This combination works on Linux with `chrome-headless-shell`**; macOS/Windows fall back to `captureScreenshot` + heuristics.

### 4.3 Chrome stops advancing its event loop
With begin-frame control active, the main thread stops ticking on its own — no frame callbacks, no `setTimeout`, no microtask drain. `document.fonts.ready` never resolves → hangs forever. **Fix: a warmup loop** firing `beginFrame` every 33ms with `noDisplayUpdates: true`, which advances the event loop without producing a frame, until `window.__hf` is ready and fonts have loaded. Real capture then starts at a frame time *past* the warmup range so the compositor never sees time going backwards.

### 4.4 `page.waitForFunction` stops working
It polls via `requestAnimationFrame`, which doesn't fire in begin-frame mode. **Fix:** write the polling loop yourself with `evaluate` + `setTimeout`.

### The shipped capture loop

```js
for (let i = 0; i < totalFrames; i++) {
  const time = quantizeTimeToFrame(i / fps, fps);
  await page.evaluate(t => window.__hf.seek(t), time);
  const { buffer } = await beginFrameCapture(page, options, frameTicks, interval);
  writeFileSync(`frame_${i}.jpg`, buffer);
}
```

One seek, one beginFrame, one frame on disk. No retries, no flaky frames.

---

## 5. Determinism Engineering (the "Other Traps")

Controlling time and rendering gets you most of the way. The rest:

### Fonts
Google Fonts `@import` is a coin flip at render time (network speed, caching). **Fix:** every Google Fonts `@import` in the compiled HTML is rewritten to point at a local, base64-embedded copy of the font from `@fontsource`.

### Time quantization
A 30fps video has a frame every 33.3333ms. Two code paths computing the "same" nominal time differently can differ by a pixel. **Fix:**

```js
function quantizeTimeToFrame(time, fps) {
  return Math.round(time * fps) / fps;
}
```

Runs on *every* seek in both preview and render.

### Author rules (part of the contract)
- ❌ No `Date.now()` in composition code
- ❌ No unseeded `Math.random()`
- ❌ No network fetches at render time

Violating any of these produces nondeterministic output even with everything else in place.

---

## 6. The Video-in-Video Problem

Letting a browser *play* `<video>` at render time does not work: headless decoders skip frames, fail to decode, or sit at `readyState: 0` long enough to break the capture deadline — and different machines produce different output.

**HyperFrames' solution: take the decoding away from Chrome.**

1. **Pre-extract:** before capture, FFmpeg converts every `<video>` in the composition into numbered JPEGs at the target fps. A 5-second clip at 30fps becomes 150 files.
2. **Swap:** during capture, for each active video on the current frame, inject an `<img>` sibling with that frame's bytes as a data URI and hide the original `<video>`:

```html
<!-- before -->
<video data-start="2" data-duration="5" src="clip.mp4" />

<!-- at capture time, frame 60 of 150 -->
<video style="visibility: hidden" ... />
<img src="data:image/jpeg;base64,..." class="__render_frame__" />
```

3. **Style cloning:** copy ~a dozen computed styles (`position`, `transform`, `opacity`, `objectFit`, …) from the `<video>` onto the injected `<img>` so GSAP tweens, CSS transforms, opacity fades and object-fit all keep working. From the animation library's perspective nothing changed — it's just a still image that changes every frame. **A flipbook.**

**How others solve the same problem:**
- **Remotion** — a long-running Rust compositor decodes frames on demand and serves them over HTTP to `<OffthreadVideo>`.
- **Replit** — demuxes frames in the browser with `mp4box.js`, decodes via WebCodecs, paints into a `<canvas>`.
- **HyperFrames** — decode everything ahead of time in FFmpeg, serve JPEGs off disk. Simplest pipeline; harder to handle blob URLs / streaming sources / dynamically-set `src`.

---

## 7. Parallel & Distributed Rendering

- **Local parallel:** long renders split across N Chrome processes; each worker renders its share of frames; FFmpeg concatenates the per-worker MP4 chunks.
- **Gotcha:** video-heavy compositions can time out in parallel mode because Chrome can't seek multiple `<video>` elements simultaneously without exhausting decoders → drop to a single worker for video-heavy renders.
- **Cloud:** `@hyperframes/aws-lambda` — deploy a distributed render stack and drive renders from a laptop or CI.

---

## 8. The Agent Ecosystem

HyperFrames ships **19 agent skills** loaded on demand by coding agents (Claude Code, Cursor, Gemini CLI, Codex):

- **`/hyperframes`** — the router/capability map. Read first for any "make a video" request; picks a workflow and confirms the creation brief up front.
- **Creation workflows:** `/product-launch-video`, `/faceless-explainer`, `/pr-to-video`, `/embedded-captions`, `/talking-head-recut`, `/motion-graphics`, `/music-to-video`, `/slideshow`, `/general-video`, `/remotion-to-hyperframes` (one-way migration from Remotion).
- **Domain skills:** `/hyperframes-core` (the composition contract), `/hyperframes-animation` (adapters, scene blueprints, transitions), `/hyperframes-keyframes` (seek-safe keyframe authoring across runtimes), `/hyperframes-creative` (design direction, palettes, beat planning), `/media-use` (resolve any media need into a frozen local file), `/hyperframes-cli` (init/lint/check/snapshot/preview/render/publish/cloud), `/hyperframes-registry` (blocks & components), `/figma` (Figma → motion).

**frame.md** — the "design system for video": takes a web-context design spec (a `design.md`) and inverts it for the frame — same tokens, same rules, rewritten so an agent can compose a promo video without guessing at scale. A `DESIGN.md` superset.

**Catalog** — installable blocks/components: `npx hyperframes add flash-through-white` (shader transition), `instagram-follow` (overlay), `data-chart` (animated chart).

---

## 9. Package Ecosystem

| Package | Role |
|---|---|
| `hyperframes` (CLI) | Create, preview, lint, and render local video projects |
| `@hyperframes/core` | Types, parsers, generators, linter, runtime, frame adapters |
| `@hyperframes/engine` | Seekable page-to-video capture engine (Puppeteer + FFmpeg) |
| `@hyperframes/producer` | Full rendering pipeline: capture, encode, audio mix |
| `@hyperframes/studio` | Browser-based composition editor UI |
| `@hyperframes/player` | Embeddable `<hyperframes-player>` web component |
| `@hyperframes/shader-transitions` | WebGL shader transitions |
| `@hyperframes/aws-lambda` | Distributed renders (SDK + deployment surface) |

---

## 10. HyperFrames vs Remotion (their own comparison)

| | HyperFrames | Remotion |
|---|---|---|
| **Authoring** | HTML + CSS + seekable animation | React components |
| **Build step** | None; `index.html` plays as-is | Bundler required |
| **Agent handoff** | Plain HTML files | JSX / React project |
| **Animation clock** | Seekable, frame-accurate via adapters (library-clock) | Wall-clock patterns need care; frames are pure `useCurrentFrame()` |
| **Distributed rendering** | Local + AWS Lambda paths | Remotion Lambda (mature cloud renderer) |
| **License** | Apache 2.0 | Source-available Remotion License |

HyperFrames credits Remotion for pioneering the rendering patterns (headless Chrome, frame-by-frame capture), and Replit/Vinlic's WebVideoCreator for time virtualization + BeginFrame capture.

---

## 11. What Studio Pro Should Steal (Summary)

1. **The seek contract** — `drawCanvas()` already is one; formalize it.
2. **Time quantization** — `Math.round(t * fps) / fps` on every seek.
3. **No wall-clock in the frame path** — no `Math.random()` in shake; no `Date.now()` in composition code.
4. **Video flipbook pre-extraction** — decode video frames ahead of time, swap in stills at render time.
5. **Preview/render parity** — the same seek code drives preview and export (Studio Pro already uses `drawCanvas()` for both — enforce it).
6. **Composition-as-file** — a portable, self-contained HTML/JSON timeline format agents can edit.
7. **Agent skills + design tokens (frame.md)** — turn the Markdown → video generator into an agent-native production loop.
