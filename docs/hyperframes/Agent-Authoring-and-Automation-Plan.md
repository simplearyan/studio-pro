# Agent Authoring & Automation Plan — Making Studio Pro Automate Video Like Remotion & HyperFrames

> **Date:** August 2026
> **Trigger:** "Remotion – Full Tutorial for Beginners" (youtube.com/watch?v=pVPU1PnhXGs, Maciej Dziuba) — the canonical *"install a tool, let Claude Code / Codex write the video, render from the terminal"* workflow — plus a fresh look at Remotion's and HyperFrames' agent ecosystems.
> **Question this doc answers:** How do we give Studio Pro the two things Remotion and HyperFrames have and Studio Pro lacks — **templates** (reusable looks an agent or user can apply) and **skills** (production workflows an agent can run) — without losing what makes Studio Pro special (browser-only, WYSIWYG, Canvas renderer, zero servers)?
>
> Sibling docs: [StudioPro-vs-Hyperframes-vs-Remotion.md](./StudioPro-vs-Hyperframes-vs-Remotion.md) (layer comparison), [HyperFrames-Deep-Dive.md](./HyperFrames-Deep-Dive.md) (architecture), [Roadmap-Programmatic-Video.md](./Roadmap-Programmatic-Video.md) (composition file + render), [Render-Speed-Analysis-and-Plan.md](./Render-Speed-Analysis-and-Plan.md) (FTRT export), [Design-Templates-and-Skills-Plan.md](./Design-Templates-and-Skills-Plan.md) (the `.sptpl` design-template model).

---

## 0. TL;DR

All three tools converge on one idea: **a video is a deterministic function of time, and whoever can *write that function* can automate video.** The difference is the authoring surface:

- **Remotion** makes the authoring surface **React/TSX code** — an agent writes components, `npx remotion render` outputs MP4. Mature (Studio, Lambda, skills, docs), but you must set up a Node project, and the license is source-available, not free-for-everyone.
- **HyperFrames** makes the authoring surface **plain HTML** — an agent writes `<div data-start data-duration>`, `window.__hf.seek(t)` renders. Zero build step, Apache 2.0, ships 19 built-in agent skills + a `frame.md` design system.
- **Studio Pro** already has the *renderer* both of them fight to build: `drawCanvas(targetCtx, w, h)` is a pure time→frame seek function that draws to a Canvas **it owns** — no headless-Chrome determinism battle. What it lacks is the *authoring surface for automation*: no composition-file format, no agent loop, no templates-as-data, no skills.

