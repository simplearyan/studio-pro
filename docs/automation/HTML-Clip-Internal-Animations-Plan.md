# HTML Clip Internal Animations Plan

> Animate individual elements WITHIN each HTML clip — bars growing, counters counting, items sliding in.
> All frame-based, deterministic, compatible with html2canvas.

---

## 📋 Summary

| Item | Value |
|---|---|
| **Goal** | Animate elements inside HTML clips (bars, counters, slides) |
| **Approach** | Pass `clipTime` to iframe JS → JS sets CSS based on time → html2canvas captures |
| **Effort** | 2-3 days |
| **Priority** | 🔴 HIGH — makes clips dynamic instead of static |

---

## 🏗️ Current Architecture

```
drawCanvas() runs every frame
    ↓
For each HTML clip:
    1. Create offscreen iframe (if not exists)
    2. Write HTML/CSS/JS to iframe
    3. html2canvas captures iframe body → canvas
    4. Draw canvas onto main canvas
```

**Problem:** html2canvas captures ONE static frame. JS animations in the iframe run but are "frozen" at capture time.

---

## 🎯 Solution: Frame-Based Internal Animations

### Key Idea

**Pass `clipTime` to the iframe BEFORE html2canvas captures.**

The iframe's JS reads `window.clipTime` and sets CSS properties based on that time. Then html2canvas captures the result.

```
drawCanvas() at frame N
    ↓
Set iframe.clipTime = 0.5s (current time into clip)
    ↓
iframe JS reads clipTime, sets:
    - bar.style.width = '60%'  (grew from 0% to 60% in 0.5s)
    - counter.textContent = '30'  (counted from 0 to 30)
    - item.style.transform = 'translateY(0)'  (slid up from bottom)
    ↓
html2canvas captures → frame shows animated state
```

### How It Works

1. **Before html2canvas capture:**
   ```javascript
   // In drawCanvas(), before html2canvas call
   const clipTime = State.currentTime - clip.start;
   const clipDuration = clip.duration;
   
   // Pass time to iframe
   if (clip._htmlIframe?.contentWindow) {
       clip._htmlIframe.contentWindow.clipTime = clipTime;
       clip._htmlIframe.contentDuration = clipDuration;
       clip._htmlIframe.clipFrame = Math.round(clipTime * State.exportFps);
   }
   ```

2. **In the iframe's JS:**
   ```javascript
   // User writes this in clip.js
   function animate() {
       const t = window.clipTime || 0;
       const dur = window.clipDuration || 5;
       
       // Bar chart: grow from 0% to 100% in first 2 seconds
       const bar1 = document.getElementById('bar-1');
       if (bar1) {
           const progress = Math.min(1, t / 2.0);
           bar1.style.width = (progress * 35) + '%'; // 35% max
       }
       
       // Counter: count from 0 to 1.67M in 3 seconds
       const counter = document.getElementById('counter-1');
       if (counter) {
           const progress = Math.min(1, t / 3.0);
           const value = Math.round(progress * 1670000);
           counter.textContent = value.toLocaleString();
       }
   }
   
   // Run on every frame
   animate();
   ```

3. **html2canvas captures** the iframe with updated styles.

---

## 🎨 Animation Types

### 1. Bar Chart Growth

```javascript
// In clip.js
function animate() {
    const t = window.clipTime || 0;
    
    // Each bar grows sequentially
    const bars = [
        { id: 'bar-1', target: 35, delay: 0, duration: 1.5 },
        { id: 'bar-2', target: 28, delay: 0.3, duration: 1.5 },
        { id: 'bar-3', target: 22, delay: 0.6, duration: 1.5 },
        { id: 'bar-4', target: 15, delay: 0.9, duration: 1.5 }
    ];
    
    bars.forEach(bar => {
        const el = document.getElementById(bar.id);
        if (!el) return;
        const elapsed = Math.max(0, t - bar.delay);
        const progress = Math.min(1, elapsed / bar.duration);
        const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        el.style.width = (eased * bar.target) + '%';
    });
}
```

### 2. Counter Animation

```javascript
// In clip.js
function animate() {
    const t = window.clipTime || 0;
    
    const counters = [
        { id: 'counter-1', target: 1670000, duration: 2.0, format: 'compact' },
        { id: 'counter-2', target: 150, duration: 2.5, prefix: '$', suffix: 'B' },
        { id: 'counter-3', target: 14, duration: 1.5, suffix: ' of 20' }
    ];
    
    counters.forEach(c => {
        const el = document.getElementById(c.id);
        if (!el) return;
        const progress = Math.min(1, t / c.duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        let value = Math.round(eased * c.target);
        
        if (c.format === 'compact') {
            value = (value / 1000000).toFixed(2) + 'M';
        }
        el.textContent = (c.prefix || '') + value + (c.suffix || '');
    });
}
```

### 3. Slide-Up Items (Government Initiatives)

```javascript
// In clip.js
function animate() {
    const t = window.clipTime || 0;
    
    const items = document.querySelectorAll('.initiative-item');
    items.forEach((item, i) => {
        const delay = i * 0.3; // 0.3s between each item
        const elapsed = Math.max(0, t - delay);
        const progress = Math.min(1, elapsed / 0.8); // 0.8s slide duration
        const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        
        const translateY = 30 * (1 - eased); // Start 30px below, slide to 0
        const opacity = eased;
        
        item.style.transform = `translateY(${translateY}px)`;
        item.style.opacity = opacity;
    });
}
```

### 4. Fade-In Elements

