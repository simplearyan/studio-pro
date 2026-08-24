# Clip Transitions Plan — StudioPro

> Add professional transitions between HTML clips, with both API and GUI support.
> Based on the proven transition system from Sequence Animator Pro v0.4.

---

## 📋 Summary

| Item | Value |
|---|---|
| **Source** | Sequence Animator Pro v0.4.html |
| **Target** | StudioPro index.html |
| **Effort** | 3-5 days |
| **Priority** | 🔴 HIGH — biggest visual quality improvement |

---

## 🎬 Transition Types (from Old Project)

### Core Transitions (Priority 1)

| # | Name | ID | Description | Complexity |
|---|---|---|---|---|
| 1 | **Cut** | `cut` | Instant switch (current behavior) | Trivial |
| 2 | **Fade** | `fade` | Opacity crossfade between clips | Easy |
| 3 | **Slide Projector** | `projector` | Horizontal slide (old film projector) | Easy |
| 4 | **Push Reveal** | `push-reveal` | Current pushes out, next scales in | Medium |
| 5 | **Zoom Dissolve** | `zoom-dissolve` | Slow zoom + opacity dissolve | Medium |

### Advanced Transitions (Priority 2)

| # | Name | ID | Description | Complexity |
|---|---|---|---|---|
| 6 | **Paper Flip** | `paper-flip` | 3D pivot flip from edge with skew | Hard |
| 7 | **Calendar Tear** | `calendar` | Calendar peel & drop effect | Hard |
| 8 | **Calendar Flip** | `calendar-flip` | Calendar slide upwards | Hard |
| 9 | **Sticky Notes** | `sticky` | Stack & toss effect | Hard |
| 10 | **Sticky Up** | `sticky-up` | Peel upwards effect | Hard |
| 11 | **Flipbook** | `flipbook` | Stop-motion discrete frames | Medium |
| 12 | **Vertical Projector** | `projector-vert` | Vertical slide with focus | Medium |

### Text Animations (Priority 3)

| # | Name | ID | Description |
|---|---|---|---|
| 13 | **None** | `none` | No text animation |
| 14 | **Fade In** | `fade-in` | Text fades in |
| 15 | **Slide Up** | `slide-up` | Text slides up from bottom |
| 16 | **Typewriter** | `typewriter` | Character-by-character reveal |
| 17 | **Kinetic Zoom** | `zoom` | Text zooms in |

---

## 🏗️ Architecture

### How Transitions Work (from Old Project)

```
Timeline:    [----Clip 1----][----Clip 2----]
                 holdTime       holdTime
                    |               |
                    v               v
              [----draw----][transition][----draw----]
                                  ^
                                  |
                           transTime (0.5s default)
```

**Key concepts:**
- `holdTime` — how long to show the clip at full opacity
- `transTime` — how long the transition takes (overlap between clips)
- `transProgress` — 0.0 to 1.0 progress through transition
- `isTransitioning` — `localTime > holdTime`

### StudioPro Implementation

#### Data Model

```javascript
// Per-clip transition settings
clip.effects = {
    // ... existing properties ...
    transition: {
        type: 'fade',           // Transition type ID
        duration: 0.5,          // Transition duration in seconds
        easing: 'easeInOut',    // Easing function
        direction: 'left'       // For directional transitions (projector, push)
    }
}

// Global defaults (in composition config)
StudioPro.createComposition({
    transitions: {
        default: 'fade',        // Default transition type
        duration: 0.5,          // Default duration
        easing: 'easeInOut'     // Default easing
    },
    clips: [...]
})
```

#### Rendering Logic

```javascript
// In drawCanvas() — HTML clip rendering
function drawHtmlClipWithTransition(ctx, clip, nextClip, time, canvas) {
    const trans = clip.effects?.transition || { type: 'cut', duration: 0 };
    const clipDuration = clip.end - clip.start;
    const transFrames = trans.duration * State.exportFps;
    
    // Check if we're in the transition zone
    const clipLocalTime = time - clip.start;
    const isInTransition = clipLocalTime > (clipDuration - trans.duration);
    
    if (!isInTransition || !nextClip) {
        // Normal render — no transition
        drawHtmlClip(ctx, clip, time);
        return;
    }
    
    // Calculate transition progress
    const transProgress = (clipLocalTime - (clipDuration - trans.duration)) / trans.duration;
    const eased = applyEasing(transProgress, trans.easing);
    
    // Render based on transition type
    switch (trans.type) {
        case 'fade':
            drawFadeTransition(ctx, clip, nextClip, eased);
            break;
        case 'projector':
            drawProjectorTransition(ctx, clip, nextClip, eased, trans.direction);
            break;
        case 'push-reveal':
            drawPushRevealTransition(ctx, clip, nextClip, eased);
            break;
        // ... etc
    }
}
```

