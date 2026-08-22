# M6 — Canvas Labs Portal Analysis: Fast MediaBunny with Puppeteer

> **Date:** August 2026
> **Source:** `D:\Code\Antigravity\design_concepts\canvas-labs-portal\preview-automator`
> **Question:** Why is MediaBunny fast in canvas-labs-portal but slow in our Studio Pro automation?

---

## 1. The Critical Difference

| Factor | canvas-labs-portal | Studio Pro automation |
|---|---|---|
| **Chrome mode** | `headless: false` (visible window) | `headless: true` (no window) |
| **GPU access** | ✅ Yes (real Chrome window) | ❌ No (SwiftShader software) |
| **MediaBunny speed** | Fast (hardware WebCodecs) | 100× slower (software WebCodecs) |
| **Export method** | UI buttons + file download | Programmatic API + blob capture |
| **Output** | CDP download to folder | Blob fetch as base64 |

### The Root Cause

```
headless: false → Chrome has visible window → GPU available → WebCodecs uses GPU → FAST
headless: true  → Chrome has no window → No GPU → WebCodecs uses SwiftShader → SLOW
```

When Chrome runs with `headless: false`, even if no one is watching, it uses the **actual GPU** (GT 740 in our case). When it runs with `headless: true`, it falls back to **SwiftShader** (software rendering), which is ~100× slower for WebCodecs.

---

## 2. canvas-labs-portal Architecture

### How It Works

```javascript
// 1. Launch Chrome with VISIBLE window (GPU available!)
const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: false,  // ← THIS IS THE KEY
  defaultViewport: { width: 1280, height: 720 }
});

// 2. Use CDP to set download behavior
const client = await page.target().createCDPSession();
await client.send('Page.setDownloadBehavior', {
  behavior: 'allow',
  downloadPath: DOWNLOAD_DIR
});

// 3. Navigate to local dev server
await page.goto('http://localhost:4321/canvas.labs/editor/...', {
  waitUntil: 'networkidle0'
});

// 4. Click UI buttons to trigger export
await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button'));
  const exportBtn = buttons.find(b => b.textContent?.includes('Export Video'));
  if (exportBtn) exportBtn.click();
});

// 5. Click Start Render
await page.evaluate(() => {
  const modal = document.querySelector('.fixed.inset-0');
  const startBtn = Array.from(modal.querySelectorAll('button'))
    .find(b => b.textContent?.includes('Start Render'));
  if (startBtn) startBtn.click();
});

// 6. Watch download folder for new files
while (attempts < 180) {
  const files = fs.readdirSync(DOWNLOAD_DIR);
  const newFiles = files.filter(f => !filesBefore.has(f));
  const webmFiles = newFiles.filter(f => f.endsWith('.webm'));
  if (webmFiles.length > 0 && !downloading) {
    downloadedFile = webmFiles[0];
    break;
  }
  await new Promise(r => setTimeout(r, 1000));
}
```

### Key Patterns

1. **`headless: false`** — GPU available for WebCodecs
2. **CDP download behavior** — Files download directly to disk
3. **UI-driven export** — Clicks buttons instead of calling APIs
4. **File-based output** — Watches folder for downloads
5. **EBUSY retry** — Handles Windows file locks

---

## 3. What Studio Pro Can Learn

### Option A: Use `headless: false` (Quick Win)

```javascript
// render.js — change this:
const browser = await puppeteer.launch({
  executablePath: config.chromePath,
  headless: false,  // ← GPU available!
  // ... rest of config
});
```

**Pros:**
- MediaBunny works at full speed (6-10× real-time)
- No code changes needed in Studio Pro
- Same export path as browser

