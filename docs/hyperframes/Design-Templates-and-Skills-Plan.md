# Design Templates & Skills — HyperFrames Analysis and Studio Pro Plan

> **Date:** August 2026 · **Status:** M1 (template engine) ✅ 2026-08-18; M2 (gallery UI) ✅ 2026-08-18 — toolbar `layout-template` button, gallery modal (category chips, palette-gradient/captured thumbnails, Apply / Use-as-defaults, Save-current-look), Escape/backdrop close, all wired to `applyDesignTemplate`. M3 (template editor) in progress.
> **Sources:** github.com/heygen-com/hyperframes (README, skills), hyperframes.heygen.com/design, heygen.com/research/html-to-video
> **Scope:** Two questions:
> **Sources:** github.com/heygen-com/hyperframes (README, skills), hyperframes.heygen.com/design, heygen.com/research/html-to-video
> **Scope:** Two questions:
> 1. **How does HyperFrames do "design templates" and "skills"?** — what frame.md / design.md are, how named designs work, what a catalog block is, and how the 19 skills turn a project type into a production workflow.
> 2. **How do we build the same idea into Studio Pro?** — where a **design template = a collection of specific types of presets (all customizable)** that you can apply to a project.
>
> Sibling docs: [HyperFrames-Deep-Dive.md](./HyperFrames-Deep-Dive.md) (architecture), [StudioPro-vs-Hyperframes-vs-Remotion.md](./StudioPro-vs-Hyperframes-vs-Remotion.md) (layer comparison), [Roadmap-Programmatic-Video.md](./Roadmap-Programmatic-Video.md) (composition-file roadmap), [Render-Speed-Analysis-and-Plan.md](./Render-Speed-Analysis-and-Plan.md) (export speed).

---

## TL;DR

HyperFrames treats *design* as **data an agent can read** and *production* as **a workflow an agent can run**:

- **frame.md** — a design system (`design.md`) *inverted for the frame*: the same brand tokens (colors, fonts, spacing) rewritten as rules for composing a video (scale, safe areas, typography, beats). Named designs like **Biennale Yellow**, **BlockFrame**, **Blue Professional**, **Bold Poster**, **Broadside**, **Capsule**, **Cartesian**, **Cobalt Grid**, **Coral** live on hyperframes.dev/design and get applied to a project.
- **Catalog** — reusable **blocks** (`npx hyperframes add flash-through-white`, `instagram-follow`, `data-chart`) — installable, remixable components.
- **Skills** — 19 agent skills that turn a *project type* (product launch, explainer, PR-to-video, captions, talking-head recut, motion graphic, music-to-video, slideshow) into a full production loop: plan → write HTML → wire animation → media → lint → preview → render.

**The Studio Pro translation:** a **Project Design Template** = a named bundle of *typed presets* + *project globals* — text presets, shape presets, caption style + karaoke animation, markdown heading/text/math styles, scene styles, keyframe paths, and the canvas globals (aspect, fps, background). Every member of the bundle is an ordinary, already-existing preset object, so **every part stays customizable** — editing a template is just editing presets, which Studio Pro already knows how to do. Applying a template writes the same layers the app already writes: `subtitleConfig` (captions), `markdownConfig` (Markdown → video), `clip.effects` (selected clip), respecting per-item overrides exactly like `applyCaptionPreset` does today.

---

## Part A — How HyperFrames Does Design Templates & Skills

### A.1 frame.md: the design system, inverted for the camera

Every brand has a `design.md` — a web-context design spec (tokens, type scale, spacing, component rules). HyperFrames' **frame.md** is "the missing translation layer": it takes that spec and **inverts it for the frame** — the *same tokens and rules*, but rewritten so an agent can compose a *video* without guessing at scale or reaching for web chrome.

> "The output is a DESIGN.md superset your whole toolchain can read. **Atoms stay sacred. Composition stays free. Numbers come from the script.**"

