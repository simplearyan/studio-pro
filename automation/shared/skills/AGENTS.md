# StudioPro Agent Contract

> **Read this FIRST** before writing any video code.
> This file tells you how to use StudioPro to create videos programmatically.

---

## What Is StudioPro?

StudioPro is a browser-based video editor that you can control via JavaScript API.
You write a JS file → Puppeteer executes it in the browser → Video is exported.

**No React. No build steps. No accounts. Just JavaScript → Video.**

---

## How It Works

```
You write a JS file using StudioPro API
        ↓
Run: node render.js your-file.js
        ↓
Puppeteer opens Chrome, loads StudioPro
        ↓
Executes your JS → Creates clips on timeline
        ↓
Exports video via MediaBunny (4× realtime)
        ↓
Output: MP4/WebM file
```

---

## API Reference

### Composition API — Create Entire Videos

```javascript
StudioPro.createComposition({
    id: 'my-video',           // Unique identifier
    duration: 15,             // Duration in seconds
    fps: 30,                  // Frames per second
    backgroundColor: '#000',  // Background color
    clips: [                  // Array of clips
        // ... clip definitions
    ]
});
```

### Clip Builders — Create Individual Clips

| Builder | Usage | Returns |
|---|---|---|
| `StudioPro.html(html, css, js, opts)` | HTML/CSS/JS clip | Clip definition |
| `StudioPro.text(text, opts)` | Text clip | Clip definition |
| `StudioPro.image(src, opts)` | Image clip | Clip definition |
| `StudioPro.video(src, opts)` | Video clip | Clip definition |
| `StudioPro.audio(src, opts)` | Audio clip | Clip definition |
| `StudioPro.shape(type, opts)` | Shape clip | Clip definition |

**Common Options:**
```javascript
{
    start: 0,        // Start time in seconds
    duration: 5,     // Duration in seconds
    trackId: '...',  // Optional: specific track
    title: '...',    // Optional: clip title
    effects: {       // Optional: visual effects
        opacity: 100,
        scale: 1,
        rotate: 0,
        borderRadius: 0,
        animIn: 'fade',     // Animation on enter
        animInDur: 1.0,     // Duration of enter animation
        animOut: 'fade',    // Animation on exit
        animOutDur: 1.0     // Duration of exit animation
    }
}
```

### Animation API — Frame-Level Control

```javascript
// 1. Keyframes — Per-property animation
StudioPro.keyframes(clip, {
    opacity: [
        { frame: 0, value: 0 },      // Start invisible
        { frame: 30, value: 100 }    // Fully visible at frame 30
    ],
    scale: [
        { frame: 0, value: 0.5 },    // Start small
        { frame: 30, value: 1.0 }    // Full size at frame 30
    ]
});

// 2. Interpolate — Frame → value mapping
const value = StudioPro.interpolate(frame, [0, 30], {
    from: 0,
    to: 1,
    easing: 'easeOut'  // linear, easeIn, easeOut, easeInOut, bounce, elastic, spring
});

// 3. Spring — Physics-based animation
const value = StudioPro.spring(frame, {
    from: 0,
    to: 1,
    fps: 30,
    config: { damping: 10, mass: 1, stiffness: 100 }
});
```

### Font API — Load Fonts

```javascript
// Load Google Fonts (do this BEFORE creating clips)
await StudioPro.fonts.loadGoogle('Poppins');
await StudioPro.fonts.loadGoogleBatch(['Inter', 'Roboto']);

// Reference system fonts
StudioPro.fonts.useSystem('Arial');

// List available fonts
StudioPro.fonts.list(); // { google: [...], system: [...], all: [...] }

// Generate CSS for HTML clips
StudioPro.fonts.cssImport('Poppins'); // @import url(...)
StudioPro.fonts.linkTag('Poppins');   // <link rel="stylesheet" ...>
```

---

## File Structure

```
code-to-video/
├── skills/
│   ├── AGENTS.md              # This file — read first
│   ├── product-launch.md      # Skill: marketing videos
│   ├── social-reel.md         # Skill: short-form content
│   └── kinetic-text.md        # Skill: text animations
├── templates/
│   ├── gradient-card.html     # Reusable HTML/CSS template
│   ├── glassmorphism.html
│   └── premium-gradient.html
├── examples/
│   ├── product-launch.js      # Example composition
│   ├── social-reel.js
│   └── kinetic-text.js
├── api.js                     # Node.js API wrapper
├── render.js                  # CLI entry point
└── README.md                  # Full documentation
```

---

## Workflow

### Step 1: Choose a Skill

Read the appropriate skill file based on the user's request:

| Request | Skill File |
|---|---|
| "Create a product launch video" | `product-launch.md` |
| "Create a social media reel" | `social-reel.md` |
| "Create kinetic typography" | `kinetic-text.md` |
| "Create a [specific type]" | Write your own using the API |

### Step 2: Load Fonts

```javascript
await StudioPro.fonts.loadGoogleBatch(['Poppins', 'Inter']);
```

### Step 3: Create Composition

```javascript
StudioPro.createComposition({
    id: 'my-video',
    duration: 15,
    clips: [
        StudioPro.html(html, css, js, { start: 0, duration: 5 }),
        StudioPro.text('Hello', { start: 5, duration: 5 }),
        StudioPro.audio('music.mp3', { start: 0, duration: 15, volume: 0.8 })
    ]
});
```

### Step 4: Apply Animations

```javascript
StudioPro.keyframes(clip, {
    opacity: [{ frame: 0, value: 0 }, { frame: 30, value: 100 }],
    scale: [{ frame: 0, value: 0.5 }, { frame: 30, value: 1.0 }]
});
```

### Step 5: Export

