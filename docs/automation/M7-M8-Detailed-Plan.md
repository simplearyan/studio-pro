# M7-M8 Detailed Plan: Composition API + Animation System

> **Date:** August 2026
> **Goal:** Let AI agents write entire videos programmatically — one API call = full video
> **Why:** Current API only creates individual clips. Agents need to write whole compositions.

---

## Why CSS/JS Animations Aren't Enough for Video

### The Problem with CSS Animations

CSS animations (`@keyframes`, `transition`) are **time-based**, not **frame-based**:

```css
/* CSS: animation runs for 1s from when element appears */
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.card { animation: fadeIn 1s ease-out; }
```

**Why this breaks video export:**

| Issue | What Happens | Video Result |
|---|---|---|
| **No frame control** | CSS animates in real-time, not per-frame | Export loop can't capture intermediate states |
| **Restart on seek** | Each frame capture restarts the animation | Frame 0 always shows start, never mid-animation |
| **Browser variance** | Chrome/Firefox render CSS differently | Export looks different across machines |
| **No seekability** | Can't jump to frame 15 of a CSS animation | scrubbing shows wrong state |
| **Not deterministic** | Same CSS ≠ same pixels every run | Preview ≠ export |

**Example of the problem:**
```
User: "Fade in text over 1 second"
CSS: animation: fadeIn 1s
Export loop: captures frame at t=0.5s → CSS thinks animation just started → shows 0% opacity
Should show: 50% opacity (halfway through fade)
```

### Why Frame-Based Animation Works

Frame-based animation is **pure math** — no browser, no CSS engine, no timing:

```javascript
// This always gives the same result for frame 15
StudioPro.interpolate(15, [0, 30], { from: 0, to: 1, easing: 'easeOut' })
// → 0.75 (always, regardless of when you call it)

// CSS animation at "frame 15" is meaningless — it's time-based
```

| Property | CSS Animation | Frame-Based Animation |
|---|---|---|
| **Control** | Time-based (1s, 2s) | Frame-based (frame 0-30) |
| **Seekability** | ❌ Can't seek to middle | ✅ Jump to any frame |
| **Determinism** | ❌ Browser variance | ✅ Same input = same output |
| **Preview=Export** | ❌ Different rendering | ✅ Identical pixels |
| **Export speed** | ❌ Must play at 1× | ✅ Can skip frames (FTRT) |
| **AI agent control** | ❌ Can't set "frame 15 = 50%" | ✅ `interpolate(15, [0,30], [0,1])` |

### Why JS Animations Aren't Enough

JS animations (`requestAnimationFrame`, `setInterval`) have the same problems:

```javascript
// This runs in real-time — can't capture per-frame
function animate() {
  element.style.opacity = elapsed / 1000;
  requestAnimationFrame(animate);
}
```

| Issue | What Happens | Video Result |
|---|---|---|
| **Real-time only** | Runs at 60fps wall-clock time | Export can't speed up or slow down |
| **No seek** | Can't jump to arbitrary frame | Scrubbing shows wrong state |
| **State depends on runtime** | `Date.now()` changes every run | Non-deterministic |
| **Can't capture mid-animation** | `drawCanvas()` at t=0.5s sees 0% because JS hasn't updated yet | Wrong frame captured |

**The key insight:** HTML clips use CSS/JS for *rendering* (what the clip looks like), but the *animation* (how it changes over time) must be controlled by the frame system.

---

## M7: Composition API — Detailed Plan

### What It Does

One API call creates an entire video:

```javascript
StudioPro.createComposition({
  id: 'product-launch',
  duration: 15,        // seconds
  fps: 30,
  width: 1920,
  height: 1080,
  backgroundColor: '#0b0b0f',
  clips: [
    { type: 'html', html: gradientCard, css: gradientCSS, start: 0, duration: 5 },
    { type: 'text', text: 'ProductX', start: 2, duration: 5,
      effects: { fontFamily: 'Poppins', fontSize: 72, fillColor: '#ffffff' } },
    { type: 'image', src: 'logo.png', start: 7, duration: 3,
      effects: { opacity: 0 } },
    { type: 'audio', src: 'music.mp3', start: 0, duration: 15, volume: 0.8 }
  ]
});
// → Creates timeline, adds all clips, sets up tracks
```

### Implementation Steps

#### Step 1: Add `createComposition()` to `window.StudioPro`