What that means concretely:

- **Atoms stay sacred** — the color palette, font stack, and spacing tokens from the brand spec are carried over 1:1. A template is *not* a rebrand; it's a lens.
- **Composition stays free** — layout is not prescribed by the template; the script/agent decides placement, timing, and rhythm.
- **Numbers come from the script** — font sizes, durations, and motion values are derived from the actual content (how long is the narration? how many words in the headline?), not hardcoded.

Named designs (Biennale Yellow, Cobalt Grid, Capsule, …) are **pre-built frame.md documents** — a palette + type system + motion language packaged as a single artifact you can apply to a project and remix.

### A.2 The catalog: blocks, not templates

The **catalog** is a level below frame.md — **installable blocks/components** rather than whole-project designs:

```
npx hyperframes add flash-through-white   # shader transition
npx hyperframes add instagram-follow       # social overlay
npx hyperframes add data-chart             # animated chart
```

A block is a self-contained, reusable composition element (HTML + CSS + seekable animation) you drop into any project. The mental model:

| Artifact | Grain size | What it answers |
|---|---|---|
| **frame.md** | Whole project | "What does this brand look like *on camera*?" |
| **Catalog block** | One element | "How do I do a *data-chart* / *transition* / *lower-third*?" |
| **Skill** | Whole production | "How do I make a *product launch video* from start to finish?" |

### A.3 The 19 skills: project types as production workflows

Skills are the *process* layer. `/hyperframes` is the router — read first for any "make a video" request; it picks a creation workflow and confirms the brief up front. Then the creation workflows each encode a project-type-specific production loop:

| Skill | Project type it encodes |
|---|---|
| `/product-launch-video` | Marketing / launch / site-tour (30–90s sweet spot) |
| `/faceless-explainer` | Explainer from arbitrary text — every visual LLM-invented |
| `/pr-to-video` | PR → changelog / feature-reveal video |
| `/embedded-captions` | Captions over an existing talking-head (verbatim rail, embedded climax, cinematic embed) |
| `/talking-head-recut` | Lower-thirds, data callouts, kinetic titles, pull-quotes, PiP |
| `/motion-graphics` | Short design-led motion graphics, kinetic type, stat hits, logo stings |
| `/music-to-video` | Beat-synced lyric / slideshow / kinetic promo |
| `/slideshow` | Navigable deck (not video) |
| `/general-video` | Fallback for everything else |
| `/remotion-to-hyperframes` | One-way migration |

Underneath sit **domain skills** (`/hyperframes-core`, `/hyperframes-animation`, `/hyperframes-keyframes`, `/hyperframes-creative`, `/media-use`, `/hyperframes-cli`, `/hyperframes-registry`, `/figma`) — atomic capabilities the workflows compose. `/hyperframes-creative` is the one that owns frame.md/design.md, palettes, typography, narration, and beat planning.

**The key insight for us:** HyperFrames' "design template" is really **three separable ideas** — a *token set* (frame.md), a *block library* (catalog), and a *workflow* (skills). Studio Pro already has two of the three in embryo: a **preset system** (the block library analog) and a **Markdown → video generator** (the workflow analog). The missing piece is the **token-set/template layer** that bundles presets into per-project-type looks.

---

## Part B — Studio Pro's Existing Preset Architecture (the foundation we build on)

### B.1 Per-element presets

`DEFAULT_PRESETS` (`index.html:1245`) is an array of objects that all share one shape:

```js
{
  id: 'preset_text_cyberpunk',
  name: 'Cyberpunk Yellow',
  type: 'text',                    // text | shape | image | video | scene | audio
  category: 'Text Style',          // 'Text Style' | 'Shape Template' | 'Media Template' | 'Scene Composition' | 'Math' | 'Keyframe Path'
  text: 'CYBERPUNK',               // optional (text presets)
  effects: { fontSize, fontFamily, fillColor, strokeEnable, strokeColor, strokeWidth,
             extrudeEnable, extrudeColor, extrudeDepth, shadowEnable, shadowColor, … },
  keyframes: [ … ]                 // optional (Keyframe Path presets)
}
```

