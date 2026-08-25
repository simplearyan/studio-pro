# html2canvas vs WAAPI vs SVG foreignObject — Comparison

## Current State (html2canvas)

| Aspect | Value |
|---|---|
| **How it works** | Re-implements CSS rendering in JavaScript, "screenshots" DOM to canvas |
| **Speed** | ~500-1000ms per frame |
| **Fidelity** | ~70% — misses many CSS features |
| **Dependencies** | html2canvas.min.js (~45KB) |
| **Animation support** | ❌ None — static capture only |
| **Status** | ✅ Working in production |

## Future: WAAPI Seek Engine

| Aspect | Value |
|---|---|
| **How it works** | Uses browser's native `getAnimations()` to seek CSS keyframes |
| **Speed** | ~0ms (synchronous, native browser API) |
| **Fidelity** | 100% — browser's own renderer |
| **Dependencies** | 0 — built into all modern browsers |
| **Animation support** | ✅ Full — CSS keyframes, WAAPI, JS animations |
| **Status** | 🔬 Experimental (this folder) |

## Future: SVG foreignObject

| Aspect | Value |
|---|---|
| **How it works** | Wraps DOM in SVG `<foreignObject>`, draws as Image to canvas |
| **Speed** | ~5-15ms per frame |
| **Fidelity** | ~95% — preserves layout, fonts, CSS |
| **Dependencies** | 0 — pure native browser APIs |
| **Animation support** | ⚠️ After WAAPI seeks animations to correct frame |
| **Status** | 🔬 Experimental (this folder) |

## Speed Comparison

```
html2canvas:     ████████████████████████████████████████████ 500ms
SVG foreignObj:  ██ 10ms
WAAPI seek:      ▏ 0ms (sync)
```

**SVG foreignObject is ~50x faster than html2canvas.**
**WAAPI seek is instantaneous (synchronous).**

## Quality Comparison

| Feature | html2canvas | SVG foreignObject | WAAPI |
|---|---|---|---|
| Flexbox layout | ⚠️ Partial | ✅ Good | N/A |
| Grid layout | ⚠️ Partial | ✅ Good | N/A |
| CSS gradients | ✅ Yes | ✅ Yes | N/A |
| Box shadows | ✅ Yes | ✅ Yes | N/A |
| Border radius | ✅ Yes | ✅ Yes | N/A |
| Google Fonts | ⚠️ Sometimes | ✅ Yes | N/A |
| CSS animations | ❌ Static only | ✅ After seek | ✅ Native |
| `backdrop-filter` | ❌ No | ⚠️ Maybe | N/A |
| Cross-origin images | ❌ No | ❌ No | N/A |
| `clip-path` | ⚠️ Partial | ✅ Yes | N/A |

## Recommended Approach

1. **For preview (live editor):** Keep current html2canvas for now. It works.
2. **For animation preview:** Use WAAPI seek + html2canvas capture (seek first, then capture).
3. **For export (future):** Replace html2canvas with SVG foreignObject (~50x faster).
4. **For maximum quality:** Use WAAPI + SVG foreignObject together.

## Migration Path

```
Phase 1 (NOW):     html2canvas (working, stable)
Phase 2 (TEST):    WAAPI seek + html2canvas (seek animations, then capture)
Phase 3 (OPTIMIZE): WAAPI seek + SVG foreignObject (fast capture)
Phase 4 (PERFECT):  drawElementImage (Chrome native, when available)
```