```javascript
// In index.html, extend window.StudioPro
StudioPro.createComposition = (config) => {
  // 1. Set project settings
  State.duration = config.duration || 60;
  State.fps = config.fps || 30;
  // ... width, height, backgroundColor

  // 2. Clear existing clips (optional)
  if (config.clearExisting) {
    State.clips = [];
    State.tracks = [];
  }

  // 3. Create tracks if not provided
  if (!config.tracks) {
    // Auto-create tracks based on clip types
    const videoTrack = createTrackBase('video');
    const audioTrack = createTrackBase('audio');
    State.tracks.push(videoTrack, audioTrack);
  }

  // 4. Create each clip
  const createdClips = [];
  for (const clipDef of config.clips) {
    const clip = createClipFromDefinition(clipDef);
    State.clips.push(clip);
    createdClips.push(clip);
  }

  // 5. Update UI
  needsCanvasRedraw = true;
  drawCanvas();
  renderTimeline();

  return createdClips;
};
```

#### Step 2: Add `createClipFromDefinition()` helper

```javascript
function createClipFromDefinition(def) {
  const clip = createClipBase(def.type);

  // Common properties
  if (def.start !== undefined) clip.start = def.start;
  if (def.duration !== undefined) clip.duration = def.duration;
  if (def.trackId) clip.trackId = def.trackId;

  // Type-specific properties
  switch (def.type) {
    case 'html':
      clip.html = def.html || '';
      clip.css = def.css || '';
      clip.js = def.js || '';
      clip.fonts = def.fonts || [];
      break;

    case 'text':
      clip.text = def.text || '';
      if (def.effects) {
        Object.assign(clip.effects, def.effects);
      }
      break;

    case 'image':
      clip.src = def.src || '';
      if (def.effects) {
        Object.assign(clip.effects, def.effects);
      }
      break;

    case 'audio':
      clip.src = def.src || '';
      if (def.effects) {
        Object.assign(clip.effects, def.effects);
      }
      break;

    case 'video':
      clip.src = def.src || '';
      if (def.effects) {
        Object.assign(clip.effects, def.effects);
      }
      break;

    case 'shape':
      clip.shapeType = def.shapeType || 'rect';
      if (def.effects) {
        Object.assign(clip.effects, def.effects);
      }
      break;
  }

  // Apply animation presets if provided
  if (def.animIn) clip.effects.animIn = def.animIn;
  if (def.animInDur) clip.effects.animInDur = def.animInDur;
  if (def.animOut) clip.effects.animOut = def.animOut;
  if (def.animOutDur) clip.effects.animOutDur = def.animOutDur;

  return clip;
}
```

#### Step 3: Add helper methods

```javascript
StudioPro.createComposition = (config) => { /* ... */ };

// Convenience: create a text clip
StudioPro.text = (text, options = {}) => ({
  type: 'text',
  text,
  ...options
});

// Convenience: create an HTML clip
StudioPro.html = (html, css = '', js = '', options = {}) => ({
  type: 'html',
  html, css, js,
  ...options
});

// Convenience: create an image clip
StudioPro.image = (src, options = {}) => ({
  type: 'image',
  src,
  ...options
});

// Convenience: create an audio clip
StudioPro.audio = (src, options = {}) => ({
  type: 'audio',
  src,
  ...options
});

// Convenience: create a video clip
StudioPro.video = (src, options = {}) => ({
  type: 'video',
  src,
  ...options
});

// Convenience: create a shape clip
StudioPro.shape = (shapeType = 'rect', options = {}) => ({
  type: 'shape',
  shapeType,
  ...options
});
```

### Files to Change

| File | Change |
|---|---|
| `index.html` | Add `createComposition()`, `createClipFromDefinition()`, helper methods to `window.StudioPro` |
| `automation/code-to-video/api.js` | Node.js wrapper that communicates with browser via Puppeteer |
| `automation/code-to-video/render.js` | CLI entry point: `node render.js examples/product-launch.js` |

### Usage Example

```javascript
// AI agent writes this:
StudioPro.createComposition({
  id: 'product-launch',
  duration: 15,
  clips: [
    StudioPro.html(
      '<div class="card"><h1>ProductX</h1><p>Launching Soon</p></div>',
      '.card { background: linear-gradient(135deg, #667eea, #764ba2); }',
      '',
      { start: 0, duration: 5, fonts: ['Poppins'] }
    ),
    StudioPro.text('The Future of Productivity', {
      start: 2,
      duration: 5,
      effects: { fontFamily: 'Poppins', fontSize: 72, fillColor: '#ffffff' }
    }),
    StudioPro.image('logo.png', {
      start: 7,
      duration: 3,
      effects: { opacity: 0 }
    }),
    StudioPro.audio('music.mp3', {
      start: 0,
      duration: 15,
      volume: 0.8
    })
  ]
});
```

