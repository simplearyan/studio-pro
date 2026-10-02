# Studio Lite — build plan (phone-first Studio Pro)

A second app built on the *same core* as Studio Pro: one that works under a thumb on a
phone, scales up to an iPad and to a desktop, and shares the engine — not a copy of it.

This plan is written to be executed by an agent or by hand, one phase at a time, with the
existing app protected at every step. Every number in §1 was measured in this repo; the
files and line numbers are named so a reader can check them.

---

## 0. The one-paragraph version

Studio Pro is a 38,689-line single-file editor whose engine, UI, state and input handling
all live in one `<script>`; it is mouse-only by construction and has no automated tests.
A "lite fork" of that file would become a second divergent copy within weeks — we already
have three of those (`studio-pro-clean`, the `docs/html-in-canvas/` pages, the demos
folder) and one shared toolkit that is currently synced by hand between two repos. So:
**cut the engine out of the file behind a seam, ship it as versioned packages that both
apps consume, and let Studio Lite be a thin, touch-first shell over that core.** Studio Pro
keeps working at every step, because each extraction is a mechanical move with a
pixel-parity gate and one consumer switched per commit.

---

## 1. Where we are today (measured)

### 1.1 The shape of Studio Pro

| Thing | Reality |
|---|---|
| `index.html` | **38,689 lines** — head/meta/styles ≈1.7k, body markup ≈1.7k, the app script **lines 1746–37263**, then a `type="module"` block from 37265 for the MediaBunny worker bridge |
| App script | ~480 function declarations in **one** scope; one global `State` object (line 1791); one `window.StudioPro` API (line 10853) |
| `src/` | 13 files, ~2.4k lines total: `html-clips/` (5 files, 1,078), `html-in-canvas/` (5 files, 521), `styles/style.css` (669), `workers/export-worker.js` (126) |
| Build | Vite 8 + Tailwind 4 (PostCSS) + `vite-plugin-pwa`; `base` is `/studio-pro/` on Actions |
| Deploy | GitHub Pages; the workflow also builds **every `v*` tag** as a versioned snapshot under `/studio-pro/<tag>/` |
| Tests | **None.** No test runner in `devDependencies`; `automation/shared/tests/*.js` are ad-hoc scripts, `automation/test-export-speeds.mjs` is a benchmark |

### 1.2 Input reality (this is the crux of the request)

| Listener | Count in `index.html` |
|---|---|
| `mousedown` / `mousemove` / `mouseup` | 9 / 10 / 8 |
| `touchstart` / `touchmove` / `touchend` | **0 / 0 / 0** |
| `pointerdown` / `pointermove` | **0 / 1** (the single `pointermove` is an SFX trim-readout helper, line 20091) |
| `click` | 45 |
| `@media` queries | **1** (`max-width: 639.98px`) |
| Tailwind responsive prefixes | `sm:` 72, `md:` 1, `lg:` 6, `xl:` 0 |

Consequence, stated plainly: **drag, trim, resize, scrub and canvas selection cannot work on
touch today.** A finger produces `touch*` events, never `mousemove`, so every drag loop that
is built on `mousedown` + `mousemove` is dead on a phone. Taps still fire synthetic `click`,
which is why the app *looks* half-alive on a phone and then fails the moment you drag
something. This is not a styling problem and no amount of Tailwind prefixes fixes it.

### 1.3 The sharing we already have — and how it fails

`docs/html-in-canvas/` is a real, deliberate shared layer:

| File | Lines | Role |
|---|---|---|
| `hic-frame.js` | 482 | frame geometry + `HicRenderer` (SVG foreignObject → canvas), `curFrame` state, export prefs |
| `hic-modal.js` | 1,041 | the shared preview modal (player shell, transport, export toolbar, Code tab, AI tab) — written explicitly to replace per-page copies that had drifted |
| `hic-storyboard.js` | 258 | storyboard JSON → self-contained HIC clip compiler (the IITM ⇄ HIC bridge) |
| `hic-theme.js` / `.css` | 66 lines / 5.0KB | theme boot + toggle, `localStorage('hic_theme')` |
| `fix-webm-duration.js` | 513 | vendored third-party |

…and how it is consumed **today** — by hand:

| Consumer | What it holds | Sync |
|---|---|---|
| `docs/html-in-canvas/{test-renderer,designs,prompts-engineer}.html` | load `hic-*.js` by path in the same folder | same folder, fine |
| `../IITM/site/public/vendor/` (+ `dist/`) | **copies** of `hic-frame.js`, `hic-theme.js` | manual, no script, no CI check |
| `../IITM/runtime/` | **copy** of `hic-storyboard.js` + a hand-written `hic-storyboard.esm.js` wrapper | manual |
| `../html-in-canvas-demos/html-in-canvas/` | ~8 older single-file variants of the same animator | abandoned |
| `../studio-pro-clean/` | a **30,211-line fork** of the whole editor | abandoned |

And two *parallel implementations of the same engine* exist in this very repo:
`src/html-in-canvas/renderer.js` (ESM, `HTMLCanvasRenderer`, 521-line module) and
`docs/html-in-canvas/hic-frame.js` (classic script, `HicRenderer`). Same technique, two
codebases, drifting.

**This is the honest diagnosis: we do not have a core today. We have copies of a core.** Any
lite app built by copying again would make it worse, and the user's constraint — *don't
break any app* — is exactly a constraint about replacing those copies with a generated,
versioned source.

### 1.4 What is genuinely good and worth building on

- **`window.StudioPro` (line 10853)** with the M7 composition API and M8 animation system:
  a *scriptable* clip/timeline builder. It is already the contract that `.js` project files
  and AI agents write against — a public API that is already versioned in spirit.
