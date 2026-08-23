# Remotion + HyperFrames vs StudioPro — Combined Gap Analysis

> **Date:** August 2026 (Updated)
> **Status:** M0-M9 DONE. Remaining: transitions, more templates/skills, preview server, AI panel.
> **See also:** [Current-Status-and-Roadmap.md](./Current-Status-and-Roadmap.md)

---

## Executive Summary

**StudioPro has closed most of the gap with Remotion and HyperFrames.** We've built:
- Deterministic core (seeded PRNG, time quantization)
- FTRT export (4× realtime via MediaBunny)
- Composition format (.spcomp export/import)
- Markdown → video pipeline
- HTML/CSS/JS clip system (like Remotion's React components, but without React)
- StudioPro API for AI agents (fonts, clip creation, composition, animation)
- Code-to-video automation folder with API wrapper, CLI, examples, skills, and templates

**What's remaining is transitions and polish** — the visual quality improvements that make videos look professional.

---

## What We Already Have (Better Than Both)

| Feature | StudioPro | Remotion | HyperFrames |
|---|---|---|---|
| **Visual GUI Editor** | ✅ Canvas + drag/drop + timeline | ❌ Code-only (Theater.js extra) | ❌ iframe preview only |
| **Owns Rasterizer** | ✅ Canvas 2D — no Chrome fight | ❌ Chrome compositor | ❌ Chrome compositor |
| **Markdown → Video** | ✅ Write scripts in MD | ❌ Not supported | ❌ Not supported |
| **Multiple Export Modes** | ✅ FTRT (4×), MediaBunny, Standard | ⚠️ Single mode | ⚠️ Single mode |
| **Quality Presets** | ✅ Draft/Ultra with bitrate caps | ❌ Manual config | ❌ Manual config |
| **Batch Rendering** | ✅ `batch.js` | ❌ Manual scripting | ❌ Manual scripting |
| **Premium Gradients** | ✅ Wisteria, Aurora, Mesh, etc. | ❌ Must code | ❌ Must code |
| **Font System** | ✅ Google + System fonts auto-inject | ⚠️ Manual setup | ⚠️ `@fontsource` |
| **Scene System** | ✅ Pre-compositions | ✅ `<Sequence>` nesting | ✅ Nested compositions |
| **Audio Graph** | ✅ Web Audio: ducking, fades | ⚠️ Basic | ⚠️ Basic volume/pan |
| **Keyframe Editor** | ✅ Visual keyframe editor | ❌ Code-only | ❌ Code-only |
| **HTML/CSS/JS Clips** | ✅ Built-in (html2canvas) | ✅ React components | ✅ Plain HTML |
| **StudioPro API** | ✅ fonts, createHtmlClip, createComposition, interpolate, spring, keyframes | ❌ No API | ❌ No API |
| **Code-to-Video Automation** | ✅ API wrapper, CLI, examples, skills, templates | ❌ Manual scripting | ❌ Manual scripting |
| **Agent Skills** | ✅ AGENTS.md + skill docs | ⚠️ Community | ✅ 19 built-in |
| **Design Tokens** | ✅ frame.md-style tokens | ❌ Manual | ✅ `frame.md` |
| **No Accounts Required** | ✅ 100% browser | ❌ Lambda needs AWS | ❌ Lambda needs AWS |

---

## What We're Missing (The Real Gaps)

| # | Gap | Priority | Effort | Source |
|---|---|---|---|---|
| 1 | **Transitions** (fade/slide/wipe between clips) | 🔴 High | 1-2 days | Remotion |
| 2 | **More templates** (countdown, testimonial, stats) | 🟡 Medium | 1 day | HyperFrames |
| 3 | **More skills** (explainer, data-viz, testimonial) | 🟡 Medium | 1 day | HyperFrames |
| 4 | **Preview Server** (hot reload while editing) | 🟢 Low | 1-2 days | Remotion Studio |
| 5 | **In-App AI Panel** (BYO-key prompt → video) | 🟢 Low | 1-2 days | Remotion Studio |

---

## The Composition API — What We Built

```javascript
// This is what Remotion has that we now have
StudioPro.createComposition({
  id: 'product-launch',
  duration: 15,
  clips: [
    StudioPro.html('<div class="card">Hello</div>', '.card { ... }', '', { start: 0, duration: 5 }),
    StudioPro.text('ProductX', { start: 2, duration: 5 }),
    StudioPro.audio('music.mp3', { start: 0, duration: 15, volume: 0.8 })
  ]
});

// With animation system
StudioPro.keyframes(clip, {
  opacity: [{ frame: 0, value: 0 }, { frame: 30, value: 100 }],
  scale: [{ frame: 0, value: 0.5 }, { frame: 30, value: 1.0 }]
});
```

---

## The Animation System — Why It Works

| Property | CSS Animation | Frame-Based Animation |
|---|---|---|
| **Control** | Time-based (1s, 2s) | Frame-based (frame 0-30) |
| **Seekability** | ❌ Can't seek to middle | ✅ Jump to any frame |
| **Determinism** | ❌ Browser variance | ✅ Same input = same output |
| **Preview=Export** | ❌ Different rendering | ✅ Identical pixels |
| **Export speed** | ❌ Must play at 1× | ✅ Can skip frames (FTRT) |
| **AI agent control** | ❌ Can't set "frame 15 = 50%" | ✅ `interpolate(15, [0,30], [0,1])` |

---

## Full AI Workflow — What We Can Do Now

```bash
# 1. User gives prompt to AI
> "Create a 15-second product launch video"

# 2. AI writes composition
StudioPro.createComposition({
  id: 'product-launch',
  duration: 15,
  clips: [
    StudioPro.html(gradientCard, gradientCSS, '', { start: 0, duration: 5 }),
    StudioPro.text('ProductX', { start: 2, duration: 5 }),
    StudioPro.audio('music.mp3', { start: 0, duration: 15, volume: 0.8 })
  ]
});

# 3. AI applies animations
StudioPro.keyframes(clip, {
  opacity: [{ frame: 0, value: 0 }, { frame: 30, value: 100 }]
});

# 4. Export video
node automation/code-to-video/render.js my-video.js

# Output: product-launch_ultra_30fps_ftrt_mp4.mp4
# Time: ~4 seconds for a 15-second video (4× realtime)
```

---

## Recommended Implementation Order

| Phase | Work | Effort | Status |
|---|---|---|---|
| **M0 — Deterministic Core** | Time quantization, seeded shake, parity check | Days | ✅ DONE |
| **M1 — FTRT Export** | Frame-index loop, seek-and-capture | 1-2 wks | ✅ DONE |
| **M2 — Composition Format** | .spcomp export/import | 1-2 wks | ✅ DONE |
| **M3 — Markdown → Video** | MD parser, CLI render | 1-2 wks | ✅ DONE |
| **M4 — HTML/CSS/JS Clips** | html2canvas, sidebar editor, modal editor | 2-3 wks | ✅ DONE |
| **M5 — StudioPro API** | fonts, createHtmlClip, project | 1 wk | ✅ DONE |
| **M6 — Automation Infra** | render.js, batch.js, config | 1 wk | ✅ DONE |
| **M7 — Composition API** | createComposition(), clip builders | 1-2 wks | ✅ DONE |
| **M8 — Animation System** | interpolate(), spring(), keyframes() | 1-2 wks | ✅ DONE |
| **M9 — Code-to-Video Automation** | API wrapper, CLI, examples, skills, templates | 1 wk | ✅ DONE |
| **M10 — Transitions** | fade/slide/wipe between clips | 1-2 days | 🔴 NEXT |
| **M11 — More Templates/Skills** | countdown, testimonial, stats, explainer, data-viz | 2 days | 🟡 PLANNED |
| **M12 — Preview Server** | Hot reload, live preview | 1-2 days | 🟢 PLANNED |
| **M13 — In-App AI Panel** | BYO-key prompt → video | 1-2 days | 🟢 PLANNED |

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
