# StudioPro Automation — Current Status & Roadmap

> **Date:** August 2026 (Updated)
> **Purpose:** Authoritative document of what's built, what's planned, and the folder structure.

---

## 1. Where We Are Now

### ✅ Phase 0 — Determinism Foundation (DONE)

| Feature | Status | Evidence |
|---|---|---|
| Time quantization | ✅ Done | `quantizeTimeToFrame()` in export loop |
| Seeded shake | ✅ Done | `puzzleSeedFromId()` + `mulberry32` PRNG |
| Preview=render parity | ✅ Done | Same `drawCanvas()` path for both |
| Font determinism audit | ✅ Done | Google + system fonts auto-inject into HTML clip iframes |

### ✅ Phase 1 — FTRT Export (DONE)

| Feature | Status | Evidence |
|---|---|---|
| Frame-index export loop | ✅ Done | `node automation/render.js` with seek-and-capture |
| FTRT mode (4× realtime) | ✅ Done | Tested: 60s video in ~15s |
| Standard MediaBunny mode | ✅ Done | Default mode, frame-by-frame |
| Quality presets (draft/ultra) | ✅ Done | Bitrate caps: draft=8Mbps, standard=15Mbps, ultra=30Mbps |
| Format options (mp4/webm) | ✅ Done | Default mp4, configurable |
| Batch rendering | ✅ Done | `automation/batch.js` |
| Chrome headless automation | ✅ Done | Puppeteer with `headless: 'new'` mode |

### ✅ Phase 2 — Composition Format (DONE)

| Feature | Status | Evidence |
|---|---|---|
| Project serialization | ✅ Done | `serializeProject()` / `applyProject()` |
| Export as `.spcomp` | ✅ Done | File → Export Composition |
| Import `.spcomp` | ✅ Done | File → Import Composition |
| Standalone player | ✅ Done | Double-click `.spcomp` file |

### ✅ Phase 3 — Markdown → Video (DONE)

| Feature | Status | Evidence |
|---|---|---|
| Markdown parser | ✅ Done | `parseMarkdownToClips()` in index.html |
| Heading → clip conversion | ✅ Done | `mdHeadingClip()` |
| Style system | ✅ Done | `applyMarkdownStyle()` with presets |
| Position tags | ✅ Done | `[pos: left/right/center]` |
| CLI render from MD | ✅ Done | `node automation/render.js scripts/animal-test.md` |
| Auto-slide timing | ✅ Done | Per-slide duration calculation |

### ✅ Phase 4 — HTML/CSS/JS Clips (DONE)

| Feature | Status | Evidence |
|---|---|---|
| HTML clip type | ✅ Done | `type: 'html'` in clip system |
| html2canvas rendering | ✅ Done | Offscreen iframe → html2canvas → canvas |
| Realtime update | ✅ Done | No frame seek needed — canvas updates live |
| Canvas selection + drag | ✅ Done | Bounding box, resize handles, move |
| Border radius + stroke | ✅ Done | Applied same as image/video clips |
| Sidebar HTML editor | ✅ Done | HTML/CSS/JS textareas in Basic tab |
| CodePen-style modal editor | ✅ Done | Full-screen editor with live preview |
| Premium gradient presets | ✅ Done | 10 presets: Gradient, Glass, Wisteria, Aurora, etc. |
| Loading placeholder | ✅ Done | Dark placeholder while html2canvas renders |
| No blank flash | ✅ Done | Old frame stays visible during re-render |
| Aspect ratio adaptation | ✅ Done | Preview matches canvas ratio; iframes re-create on ratio change |
| Font injection into iframes | ✅ Done | Google + system fonts auto-inject |
| Per-clip font tracking | ✅ Done | `clip.fonts[]` array |

### ✅ Phase 5 — StudioPro API for AI Agents (DONE)

| Feature | Status | Evidence |
|---|---|---|
| `StudioPro.fonts.loadGoogle()` | ✅ Done | Load Google Font by name |
| `StudioPro.fonts.loadGoogleBatch()` | ✅ Done | Load multiple fonts |
| `StudioPro.fonts.useSystem()` | ✅ Done | Reference system font |
| `StudioPro.fonts.list()` | ✅ Done | List all available fonts |
| `StudioPro.fonts.cssImport()` | ✅ Done | Generate CSS @import rule |
| `StudioPro.fonts.linkTag()` | ✅ Done | Generate <link> tag |
| `StudioPro.createHtmlClip()` | ✅ Done | Create HTML clip programmatically |
| `StudioPro.project()` | ✅ Done | Get project info (width, height, fps, etc.) |

### ✅ Phase 6 — Automation Infrastructure (DONE)

| Feature | Status | Evidence |
|---|---|---|
| `automation/render.js` | ✅ Done | Main render script with all options |
| `automation/batch.js` | ✅ Done | Batch render multiple scripts |
| `automation/config.json` | ✅ Done | Default configuration |
| `automation/scripts/` | ✅ Done | 5 test scripts (animal, explainer, product, social, short) |
| `automation/tests/` | ✅ Done | Test suite |
| `automation/assets/` | ✅ Done | Custom fonts, images, videos |
| Default render mode | ✅ Done | FRTR MediaBunny |
| Default quality | ✅ Done | Ultra (30Mbps) |
| Output file naming | ✅ Done | Includes quality, fps, mode, format, resolution |

### ✅ Phase 7 — Composition API (DONE)

