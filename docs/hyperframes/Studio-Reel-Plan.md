# Studio Reel — films from four files

> **Status:** plan, not implemented. Written after the first HIC showcase film
> (`automation/html-in-canvas/examples/pollution-story.js`) proved the render path end to end.
> **Date:** October 2026
> **Roadmap:** [Studio-Reel-Roadmap.md](./Studio-Reel-Roadmap.md) is the **tracker** — it schedules
> these phases as R0–R8, adds the audio/media and editor-round-trip work this plan leaves as open
> questions, and holds the per-feature tracker. This document stays the *design* reference.
> **Goal:** make a video the way you write a document — `Design.md` + `Frame.md` +
> `Storyboard.md` in, a deterministic, self-contained `Storyboard.html` out, MP4 via the existing
> automation CLI.
> **Sibling docs:** [README.md](./README.md) (the HyperFrames/Remotion landscape),
> [HyperFrames-Deep-Dive.md](./HyperFrames-Deep-Dive.md) (the seek contract),
> [Design-Templates-and-Skills-Plan.md](./Design-Templates-and-Skills-Plan.md) (frame.md inversion →
> `.sptpl`), [Roadmap-Programmatic-Video.md](./Roadmap-Programmatic-Video.md) (composition file),
> and the HTML-in-Canvas pipeline plan ([../automation/HTML-IN-CANVAS-PIPELINE-PLAN.md](../automation/HTML-IN-CANVAS-PIPELINE-PLAN.md)).

---

## 0. TL;DR

Four artifacts, one compiler:

| File | Who writes it | What it is | Hand-editable? |
|---|---|---|---|
| **`Design.md`** | designer / brand owner | the raw design system — palette, type stack, spacing, logo, voice | yes |
| **`Frame.md`** | designer, once per brand | that design system **inverted for the camera** — on-screen scale, safe areas, motion language, beat grid | yes |
| **`Storyboard.md`** | writer / agent | the film: scenes, beats, on-screen copy, narration, and which **frame** each beat uses | yes — this is the daily file |
| **`Storyboard.html`** | **generated** | the compiled, self-contained, deterministic HIC page: markup + inlined CSS + tokens + a single `onFrame(t)` | no — build output |

**Studio Reel** is the compiler (`Design.md` + `Frame.md` + `Storyboard.md` → `Storyboard.html`) plus
the lint, preview and render loop around it. The output is a **reel**: one HTML file that
carries its own runtime, seeks by time, and renders identically in the browser modal, the deep-link
preview, and the headless CLI.

The reason this is cheap to build here is that **all three hard parts already exist**:

- `docs/html-in-canvas/hic-storyboard.js` already compiles a `storyboard.json` into a
  *self-contained* HIC clip whose `onFrame(t)` is the interpolator.
- `docs/html-in-canvas/hic-frame.js` (`HicRenderer`) already rasterizes a HIC clip through SVG
  `foreignObject` deterministically.
- `automation/html-in-canvas/` already turns a composition into MP4, headless, frame-exact.

Studio Reel is the **Markdown front-end** and the **design/frame layer** on top of that existing
engine. Nothing about the render path changes.

---

## 1. The pipeline

```
  Design.md ─┐
             ├─►  Studio Reel ──►  storyboard.json (IR)  ──►  Storyboard.html ──►  MP4 / WebM
  Frame.md  ─┤     (compile)           (internal)                 (a reel)        (existing CLI)
             │        ▲
Storyboard.md┘        └── lint ⇄ preview loop (agent or human)
```

- **Inputs** are prose + tables an agent can read and diff.
- **The IR** (`storyboard.json`) is the schema `hic-storyboard.js` already consumes — reuse it,
  don't invent a second one.
- **The output** is a reel: portable, deterministic, deep-linkable.
- **Rendering** is unchanged: the editor modal, the CDP CLI, or the editor-export parity mode.

---

## 2. Where each piece already lives

| Piece | Today | Studio Reel reuses it as |
|---|---|---|
| `hic-storyboard.js` | storyboard.json → self-contained HIC clip | the final emitter (IR → clip → HTML) |
| `hic-frame.js` (`HicRenderer`) | SVG `foreignObject` raster engine, design-space tables | the preview/raster target |
| `hic-modal.js` | player shell, transport, Code tab, export toolbar | the preview UI for a reel |
| `src/engines/hic/adapters/waapi.js` | compiles CSS `@keyframes` → `onFrame` | the escape hatch for hand-authored animation |
| `automation/html-in-canvas/` | `-m cdp` / `-m editor` render to MP4 | the export step |
| `.sptpl` design templates | named bundle of typed presets + globals | the machine half of `Design.md` |
| Markdown → video generator | headings/paragraphs → timed clips | the precedent for "prose in, timeline out" |

