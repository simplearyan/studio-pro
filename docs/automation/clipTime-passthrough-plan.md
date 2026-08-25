# clipTime Passthrough — Frame-by-Frame HTML Animations

## Current Architecture

```
drawCanvas() runs every frame
    ↓
HTML clip detected
    ↓
Check: _htmlCanvas cached && !_htmlNeedsRefresh?
    YES → Draw cached canvas (instant) ← current fast path
    NO  → Write iframe HTML/CSS/JS → wait 50ms → html2canvas capture → cache
```

**Problem:** The iframe's JS executes ONCE at write time. No way to update element positions per-frame. Everything is static.

## Desired Architecture

```
drawCanvas() runs every frame
    ↓
HTML clip detected (has JS with animate() function)
    ↓
iframe.setClipTime(clipTime)  ← NEW: tell iframe what time it is
    ↓
iframe JS: animate() recalculates positions/styles
    ↓
html2canvas captures the updated DOM → animated frame
```

## Implementation

### Step 1: Inject `setClipTime` into iframe (index.html)

When writing iframe content, add a bridge function:

```javascript
// Inside the iframe's <script>:
window.setClipTime = function(t) {
    window.clipTime = t;
    if (typeof window.animate === 'function') {
        window.animate(t);
    }
};
```

This goes into the `doc.write()` call at line ~6330 in index.html.

### Step 2: Call `setClipTime` before html2canvas capture (index.html)

In the drawCanvas HTML clip section, before the html2canvas call:

```javascript
// Before html2canvas capture:
if (clip._htmlIframe && clip._htmlIframe.contentWindow) {
    const clipTime = State.currentTime - clip.start;
    clip._htmlIframe.contentWindow.setClipTime(clipTime);
}
```

### Step 3: Mark animated clips for per-frame refresh (index.html)

Clips with JS containing `animate` or `clipTime` should ALWAYS re-render:

```javascript
// In the signature check:
const hasAnimation = clip.js && (clip.js.includes('animate') || clip.js.includes('clipTime'));
if (hasAnimation) {
    clip._htmlNeedsRefresh = true; // always re-render
}
```

### Step 4: Skip 50ms delay for animated clips

For animated clips, reduce the iframe write delay from 50ms to 0ms (or 5ms):

```javascript
const delay = hasAnimation ? 5 : 50;
setTimeout(() => { clip._htmlReady = true; ... }, delay);
```

## Performance Considerations

| Scenario | Frames/sec | html2canvas calls | Impact |
|---|---|---|---|
| Static clip (no JS) | 30 | 1 (cached) | ✅ Zero overhead |
| Animated clip | 30 | 30/sec | ⚠️ ~0.5s per frame |
| 9 animated clips | 30 | 270/sec | ❌ Too slow for realtime |

**Solution:** For export, html2canvas is called per-frame anyway (that's how video encoding works). For live editor preview, we can throttle animated clips to 10fps.

## Files to Modify

| File | Change |
|---|---|
| `index.html` | Inject `setClipTime` into iframe, call before capture, mark animated clips |

## Clip Authoring Contract

```javascript
// In clip.js — authors write an animate() function:
function animate(t) {
    // t = seconds since clip started (0 to clip.duration)
    
    // Bar chart: grow from 0% to 35% in 2 seconds
    const bar = document.getElementById('bar-1');
    if (bar) {
        const progress = Math.min(1, t / 2.0);
        const eased = 1 - Math.pow(1 - progress, 3);
        bar.style.width = (eased * 35) + '%';
    }
    
    // Counter: 0 to 1.67M in 3 seconds
    const counter = document.getElementById('counter');
    if (counter) {
        const progress = Math.min(1, t / 3.0);
        counter.textContent = Math.round(progress * 1670000).toLocaleString();
    }
    
    // Slide up: items appear from bottom
    const item = document.getElementById('item-1');
    if (item) {
        const progress = Math.min(1, Math.max(0, (t - 0.5) / 1.0));
        const eased = 1 - Math.pow(1 - progress, 3);
        item.style.transform = `translateY(${(1 - eased) * 60}px)`;
        item.style.opacity = eased;
    }
}

animate(0); // Initial render at t=0
```

## Testing

1. Create `india-pollution-v2.js` with animated charts
2. Compare v1 (static) vs v2 (animated) side by side
3. Verify export captures each frame correctly
4. Verify live editor shows smooth animation when seeking