| Feature | Status | Evidence |
|---|---|---|
| `StudioPro.createComposition()` | ✅ Done | One call creates entire video |
| `StudioPro.text()` | ✅ Done | Text clip builder |
| `StudioPro.html()` | ✅ Done | HTML clip builder |
| `StudioPro.image()` | ✅ Done | Image clip builder |
| `StudioPro.video()` | ✅ Done | Video clip builder |
| `StudioPro.audio()` | ✅ Done | Audio clip builder |
| `StudioPro.shape()` | ✅ Done | Shape clip builder |
| `StudioPro.scene()` | ✅ Done | Scene clip builder |
| Auto-track creation | ✅ Done | Creates tracks if not provided |
| Auto-duration extension | ✅ Done | Extends project if clips exceed duration |

### ✅ Phase 8 — Animation System (DONE)

| Feature | Status | Evidence |
|---|---|---|
| `StudioPro.interpolate()` | ✅ Done | Frame → value mapping |
| `StudioPro.spring()` | ✅ Done | Physics-based animation |
| `StudioPro.keyframes()` | ✅ Done | Per-property keyframe animation |
| `StudioPro.getKeyValue()` | ✅ Done | Read keyframe value at any frame |
| Easing functions | ✅ Done | linear, easeIn, easeOut, easeInOut, cubic, bounce, elastic, spring |
| Integration with `calculateAnimationState()` | ✅ Done | Keyframes override animation state |

### ✅ Phase 9 — Code-to-Video Automation (DONE)

| Feature | Status | Evidence |
|---|---|---|
| `automation/code-to-video/` folder | ✅ Done | Complete folder structure |
| `api.js` | ✅ Done | Node.js Puppeteer wrapper |
| `render.js` | ✅ Done | CLI entry point |
| Example compositions | ✅ Done | 3 examples (product-launch, social-reel, kinetic-text) |
| `skills/AGENTS.md` | ✅ Done | Agent contract with full API reference |
| `skills/product-launch.md` | ✅ Done | Skill doc: marketing videos |
| `skills/social-reel.md` | ✅ Done | Skill doc: short-form social |
| `skills/kinetic-text.md` | ✅ Done | Skill doc: kinetic typography |
| `templates/design-tokens.md` | ✅ Done | frame.md-style visual tokens (5 sets) |
| `templates/gradient-card.html` | ✅ Done | Reusable gradient card template |
| `templates/glassmorphism.html` | ✅ Done | Reusable glassmorphism template |
| `templates/premium-gradient.html` | ✅ Done | Reusable Wisteria mesh gradient |

---

## 2. What's NOT Done (The Real Gaps)

| # | Gap | Priority | Effort | Why It Matters |
|---|---|---|---|---|
| 1 | **Transitions** (fade/slide/wipe between clips) | 🔴 High | 1-2 days | Videos look amateur without transitions |
| 2 | **More templates** (countdown, testimonial, stats) | 🟡 Medium | 1 day | More reusable assets for agents |
| 3 | **More skills** (explainer, data-viz, testimonial) | 🟡 Medium | 1 day | More workflows for agents |
| 4 | **Preview server** (hot reload while editing) | 🟢 Low | 1-2 days | Better DX for code-to-video |
| 5 | **In-app AI panel** (BYO-key prompt → video) | 🟢 Low | 1-2 days | The "wow" UX |

---

## 3. Folder Structure

```
automation/
├── README.md                    # How to use MD → Video
├── config.json                  # Default settings
├── render.js                    # Main render script (Puppeteer + MediaBunny)
├── batch.js                     # Batch render multiple scripts
├── package.json                 # Dependencies
├── package-lock.json
├── .gitignore
│
├── scripts/                     # Markdown video scripts
│   ├── animal-test.md
│   ├── explainer.md
│   ├── product-launch.md
│   ├── short-test.md
│   └── social-short.md
│
├── assets/                      # Shared assets for MD videos
│   ├── fonts/                   # Custom fonts (woff2/otf)
│   ├── images/                  # Logo, backgrounds
│   └── videos/                  # B-roll, intro clips
│
├── output/                      # Rendered videos (gitignored)
│   └── *.mp4, *.webm
│
├── tests/                       # Test scripts
│   └── test-export.js
│
└── code-to-video/               # NEW — Code → Video API
    ├── README.md                # Full API reference
    ├── api.js                   # Node.js Puppeteer wrapper
    ├── render.js                # CLI entry point
    │
    ├── skills/                  # AI agent workflows
    │   ├── AGENTS.md            # Agent contract (read FIRST)
    │   ├── product-launch.md    # Skill: marketing videos
    │   ├── social-reel.md       # Skill: short-form social
    │   └── kinetic-text.md      # Skill: kinetic typography
    │
    ├── templates/               # Reusable assets
    │   ├── design-tokens.md     # frame.md-style visual tokens
    │   ├── gradient-card.html   # Gradient card template
    │   ├── glassmorphism.html   # Glassmorphism card template
    │   └── premium-gradient.html # Wisteria mesh gradient
    │
    ├── examples/                # Example compositions
    │   ├── product-launch.js
    │   ├── social-reel.js
    │   └── kinetic-text.js
    │
    └── output/                  # Rendered videos (gitignored)
```

---

## 4. The Two Automation Tracks

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

## 5. What "Done" Looks Like

A user (or AI agent) can:
1. Build a timeline in the GUI — or write Markdown — or write code
2. Hit **Export** and get a deterministic MP4 **4× faster than real-time**
3. Use `StudioPro.createComposition()` to write entire videos programmatically
4. Use `StudioPro.interpolate()` / `StudioPro.spring()` for frame-level animation
5. Use design tokens for consistent brand styling
6. Follow skill docs for common video types
7. Export with FTRT speed, quality presets, batch rendering

**That is the Remotion experience — but without React, without build steps, with a visual editor, and with our unique advantages (premium gradients, multiple export modes, no accounts).**
