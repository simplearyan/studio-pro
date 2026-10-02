# Studio Reel — Feature Roadmap

> **Status:** roadmap, nothing implemented. This is the **tracker**: one place that holds every Studio
> Reel feature, its phase, its dependencies, and the release it ships in.
> **Date:** October 2026
> **Design reference:** [Studio-Reel-Plan.md](./Studio-Reel-Plan.md) — the four artifacts, the compiler
> stages, the lint gates, and the folder structure. This document does not restate those; it schedules
> them and adds the features the plan does not yet cover.
> **Written after:** the Studio Pro analysis in §1–§2 (verified against the tree, not this prose).

---

## 0. How to read this

- **§1** is what Studio Pro already is, measured. It is the reason Studio Reel is cheap to build.
- **§2** is the gap: what Studio Pro does *not* do that a "compile a film from Markdown, then open it
  in the editor and finish it by hand" story needs.
- **§3–§7** are the roadmap: phases `R0`–`R8`, the cross-cutting tracks that gate them, the release
  each phase lands in, and a per-feature tracker.
- **§8–§11** are the decisions still open, the definition of done, the risks, and the explicit
  non-goals.

Vocabulary (fixed in the plan, used throughout): a **frame** is a reusable layout; `design:` names a
brand package; `tone:` is a palette variant; the output of the compiler is a **reel**
(`Storyboard.html`); the CLI is `reel`.

---

## 1. Analysis — what Studio Pro already gives Studio Reel

Measured against the tree, with the evidence that matters. Studio Reel is not a new renderer; it is a
front-end on top of these six systems.

### 1.1 The editor is a complete finishing environment

`index.html` is a single ~38,800-line file: a multi-track timeline with scenes (nested compositions),
keyframes, per-letter text styling, a mixer, captions, and a canvas renderer. Its clip vocabulary is
`text · shape · image · video · audio · hic · scene · draw`. Crucially for Studio Reel, **a
HTML-in-Canvas clip is an ordinary timeline citizen** — `type: 'hic'` carries `html`/`css`/`js` plus
`start`, `duration`, `trackId`, `effects`, and `keyframes`, and it gets the same property panel,
transform, blend, border, shadow, in/out animations, and trimming as any other clip.

> **What this buys Studio Reel:** "open a film in the editor and customize it" is a *feature of the
> clip model*, not something to invent. The editor can already put a `type: 'hic'` clip on a video
> track and layer video and audio tracks around it.

### 1.2 The niche the editor already has is the niche Studio Reel sells

HyperFrames and Remotion both rasterize through **headless Chrome capturing the DOM/React tree**.
Studio Pro rasterizes through **Canvas 2D that it owns**, so it needs no headless capture to render a
frame — `drawCanvas(ctx, w, h)` already renders the exact frame for `State.currentTime`. That is the
HyperFrames "treat time as a pure input" contract, already present.

**But** the *HTML* path does not use Canvas 2D for its pixels: it rasterizes HTML through SVG
`foreignObject`. So there are **two rasterizers in the tree** — Canvas 2D for native clips, the
HIC renderer for HTML clips — and a composition is a *stack* of both. Studio Reel should not pretend
otherwise; it compiles into the HTML rasterizer and inherits the stack.

### 1.3 The HIC engine is already structured to be a compile target

| Module | Lines | Role for Studio Reel |
|---|---|---|
| `docs/html-in-canvas/hic-storyboard.js` | 258 | **the emitter.** `compileStoryboard(sb)` → self-contained clip `{name, dur, html, css, js, ds}` whose `onFrame(t)` *is* the interpolator. Already has scenes, elements, staggered cards, KaTeX, and a standalone-page builder. |
| `docs/html-in-canvas/hic-frame.js` | 482 | the raster engine (`HicRenderer`) — SVG `foreignObject`, design-space tables, external-script hoisting. |
| `docs/html-in-canvas/hic-modal.js` | 1041 | the player shell — transport, scrub, Save Frame, **Preview/Code/AI tabs with CodeMirror**, WebM export. |
| `src/engines/hic/adapters/waapi.js` | 454 | compiles CSS `@keyframes` → `onFrame` (the "I don't want a spec" escape hatch). |
| `index.html` `HIC_PRESETS` | — | 19 presets (built-in + 7 ported), each `{name, dur, html, css, js}`. |
| `index.html` `StudioPro` API | — | `html() · text() · image() · video() · audio() · shape() · scene()` + `createComposition() · keyframes() · interpolate() · spring() · fonts`. |