> **Design decision:** `Design.md` is the *human* face of an `.sptpl` template. The same tokens
> exist twice — readable prose for an agent, structured JSON for the app. The compiler owns the
> mapping and keeps them in sync (see §4.2).

---

## 3. The four artifacts

### 3.1 `Design.md` — the design system

The brand as it already exists on the web. Tokens only; no video decisions.

```markdown
# Aurora — Design System

## Palette
- ink:        #05070d   (backgrounds)
- slate:      #a9b6c9   (body on dark)
- signal:     #38bdf8   (accent / data)
- alarm:      #fb7185   (warning / negative)
- paper:      #f8fafc   (headlines)

## Type
- Display:  Space Grotesk 700
- Body:     Inter 400 / 600
- Mono:     JetBrains Mono 500

## Spacing
- unit: 8   radius: 20   gutter: 32

## Logo
- wordmark: "Aurora" (no icon)
```

### 3.2 `Frame.md` — the design system, inverted for the frame

This is the piece HyperFrames calls *frame.md*: the same tokens, rewritten so an agent can compose
a video **without guessing scale**. It is authored once per brand and changes rarely.

```markdown
# Aurora — Frame Language

## Stage
- aspect: 16:9        fps: 30
- design space: 800 × 450   (all numbers below are in design-space units)
- background: ink, with an optional radial glow at 20% signal

## Safe areas
- title-safe: 5% all sides      action-safe: 3%
- max text width: 720 · max lines: 3

## Type ramp (design-space px)
- kicker: 11    title: 54    lead: 26    stat: 40    body: 16    caption: 12
- tracking: kickers +0.18em, titles −0.03em
- rule: one title per scene; a scene may carry at most two stats

## Motion language
- enter: fadeUp 0.7s cubic-bezier(.2,.9,.3,1), stagger 0.15s
- exit:  fadeOut 0.3s
- ambient: drift/float loops only on decorative layers, never on text
- easing vocabulary: { gentle, snap, rise, drift } — no per-scene curve invention

## Beat grid
- default beat: 3.0s; short 1.5s; hold 6.0s
- copy budget: ≤ 12 words per beat, ≤ 2 lines per element

## Rules
- At most one accent per scene. Negative stats use `alarm`, positive use `signal`.
- Never animate type with `ambient`.
```

### 3.3 `Storyboard.md` — the film

The only file a writer or agent touches per video. Structurally: front-matter for globals, then one
section per beat.

```markdown
---
design: aurora        # the brand package in designs/ — brings Design.md + Frame.md
title: A Breath of Air
duration: 26
fps: 30
---

## Scene 1 — The air we share · 0:00–0:06
frame: title-stats
copy: Air pollution is the world's largest environmental health risk.
stats:
  - { value: "7M",  label: "premature deaths a year" }
  - { value: "99%", label: "of people breathe air over WHO limits" }
kicker: GLOBAL AIR QUALITY
source: WHO · State of Global Air

## Scene 2 — An invisible crisis · 0:06–0:13
frame: cards-3
tone: alarm
copy: Air pollution is among India's biggest health threats.
cards:
  - { big: "400+",   small: "Delhi NCR AQI on a severe winter day" }
  - { big: "1.67M",  small: "deaths a year linked to air pollution" }
  - { big: "21 / 30", small: "of the world's most polluted cities are in India" }
```

- **`frame:`** names one of `Frame.md`'s **frames** (title-stats, cards-3, split-icons, statement…).
  A frame *is* the reusable layout unit; adding one to `Frame.md` adds it to every future film.
- **`design:`** (front-matter) selects the brand package; the scene-level **`frame:`** and **`tone:`**
  keys are then unambiguous — one names a layout, the other a palette variant (normal / alarm /
  positive). The keys never mean two different things at two levels.
- Copy is plain text; **no HTML**. Escaping, line breaking and ellipsis are the compiler's job.
- Narration/timing is explicit and diffable — a reviewable film is a reviewable Markdown PR.

### 3.4 `Storyboard.html` — the generated reel

Build output. One file, no network, no build step:

```html
<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>/* Design.md tokens + Frame.md ramp, resolved to CSS vars */
:root{--ink:#05070d;--signal:#38bdf8;--alarm:#fb7185;--paper:#f8fafc;--title:54;} 
.hg{position:relative;width:100%;height:100%;background:var(--ink)}
/* … frame CSS … */</style>
</head><body>
<div class="hg" id="stage"><!-- scene markup --></div>
<script>
/* generated — deterministic from t; no Date, no Math.random, no rAF */
function onFrame(t){ /* resolved beats: opacity/transform per element */ }
</script>
</body></html>
```

Contract (identical to a HIC clip, so every existing consumer works):

- `window.onFrame(t)` is the **only** time input.
- No `requestAnimationFrame`, `setTimeout`, `Date.now()`, or unseeded `Math.random()`.
- No external fetches; fonts are inlined or referenced from a known set.

Because it *is* a HIC clip, it opens in the modal, deep-links, exports WebM, and renders through
`automation/html-in-canvas/render.js` with no new code.

### 3.5 The IR (`storyboard.json`)

Internal, emitted by the compiler and consumed by `hic-storyboard.js`. Its header points at a
`templates/storyboard.schema.json`, but **that file is not checked in today** — writing it down is
part of P1. Studio Reel adds two sections the current compiler does not consume:

```jsonc
{
  "meta":   { "title": "A Breath of Air", "aspect": "16:9", "fps": 30, "duration": 26 },
  "tokens": { "ink": "#05070d", "signal": "#38bdf8", /* … Design.md, resolved */ },
  "frame":  { "ramp": { "title": 54 }, "safe": { "title": 0.05 }, /* … Frame.md, resolved */ },
  "scenes": [ { "frame": "title-stats", "start": 0, "dur": 6, "elements": [ /* … */ ] } ]
}
```

Everything versioned; unknown keys preserved (same discipline as `.sptpl`).

---

## 4. The compiler

### 4.1 Stages

1. **Parse.** Front-matter + `##` scene sections → a normalized beat list. Deterministic and
   order-stable; a scene's `frame:` resolves against `Frame.md`'s frame catalogue.
2. **Resolve tokens.** `Design.md` + `Frame.md` → CSS custom properties. `Frame.md` wins where the
   two disagree (it is the camera lens); a mismatch is a **warning**, not an error.
3. **Layout.** For each beat, the frame places elements inside the safe area using the type ramp.
   Text is measured with the target font metrics; overflow → **lint error** (§4.5).
4. **Time.** Beats → absolute `[start, end)`; enter/exit/stagger come from the motion language.
5. **Emit.** Build the IR (`storyboard.json`), hand it to `hic-storyboard.js`, get back the clip;
   serialize to `Storyboard.html`.
6. **Validate.** Lint + a determinism check (see §4.5) before the file is written.

### 4.2 Keeping `Design.md` and `.sptpl` in sync

Two representations, one source of truth chosen by direction:

