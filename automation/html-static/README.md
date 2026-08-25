# HTML Static — Code to Video

> Write JavaScript → Get video. No React, no build steps, no accounts.
> Designed for AI agents to create videos with HTML clip compositions.

---

## Quick Start

```bash
# 1. Make sure StudioPro is running
cd ../.. && npm run dev

# 2. Render a composition
node html-static/render.js html-static/examples/product-launch.js

# 3. Output: product-launch_ultra_30fps_ftrt_mp4.mp4
```

---

## How It Works

```
JS Composition File
        ↓
   Puppeteer opens Chrome
        ↓
   Loads StudioPro app
        ↓
   Executes your JS (uses StudioPro API)
        ↓
   Creates clips on timeline
        ↓
   Exports video via MediaBunny
        ↓
   MP4/WebM file
```

---

## AI Agent Workflow

### Step 1: Read AGENTS.md

Always read `shared/skills/AGENTS.md` first. It contains:
- Full API reference
- Rules and constraints
- Workflow steps
- Tips and examples

### Step 2: Read Design Tokens

Read `templates/design-tokens.md` to know the visual style:
- Colors (primary, secondary, accent)
- Fonts (display, body)
- Spacing (unit, padding)
- Motion (easing, duration)

### Step 3: Read a Skill Doc

Read the appropriate skill based on the request:

| Request | Skill File |
|---|---|
| "Create a product launch video" | `shared/skills/product-launch.md` |
| "Create a social media reel" | `shared/skills/social-reel.md` |
| "Create kinetic typography" | `shared/skills/kinetic-text.md` |
| "Create a [specific type]" | Write your own using the API |

### Step 4: Write the Composition

```javascript
// my-video.js
module.exports = function(StudioPro, State) {
    // 1. Load fonts
    StudioPro.fonts.loadGoogleBatch(['Poppins', 'Inter']);

    // 2. Create composition
    StudioPro.createComposition({
        id: 'my-video',
        duration: 15,
        clips: [
            StudioPro.html(
                '<div class="card"><h1>Hello</h1></div>',
                '.card { background: linear-gradient(135deg, #667eea, #764ba2); }',
                '',
                { start: 0, duration: 5, fonts: ['Poppins'] }
            ),
            StudioPro.text('Welcome', {
                start: 5, duration: 5,
                effects: { fontFamily: 'Poppins', fontSize: 72, fillColor: '#ffffff' }
            })
        ]
    });

    // 3. Apply animations
    StudioPro.keyframes(State.clips[0], {
        opacity: [{ frame: 0, value: 0 }, { frame: 15, value: 100 }],
        scale: [{ frame: 0, value: 0.9 }, { frame: 15, value: 1.0 }]
    });
};
```

### Step 5: Export

```bash
node html-static/render.js my-video.js
# Output: my-video_ultra_30fps_ftrt_mp4.mp4
```

---

## API Reference

### Composition API

```javascript
StudioPro.createComposition({
    id: 'string',           // Unique ID
    duration: 15,           // Duration in seconds
    fps: 30,                // Frames per second
    backgroundColor: '#000', // Background color
    clips: [...]            // Array of clip definitions
});
```

### Clip Builders

| Builder | Usage | Options |
|---|---|---|
| `StudioPro.html(html, css, js, opts)` | HTML/CSS/JS clip | `start`, `duration`, `fonts`, `x`, `y`, `scale` |
| `StudioPro.text(text, opts)` | Text clip | `start`, `duration`, `effects: { fontFamily, fontSize, fillColor }` |
| `StudioPro.image(src, opts)` | Image clip | `start`, `duration`, `effects: { opacity, objectFit }` |
| `StudioPro.video(src, opts)` | Video clip | `start`, `duration`, `effects: { speed, volume }` |
| `StudioPro.audio(src, opts)` | Audio clip | `start`, `duration`, `effects: { volume }` |
| `StudioPro.shape(type, opts)` | Shape clip | `start`, `duration`, `effects: { fillColor, width, height }` |

### Animation API

```javascript
// Frame → value mapping
StudioPro.interpolate(frame, [startFrame, endFrame], {
    from: 0,          // Start value
    to: 1,            // End value
    easing: 'easeOut' // linear, easeIn, easeOut, easeInOut, bounce, elastic, spring
});

// Physics-based spring
StudioPro.spring(frame, {
    from: 0,
    to: 1,
    fps: 30,
    config: { damping: 10, mass: 1, stiffness: 100 }
});

// Per-property keyframes
StudioPro.keyframes(clip, {
    opacity: [
        { frame: 0, value: 0, easing: 'easeOut' },
        { frame: 30, value: 100 }
    ],
    scale: [
        { frame: 0, value: 0.5 },
        { frame: 30, value: 1.0 }
    ]
});
```

### Font API

```javascript
// Load Google Font
StudioPro.fonts.loadGoogle('Poppins');
await StudioPro.fonts.loadGoogleBatch(['Inter', 'Roboto']);

// Reference system font
StudioPro.fonts.useSystem('Arial');

// List available fonts
StudioPro.fonts.list(); // { google: [...], system: [...], all: [...] }

// Generate CSS for HTML clips
StudioPro.fonts.cssImport('Poppins'); // @import url(...)
StudioPro.fonts.linkTag('Poppins');   // <link rel="stylesheet" ...>
```