**The single most important fact in this document:** `hic-storyboard.js` already consumes a
`storyboard.json` IR and already emits a self-contained reel. Studio Reel's compiler is a **Markdown →
that IR** front-end. The render path does not change.

### 1.4 The IR is the contract, and it has one honest hole

`storyboard.json` is documented by `hic-storyboard.js`'s header as `templates/storyboard.schema.json`
— **and that file is not checked in anywhere in the repo.** The emitter is the de-facto schema. Any
serious roadmap has to write the schema down (R1), because the compiler, the linter, and the
decompiler all validate against it.

### 1.5 Automation exists, and it is video-only

`automation/html-in-canvas/` (render.js 517, cdp-capture.js 389, api.js 289) renders a composition to
MP4/WebM two ways: **`-m cdp`** (default — standalone page per clip + CDP screenshots + ffmpeg) and
**`-m editor`** (drives the running editor's own export pump, MediaBunny or FTRT). The pollution
showcase proved it: 780 frames, 1920×1080, 30 fps, 586 distinct.

**And it has zero audio support** — no `audio` reference in render.js, cdp-capture.js, or api.js. The
`cdp` path extracts only `html/css/js/fonts/duration` from a composition and encodes frames. Headless
renders are silent by construction.

### 1.6 The design layer is half-built and pointing the right way

- `docs/html-in-canvas/designs-gallery.json` + `designs.html` — a browsable catalogue of rendered
  HIC designs, each with its own html/css/js. A reel is a gallery candidate by construction.
- `docs/hyperframes/Design-Templates-and-Skills-Plan.md` — the `.sptpl` plan: a design template is a
  **collection of customizable typed presets**. `Design.md` is the human face of an `.sptpl`.
- `docs/hyperframes/AGENTS.md` + `automation/shared/skills/` (`product-launch`, `social-reel`,
  `kinetic-text`) — the existing skill/contract shape that `reel-*` skills should mirror.
- `docs/html-in-canvas/prompts-engineer.html` — the prompt→design surface.

---

## 2. Gap analysis — what is actually missing

Seven gaps, ranked by whether they block the "author a film, open it, finish it, export it three
ways" story.

| # | Gap | Evidence | Blocks |
|---|---|---|---|
| **G1** | **No schema for the IR.** The emitter's referenced `storyboard.schema.json` does not exist in the tree. | `hic-storyboard.js` header; no such file | Compiler, lint, decompile |
| **G2** | **No Markdown front-end.** `Design.md`/`Frame.md`/`Storyboard.md` are prose today; nothing parses them into the IR. | the whole point of Studio Reel | Authoring |
| **G3** | **No way to get a reel *into* the editor.** Nothing turns a `Storyboard.html` (or its IR) into a `type: 'hic'` clip. | no importer entry point; `addHicClipToTimeline` only takes a preset key | Editor round-trip |
| **G4** | **A reel is one clip.** All scenes live inside a single `onFrame(t)`; you cannot cut between scenes or insert media *between* two scenes of the same reel. | `compileStoryboard` emits one `html`/`css`/`js` | Editor round-trip |
| **G5** | **The headless pipeline is silent.** No audio anywhere in `automation/html-in-canvas/`. | grep: no `audio` in render/cdp-capture/api | Automation export |
| **G6** | **No round-trip back to Markdown.** `reel eject` and `decompile.js` are planned; nothing exports an *edited project* back to a `Storyboard.md`. | plan §4.4/§6 | Editor round-trip |
| **G7** | **Media/asset resolution is unresolved.** How `Design.md` names fonts and images offline is an open question; the CLI cannot inline or validate them. | plan §10 Q2/Q3 | Any film with media |

Plus two **cross-cutting** tracks that are not Studio Reel features but gate its releases:

- **X1 — retire the editor's html2canvas path.** The legacy `type: 'html'` render branch and its
  196 KB library are dead code (`addHtmlClipToTimeline` has zero callers; migration rewrites legacy
  clips; `_isWaaapi` is never set) but still shipped on every load. `HTML-ENGINE-CONSOLIDATION-PLAN.md`
  §Phase 4 names this; the Versioning Guide names it as the `v0.4.0-alpha` headline.
- **X2 — determinism is a contract, not yet a gate.** `no-clock` / `no-random` are enforced by
  convention in the emitter and relied on by the renderer. Studio Reel formalises them as lint (R3).

---

## 3. Roadmap at a glance

Phases `R0`–`R8`. The plan's `P0`–`P5` map onto `R0`–`R4` and `R7`; `R5`, `R6`, `R8` are new,
and they are the ones that answer "open it in the editor and finish it".

| Phase | Name | Gate (what proves it) | Release | Depends on |
|---|---|---|---|---|
| **R0** | Reference film, spec-first (**P0**) | the hand-compiled `Storyboard.html` renders frame-identical to `pollution-story.js` | — | — |
| **R1** | IR + schema + emitter (**P1**) | the R0 IR renders end-to-end with no hand-editing; `storyboard.schema.json` checked in | `v0.4.x` | R0, **G1** |
| **R2** | Markdown front-end (**P2**) | the R0 `Storyboard.md` compiles to the R0 `Storyboard.html` | `v0.5.0-alpha` | R1, **G2** |
| **R3** | Lint + decompile (**P3**) | a deliberately broken storyboard fails each gate with a line number; the decompiler round-trips R0 | `v0.5.x` | R2, X2 |
| **R4** | Frame library (**P4**) | a new film is authored without touching CSS | `v0.6.0-alpha` | R3, §1.6 |
| **R5** | Audio & media (**new**) | a reel with music and a video insert renders with sound, headless | `v0.6.x` | R2, **G5**, **G7** |
| **R6** | Editor round-trip (**new**) | open a reel, add video + audio, export by hand, and decompile back to `Storyboard.md` | `v0.7.0-alpha` | R3, R5, **G3**, **G4**, **G6** |
| **R7** | Design-template bridge & skills (**P5**) | a look designed in the app produces a spec that renders, and a spec produces a template the gallery applies | `v0.8.0-alpha` | R6, §1.6 |
| **R8** | Distribution | a reel is shareable (deep link / gallery / eject) and renderable off-thread | `v1.0.0-beta` | R6 |

Ordering rule from the plan, kept: **R0 ships no code.** If the four artifacts cannot express the film
that already exists, no compiler will fix that.

---

## 4. Phases in detail

### R0 — Reference film, spec-first *(plan P0)*

Re-express the existing pollution showcase (`automation/html-in-canvas/examples/pollution-story.js`,
4 scenes, 26 s) as `Design.md` + `Frame.md` + `Storyboard.md`, then **hand-compile** it into the
`Storyboard.html` that today is that `.js`, and render both.

- [ ] `Design.md` — the Aurora-style token set already sketched in the plan §3.1.
- [ ] `Frame.md` — stage, safe areas, type ramp, motion language, beat grid.
- [ ] `Storyboard.md` — 4 scenes as beats, with `frame:`, `tone:`, copy, stats.
- [ ] Hand-written `storyboard.json` in the plan §3.5 shape.
- [ ] Hand-compiled `Storyboard.html` that renders frame-identically.
- [ ] Render both via `-m cdp`; diff frame counts and luma per scene.
- [ ] Record what the artifacts **could not** express (prose, in the film folder).

**Gate:** frame-identical. **Deliverable:** the golden reference every later phase is tested against.
**Risk if skipped:** the whole format is designed against an imagined film.

### R1 — The IR, the schema, and the emitter *(plan P1)*

- [ ] **Write down `templates/storyboard.schema.json`** (G1) — the plan's §3.5 shape, including the
      two sections the current compiler ignores (`tokens`, `frame`), with unknown keys preserved.
- [ ] `storyboard.json` → `hic-storyboard.js` → `Storyboard.html` as a CLI step.
- [ ] Teach `automation/html-in-canvas/render.js` to accept an **`.html` composition directly**
      (today it renders `.js` compositions that *create* clips).
- [ ] Round-trip check: the R0 IR emits a reel byte-identical to the R0 hand-compiled one mod
      formatting.
- [ ] Schema validation as a hard error with a JSON pointer.

**Gate:** R0 renders end to end with zero hand-editing. **This is the phase that retires the biggest
architectural unknown** — the emitter already exists; the schema does not.

### R2 — The Markdown front-end *(plan P2)*

The compiler: parse → resolve tokens → layout → time → emit → validate (plan §4.1).

- [ ] `src/parse.js` — front-matter + `##` scene sections → normalized beats.
- [ ] `src/resolve.js` — `Design.md` + `Frame.md` → CSS custom properties (`Frame.md` wins; mismatch
      is a warning).
- [ ] `src/layout.js` — safe areas, one measure pass per text element, type ramp; overflow → error.
- [ ] `src/timeline.js` — beats → `[start, end)`; `narration:` → duration (open decision, §8).
- [ ] `src/emit.js` — IR → `storyboard.json` → `Storyboard.html`.
- [ ] Font resolution up front; a missing font is a **hard error**, never a silent substitution.
- [ ] Decide **where the compiler runs** (Node vs browser) — plan §10 Q5. Default: Node, so CI is
      headless; revisit at R6.

**Gate:** the R0 `Storyboard.md` compiles to the R0 `Storyboard.html`.

### R3 — Lint + decompile *(plan P3)*

- [ ] The seven gates: `no-clock`, `no-random`, `text-overflow`, `unknown-frame`, `missing-asset`,
      `duration-mismatch`, `contrast`.
- [ ] Each failure names a **line number** in the source Markdown, not just the IR.
- [ ] `src/decompile.js` — IR → `Storyboard.md` (needed by R6).
- [ ] `reel lint` exits non-zero; wire it as a CI step.

**Gate:** a deliberately broken storyboard fails each check; the decompiler round-trips R0.

### R4 — The frame library *(plan P4)*

- [ ] Named frames: `title-stats`, `cards-3`, `split-icons`, `statement`, `chart`, …
- [ ] Palette variants via `tone:` (normal / alarm / positive).
- [ ] A frame preview page so a frame can be seen before it is used.
- [ ] `reel new` scaffolds `Design.md` / `Frame.md` / `Storyboard.md` from `starters/`.

**Gate:** a new film is authored without touching CSS. **This is the phase that makes Studio Reel a
product rather than a format.**

### R5 — Audio & media *(new — closes G5, G7)*

The plan flags these as open questions; the roadmap makes them a phase, because "add audio" is the
second half of the user story and the only part the automation path cannot do today.

- [ ] **Decide the audio model** (plan §10 Q3): an audio **track alongside** the reel, or a new IR
      section. Consequence: if audio is part of the reel, `duration` moves from *derived* to
      *declared*.
- [ ] **Asset resolution** (plan §10 Q2): how `Design.md`/`Storyboard.md` name images, video, and
      fonts — URL, project-relative path resolved at compile time, or both — with `missing-asset`
      covering all of them.
- [ ] **Headless audio (G5).** `automation/html-in-canvas/` has no audio at all. Two options:
      (a) mux a sidecar audio file in the encoder step; (b) route headless renders through
      `-m editor`, which already pre-queues audio buffers ("`[FTRT] queued all audio up-front`").
      Document the choice; (a) is cheaper and deterministic, (b) is already correct.
- [ ] Video inside a reel (a video element that seeks deterministically, like the flipbook plan).
- [ ] `reel render` produces an MP4 **with sound** in `-m cdp`.

**Gate:** a reel with music and a video insert renders with sound, headless.

### R6 — Editor round-trip *(new — the user story — closes G3, G4, G6)*

"Open a film in the editor, add video/audio, export it — by hand, by CLI, or by automation." Almost
every piece exists (§1.1); the missing pieces are these.

- [ ] **The "Open reel" importer (G3).** Parse a self-contained `Storyboard.html` → `{html, css, js}`
      → `addHicClipToTimeline`. Because a reel is self-contained by contract, this is a `<style>` +
      `<script>` + body extraction — no parser needed. Accept the IR (`storyboard.json`) too.
- [ ] **Decide one-clip vs per-scene-clips (G4).** *Reel as one clip* keeps the continuous
      `@keyframes` design and is a one-line import; *reel as N clips* is editor-native (each beat
      trimmable, media can sit between beats) but the compiler must emit one clip per scene. **Make
      this a compiler option** and let the importer choose; do not force one.
- [ ] Verify the **editor-side export** of an imported reel: FTRT pre-renders HIC frames as Stage 1
      of its progress bar; MediaBunny is the other engine. Both already handle `type: 'hic'`.
- [ ] **Decompile a project back to `Storyboard.md` (G6)** — R3's `decompile.js`, pointed at an edited
      timeline, so hand edits are not a one-way door.
- [ ] `reel eject` — `Storyboard.md` → a plain `examples/*.js` composition, so a film is never locked
      in.

**Gate:** open a reel, add a video clip and an audio clip on their own tracks, export by hand, then
decompile back to a `Storyboard.md` that recompiles to the same film.

> **Note on the export matrix.** After R6 all four paths should carry a reel:
> *by hand* → editor export (MediaBunny / FTRT); *by CLI* → `-m editor` (carries audio today) and
> `-m cdp` (video-only until R5); *by automation* → the same CLI in CI. **The only silent path is
> `-m cdp`, and R5 is what fixes it.**

### R7 — Design-template bridge & skills *(plan P5)*

- [ ] **Export:** an app design template → `Design.md` (tokens) + a starter `Frame.md`.
- [ ] **Import:** `Design.md` → an `.sptpl` the gallery can apply, so a film's look is WYSIWYG-editable.
- [ ] Round-trip test in both directions (Markdown is canonical; `.sptpl` is derivable — plan §4.2).
- [ ] `reel-brief` · `reel-storyboard` · `reel-render` in `automation/shared/skills/`, mirroring the
      existing skill shape.

**Gate:** a look designed in the app produces a spec that renders; a spec produces a template the
gallery applies.

### R8 — Distribution

- [ ] A reel as a **gallery entry** in `designs.html` — film and spec in one card.
- [ ] **Deep link:** `test-renderer.html?src=Storyboard.html`.
- [ ] **Save Frame** parity (already in `hic-modal`).
- [ ] Off-thread / parallel render (the FTRT + worker direction from
      `Roadmap-Programmatic-Video.md` Phase 2), if render time justifies it.
- [ ] Cloud render (stretch) — HyperFrames uses Lambda; Studio Pro's Canvas-2D owns its pixels, so a
      plain worker farm is enough.

---

## 5. Cross-cutting tracks

### X1 — Retire the editor's html2canvas path *(gates the `v0.4.0-alpha` release)*

The legacy `type: 'html'` path is dead but still shipped. Retire it as one change, not a folder delete
(deleting `src/html-clips/html2canvas.min.js` alone leaves a 404 on every load and fails *silently*
behind `typeof html2canvas !== 'undefined'` guards):

**Done (2026-10-02).** One commit removed the library, its script tag, the `type === 'html'` render
branch, and every helper on it. The remaining inert UI (`#htmlEditorModal`, the `_isWaaapi` read
sites) is tracked in [LEGACY-CLIP-REMOVAL-PLAN.md](../LEGACY-CLIP-REMOVAL-PLAN.md) §G.1.

- [x] Drop the `<script src="src/html-clips/html2canvas.min.js">` tag and the folder.
- [x] Delete the `type === 'html'` render branch, `window.__waapiSeekFrame`, `preRenderAllHtmlClips`,
      `window.addHtmlClipToTimeline`, and the two `_needsHtmlWait` export waits. *(also
      `preRenderHtmlClip` and `WAAPI_SEEK_ADAPTER`.)*
- [x] **Keep** `migrateLegacyHtmlClips` + `htmlToHicCode` — the safety net for old projects; neither
      depends on html2canvas.
- [x] Verify: build unchanged; a pre-change project still renders; no 404 in the console.

### X2 — Determinism as a gate, not a habit

- [ ] `no-clock` / `no-random` promoted from emitter convention to lint (R3).
- [ ] Quantize time to frames in the emitted `onFrame` (already true in the emitter's eases).
- [ ] Keep the rule that the emitted reel never reads `Date`, `performance`, `rAF`, `setTimeout`, or
      unseeded `Math.random()`.

### X3 — Versioning & releases

Per the Versioning Guide and its new §11 (tag is the source of truth; `package.json` and an in-app
stamp mirror it):

- [ ] `v0.4.0-alpha` — html2canvas retired; Studio Reel R0–R1 (IR + schema + emitter).
- [ ] `v0.5.0-alpha` — R2–R3 (Markdown front-end, lint, decompile).
- [ ] `v0.6.0-alpha` — R4–R5 (frame library; audio & media).
- [ ] `v0.7.0-alpha` — R6 (editor round-trip).
- [ ] `v0.8.0-alpha` — R7 (design-template bridge + skills).
- [ ] `v1.0.0-beta` — R8 (distribution); first release where `package.json` **must** match the tag.

### X4 — Docs & vocabulary

- [ ] Keep the frame/design/tone vocabulary consistent everywhere (no "recipe").
- [ ] Every phase closes by recording what actually shipped, in this document, not a new one.
- [ ] Index every new artefact in `docs/README.md` and `docs/hyperframes/README.md`.

---

## 6. Feature tracker

Every feature named anywhere in this roadmap, in one list. `Dep` = the gap(s) it closes.

| ID | Feature | Phase | Dep | Surface |
|---|---|---|---|---|
| F1 | `Design.md` / `Frame.md` / `Storyboard.md` authoring | R0 | — | Markdown |
| F2 | Hand-compiled reference `Storyboard.html` | R0 | — | file |
| F3 | `storyboard.schema.json` (checked in) | R1 | G1 | repo |
| F4 | `storyboard.json` → reel emitter (CLI) | R1 | G1 | CLI |
| F5 | `.html` composition accepted by `render.js` | R1 | — | CLI |
| F6 | Schema validation w/ JSON pointer errors | R1 | G1 | CLI |
| F7 | Markdown parser (front-matter + scenes) | R2 | G2 | lib |
| F8 | Token resolver (`Design.md` + `Frame.md` → CSS vars) | R2 | G2 | lib |
| F9 | Layout engine (safe areas, measure, type ramp) | R2 | G2 | lib |
| F10 | Timeline/beat engine (`narration:` → duration) | R2 | G2 | lib |
| F11 | Font resolution (hard error, no substitution) | R2 | G7 | lib |
| F12 | Seven lint gates, line-numbered | R3 | X2 | CLI/CI |
| F13 | IR → `Storyboard.md` decompiler | R3 | G6 | lib |
| F14 | Named frame library | R4 | — | frames/ |
| F15 | `tone:` palette variants | R4 | — | frames/ |
| F16 | Frame preview page | R4 | §1.6 | page |
| F17 | `reel new` scaffolding from `starters/` | R4 | — | CLI |
| F18 | Audio model decision + IR section | R5 | G5 | spec |
| F19 | Asset resolution (`Design.md`/`Storyboard.md` → offline) | R5 | G7 | spec |
| F20 | Headless audio (mux in encoder, or `-m editor`) | R5 | G5 | CLI |
| F21 | Video inside a reel (deterministic seek) | R5 | G7 | engine |
| F22 | `reel render` → MP4 with sound (`-m cdp`) | R5 | G5 | CLI |
| F23 | **"Open reel" importer → editable hic clip** | R6 | G3 | editor |
| F24 | **Per-scene-clips compiler option** | R6 | G4 | compiler |
| F25 | Editor-side export of an imported reel (verified) | R6 | — | editor |
| F26 | Project → `Storyboard.md` round-trip | R6 | G6 | CLI/editor |
| F27 | `reel eject` → plain `.js` composition | R6 | — | CLI |
| F28 | App template → `Design.md` / `Frame.md` export | R7 | §1.6 | editor |
| F29 | `Design.md` → `.sptpl` import | R7 | §1.6 | editor |
| F30 | `reel-brief` / `reel-storyboard` / `reel-render` skills | R7 | — | skills |
| F31 | Reel as a `designs.html` gallery entry | R8 | — | page |
| F32 | Deep-link preview (`?src=Storyboard.html`) | R8 | — | page |
| F33 | Off-thread / parallel render | R8 | — | engine |
| F34 | Cloud render (stretch) | R8 | — | infra |
| X1a | html2canvas path retired | X1 | — | editor |
| X1b | Pre-change projects still render | X1 | — | test |
| X2a | `no-clock` / `no-random` as lint | R3 | — | CI |

---

## 7. Release map

| Release | Ships | Proven by |
|---|---|---|
| `v0.4.0-alpha` | X1 (html2canvas retired) · R0 · R1 | R0 frame-identical; R1 IR renders |
| `v0.5.0-alpha` | R2 · R3 · X2 | R0 `Storyboard.md` compiles to R0 reel; lint fails loudly |
| `v0.6.0-alpha` | R4 · R5 | new film, no CSS; reel with music + video insert, headless |
| `v0.7.0-alpha` | R6 | open → edit → export → decompile round-trip |
| `v0.8.0-alpha` | R7 | design ⇄ spec both directions |
| `v1.0.0-beta` | R8 | a reel is shareable and renderable at scale |

---

## 8. Open decisions

These are decisions, not tasks — each one changes downstream work, so they should be settled at the
phase that owns them.

1. **Compiler host** (R2) — Node for CI, or in-browser for live preview? The IR and lint are shared
   either way. *Default: Node.*
2. **One-clip vs per-scene clips** (R6) — the biggest single fork. Recommend a compiler option, with
   per-scene the default once editing beats previewing. (§4 R6)
3. **Audio model** (R5) — track alongside, or IR section. Determines whether `duration` stays derived.
4. **Headless audio route** (R5) — mux in the encoder (cheap, deterministic) vs `-m editor` (already
   correct, slower, needs a dev server).
5. **Asset naming** (R5) — URL, project-relative path, or both.
6. **`narration:` → duration** (R2) — default, opt-in, or always explicit.
7. **Where films live** — the plan's `automation/studio-reel/films/` is decided; whether the repo's
   own showcase films move there (from `automation/html-in-canvas/examples/`) is not.

---

## 9. Definition of done

Studio Reel is done when all of these are true, end to end:

1. A writer authors `Design.md` + `Frame.md` + `Storyboard.md` in plain Markdown — **no HTML**.
2. `reel compile` emits a deterministic, self-contained `Storyboard.html`, and `reel lint` proves it
   deterministic and on-brief.
3. `reel render` produces an MP4 **with audio**, headless, from the same spec.
4. The same reel opens in the editor, where video and audio clips can be layered around (and, in
   per-scene mode, between) its scenes; exporting by hand, by CLI, and by automation all carry
   picture *and* sound.
5. Any project round-trips back to Markdown, so editing in the app is never a one-way door.
6. Nothing about the render path was rewritten to get here — the reel is a HIC clip, and the HIC
   pipeline, the editor exporter, and the automation CLI are all unchanged.

---

## 10. Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| R0 is skipped and the format is designed against an imagined film | the whole project is built on a guess | R0 ships no code and is a hard gate |
| Two time models (design space vs output px) | a spec renders right in the modal, wrong in the CLI | specs are always design-space; lint rejects output-pixel literals |
| Markdown → film is under-expressive | authors reach for HTML and the format dies | R0 gate; `eject` (F27) always available |
| One-clip reel cannot be finished in the editor | the headline user story fails | F24 makes per-scene a compiler option *before* R6's gate |
| Headless renders stay silent | "export with automation" is half-true | F20 makes it a phase gate, not a backlog item |
| Generated `Storyboard.html` drifts | a hand-edit is lost on the next compile | the reel is never hand-edited; `eject` produces the editable artefact instead |
| Design.md / .sptpl divergence | two sources of truth | Markdown is canonical; `.sptpl` is derivable and round-trip tested |

---

## 11. Explicit non-goals

- **No new renderer.** Studio Reel compiles to the existing HIC pipeline. If a phase seems to need a
  new rasterizer, the phase is wrong.
- **No second schema.** `storyboard.json` is the IR; the schema (F3) documents it, it does not replace
  it.
- **No React, no bundler, no accounts** for authors — Markdown and a CLI.
- **No "Hyper*" naming.** The system is Studio Reel; the output is a reel.

---

*See also: [Studio-Reel-Plan.md](./Studio-Reel-Plan.md) (the design), [README.md](./README.md) (the
HyperFrames/Remotion landscape), [Design-Templates-and-Skills-Plan.md](./Design-Templates-and-Skills-Plan.md)
(`.sptpl`), [Roadmap-Programmatic-Video.md](./Roadmap-Programmatic-Video.md) (FTRT/parallel),
[HTML-ENGINE-CONSOLIDATION-PLAN.md](../HTML-ENGINE-CONSOLIDATION-PLAN.md) (§Phase 4 = X1), and
[HTML-IN-CANVAS-PIPELINE-PLAN.md](../automation/HTML-IN-CANVAS-PIPELINE-PLAN.md) (the render pipeline
this compiles into).*
