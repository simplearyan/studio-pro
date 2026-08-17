# Projects as Templates, a Workspace Folder, and Markdown Props — Analysis & Plan

> **Date:** August 2026
> **Ideas analyzed (from the user):**
> 1. **Projects as templates** — a user designs a "brutal" project, saves it; a "Fireship" project; a "Vox News" project; a Shorts template with caption animations — and each saved project *is* a reusable template.
> 2. **A workspace folder + skills** — save the project JSON files into a `projects` folder, and convert them into agent skills / frame.md files (or a better structure).
> 3. **Markdown props** — extend the existing Markdown → clips generator with props so more automation flows through the script itself.
>
> Sibling docs: [Agent-Authoring-and-Automation-Plan.md](./Agent-Authoring-and-Automation-Plan.md) (the consolidated automation plan), [Design-Templates-and-Skills-Plan.md](./Design-Templates-and-Skills-Plan.md) (the `.sptpl` schema), [Roadmap-Programmatic-Video.md](./Roadmap-Programmatic-Video.md) (composition file + agent loop).

---

## 0. TL;DR — What I Think

**All three ideas are right, and they're actually one system.** They connect into a single pipeline that is uniquely Studio Pro's:

> **Design in the GUI → save the project → derive a template (`.sptpl`) → auto-generate a skill / frame.md doc → agents write Markdown *with props* that the template styles → render.**

That's "**design-by-example**": templates and skills are **derived artifacts of real projects**, never hand-authored. HyperFrames hand-writes `frame.md` and 19 skills; Remotion requires hand-written React. Studio Pro can generate both from work the user already did in the WYSIWYG editor — which is exactly what its audience is good at.

Verdicts, briefly:

| Idea | Verdict | Why |
|---|---|---|
| 1. Project JSON as template | ✅ **Yes, with one change** | A saved project already *is* ~90% of a template (styles, captions, markdown config, globals). The missing step is a **"Save as Template"** action that strips *content* (text, media, timing) and keeps *style* — raw project JSON is too content-heavy to apply to other videos directly. |
| 2. Workspace folder + skills | ✅ **Yes, with a structure change** | The browser can't write arbitrary disk folders today (all storage is `localStorage`). The **File System Access API** (`showDirectoryPicker`, Chromium-only — fine, MediaBunny already requires Chrome/Edge/Opera) unlocks a real workspace. Recommend **one root folder, three subfolders**: `projects/` `templates/` `skills/`. |
| 3. Markdown props | ✅ **Yes — do this first** | The parser already supports `[top]` position and `[audio:name]` tags — props are a *generalization* of a mechanism that exists. Front-matter (document-level) + bracket tags (element-level) turn Markdown into a declarative video spec — the perfect agent contract. |

---

## 1. Idea 1 — Project JSON as a Template ("design-by-example")

### 1.1 Why it works (verified in code)

`serializeProject()` (index.html:26586) already saves everything a template needs:

| Template layer | Where it lives in a saved project |
|---|---|
| Clip styles (fonts, colors, stroke, extrude, shadows, textures) | each clip's `effects` |
| Caption look **and** animation (karaoke, word-pop, highlight) | `subtitleConfig` (the exact object the Captions tab edits) |
| Markdown → video styling (heading/text/math/image styles) | `markdownConfig` + `markdownText` |
| Globals (canvas bg, aspect ratio) | `canvasBgColor`, `aspectIndex` |
| Layout patterns (lower-thirds, stacked sides) | clip `_mdPos` / `_mdStackIdx` metadata + track structure |
| Scenes (nested pre-comps) | `scene` clips |
| Audio library / SFX | `audioLibrary`, embedded WAVs |

Two things already behave *like a template system*:
- **Media is not embedded** — `restoreClip()` turns file-backed clips into honest re-import placeholders (`_missingMedia`). So a saved project never drags gigabytes of video around; it's already "styles + references".
- **Multi-project registry exists** — `saveProject`/`getProject`/`duplicateProject` (index.html:26924+) with a Projects modal, keyboard nav, per-project undo. Templates are just *projects you don't edit directly*.

### 1.2 The one change: "Save as Template" (project → `.sptpl`)

A raw project JSON is too *contentful* to be a good template — it has your actual text, your actual timing, your actual slide count. Applying it to a different video would copy yesterday's content. So the template derivation needs a **strip/parameterize pass**:

**`captureTemplateFromProject(name, kind)`** produces a `.sptpl` by:
1. **Keeping** — every style layer above (`effects` per clip *type*, `subtitleConfig`, `markdownConfig`, globals, scene structures, palette extracted from actual colors).
2. **Stripping** — concrete text (→ placeholder `[Your headline]`), media URLs, durations, positions (→ layout *slots* like "heading top, image right, text bottom").
3. **Recording** — the template's own `markdownText` skeleton (from `State.markdownText`), parameterized, so applying the template to a new script inherits the layout grammar.
4. **Thumbnail** — via the existing `capturePresetThumbnail()` path.