---

## M8: Animation System — Detailed Plan

### What It Does

Frame-level animation control — the math that makes videos feel polished.

### Why It's Needed (Even With CSS/JS)

HTML clips use CSS for *rendering* (what they look like at a moment), but the *animation over time* must be controlled by the frame system:

```
Frame 0:  clip starts → opacity 0%
Frame 15: clip mid → opacity 50%  ← frame system calculates this
Frame 30: clip ends → opacity 100%
```

CSS can't do this because:
1. CSS animations are **time-based** (1s, 2s) — not frame-based
2. CSS can't be **seeked** — you can't jump to "50% through the animation"
3. CSS is **non-deterministic** — same code can render differently across browsers
4. CSS animations **restart on each capture** — the export loop captures the same first frame every time

**The solution:** The frame system controls animation timing, CSS/JS controls rendering.

### The API

#### `StudioPro.interpolate()`

Maps a frame to a value within a range:

```javascript
// Basic usage
const opacity = StudioPro.interpolate(frame, [0, 30], { from: 0, to: 1 });
// frame 0 → 0, frame 15 → 0.5, frame 30 → 1.0

// With easing
const scale = StudioPro.interpolate(frame, [0, 30], {
  from: 0.5,
  to: 1.0,
  easing: 'easeOut'
});
// Uses easeOut curve — starts fast, ends slow

// With extrapolation
const value = StudioPro.interpolate(frame, [0, 30], {
  from: 0,
  to: 1,
  extrapolateLeft: 'clamp',  // before frame 0 → stay at 0
  extrapolateRight: 'clamp'  // after frame 30 → stay at 1
});
```

**Implementation:**

```javascript
StudioPro.interpolate = (frame, inputRange, config) => {
  const { from, to, easing = 'linear', extrapolateLeft = 'extend', extrapolateRight = 'extend' } = config;

  // Handle extrapolation
  if (frame < inputRange[0]) {
    if (extrapolateLeft === 'clamp') return from;
    // Extend: continue the trend
  }
  if (frame > inputRange[1]) {
    if (extrapolateRight === 'clamp') return to;
    // Extend: continue the trend
  }

  // Normalize frame to 0-1
  const progress = (frame - inputRange[0]) / (inputRange[1] - inputRange[0]);

  // Apply easing
  const easedProgress = applyEasing(progress, easing);

  // Interpolate
  return from + (to - from) * easedProgress;
};

// Easing functions
function applyEasing(t, easing) {
  switch (easing) {
    case 'linear': return t;
    case 'easeIn': return t * t;
    case 'easeOut': return t * (2 - t);
    case 'easeInOut': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    case 'spring': return 1 - Math.cos(t * Math.PI * 0.5);
    default: return t;
  }
}
```

#### `StudioPro.spring()`

Physics-based animation — natural, bouncy motion:

```javascript
const scale = StudioPro.spring(frame, {
  from: 0,
  to: 1,
  fps: 30,
  config: {
    damping: 10,    // How much the spring resists
    mass: 1,        // How heavy the object is
    stiffness: 100  // How stiff the spring is
  }
});
```

**Implementation:**

```javascript
StudioPro.spring = (frame, config) => {
  const { from, to, fps = 30, config: springConfig = {} } = config;
  const { damping = 10, mass = 1, stiffness = 100 } = springConfig;

  const t = frame / fps; // Convert frames to seconds

  // Spring physics formula
  const omega = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));

  let value;
  if (zeta < 1) {
    // Underdamped (bouncy)
    const omegaD = omega * Math.sqrt(1 - zeta * zeta);
    value = 1 - Math.exp(-zeta * omega * t) * (
      Math.cos(omegaD * t) + (zeta * omega / omegaD) * Math.sin(omegaD * t)
    );
  } else {
    // Critically damped or overdamped
    value = 1 - (1 + omega * t) * Math.exp(-omega * t);
  }

  return from + (to - from) * value;
};
```

#### `StudioPro.keyframes()`

Per-property keyframe animation:

```javascript
StudioPro.keyframes(clip, {
  opacity: [
    { frame: 0, value: 0 },
    { frame: 30, value: 1 }
  ],
  scale: [
    { frame: 0, value: 0.5 },
    { frame: 15, value: 1.2 },
    { frame: 30, value: 1.0 }
  ],
  rotation: [
    { frame: 0, value: 0 },
    { frame: 30, value: 360 }
  ]
});
```

