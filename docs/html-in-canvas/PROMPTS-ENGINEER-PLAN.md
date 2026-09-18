# /prompts-engineer — Visual Prompt Builder (Plan)

> A standalone studio page where a prompt is **designed from modules** — format,
> content, typography, palette, layout, motion timeline, libraries, duration —
> edited with visual tools, then **assembled into one copy-paste prompt** that
> works in Gemini / ChatGPT / Claude to generate HIC animation code.

> Sibling to `/designs` (gallery) and `test-renderer.html` (preview/export).
> Same colocated static-copy deploy: `docs/html-in-canvas/prompts-engineer.html`.
> Same design language: Rubik, Material 3 tokens, Tailwind v4, dark-first, responsive.

---

## 1. Core insight — prompts have a fixed half and a creative half

The test-renderer's `aiBuildPrompt(want, dur)` already splits every prompt into:

- **HARD CONTRACT** (fixed): deterministic `onFrame(time)`, 800×450, CDN rules,
  title rule, output format — identical for every animation.
- **WHAT I WANT** (creative): the per-design brief — the only part that changes.

The prompts-engineer is a **structured editor for the creative half**, plus a
configurable contract half (so new rules or libraries can be toggled without
code changes). The assembler re-attaches the contract at copy time, exactly like
`aiBuildPrompt` does — so contract improvements propagate everywhere.

---

## 2. Module system

Each module = a collapsible M3 card with a toggle (active/inactive), an icon,
and its own editor UI. Active modules serialize, in canonical order, into
fluent English brief text.

| # | Module | Editor UI | Emits |
|---|---|---|---|
| 1 | **Format** | icon-grid of 10 video archetypes (logo sting, title intro, lower third, subtitle/captions, slideshow, data viz, math lecture, blog/MDX, product promo, outro) + one-line intent field | "Design a `<archetype>` …" opener |
| 2 | **Content** | dynamic field list per archetype: words/brand name, quote+author, stat values, image URL list (with Unsplash ID helper + thumbnail preview), markdown source, math expressions | the "what's on screen" paragraph |
| 3 | **Typography** | two font-pairing pickers (heading/body) from a curated Google Fonts list with **live sample text**, weight chips, size slider, tracking slider, caps toggle | fonts link instruction + type hierarchy sentence |
| 4 | **Palette & Mood** | 5-swatch palette editor (auto-palettes: Google, Editorial, Neon, Pastel, Paper…), background style picker (solid/gradient/grain/scanlines), mood keyword chips (calm, energetic, cinematic, corporate…) with contrast ratio readout | color spec paragraph with real hex values |
| 5 | **Layout** | composition picker (centered, lower-third, split, grid, full-bleed) on a mini 16:9 wireframe, margin/density slider | placement sentence |
| 6 | **Motion Timeline** | the star: **step rows** (`start ms`, `duration ms`, element target, motion verb picker: fade-up/slam/wipe/scale-pop/draw/count/ken-burns/highlight-fill, easing picker with **visual curve thumbnails**: ease-out, cubic, overshoot/back, linear, elastic), stagger control (per-item ms), optional infinite loop toggle (float/pulse/drift) | ordered choreography paragraph: "X slides in (0–300ms, cubic ease-out), staggered 120ms apart…" |
| 7 | **Libraries** | toggles: KaTeX / marked / Tailwind / Google Fonts (auto-on when module 3 used) → emits the exact CDN-tag instructions per the contract's allowlist | library instruction lines |
| 8 | **Duration & Title** | duration slider 1–30s (snaps to 0.5s) + title input (drives the `<title>` rule and filename) | CLIP DURATION line + title instruction |

### Assembler (the engineering core)
`assemble(modules, contract)` → deterministic, deduped, ordered brief:
`Format → Content → Typography → Palette → Layout → Libraries → Choreography → Duration/Title`.
Rules: inactive modules vanish; empty fields vanish; motion steps sort by start
time; numbers formatted consistently (`0–300ms`); output length capped with a
live **char/token estimate** badge per module and total.

### Contract editor (advanced, collapsed by default)
The 7 contract rules as editable rows (pre-filled from `aiBuildPrompt`'s text) +
output-format template. Most users never open it; tinkerers can add rules
(e.g. "no external images").

---

## 3. Page layout (responsive)

| Region | ≥1024px | 640–1024px | <640px |
|---|---|---|---|
| Left: module stack (accordion, drag to reorder serialization preview) | 7 cols | stacked | stacked |
| Right: **Live Prompt Preview** (sticky, mono panel, syntax-tinted: contract gray / brief white / numbers violet) + char count + Copy | 5 cols sticky | sticky bottom sheet | full-screen sheet tab |
| Header: page title, **Preset recipes** menu, Save/Load, "Open in Test Renderer" | | | |

- **Mobile:** two tabs — *Modules* / *Prompt* — with a floating Copy button.
- **Recipes menu:** one-click fills all modules from the 22 existing library
  prompts (parsed heuristically into modules) — the page is instantly useful on day one.
- **Save/Load:** named prompt blueprints in localStorage + export/import `.json`
  (same file shape as the /designs gallery `prompt` field — a blueprint can be
  published straight to the gallery in Phase E).

## 4. Cross-page wiring

- `test-renderer.html` AI tab gains "Open in Prompt Engineer" (deep link carries the current brief in `#want=`).
- `prompts-engineer.html` header gains "Test in Test Renderer" (deep link `test-renderer.html#aiwant=<brief>` which opens the modal's AI tab pre-filled).
- Both pages stay in the same static-copy deploy, so deep links are trivial.

## 5. Quality rails built into the assembler

- Emits only contract-legal features (no keyframes/timeout language can be produced).
- Warns inline: motion step overlapping badly (starts before previous ends), palette contrast < 4.5 on body text pairs, duration < total choreography span.
- Char budget: brief soft-capped at ~6,000 chars (Gemini-friendly); counter turns amber past it.

## 6. Implementation phases

- **A — Skeleton + assembler:** page shell (Rubik/M3/responsive), module schema,
  `assemble()` engine, live preview panel, Copy. Modules 1, 2, 8 functional.
- **B — Visual editors:** Typography picker with live samples, Palette editor with
  contrast readout, Layout wireframes, Library toggles.
- **C — Motion Timeline editor:** step rows, easing curve thumbnails, stagger,
  loop toggles; the choreography paragraph serializer.
- **D — Recipes + wiring:** heuristic parser that loads the 22 library prompts
  into modules; deep links with test-renderer; blueprints save/load/import/export.
- **E — Round-trip + gallery:** "reverse-parse a pasted brief" (best-effort),
  publish blueprint → /designs submit modal, contract editor, a11y + PWA entries.

## 7. Risks

- **Heuristic parsing of free-form briefs is imperfect** → round-trip is
  best-effort with a visible "modules matched: 5/7" honesty badge; the text
  preview is always the source of truth for copying.
- **Serializer drift vs `aiBuildPrompt`** → contract text is imported from the
  same source constant; a shared `hic-shared.js` extraction (designs plan §7)
  later hosts both.
- **Scope creep in module UIs** → every module ships behind a toggle; the page
  is useful with modules 1+2+8 alone.
