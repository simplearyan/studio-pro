# Draw Tool & Brush Engine — Plan

> Goal: let users pick a **Draw tool**, sketch realistic ink strokes directly on the canvas,
> then treat each sketch as a **clip** — selectable, transformable, recolorable, animatable —
> with a **brush library** (markers, brush pens, chisel, calligraphy…) to choose strokes from.

**Sources analyzed:**
- `canvas-animator/thumb-maker ✅/studio_pro.html` — working "Draw" tool (pencil) in an element-based editor
- `canvas-animator/MarkerForge Pro ⭐⭐⭐/markerforge_pro_merged.html` — 9-tool realistic brush engine (p5.js) with pressure, texture, blend modes, playback/export

**Target:** `index.html` (Studio Pro Editor) — currently has **no** drawing capability.

---

## 1. What the sources actually do

### 1.1 thumb-maker's draw tool (the model for *integration*)

Surprisingly simple and proven — the whole feature is ~120 lines:

- `btnAddDrawing` arms `state.isDrawingMode = true` (button gets a ring highlight, cursor → crosshair).
- `mousemove` appends `{x, y}` points to `state.currentDrawingPoints` while armed.
- `mouseup` finalizes: computes the **bounding-box center**, converts points to
  **center-relative coordinates** (`relPoints = p - {cx, cy}`), and pushes an element:
  ```js
  { id, type: 'drawing', x: cx, y: cy, points: relPoints,
    strokeEnabled: true, strokeColor: '#ff0000', strokeWidth: 5,
    scale: 1, rotation: 0, hidden, locked, opacity, blendMode, dropShadowEnabled }
  ```
- Because points are center-relative, the standard **move/scale/rotate** pipeline works
  unchanged: it just translates to `el.x/y`, multiplies point coords by `el.scale`,
  rotates by `el.rotation`, and strokes with `lineCap/lineJoin: round`.
- Renders in the main `render()` loop via the same z-order as every other element;
  properties panel, layers list, marquee-select, hit-testing (per-segment distance check),
  presets (points saved/restored), undo — all reuse the existing per-type switches.

**Lesson: a stroke is just an element whose geometry is a point list, not a rect.**
Selection/drag/scale/rotate/opacity all come free once points are center-relative.

### 1.2 MarkerForge's brush engine (the model for *stroke quality*)

A p5.js sketch with 9 tools, each a distinct stroke renderer in `drawBrushSegment(target, pt, strokeData)`:

| Tool | Technique | Signature look |
|---|---|---|
| `fine` | round-cap line | clean fineliner |
| `chisel` | repeated parallel segments along fixed 45° angle | sharp-edged chisel tip |
| `highlighter` | chisel at 40% alpha, `multiply` blend | translucent sweep |
| `wetMarker` | overlapping circles (80% size) + **random bleed blobs** | wet ink bleeding into paper |
| `dryErase` | many tiny circles across stroke width, **perlin-noise dropout** | streaky whiteboard marker |
| `brushPen` | circle size mapped to **speed** (slow = fat, fast = thin) | pressure-like dynamics |
| `paintMarker` | full-size circles + speckle spray at edges | opaque paint marker |
| `calligraphy` | thin line swept by angled nib segment | formal nib lettering |
| `eraser` | `destination-out` composite | true eraser |

Per-stroke params: `size`, `opacity`, `texture` (0–100 noise), `angle` (nib), `color`,
`blendMode` (auto per tool). Strokes are stored as `{tool, color, size, opacity, texture, angle, points:[{x,y,px,py}]}` —
points carry the **previous point** so segment spacing can modulate effects.
Also demonstrates: stroke **history** model, playback scrubbing (replay strokes over time),
export at higher scale (redraw with `baseExportScale`).

**Lesson: brush variety is a pure function of *how you rasterize a segment* —
it ports cleanly off p5.js onto vanilla Canvas2D** (`ctx.globalCompositeOperation` replaces
p5 blend modes; simple math replaces `p.noise` with a seeded value-noise).

---

## 2. How our editor differs (constraints that shape the plan)