- **A versioned project model**: `{ app: 'StudioPro', version, duration, canvasBgColor,
  aspectIndex, tracks[], clips[], markdownText, markdownConfig, subtitles… }` with
  `applyProject()`, `PROJECT_VERSION`, a project registry + per-project undo stacks, and a
  `.spcomp` interchange file (`spcomp: 1`, canvas/tracks/clips/markdown).
- **The engine modules that are already out of the file**: `html-in-canvas` (HIC renderer +
  WAAPI adapter + presets + font/image preload) and `html-clips` (iframes + html2canvas).
- **The export worker** (`src/workers/export-worker.js`) and the FTRT/MediaRecorder/GIF
  fallbacks — the hard part of "make a video in a browser" is already solved four ways.
- **The sample content is the best test fixture we own**: IITM's two questions with
  storyboards + scripts, and `docs/html-in-canvas/designs-gallery.json` (60KB of presets).

---

## 2. What "lite" means

### 2.1 Two tests decide everything in §3

1. **Job test** — could a person finish the job *on a phone, one-handed, in a queue*? If a
   feature is required for that, it is core.
2. **Share test** — can the code run in a second app with no knowledge of Studio Pro's
   `State`? If not, it needs a seam before it can be shared (§4.4).

### 2.2 The three jobs lite must do

- **J1 — Open and finish.** Open a project (own, or a `.spcomp`/`.js` from Pro), change some
  text or a picture, fix timing, export. *This is the highest-value job: it is what you do
  when you are away from the desk.*
- **J2 — Build a short from scratch.** Add text/shape/image/HIC clips, type a Markdown
  script and generate slides, add captions, pick an animation preset, arrange on a small
  timeline, export 9:16.
- **J3 — Capture and go.** Import from the camera roll, trim it, caption it, export, share.

Anything that is not needed for J1–J3 is "later" or "out", and it keeps living in Pro.

### 2.3 Non-goals for v1 (and where each one stays)

Per-letter styling · textures (grain/carbon/leather/neon) · 3D extrude · the keyframe
editor · the draw/ink/sketch engine + annotation library · colour correction · the audio
mixer and SFX trim UI · SRT overlap tooling · multi-project management · the automation
pipelines · the designs gallery as an authoring surface · custom/uploaded font management.
All of these stay in Studio Pro, which remains the place you go when the phone is not
enough. Lite is not "Pro with a smaller screen"; it is the phone-shaped path through the
same project file.

### 2.4 How we will know lite worked

| Signal | Target |
|---|---|
| Open a Pro project on a phone and export it | works end to end, no desktop detour |
| First interactive on a mid-range phone (4× CPU throttle) | **< 2.5 s** on a warm cache |
| Preview during an edit gesture | **≥ 30 fps** for text/shape/image/HIC clips at tier A |
| Every Pro project opened in lite | round-trips back to Pro **byte-identical** after save |
| Touch-only completion of J1 | no gesture that requires a mouse or a keyboard |

---

## 3. Feature inventory — every subsystem, tiered

**Tiers:** **CORE** (v1 lite, must work on touch) · **LATER** (v2, or when a device is big
enough) · **PRO** (stays in the editor, deliberately).

### 3.1 Project & persistence — *the contract lite must not break*

| Feature | Today | Tier | Sharing |
|---|---|---|---|
| Project object + `PROJECT_VERSION` + migrations | `index.html` ~33.5k | **CORE** | `@sp/core` — move it, it is pure data |
| `applyProject()` / serialise | same region | **CORE** | `@sp/core` (`toProject()` / `fromProject()`) |
| `.spcomp` import/export (`spcomp: 1`) | ~33.5k | **CORE** | `@sp/core` — the interchange format between the two apps |
| `.js` project files (script against `window.StudioPro`) | 33577–33690 | **CORE** (read) | `@sp/core` runner + `@sp/render` |
| Project registry, autosave, per-project undo | 33975–34014 | **CORE** (single project) / LATER (many) | `@sp/core` undo stack; lite ships one working project + a swap list |
| localStorage side stores (19 keys: `studiopro_*`, `custom_presets`, `theme`, …) | throughout | **CORE** | `@sp/core` storage adapter, **namespaced per app** (`lite:` prefix) so the two apps never fight over `studiopro_layout_config` |
| Undo/redo for canvas drags + keyframes (16689, 16751) | in-file | **CORE** (structural only) | `@sp/core` — one stack, command-based |

> Rule: **the project object is the API between Pro and Lite.** It is versioned, and every
> field lite cannot represent must survive a load→save round-trip untouched (unknown keys
> are preserved, never dropped). This one rule is what makes "open in lite, finish in Pro"
> safe, and it is testable in Node with no browser.

### 3.2 Canvas / render engine — *the biggest extraction*

| Feature | Today | Tier | Sharing |
|---|---|---|---|
| Clip → canvas draw pipeline (draw/HTML/text/shape/image/video/math paths) | 6.6k–9.2k | **CORE** | `@sp/render` behind a seam: `renderFrame(project, tMs, ctx)` |
| Static-layer cache for text/shape (5634) | in-file | **CORE** (it is why a phone survives) | `@sp/render` |
| Vector-math + image-math sprite caches (4916, 5141) | in-file | **CORE** | `@sp/render` |
| GPU capability detection (5365) | in-file | **CORE** | `@sp/render` (drives tier) |
| Image-load gates, alpha premultiply for H.264 (7597, 7922, 8070) | in-file | **CORE** | `@sp/render` — a phone exports too |
| Colour correction (5477) | in-file | PRO | stays; `@sp/render` keeps the hook |
| Draw-clip ink engine, MarkerForge, sketch engine, annotation library (9206–10330) | in-file | PRO | out of v1; extract later only if a phone needs it |
| Per-letter renderer (11744), textures (11854, 11956) | in-file | PRO | stays |

### 3.3 Elements & clip types