---

## 🖥️ GUI Support

### Sidebar Controls (Properties Panel)

Add a **Transition** card in the Properties sidebar when an HTML clip is selected:

```
┌─────────────────────────────────────┐
│ 🎬 TRANSITION                      │
├─────────────────────────────────────┤
│ Type:     [Fade           ▼]       │
│ Duration: [0.5s  ─────●───]        │
│ Easing:   [Ease In Out   ▼]       │
│ Direction:[Left           ▼]       │
│             (only for directional) │
├─────────────────────────────────────┤
│ [Preview Transition]               │
└─────────────────────────────────────┘
```

### Transition Preview

When user changes transition type, show a quick 1-second preview:
- Render current clip frame
- Apply transition animation
- Show in canvas

### Timeline Visual

Show transition as a colored bar between clips:

```
[====Clip 1====][═══transition═══][====Clip 2====]
                  0.5s fade
```

---

## 🎨 Transition Animations

### 1. Fade (Crossfade)
```javascript
function drawFadeTransition(ctx, curr, next, progress) {
    // Draw next clip underneath
    ctx.globalAlpha = 1;
    drawHtmlClip(ctx, next);
    
    // Draw current clip on top with fading opacity
    ctx.globalAlpha = 1 - progress;
    drawHtmlClip(ctx, curr);
    ctx.globalAlpha = 1;
}
```

### 2. Slide Projector (Horizontal)
```javascript
function drawProjectorTransition(ctx, curr, next, progress, direction = 'left') {
    const w = canvas.width;
    const eased = Ease.inOutQuint(progress);
    
    const offsetCurr = direction === 'left' ? -(w * eased) : (w * eased);
    const offsetNext = direction === 'left' ? (w * (1 - eased)) : -(w * (1 - eased));
    
    // Draw next clip sliding in
    ctx.save();
    ctx.translate(offsetNext, 0);
    drawHtmlClip(ctx, next);
    ctx.restore();
    
    // Draw current clip sliding out
    ctx.save();
    ctx.translate(offsetCurr, 0);
    drawHtmlClip(ctx, curr);
    ctx.restore();
}
```

### 3. Push Reveal
```javascript
function drawPushRevealTransition(ctx, curr, next, progress) {
    const w = canvas.width;
    const eased = Ease.inOutQuint(progress);
    
    // Next clip scales in from 0.95 to 1.0
    const nextScale = 0.95 + (0.05 * Ease.outBack(progress));
    ctx.save();
    ctx.translate(w/2, canvas.height/2);
    ctx.scale(nextScale, nextScale);
    ctx.translate(-w/2, -canvas.height/2);
    drawHtmlClip(ctx, next);
    ctx.restore();
    
    // Current clip pushes out with rotation
    const pushX = -(w * 1.5) * eased;
    const rot = -(Math.PI / 16) * eased;
    ctx.save();
    ctx.translate(w/2, canvas.height/2);
    ctx.rotate(rot);
    ctx.translate(-w/2 + pushX, -canvas.height/2);
    drawHtmlClip(ctx, curr);
    ctx.restore();
}
```

### 4. Zoom Dissolve
```javascript
function drawZoomDissolveTransition(ctx, curr, next, progress, clipDuration) {
    // Current clip slowly zooms (Ken Burns effect)
    const zoomCurr = 1.0 + (clipDuration * 0.03); // 3% zoom per second
    
    // Next clip fades in
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(w/2, canvas.height/2);
    ctx.scale(zoomCurr, zoomCurr);
    ctx.translate(-w/2, -canvas.height/2);
    drawHtmlClip(ctx, next);
    ctx.restore();
    
    ctx.globalAlpha = 1 - progress;
    ctx.save();
    ctx.translate(w/2, canvas.height/2);
    ctx.scale(zoomCurr, zoomCurr);
    ctx.translate(-w/2, -canvas.height/2);
    drawHtmlClip(ctx, curr);
    ctx.restore();
    ctx.globalAlpha = 1;
}
```

### 5. Paper Flip (3D Pivot)
```javascript
function drawPaperFlipTransition(ctx, curr, next, progress) {
    const w = canvas.width;
    const h = canvas.height;
    const eased = Ease.inQuad(progress);
    
    // Next card underneath
    drawHtmlClip(ctx, next);
    
    // Current card flips from left edge
    ctx.save();
    ctx.translate(w * 0.1, h/2);
    const scaleX = Math.cos(eased * Math.PI / 2); // 3D squeeze
    ctx.scale(scaleX, 1);
    ctx.transform(1, eased * 0.15, 0, 1, 0, 0); // Skew for bend
    ctx.translate(-(w * 0.1), -h/2);
    
    ctx.globalAlpha = 1 - (eased * 0.3); // Slight darkening
    drawHtmlClip(ctx, curr);
    ctx.restore();
    ctx.globalAlpha = 1;
}
```