Custom presets: `loadCustomPresets()` / `saveCustomPresets()` (`index.html:1636/1646`, localStorage `custom_presets`). Thumbnails: `capturePresetThumbnail()` (`index.html:11498`) snapshots the current canvas so saved presets show real previews.

Applying a preset to a clip: `applyPresetToSelected(presetId)` (`index.html:11446`) — type-checked, replaces `clip.effects` (and `clip.keyframes` for path presets), with special handling for Keyframe Path and placeholder media presets.

### B.2 Project-level style layers (the closest thing to frame.md today)

Two global config layers already hold *project* design state and bake it onto clips, each with the **global-config + per-item-override** pattern:

- **Captions:** `State.subtitleConfig` — font, size, color, stroke/shadow, background box family (fill/stroke/shadow/extrude/texture), position, and the full animation vocabulary (entrance/letter/word-karaoke presets + tunables like `letterTravel`, `wordPopScale`, `highlightColor`). Applied via `applyCaptionPreset` / `captionStyleControlHtml` with per-caption overrides in `sub.effects` (respected by the mirror logic — `subtitleEffectMap`, `SUBTITLE_EFFECT_KEYS`).
- **Markdown → video:** `State.markdownConfig` (`index.html:1066`) — `heading*` / `text*` / `math*` / `image*` prefixed keys (font, size, color, stroke, shadow, extrude, position, offset, animIn) plus `slideDuration`, `mdGap`, `mockShowAltText`. Baked onto generated clips by `applyMarkdownStyle`; stored in localStorage `studiopro_markdownConfig`.

### B.3 What's missing

There is **no artifact that bundles all of this into one named, reusable, per-project-type look**. Today "making a Cyberpunk captions video" means: apply the Cyberpunk text preset to text clips, manually set `subtitleConfig` colors, manually set `markdownConfig` heading/text styles — five separate actions with no memory of each other. HyperFrames answers that with frame.md; the plan below is Studio Pro's answer: **project design templates**.

---

## Part C — The Design Template Concept

### C.1 Definition

> **A Project Design Template is a named collection of specific types of presets plus project globals, stored as one JSON artifact, that can be applied to a project — where every member of the collection is an ordinary preset object, and therefore fully customizable.**

It is *not* a new effect system. It is a *bundle* over things that already exist:

| Template slot | Backed by | Customizable? |
|---|---|---|
| `textPresets[]` | `DEFAULT_PRESETS`-shaped text presets | Yes — same objects the ANIMATIONS tab edits |
| `shapePresets[]` | Shape Template presets | Yes |
| `mediaPresets[]` | Media Template presets (placeholder + effects) | Yes |
| `scenePresets[]` | Scene Composition presets | Yes |
| `keyframePresets[]` | Keyframe Path presets | Yes |
| `captionStyle` | a `subtitleConfig` subset (font/color/box family) | Yes — same Style-tab controls |
| `captionAnimation` | `animPreset` + tunables (`letterTravel`, `wordPopScale`, `highlightColor`, …) | Yes — same Animation-tab controls |
| `markdownStyle` | a `markdownConfig` subset (`heading*`, `text*`, `math*`, `image*`) | Yes — same Markdown Style controls |
| `globals` | aspect ratio, fps, background color, caption position, audio fades/duck defaults | Yes |
| `palette` | swatch set (design tokens) | Yes |
| `metadata` | id, name, projectType, version, thumbnail | — |

Because every slot is backed by an existing editable surface, **"customizing a template" == editing presets**, which the app already does end-to-end (editors, sliders, swatches, save-to-library, thumbnails).

### C.2 The `.sptpl` data model