### How It Integrates With HTML Clips

The animation system controls *when* things happen, CSS/JS controls *what* they look like:

```javascript
// AI agent writes:
StudioPro.createComposition({
  clips: [
    StudioPro.html(
      '<div class="card">Hello</div>',
      '.card { background: linear-gradient(135deg, #667eea, #764ba2); }',
      '',
      { start: 0, duration: 5 }
    )
  ]
});

// Then applies animation:
const clip = State.clips[0];
StudioPro.keyframes(clip, {
  opacity: [
    { frame: 0, value: 0 },    // Start invisible
    { frame: 30, value: 1 }    // Fully visible at frame 30
  ],
  scale: [
    { frame: 0, value: 0.5 },  // Start small
    { frame: 30, value: 1.0 }  // Full size at frame 30
  ]
});
```

**What happens during export:**
1. Export loop sets `State.currentTime = frame / fps`
2. `drawCanvas()` calls `calculateAnimationState(clip, ...)` 
3. `calculateAnimationState()` uses the keyframes to compute opacity/scale for this frame
4. html2canvas renders the HTML clip with the computed opacity/scale
5. Frame is captured

**What happens with CSS animations inside the clip:**
```html
<!-- This CSS animation is for preview only — export captures a single frame -->
<style>
  @keyframes glow { from { filter: brightness(1); } to { filter: brightness(1.5); } }
  .card { animation: glow 2s infinite; }
</style>
<div class="card">Hello</div>
```

The CSS glow animation runs in the browser preview, but during export:
1. Each frame capture is a **single snapshot** (html2canvas captures current state)
2. The CSS animation is at whatever point it happens to be when the frame is captured
3. **This is non-deterministic** — different exports may capture different points in the CSS animation

**The solution:** Use `StudioPro.keyframes()` for animation, CSS for rendering:

```javascript
// Instead of CSS animation:
StudioPro.keyframes(clip, {
  filter: [
    { frame: 0, value: 'brightness(1)' },
    { frame: 30, value: 'brightness(1.5)' }
  ]
});
```

### Files to Change

| File | Change |
|---|---|
| `index.html` | Add `interpolate()`, `spring()`, `keyframes()`, `applyEasing()` to `window.StudioPro` |
| `index.html` | Update `calculateAnimationState()` to use new keyframes if present |
| `automation/code-to-video/api.js` | Node.js wrapper for animation methods |

### Usage Example — Full Video With Animation

```javascript
StudioPro.createComposition({
  id: 'animated-product',
  duration: 15,
  clips: [
    // HTML card with animated entrance
    StudioPro.html(
      '<div class="card"><h1>ProductX</h1></div>',
      '.card { background: linear-gradient(135deg, #667eea, #764ba2); }',
      '',
      { start: 0, duration: 5, fonts: ['Poppins'] }
    ),
    // Text with spring animation
    StudioPro.text('Launching Soon', {
      start: 2,
      duration: 5,
      effects: { fontFamily: 'Poppins', fontSize: 72, fillColor: '#ffffff' }
    })
  ]
});

// Apply animations
const htmlClip = State.clips[0];
StudioPro.keyframes(htmlClip, {
  opacity: [
    { frame: 0, value: 0 },
    { frame: 30, value: 1 }
  ],
  scale: [
    { frame: 0, value: 0.5 },
    { frame: 30, value: 1.0, easing: 'easeOut' }
  ]
});

const textClip = State.clips[1];
const textSpring = StudioPro.spring(30, { from: 0, to: 1, config: { damping: 10 } });
// textClip.effects.scale = textSpring at frame 30
```

---

## Summary: M7 + M8 Together

| Feature | What It Does | Why It's Needed |
|---|---|---|
| **M7: `createComposition()`** | One call = full video with all clips | Agents write entire videos, not individual clips |
| **M8: `interpolate()`** | Frame → value mapping | Frame-level animation control |
| **M8: `spring()`** | Physics-based animation | Natural, bouncy motion |
| **M8: `keyframes()`** | Per-property keyframe animation | Complex multi-property animations |

**The key insight:** CSS/JS animations are for *preview* (what the user sees while editing). Frame-based animation is for *export* (what the video actually contains). The animation system bridges the two — it controls timing, CSS/JS controls rendering.

**Without M8:** HTML clips look good in preview but export shows wrong animation state.
**With M8:** HTML clips animate correctly in both preview and export — frame-perfect, deterministic, 4× realtime.
