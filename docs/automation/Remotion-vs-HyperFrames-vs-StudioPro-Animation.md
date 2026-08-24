# Remotion vs HyperFrames vs StudioPro — Animation Comparison

> How each system animates individual HTML elements. Which approach is best for AI agents?

---

## 📊 Quick Comparison

| Feature | Remotion | HyperFrames | StudioPro (Ours) |
|---|---|---|---|
| **Language** | React (JSX) | Plain HTML/CSS/JS | Plain HTML/CSS/JS |
| **Animation Engine** | React re-render | GSAP timeline | iframe + html2canvas |
| **How it works** | Component re-renders every frame | GSAP seeks to time | JS sets CSS, html2canvas captures |
| **Frame control** | `useCurrentFrame()` | `window.__hf.seek(t)` | `window.clipTime = t` |
| **Element animation** | Per-element style via frame | GSAP per-element tweens | JS sets CSS per frame |
| **Determinism** | ✅ React is deterministic | ✅ GSAP seek is deterministic | ⚠️ html2canvas capture timing |
| **Complexity** | High (React + build) | Medium (GSAP + HTML) | Low (just HTML) |
| **AI Agent Friendly** | ❌ React is hard for agents | ✅ HTML is easy | ✅ HTML is easy |
| **Internal Animations** | ✅ Native | ✅ GSAP timelines | 🔧 Being added |

---

## 🎬 Remotion Approach

### How It Works

```jsx
// Remotion: React component re-renders every frame
const MyVideo = () => {
    const frame = useCurrentFrame(); // Current frame number
    
    // Animate bar chart
    const bar1Width = interpolate(frame, [0, 60], [0, 35]); // 0% to 35% over 60 frames
    const bar2Width = interpolate(frame, [20, 80], [0, 28]); // Delayed start
    
    // Animate counter
    const counterValue = interpolate(frame, [0, 90], [0, 1670000]);
    
    // Animate slide-up
    const slideY = interpolate(frame, [30, 60], [30, 0], { extrapolateRight: 'clamp' });
    
    return (
        <div className="slide">
            <div className="bar" style={{ width: bar1Width + '%' }} />
            <div className="bar" style={{ width: bar2Width + '%' }} />
            <div className="counter">{Math.round(counterValue).toLocaleString()}</div>
            <div className="item" style={{ transform: `translateY(${slideY}px)` }}>
                Government Initiative
            </div>
        </div>
    );
};
```

### Key Concepts

1. **`useCurrentFrame()`** — Returns current frame number (0, 1, 2, ...)
2. **`interpolate(frame, inputRange, outputRange)`** — Maps frame to value
3. **`spring({ fps, frame })`** — Physics-based animation
4. **React re-render** — Component re-renders on EVERY frame
5. **Style injection** — CSS properties set via `style={{}}` on every frame

### Pros
- ✅ **Deterministic** — Same frame = same output
- ✅ **Frame-accurate** — Every element animated per-frame
- ✅ **Native React** — Full React ecosystem
- ✅ **Great tooling** — Studio, CLI, preview

### Cons
- ❌ **React required** — Must learn React, JSX, components
- ❌ **Build step** — Needs webpack/vite bundling
- ❌ **Not HTML** — Can't write plain HTML
- ❌ **Hard for AI agents** — React is complex for LLMs

---

## 🎬 HyperFrames Approach

### How It Works

```html
<!-- HyperFrames: Plain HTML with data attributes -->
<div class="clip" data-duration="5">
    <div class="bar" id="bar1"></div>
    <div class="counter" id="counter1"></div>
</div>

<script>
// HyperFrames exposes a seek function
window.__hf = {
    duration: 5,
    seek: (timeSeconds) => {
        // Animate bar chart
        const bar1 = document.getElementById('bar1');
        const progress1 = Math.min(1, timeSeconds / 2.0);
        bar1.style.width = (progress1 * 35) + '%';
        
        // Animate counter
        const counter = document.getElementById('counter1');
        const progress2 = Math.min(1, timeSeconds / 3.0);
        counter.textContent = Math.round(progress2 * 1670000).toLocaleString();
    }
};
</script>
```

### Key Concepts