```jsonc
{
  "format": "studio-pro-design-template",
  "version": 1,
  "id": "tpl_launch_aurora",
  "name": "Aurora Launch",
  "projectType": "product-launch",        // maps to a creation workflow (see D.1)
  "description": "Dark gradient + neon headline + capsule captions for product videos",
  "thumbnail": "data:image/webp;base64,…", // captured via capturePresetThumbnail
  "palette": ["#0b0b0f", "#fde047", "#22d3ee", "#ffffff"],

  "globals": {
    "aspectRatio": "16:9", "fps": 30, "backgroundColor": "#0b0b0f",
    "captionPosition": "bottom", "captionOffset": 60,
    "audioFadeIn": 0.2, "audioFadeOut": 0.3, "audioDuck": true
  },

  "textPresets": [
    { "id": "tpl_text_headline", "name": "Aurora Headline", "type": "text",
      "effects": { "fontFamily": "Anton", "fontWeight": 900, "fillColor": "#fde047",
                   "strokeEnable": true, "strokeColor": "#0b0b0f", "strokeWidth": 4,
                   "shadowEnable": true, "shadowColor": "#22d3ee", "shadowBlur": 20 } }
    // … more text presets, shape presets, media presets, keyframe presets …
  ],

  "captionStyle": { "fontFamily": "Rubik", "fontWeight": 700, "fillColor": "#ffffff",
                    "bgEnable": true, "bgColor": "#0b0b0f", "bgOpacity": 0.85,
                    "bgRadius": 999, "bgStrokeEnable": false, "bgShadowEnable": true, … },

  "captionAnimation": { "animPreset": "wordHighlight", "animFullSpan": true,
                        "highlightColor": "#fde047", "letterTravel": 0, "wordPopScale": 1.22 },

  "markdownStyle": { "headingFontFamily": "Anton", "headingColor": "#fde047",
                     "headingStrokeEnable": true, "headingStrokeColor": "#0b0b0f",
                     "textFontFamily": "Inter", "textColor": "#eeeeee",
                     "slideDuration": 5, "headingAnimIn": "fadeIn", "textAnimIn": "slideUp", … }
}
```

### C.3 Template categories = project types (the skills analog)

HyperFrames' creation workflows map 1:1 onto template categories. Each category is a *curated default collection* — the "what a good one looks like" for that project type:

| Template category (projectType) | HF workflow analog | Template bundles |
|---|---|---|
| `product-launch` | `/product-launch-video` | Big headline presets, capsule captions, cut transitions, audio duck |
| `explainer` | `/faceless-explainer` | Clean text presets, diagram/arrow shapes, bottom-third captions |
| `social-clips` | `/motion-graphics` + `/music-to-video` | Kinetic type, pop/stretch word karaoke, beat-sync-friendly timing |
| `captions` | `/embedded-captions` | The full karaoke menu: word-glow, underline sweep, capsule chips |
| `talking-head` | `/talking-head-recut` | Lower-third shapes, name-plate text, data-callout presets |
| `slideshow` | `/slideshow` | Heading styles, image frame styles, `mdGap`/`slideDuration` defaults |
| `minimal` / `brand` | `/general-video` | Neutral type + palette, no decoration |

The template *gallery* becomes the in-app router: pick a project type → see curated looks → apply → customize.

---

## Part D — Apply Semantics

Applying a template must respect the app's existing **global-config + per-item-override** model — the same discipline `applyCaptionPreset` already follows (it never clobbers an override; it mirrors globals only into clips that don't override them).

### D.1 Two apply modes

