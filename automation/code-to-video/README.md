# Code-to-Video Automation

> Write JavaScript → Get video. No React, no build steps, no accounts.

## Quick Start

```bash
# 1. Make sure StudioPro is running
cd ../.. && npm run dev

# 2. Render a composition
node automation/code-to-video/render.js automation/code-to-video/examples/product-launch.js

# 3. Output: product-launch_ultra_30fps_ftrt_mp4.mp4
```

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

## Writing a Composition

### Option 1: Use the Composition API

```javascript
// my-video.js
module.exports = function(StudioPro, State) {
    // Load fonts
    StudioPro.fonts.loadGoogle('Poppins');

    // Create the composition
    StudioPro.createComposition({
        id: 'my-video',
        duration: 10,
        fps: 30,
        clips: [
            StudioPro.html(
                '<div class="card"><h1>Hello World</h1></div>',
                '.card { background: linear-gradient(135deg, #667eea, #764ba2); }',
                '',
                { start: 0, duration: 5, fonts: ['Poppins'] }
            ),
            StudioPro.text('Welcome', {
                start: 5,
                duration: 5,
                effects: { fontFamily: 'Poppins', fontSize: 72, fillColor: '#ffffff' }
            })
        ]
    });

    // Apply animations
    const clips = State.clips;
    if (clips[0]) {
        StudioPro.keyframes(clips[0], {
            opacity: [{ frame: 0, value: 0 }, { frame: 15, value: 100 }],
            scale: [{ frame: 0, value: 0.9 }, { frame: 15, value: 1.0 }]
        });
    }
};
```

### Option 2: Use Helper Builders

```javascript
module.exports = function(StudioPro, State) {
    // Build clips individually
    const card = StudioPro.html(
        '<div class="card">Product Launch</div>',
        '.card { background: linear-gradient(135deg, #667eea, #764ba2); }',
        '',
        { start: 0, duration: 5 }
    );

    const title = StudioPro.text('Introducing ProductX', {
        start: 2,
        duration: 5,
        effects: { fontFamily: 'Poppins', fontSize: 72 }
    });

    const logo = StudioPro.image('logo.png', {
        start: 7,
        duration: 3,
        effects: { opacity: 0 }
    });

    // Create composition with all clips
    StudioPro.createComposition({
        id: 'product-launch',
        duration: 15,
        clips: [card, title, logo]
    });
};
```

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

## CLI Options

```bash
node render.js <script.js> [output] [options]

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

## Examples

### Product Launch (15s)
```bash
node render.js examples/product-launch.js
```
Creates a 15-second product launch video with gradient cards, animated text, and CTA.

### Social Reel (10s, 9:16)
```bash
node render.js examples/social-reel.js reel.mp4 --format webm
```
Creates a 10-second vertical social media reel with quick cuts and bold text.

### Kinetic Text (12s)
```bash
node render.js examples/kinetic-text.js kinetic.mp4 --quality standard
```
Creates a 12-second kinetic typography video with spring animations.

## File Structure

```
code-to-video/
├── README.md              # This file
├── api.js                 # Node.js API wrapper (Puppeteer)
├── render.js              # CLI entry point
├── examples/              # Example compositions
│   ├── product-launch.js  # Product launch video
│   ├── social-reel.js     # Vertical social reel
│   └── kinetic-text.js    # Kinetic typography
├── templates/             # Reusable HTML/CSS/JS templates
│   └── (future: gradient-card.html, glassmorphism.html, etc.)
├── skills/                # AI agent workflow docs
│   └── (future: AGENTS.md, product-launch-video.md, etc.)
└── output/                # Rendered videos (gitignored)
```

## For AI Agents

This API is designed for AI agents to write videos programmatically:

1. **Read the request** — "Create a 10-second product launch video"
2. **Write a JS file** — Using `StudioPro.createComposition()` and `StudioPro.keyframes()`
3. **Execute it** — `node render.js my-video.js`
4. **Get the output** — MP4 file ready to share

The agent doesn't need to know about:
- React or build steps
- Canvas API or html2canvas
- MediaBunny or WebCodecs
- Puppeteer or Chrome headless

Just write JavaScript using the StudioPro API and let the automation handle the rest.
