# Code-to-Video — Issues & Development Tracker

> Track all known issues, missing features, and planned improvements for the agentic automation system.

---

## 🔴 Critical Issues

### -1. html2canvas Rendering Mismatches
- **Status:** Documented — see `skills/html2canvas-gotchas.md`
- **Impact:** Canvas export looks different from HTML editor preview
- **Root Cause:** html2canvas doesn't render HTML/CSS exactly like a browser
- **Known Issues:**
  1. Emojis render as colored squares → Use CSS badges
  2. Border-radius on buttons fails → Use overflow:hidden wrapper
  3. Flexbox centering breaks → Use text-align:center + margin:auto
  4. Google Fonts not loaded → Wait for document.fonts.ready
  5. Complex gradients fail → Use simple linear gradients
  6. Box shadows don't render → Use borders instead
  7. CSS variables fail → Use hardcoded values
  8. CSS animations/transforms fail → Use StudioPro animation system
- **Solution:** Documented in `skills/html2canvas-gotchas.md` and `templates/design-tokens.md`
- **Effort:** Documentation done, testing needed
- **Priority:** 🔴 CRITICAL

### 0. HTML Clip Preload Delay — Empty Frames Between Clips
- **Status:** Confirmed bug
- **Impact:** 1-second black/empty frame between each HTML clip in exported video
- **Root Cause:** HTML clips are rendered on-demand via `html2canvas`. When the export loop captures frame N, if the HTML clip at frame N hasn't been rendered yet, the canvas shows empty/black for ~1 second until `html2canvas` finishes processing.
- **Affected Files:**
  - `index.html` — `drawCanvas()` function (html2canvas rendering path)
  - `automation/code-to-video/api.js` — export loop timing
- **Evidence:**
  - Canvas preview: clips appear blank for ~1s after seeking, then render
  - Exported video: black frames between scene transitions
  - Console: `[HTMLClip] Render error` during rapid frame capture
- **Solution Plan:**
  1. **Pre-render all HTML clips before export starts**
     - In `drawCanvas()`, when a clip has `_htmlContainer` but no `_htmlCanvas`, render it immediately
     - Cache rendered canvases so they're ready when the export loop reaches that frame
  2. **Add `preRenderHtmlClips()` function**
     ```javascript
     async function preRenderHtmlClips() {
       for (const clip of State.clips) {
         if (clip.type === 'html' && !clip._htmlCanvas) {
           await renderHtmlClipToCanvas(clip);
         }
       }
     }
     ```
  3. **Call `preRenderHtmlClips()` before export starts**
     - In `startExport()`, add: `await preRenderHtmlClips();`
     - This ensures all HTML clips are rendered before frame capture begins
  4. **Add progress indicator during pre-render**
     - Show "Preparing HTML clips... 3/9" in the export modal
- **Effort:** 1-2 days
- **Priority:** 🔴 CRITICAL

### 1. No Transitions Between Clips
- **Status:** Plan ready — see `docs/automation/Transitions-Plan.md`
- **Impact:** Scenes cut abruptly — biggest visual quality issue
- **Details:** When multiple HTML clips are sequenced, there's no fade, slide, or wipe between them. Videos look amateur.
- **Source:** Transition system from Sequence Animator Pro v0.4 (12 transition types)
- **Solution:** 12 transition types (fade, projector, push-reveal, zoom-dissolve, paper-flip, calendar, sticky, flipbook, etc.) + GUI controls + API support
- **Effort:** 3-5 days (5 phases)
- **Priority:** 🔴 HIGH
- **Plan:** `docs/automation/Transitions-Plan.md`

### 2. No Image Loading from URLs
- **Status:** Not started
- **Impact:** Can't include real photos in presentations
- **Details:** HTML clips can't load images from external URLs due to CORS. `html2canvas` can't render cross-origin images.
- **Solution:** Proxy images through a local data URL or use `StudioPro.image()` clip type
- **Effort:** 1 day
- **Priority:** 🔴 HIGH

---

## 🟡 Medium Priority

