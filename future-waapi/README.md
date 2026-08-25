# Future WAAPI — Experimental Animation System

This folder contains the **next-generation animation system** for StudioPro HTML clips. It's kept separate from the main editor so the working html2canvas approach remains stable.

## What's Here

| File | Purpose |
|---|---|
| `lib/waapi-seek.js` | WAAPI seek engine — seeks CSS keyframe animations deterministically |
| `lib/svg-renderer.js` | SVG foreignObject capture — replaces html2canvas (5-15ms vs 500ms) |
| `lib/data-animate-adapter.js` | Converts `data-animate` attributes to WAAPI animations |
| `examples/animated-slide.html` | Example HTML clip using CSS keyframes + WAAPI seeking |
| `examples/data-animate-slide.html` | Example using declarative `data-animate` attributes |
| `docs/IMPLEMENTATION-GUIDE.md` | Step-by-step guide to integrate into main editor |
| `docs/COMPARISON.md` | html2canvas vs WAAPI vs SVG foreignObject comparison |

## How to Test

1. Open `examples/animated-slide.html` in Chrome
2. Open DevTools console
3. Run:
```javascript
// Seek to frame 0 (start)
window.seekToFrame(0, 30);

// Seek to frame 30 (1 second in)
window.seekToFrame(30, 30);

// Seek to frame 60 (2 seconds in)
window.seekToFrame(60, 30);
```

4. Watch the CSS animations jump to the exact frame

## How to Integrate (When Ready)

See `docs/IMPLEMENTATION-GUIDE.md` for the exact steps to merge into the main editor.

**Key principle:** The main editor keeps working html2canvas. This folder is for experimentation only. When WAAPI is proven, merge it in.

## Status

- [x] WAAPI seek engine designed
- [x] SVG foreignObject renderer designed
- [x] data-animate adapter designed
- [ ] Tested with real HTML clips
- [ ] Integrated into main editor
- [ ] Export verified
