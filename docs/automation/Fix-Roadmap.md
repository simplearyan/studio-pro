# Fix Roadmap — HTML Clip Issues

> Prioritized order to fix issues. Each fix builds on the previous one.
> Start from the top, work down.

---

## 🎯 Why This Order?

1. **Preload fix** → Removes empty frames (biggest visual bug)
2. **html2canvas CSS** → Makes clips render correctly
3. **Internal animations** → Makes clips dynamic
4. **Transitions** → Makes cuts professional
5. **Load Script GUI** → Makes workflow smooth

---

## Phase 1: Preload Fix (1-2 hours) 🔴

**Problem:** 1-second black frame between each HTML clip in export.

**Root Cause:** html2canvas renders clips on-demand (~1s per clip). Export loop captures before render completes.

**Fix:**
```javascript
// Add to index.html — call BEFORE export starts
async function preRenderHtmlClips() {
    for (const clip of State.clips) {
        if (clip.type === 'html' && !clip._htmlCanvas) {
            // Write HTML to iframe
            writeHtmlToIframe(clip);
            // Wait for iframe to load
            await new Promise(r => setTimeout(r, 100));
            // Capture with html2canvas
            const canvas = await html2canvas(clip._htmlIframe.contentDocument.body, {...});
            clip._htmlCanvas = canvas;
        }
    }
}

// Call in startExport()
async function startExport() {
    await preRenderHtmlClips(); // <-- Add this
    // ... rest of export
}
```

**Test:** Export india-pollution.js → verify no black frames between clips.

**Files:** `index.html`

---

## Phase 2: html2canvas CSS Fixes (2-3 hours) 🔴

**Problem:** Canvas export looks different from HTML editor preview.

**Issues to fix:**
1. Emojis → Use CSS badges (document in design-tokens.md ✅ done)
2. Border-radius → Use overflow:hidden wrapper
3. Flexbox centering → Use text-align:center
4. Font loading → Wait for document.fonts.ready

**Fix in drawCanvas():**
```javascript
// Before html2canvas, ensure fonts are loaded
await document.fonts.ready;

// Pass to html2canvas
html2canvas(iframe.body, {
    width: w,
    height: h,
    backgroundColor: null,
    scale: 1,
    logging: false,
    allowTaint: true,
    useCORS: false,
    // NEW: Wait for fonts
    onclone: (doc) => {
        // Ensure fonts are loaded in cloned doc
        return doc.fonts.ready;
    }
});
```

**Test:** Export india-pollution.js → compare canvas preview vs export.

**Files:** `index.html`

---

## Phase 3: Pass clipTime to iframe (3-4 hours) 🔴

**Problem:** HTML clips are static. No internal animations.

**Fix:** Pass current time to iframe before html2canvas capture.

```javascript
// In drawCanvas(), BEFORE html2canvas call
const clipTime = State.currentTime - clip.start;

// Pass time to iframe
if (clip._htmlIframe?.contentWindow) {
    clip._htmlIframe.contentWindow.clipTime = clipTime;
    clip._htmlIframe.contentDuration = clip.duration;
    
    // Call animate() if it exists
    if (typeof clip._htmlIframe.contentWindow.animate === 'function') {
        clip._htmlIframe.contentWindow.animate();
    }
}

// Force re-render when clip has JS
if (clip.js && clip._htmlReady) {
    clip._htmlNeedsRefresh = true;
}
```

**Test:** Add simple counter animation to india-pollution.js → verify it animates.

**Files:** `index.html`

---

## Phase 4: Animated India Pollution (2-3 hours) 🟡

**Problem:** Presentation is static. Needs dynamic elements.

**Fix:** Update india-pollution.js with internal JS animations.

