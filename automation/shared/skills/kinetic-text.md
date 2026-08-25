# Skill: Kinetic Typography

> **When to use:** User asks for animated text, kinetic type, or text-focused video
> **Duration:** 10-15 seconds
> **Style:** Bold text, spring animations, dark background

---

## Overview

Kinetic typography has 3-5 words that animate in sequence:
1. **Word 1** (0-3s) — First word with spring animation
2. **Word 2** (2-5s) — Second word, staggered
3. **Word 3** (4-7s) — Third word, different color
4. **Tagline** (7-12s) — Final message

---

## Step-by-Step Workflow

### Step 1: Load Fonts

```javascript
StudioPro.fonts.loadGoogleBatch(['Space Grotesk', 'Inter']);
```

### Step 2: Create Composition

```javascript
StudioPro.createComposition({
    id: 'kinetic-text',
    duration: 12,
    backgroundColor: '#0a0a0f',
    clips: [
        // Word 1
        StudioPro.text(word1, {
            start: 0, duration: 3,
            effects: {
                fontFamily: 'Space Grotesk', fontSize: 144,
                fillColor: '#667eea', textAlign: 'center'
            }
        }),

        // Word 2
        StudioPro.text(word2, {
            start: 2, duration: 3,
            effects: {
                fontFamily: 'Space Grotesk', fontSize: 144,
                fillColor: '#764ba2', textAlign: 'center',
                animIn: 'slideUp', animInDur: 0.6
            }
        }),

        // Word 3
        StudioPro.text(word3, {
            start: 4, duration: 3,
            effects: {
                fontFamily: 'Space Grotesk', fontSize: 144,
                fillColor: '#f093fb', textAlign: 'center',
                animIn: 'pop', animInDur: 0.5
            }
        }),

        // Tagline
        StudioPro.html(
            `<div class="tagline">
                <span class="word">${taglineWord1}</span>
                <span class="word">${taglineWord2}</span>
                <span class="word">${taglineWord3}</span>
            </div>`,
            `.tagline {
                width: 100%; height: 100%;
                display: flex; justify-content: center; align-items: center;
                gap: 40px; font-family: 'Space Grotesk', sans-serif;
                background: #0a0a0f;
            }
            .word { font-size: 80px; font-weight: 700; color: white; }
            .word:nth-child(1) { color: #667eea; }
            .word:nth-child(2) { color: #764ba2; }
            .word:nth-child(3) { color: #f093fb; }`,
            '',
            { start: 7, duration: 5, fonts: ['Space Grotesk'] }
        )
    ]
});
```

### Step 3: Apply Animations

```javascript
const clips = State.clips;

// Word 1: Spring scale + rotation
StudioPro.keyframes(clips[0], {
    scale: [{ frame: 0, value: 0 }, { frame: 20, value: 1.0, easing: 'easeOut' }],
    rotation: [{ frame: 0, value: -10 }, { frame: 20, value: 0, easing: 'easeOut' }]
});

// Word 2: Slide up + fade
StudioPro.keyframes(clips[1], {
    y: [{ frame: 0, value: 10 }, { frame: 18, value: 0, easing: 'easeOut' }],
    opacity: [{ frame: 0, value: 0 }, { frame: 15, value: 100 }]
});

// Word 3: Pop scale
StudioPro.keyframes(clips[2], {
    scale: [
        { frame: 0, value: 0 },
        { frame: 10, value: 1.3 },
        { frame: 15, value: 1.0, easing: 'easeOut' }
    ]
});
```

### Step 4: Export

```bash
node render.js my-kinetic-text.js
```

---

## Timing Guide

| Element | Duration | Animation |
|---|---|---|
| Word 1 | 3s | Spring scale + rotation |
| Word 2 | 3s | Slide up + fade |
| Word 3 | 3s | Pop scale |
| Tagline | 5s | Fade in |
| **Total** | **12s** | |

---

## Style Guide

### Colors
- **Background:** `#0a0a0f` (near black)
- **Word 1:** `#667eea` (blue)
- **Word 2:** `#764ba2` (purple)
- **Word 3:** `#f093fb` (pink)

### Fonts
- **Display:** Space Grotesk (700, 900)
- **Body:** Inter (400, 600)

### Animations
- **Spring scale:** `scale: [{ frame: 0, value: 0 }, { frame: 20, value: 1.0 }]`
- **Pop:** `scale: [{ frame: 0, value: 0 }, { frame: 10, value: 1.3 }, { frame: 15, value: 1.0 }]`
- **Slide up:** `y: [{ frame: 0, value: 10 }, { frame: 18, value: 0 }]`

---

## Customization

### Change Words
Replace `${word1}`, `${word2}`, `${word3}` with your words.

### Change Colors
Update the `fillColor` in effects and the `.word:nth-child` CSS.

### Add More Words
Add more `StudioPro.text()` clips with staggered `start` times.

### Add Music
```javascript
StudioPro.audio('beat.mp3', { start: 0, duration: 12, volume: 0.7 })
```

---

## Example Output

```
kinetic-text_ultra_30fps_ftrt_mp4.mp4
├── Duration: 12 seconds
├── Resolution: 1920×1080
├── Quality: 30 Mbps (ultra)
├── Format: MP4
└── Render time: ~4 seconds (4× realtime)
```
