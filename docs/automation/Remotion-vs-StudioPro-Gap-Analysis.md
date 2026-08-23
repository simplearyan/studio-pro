# Remotion + HyperFrames vs StudioPro — Combined Gap Analysis

> **Date:** August 2026 (Updated)
> **Status:** M0-M6 DONE. M7-M8 REMAINING.
> **See also:** [Current-Status-and-Roadmap.md](./Current-Status-and-Roadmap.md)

---

## Executive Summary

**StudioPro has closed most of the gap with Remotion and HyperFrames.** We've built:
- Deterministic core (seeded PRNG, time quantization)
- FTRT export (4× realtime via MediaBunny)
- Composition format (.spcomp export/import)
- Markdown → video pipeline
- HTML/CSS/JS clip system (like Remotion's React components, but without React)
- StudioPro API for AI agents (fonts, clip creation)

**What's remaining is the composition-level API** that lets agents write entire videos in one call — the "Remotion moment."

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
| **StudioPro API** | ✅ fonts, createHtmlClip | ❌ No API | ❌ No API |
| **No Accounts Required** | ✅ 100% browser | ❌ Lambda needs AWS | ❌ Lambda needs AWS |

---

## What We're Missing (The Real Gaps)

| # | Gap | Priority | Effort | Source |
|---|---|---|---|---|
| 1 | **Composition API** (`createComposition()`) | 🔴 High | 1-2 wks | Remotion |
| 2 | **Animation Interpolation** (`interpolate()`, `spring()`) | 🔴 High | 1-2 wks | Remotion |
| 3 | **Transitions** (fade/slide/wipe) | 🟡 Medium | 1 wk | Remotion |
| 4 | **Audio API** (`StudioPro.audio()`) | 🟡 Medium | 1 wk | Remotion |
| 5 | **Design Templates** (`.sptpl` format) | 🟢 Low | 1-2 wks | HyperFrames |
| 6 | **Agent Skills** (documented workflows) | 🟢 Low | 1 wk | HyperFrames |
| 7 | **Preview Server** (hot reload) | 🟢 Low | 1-2 wks | Remotion Studio |
| 8 | **In-App AI Panel** | 🟢 Low | 1-2 wks | Remotion Studio |

---

## The Composition API — What It Looks Like

```javascript
// This is what Remotion has that we need
StudioPro.createComposition({
  id: 'product-launch',
  duration: 15,      // seconds
  fps: 30,
  width: 1920,
  height: 1080,
  backgroundColor: '#0b0b0f',
  clips: [
    { type: 'html', html: gradientCardHTML, css: gradientCSS, start: 0, duration: 5 },
    { type: 'text', text: 'Introducing ProductX', start: 2, duration: 5,
      effects: { fontFamily: 'Poppins', fontSize: 72, fillColor: '#ffffff',
                 animIn: 'fadeIn', animInDur: 1.0 } },
    { type: 'image', src: 'logo.png', start: 7, duration: 3,
      effects: { opacity: 0, animIn: 'fade', animInDur: 1.5 } },
    { type: 'audio', src: 'music.mp3', start: 0, duration: 15, volume: 0.8 }
  ]
});
```

---

## The Animation System — What It Looks Like

```javascript
// Frame-level precision (like Remotion's interpolate())
StudioPro.interpolate(frame, [0, 30], { from: 0, to: 1, easing: 'easeOut' });

// Physics-based animation (like Remotion's spring())
StudioPro.spring(frame, { from: 0, to: 1, damping: 10, mass: 0.5 });

// Per-property keyframe animation
StudioPro.keyframes(clip, {
  opacity: [{ frame: 0, value: 0 }, { frame: 30, value: 1 }],
  scale: [{ frame: 0, value: 0.5 }, { frame: 30, value: 1.0 }]
});
```

---

## Full AI Workflow — What We Can Do Now

```bash
# 1. User gives prompt to AI
> "Create a 15-second product launch video"

# 2. AI writes composition (AFTER M7)
StudioPro.createComposition({
  id: 'product-launch',
  duration: 15,
  clips: [
    { type: 'html', html: gradientCard, css: gradientCSS, start: 0, duration: 5 },
    { type: 'text', text: 'ProductX', start: 2, duration: 5 }
  ]
});

# 3. Export video (ALREADY WORKS)
node automation/render.js scripts/product-launch.md -q ultra -f ftrt-mp4

# Output: product-launch_ultra_30Mbps_30fps_FTRT-H264_1080p.mp4
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
| **M7 — Composition API** | createComposition(), clip builders | 1-2 wks | 🔴 NEXT |
| **M8 — Animation System** | interpolate(), spring(), keyframes() | 1-2 wks | 🔴 NEXT |
| **M9 — Audio + Transitions** | StudioPro.audio(), StudioPro.transition() | 1 wk | 🟡 PLANNED |
| **M10 — Agent Skills** | AGENTS.md, workflow docs | 1 wk | 🟡 PLANNED |
| **M11 — Preview Server** | Hot reload, live preview | 1-2 wks | 🟢 PLANNED |
| **M12 — In-App AI Panel** | BYO-key prompt → video | 1-2 wks | 🟢 PLANNED |

---

## What "Done" Looks Like

A user (or AI agent) can:
1. Build a timeline in the GUI — or write Markdown — or write code
2. Hit **Export** and get a deterministic MP4 **4× faster than real-time**
3. Use `StudioPro.createComposition()` to write entire videos programmatically
4. Use `StudioPro.interpolate()` / `StudioPro.spring()` for frame-level animation
5. Export with FTRT speed, quality presets, batch rendering

**That is the Remotion experience — but without React, without build steps, with a visual editor, and with our unique advantages (premium gradients, multiple export modes, no accounts).**