```javascript
// In each HTML clip's JS property
`
function animate() {
    const t = window.clipTime || 0;
    
    // Bar chart grows
    const bars = document.querySelectorAll('.bar');
    bars.forEach((bar, i) => {
        const delay = i * 0.3;
        const progress = Math.min(1, Math.max(0, (t - delay)) / 1.5);
        const eased = 1 - Math.pow(1 - progress, 3);
        bar.style.height = (eased * parseFloat(bar.dataset.target)) + '%';
    });
    
    // Counter counts up
    const counter = document.getElementById('counter');
    if (counter) {
        const progress = Math.min(1, t / 2.0);
        counter.textContent = Math.round(progress * 1670000).toLocaleString();
    }
    
    // Items slide up
    const items = document.querySelectorAll('.item');
    items.forEach((item, i) => {
        const delay = i * 0.2;
        const progress = Math.min(1, Math.max(0, (t - delay)) / 0.8);
        item.style.transform = 'translateY(' + (30 * (1 - progress)) + 'px)';
        item.style.opacity = progress;
    });
}
`
```

**Test:** Export → verify bars grow, counters count, items slide.

**Files:** `automation/code-to-video/examples/india-pollution.js`

---

## Phase 5: Fade Transitions (4-6 hours) 🟡

**Problem:** Scenes cut abruptly. No smooth transitions.

**Fix:** Implement fade transition between clips.

```javascript
// In drawCanvas(), when rendering clip N
const nextClip = State.clips[clipIndex + 1];
const clipEnd = clip.start + clip.duration;
const transDuration = 0.5; // seconds

if (nextClip && State.currentTime > (clipEnd - transDuration)) {
    // In transition zone
    const transProgress = (State.currentTime - (clipEnd - transDuration)) / transDuration;
    
    // Draw next clip underneath
    ctx.globalAlpha = 1;
    drawHtmlClip(ctx, nextClip);
    
    // Draw current clip on top with fading opacity
    ctx.globalAlpha = 1 - transProgress;
    drawHtmlClip(ctx, clip);
    ctx.globalAlpha = 1;
} else {
    // Normal render
    drawHtmlClip(ctx, clip);
}
```

**Test:** Export with 2 clips → verify smooth fade between them.

**Files:** `index.html`

---

## Phase 6: Load Script GUI (2-3 hours) 🟢

**Problem:** Must use CLI to load .js composition files.

**Fix:** Already implemented ✅ (projectsLoadCard + loadCompositionScript)

**Test:** Open projects modal → click "Load Script" → select india-pollution.js → verify clips appear.

**Files:** `index.html` ✅ done

---

## 📊 Time Summary

| Phase | What | Time | Impact |
|---|---|---|---|
| 1 | Preload fix | 1-2h | 🔴 Removes black frames |
| 2 | html2canvas CSS | 2-3h | 🔴 Correct rendering |
| 3 | Pass clipTime | 3-4h | 🔴 Enables animations |
| 4 | Animated clips | 2-3h | 🟡 Dynamic content |
| 5 | Fade transitions | 4-6h | 🟡 Professional cuts |
| 6 | Load Script GUI | 2-3h | 🟢 Already done ✅ |

**Total: 14-21 hours (2-3 days)**

---

## 🎬 Final Result

After all phases:

```
User writes JS composition
    ↓
Clicks "Load Script" in GUI
    ↓
9 animated HTML clips appear on timeline
    ↓
Bars grow, counters count, items slide in
    ↓
Smooth fade transitions between scenes
    ↓
Export: 45s video in 14 seconds
    ↓
Professional, dynamic presentation
```

---

## 📁 All Plan Documents

| Document | Purpose |
|---|---|
| `docs/automation/Fix-Roadmap.md` | This file — prioritized fix order |
| `docs/automation/Transitions-Plan.md` | 12 transition types |
| `docs/automation/HTML-Clip-Internal-Animations-Plan.md` | Frame-based JS animations |
| `automation/code-to-video/ISSUES-AND-TODOS.md` | Issue tracker |
| `automation/code-to-video/skills/html2canvas-gotchas.md` | CSS workarounds |
| `automation/code-to-video/templates/design-tokens.md` | Safe CSS patterns |
