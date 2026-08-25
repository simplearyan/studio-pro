# HyperFrames Analysis — What StudioPro Can Learn & Add

## What is HyperFrames?

HyperFrames is an open-source framework by HeyGen that turns HTML, CSS, and animations into deterministic MP4 videos. It's built for AI agents — agents write HTML, HyperFrames renders video.

**Key difference from StudioPro:** HyperFrames is a CLI tool (no real-time editor). StudioPro is a full video editor with timeline, drag/resize, and live canvas preview.

---

## HyperFrames Features We Don't Have

### 1. Agent Skills System (20 Specialized Skills)

HyperFrames ships 20 skills that teach AI agents how to create different types of video:

| Skill | What It Does | StudioPro Equivalent |
|---|---|---|
| `/product-launch-video` | Website → marketing video | ❌ We don't have |
| `/faceless-explainer` | Text → explainer video | ❌ We don't have |
| `/pr-to-video` | GitHub PR → changelog video | ❌ We don't have |
| `/embedded-captions` | Add captions to talking head | ✅ We have captions |
| `/talking-head-recut` | Package interview with overlays | ❌ We don't have |
| `/motion-graphics` | Short kinetic type / logo sting | ❌ We don't have |
| `/music-to-video` | Beat-synced video from audio | ❌ We don't have |
| `/slideshow` | Presentation / pitch deck | ❌ We don't have |
| `/remotion-to-hyperframes` | Port Remotion → HTML | ❌ Not applicable |
| `/figma` | Import Figma assets | ❌ We don't have |

**What we should add:** Create our own skill system for StudioPro. Agents already write HTML clips — we just need to teach them the patterns.

### 2. frame.md — Design System for Video

HyperFrames has `frame.md` — a design specification that translates brand guidelines into video-ready parameters:

```markdown
# frame.md
Brand: Acme Corp
Primary Color: #6366f1
Font: Inter
Transition: fade-through-black
Pacing: 3 seconds per scene
```

The agent reads `frame.md` and generates all clips consistently.

**What we should add:** A `project.md` or `style.md` file that defines brand colors, fonts, pacing, and animation style. Agents read this before generating clips.

### 3. Catalog — Reusable Blocks & Components

HyperFrames has a catalog of pre-built components:

```bash
npx hyperframes add flash-through-white    # shader transition
npx hyperframes add instagram-follow       # social overlay
npx hyperframes add data-chart             # animated chart
```

These are reusable HTML blocks that agents can import.

**What we should add:** A template library in StudioPro. We already have presets (Gradient, Glass, etc.) — expand this into a full catalog with:
- Transitions (fade, wipe, slide)
- Lower thirds
- Title cards
- Chart templates
- Social media overlays
- Progress bars
- Counter animations

### 4. Community Playground — Publish, Share, Remix

HyperFrames has `hyperframes.dev` — a community site where users can:
- Publish projects to a URL
- Share editable links
- Remix other people's projects
- Download project ZIPs
- Browse showcase

**What we should add:** A project sharing system. Users could:
- Export project as shareable link
- Browse community templates
- Fork/clone projects
- Publish to a gallery

### 5. AWS Lambda Rendering — Distributed Export

HyperFrames can render on AWS Lambda — distributed rendering for large projects.

**What we should add:** Cloud rendering option. Currently export runs in-browser. For long videos, we could:
- Send render job to cloud
- User continues editing while render runs
- Download when complete

### 6. Multiple Animation Runtimes

HyperFrames supports: GSAP, CSS animations, Lottie, Three.js, Anime.js, WAAPI, custom adapters.

**What we should add:** Support for more animation libraries. Currently we only support custom `animate(t)`. Adding WAAPI + GSAP support would make clips more powerful.

### 7. Shader Transitions

HyperFrames has WebGL shader transitions (flash-through-white, cross-dissolve, etc.).

**What we should add:** GPU-accelerated transitions between clips. We have basic fade — add:
- Wipe
- Slide
- Zoom
- Blur
- Glitch
- Particle effects

### 8. Audio Engine

HyperFrames has a full audio engine with:
- Voiceover carve (dip music when voice speaks)
- Effect chain (EQ, compressor, limiter, etc.)
- Automation envelopes
- Submix buses

**What we should add:** We have basic audio. Enhance with:
- Auto-ducking (music dips when voice speaks)
- Audio effects (reverb, echo, etc.)
- Beat-synced animations

### 9. Deterministic Rendering

HyperFrames guarantees: same input = same output. Built for CI/CD and regression tests.

**What we should add:** Our export should be deterministic. Currently html2canvas can produce slightly different results. Moving to SVG foreignObject or WAAPI would improve determinism.

### 10. No Build Step

HyperFrames compositions are plain `index.html` — no bundler needed.

**What we should add:** Our HTML clips are already plain HTML. ✅ We already have this.

---

## What We Have That HyperFrames Doesn't