1. **"Apply to project"** — writes every layer now:
   - `globals` → canvas aspect/fps/background, caption position, audio defaults.
   - `captionStyle` + `captionAnimation` → `State.subtitleConfig` (mirrored to synced caption clips, *respecting per-caption overrides* — the existing `subtitleEffectMap` / `SUBTITLE_EFFECT_KEYS` mirror logic).
   - `markdownStyle` → `State.markdownConfig`, then `applyMarkdownStyle()` re-styles existing `_mdGenerated` clips.
   - `textPresets/shapePresets/mediaPresets/scenePresets/keyframePresets` → available in the ANIMATIONS/Presets tab as the template's pack; optionally "restyle existing clips by type" (only clips *without* manual overrides).
2. **"Use as defaults"** — same writes minus the "restyle existing clips" step: new Markdown generates, new captions, and new clips pick up the template look automatically.

### D.2 What must NOT happen

- **No clobbering user overrides.** Per-caption overrides (`sub.effects`), per-clip manual styles, and `_mdGenerated` flag semantics stay intact — mirror only the un-overridden fields (exactly what `applyCaptionPreset`'s global branch does today).
- **No silent type mismatches.** Applying a `text` preset to a shape clip keeps the existing `applyPresetToSelected` guard.

### D.3 Undo-friendly

Template application is a state rewrite — route it through the same state-snapshot/undo mechanism the project already uses so "Apply template" is one Undo step away.

---

## Part E — Implementation Plan

### Phase 1 — Data model + apply engine (no UI)

1. **Storage:** `loadDesignTemplates()` / `saveDesignTemplates()` (localStorage `studioPro_designTemplates`), plus a small set of built-in `DEFAULT_DESIGN_TEMPLATES` (one per category in C.3) defined next to `DEFAULT_PRESETS` (`index.html:1245`).
2. **`applyDesignTemplate(templateId, mode)`** — the core function, one per layer:
   - `applyTemplateGlobals(t)` → aspect/fps/bg (reuse the existing project-globals setters).
   - `applyTemplateCaptionStyle(t)` → thin wrapper over the existing `subtitleConfig` write + mirror path (`applyCaptionPreset`-style, override-aware).
   - `applyTemplateMarkdownStyle(t)` → merge into `State.markdownConfig` + `applyMarkdownStyle()`.
   - `applyTemplatePresetPack(t)` → register the template's preset arrays into the Presets tab (a "template pack" namespace so they don't pollute `custom_presets`).
   - `applyTemplateToClips(t, { restyleUnoverridden: true })` → per-clip by type, using `applyPresetToSelected`'s write path with an override check.
3. **`captureTemplateFromProject(name, projectType)`** — "Save current look as template": snapshot `subtitleConfig` → `captionStyle`, `markdownConfig` → `markdownStyle`, globals, and capture a thumbnail via `capturePresetThumbnail()`.

### Phase 2 — Templates UI

- A **Templates** entry (toolbar button or top-level tab) opening a gallery modal: category filter chips (product-launch, explainer, social-clips, captions, …), thumbnail cards, Apply / Use-as-defaults buttons.
- Apply preview: after clicking Apply, re-render the canvas (`drawCanvas`) so the user sees the look immediately; Undo restores.
- Built-in templates ship with hand-built thumbnails; user-saved templates use `capturePresetThumbnail`.

### Phase 3 — Template editor (the "fully customizable" promise)

