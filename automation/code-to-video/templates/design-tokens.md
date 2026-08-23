# Design Tokens

> **Purpose:** Define the visual style/brand for a composition
> **Usage:** Agent reads this to know "what does this brand LOOK like?"
> **Inspired by:** HyperFrames' frame.md concept

---

## What Are Design Tokens?

Design tokens are the **visual DNA** of a brand. They define:
- Colors
- Fonts
- Spacing
- Motion
- Layout

Instead of hardcoding styles in each clip, you define tokens once and reference them everywhere.

---

## Token Format

```markdown
# Frame Design: [Brand Name]

## Colors
- Primary: #667eea
- Secondary: #764ba2
- Accent: #f093fb
- Background: #0a0a0f
- Text: #ffffff
- Text Secondary: rgba(255,255,255,0.7)

## Fonts
- Display: Poppins (700, 900)
- Body: Inter (400, 600)
- Mono: Fira Code (400)

## Spacing
- Unit: 8px
- XS: 4px
- SM: 8px
- MD: 16px
- LG: 24px
- XL: 32px
- 2XL: 48px
- 3XL: 64px

## Border Radius
- SM: 4px
- MD: 8px
- LG: 16px
- XL: 24px
- Full: 100px

## Motion
- Default Easing: easeOut
- Default Duration: 0.5s
- Spring Damping: 10
- Spring Mass: 1
- Spring Stiffness: 100

## Layout
- Max Width: 1200px
- Padding: 80px
- Gap: 24px
```

---

## Predefined Token Sets

### Dark Modern
```markdown
# Frame Design: Dark Modern

## Colors
- Primary: #667eea
- Secondary: #764ba2
- Accent: #f093fb
- Background: #0a0a0f
- Surface: #1a1a2e
- Text: #ffffff

## Fonts
- Display: Poppins (700)
- Body: Inter (400)

## Motion
- Default Easing: easeOut
- Default Duration: 0.5s
```

### Warm Gradient
```markdown
# Frame Design: Warm Gradient

## Colors
- Primary: #ff6b6b
- Secondary: #ffa500
- Accent: #ffec8b
- Background: #1a0a0a
- Surface: #2a1a1a
- Text: #ffffff

## Fonts
- Display: Montserrat (800)
- Body: Inter (400)

## Motion
- Default Easing: easeOut
- Default Duration: 0.4s
```

### Cool Professional
```markdown
# Frame Design: Cool Professional

## Colors
- Primary: #0ea5e9
- Secondary: #6366f1
- Accent: #22d3ee
- Background: #0f172a
- Surface: #1e293b
- Text: #f8fafc

## Fonts
- Display: Space Grotesk (700)
- Body: Inter (400)

## Motion
- Default Easing: easeOut
- Default Duration: 0.5s
```

### Minimal Light
```markdown
# Frame Design: Minimal Light

## Colors
- Primary: #000000
- Secondary: #374151
- Accent: #2563eb
- Background: #ffffff
- Surface: #f9fafb
- Text: #111827

## Fonts
- Display: Inter (700)
- Body: Inter (400)

## Motion
- Default Easing: easeOut
- Default Duration: 0.3s
```

### Premium Mesh
```markdown
# Frame Design: Premium Mesh

## Colors
- Primary: #B28FCE (Wisteria)
- Secondary: #F4B3C2 (Ibis Pink)
- Accent: #A0D8EF (Sky)
- Background: #EAF4FC (Moon White)
- Surface: #ffffff
- Text: #1a1a2e

## Fonts
- Display: Poppins (700)
- Body: Inter (400)

## Motion
- Default Easing: easeOut
- Default Duration: 0.6s
```

---

## How to Use Tokens

### In HTML Clips

```javascript
StudioPro.html(
    `<div class="card">
        <h1>ProductX</h1>
        <p>The future of productivity</p>
    </div>`,
    `.card {
        background: linear-gradient(135deg, ${tokens.primary}, ${tokens.secondary});
        padding: ${tokens.spacing.xl};
        border-radius: ${tokens.borderRadius.lg};
        font-family: ${tokens.fonts.display};
    }
    .card h1 {
        color: ${tokens.text};
        font-size: 96px;
    }
    .card p {
        color: ${tokens.textSecondary};
        font-size: 36px;
    }`,
    '',
    { fonts: [tokens.fonts.display.family] }
);
```

### In Text Clips

```javascript
StudioPro.text('Hello World', {
    effects: {
        fontFamily: tokens.fonts.display.family,
        fontSize: 96,
        fillColor: tokens.text
    }
});
```

### In Animations

```javascript
StudioPro.keyframes(clip, {
    opacity: [{ frame: 0, value: 0 }, { frame: 30, value: 100 }],
    scale: [{ frame: 0, value: 0.5 }, { frame: 30, value: 1.0, easing: tokens.motion.defaultEasing }]
});
```

---

## Token Structure

```javascript
const tokens = {
    colors: {
        primary: '#667eea',
        secondary: '#764ba2',
        accent: '#f093fb',
        background: '#0a0a0f',
        surface: '#1a1a2e',
        text: '#ffffff',
        textSecondary: 'rgba(255,255,255,0.7)'
    },
    fonts: {
        display: { family: 'Poppins', weights: [700, 900] },
        body: { family: 'Inter', weights: [400, 600] }
    },
    spacing: {
        unit: 8,
        xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48, '3xl': 64
    },
    borderRadius: {
        sm: 4, md: 8, lg: 16, xl: 24, full: 100
    },
    motion: {
        defaultEasing: 'easeOut',
        defaultDuration: 0.5,
        spring: { damping: 10, mass: 1, stiffness: 100 }
    }
};
```

---

## For AI Agents

When creating a video, read the design tokens FIRST to know the visual style:

1. **Read tokens** → Know the colors, fonts, spacing
2. **Load fonts** → `StudioPro.fonts.loadGoogle(tokens.fonts.display.family)`
3. **Create clips** → Use token values for colors, fonts, spacing
4. **Apply animations** → Use token motion values

This ensures consistency across all videos for the same brand.