1. **`window.__hf.seek(time)`** — Renderer calls this for each frame
2. **GSAP timelines** — Animation library (default)
3. **Data attributes** — `data-duration`, `data-clip` for structure
4. **Frame adapter** — Pluggable animation runtime (GSAP, Lottie, CSS, WAAPI)
5. **Deterministic Chrome** — Special flags for pixel-perfect capture

### How HyperFrames Renders

```
1. Renderer calls window.__hf.seek(0)    → Screenshot frame 0
2. Renderer calls window.__hf.seek(1/30) → Screenshot frame 1
3. Renderer calls window.__hf.seek(2/30) → Screenshot frame 2
...
300. Renderer calls window.__hf.seek(10) → Screenshot frame 300

Total: 300 frames for 10s at 30fps
```

### Pros
- ✅ **Plain HTML** — No React, no build step
- ✅ **AI agent friendly** — LLMs write HTML easily
- ✅ **GSAP powered** — Industry-standard animation
- ✅ **Deterministic** — Special Chrome flags for pixel-perfect
- ✅ **Frame-accurate** — Seek-based, not time-based

### Cons
- ❌ **GSAP required** — Must learn GSAP API
- ❌ **Complex Chrome** — Needs special flags for determinism
- ❌ **No visual editor** — Code-only workflow
- ❌ **Linux only** — Deterministic mode only works on Linux

---

## 🎬 StudioPro Approach (Ours)

### How It Works

```html
<!-- StudioPro: Plain HTML/CSS/JS in iframe -->
<div class="slide">
    <div class="bar" id="bar1"></div>
    <div class="counter" id="counter1"></div>
</div>

<script>
// JS runs in iframe, reads clipTime
function animate() {
    const t = window.clipTime || 0;
    
    // Animate bar chart
    const bar1 = document.getElementById('bar1');
    const progress1 = Math.min(1, t / 2.0);
    bar1.style.width = (progress1 * 35) + '%';
    
    // Animate counter
    const counter = document.getElementById('counter1');
    const progress2 = Math.min(1, t / 3.0);
    counter.textContent = Math.round(progress2 * 1670000).toLocaleString();
}

animate(); // Run on every frame
</script>
```

### Key Concepts

1. **iframe** — HTML/CSS/JS runs in offscreen iframe
2. **`window.clipTime`** — Current time passed to iframe
3. **`html2canvas`** — Captures iframe to canvas
4. **`animate()` function** — User-defined animation logic
5. **Frame-based** — Sets CSS properties based on time

### How StudioPro Renders

```
1. drawCanvas() runs at 30fps
2. For each HTML clip:
   a. Set iframe.clipTime = currentTime - clip.start
   b. Call iframe.animate() → sets CSS properties
   c. html2canvas captures iframe → canvas
   d. Draw canvas onto main canvas
```

### Pros
- ✅ **Plain HTML** — No React, no build step
- ✅ **AI agent friendly** — LLMs write HTML easily
- ✅ **Visual editor** — GUI for editing clips
- ✅ **Simple architecture** — iframe + html2canvas
- ✅ **No dependencies** — No GSAP, no React

### Cons
- ❌ **html2canvas limitations** — Some CSS doesn't render
- ❌ **Performance** — html2canvas is slower than native
- ❌ **Not pixel-perfect** — html2canvas has rendering differences
- ❌ **No GSAP** — Must write animation logic manually

---

## 🔍 Deep Comparison

### 1. How Each Animates a Bar Chart

#### Remotion
```jsx
const frame = useCurrentFrame();
const barWidth = interpolate(frame, [0, 60], [0, 35]);
return <div className="bar" style={{ width: barWidth + '%' }} />;
```
**Mechanism:** React re-renders component, sets style prop.

#### HyperFrames
```javascript
window.__hf = {
    seek: (t) => {
        const progress = Math.min(1, t / 2.0);
        document.getElementById('bar1').style.width = (progress * 35) + '%';
    }
};
```
**Mechanism:** Renderer calls seek(), GSAP or JS sets CSS.

#### StudioPro
```javascript
function animate() {
    const t = window.clipTime || 0;
    const progress = Math.min(1, t / 2.0);
    document.getElementById('bar1').style.width = (progress * 35) + '%';
}
```
**Mechanism:** drawCanvas() sets clipTime, calls animate(), html2canvas captures.