- "Edit template" opens the template's members **through the existing editors**: each `textPreset`/`shapePreset`/`keyframePreset` row links to the same preset editing UI the ANIMATIONS tab uses; `captionStyle`/`captionAnimation` and `markdownStyle` link to the captions Style tab and Markdown Style panel (both already render from the same config objects — editing them in-place then "Update template" re-snapshots).
- Per-member overrides inside a template: a member can be marked `overrides: { }` so applying the template writes only the listed keys (per-item customization *within* the template, mirroring the app's own override model).

### Phase 4 — Export / import / share

- `Export Template` / `Import Template` as `.sptpl.json` (the C.2 schema, plus a `palette` preview block).
- Round-trip guarantee: import → apply → export must be lossless (versioned schema; unknown keys preserved).

### Phase 5 — (Stretch) templates meet the composition roadmap

- Tie templates to `Roadmap-Programmatic-Video.md` Phase 3: a template can optionally carry a **Markdown script skeleton** + **scene layout** so "Apply template" to an empty project produces a structured starting composition — Studio Pro's `frame.md` + `.spcomp` moment. Then the template gallery doubles as the agent-facing "skills" surface: *"make a product-launch video" → pick the product-launch template → generate Markdown → render FTRT.*

---

## Part F — HyperFrames ↔ Studio Pro Mapping

| HyperFrames | Studio Pro today | Studio Pro target |
|---|---|---|
| **frame.md / design.md** | `subtitleConfig` + `markdownConfig` + presets (separate, un-bundled) | `.sptpl` template — the bundled token layer |
| **Named designs** (Biennale Yellow, …) | `DEFAULT_PRESETS` styles (single-element) | `DEFAULT_DESIGN_TEMPLATES` — one curated bundle per category |
| **Catalog blocks** | Preset packs (Text/Shape/Media/Scene/Keyframe) | Template preset-pack namespace + future block-level packs |
| **Skills / creation workflows** | Markdown → video generator (text-driven, no per-type looks) | Template categories = project types; gallery = the router |
| **`/hyperframes-creative`** (palettes, typography, beats) | Markdown Style + caption Animation tabs | `template.palette` + per-category defaults + script skeleton |
| **Agent authoring** | Markdown script → timeline | Template + Markdown skeleton → `.spcomp` → render (Phase 5) |

---

## Part G — Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Applying a template clobbers user styling | Override-aware mirror (Phase 1) — identical discipline to `applyCaptionPreset`; per-item `overrides` in templates; Undo |
| Template bloat (huge thumbnail data URLs in localStorage) | Downscale thumbnails (existing `capturePresetThumbnail` path caps size); store templates as separate JSON files on export |
| Customization feels like "one big reset" | Per-slot apply checkboxes in the UI ("apply text pack / captions / markdown style only"); per-member `overrides` |
| Built-in templates diverge from the live presets | Generate built-ins from the same `effects` objects (single source of truth), not hand-copied JSON |
| Template categories drift from real project needs | Derive categories from the existing preset categories (`Text Style`, `Shape Template`, …) + the Markdown generator's output types |
| Export/import schema drift | Versioned schema, unknown-key preservation, round-trip test |

---

## Part H — Suggested Milestones

| Milestone | Work | Outcome |
|---|---|---|
| **M1 — Template engine** ✅ 2026-08-18 | Schema, storage, `applyDesignTemplate` (override-aware), `captureTemplateFromProject`, 4 built-in templates, `template:` front-matter key, one-Undo-step | `applyDesignTemplate('tpl_x')` restyles a whole project from one call; Undo works |
| **M2 — Gallery UI** ✅ 2026-08-18 | Templates modal, category chips, thumbnails, Apply/Use-as-defaults, Save-current-look | One click = project looks like the template; per-item overrides survive |
| **M3 — Template editor** | Edit members through existing editors; save as new template | "Make my current look a reusable template" — the fully-customizable promise |
| **M4 — Share** | Export/import `.sptpl.json` | Templates travel between projects/machines |
| **M5 — Composition tie-in** | Template + Markdown skeleton → `.spcomp` | The "skills" moment: project-type templates drive automated production |

---

*See also: [StudioPro-vs-Hyperframes-vs-Remotion.md](./StudioPro-vs-Hyperframes-vs-Remotion.md) (authoring-model comparison), [Roadmap-Programmatic-Video.md](./Roadmap-Programmatic-Video.md) (composition file + agent loop), [Render-Speed-Analysis-and-Plan.md](./Render-Speed-Analysis-and-Plan.md) (why FTRT export makes template-driven production practical), and `docs/features/Caption-Clips-vs-Markdown-Clips.md` (the two global style layers a template must address).*