| Clip type | Today | Lite v1 | Notes |
|---|---|---|---|
| **Text** | full (per-letter, bg, stroke, shadow, extrude) | **CORE** — but plain: font/size/colour/align/bg/stroke/shadow, **no per-letter, no extrude** | the touch properties panel is the work, not the renderer |
| **Shape** | rect/ellipse/triangle/star/line/arrow/callout | **CORE** (rect, ellipse, star, line, arrow) | |
| **Image** | URL or upload + thumbnails | **CORE** + camera roll | `<input type=file accept="image/*">`, drag-position |
| **Video** | URL/file, auto audio track, mock while loading | **CORE** (trim + volume only) | iOS: no WebCodecs MP4 → the export fallback matters (§3.9) |
| **Audio** | file + built-in library, volume/pan/effects, waveforms | **CORE** (volume + one track) | library can wait; waveforms are costly — a cheap bar strip is enough on a phone |
| **Math (image)** | MathJax → cached image | LATER | KaTeX-in-the-page is the better phone path; decide in P6 |
| **Math (vector)** | vector shapes, crisp at any scale | LATER | heavy; the phone wins more from 12 presets than from vector math |
| **HTML clip** | raw HTML/CSS/JS, presets, html2canvas capture | **CORE** if HIC is in scope (see §3.12) | a phone authoring raw HTML is niche, but *playing* HIC is not |
| **HIC clip** (storyboard-compiled) | via `hic-modal` / `hic-frame` on the docs pages | **CORE** | this is how the IITM shorts are authored; lite is the natural place to trim them |
| **Scene** (group of clips) | full | LATER | scenes are how the generated slides are organised; v1 can flatten on import |
| **Captions** | SRT/VTT import → caption clips | **CORE** (import + edit text) | |

### 3.4 Timeline — *the interaction that must be rebuilt for touch*

| Feature | Today | Tier | Notes |
|---|---|---|---|
| Multi-track list, track headers, per-track height | 100% mouse | **CORE** | reimplemented against `@sp/core` data, not against Pro's DOM |
| Playhead scrub | mousedown drag | **CORE** | 1-finger horizontal drag on a 56px-tall ruler, ±1 frame snap at high zoom |
| Clip move between tracks | mousedown drag | **CORE** | long-press to pick up, auto-scroll near edges |
| Trim start/end | edge drag | **CORE** | 20px visual handle, 44px invisible target, magnetic snap |
| Split at playhead / blade tool | toolbar + drag | **CORE** (button only) | the blade *drag* is a desktop affordance; a button at the playhead covers it |
| Push/ripple trim | modifier drag | LATER | needs a well-understood gesture before it is safe to put under a thumb |
| Gap select + ripple delete | click + button | LATER | |
| Multi-select, group to scene, duplicate, copy/paste | modifier-click | LATER (duplicate yes) | Ctrl/Shift do not exist on glass; long-press → Duplicate covers the 80% |
| Timeline zoom | buttons/keys | **CORE** | pinch, plus −/+ buttons for discoverability |

### 3.5 Playback & animation

| Feature | Today | Tier | Sharing |
|---|---|---|---|
| Wall-clock playback loop, play/pause, seek | in-file | **CORE** | `@sp/render` + `@sp/core` clock (the IITM player already mirrors this model) |
| Animation **presets** (Transform in/out/loop, ~30) | 2439–2497 | **CORE** (a curated 12–16) | `@sp/core` presets → both apps, so Pro and Lite agree on what "fade in" means |
| Text animations (letter pop, sweep, stagger) | in-file | LATER | |
| Keyframe editor (custom tab, M8) | 4357, 11167 | PRO | the 8-property keyframe grid under a thumb is a lost cause; presets + duration/delay cover it |
| Determinism / M0 parity harness | 4395–4407 | **CORE** | keep it: it is the reason exports match the preview |

### 3.6 Audio

| Feature | Today | Tier |
|---|---|---|
| Volume/pan per clip, mute/solo per track | in-file | **CORE** (volume, mute) |
| Waveform rendering | in-file | LATER (cheap bars) |
| Built-in audio library | in-file | LATER |
| Mixer + SFX trim UI | in-file | PRO |
| Audio-only export | in-file | LATER |

### 3.7 Captions

| Feature | Today | Tier |
|---|---|---|
| Import SRT/VTT → caption clips | in-file | **CORE** |
| Edit caption text/timing per clip | in-file | **CORE** |
| Style panel (font, position, background) | in-file | **CORE** (3 knobs) |
| Captions → text clips | in-file | LATER |
| Overlap resolution UI, caption animations | in-file | PRO |

### 3.8 Markdown → video generator — *the best feature a phone can have*

| Feature | Today | Tier | Sharing |
|---|---|---|---|
| Markdown → clips (headings, paragraphs, images, math, mocks, video) | in-file | **CORE** | `@sp/core/markdown` — a pure parser, ideal for Node tests |
| Position tags `[top-left]`, `$$…$$ [center-right]` | in-file | **CORE** | same |
| Per-slide duration/delay, lanes, "generate from" | in-file | **CORE** | same |
| Presets (Animals, Σ Math, Showcase) | in-file | **CORE** | `@sp/core` |
| Style sub-tab, media sub-tab | in-file | LATER | |

This subsystem is the one to port first after the engine: it is pure data-in/clips-out, it
is phone-friendly (typing text is a phone-native act), and it is fully testable in Node.

### 3.9 Export

| Format | Engine | Tier |
|---|---|---|
| MP4 (MediaBunny / WebCodecs) | worker, `src/workers/export-worker.js` | **CORE** — Chrome/Edge/Opera |
| WebM (MediaBunny) | worker | **CORE** |
| MP4 (MediaRecorder) | in-page | **CORE — this is the iOS path.** iOS has no WebCodecs MP4; the fallback is not optional |
| MP4 (FTRT, 4× realtime) | in-page | LATER on phone (memory), CORE on iPad/desktop |
| GIF / audio-only | MediaRecorder | LATER |
| Resolution/FPS/time-range, settings remembered | in-file | **CORE** (720p/1080p, 24/30) |
| Progress + cancel | in-file | **CORE** — and it must survive a phone lock (§6.4) |

