# M3 — `.spcomp` Portable Composition Format

> **Date:** August 2026
> **Status:** Spec for implementation
> **Scope:** `index.html` export/import + new `exportSpcomp()` / `importSpcomp()` functions
> **Depends on:** M0 (determinism), M2 (templates)

---

## 1. What is `.spcomp`?

A **typed, portable JSON file** that represents a Studio Pro project as a self-contained composition. Unlike the native `.json` project file (which references local files and DOM elements), `.spcomp` is:

- **Self-contained** — all assets embedded as data URIs (no network at render time)
- **Agent-editable** — clean JSON that LLMs can read/write
- **Deterministic** — no `Math.random()`, no `Date.now()`, time quantized to fps
- **Portable** — works on any machine, no file paths, no local media

### Use cases

1. **Agent authoring** — Claude Code/Codex writes a `.spcomp` file → Studio Pro renders it
2. **Template sharing** — export a project as `.spcomp` → import on another machine
3. **Headless render** — load `.spcomp` in a render-only page → produce video
4. **Version control** — diff-friendly JSON for tracking project changes

---

## 2. Schema

```json
{
  "spcomp": 1,
  "meta": {
    "name": "My Video",
    "author": "StudioPro",
    "created": "2026-08-21T00:00:00Z",
    "tool": "StudioPro v0.2.x"
  },
  "canvas": {
    "width": 1920,
    "height": 1080,
    "fps": 30,
    "duration": 30.0,
    "bg": "#000000"
  },
  "tracks": [
    {
      "id": "track_1",
      "type": "text",
      "name": "Text",
      "volume": 1.0,
      "muted": false
    }
  ],
  "clips": [
    {
      "id": "clip_1",
      "trackId": "track_1",
      "type": "text",
      "start": 0.0,
      "duration": 5.0,
      "text": "Hello World",
      "fontSize": 72,
      "fontFamily": "Plus Jakarta Sans",
      "color": "#ffffff",
      "bg": "#000000",
      "textAlign": "center",
      "effects": {
        "animIn": "fadeIn",
        "animOut": "fadeOut",
        "animDuration": 0.5
      }
    },
    {
      "id": "clip_2",
      "trackId": "track_1",
      "type": "image",
      "start": 5.0,
      "duration": 5.0,
      "src": "data:image/jpeg;base64,...",
      "effects": {
        "animIn": "slideUp",
        "animDuration": 0.8
      }
    }
  ],
  "markdown": {
    "text": "## Hello\n\nWorld",
    "config": { "aspect": "16:9" }
  }
}
```

### Field definitions

| Field | Type | Required | Description |
|---|---|---|---|
| `spcomp` | number | ✅ | Schema version (currently `1`) |
| `meta` | object | ✅ | Metadata (name, author, timestamps) |
| `canvas` | object | ✅ | Canvas dimensions, fps, duration, background |
| `tracks` | array | ✅ | Track definitions (type, name, volume, mute) |
| `clips` | array | ✅ | Clip definitions with effects and embedded assets |
| `markdown` | object | ❌ | Original markdown text and config (if generated from markdown) |

### Clip types

| Type | Key fields | Notes |
|---|---|---|
| `text` | `text`, `fontSize`, `fontFamily`, `color`, `bg` | Text overlay |
| `image` | `src` (data URI) | Embedded image |
| `video` | `src` (data URI), `trimStart`, `trimEnd` | Embedded video (large!) |
| `shape` | `shape`, `fill`, `stroke`, `strokeWidth` | Geometric shape |
| `scene` | `scene`, `preset` | Pre-composition scene |
| `math` | `latex`, `scale` | Math formula |

### Effects

```json
{
  "animIn": "fadeIn|slideUp|slideLeft|zoomIn|none",
  "animOut": "fadeOut|slideDown|slideRight|zoomOut|none",
  "animDuration": 0.5,
  "saturation": 100,
  "vibrance": 0,
  "hue": 0,
  "brightness": 100,
  "contrast": 100,
  "blur": 0,
  "speed": 1.0,
  "reverse": false
}
```

---

## 3. Export contract

### `exportSpcomp(project)` → `.spcomp` JSON

1. **Strip runtime fields** — remove `_imgReady`, `_imgAnimStarted`, `_missingMedia`, DOM elements, AudioBuffers, etc.
2. **Embed assets** — convert file-backed media to data URIs:
   - Images: `canvas.toDataURL()` or fetch + base64
   - Videos: skip (too large) — leave `src` as empty string + note
   - Audio: embed as base64 WAV (if < 500 KB)
3. **Quantize time** — round all `start` and `duration` to nearest frame: `Math.round(t * fps) / fps`
4. **Remove randomness** — strip any `Math.random()` seeds, `Date.now()` timestamps
5. **Pin fonts** — record `fontFamily` on every text clip
6. **Compute canvas** — derive width/height from `State.preview.aspectIndex` + `State.exportResolution`

---

## 4. Import contract

### `importSpcomp(data)` → applies to State

1. **Validate schema** — check `spcomp === 1`, required fields present
2. **Restore tracks** — create tracks from `data.tracks`
3. **Restore clips** — create clips from `data.clips`, re-fetching data URIs into elements:
   - Images: `new Image(); img.src = clip.src;`
   - Videos: `document.createElement('video'); video.src = clip.src;`
   - Text: direct property assignment
4. **Restore markdown** — if `data.markdown` exists, restore `State.markdownText` and `State.markdownConfig`
5. **Recompute duration** — `State.duration = Math.max(...clips.map(c => c.start + c.duration))`

---

## 5. Round-trip guarantee

**export → import → export must produce byte-identical output** (excluding `savedAt` timestamp).

Test:
```javascript
const original = serializeProject();
const spcomp = exportSpcomp(original);
const imported = importSpcomp(spcomp);
const reexported = exportSpcomp(imported);
assert(JSON.stringify(spcomp) === JSON.stringify(reexported));
```

---

## 6. Acceptance criteria

- [ ] `exportSpcomp()` produces valid JSON with `spcomp: 1` schema
- [ ] All text clips round-trip (text, font, color, effects)
- [ ] Image clips with data URI sources round-trip
- [ ] Markdown text and config round-trip
- [ ] Time values are quantized to frames
- [ ] No runtime fields in output (`_imgReady`, DOM elements, etc.)
- [ ] Import restores project to same visual state
- [ ] `.spcomp` file can be opened in any text editor and read by LLMs
- [ ] Export button in UI produces downloadable `.spcomp` file
- [ ] Import button in UI loads `.spcomp` file into project

---

## 7. UI integration

### Export `.spcomp`

Add to the Projects modal (or a new File menu):
- "Export as .spcomp" button → downloads `project-name.spcomp`

### Import `.spcomp`

Add to the Projects modal:
- "Import .spcomp" button → file picker → loads into project

### File extension

`.spcomp` (Studio Pro Composition)

### MIME type

`application/json` (it's valid JSON)

---

## 8. What `.spcomp` is NOT

- **Not a render format** — it's a project interchange format
- **Not a video file** — it's metadata + embedded assets
- **Not a replacement for `.json` projects** — the native format is richer (supports local files, undo, etc.)
- **Not a markup language** — Markdown is the authoring format; `.spcomp` is the portable artifact
