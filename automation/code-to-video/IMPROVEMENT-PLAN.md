# Agentic Automation — Improvement Plan

> **Date:** August 23, 2026
> **Goal:** Make code-to-video automation production-ready for AI agents
> **Status:** Basic workflow working. Issues identified, fixes planned.

---

## Current State (Tested & Working)

```
JS file → Chrome → StudioPro → Clips → Export → MP4
         2.5s      0.5s       0.3s    2.5s    0.5s
         └──────────────────────────────────────┘
                    Total: ~8.7 seconds
```

| Phase | Time | Status |
|---|---|---|
| Chrome launch | 2.5s | ✅ Working |
| Dev server check | 0.3s | ✅ Working |
| Script execution | 0.3s | ✅ Working |
| Export modal | 0.5s | ✅ Working |
| Video export | 2.5s | ✅ Working (shows 100%) |
| Blob capture | 0.5s | ✅ Working |
| **Total** | **~8.7s** | **✅ Working** |

---

## Issues Identified

### Issue 1: Export Progress Shows 100% Immediately
**Problem:** Progress jumps to 100% after 2 seconds
**Cause:** Short video (5s) exports too fast for progress to update
**Impact:** Low — video still exports correctly
**Fix:** ✅ DONE — Added 2s delay before polling, better progress detection

### Issue 2: Output Directory
**Problem:** Videos saved to `automation/` instead of `code-to-video/output/`
**Cause:** `outputPath` was just filename, no directory
**Impact:** Medium — files scattered in wrong location
**Fix:** ✅ DONE — Resolve path relative to `code-to-video/output/`

### Issue 3: No Error Handling
**Problem:** Crashes on Chrome not found, dev server down, script errors
**Cause:** No validation before launching
**Impact:** High — agents get cryptic errors
**Fix:** ✅ DONE — Added checks for Chrome path, dev server, script validation

### Issue 4: No Progress Bar
**Problem:** Only shows 100% — no incremental progress
**Cause:** Export too fast for progress updates
**Impact:** Low — video still exports
**Fix:** 🟡 PLANNED — Show phase-by-phase progress instead of percentage

### Issue 5: Chrome Launch Slow (2.5s)
**Problem:** Chrome takes 2.5s to launch every time
**Cause:** Cold start, no browser pooling
**Impact:** Medium — adds 2.5s to every render
**Fix:** 🟡 PLANNED — Browser pooling, reuse Chrome instance

---

## Improvement Plan

### Phase 1: Quick Fixes (1-2 days)

| Fix | Priority | Effort | Impact |
|---|---|---|---|
| Fix progress reporting | ✅ DONE | 0.5 day | Better UX |
| Fix output directory | ✅ DONE | 0.5 day | Correct file location |
| Add error handling | ✅ DONE | 0.5 day | Better agent experience |
| Add progress bar | 🔴 Next | 0.5 day | Visual feedback |

### Phase 2: Performance (2-3 days)

| Fix | Priority | Effort | Impact |
|---|---|---|---|
| Browser pooling | 🔴 Next | 1 day | -2.5s per render |
| Parallel renders | 🟡 Planned | 1 day | Multiple videos at once |
| Skip export modal | 🟡 Planned | 0.5 day | -0.5s per render |

### Phase 3: Agent Experience (3-5 days)

| Fix | Priority | Effort | Impact |
|---|---|---|---|
| Auto-detect Chrome | 🔴 Next | 0.5 day | No config needed |
| Auto-start dev server | 🟡 Planned | 1 day | No manual setup |
| Better error messages | 🟡 Planned | 0.5 day | Agent-friendly errors |
| Retry on failure | 🟡 Planned | 0.5 day | Resilient automation |

---

## Detailed Fixes

### Fix 1: Progress Bar (Phase 1)

Replace 100% jump with phase-by-phase progress:

```
🚀 Launching Chrome...        ✓ (2.5s)
📝 Executing script...        ✓ (0.3s)
🎬 Exporting...
   ⏳ 25% — Rendering frames (1.2s)
   ⏳ 50% — Encoding video (2.0s)
   ⏳ 75% — Finalizing (2.5s)
   ⏳ 100% — Done! (3.0s)
📥 Saving file...             ✓ (0.5s)
✅ Complete! (8.7s)
```

### Fix 2: Browser Pooling (Phase 2)

Reuse Chrome instance across renders:

