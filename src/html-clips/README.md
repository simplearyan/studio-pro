# HTML Clips Module

A self-contained module for rendering HTML/CSS/JS clips to Canvas in Studio Pro.

## Overview

This module adds a new `html` clip type that lets users (and AI agents) write HTML/CSS to create complex visuals like gradient cards, glassmorphism effects, and data visualizations.

## Architecture

```
src/html-clips/
├── html2canvas.min.js    (198KB — bundled library)
├── renderer.js           (Core rendering engine)
├── editor.js             (UI components)
├── index.js              (Main exports)
└── README.md             (This file)
```

## How It Works

1. **User writes HTML/CSS** in the editor
2. **Renderer creates offscreen iframe** and writes content
3. **html2canvas captures** the iframe to a Canvas
4. **ImageBitmap is created** for fast drawing
5. **Bitmap is drawn** to the export canvas with effects

```
HTML string → iframe → html2canvas → ImageBitmap → Canvas
```

## Usage

### In index.html

```html
<!-- Load html2canvas (bundled, no CDN) -->
<script src="src/html-clips/html2canvas.min.js"></script>

<!-- Load HTML clips module -->
<script type="module">
  import { renderHtmlClip, drawHtmlClip } from './src/html-clips/index.js';
  
  // Make available globally
  window.HTMLClips = { render: renderHtmlClip, draw: drawHtmlClip };
</script>
```

### In drawCanvas()

```javascript
// Handle HTML clips
if (clip.type === 'html') {
  const bitmap = await HTMLClips.render(clip, width, height);
  HTMLClips.draw(ctx, bitmap, clip, State.currentTime, width, height);
}
```

### Creating HTML Clips

```javascript
// Using the API
const clip = HTMLClips.add({
  template: 'gradientCard', // or 'glassmorphism', 'minimal', 'dataViz'
  html: '<div>Custom HTML</div>',
  css: '.custom { color: white; }',
  duration: 5,
});

// Or create without adding
const clip = HTMLClips.create({
  html: '<h1>Hello</h1>',
  css: 'h1 { color: white; }',
});
```

### Editing HTML Clips

```javascript
// Open editor for a clip
HTMLClips.edit(clip);

// Or manually update
clip.html = '<div>New content</div>';
clip.css = '.new { background: red; }';
HTMLClips.clearCache(clip.id); // Invalidate cache
drawCanvas(); // Redraw
```

## Templates

| Template | Description |
|---|---|
| `gradientCard` | Purple gradient background with white text |
| `glassmorphism` | Frosted glass effect with blur |
| `minimal` | Clean black background with white text |
| `dataViz` | Simple bar chart visualization |

## Features

### Rendering

- ✅ Offscreen iframe rendering
- ✅ html2canvas capture
- ✅ ImageBitmap for fast drawing
- ✅ Render caching (skip if unchanged)
- ✅ Error handling with placeholder

### Effects (Same as other clips)

- ✅ Scale, rotate, opacity
- ✅ Stroke, shadow
- ✅ Fade in/out, slide, pop
- ✅ Shake, spin animations
- ✅ Blend modes
- ✅ Keyframes

### Editor

- ✅ HTML/CSS/JS text editors
- ✅ Live preview
- ✅ Template selector
- ✅ Apply/cancel buttons

## Performance

| Metric | Target |
|---|---|
| Render time | < 100ms per frame |
| Cache hit | < 1ms |
| Memory per clip | < 50MB |

### Optimization Tips

1. **Use caching** — Same HTML/CSS renders from cache
2. **Minimize DOM** — Simpler HTML renders faster
3. **Avoid animations in JS** — Use CSS animations when possible
4. **Pre-render for export** — Use `preRenderHtmlClips()` before export loop

## API Reference

### renderHtmlClip(clip, width, height)

Render an HTML clip to an ImageBitmap.

```javascript
const bitmap = await renderHtmlClip(clip, 1920, 1080);
ctx.drawImage(bitmap, 0, 0);
```

### drawHtmlClip(ctx, bitmap, clip, time, width, height)

Draw a rendered HTML clip with effects.

```javascript
drawHtmlClip(ctx, bitmap, clip, State.currentTime, 1920, 1080);
```

### createHtmlClip(options)

Create a new HTML clip object.

```javascript
const clip = createHtmlClip({
  html: '<div>Hello</div>',
  css: 'div { color: white; }',
  duration: 5,
});
```

### addHtmlClip(options)

Create and add an HTML clip to the current project.

```javascript
const clip = addHtmlClip({
  template: 'gradientCard',
  duration: 5,
});
```

### showHtmlEditor(clip)

Open the editor for an HTML clip.

```javascript
showHtmlEditor(clip);
```

### clearCache(clipId)

Clear the render cache for a clip.

```javascript
clearCache(clip.id);
```

### getCacheStats()

Get cache statistics.

```javascript
const stats = getCacheStats();
console.log(stats.size); // Number of cached clips
```

## Dependencies

| Library | Version | Size | Source |
|---|---|---|---|
| html2canvas | 1.4.1 | 198KB | Bundled (no CDN) |

## Browser Support

| Browser | Status |
|---|---|
| Chrome 90+ | ✅ Full support |
| Firefox 90+ | ✅ Full support |
| Safari 15+ | ⚠️ Limited (backdrop-filter) |
| Edge 90+ | ✅ Full support |

## Known Limitations

1. **backdrop-filter** — Not supported in all browsers
2. **CSS animations** — May not sync with export timing
3. **External resources** — Images must be CORS-enabled
4. **Memory** — Large HTML clips use more GPU memory

## Next Steps

- [ ] Add syntax highlighting to editors
- [ ] Add CSS property autocomplete
- [ ] Add live hot-reload
- [ ] Add component library
- [ ] Add export as standalone HTML