### 3.10 AI / API / automation

| Feature | Today | Tier |
|---|---|---|
| `window.StudioPro` M7 composition API + M8 animation | 10853–11288 | **CORE** (frozen contract, §4.6) — this is lite's scripting surface too |
| AI keys in localStorage (`studiopro_ai_key_*`) | in-file | LATER |
| `automation/` (md-render, html-in-canvas, Puppeteer) | `automation/` | PRO — but it consumes the same `@sp/core`, which is a free consistency win |
| `docs/html-in-canvas/*.html` pages | docs | **CORE to keep working** (they are shipped URLs), not to rebuild |

### 3.11 Shell, theme, PWA

| Feature | Today | Tier |
|---|---|---|
| Theme boot/toggle, `hic_theme` | in-file + `hic-theme.js` | **CORE** — one implementation for both apps |
| PWA: manifest, precache, CDN + Google-Font runtime caching | `vite.config.js` | **CORE** — a phone app that installs is a different product |
| Versioned snapshot deploy per `v*` tag | `deploy.yml` | **CORE** — reuse as-is |
| Top toolbar / sidebar / modals | 1.7k lines of markup | **PRO** — lite builds its own (§6) |
| Templates gallery, designs gallery, prompts-engineer | `docs/html-in-canvas/` | LATER (read-only list is cheap) |

### 3.12 The HIC toolkit — the already-shared core

