# The Peak Is Coming — Design

The fifth design language in the reel, after Material 3, neo-brutalism and the
portfolio. This one is **VOX editorial**: a near-black field, one saturated
yellow, everything set in a grotesque with the caps turned up.

Two things make it different from the four before it.

1. **The subject is the data.** The first four films are explained *about*
   something; this one is *about* numbers, so it is the first to use the `chart`
   element — six graphics across eight scenes.
2. **One theme, not two.** VOX's identity is a single flat field carrying one
   accent. A light variant would be a different publication rather than the same
   one dimmed, so there is no `design.modes`.

---

## 1. Palette — the VOX yellow on a near-black field

| token | hex | where |
|---|---|---|
| `bg` | `#0e1012` | the stage. Near-black, not black: a true `#000` clips the gridlines to nothing |
| `surface` | `#171a1c` | panel and tonal fills |
| `surface-hi` | `#22282b` | meter track |
| `on-surface` | `#f1f3f2` | body ink and chart value labels |
| `on-variant` | `#a3a8a6` | axis ticks, legends, standfirsts |
| `outline` | `#3d4346` | the axis rule |
| `brand` | `#ffeb00` | the accent. This is the colour VOX is |
| `brand-warm` | `#ffb020` | second stop of the stat numeral's gradient |
| `on-brand` | `#141414` | type reversed out of a yellow block |
| `series-1…6` | `#ffeb00` `#7cc4ff` `#ff7a59` `#7bdcb5` `#c9a6ff` `#e8eae9` | the categorical chart palette |
| `grid` | `#2e3437` | gridlines and axis ticks |

The public VOX colour reference most often cited is
`#ffeb00 · #444745 · #4c4e4d · #35313f · #f1f3f2` — a yellow, three greys and an
off-white. All five are used or adapted here: the yellow is `brand`, the
off-white is `on-surface`, and `#35313f` survives as `brand-deep` (kept in the
token table even though no scene currently paints it, because it is the
interface grey the rest of the palette was drawn against).

### Why the categorical palette is a THEME role

A five-colour series palette is part of the design language, not of any one
chart. Five graphics that each picked their own blue are five graphics that do
not look like one publication — which is a fact about the *design*, not about
any individual `series` entry.

So `s1…s6` are theme roles, mapped through `design.theme_map` to tokens, and a
series names one with `"color": "series-1"`. Two consequences follow:

- A second mode would swap the whole palette with one flag, instead of hunting
  for hand-picked hexes inside forty bars.
- The compiler resolves the name against the mode in force, so the *palette* is
  authored once and the *usage* is authored per chart.

`--hss-on-variant` and `--hss-chart-grid` are theme keys for the same reason.
The chart stylesheet reads them; a variable a stylesheet consumes and a theme
cannot set is a hardcoded colour wearing a `var()` costume, and this pipeline
already has a bug of exactly that shape (`baseBg`, and the `.hss-pill` ink read
from the wrong variable).

---

## 2. Typography — and the two substitutions

VOX's editorial faces are **Balto** (display) and **Alright Sans** (body). Both
are commercial licences. This film uses the closest free relatives and says so
rather than shipping a lookalike silently:

| role | shipped | stands in for | why this one |
|---|---|---|---|
| display, stat | **Archivo** 800 | Balto | a grotesque with the same narrow, high-contrast capitals — and a real 800 weight, which Balto's headline cut has and most free grotesques do not |
| lead, body | **Libre Franklin** 400 | Alright Sans | Alright Sans descends from Franklin Gothic; Libre Franklin is the same lineage, open |
| overline, mono | **JetBrains Mono** 700 | Balto Mono (n/a) | the eyebrow and every axis label. Already the repo's mono, so the film adds one font, not two |

**This is the honest limitation of the film.** A metrics-matched Balto is not
available for free, so the headline widths are Archivo's. If the studio licenses
Balto, only `design.fonts` and `font_href` change — no element names it.

### The ramp

| role | size | weight | tracking | case |
|---|---|---|---|---|
| `overline` | 22 | 700 | `0.2em` | upper |
| `title` | 104 | 800 | `-0.03em` | |
| `title_hi` | 62 | 800 | `-0.02em` | |
| `lead` | 32 | 400 | | |
| `body` | 26 | 400 | | |
| `mono` | 22 | 500 | `0.06em` | upper |

`title_hi` is doing double duty: it is the close's answer line, set in yellow.
That is deliberate — VOX editorial does not put the takeaway in a box, it just
sets it larger.

---

## 3. Shape and surface

```json
"radii":  { "pill": "999px", "card": "4px", "tile": "4px", "answer": "0" },
"radius": "4px",
"fills":  { "card": "filled", "tiles": "tonal", "pills": "outlined", "answer": "text" }
```

Nearly square. A 20px card radius is Material's language, and reusing it here
would make a VOX graphic look like an Android screen — the same argument that
made `design.radii` a per-component map in the first place.

`answer: text` because the closing line is a sentence. `card: filled` because a
headline number reversed out of a yellow block is the one visual move that reads
as this publication.

---

## 4. Chart chrome

Every chart carries its own `kicker`, `title`, `subtitle`, `unit` and `source`,
authored **inside the element** rather than as sibling text elements. An
editorial graphic and its headline are one object: as siblings they can be
reordered, or one can be edited without the other, and the number ends up
under a sentence describing a different number. The `source` line is not
optional decoration — a number without its provenance is the thing a data story
exists to fix.

```
┌ kicker ──────────────────────────────────────────┐
│ THE ENGINE                                       │  JetBrains Mono 700, yellow, 0.2em
│ That growth was a birth-rate story…               │  Archivo 800, ink
│ Babies per woman, by region.                      │  Libre Franklin, muted
│ ■ 1950–55   ■ 2020–25                             │  legend, only when >1 series
│ ┌───────────────────────────────────────────┐     │
│ │  gridlines ◄── the VALUE axis, never both  │     │
│ │  bars / line / arcs                        │     │
│ │  category labels, value labels             │     │
│ └───────────────────────────────────────────┘     │
│ SOURCE: UN WPP 2024            PER WOMAN = 7       │  foot: source + scale note
└───────────────────────────────────────────────────┘
```

The scale note on the right is *"unit = max"* — where the axis tops out. On a
donut there is no axis, so the note is suppressed rather than printing a number
that means nothing.

The grid follows the value axis: **vertical** rules on `bars`, **horizontal** on
`columns` and `line`. Drawing one orientation everywhere put a ladder of
horizontal rules behind a chart whose scale runs left to right and parked its
tick labels on top of the category names in the gutter.

---

## 5. Motion

Every chart is drawn from `t`, never from a CSS animation, for the same reason
the meter is: a transition reads the wall clock, and scrub, deep links and the
frame-diff gate would then disagree with each other.

- **bars** grow from the baseline (`data-by` → `data-ty`, interpolated)
- **line** draws itself via `pathLength="1"` and `stroke-dashoffset`
- **area** is revealed by a clip whose width the runtime owns, so the fill and
  the stroke arrive together
- **donut** grows each arc: `pathLength="1"` normalises a segment's share to its
  dash length, so the runtime never needs π
- **value labels** fade in behind their bar

`chart_in.stagger_ms` is the per-bar delay. Without it every bar of a series
moves as one slab, which is a block changing size rather than a chart being
drawn.