### 1.3 Two template kinds fall out naturally

| Kind | What it captures | Best for | Example |
|---|---|---|---|
| **Look template** | Style layers only (no structure) | "Make my next video look brutal / Fireship / Vox" | `brutal-design.sptpl` |
| **Skeleton template** | Style + *structure* (slide layout, captions on, animation presets) with placeholder content | Recurring formats — a weekly Shorts series, product launches, PR-to-video | `shorts-captions.sptpl` (the user's "shorts template with caption animation + customizations") |

This matches HyperFrames' `frame.md` (look) vs its **catalog blocks** (skeleton) — except both are derived from real projects instead of written by hand.

**Recommendation:** one "Save as Template" dialog with two modes — *Look only* vs *Look + skeleton* — plus the existing two apply modes from Design-Templates-and-Skills-Plan.md (**Apply to project** / **Use as defaults**), with the override-aware mirror so applying never clobbers per-item user styling.

---

## 2. Idea 2 — A Workspace Folder + Skills (JSON → frame.md)

### 2.1 The storage reality (why a folder needs an API)

Today **everything lives in `localStorage`** — the registry, project slots, presets, configs (verified: no `showDirectoryPicker`/`indexedDB` anywhere in index.html). The browser cannot write arbitrary disk folders with plain JS. Three storage tiers:

| Tier | Mechanism | Works where | Use for |
|---|---|---|---|
| 1 | `localStorage` (current) | Everywhere | In-app registry — keep as the primary store |
| 2 | **File System Access API** (`showDirectoryPicker` + `createWritable`) | Chrome/Edge/Opera — **already the MediaBunny baseline** | A real on-disk **workspace**: read/write `.spjson`, `.sptpl`, skills |
| 3 | Download / upload (current `exportProjectFile` + file input) | Everywhere | Manual fallback and sharing |

**Recommendation:** tier 2 as *progressive enhancement*. "Open Workspace Folder" button → user picks a folder → the app mirrors the registry into real files (and imports `.spjson`/`.sptpl`/`.md` it finds there). No folder chosen? Everything still works as today.

### 2.2 Recommended folder structure (better than "everything in projects/")

Separating **content** (projects), **style** (templates), and **instructions** (skills) keeps both humans and agents unconfused:

```
StudioPro Workspace/                 ← user picks this once ("Open Workspace Folder")
├── workspace.json                   ← manifest: name, template refs, last-opened project
├── projects/                        ← full saved projects (.spjson — the current export format)
│   ├── my-video.spjson
│   └── vox-blog-episode-3.spjson
├── templates/                       ← derived templates (.sptpl) + optional thumbnails
│   ├── brutal-design.sptpl
│   ├── fireship-design.sptpl
│   ├── vox-news.sptpl
│   └── shorts-captions.sptpl
└── skills/                          ← agent-facing Markdown (frame.md-style), auto-generated
    ├── AGENTS.md                    ← the router / capability map (reads first)
    ├── studio-pro-core.md           ← the Markdown grammar + props contract (Idea 3)
    ├── brutal-design.md             ← one skill per template, generated from its .sptpl
    ├── vox-news.md
    └── shorts-captions.md
```

Why three folders instead of one:
- **`projects/` is content** — grows daily, gets exported, is machine-heavy (base64 WAVs, media refs).
- **`templates/` is style** — small, curated, versionable; the *same* file both the GUI gallery and agents read.
- **`skills/` is instructions** — pure Markdown that an agent (Claude Code, Codex, or the in-app AI panel) loads; it must stay tiny and readable.
- One **root** keeps the "my Studio Pro folder" mental model; `workspace.json` lets the app resync on reopen (like a git index).

### 2.3 Converting a template JSON → a skill / frame.md (auto-generated, not hand-written)

The `.sptpl` already contains every token a frame.md needs. `generateSkillFromTemplate(template)` produces, for each template:

1. **frame.md-style design doc** — extracted, not authored:
   - **Palette** — scan the template's clip `effects` + `subtitleConfig` + `markdownConfig` fill/stroke/bg colors, dedupe, name the top 4–8 as tokens (`--accent`, `--bg`, `--text`, …).
   - **Font stack** — unique `fontFamily` values with weights.
   - **Caption language** — `subtitleConfig` style summary + the `animPreset` + tunables ("word-pop karaoke, highlight #fde047").
   - **Layout rules** — the position patterns seen in `_mdPos` metadata ("headings top, body bottom-third, images right").
   - **Motion vocabulary** — which `animIn`/`animOut`/loop presets + durations the template uses.
2. **A Markdown skeleton** — the parameterized `markdownText` (real copy → `[Your headline]`, `[key stat]` placeholders) so the agent writes scripts that *generate in that style*.
3. **The skill file** — instructions: "This is the **Vox News** look. Palette: …. Use template `vox-news.sptpl`. Write Markdown with these props (Idea 3): `aspect: 16:9`, headings `[top]`, captions on. Generate, then the user renders in Studio Pro."

**`AGENTS.md`** is the router (HyperFrames' `/hyperframes` analog): *"You make videos with Studio Pro. Read `studio-pro-core.md` for the grammar. Pick a template from `templates/` (list + thumbnails). Write Markdown per `skills/<template>.md`. The user renders in the app."*

This is the key differentiator vs HyperFrames: **the skills are generated from real, tested projects** — they encode exactly what the user actually designed, not what a doc author guessed.

---

## 3. Idea 3 — Markdown Props (md → clips, with more automation)

### 3.1 The precedent (verified in code)

The Markdown grammar **already has props** — the parser (index.html:19861) strips tag groups then matches position:
- `[top]`, `[right]`, `[bottom-left]` … → position (existing)
- `[audio:whoosh]` → attach a library sound (existing)
- `---` → slide separator (existing)
- `![alt](mock)`, `![alt](mock:video)` → placeholders (existing)

So "Markdown props" = **generalize the tag mechanism** the parser already has. Two levels:

### 3.2 Proposed syntax

**Document-level (front-matter block at the very top):**

```markdown
---
template: shorts-captions        # auto-applies the .sptpl (style + skeleton)
aspect: 9:16
fps: 30
bg: #0b0b0f
slideDuration: 4
captionStyle: wordHighlight      # or reuse the template's captions
captionHighlight: #fde047
music: soundtrack.mp3            # background audio track
transition: slide                # between slides
---

# 🚀 Product Launch [top]
The headline [bottom]
```

**Element-level (bracket tags, same syntax the parser already strips):**

```markdown
## Whoosh In [anim:zoomIn] [animDur:0.8] [animDelay:0.2] [top]
![Logo](mock) [size:60] [right] [audio:ding]
A key stat: **$10M** [font:Anton] [size:140] [color:#fde047] [center]
[music]                        # per-slide music cue
--- [dur:6]                    # per-slide duration override
```

Rules to keep it clean:
- **One syntax, no new parser**: reuse the bracket-tag group stripper; unknown `[key:value]` tags are collected into a per-element props object instead of dropped.
- **Front-matter is YAML-ish, minimal**: only the 8–10 keys above; anything fancier belongs in the template, not the script.
- **Props never override a template silently** — template wins unless the prop is *explicitly set* on the element (the override-aware discipline again).

### 3.3 What props unlock (the automation payoff)

| Capability | Prop | Turns Markdown into… |
|---|---|---|
| Template selection | `template:` | The script *chooses its own look* — one artifact drives everything |
| Per-element styling | `[font:] [size:] [color:] [weight:]` | Agents can art-direct individual lines without touching the GUI |
| Per-element motion | `[anim:] [animDur:] [animDelay:]` | Scripted animation vocabulary (the template supplies defaults) |
| Timing | `slideDuration:`, `[dur:]`, `[animDelay:]` | Beat/pacing control from the text itself |
| Layout | existing `[top]…` tags + `[z:]` | Full composition grammar |
| Audio | `[audio:]`, `music:`, `[music]` | Sound design from the script |
| Placeholders | existing `mock:` variants | Storyboard-first workflows — drop real assets later |

This is Studio Pro's answer to **Remotion props** (`<Composition>`/`Sequence` props) and **HyperFrames' `data-*` attributes** — but in Markdown, which is (a) what the app already compiles, (b) what LLMs write best, and (c) readable by non-developers. `markdownText` is already saved in project JSON, so templates carry their skeleton automatically, and props make that skeleton *parameterizable*.

---

## 4. The Unified System (how the three ideas connect)

```
┌────────────────────────────────────────────────────────────────────┐
│  DESIGN (human, in GUI)                                            │
│  Build a brutal-style video once → "Save as Template"              │
│  → brutal-design.sptpl (style + optional skeleton)                 │
└───────────────────────────────┬────────────────────────────────────┘
                                │ generateSkillFromTemplate()
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│  WORKSPACE (one folder, File System Access API)                    │
│  projects/  (.spjson)   templates/  (.sptpl)   skills/  (.md)      │
│  AGENTS.md = the router                                            │
└───────────────────────────────┬────────────────────────────────────┘
                                │ agent (Claude Code / Codex / AI panel)
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│  AUTHOR (agent or human, in Markdown)                              │
│  --- template: brutal-design ... ---  +  [top] [anim:zoomIn] …    │
│  → Markdown generator + template apply → styled timeline           │
│  → human polishes in GUI → FTRT export (roadmap)                   │
└────────────────────────────────────────────────────────────────────┘
```

**Mapped to the competitors:**

| Layer | HyperFrames | Remotion | Studio Pro (this plan) |
|---|---|---|---|
| Look / design | hand-written `frame.md` | hand-written React | **derived `.sptpl` from a real project** |
| Skeleton / blocks | catalog blocks | templates | **derived skeleton templates** |
| Skills | 19 hand-written skills | agent docs (hand-written) | **auto-generated skill docs per template** |
| Authoring contract | HTML + `data-*` | React props | **Markdown + props** (already compiles) |
| Render | headless Chrome | headless Chrome | GUI export (FTRT roadmap), headless later |

---

## 5. Implementation Plan (phased, each independently shippable)

| Phase | Work | Outcome | Est. |
|---|---|---|---|
| **P1 — Markdown props** | Front-matter block parser + generalized `[key:value]` tag collection → per-element props → wired into `mdHeadingClip`/`mdTextClip`/image/math builders + `applyMarkdownStyle` | Scripts control template, style, animation, timing, layout, audio | Small (days) |
| **P2 — Save as Template** | `captureTemplateFromProject(name, kind)` → `.sptpl` (strip/parameterize content, keep styles, extract palette, thumbnail); "Save as Template" in the Projects modal | Every project becomes a reusable template; template gallery + apply modes (from Design-Templates-and-Skills-Plan.md) | Medium (1 wk) |
| **P3 — Workspace folder** | `showDirectoryPicker` workspace: `workspace.json` manifest, sync registry ↔ `projects/`, import `.spjson`/`.sptpl` on open; download/upload fallback stays | Real on-disk folder the user owns; files travel between machines | Medium (1 wk) |
| **P4 — Skill generation** | `generateSkillFromTemplate()` → `skills/<name>.md` + `studio-pro-core.md` (grammar + props contract) + `AGENTS.md` router; "Export workspace" bundles everything | Agents can be pointed at the workspace and produce on-template Markdown | Medium (1 wk) |
| **P5 — Agent loop + AI panel** | From Agent-Authoring-and-Automation-Plan.md: Markdown ↔ `.spcomp`, in-app BYO-key AI panel that outputs Markdown props | "Paste a prompt → pick template → get a styled draft" | Medium (1–2 wks) |

**Recommended order:** P1 → P2 → P3 → P4 → P5. P1 alone is an immediate win (richer Markdown, no UI). P2 makes the user's exact example work ("design brutal → reuse it everywhere"). P3+P4 are the "projects folder + skills" ask. P5 completes the automation story.

---

## 6. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Raw project JSON used as a template copies yesterday's content | "Save as Template" always strips/parameterizes content; never apply a raw `.spjson` as a style template |
| Templates clobber user styling on apply | Override-aware mirror (same discipline as `applyCaptionPreset`); props never silently override explicit element settings |
| Workspace folder breaks on non-Chromium | Progressive enhancement — localStorage registry stays primary; download/upload fallback; MediaBunny already gates Chromium |
| Skills drift from the actual template | Generate from the `.sptpl` on save/export (single source of truth), never hand-edit the generated `.md` |
| Markdown props make the grammar confusing | Front-matter limited to ~10 keys; unknown `[key:value]` ignored (not errors); help text updated; existing scripts keep working (backward compatible) |
| Extracted palette is noisy (gradients, 20 colors) | Dedupe + rank by frequency; keep top 8; let the user edit the palette before saving a template |

---

## 7. What "Done" Looks Like

1. A user designs a brutal-style video **once**, hits **Save as Template**, picks *Look + skeleton*.
2. The workspace folder now contains `templates/brutal-design.sptpl` and `skills/brutal-design.md` — auto-generated, with the palette, fonts, caption language, layout rules, and a parameterized Markdown skeleton.
3. For the next video, the user (or the AI panel, or Claude Code pointed at the workspace) writes:

   ```markdown
   ---
   template: brutal-design
   aspect: 9:16
   captionStyle: wordHighlight
   ---

   # THIS IS BRUTAL [anim:zoomIn] [top]
   **The stat that matters** [font:Anton] [size:140] [color:#fde047] [center]
   ![Logo](mock) [right]
   ```

   …generates the full styled timeline, gets polished in the GUI, and exports — with **zero hand-written templates, zero hand-written skills**, everything derived from work the user already did in the editor they already use.