**CORE, and it is the first thing to make official.** `hic-frame` (geometry + renderer),
`hic-modal` (preview + export shell), `hic-storyboard` (compiler), `hic-theme` (boot) are
the only parts of this project that already have two independent consumers, and they already
have a drift incident in their history (per `hic-modal.js`'s own header). They become
`@sp/hic` with **byte-identical classic builds**, so every existing `<script src>` path
keeps loading the same bytes (§4.3) — and the IITM copies become generated vendoring with a
CI check instead of a manual copy.

---

## 4. Shared core: architecture

### 4.1 Five layers, one direction of dependency

```
L4  app shells        studio-pro (index.html)      studio-lite (new)
L3  ui primitives     @sp/ui    gestures · sheet · slider · timeline list · toast · color
L2  engine            @sp/render (canvas)   @sp/export    @sp/hic (frame/modal/storyboard)
L1  core              @sp/core  project · schema · migrate · undo · clock · markdown · presets
L0  platform          no DOM, no state globals — pure functions
```

Rules that make it shareable:

1. **Dependencies point down only.** `@sp/core` never imports a UI module; `@sp/render`
   never reads a global; a shell never contains engine logic.
2. **Engines take a project object, not `State`.** `renderFrame(project, tMs, ctx, opts)` is
   the whole contract. Pro satisfies it by passing a projection of `State`; lite by passing
   its own store.
3. **No module may touch `window.StudioPro`.** That API is a shell-level façade.
4. **Nothing in L0–L2 may query the DOM by id, or use `localStorage` directly** — storage
   and layout are shell concerns; the packages take adapters.

### 4.2 Packages

| Package | Contents | Consumers | Test |
|---|---|---|---|
| `@sp/core` | project schema + `PROJECT_VERSION` + migrations, `toProject`/`fromProject`, `.spcomp` read/write, undo stack, time/clip math (split/trim/ripple), markdown→clips, storyboard compile, animation preset tables, storage adapter | Pro, Lite, automation CLI | **Node unit tests** — it is DOM-free |
| `@sp/render` | frame composition, clip drawers, static-layer cache, sprite caches, GPU/tier detection, image-load gates, alpha handling | Pro, Lite, automation (headless capture) | Node + **golden-frame** image diff |
| `@sp/export` | MediaBunny worker, FTRT, MediaRecorder, GIF, audio-only, progress/cancel protocol | Pro, Lite, HIC pages | Node (protocol) + manual device matrix |
| `@sp/hic` | `hic-frame`/`hic-modal`/`hic-storyboard`/`hic-theme` + the ESM `html-in-canvas` merge | Pro docs pages, **IITM**, demos, Lite | golden-frame + byte-parity of the IIFE build |
| `@sp/ui` | pointer/touch gesture layer, sheet, numeric+slider control, timeline list, color picker, toast, focus management | Lite (and Pro, opt-in per control) | synthetic-pointer tests (Playwright) |

### 4.3 Two build outputs per package — this is what keeps the old pages alive

Every package ships **both**:

- **ESM** (`dist/index.js` + types) for Vite apps — Pro's new imports, Lite, the automation CLI.
- **IIFE/classic** (`dist/hic-frame.js` etc.) with **byte-identical content** to today's
  `docs/html-in-canvas/*.js` in the first release, so:
  - `docs/html-in-canvas/{test-renderer,designs,prompts-engineer}.html` keep loading them
    from the same folder (the build copies the artifacts there — the file is generated, the
    HTML never changes),
  - `../IITM/site/public/vendor/hic-frame.js` keeps being the same bytes,
  - the deployed URLs `/studio-pro/docs/html-in-canvas/test-renderer.html` and
    `/chalkpress/vendor/hic-frame.js` keep resolving.

`scripts/vendor.mjs` writes those copies; `scripts/check-vendor.mjs` (a CI job) fails if a
committed copy differs from the freshly built artifact. **Hand copies end here.**

### 4.4 The seam: how to cut a 38k-line file without breaking it

Extracting `renderFrame` from `index.html` is the riskiest step in this plan, because the
render path touches `State`, the DOM canvas, caches and ~40 helpers. The protocol:

1. **Seam first, move second.** In `index.html`, introduce the façade *without moving
   anything*: `function renderFrame(project, tMs, ctx, opts)` whose body calls the existing
   code. Every existing call site routes through it. **One commit, no behaviour change**
   (verified: golden frames identical).
2. **Copy out, prove parity.** Create `@sp/render` by *copying* the implementation. Run the
   golden harness against both paths on the same fixture set. Diff pixels.
3. **Flip one consumer.** Pro calls the package; the in-file copy stays as dead code for one
   release.
4. **Delete the shim.** Mechanical deletion commit; the golden harness is the proof.
5. **Never mix.** A commit either moves code or changes behaviour — never both. This is what
   keeps `git bisect` usable on a file this size.

Same protocol for `@sp/core` (lower risk: pure functions) and `@sp/hic` (already separate).

**Fixtures** (this is why the harness is cheap): IITM's `pq-001`/`pq-002` storyboards, the
presets in `docs/html-in-canvas/designs-gallery.json`, three `.spcomp` samples (text/shape/image; HIC; captions),
and a markdown script that exercises every tag. Fixed frames (0, 1/3, 2/3, end) at fixed
sizes (450×800, 800×450, 1080×1920).

### 4.5 What we will *not* share

- **The DOM/UI of `index.html`** (1.7k lines of markup + the sidebar builders). Lite builds
  its own shell; forcing one layout on a phone and a 27-inch monitor is how both get worse.
- **`State`.** Consumers get projects; wrappers get storage.
- **Tailwind class soup at call sites.** First-party UI primitives mean one place to grow
  the design; the phone shell must not inherit 38k lines of desktop-era class names.
- **Pro-only subsystems** (§3): draw/ink, textures, per-letter, colour correction, 3D
  extrude, mixer. Sharing code nobody uses doubles the surface we must not break.

### 4.6 Frozen contracts (the "don't break" list, in writing)

| Surface | Rule |
|---|---|
| `window.StudioPro` (M7/M8) | **append-only.** No renames, no signature changes; new behaviour arrives as a new method or an options field. `.js` projects and agent workflows depend on it. |
| Project object + `PROJECT_VERSION` | additive only; a bump requires a migration in `@sp/core` and a round-trip test. **Unknown keys survive.** |
| `.spcomp` (`spcomp: 1`) | read-compatible forever; writers may add fields but never drop them. |
| Deployed URLs | `/studio-pro/`, `/studio-pro/<tag>/`, `/studio-pro/docs/html-in-canvas/*.html`, and IITM's `/chalkpress/vendor/*` — a path change needs a redirect commit *first*. |
| `localStorage` keys | Pro keeps `studiopro_*`; **lite uses a `lite:` namespace**. No cross-app key sharing; the shared unit is the project file. |
| Vendored files | generated by `scripts/vendor.mjs` only; CI fails on drift. |

### 4.7 Repo and workspace shape

```
studio-pro-editor/            (existing repo, existing URL — nothing moves out)
├── index.html                (Pro shell — shrinks as code moves out)
├── apps/lite/                (new app: its own index.html + vite config, same repo)
├── packages/core|render|export|hic|ui/
├── docs/html-in-canvas/      (pages unchanged; .js files become generated)
├── scripts/vendor.mjs  scripts/check-vendor.mjs  tools/golden.mjs
└── package.json              (npm workspaces: apps/*, packages/*)
```

One repo, one CI, one Pages deploy that publishes both apps (`/studio-pro/` and
`/studio-pro/lite/`). Rationale: the packages are only shippable together with both shells,
and a second repo would recreate the manual-sync problem at a new seam. `studio-pro-clean`
and `html-in-canvas-demos` get an `ARCHIVED.md` pointing at this repo.

---

## 5. Input: mouse, touch and pen in one layer

### 5.1 The design

One module owns gestures for both apps: `@sp/ui/gestures`. It listens to **Pointer Events**
(which cover mouse, touch and pen in one path) and exposes promises/callbacks per intent.
Nothing else in either app may listen to raw `mouse*`/`touch*` for editing.

```js
// shape of the API (spec, not final code)
const g = gestures(canvasEl, { touchAction: 'none' });

g.drag({                          // 1 pointer: move a clip
  onStart: (pt, e) => hitTest(pt),      // must return a hit in < 16ms
  onMove:  (pt, d, e) => setOffset(d),
  onEnd:   (pt, d) => commit(undoLabel('Move clip')),
  threshold: 6,                   // px before a tap becomes a drag
  axis: 'both' | 'x' | 'y',
});
g.pinch({ onScale, onPan });      // 2 pointers: zoom + pan (canvas + timeline)
g.longPress({ ms: 500, onFire: (pt) => contextMenu(pt) });   // with haptic if available
g.doubleTap({ onFire: (pt) => ... });
g.wheel({ onZoom });              // desktop trackpad/trackpad wheel — same handler
g.dragHandle({ el, hitSlop: 12 }); // trim/resize; visible 8px, invisible 44px
```

Requirements on the module:

- One active gesture at a time, with an explicit precedence ladder
  (`pinch > drag > longPress > tap`) so a second finger mid-drag upgrades instead of
  fighting; upgrade/downgrade emits cancel to the loser.
- `pointercancel` (OS interruption, scroll takeover) must end a drag cleanly — on iOS this
  happens constantly, and a stuck drag is the #1 touch bug.
- Every commit goes through one undo label; a drag is one undo entry, not 200.
- No `setTimeout`-based tap detection where `pointerup` + `click` will do.

### 5.2 Gesture map (lite)

| Surface | 1 finger / mouse | 2 fingers | long-press | double-tap |
|---|---|---|---|---|
| **Stage (preview)** | drag clip → move; tap → select | pinch → zoom stage; drag → pan | context menu (duplicate, delete, order) | select + open properties |
| **Timeline ruler** | drag → scrub | pinch → zoom time; drag → scroll | — | jump playhead to start/end of clip |
| **Clip on timeline** | drag → move (tracks + time) | — | pick up / context menu | select + open properties |
| **Clip edge** | drag → trim | — | — | — |
| **Sheet (panel)** | drag → resize/close | — | — | cycle snap points |
| **Desktop** | exactly the above with the mouse, plus `wheel` = scroll, `ctrl+wheel` = zoom | | right-click = context menu | as above |

Keyboard on iPad/desktop mirrors Pro's shortcuts **for the features lite has** (`K` play,
`R` restart, `F` fullscreen, `←/→` ±1 frame, `S` split, `⌘/Ctrl+Z` undo, `⌘/Ctrl+E`
export) — so muscle memory transfers between the two apps.