---

## 🔌 API Support

### createComposition() with transitions

```javascript
StudioPro.createComposition({
    id: 'product-launch',
    duration: 15,
    
    // Global transition defaults
    transitions: {
        default: 'fade',
        duration: 0.5,
        easing: 'easeInOut'
    },
    
    clips: [
        // Clip with default transition (fade)
        StudioPro.html(html1, css1, '', { start: 0, duration: 5 }),
        
        // Clip with custom transition
        StudioPro.html(html2, css2, '', { 
            start: 5, 
            duration: 5,
            transition: { type: 'projector', duration: 0.8, direction: 'left' }
        }),
        
        // Clip with no transition (cut)
        StudioPro.html(html3, css3, '', { 
            start: 10, 
            duration: 5,
            transition: { type: 'cut' }
        })
    ]
});
```

### setTransition() API

```javascript
// Set transition on existing clip
StudioPro.setTransition(clip, {
    type: 'paper-flip',
    duration: 0.6,
    easing: 'easeOut'
});

// Get transition info
const trans = StudioPro.getTransition(clip);
console.log(trans.type); // 'paper-flip'
```

---

## 📁 Files to Modify

| File | Changes |
|---|---|
| `index.html` | Add transition rendering in `drawCanvas()` |
| `index.html` | Add transition UI in sidebar properties panel |
| `index.html` | Add `StudioPro.setTransition()` API |
| `index.html` | Add `StudioPro.getTransition()` API |
| `index.html` | Add transition preview in canvas |
| `index.html` | Add timeline transition indicators |

---

## ⏱️ Implementation Phases

### Phase 1: Core Transitions (2 days)
- [ ] Add transition data model to clip.effects
- [ ] Implement `fade` transition
- [ ] Implement `cut` transition (no-op)
- [ ] Add transition rendering in `drawCanvas()`
- [ ] Test with India Pollution presentation

### Phase 2: Directional Transitions (1 day)
- [ ] Implement `projector` (horizontal slide)
- [ ] Implement `push-reveal`
- [ ] Implement `zoom-dissolve`
- [ ] Add direction control for directional transitions

### Phase 3: Advanced Transitions (1-2 days)
- [ ] Implement `paper-flip` (3D pivot)
- [ ] Implement `calendar` / `calendar-flip`
- [ ] Implement `sticky` / `sticky-up`
- [ ] Implement `flipbook`

### Phase 4: GUI Support (1 day)
- [ ] Add Transition card in sidebar
- [ ] Add transition type dropdown
- [ ] Add duration slider
- [ ] Add easing dropdown
- [ ] Add direction dropdown (for directional transitions)
- [ ] Add transition preview button
- [ ] Add timeline transition indicators

### Phase 5: API & Testing (1 day)
- [ ] Add `StudioPro.setTransition()` API
- [ ] Add `StudioPro.getTransition()` API
- [ ] Update `createComposition()` to accept transitions config
- [ ] Test full workflow: API → GUI → Export
- [ ] Document in README and ISSUES-AND-TODOS.md

---

## 🧪 Testing Plan

### Test Cases

1. **Basic fade** — Two HTML clips with 0.5s fade between them
2. **Slide projector** — Horizontal slide with direction control
3. **Push reveal** — Scale + push animation
4. **Paper flip** — 3D pivot flip effect
5. **Mixed transitions** — Different transitions between different clips
6. **No transition** — Cut (instant switch) between clips
7. **Custom duration** — 0.2s fast fade vs 2s slow fade
8. **GUI controls** — Change transition from sidebar
9. **API controls** — Set transition via JavaScript
10. **Export test** — Verify transitions render correctly in exported video

### Expected Results

- No empty frames between clips (fixes preload issue)
- Smooth transitions at 30fps
- Transitions match in preview and export
- GUI controls update canvas in real-time
- API works from both browser and Node.js

---

## 📊 Impact Assessment

| Before | After |
|---|---|
| Abrupt cuts between scenes | Professional fade/slide transitions |
| 1-second empty frames | Smooth crossfade covers loading |
| Amateur-looking video | Broadcast-quality transitions |
| No transition control | Full GUI + API control |

**This is the single biggest visual quality improvement for StudioPro videos.**