```javascript
class StudioProPool {
    constructor(size = 2) {
        this.browsers = [];
        this.available = [];
    }
    
    async acquire() {
        if (this.available.length > 0) {
            return this.available.pop();
        }
        return await this.launchNew();
    }
    
    release(browser) {
        this.available.push(browser);
    }
}
```

**Impact:** -2.5s per render (Chrome already warm)

### Fix 3: Skip Export Modal (Phase 2)

Call export functions directly instead of opening modal:

```javascript
// Instead of:
openExportModal();
setRadio('exportFormat', 'video-ftrt-mp4');
submitExport();

// Do:
startExport('video-ftrt-mp4', 0, State.duration);
```

**Impact:** -0.5s per render

### Fix 4: Auto-Detect Chrome (Phase 3)

Search common Chrome paths:

```javascript
const CHROME_PATHS = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser'
];

function findChrome() {
    for (const p of CHROME_PATHS) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}
```

**Impact:** No config needed for most users

### Fix 5: Auto-Start Dev Server (Phase 3)

Check if server is running, start if not:

```javascript
async function ensureDevServer() {
    const isUp = await checkPort(3000);
    if (!isUp) {
        console.log('Starting dev server...');
        const { spawn } = await import('child_process');
        const server = spawn('npm', ['run', 'dev'], { 
            cwd: path.join(__dirname, '../..'),
            detached: true 
        });
        // Wait for server to start
        await waitForPort(3000, 30000);
    }
}
```

**Impact:** Zero manual setup

---

## Performance Targets

### Current
| Metric | Value |
|---|---|
| Chrome launch | 2.5s |
| Script execution | 0.3s |
| Export | 2.5s |
| Blob capture | 0.5s |
| **Total** | **~8.7s** |

### After Phase 1
| Metric | Value | Improvement |
|---|---|---|
| Chrome launch | 2.5s | — |
| Script execution | 0.3s | — |
| Export | 2.5s | — |
| Blob capture | 0.5s | — |
| Progress reporting | Better | ✓ |
| Error handling | Better | ✓ |
| **Total** | **~8.7s** | **Better UX** |

### After Phase 2
| Metric | Value | Improvement |
|---|---|---|
| Chrome launch | 0s (pooled) | -2.5s |
| Script execution | 0.3s | — |
| Export | 2.0s (skip modal) | -0.5s |
| Blob capture | 0.5s | — |
| **Total** | **~3.3s** | **-61%** |

### After Phase 3
| Metric | Value | Improvement |
|---|---|---|
| Chrome launch | 0s (pooled) | -2.5s |
| Dev server check | 0s (auto-start) | -0.3s |
| Script execution | 0.3s | — |
| Export | 2.0s | — |
| Blob capture | 0.5s | — |
| **Total** | **~3.3s** | **Zero setup** |

---

## Agent Experience Improvements

### Better Error Messages

```javascript
// Before:
"Error: submitExport not found"

// After:
"Error: Export function not available. 
 Make sure StudioPro is loaded correctly.
 Run: npm run dev
 Then: node render.js my-video.js"
```

### Retry Logic

```javascript
async function renderWithRetry(script, output, options, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await render(script, output, options);
        } catch (err) {
            if (i === retries - 1) throw err;
            console.log(`Retry ${i + 1}/${retries}...`);
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}
```

### Progress Callbacks

```javascript
studio.on('progress', (phase, percent, elapsed) => {
    console.log(`[${phase}] ${percent}% (${elapsed}s)`);
});
```

---

## Priority Order

1. ✅ Fix progress reporting
2. ✅ Fix output directory
3. ✅ Add error handling
4. 🔴 Add progress bar
5. 🔴 Browser pooling
6. 🟡 Skip export modal
7. 🟡 Auto-detect Chrome
8. 🟡 Auto-start dev server
9. 🟢 Retry logic
10. 🟢 Progress callbacks

---

## What "Done" Looks Like

An AI agent can:
1. Write a JS file using StudioPro API
2. Run `node render.js my-video.js`
3. See clear progress: `🚀 → 📝 → 🎬 → 📥 → ✅`
4. Get MP4 file in `output/` folder
5. If something fails, get clear error message
6. If Chrome isn't found, auto-detect it
7. If dev server isn't running, auto-start it
8. Render multiple videos in parallel
9. Total time: **~3 seconds** per video

**That's production-ready agentic automation.**
