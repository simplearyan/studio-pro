# Captions (Subtitles) Feature

## Overview

The Captions feature allows users to import, create, edit, and render subtitles on top of their video projects. It supports industry-standard subtitle formats (SRT, VTT), real-time canvas preview with animations, global and per-subtitle style customization, and a dedicated track on the timeline for clip-based editing (drag, trim, reposition).

---

## Architecture

The subtitle system has three layers:

```
┌─────────────────────────────────────────────┐
│  Captions Panel (UI)                         │
│  Import .srt/.vtt | Add | Clear | Generate  │
│  Subtitle list with inline editor            │
│  Style tab (global config)                   │
│  Per-subtitle style overrides                │
├─────────────────────────────────────────────┤
│  Data Layer                                  │
│  State.subtitles[] — subtitle entries        │
│  State.subtitleConfig — global style config  │
│  sub.effects — per-subtitle overrides        │
│  localStorage persistence                    │
├─────────────────────────────────────────────┤
│  Render Layer                                │
│  drawSubtitlesOnCanvas() — canvas overlay    │
│  syncSubtitlesToClips() — timeline track     │
│  drawCanvas() → drawSubtitlesOnCanvas() at   │
│    end of rendering pipeline                 │
└─────────────────────────────────────────────┘
```

---

## Data Structures

### State.subtitles — Array of Subtitle Entries

```js
{
    id: 'sub_1728394857',          // Unique ID
    text: 'Hello, world!',         // Subtitle text content
    startTime: 5.2,                // Start time in seconds
    endTime: 8.7,                  // End time in seconds
    effects: {                     // Optional per-subtitle style overrides
        fontFamily: 'Montserrat',
        fontSize: 48,
        fillColor: '#ffcc00',
        position: 'top',
        animIn: 'fadeIn',
        animOut: 'slideDown'
    }
}
```

### State.subtitleConfig — Global Style Config

```js
{
    fontFamily: 'Inter',           // Font family name
    fontSize: 36,                  // Font size in pixels
    fontWeight: 700,               // Font weight (100-900)
    fillColor: '#ffffff',          // Text color
    strokeEnable: true,            // Enable text stroke
    strokeColor: '#000000',        // Stroke color
    strokeWidth: 3,                // Stroke width in pixels
    shadowEnable: false,           // Enable drop shadow
    shadowColor: '#000000',        // Shadow color
    shadowBlur: 4,                 // Shadow blur radius
    shadowX: 0,                    // Shadow X offset
    shadowY: 2,                    // Shadow Y offset
    bgEnable: false,               // Enable background pill
    bgOpacity: 0.5,                // Background opacity (0-1)
    position: 'bottom',            // Text position: 'bottom' | 'top'
    bottomOffset: 60,              // Distance from edge in pixels
    lineHeight: 1.3,               // Line height multiplier
    letterSpacing: 0,              // Letter spacing in pixels
    bgPadding: 8,                  // Background pill padding
    animIn: 'none',                // In animation type
    animOut: 'none',               // Out animation type
    animInDur: 0.3,                // In animation duration (seconds)
    animOutDur: 0.3                // Out animation duration (seconds)
}
```

### Timeline Clip (from syncSubtitlesToClips)

Each subtitle generates a clip on the dedicated "Captions" track:

```js
{
    id: 'subclip_sub_1728394857',  // Unique clip ID
    subtitleId: 'sub_1728394857',  // Links back to subtitle entry
    trackId: 'subtitle_track',     // Always on the captions track
    type: 'text',                  // Text type clip
    title: 'Caption',              // Display title on timeline
    text: 'Hello, world!',         // Subtitle text
    start: 5.2,                    // Start time (synced from subtitle)
    duration: 3.5,                 // Duration (endTime - startTime)
    effects: {                     // Text effects for rendering
        fontFamily: 'Inter',
        fontWeight: 700,
        fillColor: '#ffffff',
        fontSize: 80
    }
}
```

---

## Key Functions

### Panel & Data Management

| Function | Purpose |
|---|---|
| `renderSubtitlesPanel()` | Renders the entire captions sidebar UI with sub-tabs |
| `parseSRT(content)` | Parses SRT and VTT file content into subtitle entries |
| `saveSubtitlesToStorage()` | Saves subtitles + config to localStorage |
| `loadSubtitlesFromStorage()` | Restores subtitles + config from localStorage |
| `setSubtitleSubTab(tab)` | Switches between "Captions" and "Style" sub-tabs |

### Subtitle CRUD

| Function | Purpose |
|---|---|
| `addEmptySubtitle()` | Creates a new subtitle at current playhead position |
| `deleteSubtitle(id)` | Removes a single subtitle |
| `clearAllSubtitles()` | Removes all subtitles (with confirmation) |

### Inline Editing

| Function | Purpose |
|---|---|
| `autoSaveInlineSubtitle(id)` | Auto-saves subtitle changes on every field input (text, timing, overrides) |
| `cancelInlineSubtitle()` | Collapses the inline editor without changes (edits are auto-saved) |

### Timeline Sync

