# Remaining Features Analysis — What to Do Next

> **Date:** August 2026
> **Purpose:** Analyze remaining features and recommend priority order
> **Key Insight:** HTML/CSS/JS clips are the game changer — do this first

---

## 1. M0-M5 Status: ALL COMPLETE ✅

| Phase | What | Status | Evidence |
|---|---|---|---|
| **M0** | Determinism | ✅ Done | `quantizeTimeToFrame`, seeded shake, parity harness |
| **M1** | FTRT Export | ✅ Done | `startFTRTExport`, video frame pool, GPU crash fixes |
| **M2** | Templates | ✅ Done | `DEFAULT_DESIGN_TEMPLATES`, gallery UI, editor, script skeletons |
| **M3** | .spcomp | ✅ Done | `exportSpcomp`, `importSpcomp`, round-trip safe |
| **M4** | Agent Loop | ✅ Done | `markdownToSpcomp`, `spcompToMarkdown`, AGENTS.md |
| **M5** | AI Panel | ✅ Done | `openAIPanel`, BYO-key, prompt → Markdown → timeline |

---

## 2. Remaining Features in Simple Terms

### 1. Push + Tag v0.3.0-beta
**What:** Save all our work to GitHub with a version number
**Why:** So users can download the latest version
**Priority:** Do this NOW

---

### 2. M6: Parallel + Headless Render
**What:** Render videos using multiple CPU cores (faster) and from command line (no browser needed)
**Why for automation:** So agents can render videos from terminal, CI/CD, or servers
**Simple example:** `studio-pro render video.spcomp` → MP4 file

---

### 3. Video Tab Consolidation
**What:** Merge the "Video" tab and "MediaBunny" tab into one clean tab
**Why:** Less confusion for users
**Priority:** Low — nice to have

---

### 4. Image Animation Quality
**What:** Fix blurry/pixelated fade animations for images
**Why:** Images look bad during fade-in/fade-out at lower bitrates
**Simple example:** Fade-in animation on a photo should be smooth, not blocky

---

### 5. Audio in captureStream Export
**What:** Add sound to the "Standard" export mode
**Why:** Currently Standard mode exports video-only (no audio)
**Simple example:** User adds music → Standard export should include it

---

### 6. .spcomp Standalone Player
**What:** A simple webpage that plays .spcomp files without the full editor
**Why for automation:** Agents can share .spcomp files that anyone can play
**Simple example:** Send a .spcomp file → friend opens in browser → sees the video

---

### 7. Export Quality Presets
**What:** Pre-made settings for common use cases (YouTube, Instagram, TikTok)
**Why:** Users don't know what bitrate/resolution to choose
**Simple example:** Click "YouTube" → perfect settings automatically

---

### 8. Project Versioning
**What:** Version numbers for .spcomp files (v1, v2, etc.)
**Why:** So old files still work when we update the format
**Priority:** Low — only matters if format changes a lot

---

### 9. Testing + Documentation
**What:** Write tests and user guides
**Why:** Quality assurance and user adoption
**Priority:** Medium — needed for production

---

## 3. Should We Do HTML/CSS/JS First?

### YES — Here's Why

**The remaining features are "nice to have" improvements.**
**HTML/CSS/JS is a "game changer" for automation.**

| Feature | Impact | Effort | Do First? |
|---|---|---|---|
| HTML/CSS/JS clips | 🔥 **Huge** — agents can write beautiful visuals | 2-3 weeks | ✅ **YES** |
| Push + tag | 📦 Important — ship what we have | 5 minutes | ✅ YES (now) |
| M6 parallel render | ⚡ Nice — faster exports | 2-4 weeks | ⏳ Later |
| Image animation quality | 🎨 Nice — smoother animations | 1-2 weeks | ⏳ Later |
| Audio in Standard | 🔊 Nice — complete export | 1 week | ⏳ Later |
| .spcomp player | 📱 Nice — shareable videos | 1 week | ⏳ Later |
| Quality presets | 🎯 Nice — easier UX | 1 week | ⏳ Later |

---

## 4. Why HTML/CSS/JS Should Be First

### 1. It Unlocks AI Agent Power