### 3. No Background Audio
- **Status:** Not started
- **Impact:** No music, voiceover, or sound effects
- **Details:** `StudioPro.audio()` exists in API but not wired to export
- **Solution:** Add audio track mixing during export
- **Effort:** 1 day
- **Priority:** 🟡 MEDIUM

### 4. No Preview Mode
- **Status:** Not started
- **Impact:** Must export to see result — slow iteration
- **Details:** No way to preview a composition without full export. Agents must export every time.
- **Solution:** Add `--preview` flag that opens Chrome without exporting
- **Effort:** 2 days
- **Priority:** 🟡 MEDIUM

### 5. No Hot Reload / Watch Mode
- **Status:** Not started
- **Impact:** Must re-run CLI for every change
- **Details:** No `--watch` mode that re-renders on file change
- **Solution:** Add file watcher that triggers re-render
- **Effort:** 2 days
- **Priority:** 🟡 MEDIUM

### 6. No Native Text Clips
- **Status:** Not started
- **Impact:** Only HTML clips available, no simple text overlay
- **Details:** `StudioPro.text()` exists but doesn't create visible clips
- **Solution:** Wire text clips to canvas rendering
- **Effort:** 0.5 day
- **Priority:** 🟡 MEDIUM

---

## 🟢 Low Priority / Future

### 7. No Motion Paths
- **Status:** Not started
- **Impact:** Can't animate elements along a path
- **Solution:** Add `StudioPro.motionPath(clip, path)` API
- **Effort:** 2 days
- **Priority:** 🟢 LOW

### 8. No Composition Chaining
- **Status:** Not started
- **Impact:** Can't combine multiple compositions
- **Solution:** Add `StudioPro.merge([comp1, comp2])` API
- **Effort:** 1 day
- **Priority:** 🟢 LOW

### 9. No Error Recovery
- **Status:** Not started
- **Impact:** If one clip fails, entire export fails
- **Solution:** Add try-catch per clip, skip failed clips
- **Effort:** 1 day
- **Priority:** 🟢 LOW

### 10. No Progress Callback for Agents
- **Status:** Not started
- **Impact:** Agents can't monitor export progress
- **Solution:** Add WebSocket or file-based progress reporting
- **Effort:** 1 day
- **Priority:** 🟢 LOW

---

## ✅ Completed Features

| Feature | Status | Date |
|---|---|---|
| M0: Deterministic core | ✅ Done | — |
| M1: FTRT export (4× realtime) | ✅ Done | — |
| M2: Composition format (.spcomp) | ✅ Done | — |
| M3: Markdown → Video | ✅ Done | — |
| M4: HTML/CSS/JS clips | ✅ Done | — |
| M5: StudioPro API (fonts, createHtmlClip) | ✅ Done | — |
| M6: Automation infrastructure | ✅ Done | — |
| M7: Composition API (createComposition) | ✅ Done | 2024-08-23 |
| M8: Animation System (interpolate, spring, keyframes) | ✅ Done | 2024-08-23 |
| code-to-video/ folder structure | ✅ Done | 2024-08-23 |
| AGENTS.md + skill docs | ✅ Done | 2024-08-23 |
| Browser pooling + retry logic | ✅ Done | 2024-08-23 |
| India Pollution test (9 scenes) | ✅ Done | 2024-08-23 |
| Load Script card in Projects modal | ✅ Done | 2024-08-23 |
| ISSUES-AND-TODOS.md tracker | ✅ Done | 2024-08-23 |

---

## 📊 Test Results Summary

### India Pollution Presentation (2024-08-23)
- **Scenes:** 9 HTML clips × 5s = 45s video
- **Export time:** 13.9s (3.2× realtime)
- **Total time:** 23.7s
- **File size:** 1.26 MB MP4
- **Quality:** Ultra (30 Mbps)
- **Status:** ✅ Working — exported successfully

