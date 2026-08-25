# Skill: Social Media Reel

> **When to use:** User asks for a short-form social media video, TikTok, Reel, or Story
> **Duration:** 8-15 seconds
> **Style:** Bold, fast-paced, vertical (9:16)

---

## Overview

A social reel has 3 quick scenes:
1. **Hook** (0-3s) — Grab attention FAST with bold text
2. **Value** (3-8s) — Show the main point quickly
3. **CTA** (8-12s) — Tell them what to do

---

## Step-by-Step Workflow

### Step 1: Load Fonts

```javascript
StudioPro.fonts.loadGoogle('Montserrat');
```

### Step 2: Create Vertical Composition

```javascript
StudioPro.createComposition({
    id: 'social-reel',
    duration: 10,
    backgroundColor: '#000000',
    clips: [
        // Scene 1: Hook (0-3s)
        StudioPro.html(
            `<div class="hook">
                <h1>${hookText}</h1>
            </div>`,
            `.hook {
                background: linear-gradient(135deg, #ff6b6b 0%, #ffa500 100%);
                width: 100%; height: 100%;
                display: flex; justify-content: center; align-items: center;
                font-family: 'Montserrat', sans-serif;
            }
            .hook h1 {
                color: white; font-size: 120px; font-weight: 900;
                text-transform: uppercase; text-align: center;
                text-shadow: 4px 4px 0px rgba(0,0,0,0.3);
            }`,
            '',
            { start: 0, duration: 3, fonts: ['Montserrat'] }
        ),

        // Scene 2: Value (3-8s)
        StudioPro.text(valueText, {
            start: 3, duration: 5,
            effects: {
                fontFamily: 'Montserrat', fontSize: 72,
                fillColor: '#ffffff', textAlign: 'center',
                animIn: 'slideUp', animInDur: 0.5
            }
        }),

        // Scene 3: CTA (8-12s)
        StudioPro.html(
            `<div class="cta">
                <div class="arrow">↓</div>
                <h2>${ctaText}</h2>
            </div>`,
            `.cta {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                width: 100%; height: 100%;
                display: flex; flex-direction: column;
                justify-content: center; align-items: center;
                font-family: 'Montserrat', sans-serif;
            }
            .arrow { font-size: 120px; color: white; margin-bottom: 40px; }
            .cta h2 { color: white; font-size: 96px; font-weight: 900; text-transform: uppercase; }`,
            '',
            { start: 8, duration: 4, fonts: ['Montserrat'] }
        )
    ]
});
```

### Step 3: Apply Animations

```javascript
const clips = State.clips;

// Scene 1: Scale zoom
StudioPro.keyframes(clips[0], {
    scale: [{ frame: 0, value: 1.2 }, { frame: 30, value: 1.0, easing: 'easeOut' }]
});

// Scene 2: Already has slideUp animation
// Scene 3: Fade in
StudioPro.keyframes(clips[2], {
    opacity: [{ frame: 0, value: 0 }, { frame: 15, value: 100 }]
});
```

### Step 4: Export

```bash
node render.js my-reel.js
```

---

## Timing Guide

| Scene | Duration | What |
|---|---|---|
| Hook | 2-3s | Bold text, grab attention |
| Value | 3-5s | Main point, quick |
| CTA | 2-3s | Call to action |
| **Total** | **8-12s** | |

---

## Style Guide

### Colors
- **Hook:** Warm gradient `#ff6b6b → #ffa500`
- **Value:** Dark bg `#000000`
- **CTA:** Cool gradient `#667eea → #764ba2`

### Fonts
- **Display:** Montserrat (800, 900)
- **Body:** Inter (400, 600)

### Animations
- **Scene 1:** Scale zoom (1.2 → 1.0)
- **Scene 2:** Slide up
- **Scene 3:** Fade in

---

## Customization

### Change Hook Text
Replace `${hookText}` with attention-grabbing text.

### Change Aspect Ratio
For horizontal (16:9), change the composition dimensions:
```javascript
StudioPro.createComposition({
    // ... no special config needed, default is 16:9
});
```

### Add Music
```javascript
StudioPro.audio('beat.mp3', { start: 0, duration: 10, volume: 0.9 })
```

---

## Example Output

```
social-reel_ultra_30fps_ftrt_mp4.mp4
├── Duration: 10 seconds
├── Resolution: 1920×1080 (or 1080×1920 for vertical)
├── Quality: 30 Mbps (ultra)
├── Format: MP4
└── Render time: ~3 seconds (4× realtime)
```