**Today:** Agents write Markdown → simple text clips
**With HTML:** Agents write HTML/CSS → beautiful gradient cards, glassmorphism, complex layouts

```markdown
# Today (Markdown)
# Product Launch
Welcome to the future

<!-- Agent can only make text -->
```

```html
# With HTML/CSS
<div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 40px; border-radius: 20px;">
  <h1 style="color: white; font-size: 48px;">Product Launch</h1>
  <p style="color: rgba(255,255,255,0.8);">The future of productivity</p>
</div>

<!-- Agent can now make beautiful visuals -->
```

---

### 2. It Matches What Users Expect

Users see Remotion videos with:
- Gradient backgrounds ✅
- Glassmorphism effects ✅
- Complex layouts ✅

Studio Pro can only do:
- Solid color backgrounds ⚠️
- Simple shapes ⚠️
- Basic text ⚠️

**HTML/CSS/JS closes this gap.**

---

### 3. It's the "Remotion Moment"

Remotion's success came from letting agents write React components.
Studio Pro's success will come from letting agents write HTML/CSS.

**The formula:**
```
Remotion = React components → video
Studio Pro = HTML/CSS/JS clips → video
```

---

### 4. The Other Features Can Wait

| Feature | Why It Can Wait |
|---|---|
| M6 parallel render | Current FTRT is already 4× realtime — fast enough |
| Image animation quality | Can fix later without breaking changes |
| Audio in Standard | MediaBunny tab already has audio |
| .spcomp player | Nice, not essential for automation |
| Quality presets | Users can set manually for now |

---

## 5. Comparison: Current vs With HTML/CSS/JS

| Aspect | Current (Canvas Only) | With HTML/CSS/JS |
|---|---|---|
| **AI agent authoring** | Markdown only | Markdown + HTML/CSS/JS |
| **Complex visuals** | Limited by Canvas API | Full CSS capabilities |
| **Gradient cards** | Manual drawing | CSS `linear-gradient` |
| **Glassmorphism** | Not possible | CSS `backdrop-filter` |
| **Text wrapping** | Manual | CSS automatic |
| **3D effects** | Not possible | CSS 3D transforms |
| **Performance** | 4× realtime | 2× realtime (estimated) |
| **Determinism** | Perfect | Near-perfect |

---

## 6. The Recommendation

### Do This Order:

1. **Push + tag v0.3.0-beta** (5 minutes) — ship what we have
2. **HTML/CSS/JS clips** (2-3 weeks) — the game changer
3. **Then** do the remaining features as needed

### Why This Order?

- Push now → users get M0-M5 improvements
- HTML/CSS/JS next → agents can create beautiful videos
- Remaining features → polish and refine later

---

## 7. The Bottom Line

**HTML/CSS/JS is the feature that makes Studio Pro competitive with Remotion.**
**The other features are improvements, but HTML/CSS/JS is a transformation.**

### What Remotion Proved
> "Code-first video works. Agents can generate video if they write code."

### What Studio Pro Will Prove
> "HTML/CSS-first video works. Agents are excellent at HTML. The GUI is the editor. Canvas is the renderer. The best of all worlds."

---

## Appendix: Feature Priority Matrix

| Priority | Feature | Impact | Effort | Timeline |
|---|---|---|---|---|
| **P0** | Push + tag v0.3.0-beta | 📦 Ship | 5 min | Now |
| **P1** | HTML/CSS/JS clips | 🔥 Game changer | 2-3 weeks | Week 1-3 |
| **P2** | Image animation quality | 🎨 Polish | 1-2 weeks | Week 4-5 |
| **P3** | Audio in Standard | 🔊 Complete | 1 week | Week 6 |
| **P4** | .spcomp player | 📱 Shareable | 1 week | Week 7 |
| **P5** | Quality presets | 🎯 Easy UX | 1 week | Week 8 |
| **P6** | M6 parallel render | ⚡ Faster | 2-4 weeks | Week 9-12 |
| **P7** | Video tab consolidation | 🧹 Clean UI | 1-2 days | Anytime |
| **P8** | Project versioning | 🔢 Forward-compat | 2-3 days | Anytime |
| **P9** | Testing + docs | 📚 Quality | 1-2 weeks | Ongoing |