### Known Issues in Test
1. **Empty frames between clips** — HTML clips take ~1s to render, causing black frames
2. No transitions between scenes (abrupt cuts)
3. No images (can't load from URLs)
4. No audio track
5. Must export to see result (no preview)

---

## 🗺️ Development Roadmap

### Phase -1: HTML Clip Internal Animations (2-3 days)
- [ ] Pass `clipTime` to iframe before html2canvas capture
- [ ] Call `animate()` function if it exists in clip.js
- [ ] Force re-render on every frame when JS is present
- [ ] Add animation helpers (bar, counter, slideUp, fadeIn, scale)
- [ ] Update india-pollution.js with animated elements
- [ ] Document in `skills/html-animation-guide.md`
- **Plan:** `docs/automation/HTML-Clip-Internal-Animations-Plan.md`

### Phase 0: Fix HTML Clip Preload (1-2 days)
- [ ] Add `preRenderHtmlClips()` function to render all clips before export
- [ ] Call it in `startExport()` before frame capture loop
- [ ] Add progress indicator during pre-render
- [ ] Cache rendered canvases to avoid re-rendering
- [ ] Test: verify no empty frames in exported video

### Phase 1: Core Missing Features (1 week)
- [ ] Add transitions (fade/slide/wipe)
- [ ] Add image loading support
- [ ] Add background audio
- [ ] Add native text clips

### Phase 2: Developer Experience (1 week)
- [ ] Add preview mode
- [ ] Add hot reload / watch mode
- [ ] Add progress callbacks for agents
- [ ] Add error recovery per clip

### Phase 3: Advanced Features (2 weeks)
- [ ] Add motion paths
- [ ] Add composition chaining
- [ ] Add template system (.sptpl)
- [ ] Add in-app AI panel

---

## 📝 Notes

### Why CSS/JS Animations Aren't Enough for Video
| Problem | CSS Animation | Frame-Based Animation |
|---|---|---|
| No frame control | Time-based (1s, 2s) | Frame-based (frame 0-30) |
| Can't seek | ❌ Can't jump to middle | ✅ Jump to any frame |
| Not deterministic | Browser variance | Same input = same output |
| Export speed | Must play at 1× | Can skip frames (FTRT) |
| Preview ≠ Export | Different rendering | Identical pixels |

**Solution:** Frame system controls *timing*, CSS/JS controls *rendering*.

### Agent Workflow
```
1. Agent reads AGENTS.md → learns the API
2. Agent reads design-tokens.md → knows the visual style
3. Agent reads skill.md → knows the workflow
4. Agent writes JS using StudioPro API
5. Runs: node render.js my-video.js
6. Gets: MP4 file ready to share
```

---

## 🧪 Export Test Results (Aug 24, 2026)

### Test Setup
- **Script:** `india-pollution.js` (9 HTML clips, 45s duration)
- **Chrome:** Headless, `--disable-gpu`, `--no-sandbox`
- **Dev Server:** `http://localhost:3000` (Python http.server)

### FTRT Export Test
| Metric | Result |
|---|---|
| **Status** | ❌ FAILED — stalled |
| **Worker starts** | ✅ Yes ("pumping 1350 frames") |
| **Progress** | Stuck at 0% |
| **Video time** | Stuck at 0.1s |
| **Stall modal** | Never appeared (60s timeout) |
| **Root Cause** | WebCodecs SharedWorker needs GPU. `--disable-gpu` flag breaks hardware encoding. Worker starts but can't encode frames. |
| **Fix** | Remove `--disable-gpu` flag, or use `--enable-features=VaapiVideoDecoder` for software fallback |

### MediaBunny Export Test
| Metric | Result |
|---|---|
| **Status** | ⚠️ WORKS but extremely slow |
| **Progress** | Advances (0% → 12% in 60s) |
| **Video time** | 0.6s in 60s wall time |
| **Speed** | 0.01× real-time (100× slower than needed) |
| **Root Cause** | html2canvas renders each frame individually. 9 HTML clips × 30fps × 5s = 1350 frames. Each frame takes ~0.5-1s for html2canvas → total ~15-22 minutes |
| **Fix** | Pre-render HTML clips to canvas BEFORE export, or cache html2canvas results between frames |

### Previous Successful Export
- **File:** `india-pollution_ultra_30fps_ftrt_mp4.mp4` (1.3MB)
- **Created:** Aug 23, 2026
- **Mode:** FTRT
- **How:** Exported from GUI editor (not headless automation) — Chrome with GPU enabled

### Key Findings

1. **FTRT requires GPU** — WebCodecs SharedWorker fails silently with `--disable-gpu`. No error, no stall modal, just hangs.

2. **MediaBunny is CPU-bound for HTML clips** — Each frame requires a full html2canvas render. No caching between frames.

3. **The existing FTRT output was from the GUI** — Not from headless automation. The GUI uses Chrome with GPU enabled.

4. **The api.js export flow is correct** — Matches the proven `automation/render.js` pattern (modal flow + submit). The issue is Chrome/GPU, not the code.

### Fix Plan

| Fix | Impact | Effort |
|---|---|---|
| ~~Remove `--disable-gpu` from Chrome args~~ | ❌ Still fails — no GPU on machine | 5 min |
| Pre-render HTML clips before export | MediaBunny 10× faster | 2-3 hours |
| Cache html2canvas between frames | MediaBunny 5× faster | 1-2 hours |
| Use OffscreenCanvas for html2canvas | MediaBunny 3× faster | 2-3 hours |
| Upgrade to GPU-enabled machine | FTRT export works | Hardware |

### Recommendations

1. **For now:** Use MediaBunny mode with pre-render optimization (Phase 1 preload fix)
2. **For FTRT:** Need a machine with GPU (any discrete GPU works — even Intel UHD 630)
3. **For speed:** Implement Phase 1 (preload fix) to cache html2canvas results → MediaBunny becomes viable
4. **For production:** Both modes work from GUI (Chrome with GPU). Automation needs GPU machine for FTRT.

---

## ✅ Test Results — Aug 24, 2026

### Critical Fix: Use `npm run dev` (Vite) instead of `http-server`

**Problem:** Using `http-server` or `npx serve` to serve StudioPro results in **completely unstyled UI**. Tailwind CSS and ES modules are not processed. The editor loads but all styles are missing — modals overlap, layout breaks.

**Solution:** Always use `npm run dev` which starts Vite dev server with full CSS/JS processing.

### Test Matrix

| # | Pipeline | Mode | Time | Size | Status |
|---|---|---|---|---|---|
| 1 | MD-to-video | MediaBunny | 60.6s | 1.1 MB | ✅ PASS |
| 2 | MD-to-video | FTRT | 15.7s | 1.1 MB | ✅ PASS |
| 3 | Code-to-video | MediaBunny | 9.1s | 0.12 MB | ✅ PASS |
| 4 | Code-to-video | FTRT | 6.6s | 0.12 MB | ✅ PASS |

### Key Findings

1. **FTRT works for text/shape clips** — MD-to-video FTRT is 4× faster than MediaBunny (15.7s vs 60.6s)
2. **FTRT works for simple HTML clips** — Code-to-video FTRT exported successfully (6.6s)
3. **Pre-render works** — HTML clips pre-rendered in 0.6-0.7s, eliminating black frames
4. **`npm run dev` is required** — http-server breaks the entire UI
5. **Both pipelines fully functional** — MD-to-video and Code-to-video both work in headless mode

### Commands Used

```bash
# Start dev server (MUST use Vite)
cd studio-pro-editor && npm run dev

# MD-to-video renders
node automation/render.js scripts/social-short.md -f mediabunny-mp4 -q ultra
node automation/render.js scripts/social-short.md -f ftrt-mp4 -q ultra

# Code-to-video renders
node automation/code-to-video/render.js examples/simple-test.js --mode mediabunny
node automation/code-to-video/render.js examples/simple-test.js --mode ftrt
```

### Output Files

```
automation/output/
├── social-short_ultra_30Mbps_30fps_MB-H264_1080p.mp4    (1.1 MB, MediaBunny)
├── social-short_ultra_30Mbps_30fps_FTRT-H264_1080p.mp4  (1.1 MB, FTRT)

automation/code-to-video/output/
├── simple-test_ultra_30fps_mediabunny_mp4.mp4  (0.12 MB, MediaBunny)
├── simple-test_ultra_30fps_ftrt_mp4.mp4        (0.12 MB, FTRT)
```