| Function | Purpose |
|---|---|
| `syncSubtitlesToClips()` | Creates/updates the "Captions" track and subtitle clips on the timeline |
| `autoSaveInlineSubtitle()` | Also finds matching clip and updates its start/duration/text |
| `handleMouseUp()` drag handler | Syncs clip drag/trim back to subtitle data (bidirectional) |

### Canvas Rendering

| Function | Purpose |
|---|---|
| `drawSubtitlesOnCanvas(ctx, w, h)` | Renders active subtitles on the canvas overlay |
| `wrapText(ctx, text, maxWidth)` | Wraps subtitle text to fit within maxWidth |

---

## Canvas Rendering Pipeline

`drawSubtitlesOnCanvas()` is called at the very end of `drawCanvas()` — after all clips (video, image, text, shape, scene) have been rendered. This ensures subtitles render on top of everything.

### Rendering Steps

1. **Find active subtitles** — Filters `State.subtitles` to those where `time >= sub.startTime && time < sub.endTime`
2. **Select first active** — Only the first active subtitle is rendered (no overlapping)
3. **Merge config** — `const ef = { ...cfg, ...sub.effects }` — global config with per-subtitle overrides
4. **Calculate animations** — Based on `animIn`/`animOut` types and durations
5. **Wrap text** — Splits text into lines that fit within 85% of canvas width
6. **Position** — Bottom or top of canvas with configurable offset
7. **Draw background pill** — If enabled, a rounded rectangle behind the text
8. **Draw each line** — With shadow, stroke, and fill

### Animation Types

| Type | In Animation | Out Animation |
|---|---|---|
| `none` | No animation | No animation |
| `fadeIn` / `fadeOut` | Alpha 0→1 | Alpha 1→0 |
| `slideUp` / `slideDown` | Slide up 30px + fade | Slide down 30px + fade |
| `scaleIn` / `scaleOut` | Scale 0.5→1 + fade | Scale 1→0.5 + fade |

### Per-Subtitle Override System

The rendering system uses a two-level config merge:

```js
const ef = { ...State.subtitleConfig, ...sub.effects };
```

Properties in `sub.effects` override the global `State.subtitleConfig`. The renderer reads ALL properties from `ef` (shadow, stroke, background, line-height, font, color, position) with a fallback chain:

```js
// Pattern for each property:
const value = ef.prop !== undefined ? ef.prop : (cfg.prop || defaultValue);

// Examples:
const fontSize = ef.fontSize || 36;
const shEnable = ef.shadowEnable !== undefined ? ef.shadowEnable : cfg.shadowEnable;
ctx.shadowBlur = ef.shadowBlur !== undefined ? ef.shadowBlur : (cfg.shadowBlur || 4);
ctx.lineWidth = ef.strokeWidth !== undefined ? ef.strokeWidth : (cfg.strokeWidth || 3);
```

---

## Subtitle Track & Bidirectional Sync

### Track Creation

The first time `syncSubtitlesToClips()` is called, a dedicated "Captions" track is created at the top of the timeline:

```
Track order: [Captions] [V1] [A1] [V2] ...
```

### Clip Timeline Edits

When a user drags, trims (in/out), or repositions a subtitle clip on the timeline, `handleMouseUp()` detects the change and syncs it back:

```js
// In handleMouseUp() drag end handler:
const movedClip = State.clips.find(c => c.id === State.drag.clipId);
if (movedClip && movedClip.subtitleId) {
    const sub = State.subtitles.find(s => s.id === movedClip.subtitleId);
    if (sub) {
        sub.startTime = movedClip.start;
        sub.endTime = movedClip.start + movedClip.duration;
        saveSubtitlesToStorage();
    }
}
```

### Clip Properties Panel → Subtitle Sync

When a subtitle clip is selected on the timeline, the text properties panel opens. Changes made in the properties panel sync to the subtitle data via `setClipEffect()`:

```js
// In setClipEffect:
if (clip.subtitleId) {
    const sub = State.subtitles.find(s => s.id === clip.subtitleId);
    if (sub && subtitleEffectMap.includes(effectName)) {
        sub.effects[effectName] = clip.effects[effectName];
        saveSubtitlesToStorage();
    }
}
```

The synced effects include: `fontFamily`, `fontSize`, `fillColor`, `fontWeight`, `fontStyle`, `lineHeight`, `shadowEnable`, `shadowColor`, `shadowBlur`, `shadowX`, `shadowY`, `strokeEnable`, `strokeColor`, `strokeWidth`.

---

## SRT/VTT Parsing

The `parseSRT()` function handles both SRT and WebVTT formats:

### SRT Format
```
1
00:00:02,500 --> 00:00:05,000
Hello, welcome to the video!

2
00:00:06,000 --> 00:00:09,500
This is the second subtitle.
```

### WebVTT Format
```
WEBVTT

00:00:02.500 --> 00:00:05.000
Hello, welcome to the video!

00:00:06.000 --> 00:00:09.500
This is the second subtitle.
```