**The plan in one sentence:** bolt the two missing authoring surfaces onto the renderer we already have — **(A) Project Design Templates** (`.sptpl` — bundled, customizable preset+style layers that map 1:1 onto HyperFrames' frame.md) and **(B) an Agent Authoring Loop** (Markdown ↔ `.spcomp` composition file ↔ render, plus an optional in-app AI panel) — built on the **determinism + FTRT substrate** from the existing roadmap. The GUI stays; automation becomes a second, first-class path.

---

## 1. What the Video Teaches (and Why It's the Target UX)

"Remotion – Full Tutorial for Beginners" (Maciej Dziuba, Aug 2026, ~11K views) is the exact workflow that made code-to-video mainstream:

1. `npm create video` / install Remotion with **Claude Code or Codex**.
2. Launch **Remotion Studio** (the visual preview).
3. The agent writes a React `<Composition>` — `<Sequence>`, `useCurrentFrame()`, `interpolate()`, fonts, captions — iterating against Studio's live preview.
4. `npx remotion render` → MP4 in the terminal. Repeat.

**The three properties that make this feel like magic, and that Studio Pro must replicate:**

| Property | How Remotion achieves it | How HyperFrames achieves it | Studio Pro's equivalent |
|---|---|---|---|
| **Agent can author** | React files are text; agents write code all day | HTML files are text; agents write HTML all day | **Missing** — the timeline is a JSON blob in `localStorage`; no agent-editable artifact |
| **Instant visual feedback** | Remotion Studio hot-reloads the component | HyperFrames Studio live-reloads the HTML | ✅ Already better — WYSIWYG canvas with live preview |
| **Headless render** | `npx remotion render` | `npx hyperframes render` | **Missing** — export needs a human pressing a button in a live tab |

Studio Pro's unfair advantage: it doesn't need to *capture* a browser — it *is* a browser. So the missing properties reduce to **file formats** (authorable artifact + headless entry point) and **determinism hygiene**, not render-engine engineering.

---

## 2. Tool Comparison — Pros & Cons (2026, verified)

### Remotion
| Pros | Cons |
|---|---|
| Most mature ecosystem: Remotion Studio, Lambda cloud rendering, bulk render API, `@remotion/transitions`, player, MCP/skill docs (`docs/ai/coding-agents`) | **Source-available license** — not Apache/MIT; free tier limited (individuals/small companies); a real constraint if the user's project is commercial |
| Huge community; tutorials like the one analyzed are abundant | **Requires a Node/React project + bundler** — the barrier HeyGen explicitly cited for moving to HTML |
| Typed, testable, composable (real programming language) | Rendering needs **Chrome installed** + heavy headless-Chrome capture machinery |
| Deterministic by design (pure frame math, Rust compositor for video) | Authoring is **code-first** — non-developers can't touch it; no real WYSIWYG timeline |
| React interop — fits inside React apps | Steep learning curve vs a GUI editor |

### HyperFrames (HeyGen, Apache 2.0)
| Pros | Cons |
|---|---|
| **Plain HTML is the format** — agents are excellent at HTML; no build step, plays as-is in a browser | Rendering is **DOM capture** — massive engineering spent making headless Chrome deterministic (`beginFrame`, flags, warmup, pixel hashes) |
| Ships **19 agent skills** + `frame.md` design system + catalog blocks + Lambda — the most complete agent story today | **Video-in-video is a JPEG flipbook** — pre-decode everything, swap `<img>` stills; coarse, file-I/O heavy, blob-URL pain |
| Apache 2.0 — genuinely open | HTML+CSS fidelity is browser-limited for advanced effects (no per-letter canvas text, no Web Audio duck graph) |
| Seek-don't-play contract is elegantly simple (`window.__hf.seek(t)`) | Preview is iframe+postMessage, not a real multi-track timeline editor |
| Newer, smaller community than Remotion | Authoring still means *writing* HTML/CSS/JS — no WYSIWYG for non-coders |

### Studio Pro (today, verified in code — 29,829-line index.html)
| Pros | Cons |
|---|---|
| **Owns its rasterizer** — `drawCanvas(targetCtx, w, h)` (index.html:4690) is a pure seek function; no compositor fight, no capture heuristics | **No composition file format** — the timeline is `serializeProject()` JSON (index.html:26586); not portable, not agent-editable |
| **WYSIWYG multi-track timeline** — neither Remotion nor HyperFrames has a real one | **Export is wall-clock real-time** — `realtimeExportLoop` (index.html:29572) advances `State.currentTime` by `performance.now()` elapsed; video clips play at 1× |
| **Markdown → video generator** — the seed of agent authoring (builders `mdHeadingClip`, `applyMarkdownStyle`) | **Not deterministic** — `shake` uses `Math.random()`; time isn't quantized; preview/export parity unenforced |
| MediaBunny WebCodecs export — **no FFmpeg needed**; deterministic `OfflineAudioContext` audio pre-render (ahead of both competitors) | **Zero agent/AI surface** — no skills, no AGENTS.md contract, no templates-as-data, no AI panel, no headless entry |
| Scenes = pre-compositions (nested, recursive offscreen-canvas render); 22 built-in presets + custom preset library + multi-project registry (Projects modal, keyboard nav) | Single-file app = hard to unit test; no CLI |
| 100% browser, no accounts, no servers — PWA-deployable to GitHub Pages | — |

**The honest headline:** Studio Pro is *behind* on authoring surfaces (files, skills, templates) but *ahead* on the renderer and editor. The plan is to close the authoring gap by converting what the editor already does into files and contracts — not to rebuild the engine.

---

## 3. Studio Pro Today — Feature Audit for Automation (what to add / improve)

Verified against the current code (line numbers from `index.html`, 29,829 lines):

### Already good (foundation — don't touch)
- `drawCanvas(targetCtx, targetW, targetH, opts)` (4690) — single render path shared by preview, scrub, and export.
- `calculateAnimationState(clip, clipTime, timeLeft, w, h)` (3514) — pure time→state, structurally identical to Remotion's `interpolate(frame, …)`.
- Markdown → timeline compiler (`markdownConfig`, `mdHeadingClip` (20143), `applyMarkdownStyle` (18295), position tags, slides).
- Global-config + per-item-override model for captions (`subtitleConfig`, `applyCaptionPreset`) — the discipline design templates must respect.
- Scenes (pre-comps with opaque/transparent bg), presets (`DEFAULT_PRESETS` at 1408 + custom presets), multi-project registry (`createNewProject` (26924), `duplicateProject`, Projects modal with keyboard nav), frame export (resolution-consistent, 1080p/4K), re-import media + one-click folder re-import.
- MediaBunny WebCodecs export + `OfflineAudioContext` deterministic audio pre-render.

### Gaps, in priority order (each maps to a plan phase below)

| # | Gap | Why it blocks automation | Phase |
|---|---|---|---|
| 1 | **No agent-authorable file format** (`.spcomp`) | An agent has nothing to write; "skills" have no target | P2 |
| 2 | **No design-template layer** (`.sptpl`) | Reusable looks exist only as single-element presets; no "make it look like X" artifact | P1 |
| 3 | **Export is wall-clock** (`realtimeExportLoop`) | Automating 10 videos means waiting 10× duration; no headless render possible | P0/P3 |
| 4 | **Not deterministic** (Math.random shake, float time) | Same input → different output every run; breaks preview/render parity and CI | P0 |
| 5 | **Video clips force 1× playback** | Even with a frame loop, video pins export to real time | P3 |
| 6 | **No skills / agent contract** (no AGENTS.md, no workflow docs) | Agents have no instructions for "make a product-launch video" | P4 |
| 7 | **No in-app AI surface** | The "paste a prompt, get a video" UX is the thing that makes this feature discoverable | P5 |
| 8 | **No headless/CLI path** | Can't render from CI, a server, or another machine | P6 |

---

## 4. The Plan — Three Pillars

Everything is **browser-first, no servers, no accounts** (Studio Pro's product promise). The AI story is either bring-your-own-key (in-app panel) or agent-authoring (files + skills), never a hosted backend.

### Pillar A — Templates: Project Design Templates (`.sptpl`)

**What:** a named bundle of *typed presets* + *project globals* — text/shape/media/scene/keyframe preset packs, `captionStyle` + `captionAnimation`, `markdownStyle`, canvas globals (aspect, fps, background), and a `palette` token set. This is HyperFrames' `frame.md` translated into Studio Pro's own data model.

**Why it automates video:** "make a product-launch video" becomes "apply the **Launch Aurora** template, drop in your text." A template is data an agent can also generate — the agent's first artifact, before any clip exists.

**Design rules (from Design-Templates-and-Skills-Plan.md, keep them):**
- Every member is an ordinary preset object → fully customizable through existing editors.
- Apply modes: **Apply to project** (writes every layer now) vs **Use as defaults** (new clips pick it up).
- Override-aware mirror — never clobber per-caption/per-clip overrides (same discipline as `applyCaptionPreset`).
- Undo-friendly (one Undo step).
- `.sptpl.json` export/import with versioned schema + round-trip guarantee.

**Template categories = project types (the skills analog):** product-launch, explainer, social-clips (kinetic type), captions (karaoke menu), talking-head (lower thirds), slideshow, minimal/brand. The gallery modal becomes the in-app router.

**Ship order:** engine (storage + `applyDesignTemplate` + `captureTemplateFromProject`) → gallery UI → editor (edit members through existing editors) → share (`.sptpl` import/export).

### Pillar B — Skills: The Agent Authoring Loop

**What:** make the timeline **round-trippable as text** so an agent (Claude Code, Codex, or the in-app AI) can create and edit videos, HyperFrames-style.

**B.1 — The composition file (`.spcomp`, from Roadmap Phase 3):** a typed, portable projection of `serializeProject()`: width/height/fps/duration, embedded assets (data URIs — no network at render time), tracks, clips with effects + keyframes, and a `seek(composition, t)` contract. Rules: no `Math.random()`, no `Date.now()`, time quantized to fps, fonts pinned. Round-trip guarantee: export `.spcomp` → import → byte-stable project.

**B.2 — The two-way Markdown bridge (Roadmap Phase 4):** Studio Pro already compiles Markdown → timeline. Add:
- Markdown → `.spcomp` (run the existing generator, serialize the result), and
- `.spcomp` → Markdown (best-effort exporter using the existing `_mdGenerated` metadata).

Now an agent iterates like the video's workflow: *write Markdown → render composition → preview → edit → render*. No React project, no bundler — plain text both ways.

**B.3 — Skills = documented workflows + a contract file.** A `skills/` folder (or `AGENTS.md`) that teaches an agent:
- the `.spcomp` schema and seek contract (`/studio-pro-core`),
- how to drive the template gallery (`/studio-pro-design` — pick project type → apply template → generate Markdown),
- the production loop for each project type (the 7 categories above) — mirroring HyperFrames' 19 skills but grounded in Studio Pro's actual data model,
- when to hand off to the GUI (agents can't run the full editor; humans finish in the GUI and export).

**B.4 — Media resolution:** an agent needs a "give me a video/image/audio asset" rule (HyperFrames' `/media-use` skill): every referenced asset must be resolved to a local file/data URI before render, or the render fails loudly with a list of missing assets.

### Pillar C — Automation Substrate (unlocks A + B)

**C.1 — Determinism hygiene (Roadmap Phase 0):** quantize time to frames on every seek; replace `Math.random()` shake with the existing seeded PRNG (`puzzleSeedFromId` + `mulberry32`); keep wall-clock only in the interactive playback loop; add a preview=render parity check (hash-diff scrub vs export).

**C.2 — FTRT export (Roadmap Phase 1):** replace the wall-clock `realtimeExportLoop` with a seek-and-capture loop (`for frame → quantize → State.currentTime → drawCanvas → createImageBitmap → encode`), keeping `MAX_IN_FLIGHT` backpressure and progress/cancel UX. Text/shape/math/scene timelines go faster-than-real-time on day one.

**C.3 — Deterministic video (Roadmap Phase 1.2):** pre-decode video clips into a sliding-window `ImageBitmap[]` pool (WebCodecs in a Worker; `createImageBitmap(videoEl)` fallback) and `drawImage(pool[frameIndex])` instead of playing live `<video>` at 1× — the in-browser flipbook. Removes the last real-time dependency.

**C.4 — Parallel chunks (Roadmap Phase 2, optional):** OffscreenCanvas render worker + chunked timeline = Studio Pro's version of N-Chrome-process parallelism, without Chrome.

**C.5 — Headless entry (Roadmap Phase 5, optional):** a slim render-only page (or CLI wrapper) that loads a `.spcomp` via URL and runs the same seek loop headlessly for CI/server renders.

### Pillar D — In-App AI Panel (the user-facing "wow")

**What:** a **"Create with AI"** panel (tab or modal) that takes a prompt + template pick and produces a first-draft timeline *entirely in the browser*:
1. User pastes a brief ("product launch for my SaaS, dark theme, 30s").
2. Panel calls the user's own LLM (bring-your-own-key: provider + key stored in localStorage, never sent anywhere else — or, in a future PWA/extension build, an optional local agent).
3. The LLM returns **Markdown** (the format Studio Pro already compiles — the lowest-risk contract; no new schema for the AI to learn).
4. Existing Markdown → timeline generator builds the draft; the user picks the template first so the output lands styled.
5. Human polishes in the GUI (this is where Studio Pro beats both competitors), exports FTRT.

**Why Markdown is the contract:** Studio Pro already compiles it, it's the format agents are best at, and it maps 1:1 to HyperFrames' "agents write HTML" bet — with a stricter, friendlier grammar (position tags, slides, mocks). `.spcomp` remains the *portable* artifact; Markdown is the *authoring* artifact.

---

## 5. Feature-by-Feature: What to Add / Improve (ranked)

| Rank | Feature | What it is | Unlocks |
|---|---|---|---|
| 1 | **Time quantization + seeded shake** | `quantizeTimeToFrame(t, fps)` everywhere; seeded PRNG for shake | Determinism, parity, FTRT, CI renders |
| 2 | **Frame-index export loop** | Replace wall-clock `realtimeExportLoop` time source | FTRT export (3–10×) |
| 3 | **Video frame pool** | WebCodecs pre-decode → `ImageBitmap[]` sliding window | FTRT with video; deterministic video |
| 4 | **`.spcomp` export/import** | Portable composition file + `seek()` contract + round-trip | Agent authoring, portability, headless |
| 5 | **`.sptpl` design templates** | Bundled preset+style layers, gallery UI, apply modes | "Make it look like X" in one click; agent first artifact |
| 6 | **Markdown ↔ `.spcomp` bridge** | Both directions; `_mdGenerated` metadata reused | Two-way agent loop |
| 7 | **Skills + AGENTS.md contract** | Documented workflows per project type; `.spcomp` schema doc | Agents can drive Studio Pro |
| 8 | **In-app AI panel (BYO key)** | Prompt → Markdown → styled timeline via existing generator | The "paste a prompt, get a video" UX |
| 9 | **Template catalog + community share** | `.sptpl` gallery, export/import, thumbnails | Ecosystem; monetization path |
| 10 | **Parallel chunk export** | OffscreenCanvas worker per chunk | Scales with cores |
| 11 | **Headless/CLI render** | Render-only page or `studio-pro render file.spcomp` | CI, servers, scale |
| 12 | **Determinism parity check** | Hash-diff scrub vs export (console/CI) | Proves preview=render |

**Quick wins vs big bets:** ranks 1–2 are a day of work each and make exports repeatable + faster immediately. Ranks 4–7 are the "Remotion/HyperFrames moment" (agent authoring). Rank 8 is the highest-drama feature for end users. Ranks 10–12 are optional scale-out.

---

## 6. Milestones (build order)

| Milestone | Work | Outcome | Est. |
|---|---|---|---|
| **M0 — Deterministic core** | Quantize time, seeded shake, parity check | Same input → same frames; foundation for everything | Days |
| **M1 — FTRT export** | Frame-index loop (+ video pool after) | 60s text/markdown video exports in ~20–40s; video timelines after pool lands | 1–2 wks |
| **M2 — `.sptpl` templates** | Template engine + gallery + editor + share | One click = whole project restyled; fully customizable; Undo-safe | 1–2 wks |
| **M3 — `.spcomp` format** | Export/import, seek contract, round-trip test, standalone player | Portable composition file; agent-editable artifact exists | 1–2 wks |
| **M4 — Agent loop + skills** | Markdown ↔ `.spcomp`; AGENTS.md + skills docs | Claude Code/Codex can create and edit Studio Pro videos | 1 wk |
| **M5 — In-app AI panel** | BYO-key prompt → Markdown → styled timeline | "Paste a prompt, get a draft, polish in GUI" UX | 1–2 wks |
| **M6 — Parallel + headless (optional)** | Worker chunks; render-only page/CLI | Scales with cores; CI/server renders | 2–4 wks |

**Recommended sequence:** M0 → M1 → M2 → M3 → M4 → M5 first (all in-browser, each builds on the last). M6 is additive. **The user-visible "wow" arrives at M2 (templates) and M5 (AI panel); the automation story is complete at M4.**

---

## 7. What NOT to Do (avoid Remotion/HyperFrames' mistakes)

1. **Don't chase DOM capture.** Adopting HyperFrames' headless-Chrome pipeline would throw away Studio Pro's core advantage (owns the rasterizer). Never render by screenshotting the app.
2. **Don't make the AI contract `.spcomp` JSON.** LLMs are far better at Markdown than at conformant JSON timelines. Markdown for authoring, `.spcomp` for portability/render.
3. **Don't require a build step or Node project** (Remotion's barrier). Keep it a single-file browser app + data files.
4. **Don't bake in a hosted AI backend** — no accounts, no server costs, no privacy surprises. BYO-key or file-based agents only.
5. **Don't clobber user styling on template apply** — the override-aware mirror is non-negotiable; a template that resets your work is a trap, not a feature.
6. **Don't let the AI panel produce un-ownable output** — everything generated must be ordinary clips on the timeline the user can edit, delete, or restyle like any other.

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Agent writes valid Markdown but nonsensical video (bad timing, missing media) | Generator defaults (per-slide duration, `mdGap`) + a "lint" pass that reports missing assets and over-long slides before render |
| `.spcomp` drifts from `State` model over time | Generate from `serializeProject()` (single source of truth); round-trip test in CI; versioned schema |
| FTRT export breaks audio sync or progress UX | Audio is already timestamped (µs) and muxed by timestamp — speed is irrelevant; keep existing progress/cancel plumbing |
| Video frame pools blow memory | Sliding-window decode (1–2s lookahead), downscale to export res, LRU eviction |
| BYO-key AI panel leaks the key | Key in localStorage, sent only to the provider's API from the browser; never logged; optional in-memory-only mode |
| Templates bloat localStorage (thumbnail data URLs) | Downscale thumbnails (existing `capturePresetThumbnail` path); `.sptpl` as files on export |
| Scope creep (the plan is big) | M0–M5 are independently shippable; each milestone is a standalone user win; M6 optional |

---

## 9. "Done" Looks Like

A user — or an AI agent — can:

1. **Pick a template** (gallery, categorized by project type) and get a styled project in one click.
2. **Paste a prompt** into the in-app AI panel → get an editable Markdown-generated draft, styled by the template, ready to polish in the GUI.
3. **Export a `.spcomp`** — one portable file that plays standalone and renders deterministically, FTRT.
4. **Have Claude Code/Codex** (or any coding agent) create and edit videos by writing Markdown and `.spcomp` files, using the shipped skills, with no GUI and no Node project.
5. (Optional) **Render from CI or a server** via the headless entry point.

That is the Remotion/HyperFrames automation experience — with a real timeline editor, a Canvas renderer that never fights the browser, deterministic audio, and zero servers.