**Cons:**
- Opens a visible Chrome window (can't run on headless servers)
- Requires a display (Xvfb on Linux servers)

### Option B: Use `headless: 'shell'` (Chrome 112+)

```javascript
const browser = await puppeteer.launch({
  executablePath: config.chromePath,
  headless: 'shell',  // ← New headless mode with GPU support
  // ... rest of config
});
```

**Pros:**
- No visible window
- GPU available (Chrome 112+)
- Faster than `headless: true`

**Cons:**
- Requires Chrome 112 or newer
- May not work on all systems

### Option C: Use CDP Download + File Watch (More Reliable)

Instead of blob capture, use Chrome's download behavior:

```javascript
// Set download directory via CDP
const client = await page.target().createCDPSession();
await client.send('Page.setDownloadBehavior', {
  behavior: 'allow',
  downloadPath: resolve(__dirname, 'output')
});

// Click export buttons (UI-driven)
await page.evaluate(() => {
  document.querySelector('button[data-export]').click();
});

// Watch folder for download
const watcher = fs.watch(downloadDir, (event, filename) => {
  if (filename.endsWith('.mp4')) {
    console.log(`Downloaded: ${filename}`);
  }
});
```

**Pros:**
- More reliable than blob capture
- Handles large files without memory issues
- Works with any export format

**Cons:**
- More complex file watching
- Need to handle EBUSY locks on Windows

### Option D: Create a Studio Pro API Endpoint (Best Long-Term)

Add a headless-friendly API to Studio Pro:

```javascript
// In index.html — add headless API
window.studioProAPI = {
  // Load a script
  loadScript: (markdown) => {
    State.markdownText = markdown;
    parseMarkdownToClips();
    return { clips: State.clips.length, duration: State.duration };
  },

  // Export and return blob
  exportVideo: async (options) => {
    const { format = 'mp4', resolution = 1080, fps = 30 } = options;
    openExportModal();
    // ... set options ...
    submitExport();
    // Wait for export
    await new Promise(r => {
      const check = setInterval(() => {
        if (!State.isExporting) { clearInterval(check); r(); }
      }, 100);
    });
    return window._exportBlob;
  },

  // Get project state
  getState: () => ({
    clips: State.clips.length,
    duration: State.duration,
    isExporting: State.isExporting
  })
};
```

**Pros:**
- Clean API surface
- Works with any export mode
- Can be used by any automation tool

**Cons:**
- Requires changes to index.html
- More code to maintain

---

## 4. Recommended Approach

### Phase 1: Quick Win — `headless: false`

Update `render.js` to use `headless: false`:

```javascript
const browser = await puppeteer.launch({
  executablePath: config.chromePath,
  headless: false,  // GPU available!
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--enable-webcodecs'
  ]
});
```

This gives us MediaBunny at full speed (6-10× real-time) with minimal changes.

### Phase 2: CDP Download — More Reliable

Switch from blob capture to CDP download:

```javascript
// Set download behavior
const client = await page.target().createCDPSession();
await client.send('Page.setDownloadBehavior', {
  behavior: 'allow',
  downloadPath: resolve(__dirname, 'output')
});

// Click export buttons (UI-driven, not API)
await clickUI('Export Video');
await clickUI('Start Export');

// Watch folder for download
await waitForDownload(downloadDir, '.mp4');
```

### Phase 3: Studio Pro API — Long-Term

Add a headless-friendly API to index.html for clean automation.

---

## 5. Expected Performance

| Mode | MediaBunny Speed | Headless? | Use Case |
|---|---|---|---|
| `headless: false` | 6-10× realtime | No (visible window) | Local automation |
| `headless: 'shell'` | 6-10× realtime | Yes (no window) | Server with Chrome 112+ |
| `headless: true` | 0.01× realtime | Yes | ❌ Don't use for MediaBunny |
| Standard (MediaRecorder) | 1× realtime | Yes | Fallback for headless |

---

## 6. Implementation Plan

### Step 1: Update render.js (5 min)

Change `headless: true` to `headless: false` and test.

### Step 2: Add CDP Download (30 min)

Replace blob capture with CDP download behavior.

### Step 3: Add UI Click Helpers (30 min)

Create helper functions to click export buttons.

### Step 4: Add File Watch (15 min)

Watch output folder for downloaded files.

### Step 5: Test with Real Scripts (15 min)

Run batch test with all 4 demo scripts.

### Step 6: Document Results (15 min)

Update test report with new performance numbers.

**Total: ~2 hours**

---

## 7. Comparison: canvas-labs-portal vs Studio Pro

| Feature | canvas-labs-portal | Studio Pro |
|---|---|---|
| **Export format** | WebM only | MP4, WebM, GIF |
| **Resolution** | 720p only | 720p-4K |
| **Quality presets** | None | Draft-Standard-High-Ultra |
| **Batch rendering** | Sequential | Sequential + parallel option |
| **Template support** | None | Full template engine |
| **AI generation** | None | BYO-key prompt → video |
| **MediaBunny speed** | Fast (headless: false) | Slow (headless: true) |
| **Audio support** | No | Yes (WebCodecs) |

**Studio Pro is more feature-rich** but needs the `headless: false` fix to match canvas-labs-portal's speed.

---

## 8. Key Takeaway

> **The single most impactful change:** Switch from `headless: true` to `headless: false` in render.js. This gives Chrome GPU access and makes MediaBunny 100× faster.

Everything else (CDP download, UI clicks, file watching) is secondary optimization. The GPU access is the bottleneck.