### 5.3 Touch ergonomics (non-negotiable rules)

1. **44px minimum** for anything you press; 12px invisible hit-slop for trim/resize handles.
2. **Handles are offset, not centred**, so the finger does not cover what it is moving —
   draw the affordance above/left of the touch point, or collapse the stage to make room.
3. **No hover-only affordances.** In lite a control is either always visible, or revealed by
   a gesture (tap/long-press), never by a cursor passing over it. (Pro learned this lesson in
   the player: the chrome there is always visible for the same reason.)
4. **`touch-action` is explicit per surface**: `none` on stage/timeline (we own the gesture),
   `pan-y` on scrollable sheets, `auto` on the page.
5. **Never fight the browser**: no `preventDefault` on a passive listener; no custom
   double-tap-to-zoom on a surface that also needs pinch.
6. **Feedback ≤ 100ms** — a drag that has not visually moved within 100ms reads as broken.
   Hit-test on `pointerdown`, not on the first `pointermove`.
7. **One thumb reach**: primary actions live in the bottom 40% of the screen.

### 5.4 Mobile platform specifics (each one is a real bug if skipped)

| Issue | Handling |
|---|---|
| iOS Safari `100vh` + toolbar | `100dvh` + `env(safe-area-inset-*)` padding on every fixed edge; test with the toolbar shown and hidden |
| Keyboard opening | `visualViewport.resize` → keep the focused field above the keyboard; never `position: fixed` a bar under it |
| File import | `<input type=file accept="image/*,video/*" capture>` (camera) and `multiple`; read via `FileReader`/`createImageBitmap`, never a data URL for large video |
| Storage quota | media blobs in IndexedDB, not `localStorage`; the project object stays small; surface a quota error before export, not during |
| Backgrounding | exports continue in a Worker; on `visibilitychange` pause the preview loop (a phone that keeps rendering in a background tab drains the battery) |
| Doze / screen lock | Web Locks or a Wake Lock (`navigator.wakeLock`) during export, with a visible "keep this screen open" hint |
| iOS export reality | **no WebCodecs MP4** → the MediaRecorder fallback is the primary path there; verify it before promising MP4 on iOS |
| Thumbnails | generate at 320px, cache in IndexedDB, never decode full video for a filmstrip |
| Orientation change | recompute stage fit + DPR without reloading the project (the canvas re-rasters, the data survives) |

---

## 6. Studio Lite — the app

### 6.1 Layout by tier

| Tier | Width | Layout |
|---|---|---|
| **A — phone** | < 768px | one column. Top bar (project name, undo, export). Stage fills the middle with a floating transport. Bottom dock: **Clips · Inspect · Add · Export**. Everything else arrives in a **sheet** that rises from the dock, draggable between 50% and 92%, dismissible by drag-down. |
| **B — tablet / iPad** | 768–1199px | stage on the left, inspector panel pinned right (no sheet), timeline as a bottom strip that can expand. Touch **and** keyboard/trackpad. Apple Pencil = pen pointer → the future home of the ink tools. |
| **C — desktop** | ≥ 1200px | three panes like Pro, but with lite's reduced panels and lite's gesture layer on top of the mouse. Same project file, same shortcuts. |

The dock is the phone replacement for Pro's six-tab sidebar: `Add` (text/shape/image/video/
audio/HIC/captions/markdown), `Inspect` (properties for the selection), `Clips` (the list +
track order), `Export`. Four destinations, each one thumb-height away.

> **Open amendment (see [`studio-lite/CLIP-LITE-PATTERN-PLAN.md`](studio-lite/CLIP-LITE-PATTERN-PLAN.md) §5).**
> A working phone-editor prototype argues that the **selection-bound property editors** (speed,
> volume, filter, rotation, transition, text, canvas) should be an **in-flow bar above the dock**
> that pushes the stage up — one tool at a time, live preview, `Cancel` / `Reset` / `Done` — and
> that the rising sheet should be reserved for list-shaped, non-modal surfaces (project browser,
> export options, add-media, settings). Reason: the sheet covers the preview during the most
> common task, and its drag-to-dismiss competes with the sliders inside it. Decide before P5.

### 6.2 What a phone screen shows during a drag

The stage must give up space to the thing you are manipulating: while a clip is being moved
or resized, the sheet collapses, the dock fades, and the stage grows to the largest legal
frame. This is the single biggest difference between "desktop UI in a narrow window" and a
phone editor, and it is why lite cannot reuse Pro's markup.

### 6.3 Device tiers and budgets

Reuse Pro's GPU capability detection (line 5365) to pick a tier at boot:

| Tier | Example | Preview | Effects | Notes |
|---|---|---|---|---|
| **A** | mid Android / iPhone SE | 720p, DPR capped at 2 | static-layer cache on, one HIC clip at a time, procedural textures off | export 720p30 default |
| **B** | iPad, recent iPhone | 1080p | cache on, HIC clips as needed | export 1080p30/60 |
| **C** | desktop | native | all lite features | FTRT export enabled |

