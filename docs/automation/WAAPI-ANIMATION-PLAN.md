# WAAPI Animation Display Plan

**Date:** August 25, 2026
**Status:** Fixes applied, animation preview needs work

---

## Current State

| Feature | Status |
|---|---|
| WAAPI adapter injected into iframes | ✅ Working |
| seekToFrame() called before html2canvas | ✅ Working |
| Canvas renders content at all times | ✅ 100% rendered |
| Preset changes update canvas | ✅ Fixed |
| Different scenes show different content | ✅ Working |
| **Animations visible in canvas** | ❌ Shows final state only |

---

## Why Animations Don't Show

### Root Cause

CSS animations use `animation-fill-mode: forwards`:
```css
.title { animation: fadeUp 0.8s ease-out forwards; opacity: 0; }
```

This means:
1. On iframe load, animation starts at frame 0 (opacity: 0)
2. Animation runs to completion (opacity: 1)
3. `fill-mode: forwards` keeps element at final state (opacity: 1)
4. html2canvas captures the **final state** — animation already completed

### The Timeline

```
iframe load → animation starts → animation completes → html2canvas captures
     ↓              ↓                    ↓                      ↓
   frame 0      frame 15            frame 30              captures frame 30
  (hidden)     (sliding)          (visible)            (shows visible)
```

By the time html2canvas runs, the animation has already finished.

---

## Solution: Force Animation to Current Frame

### Approach 1: seekToFrame + Delay (Current)

```javascript
// Seek to current frame
clip._htmlIframe.contentWindow.seekToFrame(clipTime * 30, 30);
// Capture immediately
html2canvas(clip._htmlIframe.contentDocument.body, {...});
```

**Problem:** Animation may not have applied yet when html2canvas runs.

### Approach 2: seekToFrame + RequestAnimationFrame (Better)

```javascript
// Seek to current frame
clip._htmlIframe.contentWindow.seekToFrame(clipTime * 30, 30);
// Wait for browser to apply the seeked state
await new Promise(r => {
    clip._htmlIframe.contentWindow.requestAnimationFrame(() => {
        clip._htmlIframe.contentWindow.requestAnimationFrame(r);
    });
});
// Then capture
html2canvas(clip._htmlIframe.contentDocument.body, {...});
```

**Why double rAF:** First rAF applies the style changes, second rAF ensures they're painted.

### Approach 3: Disable fill-mode During Capture (Most Accurate)

```javascript
// Temporarily remove fill-mode to see animation at current frame
const style = doc.createElement('style');
style.textContent = '* { animation-fill-mode: none !important; }';
doc.head.appendChild(style);

// Seek to current frame
clip._htmlIframe.contentWindow.seekToFrame(clipTime * 30, 30);

// Wait for paint
await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

// Capture
html2canvas(doc.body, {...});

// Remove temporary style
style.remove();
```

**Why this works:** Without `fill-mode: forwards`, elements show their state at the exact animation time, not the final state.

---

## Implementation Plan

### Phase 1: Fix seekToFrame Timing (1 hour)

1. In `drawCanvas()`, after `seekToFrame()`:
   - Add double `requestAnimationFrame` wait
   - This ensures the browser applies the seeked state before capture

2. In `preRenderHtmlClip()`:
   - Same double rAF wait after seekToFrame

### Phase 2: Disable fill-mode During Capture (2 hours)

1. Create helper function:
```javascript
function captureHtmlAtFrame(iframe, clipTime, fps, width, height) {
    const doc = iframe.contentDocument;
    
    // Disable fill-mode temporarily
    const style = doc.createElement('style');
    style.id = '_waaapi_capture';
    style.textContent = '* { animation-fill-mode: none !important; }';
    doc.head.appendChild(style);
    
    // Seek to frame
    iframe.contentWindow.seekToFrame(clipTime * fps, fps);
    
    // Wait for paint
    return new Promise(resolve => {
        requestAnimationFrame(() => {
            requestAnimationFrame(async () => {
                const canvas = await html2canvas(doc.body, {
                    width, height,
                    backgroundColor: null,
                    scale: 1,
                    logging: false
                });
                style.remove();
                resolve(canvas);
            });
        });
    });
}
```

2. Replace direct html2canvas calls with this helper

### Phase 3: Animation Preview in Sidebar (3 hours)

1. Add "Preview Animation" button in HTML Content card
2. When clicked:
   - Play the animation in the iframe (remove fill-mode, play from start)
   - Capture frames at 30fps for 2 seconds
   - Show as a mini video preview in the sidebar

3. Add animation timeline scrubber:
   - Show animation progress as a slider
   - Drag to see animation at any point
   - Updates canvas in real-time

### Phase 4: WAAPI Animation Presets (2 hours)

Create animated presets that showcase the seeking capability:

| Preset | Animation | Duration |
|---|---|---|
| **Count Up** | Numbers animate from 0 to target | 2s |
| **Typewriter** | Text types character by character | 3s |
| **Chart Build** | Bars grow from 0 to final height | 2s |
| **Slide Stagger** | Items slide in one by one | 2s |
| **Fade Cascade** | Elements fade in with delay | 2s |
| **Morph Shape** | Shape transforms between forms | 3s |

Each preset uses `animation-fill-mode: none` so seeking works correctly.

---

## Files to Modify

| File | Changes |
|---|---|
| `index.html` line 6404 | Add double rAF wait after seekToFrame |
| `index.html` line 23991 | Add double rAF wait in preRenderHtmlClip |
| `index.html` line 6399 | Add captureHtmlAtFrame helper |
| `index.html` line 13044 | Add animated WAAPI presets |

---

## Testing

1. **Seeking test:** Move playhead to different times, verify animation state changes
2. **Export test:** Export 10s video, verify animations play frame-by-frame
3. **Performance test:** Measure capture time with/without fill-mode fix

---

## Expected Outcome

| Before | After |
|---|---|
| Canvas shows final animation state | Canvas shows exact frame state |
| All frames in scene look the same | Different frames show different animation states |
| Export has smooth animation | Export captures each frame accurately |
