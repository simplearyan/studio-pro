# StudioPro Automation — Current Status & Roadmap

> **Date:** August 2026
> **Purpose:** Authoritative document of what's built, what's planned, and the folder structure for two automation tracks: **Markdown → Video** and **Code → Video**.

---

## 1. Where We Are Now (Accurate as of August 2026)

### ✅ Phase 0 — Determinism Foundation (DONE)

| Feature | Status | Evidence |
|---|---|---|
| Time quantization | ✅ Done | `quantizeTimeToFrame()` in export loop |
| Seeded shake | ✅ Done | `puzzleSeedFromId()` + `mulberry32` PRNG replaces `Math.random()` |
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

---

## 2. What's NOT Done (The Real Gaps)

| # | Gap | Priority | Effort | Why It Matters |
|---|---|---|---|---|
| 1 | **Composition API** (`createComposition()` with clips array) | 🔴 High | 1-2 wks | Agents can't write entire videos — only individual clips |
| 2 | **Animation interpolation** (`interpolate()`, `spring()`) | 🔴 High | 1-2 wks | No frame-level animation control from code |
| 3 | **Transition system** (fade/slide/wipe between clips) | 🟡 Medium | 1 wk | Videos look amateur without transitions |
| 4 | **Audio sync API** (`StudioPro.audio()`) | 🟡 Medium | 1 wk | No programmatic audio from code |
| 5 | **Design template system** (`.sptpl` format) | 🟢 Low | 1-2 wks | Reusable brand looks |
| 6 | **Agent skills** (documented workflows) | 🟢 Low | 1 wk | AI agents need instructions for common video types |
| 7 | **Preview server** (hot reload while editing) | 🟢 Low | 1-2 wks | Better DX for code-to-video workflow |
| 8 | **In-app AI panel** (BYO-key prompt → video) | 🟢 Low | 1-2 wks | The "wow" UX for non-technical users |

---

## 3. Folder Structure — Two Automation Tracks

### Track A: Markdown → Video (Existing, Stable)

```
automation/
├── README.md                    # How to use MD → Video
├── config.json                  # Default settings
├── render.js                    # Main render script (Puppeteer + MediaBunny)
├── batch.js                     # Batch render multiple scripts
├── package.json                 # Dependencies (puppeteer, mediabunny)
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
└── tests/                       # Test scripts
    └── test-export.js
```

**How it works:**
1. Write a Markdown file with headings, images, text
2. Run `node render.js scripts/product-launch.md`
3. Puppeteer opens Chrome, loads StudioPro, compiles MD → clips
4. MediaBunny exports to MP4/WebM at 4× realtime (FTRT)

### Track B: Code → Video (New, API-Driven)

```
automation/code-to-video/
├── README.md                    # How to use Code → Video API
├── api.js                       # StudioPro API wrapper for Node.js
├── templates/                   # Reusable HTML/CSS/JS clip templates
│   ├── gradient-card.html
│   ├── glassmorphism.html
│   ├── animated-text.html
│   ├── product-showcase.html
│   ├── data-chart.html
│   └── premium-gradient.html
│
├── examples/                    # Example compositions
│   ├── product-launch.js        # Full video: composition API + clips
│   ├── social-reel.js           # Short-form content
│   ├── explainer.js             # Tutorial/explainer video
│   └── kinetic-text.js          # Text-heavy animations
│
├── skills/                      # AI agent skill docs
│   ├── AGENTS.md                # Agent contract
│   ├── product-launch-video.md  # Skill: marketing video workflow
│   ├── faceless-explainer.md    # Skill: text-to-video
│   ├── social-clips.md          # Skill: short-form content
│   └── motion-graphics.md       # Skill: kinetic type, data viz
│
└── output/                      # Rendered videos (gitignored)
```

**How it works:**
1. AI agent writes a JS file using `StudioPro.createComposition()` API
2. Run `node automation/code-to-video/render.js examples/product-launch.js`
3. Puppeteer opens Chrome, loads StudioPro, executes the composition
4. MediaBunny exports to MP4 at FTRT speed

---

## 4. The Code → Video API Design

### Current API (Already Built)

```javascript
// Load fonts
StudioPro.fonts.loadGoogle('Poppins');
StudioPro.fonts.loadGoogleBatch(['Inter', 'Roboto']);

// Create an HTML clip
StudioPro.createHtmlClip(
  '<div class="card"><h1>Hello</h1></div>',
  '.card { background: linear-gradient(135deg, #667eea, #764ba2); }',
  '',
  { fonts: ['Poppins'], start: 0, duration: 5 }
);

// Get project info
StudioPro.project(); // { width: 1920, height: 1080, fps: 30, duration: 60 }
```

### Needed API (Next Phase)