### 2. How Each Handles Transitions

#### Remotion
```jsx
// Fade between clips
const opacity = interpolate(frame, [55, 65], [1, 0]); // Fade out
return <div style={{ opacity }}>{content}</div>;
```
**Mechanism:** Interpolate opacity based on frame.

#### HyperFrames
```css
/* CSS-driven transitions between clips */
.clip {
    animation: fadeIn 0.5s ease-in-out;
}
```
**Mechanism:** CSS animations + GSAP timelines.

#### StudioPro
```javascript
// Crossfade between clips
if (inTransition) {
    ctx.globalAlpha = 1 - transProgress;
    drawHtmlClip(ctx, currentClip);
    ctx.globalAlpha = transProgress;
    drawHtmlClip(ctx, nextClip);
}
```
**Mechanism:** Canvas compositing with globalAlpha.

### 3. Determinism Comparison

| System | Deterministic? | How? |
|---|---|---|
| **Remotion** | ✅ Yes | React re-renders same component for same frame |
| **HyperFrames** | ✅ Yes | GSAP seek + special Chrome flags |
| **StudioPro** | ⚠️ Partial | html2canvas capture timing varies |

**Why StudioPro is partial:** html2canvas doesn't guarantee pixel-perfect capture at the exact moment CSS is set. There's a small timing gap between setting CSS and capturing.

---

## 🏆 Which Is Better?

### For AI Agents

| Criteria | Winner | Why |
|---|---|---|
| **Ease of writing** | 🥇 HyperFrames | Plain HTML, no build step |
| **Ease of learning** | 🥇 StudioPro | No GSAP, just JS |
| **Animation power** | 🥇 Remotion | Full React ecosystem |
| **Visual editor** | 🥇 StudioPro | GUI for editing |
| **Determinism** | 🥇 Remotion | Perfect frame accuracy |
| **No dependencies** | 🥇 StudioPro | No GSAP, no React |

### For Video Quality

| Criteria | Winner | Why |
|---|---|---|
| **Pixel accuracy** | 🥇 HyperFrames | Special Chrome flags |
| **Animation smoothness** | 🥇 Remotion | React + interpolate |
| **Complex animations** | 🥇 Remotion | Full control |
| **Simple animations** | 🥇 StudioPro | Just set CSS |

### For Production

| Criteria | Winner | Why |
|---|---|---|
| **Scalability** | 🥇 Remotion | Cloud rendering |
| **Reliability** | 🥇 HyperFrames | Deterministic Chrome |
| **Accessibility** | 🥇 StudioPro | Visual editor + code |

---

## 🎯 Our Advantage

**StudioPro has unique advantages neither Remotion nor HyperFrames have:**

1. **Visual Editor** — Users can edit clips in a GUI
2. **No Dependencies** — No React, no GSAP, no build step
3. **Hybrid Workflow** — Code for agents, GUI for humans
4. **Timeline Integration** — Clips on tracks, drag to reorder
5. **Multiple Clip Types** — HTML, text, image, video, audio

**What we need to add:**

1. **Better determinism** — Pass clipTime before capture (Phase 3)
2. **GSAP support** — Optional for complex animations
3. **Transition system** — Fade/slide between clips (Phase 5)
4. **Pre-rendering** — Fix empty frames (Phase 1)

---

## 📋 Recommended Approach

### Keep Our Architecture (iframe + html2canvas)

**Why:**
- Simple for AI agents to write
- Works with visual editor
- No dependencies needed

### Add These Improvements

1. **Pass clipTime before capture** — Enables frame-based animations
2. **Call animate() function** — User-defined animation logic
3. **Pre-render clips** — Fix empty frames
4. **Add GSAP adapter** — Optional for complex animations

### Example: Animated India Pollution (Our Way)

```javascript
// In clip.js
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
}
```

**This is simpler than Remotion (no React) and simpler than HyperFrames (no GSAP).**

---

## 📚 References

| System | Docs |
|---|---|
| Remotion | https://www.remotion.dev/docs/animating-properties |
| HyperFrames | https://github.com/heygen-com/hyperframes |
| StudioPro | `docs/automation/HTML-Clip-Internal-Animations-Plan.md` |