---

## CLI Options

```bash
node html-static/render.js <script.js> [output] [options]

Options:
  --quality <draft|standard|ultra>  Video quality (default: ultra)
  --format <mp4|webm>               Video format (default: mp4)
  --mode <ftrt|standard>            Render mode (default: ftrt)
  --fps <30>                        Frames per second (default: 30)
  --no-headless                     Show browser window (for debugging)
  --url <http://localhost:3000>     StudioPro URL
```

### Quality Presets

| Preset | Bitrate | Use Case |
|---|---|---|
| `draft` | 8 Mbps | Quick preview, smaller files |
| `standard` | 15 Mbps | Balanced quality/size |
| `ultra` | 30 Mbps | Highest quality, production |

### Render Modes

| Mode | Speed | Description |
|---|---|---|
| `ftrt` | 4× realtime | Fastest — frame-index loop, seek-and-capture |
| `standard` | 1× realtime | Real-time — wall-clock playback |

---

## Examples

### Product Launch (15s)
```bash
node html-static/render.js html-static/examples/product-launch.js
```
Creates a 15-second product launch video with gradient cards, animated text, and CTA.

### Social Reel (10s, 9:16)
```bash
node html-static/render.js html-static/examples/social-reel.js reel.mp4 --format webm
```
Creates a 10-second vertical social media reel with quick cuts and bold text.

### Kinetic Text (12s)
```bash
node html-static/render.js html-static/examples/kinetic-text.js kinetic.mp4 --quality standard
```
Creates a 12-second kinetic typography video with spring animations.

---

## Skills

Step-by-step workflows for specific video types (in `shared/skills/`):

| Skill | File | Duration | Style |
|---|---|---|---|
| Product Launch | `shared/skills/product-launch.md` | 10-15s | Professional, gradient |
| Social Reel | `shared/skills/social-reel.md` | 8-12s | Bold, fast-paced |
| Kinetic Text | `shared/skills/kinetic-text.md` | 10-15s | Animated typography |

Each skill contains:
- Overview of the video type
- Step-by-step workflow
- Timing guide
- Style guide (colors, fonts, animations)
- Customization tips

---

## Templates

Reusable HTML/CSS/JS assets:

| Template | File | Use Case |
|---|---|---|
| Gradient Card | `templates/gradient-card.html` | Product intros, CTAs |
| Glassmorphism | `templates/glassmorphism.html` | Modern UI cards |
| Premium Gradient | `templates/premium-gradient.html` | Wisteria mesh gradient |
| Design Tokens | `templates/design-tokens.md` | Brand style definitions |

---

## Design Tokens

Frame.md-style visual brand tokens:

```markdown
# Frame Design: Dark Modern

## Colors
- Primary: #667eea
- Secondary: #764ba2
- Background: #0a0a0f

## Fonts
- Display: Poppins (700)
- Body: Inter (400)

## Motion
- Default Easing: easeOut
- Default Duration: 0.5s
```

5 predefined token sets:
- Dark Modern
- Warm Gradient
- Cool Professional
- Minimal Light
- Premium Mesh

---

## File Structure

```
html-static/
├── README.md              # This file
├── api.js                 # Node.js API wrapper (Puppeteer)
├── render.js              # CLI entry point
│
├── templates/             # Reusable assets
│   ├── design-tokens.md   # frame.md-style visual tokens
│   ├── gradient-card.html # Gradient card template
│   ├── glassmorphism.html # Glassmorphism card template
│   └── premium-gradient.html # Wisteria mesh gradient
│
├── examples/              # Example compositions
│   ├── india-pollution.js # India pollution presentation (9 scenes)
│   ├── product-launch.js  # Product launch video
│   ├── social-reel.js     # Vertical social reel
│   ├── kinetic-text.js    # Kinetic typography
│   └── simple-test.js     # Minimal test composition
│
└── output/                # Rendered videos (gitignored)
```

**Shared resources** (in `automation/shared/`):
- `shared/skills/` — AI agent workflows (AGENTS.md, skill docs)
- `shared/tests/` — Test scripts
- `shared/skills/html2canvas-gotchas.md` — Known rendering limitations

---

## For AI Agents

This API is designed for AI agents to write videos programmatically:

1. **Read AGENTS.md** — Learn the API (`shared/skills/AGENTS.md`)
2. **Read design tokens** — Know the visual style (`templates/design-tokens.md`)
3. **Read a skill doc** — Follow the workflow (`shared/skills/product-launch.md`)
4. **Write a JS file** — Using `StudioPro.createComposition()` and `StudioPro.keyframes()`
5. **Execute it** — `node html-static/render.js my-video.js`
6. **Get the output** — MP4 file ready to share

The agent doesn't need to know about:
- React or build steps
- Canvas API or html2canvas
- MediaBunny or WebCodecs
- Puppeteer or Chrome headless

Just write JavaScript using the StudioPro API and let the automation handle the rest.

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
