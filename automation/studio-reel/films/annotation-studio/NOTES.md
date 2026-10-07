# Annotation Studio — draw on anything — Notes

*Seven scenes, 74 seconds, twelve annotation marks. Sixth film, and the first
to use every `shape` kind the emitter supports.*

---

## 1. Every product claim, against the mock — read this first

Every fact in the film is copied from the reference build in `reference/` —
`v1.3-aspect-ratios.html` (106,837 bytes), the newest mock of *Annotation
Studio Pro*. Nothing is invented, and nothing needs re-verification against a
network: the mock ships in this repo's tree, so each line below can be checked
by opening one file.

| scene | claim | where it comes from | confidence |
|---|---|---|---|
| s1 | "Annotation Studio Pro · v1.3" | `<title>Annotation Studio Pro</title>`, filename `v1.3-aspect-ratios.html` | high |
| s1 | arrows, rings, boxes, highlights; export as video, GIF or PNG | the shape toolbar (`data-tool` arrow/line/rect/circle/…) and the export panel (`btn-export`, `exportSnapshot` → `toDataURL('image/png')`) | high |
| s2 | the nine chips: select · arrow · line · rect · circle · ellipse · triangle · diamond · star | every `data-tool` attribute in the mock, verbatim (`select` included; `arc_arrow` excluded from the chips because s2's closing line names it) | high |
| s2 | "Arc Arrow" exists | `data-tool="arc_arrow"` with its own title | high |
| s3 | Rough.js 4.6.6; roughness and bowing are sliders | script tag `rough.js` + the Roughness / Bowing range inputs in the Rough Style panel | high |
| s3 | seven fill patterns, named | the Fill Pattern select: Hachure (Sketchy) · Solid · Zig-Zag · Cross-Hatch · Dots · Sunburst · Dashed — all seven, in the select's own order | high |
| s4 | FHD 1920 / QHD 2560 / UHD 3840 | the export panel's FHD Class / QHD Class / UHD Class options, and the literal 1920 / 2560 / 3840 in the export code | high |
| s4 | MP4 or WebM, plus GIF, plus PNG snapshot | `btn-export` formats (MP4/WebM, GIF) and "Export PNG Snapshot" | high |
| s5 | 16:9 Landscape · 9:16 Portrait · 1:1 Square | the Aspect Ratio panel, verbatim labels | high |
| s5 | Transparent → WebM with no background | `transparent-toggle` checkbox + the `transparent WebM` path in the recorder | high |
| s7 | Undo / Clear / Preview / Export | the four toolbar buttons | high |
| s7 | Rough.js 4.6.6 · gifshot 0.3.2 | script tags `rough.js` and `gifshot/0.3.2/gifshot.min.js` | high |

The one row worth naming anyway is s3's stat: it is a bare integer over a
`·`-separated list, so if the mock's select ever grows an eighth value, the
`value` and the `label` change in one edit — the list is the select's, in the
select's order.

## 2. What the shape element had to be

The film wanted marks that draw themselves: a ring that closes around a word,
an arrow that points, a highlighter that wipes. `shape` grew three kinds for
it — `circle`, `arrow`, `highlight` — plus the overlay class that aims them.

### Overlay geometry is the target's box, not a viewBox guess

A mark overlays its target: the wrapper carries `hss-overlay` (or
`hss-overlay-ring` for the wider circle padding) and is moved into the host's
box at setup. The circle stretches a `viewBox 0 0 100 100` ellipse over that
box with `preserveAspectRatio="none"` and `vector-effect: non-scaling-stroke`,
so it hugs any aspect at a constant 3px; `pathLength="1"` normalises the dash
so the runtime never needs the length of a scaled ellipse. The arrow is the
opposite: a **fixed-pixel** 160×56 svg anchored to one edge, because a
host-relative arrowhead is squeezed by whatever ratio the target happens to
be — a mark whose head collapses into a sliver stopped reading as an arrow.
The tip math is asserted by measurement, not by eye: tip lands 2px inside the
target's own edge at 1920×1080.

### Two bugs the gates could not have caught, and how they were found

1. **The overlay move lived in `onFrame`.** The scenes preview settles without
   ever calling `onFrame`, so the mark's wrapper never moved: every ring drew
   itself across the whole stage and every highlighter painted the entire
   scene amber. Found by *looking at the scenes page*. The patch now lives
   inside `_hssSetup` — the one hook every consumer runs — guarded by
   `parentNode` so it is a real once-only move, not a per-frame reinsert.
2. **The CSS said `hss-arrow-l/r/t/b`, the markup said
   `hss-arrow-left/right/top/bottom`.** The horizontal anchor never matched, so
   the arrow drew *across* the words it was pointing at — with every gate
   green, because no gate compares emitted classes to styled classes. Both
   halves are now asserted together in reel-regression: every side the emitter
   emits must have an anchor rule.

### `num_color` was silently dropped

The stat branch resolved ONE colour for both the numeral and the caption, so
the-peak's authored brand numeral shipped in the caption's muted ink while the
schema kept claiming `num_color` was APPLIED. The film surfaced it because
this one authors a blue numeral over a dark caption. Now resolved separately,
and asserted.

## 3. What grew, gate by gate

- **storyboard.schema.json** — `shape` became an enum (box/underline/circle/
  arrow/highlight), new `side`, entrance `type` gained `draw`.
- **reel-compile.cjs** — an explicit `shape` branch: kind asked of the emitter,
  `of` required and scene-local (a cross-scene overlay hides on the wrong
  clock), `side` validated with the emitter's own message, `num_color` fixed.
- **hic-storyboard.js** — three kinds, `unknownShapeError` /
  `emitterSupportsShape` / `unknownArrowSideError` (the throwing-default
  philosophy applied one level down: an unknown *kind* used to render the
  default border), `_draw` + the `draw` entrance + settle branches.
- **reel-regression.cjs** — 102 → 130 checks: mark markup, throws, probes,
  reconcile refusals, schema pointers, class/CSS agreement.

## 4. What is NOT checked

`reel-extent` skips absolutely-positioned children when it measures a host, so
the arrow's stem reaching outside the overlay box is measured only through the
mark's own row — the tip's overlap INTO the target is by design (2px) and is
not a number any gate sees. The highlighter's alpha over paper is also outside
the contrast gate's model: the gate measures the text against the stage, not
against a translucent sibling. The film's answer is authoring discipline —
ink is `#131720`, highlights are light tints at 0.4, and every highlighted
element is display-size type where AA needs only 3:1 — stated here because a
rule nobody wrote down is a rule the next film will break.
