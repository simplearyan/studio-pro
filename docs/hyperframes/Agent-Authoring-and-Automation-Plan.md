# Agent Authoring & Automation Plan — Status Update

> **Date:** August 2026 (Updated)
> **Status:** M0-M9 DONE. Remaining: transitions, more templates/skills, preview server, AI panel.
> **See also:** [Current-Status-and-Roadmap.md](../automation/Current-Status-and-Roadmap.md)

---

## What's Done (M0-M9)

### M0 — Determinism Foundation ✅
- Time quantization via `quantizeTimeToFrame()`
- Seeded PRNG (`mulberry32`) replaces `Math.random()` in shake
- Preview=render parity enforced

### M1 — FTRT Export ✅
- Frame-index loop: `for frame → quantize → State.currentTime → drawCanvas → createImageBitmap → encode`
- FTRT mode: 4× realtime (60s video in ~15s)
- Standard MediaBunny mode: default

### M2 — Composition Format ✅
- `serializeProject()` / `applyProject()` for timeline
- Export as `.spcomp` file
- Import `.spcomp` back into editor

### M3 — Markdown → Video ✅
- `parseMarkdownToClips()` compiler
- Heading → clip conversion with styles
- CLI render: `node automation/render.js scripts/animal-test.md`
- Position tags, auto-slide timing

### M4 — HTML/CSS/JS Clips ✅
- New `type: 'html'` clip in clip system
- html2canvas rendering: iframe → html2canvas → canvas
- Realtime update (no frame seek needed)
- Canvas selection + drag + resize handles
- Border radius + stroke support
- Sidebar HTML editor (Basic tab)
- CodePen-style modal editor with live preview
- 10 premium gradient presets
- Loading placeholder, no blank flash
- Aspect ratio adaptation
- Font injection into iframes
- Per-clip font tracking

### M5 — StudioPro API ✅
- `StudioPro.fonts.loadGoogle()` — Load Google Font
- `StudioPro.fonts.loadGoogleBatch()` — Load multiple fonts
- `StudioPro.fonts.useSystem()` — Reference system font
- `StudioPro.fonts.list()` — List all fonts
- `StudioPro.fonts.cssImport()` — Generate CSS @import
- `StudioPro.fonts.linkTag()` — Generate <link> tag
- `StudioPro.createHtmlClip()` — Create HTML clip programmatically
- `StudioPro.project()` — Get project info

### M6 — Automation Infrastructure ✅
- `automation/render.js` — Main render script (Puppeteer + MediaBunny)
- `automation/batch.js` — Batch render multiple scripts
- `automation/config.json` — Default settings
- `automation/scripts/` — 5 test scripts
- `automation/tests/` — Test suite
- `automation/assets/` — Custom fonts, images, videos
- Default: FRTR MediaBunny, Ultra quality, mp4

### M7 — Composition API ✅
- `StudioPro.createComposition()` — One call creates entire video
- Helper builders: `.text()`, `.html()`, `.image()`, `.video()`, `.audio()`, `.shape()`, `.scene()`
- Auto-track creation
- Auto-duration extension

### M8 — Animation System ✅
- `StudioPro.interpolate()` — Frame → value mapping
- `StudioPro.spring()` — Physics-based animation
- `StudioPro.keyframes()` — Per-property keyframe animation
- `StudioPro.getKeyValue()` — Read keyframe value at any frame
- Easing functions: linear, easeIn, easeOut, easeInOut, cubic, bounce, elastic, spring
- Integrated with `calculateAnimationState()`

### M9 — Code-to-Video Automation ✅
- `automation/code-to-video/` folder structure
- `api.js` — Node.js Puppeteer wrapper
- `render.js` — CLI entry point
- Example compositions (product-launch, social-reel, kinetic-text)
- `skills/AGENTS.md` — Agent contract with full API reference
- `skills/product-launch.md` — Skill doc: marketing videos
- `skills/social-reel.md` — Skill doc: short-form social
- `skills/kinetic-text.md` — Skill doc: kinetic typography
- `templates/design-tokens.md` — frame.md-style visual tokens (5 sets)
- `templates/gradient-card.html` — Reusable gradient card template
- `templates/glassmorphism.html` — Reusable glassmorphism template
- `templates/premium-gradient.html` — Reusable Wisteria mesh gradient

---

## What's NOT Done (Remaining Gaps)

| # | Gap | Priority | Effort | Why It Matters |
|---|---|---|---|---|
| 1 | **Transitions** (fade/slide/wipe between clips) | 🔴 High | 1-2 days | Videos look amateur without transitions |
| 2 | **More templates** (countdown, testimonial, stats) | 🟡 Medium | 1 day | More reusable assets for agents |
| 3 | **More skills** (explainer, data-viz, testimonial) | 🟡 Medium | 1 day | More workflows for agents |
| 4 | **Preview server** (hot reload while editing) | 🟢 Low | 1-2 days | Better DX for code-to-video |
| 5 | **In-app AI panel** (BYO-key prompt → video) | 🟢 Low | 1-2 days | The "wow" UX |

---

## Folder Structure (Current)

```
automation/
├── README.md
├── config.json
├── render.js                    # MD → Video (Puppeteer + MediaBunny)
├── batch.js
├── package.json
├── scripts/                     # Markdown video scripts
├── assets/                      # Custom fonts, images, videos
├── output/                      # Rendered videos
├── tests/
│
└── code-to-video/               # Code → Video API
    ├── README.md
    ├── api.js                   # Node.js wrapper
    ├── render.js                # CLI entry point
    ├── skills/                  # AI agent workflows
    │   ├── AGENTS.md
    │   ├── product-launch.md
    │   ├── social-reel.md
    │   └── kinetic-text.md
    ├── templates/               # Reusable assets
    │   ├── design-tokens.md
    │   ├── gradient-card.html
    │   ├── glassmorphism.html
    │   └── premium-gradient.html
    ├── examples/                # Example compositions
    │   ├── product-launch.js
    │   ├── social-reel.js
    │   └── kinetic-text.js
    └── output/
```

---

## The Two Automation Tracks

### Track A: Markdown → Video (Stable, Done)
1. Write Markdown file
2. Run `node render.js scripts/product-launch.md`
3. Puppeteer opens Chrome, compiles MD → clips
4. MediaBunny exports to MP4 at 4× realtime

### Track B: Code → Video (Done)
1. AI agent writes JS file using `StudioPro.createComposition()` API
2. Run `node code-to-video/render.js examples/product-launch.js`
3. Puppeteer opens Chrome, executes composition
4. MediaBunny exports to MP4 at 4× realtime

---

## What "Done" Looks Like

A user (or AI agent) can:
1. Build a timeline in the GUI — or write Markdown — or write code
2. Hit **Export** and get a deterministic MP4 **4× faster than real-time**
3. Use `StudioPro.createComposition()` to write entire videos programmatically
4. Use `StudioPro.interpolate()` / `StudioPro.spring()` for frame-level animation
5. Use design tokens for consistent brand styling
6. Follow skill docs for common video types
7. Export with FTRT speed, quality presets, batch rendering

**That is the Remotion experience — but without React, without build steps, with a visual editor, and with our unique advantages (premium gradients, multiple export modes, no accounts).**