```javascript
// In clip.js
function animate() {
    const t = window.clipTime || 0;
    
    // Fade in title after 0.5s
    const title = document.getElementById('title');
    if (title) {
        const progress = Math.min(1, Math.max(0, (t - 0.5)) / 0.5);
        title.style.opacity = progress;
    }
    
    // Fade in subtitle after 1s
    const subtitle = document.getElementById('subtitle');
    if (subtitle) {
        const progress = Math.min(1, Math.max(0, (t - 1.0)) / 0.5);
        subtitle.style.opacity = progress;
    }
}
```

### 5. Scale/Bounce Animation

```javascript
// In clip.js
function animate() {
    const t = window.clipTime || 0;
    
    const card = document.getElementById('card');
    if (!card) return;
    
    // Bounce in from 0.8 to 1.0 scale
    const progress = Math.min(1, t / 1.0);
    const eased = 1 - Math.pow(1 - progress, 3);
    const scale = 0.8 + (0.2 * eased);
    
    card.style.transform = `scale(${scale})`;
}
```

### 6. AQI Bar Chart with Labels

```javascript
// In clip.js
function animate() {
    const t = window.clipTime || 0;
    
    const bars = [
        { id: 'london', value: 42, height: 40, delay: 0 },
        { id: 'beijing', value: 150, height: 55, delay: 0.4 },
        { id: 'delhi', value: 450, height: 85, delay: 0.8 },
        { id: 'ghaziabad', value: 500, height: 95, delay: 1.2 }
    ];
    
    bars.forEach(bar => {
        const el = document.getElementById(bar.id);
        if (!el) return;
        const elapsed = Math.max(0, t - bar.delay);
        const progress = Math.min(1, elapsed / 1.0);
        const eased = 1 - Math.pow(1 - progress, 3);
        
        el.style.height = (eased * bar.height) + '%';
        
        // Show value label when bar reaches 80%
        const label = el.querySelector('.value');
        if (label) {
            label.style.opacity = progress > 0.8 ? 1 : 0;
            label.textContent = Math.round(eased * bar.value);
        }
    });
}
```

---

## 🔧 Implementation Changes

### 1. Pass clipTime to iframe (index.html)

```javascript
// In drawCanvas(), before html2canvas call
const clipTime = State.currentTime - clip.start;

// Pass time to iframe for internal animations
if (clip._htmlIframe?.contentWindow) {
    try {
        clip._htmlIframe.contentWindow.clipTime = clipTime;
        clip._htmlIframe.contentWindow.clipDuration = clip.duration;
        clip._htmlIframe.contentWindow.clipFrame = Math.round(clipTime * State.exportFps);
        clip._htmlIframe.contentWindow.clipProgress = clipTime / clip.duration;
        
        // Call animate() if it exists
        if (typeof clip._htmlIframe.contentWindow.animate === 'function') {
            clip._htmlIframe.contentWindow.animate();
        }
    } catch(e) {}
}
```

### 2. Force re-render on every frame during animation

```javascript
// If clip has JS, mark for re-render on every frame
if (clip.js && clip._htmlReady) {
    clip._htmlNeedsRefresh = true; // Force html2canvas to capture again
}
```

### 3. API Support

```javascript
// In StudioPro API
StudioPro.html(html, css, js, {
    start: 0,
    duration: 5,
    animate: true  // Enable internal animations
})
```

---

## 📁 Files to Modify

| File | Changes |
|---|---|
| `index.html` | Pass clipTime to iframe before html2canvas |
| `index.html` | Force re-render when clip has JS |
| `index.html` | Add `animate` option to HTML clip |

---

## ⏱️ Implementation Phases

### Phase 1: Core System (1 day)
- [ ] Pass `clipTime` to iframe contentWindow
- [ ] Call `animate()` function if it exists
- [ ] Force re-render on every frame when JS is present
- [ ] Test with simple counter animation

### Phase 2: Animation Helpers (1 day)
- [ ] Create `StudioPro.animate` helpers in iframe:
  - `animate.bar(element, targetPercent, duration, delay)`
  - `animate.counter(element, targetValue, duration, options)`
  - `animate.slideUp(element, delay, duration)`
  - `animate.fadeIn(element, delay, duration)`
  - `animate.scale(element, from, to, duration, delay)`
- [ ] Easing functions: easeOutCubic, easeOutBack, spring

### Phase 3: Templates & Examples (1 day)
- [ ] Update india-pollution.js with internal animations
- [ ] Create animation templates in `templates/`
- [ ] Document in `skills/html-animation-guide.md`

---

## 🧪 Testing Plan

### Test Cases

1. **Counter animation** — 0 to 1,670,000 in 2 seconds
2. **Bar chart** — 4 bars grow sequentially
3. **Slide-up items** — Government initiatives slide in from bottom
4. **Fade-in** — Title and subtitle fade in with delay
5. **Scale bounce** — Card bounces in from 0.8 to 1.0
6. **AQI chart** — Bars grow with value labels appearing
7. **Mixed animations** — Multiple types in one clip
8. **Export test** — Verify animations render correctly in video

### Expected Results

- Animations are frame-accurate (deterministic)
- No empty frames between animation states
- Smooth motion at 30fps
- Works in both preview and export

---

## 📊 Impact

| Before | After |
|---|---|
| Static HTML clips | Animated elements within clips |
| boring presentations | Dynamic, engaging videos |
| Manual keyframes needed | Auto-animated with JS |
| Limited to clip-level motion | Element-level motion |

**This makes StudioPro competitive with Remotion for complex animated presentations.**
