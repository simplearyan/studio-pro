# HIC Resolution Scaling Plan

## Problem

HIC clips render at 800×450 (fixed sandbox) then `drawImage` scales to canvas (1920×1080).
This is a **2.4× upscale** which causes blurry text and soft edges compared to native
text elements that render at full canvas resolution.

```
Current:  SVG 800×450 → drawImage → canvas 1920×1080 (2.4x upscale → blurry)
Expected: SVG 1920×1080 → drawImage → canvas 1920×1080 (1:1 → sharp)
```

## Root Cause

SVG foreignObject rasterizes content at the SVG's intrinsic dimensions. When the SVG
is 800×450 but drawn at 1920×1080, the browser upscales the rasterized bitmap,
causing soft edges.

## Solution: CSS Transform Scaling

Keep the sandbox DOM at 800×450 (design space), but render the SVG at canvas
resolution with CSS `transform: scale()` on the inner div:

```html
<svg width="1920" height="1080">
  <foreignObject width="1920" height="1080">
    <div style="width:1920px;height:1080px;overflow:hidden;">
      <div style="width:800px;height:450px;transform:scale(2.4,2.4);transform-origin:0 0;">
        <!-- sandbox content at 800×450 -->
      </div>
    </div>
  </foreignObject>
</svg>
```

The browser rasterizes the scaled div at 1920×1080 → sharp text.

## Implementation

### Phase 1: Preview Sharpness

**File:** `index.html` — per-clip renderer in drawCanvas()

1. **SVG dimensions** = canvas dimensions (`w` × `h`) instead of fixed 800×450
2. **Inner div** gets `transform: scale(w/800, h/450); transform-origin: 0 0;`
3. **Offscreen canvas** = canvas dimensions (not 800×450)
4. **display canvas** = canvas dimensions

```javascript
var scaleX = w / 800;
var scaleY = h / 450;
var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">'
    + '<foreignObject width="' + w + '" height="' + h + '">'
    + '<style xmlns="http://www.w3.org/1999/xhtml">' + _hr.css + '</style>'
    + '<div xmlns="http://www.w3.org/1999/xhtml" style="width:' + w + 'px;height:' + h + 'px;overflow:hidden;">'
    + '<div style="width:800px;height:450px;transform:scale(' + scaleX + ',' + scaleY + ');transform-origin:0 0;">'
    + dom
    + '</div></div></foreignObject></svg>';
```

**Result:** Preview renders at full 1920×1080 → sharp text matching native elements.

### Phase 2: Export Resolution

**File:** `index.html` — drawCanvas() already receives `targetW`/`targetH`

When `drawCanvas(targetCtx, exportW, exportH)` is called during export:
- `w = exportW`, `h = exportH` (e.g., 2560×1440 for 2K, 3840×2160 for 4K)
- SVG renders at exportW × exportH
- Inner div scales proportionally

No extra code needed — the same `scaleX = w / 800, scaleY = h / 450` formula
automatically renders at export resolution.

**Export resolutions supported:**
| Preset | Canvas Size | Scale Factor | Quality |
|--------|------------|--------------|---------|
| 1080p | 1920×1080 | 2.4× | Sharp |
| 2K | 2560×1440 | 3.2× | Very sharp |
| 4K | 3840×2160 | 4.8× | Ultra sharp |

### Phase 3: Performance Optimization

Rendering at 1920×1080 (3.6× more pixels than 800×450) may be slower.
Mitigations:

1. **Frame caching** — cache rendered frames per (clipId, time) pair.
   Only re-render when time changes or clip code changes.

2. **RequestAnimationFrame budget** — if rendering takes >16ms,
   fall back to 800×450 for preview and only render at full res
   when playhead is stationary (scrubbing).

3. **Display canvas reuse** — the double-buffer pattern already
   avoids re-rendering when the image hasn't loaded yet.

## Affected Code

| Location | Change |
|----------|--------|
| `index.html:6649` | Per-clip renderer init: canvas size = `w × h` |
| `index.html:6670` | SVG generation: dimensions = `w × h`, inner div gets `transform: scale()` |
| `index.html:6700` | `img.onload`: draw to render canvas at `w × h` |
| `index.html:6710` | `drawImage`: already correct (`-w/2, -h/2, w, h`) |

## Testing

1. Add HIC clip → verify sharp text at 1080p preview
2. Export at 1080p → verify sharp in exported video
3. Export at 2K → verify sharp in exported video
4. Compare HIC text sharpness with native text element
5. Performance: measure render time per frame at 1920×1080
