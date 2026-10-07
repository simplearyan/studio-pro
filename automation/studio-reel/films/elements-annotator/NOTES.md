# Vox Emphasis Animator — say it louder — Notes

*Eight scenes, 83 seconds, nine marks. Seventh film, and the one that added
`dbl-underline` to the shape vocabulary.*

---

## 1. Every product claim, against the mock — read this first

Every fact is copied from `reference/v0.4-perfect-.html` (69,450 bytes), the
file named in the brief. The folder also holds v0.5–v0.7 and a second v0.4
copy; this film describes **v0.4-perfect-.html** and nothing else, because
that is the build it quotes.

| scene | claim | where it comes from | confidence |
|---|---|---|---|
| s1 | "Vox Emphasis Animator" | `<title>` and the header's own name | high |
| s1 | circle it, rule it, highlight it — the pen draws itself | the three library sections (THE CIRCLE / THE HIGHLIGHTER / THE STROKE SCALE) and the draw-on animation the whole mock exists for | high |
| s2 | the three mark names | the brief, and the mock's element kinds: `straight_highlight`, `straight_line`, ellipse circles | high |
| s3 | "perfect oval, organic wobble, messy scribble, double loop, single overlap" | the Pen Stroke Style vocabulary, verbatim UI strings | high |
| s3 | four pen presets, wobble 0.0–0.25, passes 1.0–3.5 | the library defs: circle_clean (wobble 0.0, passes 1.0), circle_pen_single (0.1, 1.2), circle_pen_double (0.15, 2.2), circle_pen_messy (0.25, 3.5) | high |
| s4 | standard yellow / bright green / electric cyan / neon pink | the highlighter colour names, verbatim | high |
| s4 | opacity .7 default | `hl_yellow: { … opacity: 0.7 … }` | high |
| s5 | two pixels to twelve | stroke_thin `width: 2`, stroke_thick `width: 12` | high |
| s5 | draw duration, loops / passes, drawn backwards | the properties panel: `prop-duration`, `prop-passes`, `prop-reverse` ("Draw Backwards") | high |
| s6 | 16:9 (HD) / 9:16 (Shorts) / 1:1 (Square) | the Canvas Size control, verbatim labels | high |
| s6 | WebM Video, GIF Anim, PNG Snap; files named `emphasis-…` | the export panel, and the download links: `emphasis-${Date.now()}.webm/.gif/.png` | high |
| s7 | the four sample texts | the drag-elements library, verbatim: "A bold claim!" / "A delicate note" / "Look at this!" / "Extra importance" | high |
| s7 | "Drag an element onto the canvas." | the empty-state copy, verbatim | high |
| s8 | Preview / Stop / Undo / Clear | the toolbar buttons, verbatim | high |
| s8 | v0.4, Inter, wobble/passes | filename, the one font import, the two sliders above | high |

Nothing in this film is a number that could rot: every claim is a UI string or
a literal from a shape definition in the reference file.

## 2. The double rule: what the brief asked the emitter for

"Double line" did not exist. The shape vocabulary had `box`, `underline`,
`circle`, `arrow`, `highlight` — the legacy underline is a single CSS bar that
fades in with its host, and the brief wants a double rule that draws itself.
So `dbl-underline` joined the vocabulary the same way the other three marks
did: one kind, one SVG, one animation contract.

### Why SVG and not two CSS bars

The film's whole argument is that the pen follows the words. A CSS bar has no
progress to interpolate — it can only fade. Two `<line>` nodes with
`pathLength="1"` and a dash are two draw nodes, and `_draw` already speaks
`data-k="draw"` (the circle and arrow use it), so the new kind needed **zero
runtime changes**: markup + CSS only, and `settle()` already finishes it.

### Why a fixed 12px strip, not an inset:0 box

The rules live in a `viewBox="0 0 100 12"` pinned `bottom:-9px` with a fixed
height. A full-box SVG would make the gap between the two rules scale with the
text's line height — a "double underline" whose lines drift apart on a 64px
headline and nearly touch on a 24px body line. Horizontal lines do not care
that the x-axis stretches (same argument as the circle's ellipse), and
`non-scaling-stroke` keeps both rules 3px at any width.

### The class/CSS lesson, re-applied before writing it

Film six shipped `hss-arrow-l` in CSS against `hss-arrow-left` in markup — a
styled class nobody emits, invisible to every gate. The new kind was written
the other way round (markup first, CSS matched against it) and reel-regression
now asserts the same contract for every arrow side. The `dbl-underline` check
asserts markup, draw-node count and the CSS rule together, because a mark that
renders as an unstyled `<svg>` is the silent loss this pipeline exists for.

## 3. What grew, gate by gate

- **hic-storyboard.js** — `SHAPE_KINDS['dbl-underline']`, its `shapeInner`
  branch, `.hss-shape-dbl-underline` in the border-reset group, `.hss-dbl`
  geometry + line stroke CSS. No runtime change: `_draw`/settle already speak
  `data-k="draw"`.
- **storyboard.schema.json** — the `shape` enum gained `dbl-underline` with
  its description.
- **reel-regression.cjs** — the kind list in the probes check and one new
  markup assertion (130 checks total).
- **reel-compile / reel-fidelity / reel-contrast / reel-extent** — no change:
  the film is discovered automatically, and the shape branch added for film
  six validates any kind the emitter answers yes to.

## 4. What is NOT checked

Same two gaps as film six, restated because they are now reel-wide: a mark's
overlap INTO its target (the ring's -14px, the rule's -9px) is design intent
that no gate measures, and the highlighter's alpha sits outside the contrast
gate's backdrop model. The authoring rules that cover them: ink `#18181b`,
highlighter tints at 0.4 over light paper, highlights only on display-size
type. The film's measured floor is 4.27:1 (rose overline, bold 20px — AA
large), every one of 47 text nodes passing.