```bash
node render.js my-video.js
# Output: my-video_ultra_30fps_ftrt_mp4.mp4
```

---

## ⚠️ CRITICAL: Dev Server Setup

**ALWAYS use `npm run dev` (Vite) — NEVER use `http-server` or `npx serve`.**

| Server | CSS/Tailwind | JS Modules | Result |
|---|---|---|---|
| `npx http-server` | ❌ Raw CSS | ❌ No transforms | **Unstyled, broken UI** |
| `npx serve` | ❌ Raw CSS | ❌ No transforms | **Unstyled, broken UI** |
| `npm run dev` (Vite) | ✅ Processed | ✅ Transpiled | **Full working editor** |

**Why:** StudioPro uses Tailwind CSS and ES modules. `http-server` serves raw files without Vite's build pipeline. The editor loads but **all styles are missing** — modals overlap, layout breaks, export buttons don't work.

**Correct startup:**
```bash
cd studio-pro-editor
npm run dev  # Starts Vite on port 3000
```

**If port 3000 is occupied:**
```bash
# Kill existing process
netstat -ano | grep :3000 | findstr LISTENING
# Kill by PID from above

# Then start fresh
npm run dev
```

**Both automation scripts now have a healthcheck** that detects wrong server type and shows a clear error message:

```
❌ Wrong server! Page is NOT served by Vite.
   The page shows raw HTML without CSS/JS processing.
   This causes: broken layout, missing styles, export failures.

   Fix:
   1. Kill the current server
   2. cd studio-pro-editor && npm run dev

   NEVER use: npx http-server, npx serve
```

The healthcheck works by fetching the page HTML and checking for `@vite/client` script tag (injected by Vite). If missing, it means the server is not Vite.

---

## Rules

### Do's
- ✅ Always load fonts before creating clips
- ✅ Use `start` and `duration` in seconds (not frames)
- ✅ Use `StudioPro.keyframes()` for animations (not CSS animations)
- ✅ Keep compositions under 60 seconds for best performance
- ✅ Use `StudioPro.html()` for complex visuals (gradients, glassmorphism)
- ✅ Use `StudioPro.text()` for simple text overlays

### Don'ts
- ❌ Don't use CSS `@keyframes` for export — they're non-deterministic
- ❌ Don't use `requestAnimationFrame` for export — it's real-time only
- ❌ Don't use `Math.random()` — use deterministic values
- ❌ Don't create more than 20 clips in one composition
- ❌ Don't use external URLs for assets — use local files or data URIs

### html2canvas Rules (CRITICAL)
- ❌ **NO emojis** — html2canvas renders them as colored squares. Use CSS badges instead
- ❌ **NO CSS variables** — html2canvas doesn't support them. Use hardcoded values
- ❌ **NO complex gradients** — Use simple linear gradients only
- ❌ **NO box shadows** — Use borders instead
- ❌ **NO CSS transforms/animations** — Use StudioPro animation system
- ✅ **Simple flexbox** — Single-level only, avoid nested flex/grid
- ✅ **Wait for fonts** — Always load fonts before rendering
- ✅ **Test in canvas** — Verify rendering matches HTML editor preview
- 📖 **Full guide:** `skills/html2canvas-gotchas.md`

---

## Tips

### Timing
- **Scene 1 (Hook):** 2-3 seconds — grab attention
- **Scene 2 (Value):** 3-5 seconds — show what it does
- **Scene 3 (CTA):** 2-3 seconds — tell them what to do
- **Total:** 10-15 seconds for most videos

### Animations
- **Fade in:** `animIn: 'fade'` — safe, professional
- **Slide up:** `animIn: 'slideUp'` — dynamic, modern
- **Zoom in:** `animIn: 'zoomIn'` — dramatic
- **Spring:** Use `StudioPro.keyframes()` with spring easing for bouncy feel

### Colors
- **Dark backgrounds:** `#0a0a0f`, `#1a1a2e`, `#0b0b0f`
- **Light text:** `#ffffff`, `#f0f0f0`
- **Gradients:** Linear gradients with 2-3 colors
- **Accents:** `#667eea`, `#764ba2`, `#f093fb`

### Fonts
- **Display:** Poppins, Space Grotesk, Montserrat
- **Body:** Inter, Roboto, Open Sans
- **Mono:** Fira Code, JetBrains Mono

---

## Example — Full Video

```javascript
// my-video.js
module.exports = function(StudioPro, State) {
    // 1. Load fonts
    StudioPro.fonts.loadGoogleBatch(['Poppins', 'Inter']);

    // 2. Create composition
    StudioPro.createComposition({
        id: 'product-launch',
        duration: 15,
        clips: [
            // Scene 1: Gradient card (0-5s)
            StudioPro.html(
                '<div class="card"><h1>ProductX</h1></div>',
                '.card { background: linear-gradient(135deg, #667eea, #764ba2); }',
                '',
                { start: 0, duration: 5, fonts: ['Poppins'] }
            ),
            // Scene 2: Feature text (5-10s)
            StudioPro.text('10× Faster', {
                start: 5, duration: 5,
                effects: { fontFamily: 'Poppins', fontSize: 72 }
            }),
            // Scene 3: CTA (10-15s)
            StudioPro.html(
                '<div class="cta"><button>Get Started</button></div>',
                '.cta { background: #1a1a2e; } button { background: #667eea; }',
                '',
                { start: 10, duration: 5 }
            )
        ]
    });

    // 3. Apply animations
    StudioPro.keyframes(State.clips[0], {
        opacity: [{ frame: 0, value: 0 }, { frame: 15, value: 100 }]
    });
};
```

```bash
node render.js my-video.js
# ✅ Output: product-launch_ultra_30fps_ftrt_mp4.mp4
```
