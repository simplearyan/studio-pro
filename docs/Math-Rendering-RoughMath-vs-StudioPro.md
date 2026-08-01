# Math Rendering: Rough Math vs Studio Pro

> A side-by-side analysis of how two of our studios render LaTeX math, and what that means for performance, quality, and features.

| | **Rough Math** (`rough_math_animator-emoji.html`) | **Studio Pro** (`studio-pro-editor/index.html`) |
|---|---|---|
| Math engine | MathJax 3 `tex-svg` (`fontCache: 'local'`) | MathJax 3 `tex-svg` (`fontCache: 'none'`) |
| Core render model | **Vector shapes** — parses the SVG path data and redraws every path as a shape | **Rasterized image** — serializes the SVG, loads it as an `Image`, and blits it |
| Style aesthetic | Hand-drawn / sketch (rough.js roughness, bowing, hachure fill) | Clean & crisp (crisp glyphs, canvas stroke/extrude/shadow) |
| Output target | Single canvas + video/image export | Full timeline editor + MediaBunny MP4/WebM export |

---

## 1. How Rough Math renders (vector shapes)

**Pipeline:**

```
LaTeX text → MathJax tex2svg (SVG DOM) → extractPaths() → rough.js draws each path on canvas
```

The key function is `extractPaths(svgElement)`:

1. Collects every `defs path` (MathJax stores glyph outlines in `<defs>`).
2. Walks the SVG DOM, tracking a `DOMMatrix` transform stack per node (`<g transform>`, `<use href>`, `<path d>`, `<rect>`).
3. Produces a flat array of `{ d: pathData, matrix: DOMMatrix }` — the *raw vector outlines* of every glyph, fraction bar, bracket, etc.
4. `renderMathCore()` scales the whole thing to the canvas, then calls `rough.canvas(canvas).path(d, options)` for **each path individually**, so every glyph is a real, redrawable vector shape with rough.js's sketch parameters (roughness, bowing, seed, hachure/solid fill).

**Consequences of the vector model:**

- ✅ **Path-by-path animation** — `currentDrawIndex` draws only the first N paths, which produces the signature "equation is being hand-drawn" effect. Only possible because paths are kept as separate vector entities.
- ✅ **Rough/sketch aesthetic** — rough.js intentionally re-sketches each path with jitter; there is no other way to get this look.
- ✅ **Resolution independence** — re-rendering at 4K just scales the same paths; nothing gets blurry.
- ❌ **Slow per-frame** — every redraw re-runs rough.js's path sampling for *every glyph*. With "boiling" animation (re-sketched every frame) and big equations (dozens–hundreds of paths), this is the most expensive render loop of the two.
- ❌ **No true fill fidelity** — rough.js hachure/solid fill only approximates solid glyph interiors; strokes are drawn multiple times (jitter), so it cannot produce a perfectly crisp outline.

---

## 2. How Studio Pro renders (rasterized image)

**Pipeline:**

```
LaTeX text → MathJax tex2svg (SVG DOM) → style (fill/stroke) → XMLSerializer → Blob → Image → cache → ctx.drawImage()
```

The key function is `getOrRenderMathImage(clip, colorOverride)`:

1. Renders the LaTeX with MathJax synchronously (`MathJax.tex2svg`), grabs the `<svg>`.
2. Applies fill color and (optionally) stroke to the SVG paths **before** rasterizing — stroke-width is converted into MathJax's huge viewBox units (e.g. `0 -700 12853 2795`) via a `px-per-viewBox-unit` computation so a 4px stroke actually renders as 4px.
3. Serializes to SVG markup → Blob URL → `new Image()` → **rasterized bitmap**.
4. Caches the record in `window.mathImageCache` keyed by `clip.id + text + fontSize + color + stroke`, with `clip._mathLastGood` / `clip._mathLastExtrude` remembering the last loaded frame so a style/size edit can keep drawing a *scaled* version of the old image while the new SVG rasterizes (zero flicker).
5. The canvas draws the bitmap with `ctx.drawImage(record.image, -w/2, -h/2, w, h)`, and all post effects (3D extrude layers, drop shadow, blur, blend modes, animation transforms) are applied by **canvas 2D at draw time**.

**Consequences of the image model:**

- ✅ **Fast per-frame** — once cached, a frame is one `drawImage` + canvas transforms. No per-glyph path re-sampling. This is why 60-second exports on a weak GPU (GT 740) still complete.
- ✅ **Crisp glyphs** — MathJax's own font rendering with fill `currentColor`; stroke baked with correct units gives clean outlines, stroke-only (outline) mode, and `paint-order` for tidy corners.
- ✅ **Cheap rich effects** — 3D extrude (draw N offset layers of a colored variant), drop shadows, blend modes, flip, opacity, per-clip animations — all trivial canvas ops on a bitmap.
- ✅ **Timeline-native** — math clips participate in tracks, trimming, keyframes, scenes, markdown generation, and MediaBunny export for free.
- ❌ **Rasterized once per config** — the cached bitmap is fixed at the render size; extreme zoom-in beyond the cached resolution looks soft (though `fontSize` re-rasterizes at the correct size, and a fallback keeps it smooth during the rebuild).
- ❌ **No per-glyph animation** — because the whole formula is one image, you can't animate "hand writing" path-by-path. (Per-line/per-word text animation exists via `animTextIn/Out`, but not per-glyph sketching.)
- ❌ **No sketch aesthetic** — the image model is crisp by nature; you can't make it look hand-drawn without post-processing.