```javascript
// Create a full composition (like Remotion's <Composition>)
StudioPro.createComposition({
  id: 'product-launch',
  duration: 15,        // seconds
  fps: 30,
  width: 1920,
  height: 1080,
  backgroundColor: '#0b0b0f',
  clips: [
    { type: 'html', html: gradientCard, css: gradientCSS, start: 0, duration: 5 },
    { type: 'text', text: 'Introducing ProductX', start: 2, duration: 5,
      effects: { fontFamily: 'Poppins', fontSize: 72, fillColor: '#ffffff',
                 animIn: 'fadeIn', animInDur: 1.0 } },
    { type: 'image', src: 'logo.png', start: 7, duration: 3,
      effects: { opacity: 0, animIn: 'fade', animInDur: 1.5 } }
  ]
});

// Frame-level animation (like Remotion's interpolate())
StudioPro.interpolate(frame, [0, 30], { from: 0, to: 1, easing: 'easeOut' });

// Spring physics (like Remotion's spring())
StudioPro.spring(frame, { from: 0, to: 1, damping: 10, mass: 0.5 });

// Programmatic audio
StudioPro.audio({
  src: 'music.mp3',
  start: 0,
  duration: 15,
  volume: 0.8,
  fadeIn: 1.0,
  fadeOut: 2.0
});

// Transitions between clips
StudioPro.transition({
  type: 'fade',       // fade, slide, wipe, zoom
  duration: 0.5,
  between: [clipA, clipB]
});
```

---

## 5. Markdown → Video vs Code → Video — Comparison

| Aspect | Markdown → Video | Code → Video |
|---|---|---|
| **Authoring** | Write plain Markdown | Write JavaScript/HTML/CSS |
| **Learning curve** | Very low (anyone can write MD) | Medium (need JS knowledge) |
| **Flexibility** | Limited to MD structure | Unlimited (full HTML/CSS/JS) |
| **AI agent fit** | Good (LLMs write Markdown well) | Better (LLMs write code better) |
| **Complex animations** | Not possible (static slides) | Full CSS animations + JS |
| **Use cases** | Explainers, social posts, tutorials | Product launches, motion graphics, data viz |
| **Speed** | Fast (simple MD → clips) | Fast (API → clips) |
| **Export speed** | 4× realtime (FTRT) | 4× realtime (FTRT) |
| **Current status** | ✅ Fully working | ✅ Basic HTML clips working, API partially built |
| **Next step** | Polish + more templates | Composition API + animation system |

---

## 6. Implementation Roadmap — What to Build Next

### Phase 7: Composition API (1-2 weeks)

**Goal:** AI agents can write entire videos programmatically.

```javascript
// This is the "Remotion moment" for StudioPro
StudioPro.createComposition({
  id: 'my-video',
  duration: 15,
  clips: [
    { type: 'html', html: '...', css: '...', start: 0, duration: 5 },
    { type: 'text', text: 'Hello', start: 2, duration: 3, effects: { animIn: 'fadeIn' } }
  ]
});
```

**Files to change:**
- `index.html` — Add `createComposition()` to `window.StudioPro`
- `automation/code-to-video/api.js` — Node.js wrapper
- `automation/code-to-video/render.js` — CLI entry point

### Phase 8: Animation System (1-2 weeks)

**Goal:** Frame-level animation control from code.

```javascript
StudioPro.interpolate(frame, [0, 30], { from: 0, to: 1, easing: 'easeOut' });
StudioPro.spring(frame, { from: 0, to: 1, damping: 10 });
```

**Files to change:**
- `index.html` — Add `interpolate()`, `spring()`, `keyframes()` to API

### Phase 9: Audio + Transitions (1 week)

**Goal:** Complete video production from code.

```javascript
StudioPro.audio({ src: 'music.mp3', volume: 0.8 });
StudioPro.transition({ type: 'fade', duration: 0.5 });
```

### Phase 10: Agent Skills + Templates (1 week)

**Goal:** Documented workflows for AI agents.

```
automation/code-to-video/skills/
├── AGENTS.md
├── product-launch-video.md
├── faceless-explainer.md
├── social-clips.md
└── motion-graphics.md
```

---

## 7. Decision: Should We Add More API?

**Yes, but incrementally.**

The current API (`StudioPro.fonts.*`, `StudioPro.createHtmlClip()`) is good for creating individual clips. What's missing is the **composition-level API** that lets agents write entire videos in one call.

**Recommended approach:**
1. **Don't rewrite** — extend `window.StudioPro` with new methods
2. **Keep backward compatibility** — existing `createHtmlClip()` still works
3. **Add composition API** — `createComposition()` is the main new feature
4. **Add animation API** — `interpolate()`, `spring()` for frame-level control
5. **Document everything** — both in README and in `skills/AGENTS.md`

---

## 8. Summary

| Category | Status | What's Next |
|---|---|---|
| **MD → Video** | ✅ Fully working | Polish, more templates |
| **Code → Video** | ✅ Basic HTML clips | Composition API, animation system |
| **StudioPro API** | ✅ Fonts + createHtmlClip | createComposition, interpolate, spring |
| **Automation** | ✅ render.js + batch.js | code-to-video/render.js |
| **Agent Skills** | ❌ Not built | AGENTS.md + workflow docs |
| **Design Templates** | ❌ Not built | .sptpl format + gallery |

**The honest answer:** We've done M0-M6 of the original plan. The remaining work (M7-M8: Composition API, Animation System, Agent Skills, Preview Server) is the "code-to-video" track that makes StudioPro as powerful as Remotion for AI agents — but without React, without build steps, and with our unique advantages (visual editor, premium gradients, multiple export modes).