| StudioPro Feature | HyperFrames | Our Advantage |
|---|---|---|
| **Real-time canvas editor** | CLI only | ✅ Drag, resize, timeline |
| **Live preview** | Browser preview (separate) | ✅ Canvas updates instantly |
| **Timeline with tracks** | Data attributes only | ✅ Visual timeline |
| **Multiple clip types** | HTML only | ✅ Text, Image, Video, Shape |
| **Properties panel** | Code editing only | ✅ GUI controls |
| **Animation presets** | Agent writes all animation | ✅ One-click presets |
| **Audio mixing** | Basic | ✅ Full audio pipeline |
| **Caption system** | Separate skill | ✅ Built-in |
| **Export options** | FFmpeg only | ✅ MediaBunny + FTRT |
| **Undo/Redo** | Git-based | ✅ Instant undo |
| **Keyboard shortcuts** | CLI commands | ✅ Full shortcut system |

---

## Future Additions for StudioPro (Prioritized)

### Priority 1: Agent Skill System (2-3 weeks)

Create a skill system similar to HyperFrames but for our editor:

```
studio-pro-editor/
├── skills/
│   ├── SKILL.md                    # Router — tells agent which skill to use
│   ├── product-video.md            # How to create product launch videos
│   ├── explainer.md                # How to create explainer videos
│   ├── motion-graphics.md          # How to create kinetic type / logo stings
│   ├── social-media.md             # How to create social clips
│   ├── data-viz.md                 # How to create chart animations
│   └── templates/
│       ├── title-card.html         # Reusable title card template
│       ├── lower-third.html        # Lower third overlay
│       ├── chart-template.html     # Animated chart
│       └── counter.html            # Animated counter
```

**What each skill contains:**
- When to use this skill
- HTML/CSS patterns for this video type
- Animation presets to use
- Timing guidelines
- Example compositions

### Priority 2: Project Style System (1 week)

Add `project.md` support — agents read this before generating clips:

```markdown
# project.md
Brand: India Pollution Report
Colors: #0f172a (bg), #6366f1 (accent), #94a3b8 (text)
Font: Inter
Pacing: 5 seconds per scene
Animation: fade-in + slide-up
Transition: fade-through-black
```

**Integration:** When agent loads a project, it reads `project.md` and generates consistent clips.

### Priority 3: Template Catalog (1-2 weeks)

Expand our preset system into a full catalog:

```
catalog/
├── transitions/
│   ├── fade.html
│   ├── wipe.html
│   ├── slide.html
│   └── zoom.html
├── overlays/
│   ├── lower-third.html
│   ├── title-card.html
│   ├── progress-bar.html
│   └── social-media.html
├── charts/
│   ├── bar-chart.html
│   ├── line-chart.html
│   ├── pie-chart.html
│   └── counter.html
└── effects/
    ├── glow.html
    ├── blur.html
    └── particle.html
```

**Integration:** Agent runs `studio-pro add bar-chart` and gets a pre-built animated chart clip.

### Priority 4: Community Sharing (2-3 weeks)

Build a project sharing system:

```
Features:
- Export project as .studio-pro.zip
- Upload to community gallery
- Browse & fork projects
- Generate shareable link
- Import community templates
```

### Priority 5: WAAPI + GSAP Animation Support (1-2 weeks)

Add support for standard animation libraries:

```html
<!-- Agent can now use WAAPI -->
<style>
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
.title { animation: fadeIn 0.5s forwards }
</style>

<!-- Or GSAP (if loaded) -->
<script src="gsap.min.js"></script>
<script>
gsap.from("#title", { opacity: 0, y: 40, duration: 0.8 });
</script>
```

### Priority 6: Shader Transitions (2-3 weeks)

Add GPU-accelerated transitions between clips:

```javascript
// WebGL shader transitions
const transitions = {
    'fade': fragmentShaderFade,
    'wipe': fragmentShaderWipe,
    'slide': fragmentShaderSlide,
    'zoom': fragmentShaderZoom,
    'glitch': fragmentShaderGlitch,
};
```

### Priority 7: Cloud Rendering (3-4 weeks)

Add cloud rendering option for large projects:

```
User clicks Export →
 选择 "Cloud Render" →
 Render job sent to server →
 User continues editing →
 Download when complete
```

---

## Comparison Summary

| Aspect | HyperFrames | StudioPro | Our Gap |
|---|---|---|---|
| **Authoring** | CLI + HTML | GUI Editor + HTML | We're ahead |
| **Preview** | Browser preview | Live canvas | We're ahead |
| **Animation** | GSAP/WAAPI/Lottie | animate(t) only | We need WAAPI |
| **Agent skills** | 20 specialized skills | None | We need skills |
| **Templates** | Catalog with 100+ blocks | 10 presets | We need catalog |
| **Community** | Publish/Share/Remix | None | We need sharing |
| **Rendering** | Headless Chrome + FFmpeg | WebCodecs/Mediabunny | We're ahead (browser-native) |
| **Design system** | frame.md | None | We need project.md |
| **Transitions** | WebGL shaders | Basic fade | We need shaders |
| **Audio** | Full engine with effects | Basic mixing | We need effects |
| **Determinism** | Guaranteed | Depends on html2canvas | We need WAAPI |

---

## Key Takeaway

HyperFrames is a **CLI tool for AI agents**. StudioPro is a **full video editor for humans + AI**. We should adopt HyperFrames' **agent ergonomics** (skills, templates, frame.md) while keeping our **editor advantages** (timeline, drag/resize, live preview).

**The winning combination:**
```
StudioPro Editor (GUI) + HyperFrames Agent Skills (AI) = Best of both worlds
```