---

## 3. Performance comparison

| Workload | Rough Math (vector/rough.js) | Studio Pro (image cache) |
|---|---|---|
| First render (cache miss) | MathJax SVG + parse paths + rough.js sketch all glyphs | MathJax SVG + serialize + Image decode (async) |
| Steady-state redraw (1 frame) | Re-sketches **every path** each frame (boiling) | One `drawImage` from cache |
| Large equation (e.g. Schrödinger) | Hundreds of paths × rough.js sampling/frame | One cached bitmap draw |
| High-res export (2K/4K) | Paths scale losslessly (good) but rough.js cost grows | Re-rasterizes SVG at target scale (crisp; cost is one-time) |
| CPU cost while idle | 0 (no loop) | 0 |
| CPU cost while animating | High — per-path sketch each frame | Low — transforms + blit |
| Memory | Path arrays (small) | One bitmap per unique clip config (cached) |

**Verdict:** for a *static or timeline-based* pipeline (Studio Pro), the **image model wins on speed by a wide margin**. For a *deliberately jittery sketch animator* (Rough Math), the vector model is the only way to get the effect — the speed cost is inherent to the aesthetic.

---

## 4. Feature comparison

| Feature | Rough Math | Studio Pro |
|---|---|---|
| MathJax LaTeX | ✅ | ✅ (math presets, TeX template buttons) |
| Hand-drawn sketch look | ✅ (rough.js roughness/bowing/hachure) | ❌ (crisp only) |
| Path-by-path "drawing" animation | ✅ (currentDrawIndex) | ❌ (whole-formula image) |
| Boiling/sketch re-jitter animation | ✅ | ❌ |
| Fill color | ✅ (solid/hachure via rough.js) | ✅ (fill baked into SVG) |
| Stroke / outline | ❌ (no crisp stroke; only rough stroke) | ✅ (exact px stroke, stroke-only mode) |
| 3D extrude | ❌ | ✅ (N offset layers) |
| Drop shadow | ✅ (sketched shadow) | ✅ (canvas shadow) |
| Timeline clips, tracks, trims | ❌ (single equation workspace) | ✅ (full NLE) |
| Keyframes / position / scale animation | ✅ (position/scale/sketch params) | ✅ (keyframes, animations, blend modes) |
| Export video | ✅ (MediaRecorder WebM) | ✅ (MediaBunny MP4/WebM, exact fps, fast mode) |
| Export high-res image | ✅ (temp canvas at chosen res) | ✅ (via export pipeline) |
| Markdown → auto clips | ❌ | ✅ |
| Works with subtitles/captions | ❌ | ✅ |
| Color/stroke follow clip styling | ✅ (style presets) | ✅ (full properties panel) |

---

## 5. Which is better?

There is no single winner — they optimize for different jobs:

**Rough Math is better when:**
- You want the *hand-drawn whiteboard explainer* look (3Blue1Brown-meets-sketch style).
- You want per-glyph drawing-on animations.
- You want a quick, focused equation workspace, not a full editor.

**Studio Pro is better when:**
- You want **fast, flicker-free rendering and export** (especially on low-end GPUs).
- You want clean, crisp, typographic math (textbook style).
- You want deep styling: exact strokes, stroke-only outlines, 3D extrude, shadows.
- You want the formula as a **timeline clip** inside a larger video (with animations, captions, markdown, MediaBunny export).

**The honest trade-off:**
- Vector (rough-math) = expressive, resolution-independent, but expensive to animate and inherently sketchy.
- Image (studio-pro) = fast, crisp, effect-friendly, but a whole formula is a single bitmap (no per-glyph animation, no sketch look).

---

## 6. Future ideas (get the best of both)

1. **SVG-inline rendering in Studio Pro** — instead of only a rasterized bitmap, also keep the parsed path list (like rough-math's `extractPaths`) and draw with `Path2D` for lossless zoom + per-element animation while keeping the canvas effect stack.
2. **Per-glyph reveal animation** — a Studio Pro math clip could render each path of the formula progressively (CapCut/After-Effects style write-on), combining studio's timeline + rough-math's draw-on idea.
3. **Sketch style option in Studio Pro** — optionally route the SVG through rough.js for a "math sketch" preset, so users get both aesthetics from one editor.
4. **Shared math rasterizer** — both studios use MathJax; a shared helper (parse SVG once, cache both the paths AND the rasterized bitmap) would let either studio switch models without rewriting the pipeline.