| Difference | Consequence |
|---|---|
| Our unit is a **clip on a timeline**, not a floating element | A finished stroke becomes a `type:'draw'` **visual clip** (add to `VISUAL_CLIP_TYPES`) with start/duration/track — so it composites, z-orders, animates, exports like any clip |
| Render pipeline is **deterministic** (`renderClipAt(t)`) for export parity | Ink must render **without ambient state** — pure function of clip data + time. Both sources already satisfy this (no rAF-dependent state) |
| Canvas interaction is clip-**selection**-first | Draw mode is a **modal tool**: toolbar button arms it (like thumb-maker's ring highlight), it auto-disarms on mouseup, landing you straight in selection mode with the new clip selected |
| Export rasterizes via worker/offscreen canvases | Draw clips render identically offscreen — the ink function takes a `ctx` param; no DOM |
| `mcIsVisual` / clip-type lists were just consolidated | One new type must join: `VISUAL_CLIP_TYPES`, layer list, hit-test, properties panel, presets, the shared helpers from the hardening sweep |

---

## 3. Architecture: the `draw` clip

```js
clip = {
  id, type: 'draw',
  name, trackId, start, duration,
  x, y,                  // center of the ink's bounding box (canvas coords)
  scale, rotation, opacity, blendMode,
  strokes: [             // NEW: multi-stroke (MarkerForge model), back-compat single-stroke
    { tool: 'wetMarker', color: '#2563eb', size: 12, opacity: 100,
      texture: 30, angle: 45,
      points: [{x, y, px, py, t}] }   // center-relative + t for future draw-on animation
  ],
  seed: 1234,            // fixed seed → texture/noise/bleed are deterministic per clip
  anim: { mode: 'static' /* | 'drawOn' | 'wipe' */, dur: 800 }
}
```

**Key decisions:**
1. **`points` stay center-relative** (thumb-maker's trick) → drag = move `x/y`, scale = multiply
   coords, rotate = rotate coords. The whole existing transform pipeline applies untouched.
2. **Ink = raster segments drawn live** (not baked bitmaps). Recoloring = change `strokes[i].color`
   and re-render. Resolution-independent at every export size. Determinism comes from the
   per-clip `seed` (all noise/bleed calls are seeded — *required* since MarkerForge uses
   `p.random()` which would break frame-seeking).
3. **Multi-stroke per clip**: one Draw session = one clip holding all strokes drawn until the
   user clicks Select or presses Esc/Enter (thumb-maker ends on a single stroke — too limiting
   for sketching a diagram). `eraser` becomes a normal stroke with `destination-out`, scoped to
   its own clip so it can never erase other clips.
4. **p5.js does NOT come along.** All 9 brush renderers translate to ~15 lines each of vanilla
   Canvas2D in a new `BRUSHES` table — one function per tool: `f(ctx, seg, stroke, scale, seedRnd)`.
   Our renderer calls it per segment during clip rendering. Zero new dependencies.

---

## 4. Phases

### Phase 1 — Draw tool MVP (thumb-maker parity, one session)
- `type:'draw'` clip + `BRUSHES = { pen: … }` (single round-cap pen, color+size+opacity)
- Toolbar button (pencil icon) → arm draw mode (ring highlight, crosshair cursor) →
  live preview stroke while dragging → mouseup commits clip, auto-selects, disarms
- Multi-stroke session: keep drawing until Esc/Enter/Select click; each mouseup stroke appends
- Insert into `VISUAL_CLIP_TYPES`, timeline layer (✏️ icon), hit-test (segment-distance),
  render at time (static), export paths
- Properties panel: color, size, opacity + standard transform card (already generic)
- Undo/redo + project save/load (strokes are plain JSON — free)

### Phase 2 — Brush engine (MarkerForge port, 1–2 sessions)
- Port all 9 renderers to the `BRUSHES` table; seed-based value-noise replaces `p.noise`/`p.random`
- **Brush picker UI**: flyout from the Draw toolbar button — grid of tool cards with
  live-drawn stroke previews on tiny canvases (self-demonstrating icons); each tool shows its
  relevant params (texture/angle hidden for tools that ignore them)
- Eraser as `destination-out` composite scoped to the active draw session
- Determinism validation: export a frame twice → byte-identical PNG

### Phase 3 — Customize & animate (per user's ask)
- **Post-draw editing**: select a draw clip → properties show *Brush (change tool per stroke),
  Color, Size, Texture, Opacity, Nib angle, Smoothing*, plus **Restroke** (re-enter draw mode
  appending strokes) and **Simplify** (RDP point reduction → smaller projects)
- **Colorways**: "recolor all strokes" / per-stroke color chips list
- **Animate**: `anim.mode:'drawOn'` — strokes reveal progressively using the recorded `t`
  order and segment lengths (classic whiteboard effect, fully deterministic); `wipe` mode
  uses a clip-path sweep. Keyframeable scale/rotation/opacity comes free via the existing
  keyframe system since draw is just another visual clip
- **Presets**: 4–6 bundled ink presets (sketch underline, circled highlight, arrow callout,
  signature flourish) that place a ready-made draw clip

### Phase 4 (future) — brush library growth + AI
- Expand library from the same table: **spray paint, ink bleed+bleed pooling, pencil graphite,
  neon glow, confetti/particle brush** — each is one new function, no architecture change
- Import MarkerForge stroke JSON (format is documented above) → paste-in asset reuse
- **AI prompt integration** (ties into the HIC work): a prompt module that instructs the AI to
  emit a `strokes[]` array (simple geometric paths — underlines, circles, arrows) which lands
  as a draw clip — hand-drawn accents without the user drawing them

---

## 5. File changes

| File | Change |
|---|---|
| `index.html` | `VISUAL_CLIP_TYPES` + `'draw'`; draw-mode state machine on canvas mouse events; `BRUSHES` table + render branch in clip compositor; brush flyout + properties cards; save/load (JSON-only) |
| `docs/features/…Plan.md` | this doc |

No new dependencies. No worker changes. ~600–800 lines total across phases.

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Non-deterministic texture breaks export seeking | seeded PRNG per clip; Phase-2 byte-identical test |
| Hit-testing cost on huge point lists | RDP simplify on commit (default on, toggleable) |
| Draw mode conflicts with drag/marquee handlers | one `state.drawMode` guard at the top of the existing mouse pipeline (same pattern as thumb-maker) |
| Eraser escaping its clip | eraser strokes render only within their own clip's composite pass |

**Recommended start: Phase 1** — it's a single session and delivers the full
select → draw → select → customize loop the user asked for, with the brush library
landing as pure additions afterward.