The parser:
- Detects format automatically (checks for WEBVTT header)
- Handles both comma (`,`) and dot (`.`) millisecond separators
- Strips HTML tags (`<b>`, `<i>`, `<font>`, etc.)
- Strips positioning tags (`{an8}`)
- Handles multiple files in one import

---

## User Interface

### Panel Layout

The captions panel has two sub-tabs:

```
┌─────────┬─────────┐
│ Captions │  Style  │
└─────────┴─────────┘
```

#### "Captions" Sub-Tab

- **Import** button — Opens file picker for `.srt` / `.vtt` files
- **Add** button (+) — Creates an empty subtitle at current playhead
- **Clear** button (🗑) — Removes all subtitles with confirmation
- **Generate Track** button (🎬) — Explicitly creates/updates the subtitle track on the timeline
- **Subtitle list** — Clickable entries, each showing:
  - Index number
  - Time range (start → end)
  - Text preview (truncated)
  - Delete button (x) on hover
- **Inline editor** — Clicking a subtitle expands it in-place with:
  - Text textarea (auto-saves on input)
  - Start / End time inputs
  - Collapsible "Style Override" section with per-subtitle font, size, color, position, animation

#### "Style" Sub-Tab

Global style configuration:
- **Font Family** — Dropdown (Rubik, Montserrat, Inter, Oswald, Bebas Neue, Bangers, Fredoka, Lora, Jakarta, custom/Google/PC fonts)
- **Font Size** — Input
- **Font Weight** — Dropdown (100-900)
- **Text Color** — Color picker
- **Stroke** — Toggle + color picker + width slider
- **Shadow** — Toggle + color picker + blur + X/Y offset sliders
- **Background Pill** — Toggle + opacity slider
- **Position** — Bottom / Top
- **Bottom Offset** — Slider
- **Animation In/Out** — Dropdowns + duration sliders

### Timeline Integration

- **Captions track** — Always at the top, 36px height, distinct indigo border (2px, #818cf8)
- **Subtitle clips** — Show subtitle text preview with a small `subtitles` icon
- **Bidirectional editing** — Drag/trim clips on timeline updates subtitle data; editing in panel updates clips

---

## File Format Support

| Format | Extension | Support |
|---|---|---|
| SubRip | `.srt` | Full import |
| WebVTT | `.vtt` | Full import |
| Plain text | — | Manual entry via Add button |

---

## localStorage Persistence

| Key | Data | When Saved |
|---|---|---|
| `studioPro_subtitles` | Full subtitle entries array (JSON) | On add, edit, delete, import, sync |
| `studioPro_subtitleConfig` | Global style config (JSON) | On any style tab change |

---

## Keyboard & Workflow

1. **Import subtitles** → Click Import → select `.srt` / `.vtt` files
2. **Add manually** → Click + → set text and timing in inline editor
3. **Generate track** → Click 🎬 Generate Track → subtitle clips appear on timeline
4. **Edit on panel** → Click a subtitle → inline editor opens → type/change → auto-saved
5. **Edit on timeline** → Drag clip ends to trim → subtitle time updates automatically
6. **Style globally** → Switch to Style tab → change font/color/shadow → canvas updates live
7. **Style per-subtitle** → Open inline editor → toggle "Override global style" → customize
8. **Export** → Subtitles render as part of the canvas (burned into video/image)

---

## Animation System

### In Animations (triggered when subtitle appears)

| Animation | Effect |
|---|---|
| `fadeIn` | Opacity 0 → 1 over animInDur seconds |
| `slideUp` | Slides up 30px from below while fading in |
| `scaleIn` | Scales from 0.5 to 1.0 while fading in |

### Out Animations (triggered when subtitle disappears)

| Animation | Effect |
|---|---|
| `fadeOut` | Opacity 1 → 0 over animOutDur seconds |
| `slideDown` | Slides down 30px while fading out |
| `scaleOut` | Scales from 1.0 to 0.5 while fading out |

Animations are calculated per-frame based on `subTime` (time since subtitle started) and `timeLeft` (time until subtitle ends).

---

## Visual Indicators

| Location | Indicator | Meaning |
|---|---|---|
| Timeline clip | Indigo border (2px) | This is a subtitle clip |
| Timeline clip | `subtitles` icon | Clip type = caption |
| Timeline clip header | "Caption" title | Identifies as subtitle clip |
| Properties panel | `Captions` badge | Selected clip is a subtitle |
| Timeline track | Captions track name | Subtitle-specific track |

---

## Differences from Regular Text Clips

| Aspect | Regular Text Clip | Subtitle Clip |
|---|---|---|
| Canvas rendering | Drawn by clip rendering pipeline | Drawn by `drawSubtitlesOnCanvas()` |
| Duration | Set manually | Determined by subtitle timing |
| Text source | User-entered | From subtitle entry (synced) |
| Style scope | Per-clip effects | Global config + per-subtitle overrides |
| Track | Any track | Dedicated "Captions" track |
| Positioning | Canvas center (customizable) | Bottom of canvas (configurable) |
| Timing edits | Direct on timeline | Syncs bidirectionally |
