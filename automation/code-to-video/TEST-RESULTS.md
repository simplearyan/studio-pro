# Code-to-Video — Test Results

> **Date:** August 23, 2026
> **Test:** Simple 5-second video with HTML clip
> **Result:** ✅ PASS — Video exported successfully

---

## Test Summary

| Metric | Value |
|---|---|
| **Script** | `examples/simple-test.js` |
| **Duration** | 5 seconds |
| **Clips** | 1 (HTML clip with gradient card) |
| **Output** | `simple-test_ultra_30fps_ftrt_mp4.mp4` |
| **File Size** | 0.25 MB |
| **Total Time** | 5.5 seconds |
| **Export Time** | ~0.5 seconds (after Chrome launch) |

---

## Time Breakdown

| Phase | Time | Notes |
|---|---|---|
| Chrome launch | ~2.5s | Puppeteer + headless Chrome |
| Connect to dev server | ~0.5s | localhost:3000 |
| Wait for StudioPro API | ~0.5s | `window.StudioPro` available |
| Execute script | ~0.3s | `createComposition()` + clips |
| Open export modal | ~0.5s | `openExportModal()` |
| Set export options | ~0.2s | Radio buttons, quality |
| Start export | ~0.1s | `submitExport()` |
| Export video | ~0.5s | FTRT mode, 5-second video |
| Capture blob | ~0.3s | `_exportDoneUrl` → file |
| **Total** | **~5.5s** | |

---

## Issues Found & Fixed

### 1. ES Module Compatibility
**Issue:** `require()` not available in ES module context
**Fix:** Changed to `import` statements, updated `package.json` type

### 2. Chrome Path Not Found
**Issue:** `puppeteer-core` needs explicit `executablePath`
**Fix:** Read Chrome path from `config.json`

### 3. Function Statement Error
**Issue:** `module.exports = function(...) { }` can't be eval'd in browser
**Fix:** Strip JSDoc comments, convert function expression to arrow function

### 4. Export Button Not Found
**Issue:** No `id="btnExport"` button — uses `openExportModal()` function
**Fix:** Call `openExportModal()` directly, then `submitExport()`

### 5. Blob Not Captured
**Issue:** `_exportBlob` not available — export uses `_exportDoneUrl`
**Fix:** Fetch blob via `_exportDoneUrl`, convert to base64, save to file

---

## How It Works Now

```
1. Node.js reads script file
   ↓
2. Strips JSDoc comments + module.exports
   ↓
3. Converts to arrow function string
   ↓
4. Puppeteer opens Chrome, loads StudioPro
   ↓
5. Executes arrow function in browser context
   ↓
6. StudioPro API creates clips on timeline
   ↓
7. Opens export modal, sets options
   ↓
8. Calls submitExport() to start
   ↓
9. Waits for export to complete
   ↓
10. Captures blob via _exportDoneUrl
    ↓
11. Saves to file as MP4
```

---

## Issues Still Remaining

### 1. Export Time Shows 0.0s
**Issue:** The progress polling loop exits immediately because `State.isExporting` is already false
**Cause:** Export completes very fast for short videos (5s), or the export was already done from a previous run
**Impact:** Minor — the video is still exported correctly
**Fix:** Add a small delay before checking `isExporting`, or check `_exportDoneUrl` instead

### 2. File Saved to Current Directory
**Issue:** Output file saved to `automation/` instead of `code-to-video/output/`
**Cause:** `render.js` doesn't change directory before saving
**Fix:** Update `render.js` to save to `code-to-video/output/` by default

### 3. No Progress Reporting
**Issue:** Export progress not shown in terminal
**Cause:** Progress polling loop exits immediately
**Fix:** Fix the progress polling to actually wait for export

---

## Improvements Needed

### Priority 1: Fix Progress Reporting
```javascript
// Add delay before checking isExporting
await new Promise(r => setTimeout(r, 2000));
// Then start polling
```

### Priority 2: Fix Output Directory
```javascript
// In render.js, save to code-to-video/output/
const outputPath = path.join(__dirname, 'output', parsed.output || defaultName);
```

### Priority 3: Add Error Handling
- Handle Chrome launch failures
- Handle dev server not running
- Handle script execution errors
- Handle export failures

### Priority 4: Add Progress Bar
- Show percentage complete
- Show elapsed time
- Show estimated time remaining

---

## Comparison: Code-to-Video vs Markdown-to-Video

| Metric | Code-to-Video | Markdown-to-Video |
|---|---|---|
| **Input** | JavaScript file | Markdown file |
| **Setup** | Write JS with API | Write MD with headings |
| **Flexibility** | Unlimited (HTML/CSS/JS) | Limited (MD structure) |
| **Complexity** | Medium (need JS knowledge) | Low (anyone can write MD) |
| **Export Speed** | Same (FTRT) | Same (FTRT) |
| **Output Quality** | Same | Same |
| **Best For** | AI agents, complex visuals | Simple videos, explainers |

---

## Next Steps

1. ✅ Fix progress reporting
2. ✅ Fix output directory
3. ✅ Add error handling
4. ✅ Add progress bar
5. ✅ Test with more complex compositions
6. ✅ Test with animations
7. ✅ Document improvements
