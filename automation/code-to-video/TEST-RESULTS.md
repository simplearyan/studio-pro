# Code-to-Video Test Results

## Test: India Pollution Presentation

**Date:** 2024-08-23  
**Script:** `examples/india-pollution.js`  
**Scenes:** 9 HTML clips × 5s = 45s total video

### Test Results

| Metric | Value |
|---|---|
| **Total time** | 23.7s |
| **Chrome launch** | ~3s |
| **Script execution** | ~1s |
| **Export time** | 13.9s |
| **Video duration** | 45s |
| **Speed ratio** | 3.2× realtime |
| **File size** | 1.26 MB |
| **Format** | MP4 (H.264) |
| **Resolution** | 1920×1080 |
| **FPS** | 30 |
| **Quality** | Ultra (30 Mbps) |

### What Works ✅

| Feature | Status | Notes |
|---|---|---|
| Multiple HTML clips | ✅ | 9 clips created and rendered |
| Google Fonts | ✅ | Google Sans loaded via API |
| Clean CSS styling | ✅ | Cards, grids, gradients, borders |
| Emojis | ✅ | 🔴⚠️💰🏭🚗🌾🏠🫁❤️👶🧠🌳🚲💡📢🌍💚✨ |
| Color palette | ✅ | Google-style blue/red/green/yellow |
| SVG arrows | ✅ | CSS `↓` arrow in solutions scene |
| Highlight text | ✅ | Blue highlight chips in health scene |
| Animation keyframes | ✅ | Fade-in, scale, slide-up per scene |
| Progress reporting | ✅ | 13% → 97% during export |
| File output | ✅ | Saved to `output/` directory |

### What's Missing (Agentic Automation Gaps)

| Gap | Priority | Impact | Effort |
|---|---|---|---|
| **No transitions** | 🔴 High | Scenes cut abruptly, no fade/slide between | 1-2 days |
| **No image loading** | 🔴 High | Can't use photos from URLs (CORS) | 1 day |
| **No audio** | 🟡 Medium | No background music or voiceover | 1 day |
| **No text clips** | 🟡 Medium | Only HTML clips, no native text overlay | 0.5 day |
| **No motion paths** | 🟡 Medium | Can't animate along a path | 1 day |
| **No preview mode** | 🟡 Medium | Must export to see result | 2 days |
| **No hot reload** | 🟡 Medium | Must re-run CLI for every change | 2 days |
| **Single composition** | 🟢 Low | Can't chain multiple compositions | 1 day |
| **No error recovery** | 🟢 Low | If one clip fails, entire export fails | 1 day |

### Improvement Suggestions

#### 1. Add Transitions (Most Impactful)
```javascript
StudioPro.createComposition({
  transitions: {
    default: 'fade',  // fade, slide, wipe, dissolve
    duration: 0.5     // seconds
  },
  clips: [...]
});
```

#### 2. Add Image Loading
```javascript
StudioPro.image('https://example.com/photo.jpg', {
  start: 0, duration: 5,
  effects: { width: 1920, height: 1080, objectFit: 'cover' }
});
```

#### 3. Add Background Audio
```javascript
StudioPro.audio('music.mp3', {
  start: 0, duration: 45,
  effects: { volume: 0.3, fadeIn: 2, fadeOut: 2 }
});
```

#### 4. Add Preview Mode
```bash
# Preview without exporting
node render.js examples/india-pollution.js --preview
# Opens Chrome with the composition, user can scrub timeline
```

#### 5. Add Hot Reload
```bash
# Watch mode — re-render on file change
node render.js examples/india-pollution.js --watch
```

### What AI Agents Can Now Do

```bash
# 1. Write a JS file using StudioPro API
# 2. Run: node render.js my-video.js
# 3. Get: MP4 in output/ folder (23s for 45s video)
```

### What AI Agents Can't Do Yet

1. **No transitions** — Videos look amateur without fade/slide between scenes
2. **No images** — Can't include photos (CORS blocks cross-origin loading)
3. **No audio** — No background music or voiceover
4. **No preview** — Must export to see result (slow iteration)
5. **No hot reload** — Must re-run CLI for every change

### Recommendation

**For production agentic automation, implement these in order:**
1. Transitions (biggest visual improvement)
2. Image loading (most requested feature)
3. Preview mode (biggest DX improvement)
4. Audio support (completes the video)

**Estimated time to production-ready: 5-7 days**

---

## Previous Tests

### Simple Test (5s video)
- **Script:** `simple-test.js`
- **Time:** 8.7s
- **File:** 0.27 MB
- **Status:** ✅ Working

---

## Full Pipeline Test — Aug 24, 2026

### All 4 Pipelines Tested ✅

| # | Pipeline | Script | Mode | Time | Size | Status |
|---|---|---|---|---|---|---|
| 1 | MD-to-video | social-short.md | MediaBunny | 60.6s | 1.1 MB | ✅ |
| 2 | MD-to-video | social-short.md | FTRT | 15.7s | 1.1 MB | ✅ |
| 3 | Code-to-video | simple-test.js | MediaBunny | 9.1s | 0.12 MB | ✅ |
| 4 | Code-to-video | simple-test.js | FTRT | 6.6s | 0.12 MB | ✅ |

### Critical Fix Applied

**Issue:** Using `http-server` instead of `npm run dev` caused completely unstyled UI.
**Fix:** Always use `npm run dev` (Vite) for dev server.

### Output Files Created

```
automation/output/
├── social-short_ultra_30Mbps_30fps_MB-H264_1080p.mp4
├── social-short_ultra_30Mbps_30fps_FTRT-H264_1080p.mp4

automation/code-to-video/output/
├── simple-test_ultra_30fps_mediabunny_mp4.mp4
├── simple-test_ultra_30fps_ftrt_mp4.mp4
```

---

## India Pollution Test — Aug 24, 2026

### 9 HTML Clips × 5s = 45s Video

| Metric | MediaBunny | FTRT |
|---|---|---|
| **Pre-render time** | 1.7s | 1.8s |
| **Export time** | 45.5s | 12.8s |
| **Total time** | 50.5s | 17.8s |
| **File size** | 1.07 MB | 0.96 MB |
| **Speed vs realtime** | 1× | **3.5×** |
| **Black frames** | ✅ None | ✅ None |

### Key Findings

1. **Pre-render eliminates black frames** — 9 HTML clips pre-rendered in 1.7-1.8s
2. **FTRT is 2.8× faster** — 17.8s vs 50.5s for 45s video
3. **Both modes work** — No stalls, no GPU errors
4. **Healthcheck works** — Verified Vite before launch

### Output Files

```
automation/code-to-video/output/
├── india-pollution_ultra_30fps_mediabunny_mp4.mp4  (1.07 MB)
├── india-pollution_ultra_30fps_ftrt_mp4.mp4        (0.96 MB)
```
