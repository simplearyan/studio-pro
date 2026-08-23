# Agent Authoring & Automation Plan — Status Update

> **Date:** August 2026 (Updated)
> **Status:** M0-M6 DONE. M7-M8 REMAINING.
> **See also:** [Current-Status-and-Roadmap.md](../automation/Current-Status-and-Roadmap.md)

---

## What's Done (M0-M6)

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

---

## What's NOT Done (M7-M8)

### M7 — Composition API 🔴 NEXT
**Goal:** AI agents can write entire videos programmatically.

```javascript
StudioPro.createComposition({
  id: 'product-launch',
  duration: 15,
  clips: [
    { type: 'html', html: gradientCard, css: gradientCSS, start: 0, duration: 5 },
    { type: 'text', text: 'Introducing ProductX', start: 2, duration: 5,
      effects: { animIn: 'fadeIn', animInDur: 1.0 } }
  ]
});
```

**Files:**
- `index.html` — Add `createComposition()` to `window.StudioPro`
- `automation/code-to-video/api.js` — Node.js wrapper

### M8 — Animation System 🔴 NEXT
**Goal:** Frame-level animation control from code.

```javascript
StudioPro.interpolate(frame, [0, 30], { from: 0, to: 1, easing: 'easeOut' });
StudioPro.spring(frame, { from: 0, to: 1, damping: 10, mass: 0.5 });
StudioPro.keyframes(clip, {
  opacity: [{ frame: 0, value: 0 }, { frame: 30, value: 1 }],
  scale: [{ frame: 0, value: 0.5 }, { frame: 30, value: 1.0 }]
});
```

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
└── tests/

automation/code-to-video/        # NEW — Code → Video API
├── README.md
├── api.js                       # StudioPro API wrapper
├── templates/                   # Reusable HTML/CSS/JS templates
├── examples/                    # Example compositions
├── skills/                      # AI agent skill docs
└── output/
```

---

## The Two Automation Tracks

### Track A: Markdown → Video (Stable, Done)
1. Write Markdown file
2. Run `node render.js scripts/product-launch.md`
3. Puppeteer opens Chrome, compiles MD → clips
4. MediaBunny exports to MP4 at 4× realtime

### Track B: Code → Video (In Progress)
1. AI agent writes JS file using `StudioPro.createComposition()` API
2. Run `node code-to-video/render.js examples/product-launch.js`
3. Puppeteer opens Chrome, executes composition
4. MediaBunny exports to MP4 at 4× realtime

---

## Decision: API Design

**Current API is good for individual clips. Need composition-level API for full videos.**

Extend `window.StudioPro` with:
1. `createComposition()` — Declare entire video
2. `interpolate()` — Frame-level animation
3. `spring()` — Physics-based animation
4. `audio()` — Programmatic audio
5. `transition()` — Between-clip transitions

Keep backward compatibility — existing `createHtmlClip()` still works.