Budgets: shell JS ≤ 150KB gzip (vs Pro's monolith), first interactive < 2.5s on a 4×
throttled mid-phone, edit-gesture frame time ≤ 33ms at tier A, memory ≤ 400MB with 10 clips
including one video.

### 6.4 Offline and install

The PWA setup already in `vite.config.js` (manifest, precache, runtime caching for
fonts/CDN) applies to lite unchanged: the phone app installs to the home screen, works
offline, and keeps user fonts cached. Add: precache the lite shell only (not the 2.1MB
MathJax bundle) unless math is in scope for v1; keep the worker precached because the export
path needs it offline.

---

## 7. Phases

Each phase is independently shippable and each one leaves Pro working. "Gate" = the commands
or measurements that must pass before the next phase starts.

### P0 — Guardrails first (no product change)
**Do:** golden-frame harness (`tools/golden.mjs`, Playwright + pixel diff + tolerance),
Node test runner for pure code, 6 fixture projects, `scripts/check-vendor.mjs`, a CI job that
runs build + golden + vendor check, and a documented Pro smoke script (load → add text →
drag → trim → split → export 720p).
**Gate:** harness reproduces today's frames with zero diff; CI green on a no-op PR.
**Why first:** without this, every later phase is a hope. This is also what turns "don't break
the app" from an intention into a check.

### P1 — `@sp/core` (project, markdown, presets)
**Do:** move the project schema/migrations/`.spcomp`/undo/markdown-parser/preset tables into
the package; Pro imports them and the in-file copies are deleted behind the seam protocol
(§4.4). Storage becomes an injected adapter.
**Gate:** Node tests + golden frames unchanged + `.spcomp` round-trip byte-identical + Pro
smoke passes.

### P2 — `@sp/render`
**Do:** the seam in `index.html`, then the package; Pro switches; caches and tier detection
move too.
**Gate:** golden diff = 0 across all fixtures at 4 frames × 3 sizes; Pro export bit-rate and
duration unchanged on a 10s fixture; preview frame time not worse by > 5%.

### P3 — `@sp/hic` + generated vendoring
**Do:** merge the two renderer lineages (ESM `HTMLCanvasRenderer` ↔ classic `HicRenderer`)
into one source with two builds; generate `docs/html-in-canvas/*.js` and the IITM copies;
add the drift check; document the merge in `docs/html-in-canvas/`.
**Gate:** the three docs pages behave identically (golden + manual matrix); IITM site builds
**5 pages** and its player renders identically; `check-vendor` passes in both repos.
**Risk:** this is the phase that touches another repo — sequence it alone, in its own
release, with IITM's own commit.

### P4 — `@sp/ui/gestures` in Pro (touch works in Pro before lite exists)
**Do:** replace the mouse-only handlers in Pro with the gesture module, surface by surface
(canvas drag/resize → timeline scrub/move/trim → sheet-like panels). Mouse behaviour must be
**indistinguishable** (same pixel results, same undo granularity).
**Gate:** synthetic-pointer test suite (mouse + touch emulation) green; manual pass on a
real phone: move/trim/split/scrub all work; Pro's undo entries are one per gesture.
**Why here:** the fastest way to prove the touch layer is real is to put it under the app
that already has users — and it halves the work lite inherits.

### P5 — Lite shell, vertical slice
**Do:** `apps/lite/` with the tiered layout (§6.1), the dock + sheet, the stage with floating
transport, the touch timeline — one end-to-end path: **open a `.spcomp` → scrub → select →
move → export 720p WebM**.
**Gate:** that path completes on a real phone, one-handed, with no mouse and no console
error; first interactive < 2.5s (4× throttle).

### P6 — Lite feature build-out
**Do:** add clips (text/shape/image/video/audio/HIC), markdown generator, captions import +
edit, animation presets (curated 12–16), properties per type, undo/redo UI, project list with
one active project.
**Gate:** J2 complete on a phone for a 15-second 9:16 short, from empty project to exported
file, without touching Pro.

### P7 — iPad + desktop tiers
**Do:** tier B/C layouts, keyboard shortcuts, trackpad/wheel zoom, Pencil-ready pen path.
**Gate:** the same project edited on tablet and desktop produces equivalent exports; shortcut
parity table with Pro documented.

### P8 — Interop, offline, device matrix
**Do:** open Pro projects (registry + `.js` project scripts), save back without loss, PWA
install, offline export, quota handling, the full device matrix run.
**Gate:** "start in Pro, finish on a phone, reopen in Pro" round-trips with zero diff;
lite installs and exports with the network off.

### P9 — Beta
**Do:** `/studio-pro/lite/` deploy, a `v*` tag (the workflow already snapshots it), docs page,
in-app "open in Pro" / "open in Lite" links, telemetry-free error banner.
**Gate:** beta checklist in §8.6 + no increase in Pro's bundle size beyond the shared
packages' real weight.

---

## 8. Verification & QA

### 8.1 Golden-frame parity (the spine)
`tools/golden.mjs run --app pro|lite|core` renders each fixture at 4 timestamps × 3 sizes and
diffs against committed PNGs (`docs/qa/golden/`). Tolerance: 0 differing pixels for engine
work; explicitly re-blessed (new PNG committed with a message saying why) for intentional
rendering changes. **Every extraction phase must show a zero-diff run.**

### 8.2 Contract tests (Node, no browser)
- project: load → save round-trip byte-identical, unknown keys preserved;
- migrations: every `PROJECT_VERSION` → current;
- `.spcomp` import → project → `.spcomp` idempotent;
- markdown: every tag/position/number-of-clips assertion;
- presets: each preset produces a deterministic `clip` at t=0/mid/end;
- timeline math: split/trim/ripple invariants (no clip with negative duration, no overlap on a track).

### 8.3 Gesture tests (Playwright)
Synthetic `pointer*` sequences with `pointerType: 'touch'`: tap, drag-threshold, long-press,
pinch (two pointers), drag + `pointercancel`, second-finger upgrade mid-drag, edge auto-scroll.
Assert on the **project diff** and on undo-entry count, not on internal calls.

### 8.4 Device matrix (minimum)
iPhone (Safari, iOS 17+), mid Android (Chrome), iPad (Safari, trackpad + Pencil), desktop
Chrome/Edge/Firefox/Safari. Per device: J1, J2, export, install, offline, rotate mid-edit,
background/foreground during export.

### 8.5 Perf budgets (§6.3) as CI gates where possible, manual where not
Bundle size is a build-time assert; first-interactive and frame time come from a Lighthouse
CI run (the repo already keeps a `LIGHTHOUSE_REPORT.md`) plus a scripted phone profile for
the manual pass.

### 8.6 The "don't break Pro" checklist (every phase, in this order)
1. `npm run build` in the repo root → success.
2. `npm run check:vendor` → no drift.
3. `node tools/golden.mjs run --app pro` → 0 diff (or a blessed re-bless with a reason).
4. Pro smoke script on desktop **and** a phone: add, drag, trim, split, copy, export.
5. The three `docs/html-in-canvas` pages load and render (they are public URLs).
6. IITM: `cd ../IITM/site && npm run build` → **5 pages**, then a player page renders math and animation.
7. `git status` clean of unrelated files; no `git add -A`.
8. Report the hashes; never push or tag without being asked.

---

## 9. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Extracting from the 38k-line file breaks Pro subtly | **High** | Seam-first protocol, golden frames, one consumer per commit, no behaviour change in a move commit |
| The two renderer lineages (ESM vs classic) have silently diverged | **High** — already true | P3 makes the merge explicit with fixtures from *both* consumers before any deletion |
| IITM drifts from the HIC core while this work happens | Medium | Generated vendoring + `check-vendor` in both repos; IITM keeps its own commit and its 5-page build gate |
| Touch layer regresses mouse behaviour in Pro | Medium | `@sp/ui` test suite runs mouse and touch sequences; Pro's smoke + golden gate |
| iOS export promise ("MP4") is not achievable | **High** | Decide in P6: WebM/MediaRecorder is the iOS path, stated in the UI; never ship a format button that cannot work |
| Lite quietly becomes a second Pro (scope creep) | **High** | §2.3 non-goals are contractual; every new feature must pass the job test *and* name what it replaces |
| Phone perf collapses with 1080p + video | Medium | Device tiers (§6.3) chosen at boot; budget asserts in CI |
| Same-origin storage collisions between the two apps | Low | `lite:` namespace for keys; the shared unit is the project file, not localStorage |
| Versioned snapshot deploys serve a stale core for old tags | Low | Tags keep building from their own tree (existing workflow); packages are not referenced from old tags |

---

## 10. Decisions I need from you

1. **Where does lite live?** (a) same repo under `apps/lite/` with npm workspaces *(recommended:
   one CI, one Pages deploy, no new manual-sync seam)*, or (b) a separate repository that
   consumes published packages.
2. **How much of the element set is v1?** My recommendation: text, shape, image, video
   (trim only), audio (volume only), HIC/storyboard clips, captions, markdown-generated
   slides — everything else LATER. This is the single biggest scope lever.
3. **Is HIC in v1?** It is the best content pipeline we own (and IITM's shorts are built from
   it), but it is also the most engine-heavy. Recommended: yes, *play/trim* in v1; *author
   raw HTML* LATER.
4. **iOS export format** — accept WebM/MediaRecorder on iOS and say so in the UI, or hold the
   iOS release until MP4 works? Recommended: accept, and label it.
5. **Do we retire the forks?** `studio-pro-clean` and `html-in-canvas-demos` get
   `ARCHIVED.md`; the IITM copies become generated. Recommended: yes — they are the reason
   this plan exists.
6. **Do we keep `designs.html` / `prompts-engineer.html` on the shared core**, or freeze them
   as-is? Recommended: keep them on `@sp/hic`; they are small, public, and the cheapest
   regression test the toolkit has.

---

## 11. Appendix — evidence index

| Claim | Where |
|---|---|
| 38,689-line single file; app script 1746–37263 | `index.html` |
| `State` (line 1791); `window.StudioPro` (10853); M7 (10935), M8 (11167) | `index.html` |
| Project model / `applyProject` / `.spcomp` importer | `index.html` ~33577–33690 |
| Project registry, per-project undo, autosave migration | `index.html` 33975–34014 |
| Static-layer cache (5634), sprite caches (4916, 5141), GPU detect (5365), colour correction (5477) | `index.html` |
| Render paths: draw (6684), HTML (6839), html2canvas (6864), image gates (7597, 7922), alpha (8070) | `index.html` |
| Ink/sketch/annotation engines (9206–10330); per-letter (11744); textures (11854, 11956) | `index.html` |
| Animation presets (2439, 2497); keyframes (4357) | `index.html` |
| Undo/redo + timeline snapshots (16689, 16751) | `index.html` |
| Mouse-only input counts; single `pointermove` (20091) | `index.html` |
| PWA manifest/precache/runtime caching; `docs/html-in-canvas` static copy | `vite.config.js` |
| Tag-snapshot deploy | `.github/workflows/deploy.yml` |
| HIC toolkit + its drift note | `docs/html-in-canvas/hic-{frame,modal,storyboard,theme}.js` |
| ESM renderer lineage | `src/html-in-canvas/renderer.js` |
| Hand copies into another repo | `../IITM/site/public/vendor/hic-{frame,theme}.js`, `../IITM/runtime/hic-storyboard*.js` |
| Abandoned forks | `../studio-pro-clean/` (30,211-line `index.html`), `../html-in-canvas-demos/html-in-canvas/` |
| Executable phone-edit-loop prototype (2 iterations) | `docs/studio-lite/clip-lite-mock.html`, `clip-lite-mock-v1.html`; analysis in `CLIP-LITE-PATTERN-PLAN.md` |
| 33 feature plans already written | `docs/features/` |
| No test runner | `package.json` devDependencies; `automation/shared/tests/*` are ad-hoc |
