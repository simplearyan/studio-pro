# Scene Composition Feature

## Overview

The Scene Composition feature allows users to group multiple clips together into a single "scene" clip. Scenes work like nested timelines — when you double-click or enter a scene, the timeline shows only the clips belonging to that scene, and you can edit them independently. The scene then renders as a single composited element in the parent timeline with its own animation, transform, and blend-mode properties.

This is similar to "nested sequences" in Premiere Pro, "compound clips" in Final Cut Pro, or "pre-comps" in After Effects.

---

## How It Works

### 1. Grouping Clips into a Scene

When the user selects one or more clips on the timeline and clicks **Group into Scene** (Ctrl+G), the `groupIntoScene()` function:

1. **Finds selected clips** — Gets all clips that are either the `selectedClipId` or in `multiSelectedClipIds`
2. **Calculates bounds** — Determines the minimum start time and maximum end time across all selected clips
3. **Creates a scene clip** — A new clip with `type: 'scene'` is created on the same track as the first selected clip, spanning the full duration of the group
4. **Offsets children** — Each selected clip's `start` time is offset by `-minStart` (so children start at 0 within the scene)
5. **Assigns sceneId** — Each selected clip gets `sceneId: sceneId` to link it to the new scene
6. **Renders** — Calls `renderTrackHeaders()`, `renderTracks()`, `renderClips()`, and `drawCanvas()`

```js
function groupIntoScene() {
    let minStart = Math.min(...selectedClips.map(c => c.start));
    let maxEnd = Math.max(...selectedClips.map(c => c.start + c.duration));
    
    const sceneId = 'scene_' + Date.now();
    const newSceneClip = {
        id: sceneId,
        type: 'scene',
        title: 'New Scene',
        trackId: topTrackId,
        start: minStart,
        duration: maxEnd - minStart,
        sceneId: State.activeSceneId, // nested scenes support
        effects: { scale: 1, rotate: 0, opacity: 100, blendMode: 'source-over', ... }
    };
    
    selectedClips.forEach(c => {
        c.start -= minStart;
        c.sceneId = sceneId;
    });
    
    State.clips.push(newSceneClip);
}
```

### 2. Entering a Scene

When the user double-clicks a scene clip (or clicks through the breadcrumb), `enterScene(sceneId)` is called:

1. Sets `State.activeSceneId = sceneId`
2. **Migrates clips** — Children of the scene that were on "main sequence" tracks are moved to scene-specific copies of those tracks
3. **Creates default tracks** — If no tracks exist for this scene yet (empty scene), V1 and A1 tracks are created
4. **Updates breadcrumb** — Shows a "Main Sequence → Scene Name" navigation in the toolbar header
5. **Clears selection** — Deselects any selected clips
6. **Renders** — Full timeline re-render limited to the active scene's tracks and clips

```js
function enterScene(sceneId) {
    State.activeSceneId = sceneId;
    // Migrate legacy clips to scene-specific tracks
    State.clips.filter(c => c.sceneId === sceneId).forEach(clip => {
        const track = State.tracks.find(t => t.id === clip.trackId);
        if (track && (track.sceneId || null) !== sceneId) {
            let sceneTrack = State.tracks.find(t => t.sceneId === sceneId 
                && t.type === track.type && t.name === track.name);
            if (!sceneTrack) {
                sceneTrack = { ...track, id: track.type + '_' + Date.now() + ..., sceneId: sceneId };
                if (sceneTrack.type === 'video') State.tracks.unshift(sceneTrack);
                else State.tracks.push(sceneTrack);
            }
            clip.trackId = sceneTrack.id;
        }
    });
}
```

### 3. Exiting a Scene

When the user clicks "Main Sequence" in the breadcrumb, `exitScene()` is called:

1. Sets `State.activeSceneId = null`
2. Hides the breadcrumb
3. Re-renders the full timeline (showing only main-sequence tracks)

### 4. Rendering a Scene on Canvas

During the canvas rendering loop (`drawCanvas`), when a clip with `type: 'scene'` is encountered:

1. An **offscreen canvas** is created at the full canvas resolution
2. `State.currentTime` is temporarily offset by `-clip.start` (so the scene's internal timeline aligns)
3. `State.activeSceneId` is temporarily set to the scene's `clip.id`
4. **`drawCanvas(offCtx, w, h)` is called recursively** — this renders all children of the scene onto the offscreen canvas using the scene's own tracks, clips, and time offset
5. `State.currentTime` and `State.activeSceneId` are restored
6. The offscreen canvas is composited onto the main canvas with the scene clip's own effects:
   - **Scale** — `clip.effects.scale`
   - **Rotation** — `clip.effects.rotate`
   - **Opacity** — `clip.effects.opacity`
   - **Blend Mode** — `clip.effects.blendMode`
   - **Animation** — Scene animations (in/out/loop) via `calculateAnimationState()`
   - **Flip** — Horizontal/vertical flip via `clip.effects.flipH` / `flipV`

```js
} else if (clip.type === 'scene') {
    const offCanvas = createOffscreenCanvas(w, h);
    const offCtx = offCanvas.getContext('2d');
    
    // Temporarily switch to scene context
    State.currentTime = prevTime - clip.start;
    State.activeSceneId = clip.id;
    drawCanvas(offCtx, w, h); // ← recursive render of children
    State.currentTime = prevTime;
    State.activeSceneId = prevSceneId;
    
    // Composite with effects
    ctx.globalAlpha = aState.animAlpha * (opacity / 100);
    ctx.globalCompositeOperation = clip.effects.blendMode || 'source-over';
    ctx.translate(cx, cy);
    ctx.rotate((rotate * Math.PI / 180) + aState.animRot);
    ctx.scale(finalScale * (clip.effects.flipH ? -1 : 1), ...);
    ctx.drawImage(offCanvas, -w/2, -h/2, w, h);
}
```

---

## Key Components

### State Properties

| Property | Type | Description |
|---|---|---|
| `State.activeSceneId` | `string \| null` | Currently active scene ID, or `null` for main sequence |
| `clip.sceneId` | `string \| null` | Links a clip to its parent scene |
| `track.sceneId` | `string \| null` | Links a track to a scene (scene-specific tracks) |
| `clip.type === 'scene'` | `string` | Identifies scene composition clips |

### Functions

| Function | Purpose |
|---|---|
| `groupIntoScene()` | Groups selected clips into a new scene |
| `enterScene(sceneId)` | Enters a scene, shows its tracks/clips on timeline |
| `exitScene()` | Returns to the main sequence |
| `drawCanvas()` | Handles recursive scene rendering via offscreen canvas |

### UI Elements

| Element | Purpose |
|---|---|
| **Group into Scene button** (Ctrl+G) | Toolbar button to group selected clips |
| **Breadcrumb** | "Main Sequence → Scene Name" navigation in toolbar center |
| **Scene clip on timeline** | Visually appears as a grouped clip with `type: 'scene'` icon (`layers`) |

---

## Scene Rendering Pipeline

```
drawCanvas()
  │
  ├── For each visible clip in active scene:
  │     ├── if clip.type === 'video' → render video frame at current time
  │     ├── if clip.type === 'image' → render image
  │     ├── if clip.type === 'text' → render text
  │     ├── if clip.type === 'shape' → render shape
  │     └── if clip.type === 'scene' → RECURSIVE:
  │           ├── Create offscreen canvas
  │           ├── Set State.activeSceneId = sceneId
  │           ├── Set State.currentTime = parentTime - clip.start
  │           ├── drawCanvas(offCtx) → renders all children of this scene
  │           ├── Restore State.activeSceneId and State.currentTime
  │           └── Composite offscreen → main canvas with effects
  │
  └── drawSubtitlesOnCanvas() → renders captions on top
```

---

## Scene Filtering in Track/Clip Rendering

All track and clip rendering functions filter by `State.activeSceneId`:

```js
// Tracks filter
State.tracks.filter(t => (t.sceneId || null) === (State.activeSceneId || null))

// Clips filter (within renderTrackHeaders, renderTracks, renderClips)
State.clips.filter(c => c.sceneId === State.activeSceneId 
    || (!c.sceneId && !State.activeSceneId))
```

This ensures:
- **On main sequence**: Only clips/tracks with `sceneId: null` are shown
- **Inside a scene**: Only clips/tracks with matching `sceneId` are shown
- **Nested scenes**: A scene inside another scene uses the same filtering

---

## Scene Animation

Scene clips support the same animation system as other clips:

| Property | Type | Description |
|---|---|---|
| `animIn` | `string` | Incoming animation (fadeIn, slideUp, scaleIn, none) |
| `animOut` | `string` | Outgoing animation (fadeOut, slideDown, scaleOut, none) |
| `animLoop` | `string` | Looping animation |
| `animInDur` | `number` | In animation duration (seconds) |
| `animOutDur` | `number` | Out animation duration (seconds) |
| `animEase` | `string` | Easing function |

---

## Preset: Default Composition Scene

A preset scene composition is pre-defined:

```js
{
    id: 'preset_scene_comp',
    name: 'Default Composition Scene',
    type: 'scene',
    category: 'Scene Composition'
}
```

This allows users to start from a pre-built scene structure and customize it.

---

## Limitations & Considerations

1. **Recursive rendering performance**: Each nested scene creates an offscreen canvas. Deep nesting (scene > scene > scene) creates multiple offscreen canvases per frame, which is GPU/memory intensive.
2. **Track migration**: Entering a scene for the first time creates copies of tracks from the main sequence. These are independent — changing a main-sequence track doesn't affect scene tracks.
3. **Export**: During export, the same recursive rendering pipeline is used (via `drawCanvas(targetCtx, targetW, targetH)` with `!targetCtx` check for selection overlays).
4. **No undo**: Currently there's no undo/redo system for scene operations.

---

## Opaque vs. Transparent Scene Rendering

### The problem it solves

A scene comp renders its children onto an **offscreen canvas** and composites the result into the parent frame. Two behaviors matter:

1. **Transparent regions** — Where a scene has no content, the pixels underneath (clips on lower tracks at the same time) can either show through or be hidden.
2. **Background fill** — By default the offscreen is transparent (`clearRect` only). If the scene should act as a full-frame cover, it must first fill the offscreen with an opaque color.

### Per-scene controls (Scene card in the Properties panel)

| Control | Effect |
|---|---|
| **Opaque Background** (`clip.effects.opaqueBg`) | `false` (default) → the offscreen stays transparent, so lower tracks show through empty regions. `true` → the offscreen fills the full frame, hiding everything beneath the scene during its time range. |
| **Background Color** (`clip.effects.bgColor`) | The fill color used when Opaque Background is on. `null` (default) → falls back to the **global canvas background color** (`State.canvasBgColor`). A **Global** button resets a custom color back to `null`. |

### How it flows through `drawCanvas`

```js
// drawCanvas(targetCtx, targetW, targetH, opts)
// opts = { skipSubtitles, skipBg, bgColor }

const fillBgColor = (opts && opts.bgColor) || State.canvasBgColor;
if (!skipBg && fillBgColor && fillBgColor !== 'transparent') {
    ctx.fillStyle = fillBgColor;
    ctx.fillRect(0, 0, w, h);
}
```

When rendering a scene clip:

```js
} else if (clip.type === 'scene') {
    const opaqueBg = clip.effects && clip.effects.opaqueBg;     // per-scene toggle
    const sceneBgColor = clip.effects && clip.effects.bgColor;  // per-scene color
    // Opaque on  → skipBg false → offscreen fills with sceneBgColor (or global fallback)
    // Opaque off → skipBg true  → offscreen stays transparent
    drawCanvas(offCtx, w, h, { skipSubtitles: true, skipBg: !opaqueBg, bgColor: sceneBgColor });
}
```

Key points:

- **`skipBg: !opaqueBg`** — `true` (opaque on) makes the offscreen fill; `false` (opaque off) keeps it transparent.
- **`bgColor: sceneBgColor`** — only flows through the scene recursion; the main canvas and the export path call `drawCanvas()` with no opts, so they always use `State.canvasBgColor`.
- **Nested scenes** each compute their own `opaqueBg`/`bgColor` during recursion — a scene inside an opaque scene renders with its own settings.
- **Export** reuses the exact same pipeline (`drawCanvas(exportCtx, exportW, exportH)`), so exported videos match the canvas preview, including per-scene colors.

### `setClipEffect` note

`bgColor` is a **string-valued** effect and must be in the string whitelist inside `setClipEffect`:

```js
['shadowColor', 'animIn', ..., 'strokeColor', 'maskType', 'bgColor'].includes(effectName)
```

If it were missing, a hex string like `#ff0000` would fall through to the `parseFloat(value)` branch and store `NaN`. Always add new color-style effects to this whitelist.

---

## Subtitles inside Scene Comps (double-caption fix)

**Bug:** A scene with a slide animation showed **two** captions moving with the scene. Root cause: `drawCanvas` recurses into the scene's offscreen, and *both* the recursive call and the outer call ran `drawSubtitlesOnCanvas()` — so the caption was baked into the offscreen (and transformed by the scene's animation) **and** drawn again on the main canvas.

**Fix:** The scene recursion passes `skipSubtitles: true`, and the end-of-frame subtitle draw is guarded:

```js
if (!skipSubtitles) drawSubtitlesOnCanvas(ctx, w, h);
```

Subtitles are now drawn **exactly once**, on the main canvas, at the correct absolute time — they never get transformed by the scene's own animation.

---

## Behavior summary

| Scenario | Result |
|---|---|
| Opaque Background OFF (default) | Scene is transparent where empty; clips on lower tracks at the same time are visible. |
| Opaque Background ON, no custom color | Scene fills the full frame with the **global** canvas color. |
| Opaque Background ON, custom color set | Scene fills the full frame with its **own** background color. |
| Custom color + **Global** button | `bgColor` reset to `null` → back to the global canvas color. |
| Captions during a scene | Drawn once on top of everything; never duplicated or animated with the scene. |
