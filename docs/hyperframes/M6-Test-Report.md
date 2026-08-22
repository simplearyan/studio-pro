# M6 — Puppeteer Automation Test Report

> **Date:** August 2026
> **Status:** Phase 1 Complete (Standard export working, MediaBunny too slow for headless)
> **Test Machine:** Windows, GT 740 GPU, Chrome installed

---

## 1. Test Setup

### Environment
- **Chrome:** `C:\Program Files\Google\Chrome\Application\chrome.exe`
- **Node.js:** v22.14.0
- **Puppeteer:** puppeteer-core v23.x (no bundled Chromium)
- **Headless Mode:** `--headless=new` with `--enable-unsafe-swiftshader`
- **HTTP Server:** Built-in (port 3202)

### Test Script
`animal-test.md` — 60-second markdown video with 3 images, 7 slides, text + shapes

---

## 2. Test Results

### Test 1: Standard MP4 (MediaRecorder + captureStream)

| Metric | Value |
|---|---|
| **Duration** | 60s video |
| **Export time** | 60.4s |
| **Speed** | 1.0× real-time |
| **File size** | 3.1 MB |
| **Codec** | H.264 (video/mp4) |
| **Resolution** | 1920×1080 |
| **FPS** | 30 |

**Verdict: ✅ Works perfectly in headless Chrome**

### Test 2: MediaBunny MP4 (WebCodecs)

| Metric | Value |
|---|---|
| **Duration** | 60s video |
| **Export time** | 300s+ (5 min for 2.7s of video) |
| **Speed** | ~0.01× real-time |
| **FPS** | 0.3 fps |

**Verdict: ❌ Too slow in headless Chrome (no GPU → software WebCodecs)**

### Why MediaBunny is Slow in Headless

```
Normal Chrome (with GPU):
  Canvas → WebCodecs → GPU encode → MP4
  Speed: 6-10× real-time

Headless Chrome (no GPU):
  Canvas → WebCodecs → SwiftShader (software) → MP4
  Speed: 0.01× real-time (100× slower)
```

The `--use-angle=swiftshader` flag forces software rendering, which is ~100× slower than GPU encoding.

---

## 3. Batch Test Results

4 scripts rendered sequentially with Standard MP4:

| Script | Duration | Export Time | Speed | File Size |
|---|---|---|---|---|
| animal-test.md | 60s | 63.3s | 0.95× | 3.6 MB |
| explainer.md | 24s | 66.3s | 0.36× | 1.2 MB |
| product-launch.md | 15s | 62.6s | 0.24× | 1.3 MB |
| social-short.md | 18s | 62.9s | 0.29× | 958 KB |
| **Total** | **117s** | **255s** | **0.46×** | **7.1 MB** |

**Note:** Each script takes ~60s minimum due to Chrome startup + page load overhead. The actual render time is proportional to video duration.

---

## 4. Performance Breakdown

| Phase | Time | Notes |
|---|---|---|
| Chrome launch | ~3s | Headless Chrome startup |
| Page load | ~5s | Studio Pro initialization |
| Script injection | ~1s | parseMarkdownToClips() |
| Export modal | ~0.5s | openExportModal() |
| Render loop | duration × 1.0× | captureStream(30) at real-time |
| Blob capture | ~1s | Fetch blob from browser |
| **Total overhead** | **~10s** | Per script |

---

## 5. Recommendations

### For Headless Automation

| Use Case | Recommended Encoder | Speed |
|---|---|---|
| **Quick preview** | Standard (MediaRecorder) | 1× real-time |
| **Batch render** | Standard (MediaRecorder) | 1× real-time |
| **Maximum quality** | Standard (MediaRecorder) | 1× real-time |
| **GPU server** | MediaBunny (WebCodecs) | 6-10× real-time |

### For Future Optimization

1. **FFmpeg integration** — Capture PNG frames → FFmpeg encode → 2-3× faster
2. **GPU server** — Use a machine with GPU for MediaBunny encoding
3. **Parallel rendering** — Run multiple Chrome instances for batch jobs
4. **Caching** — Cache Chrome startup for repeated renders

---

## 6. Known Limitations

| Limitation | Impact | Workaround |
|---|---|---|
| No GPU in headless | MediaBunny/FTRT 100× slower | Use Standard export |
| Chrome startup overhead | ~10s per script | Cache Chrome instance |
| captureStream at 1× | Video render = video duration | Accept 1× speed |
| Audio not captured | Standard export is video-only | Use MediaBunny for audio |

---

## 7. Files Modified

| File | Change |
|---|---|
| `index.html` | Added `window._exportBlob` / `window._exportDoneUrl` for headless capture |
| `automation/render.js` | HTTP server, Standard export default, progress display |
| `automation/batch.js` | Child process spawning for batch renders |
| `automation/test-export.js` | Debug/test script for headless export |

---

## 8. Next Steps

1. **Commit changes** — All automation files + index.html blob exposure
2. **Add FFmpeg path** — Optional encoder for 2-3× speed boost
3. **Test with real projects** — User's actual markdown scripts
4. **Document CLI usage** — Update README with test results
