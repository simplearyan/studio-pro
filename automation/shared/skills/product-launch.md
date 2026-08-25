# Skill: Product Launch Video

> **When to use:** User asks for a product launch, announcement, or marketing video
> **Duration:** 10-15 seconds
> **Style:** Professional, clean, gradient backgrounds

---

## Overview

A product launch video has 3 scenes:
1. **Hook** (0-5s) — Grab attention with gradient card + product name
2. **Value** (5-10s) — Show the main benefit with animated text
3. **CTA** (10-15s) — Tell them what to do next

---

## Step-by-Step Workflow

### Step 1: Load Fonts

```javascript
StudioPro.fonts.loadGoogleBatch(['Poppins', 'Inter']);
```

### Step 2: Create Composition

```javascript
StudioPro.createComposition({
    id: 'product-launch',
    duration: 15,
    backgroundColor: '#0b0b0f',
    clips: [
        // Scene 1: Hook
        StudioPro.html(
            `<div class="hook">
                <div class="badge">NEW</div>
                <h1>${productName}</h1>
                <p class="tagline">${tagline}</p>
            </div>`,
            `.hook {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 80px;
                border-radius: 24px;
                text-align: center;
                width: 100%; height: 100%;
                display: flex; flex-direction: column;
                justify-content: center; align-items: center;
                font-family: 'Poppins', sans-serif;
            }
            .badge { background: rgba(255,255,255,0.2); color: white;
                     padding: 8px 24px; border-radius: 100px;
                     font-size: 24px; font-weight: 600; letter-spacing: 2px; }
            .hook h1 { color: white; font-size: 96px; font-weight: 700; margin: 0 0 20px 0; }
            .tagline { color: rgba(255,255,255,0.85); font-size: 36px; }`,
            '',
            { start: 0, duration: 5, fonts: ['Poppins'] }
        ),

        // Scene 2: Value proposition
        StudioPro.text(valueProposition, {
            start: 5, duration: 5,
            effects: {
                fontFamily: 'Poppins', fontSize: 84,
                fillColor: '#ffffff', textAlign: 'center',
                animIn: 'fade', animInDur: 1.0
            }
        }),

        // Scene 3: CTA
        StudioPro.html(
            `<div class="cta">
                <h2>${ctaTitle}</h2>
                <button>${ctaText}</button>
            </div>`,
            `.cta {
                background: #1a1a2e;
                padding: 100px;
                border-radius: 24px;
                text-align: center;
                width: 100%; height: 100%;
                display: flex; flex-direction: column;
                justify-content: center; align-items: center;
                font-family: 'Poppins', sans-serif;
            }
            .cta h2 { color: white; font-size: 72px; margin: 0 0 40px 0; }
            .cta button { background: linear-gradient(135deg, #667eea, #764ba2);
                          color: white; border: none; padding: 24px 64px;
                          border-radius: 100px; font-size: 32px; font-weight: 600; }`,
            '',
            { start: 10, duration: 5, fonts: ['Poppins'] }
        )
    ]
});
```

### Step 3: Apply Animations

```javascript
const clips = State.clips;

// Scene 1: Fade in + scale
StudioPro.keyframes(clips[0], {
    opacity: [{ frame: 0, value: 0 }, { frame: 15, value: 100 }],
    scale: [{ frame: 0, value: 0.9 }, { frame: 15, value: 1.0, easing: 'easeOut' }]
});

// Scene 2: Spring scale
StudioPro.keyframes(clips[1], {
    scale: [{ frame: 0, value: 0.5 }, { frame: 30, value: 1.0, easing: 'easeOut' }]
});

// Scene 3: Fade in + slide up
StudioPro.keyframes(clips[2], {
    opacity: [{ frame: 0, value: 0 }, { frame: 20, value: 100 }],
    y: [{ frame: 0, value: 5 }, { frame: 20, value: 0, easing: 'easeOut' }]
});
```

### Step 4: Export

```bash
node render.js my-product-launch.js
```

---

## Timing Guide

| Scene | Duration | What |
|---|---|---|
| Hook | 3-5s | Product name + gradient card |
| Value | 3-5s | Main benefit text |
| CTA | 2-3s | Call to action |
| **Total** | **10-15s** | |

---

## Style Guide

### Colors
- **Gradient:** `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
- **Dark bg:** `#0b0b0f`, `#1a1a2e`
- **Text:** `#ffffff`
- **Accent:** `#667eea`, `#764ba2`

### Fonts
- **Display:** Poppins (700, 900)
- **Body:** Inter (400, 600)

### Animations
- **Scene 1:** Fade in + scale (0.9 → 1.0)
- **Scene 2:** Spring scale (0.5 → 1.0)
- **Scene 3:** Fade in + slide up

---

## Customization

### Change Product Name
Replace `${productName}` with the actual product name.

### Change Colors
Update the gradient colors in the CSS.

### Change Timing
Adjust `start` and `duration` values in clip definitions.

### Add Music
```javascript
StudioPro.audio('music.mp3', { start: 0, duration: 15, volume: 0.8 })
```

---

## Example Output

```
product-launch_ultra_30fps_ftrt_mp4.mp4
├── Duration: 15 seconds
├── Resolution: 1920×1080
├── Quality: 30 Mbps (ultra)
├── Format: MP4
└── Render time: ~4 seconds (4× realtime)
```