- **Export:** an app design template → `Design.md` (tokens) + a starter `Frame.md` (rules derived
  from the app's own canvas globals and preset styles). "Design a look in the app, get a film spec."
- **Import:** `Design.md` → a `.sptpl` the gallery can apply, so a film's look is also editable in
  the WYSIWYG editor.

The compiler never reads both at once: it reads Markdown, and the `.sptpl` is a derivable artifact.

### 4.3 Layout & typography

- Everything is in **design-space units**; the renderer scales the stage to any output resolution.
  This is why `Frame.md` fixes the design space explicitly, and why the compiler must not emit
  raw output pixels.
- One measuring pass per text element, using the vendored fonts. The compiler fails loudly if a
  font in `Design.md` is not available (inlined or web-safe) rather than silently substituting.
- Safe areas are enforced, not suggested: a violation is a lint error with the offending line.

### 4.4 Beats, timing, and narration

- The compiler owns the clock: `duration` is derived from the beats unless explicitly overridden.
- Optional `narration:` lines let a beat derive its length from words (e.g. 2.5 words/second), so
  the "numbers come from the script" rule from the design-template plan applies to *time* too.
- A `storyboard.json` → `Storyboard.md` **decompiler** is in scope for P3, so a film authored in
  the app can be exported back to reviewable Markdown.

### 4.5 Lint & the determinism gate

Run before every write; CI-runnable, no browser:

| Check | Fails when |
|---|---|
| `no-clock` | emitted `onFrame` references `Date`, `performance`, `rAF`, `setTimeout` |
| `no-random` | references `Math.random()` without a seed |
| `text-overflow` | a text element exceeds its safe area or line budget |
| `unknown-frame` | a scene names a frame not in `Frame.md` |
| `missing-asset` | a font/image referenced by `Design.md` is not resolvable offline |
| `duration-mismatch` | scene spans don't tile the declared duration |
| `contrast` | token pair below WCAG AA for its role |

The `no-clock`/`no-random` checks are the same contract the HIC renderer already relies on; making
them a lint step is what turns "usually deterministic" into "verified deterministic".

---

## 5. Preview, render, and share

- **Preview** — `Storyboard.html` opens in `hic-modal` (transport, scrub, Save Frame) with zero new
  UI. A deep link `…/test-renderer.html?src=Storyboard.html` gives a shareable URL.
- **Render** — unchanged CLI:
  ```bash
  node automation/html-in-canvas/render.js builds/breath-of-air/Storyboard.html -m cdp
  ```
  (P1 adds "an `.html` composition can be rendered directly" to the CLI; today it renders the `.js`
  compositions that create clips.)
- **Gallery** — a `Storyboard.html` is a design-gallery candidate by construction, so a film and its
  spec can be one entry in `designs.html`.

---

## 6. Agent & CLI surface

```bash
npx reel new breath-of-air                # scaffold Design.md / Frame.md / Storyboard.md
npx reel compile breath-of-air            # → storyboard.json → Storyboard.html (+ lint)
npx reel lint breath-of-air               # the §4.5 gates, no browser
npx reel render breath-of-air             # wraps the automation CLI
npx reel eject breath-of-air              # Storyboard.md → a plain StudioPro composition .js
```

`eject` matters: a film is never locked in. Any `Storyboard.md` can be turned into the same kind of
`examples/*.js` composition the pollution showcase uses, and edited by hand afterwards.

**Skills** (mirroring the `/hyperframes-*` shape): `reel-brief` (design/frame from a brief),
`reel-storyboard` (write/review a Storyboard.md), `reel-render` (compile + render + verify).
Each is a short Markdown contract in `automation/shared/skills/`, reusing `AGENTS.md`.

---

## 7. Folder structure

One folder. The tool, the reusable brand packages and the films all live under
`automation/studio-reel/`, so the system is one thing you can point at — not a compiler in one place
and its content scattered across three others.

```
automation/studio-reel/
├── README.md                 # what it is, the four artifacts, quick start
├── cli.js                    # new | compile | lint | render | eject
│
├── src/                      # the compiler (Node, no browser)
│   ├── parse.js              # Design.md / Frame.md / Storyboard.md → objects
│   ├── resolve.js            # tokens + frames + fonts → resolved values
│   ├── layout.js             # safe areas, text measure, type ramp
│   ├── timeline.js           # beats → spans (narration → durations)
│   ├── emit.js               # IR → storyboard.json → Storyboard.html
│   ├── lint.js               # the §4.5 gates
│   └── decompile.js          # IR → Storyboard.md
│
├── frames/                   # built-in frames + their CSS
│   ├── title-stats.js
│   ├── cards-3.js
│   └── statement.js
├── schema/                   # design / frame / storyboard JSON schemas
├── starters/                 # what `reel new` scaffolds
│   ├── Design.md
│   ├── Frame.md
│   └── Storyboard.md
│
├── designs/                  # reusable brand packages
│   └── aurora/
│       ├── Design.md
│       └── Frame.md
│
└── films/                    # the repo's own films are the examples
    └── breath-of-air/
        ├── Storyboard.md     # SOURCE — the only file edited per film
        ├── Design.md         # optional override (or `design: aurora`)
        ├── Frame.md          # optional extra frames
        ├── assets/           # images / audio / fonts (CORS-safe, local)
        ├── Storyboard.html   # GENERATED — committed, for diffable output
        ├── storyboard.json   # GENERATED IR
        ├── .build/           # cache + lint reports       (gitignored)
        └── out/              # rendered MP4 / WebM         (gitignored)
```

Three kinds of file, and only one of them is yours to edit:

| Kind | Paths | Committed |
|---|---|---|
| **Source** | `Storyboard.md`, `Design.md`, `Frame.md`, `assets/` | yes |
| **Generated** | `Storyboard.html`, `storyboard.json` | yes — a diff of the compiled output is the clearest proof a spec change did exactly one thing |
| **Disposable** | `.build/`, `out/` | no (gitignored) |

A film resolves its brand package in order: `films/<slug>/` → `designs/<brand>/` → `starters/`,
taking `Design.md` and `Frame.md` together from the first folder that has them. So a one-off film
carries its own tokens and frames, and a brand film says `design: aurora` and inherits both.

---

## 8. Phases

**P0 — the reference film, spec-first.** Re-express the existing pollution showcase as
`Design.md` + `Frame.md` + `Storyboard.md`, compile it by hand into the `Storyboard.html` that
today is `examples/pollution-story.js`, and render both. **Gate:** the hand-compiled storyboard
renders frame-identical to the composition it replaces. Proves the artifact set is expressive
enough before any compiler exists.

**P1 — the IR + emitter.** Wire `storyboard.json` → `hic-storyboard.js` → `Storyboard.html`, and
teach the automation CLI to render an `.html` composition directly. **Gate:** the P0 IR renders
end to end with no hand-editing.

**P2 — the Markdown front-end.** `Storyboard.md` → IR: parse, frame resolution, token resolution,
layout, timing. **Gate:** the P0 `Storyboard.md` compiles to the P0 `Storyboard.html`.

**P3 — lint + decompile.** The §4.5 gates, plus `storyboard.json` → `Storyboard.md`. **Gate:** a
deliberately broken storyboard fails each check with a line number; the decompiler round-trips P0.

**P4 — the frame library.** Named frames (title-stats, cards-3, split-icons, statement, chart),
palette variants (normal/alarm/positive), and a frame preview page. **Gate:** a new film
can be authored without touching CSS.

**P5 — design-template bridge.** `.sptpl` ⇄ `Design.md` in both directions; `reel` skills
shipped in `automation/shared/skills/`. **Gate:** a look designed in the app produces a spec that
renders, and a spec produces a template the gallery can apply.

Ordering note: P0 deliberately ships **no code**. If the four artifacts can't express the film that
already exists, no compiler will fix that.

---

## 9. Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Two time models (design space vs output px) | a spec that renders right in the modal but wrong in the CLI | one rule: specs are always design-space; the renderer scales. Lint rejects output-pixel literals |
| Fonts not available offline | silent substitution changes layout | compiler resolves fonts up front; `missing-asset` is a hard error |
| Markdown → film is under-expressive | authors reach for HTML and the format dies | P0 gate before any compiler; `eject` is always available |
| Generated HTML drift | a hand-edit is lost on the next compile | `Storyboard.html` is never hand-edited; `eject` produces an editable `.js` instead |
| Design.md / .sptpl divergence | two sources of truth | §4.2: Markdown is canonical; `.sptpl` is derivable and round-trip tested |
| The name reads as someone else's product | confused docs and search results | deliberately **not** "Hyper*": the system is **Studio Reel** (CLI `reel`) and its output is a **reel**, so nothing in the tree collides with HeyGen's HyperFrames |

---

## 10. Open questions

1. **Naming — resolved.** The system is **Studio Reel** (folder `automation/studio-reel/`, CLI
   `reel`); its output is a **reel** (the file stays `Storyboard.html`). It is on-brand — the reel
   half of Studio Pro — and avoids the "Hyper*" prefix entirely, so nothing here reads as HeyGen's
   HyperFrames. Rejected along the way: *Sprocket* (distinctive, but the Rails asset pipeline owns
   the word), *Studio Script* (implies narration), *Montage* (a JS framework), *Slate* (Slate.js).
2. **Media.** Images/video in a spec need CORS-safe URLs and are inlined to base64 by the HIC
   renderer. Does `Design.md` name assets by URL, by a project-relative path resolved at compile
   time, or both?
3. **Audio.** The HIC clip contract is video-only today. Music/voiceover means either an audio
   track alongside the reel or a new IR section — and it changes `duration` from derived to
   declared.
4. **Numbers from the script.** §4.4 derives beat length from narration word count. Is that a
   default, an opt-in per beat, or always explicit in v1?
5. **Where the compiler runs.** Node in `automation/studio-reel/` keeps it CI-friendly and headless;
   running it **in the app** (browser) would let the editor compile a storyboard with a live
   preview. The IR and lint are shared either way — decide at P2.

---

*See also: [Design-Templates-and-Skills-Plan.md](./Design-Templates-and-Skills-Plan.md) (frame.md
inversion → `.sptpl`), [Roadmap-Programmatic-Video.md](./Roadmap-Programmatic-Video.md) (the
composition-file north star), and
[../automation/HTML-IN-CANVAS-PIPELINE-PLAN.md](../automation/HTML-IN-CANVAS-PIPELINE-PLAN.md)
(the render pipeline this compiles into).*
