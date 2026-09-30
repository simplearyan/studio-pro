# Studio Pro Editor — Concepts Feature Plan

> Mined from six concept files in `D:\Code\Antigravity\design_concepts\canvas-animator\`:
> VoxAnimator Pro, Sumi-e Studio Pro, MarkerForge Pro, Paint Studio Pro,
> Elements Annotator, Annotation Studio Pro.
> Status markers: ✅ shipped · 🔨 planned phase · 🔭 future vision.

---

## 0. Current state of the draw tool (what already exists)

| Capability | Status |
|---|---|
| 10-brush MarkerForge library (pen, eraser, chisel, calligraphy, highlighter, fine liner, dry erase, wet marker, brush pen, paint marker) | ✅ |
| Flat-nib band renderer — seamless translucent bands (highlighter) | ✅ |
| Per-brush settings (nib angle, ink opacity, ink blend, texture, size range) | ✅ |
| Write-through styling to already-drawn strokes, gesture-coalesced undo | ✅ |
| Draw-on reveal (monotonic, byte-exact final == static) | ✅ |
| Clip-scoped eraser, rotation-proof restroking | ✅ |
| perfect-freehand tapered pen ink, deterministic exports | ✅ |

The gap: shape clips are pure geometry with no hand-drawn character, there is no
sketchy style, no stampable annotation elements, no custom brush presets, and
the HTML-in-Canvas world has no annotation vocabulary.

---

## Phase A — Sketch style engine 🔨

The biggest visual win. Gives shape clips and draw strokes a hand-drawn
documentary look (Rough.js-style) **without the Rough.js dependency** — the
flat-nib band and polyline renderers already do most of the geometry work.

### A1. Core engine
- `sketchPath(ctx, pts, opts)` — re-renders a path as 2+ hand-drawn passes:
  each pass jitters every point by `wobble` (seeded, deterministic), adds
  midpoint bowing (`bowing` control), and offsets the second pass slightly.
- Seeded RNG from our existing `drawRng`/`dHash` — same seed in, same ink out.
- New knobs on the **Stroke** and **Shape** property panels:
  - **Sketch** — Off / Light / Sketchy / Messy (presets mapping to roughness)
  - **Wobble** — 0–10px point jitter
  - **Boiling** — toggle. VoxAnimator re-rolls its seed on wall-clock, which
    would break exports; ours derives the seed from
    `floor(clipTime / 100ms)` so boiling is frame-stable in exports yet
    wiggles at 10 fps in preview.
  - **Fill style** — solid / **hachure** (parallel sketch lines at a set
    angle + gap + weight) for shape clips.

### A2. Where it applies
- Shape clips: rect, circle, triangle, star, polygon → sketchy outlines +
  hachure fill option.
- Draw clips: pen/chisel/calligraphy strokes get the sketch jitter pass.
- Arrows (Phase B) render through the same engine.

### A3. Determinism contract
Every jitter/bow sample comes from a hash of `(seed, pass, pointIndex,
boilingBucket)`. No wall-clock, no Math.random. Export at any resolution or
seek position rasterizes byte-identically.

**Acceptance:** sketch shapes render identically across two renders; boiling
frame at t is stable across seeks; reveal + sketch compose; exports pixel-faithful.

---

## Phase B — Annotation element library 🔨

Port the Elements Annotator model: **stampable preset cards** you place, not
brushes you draw. Reuses Phase A's engine.

### B1. Element cards (drawer next to the shape tools)
| Element | Source | Default props |
|---|---|---|
| Hand-drawn circle | Elements Annotator | passes 1.2 (single) / 2.2 (double) / 3.5 (messy), wobble |
| Box / rectangle | Annotation Studio | sketch outline, hachure fill optional |
| Straight arrow | Annotation Studio | line + filled head that follows the drawing tip |
| Curved arc arrow | Annotation Studio | quadratic arc + head |
| Underline | VoxAnimator | stroke draw-on |
| Highlight swipe | VoxAnimator | translucent band (reuses flat-nib band) |
| Star / cross / check | Annotation Studio | emphasis stamps |

### B2. UX
- Click a card → clip created centered at the playhead; drag the card onto the
  canvas → placed at the drop point.
- Clip properties: color, width, passes, wobble, scale, draw-on duration,
  sketch roughness.
- These are shape-type clips internally, so timeline/undo/export come free.

**Acceptance:** stamp a circle, arrow, underline → all animate draw-on;
boiling + sketch compose with element props; selection box follows scale.

---

## Phase C — Ink physics brush pack 🔨

Port Sumi-e + Paint Studio brushes into `drawBrushes` with the existing
per-brush settings system. Every `p.random`/`p.noise` becomes `dHash`/`drawRng`.

### C1. Brushes
| Brush | Technique | New knob it introduces |
|---|---|---|
| **Fude** (angled ellipse core + kasure bristle scatter) | Sumi-e | Sensitivity |
| **Kasure** (dry-brush breaks) | Sumi-e | Depletion |
| **Menso** (fine detail) | Sumi-e | — |
| **Nijimi** (wet bleed rings) | Sumi-e | Bleed |
| **Bokashi** (soft gradient wash) | Sumi-e | Bleed |
| **Shibuki** (ink splatter) | Sumi-e | Scatter |
| **Hake** (flat wide brush, bristle lifting) | Sumi-e | Scatter |
| **Watercolor** (low-alpha bleed circles) | Paint Studio | Bleed |
| **Charcoal** (grainy scatter) | Paint Studio | Scatter |
| **Airbrush** (radial mist, center-biased) | Paint Studio | Scatter |

### C2. New shared knobs
- **Bleed** — ink spreads past the spine over time (wet media).
- **Sensitivity** — speed → width mapping (fast = thin).
- **Depletion** — ink runs out along the stroke; opacity decays by arc length.
- **Scatter** — particle density for splatter/charcoal/mist.

### C3. Determinism
- Speed-based taper (sensitivity) is resolved at **commit** time from the
  recorded point stream, never at render time — so exports can't differ.
- Splatter/bleed positions hash on `(strokeSeed, dabIndex)`.

**Acceptance:** each brush paints, per-brush settings swap live, reveal +
eraser + write-through compose, two renders byte-identical.

---

## Phase D — Custom brush presets 🔨

Paint Studio Pro's model, generalized:
- **Save preset** in the Ink card stores `{brush, size, nib, opacity, blend,
  texture, bleed, sensitivity, depletion, scatter}` under a user name in
  localStorage.
- Saved presets appear as chips at the top of the brush flyout.
- Presets are exportable as JSON (same pattern as the code-snippet gallery),
  so teams can share looks between projects.
- "Apply to all strokes" reuses the existing write-through machinery.

**Acceptance:** save a preset, switch brushes, re-apply from chip; write-through
respects it; JSON export/import round-trips.

---

## Phase E — HIC + AI prompt integration 🔨

1. **New AI prompt templates** in the test-renderer library:
   - "Documentary sketch annotation" — rough.js via the allowed CDN; boiling
     via `seed = floor(time / 100)` inside onFrame (deterministic per the
     contract since time is the only input).
   - "Sumi-e ink reveal intro" — brush strokes that draw on with bleed.
   - "Hand-drawn circle emphasis" — multi-pass sketch circles around key UI.
2. **HARD CONTRACT addition:** a sketchy-annotation clause (seed discipline +
   boiling bucket rule) so generated code stays frame-stable.
3. **HIC overlay clips:** the Phase B element library composited over html
   clips — annotate AI-generated designs without editing code.
4. **Prompts-engineer page:** a "Style" module exposing roughness / palette /
   brush as reusable prompt tokens.

---

## Future vision — one Style DNA 🔭

A project-level design token: palette + fonts + default brush + sketch
roughness. Canvas clips, draw ink, HIC presets, AI prompts, and exports all
read from it — a documentary-style project gets sketchy annotations, sumi-e
accents, and matching prompt templates everywhere. That is what makes complex
animations *easy*: the editor, the element library, and the AI vocabulary
share one language.

Sequencing: A → B (B depends on A) → C → D → E. A is first because this
morning's flat-nib band renderer is already the hard part of sketchy strokes.
