# The Peak Is Coming — Notes

*Eight billion, and the line that bends back.* Eight scenes, 88 seconds, six
charts. The first film in the reel whose subject is the data, and therefore the
first to use the `chart` element.

---

## 1. Every number, against its source — read this first

The figures below are the published UN *World Population Prospects 2024*
aggregates **as they are commonly reported**, and they are the film's weakest
point. They were authored from public reporting, not read out of the WPP 2024
data portal — which is not available offline — so **before this ships anywhere,
every series must be re-verified against the source tables.** The film is an
engineering and design artefact; the numbers in it are not independently
audited, and a data story whose data has not been checked is the exact thing it
claims to be about.

| scene | series | what it claims | confidence |
|---|---|---|---|
| s1 | `8.2` billion | world population, 2024 | high — universally reported |
| s2 | 1 / 2 / 3 / 4 / 5 / 6 / 7 / 8 bn at 1804 / 1927 / 1960 / 1974 / 1987 / 1999 / 2011 / 2022 | the standard UN "billion milestones" | high for 1960→2022; the 1804 figure for the first billion is a US Census Bureau-style estimate, not a WPP entry |
| s3 | TFR 1950–55 vs 2020–25, seven regions | the regional fertility decline | **medium** — the endpoints are right, but two categories are BLENDS: "Europe & N. America" averages a 2.7 and a 3.5, and "East & SE Asia" averages a 5.8 and a ~5.5. WPP publishes those as separate aggregates and the film merges them to keep the bar count readable |
| s4 | births 132 → 96, deaths 62 → 122 (millions/yr, 2024→2100) | deaths overtake births around 2080 | **low for the middle** — 2024 (132 births / ~62 deaths) is reported; **2040, 2060 and 2080 are authored interpolations**, not published table values. The crossing "around 2080" matches how WPP describes the turn in prose |
| s5 | 8.2 → 9.1 → 9.8 → **10.3 (2084)** → 10.2 (2100) | the peak, medium variant | high for the peak (10.3bn, mid-2080s) and the 2100 figure; the 2040/2060 waypoints are interpolations |
| s6 | 2100 regional shares 35 / 12 / 22 / 14 / 10 / 6 | a third of humanity in Sub-Saharan Africa | **medium** — the shape is right, the exact split is rounded and sums to 99, not 100 |
| s7 | median age 19 / 32 / 31 / 33 / 39 / 44 by region, 2024 | "a continent is 19, a continent is 44" | medium — approximate regional medians |

The rounding is deliberate and visible: `decimals: 1` on the charts, and every
`source` line names the edition rather than the table.

**What "verify" means concretely.** Open WPP 2024, pull the five series, and
replace the `values` arrays. Nothing else in `storyboard.json` changes — the
geometry is derived, so corrected numbers re-scale themselves.

---

## 2. What the chart element had to be

`chart` is a new element type (`columns`, `bars`, `line`, `donut`). Four
decisions shaped it, each against a cheaper alternative that would have looked
fine and been wrong.

### Canvas would have been invisible to every gate

The reference implementation is a canvas chart animator, and canvas is the
obvious way to draw a chart. It is also a black box to this pipeline:
`reel-extent` measures element boxes and `reel-contrast` measures text nodes,
and a rasterised chart is neither. The chart is **inline SVG**, so it is DOM —
measurable, scalable, and its labels are text nodes in both senses.

That decision immediately paid for itself: `reel-contrast` measured **124 text
nodes** on this film, against **13** before the chart labels were visible to it.
A hundred and eleven unmeasured labels is the "25 chips were never measured"
bug one order of magnitude larger.

### Geometry is computed once, at compile time

Every number the runtime needs to move a bar rides on the bar as a `data-*`
attribute the emitter wrote. The runtime knows only how far through the
animation it is — never what the scale is. Shipping a second geometry model
inside the SB literal would be two answers to the same question, and they
diverge the first time one is edited. The meter reads `data-pct` for the same
reason.

### Drivers of the growth are per-node, not per-element

`_chart(e,t)` walks every node with `data-anim` and applies progress with a
per-index stagger, so `chart_in.stagger_ms` is what makes a series draw itself
instead of appearing as a slab that changed size.

### The chart owns its headline

`title`, `subtitle`, `kicker` and `source` live on the element, not as sibling
`text` elements. As siblings they can be reordered or edited apart, and a number
ends up under a sentence describing a different number.

---

## 3. The data story

```
s1  Eight billion of us                    8s   stat 8.2bn
s2  It took all of human history…          12s  line + area, 8 points
s3  That growth was a birth-rate story…    12s  grouped h-bars, 14 bars
s4  Around 2080 the lines cross            12s  two-series line
s5  10.3 billion, somewhere around 2084    12s  line + area, projection
s6  Where the people are moves south       11s  donut, 6 segments
s7  A continent is 19. A continent is 44   11s  columns, 6 bars
s8  The peak is not the end of the story    9s  answer + body + credit
```

The arc is the standard editorial move: a number that is too big to feel, the
history that produced it, the mechanism, the turn, the projection, the
geography, the consequence, the line. Each scene carries one finding and no
chart carries two.

---

## 4. Bugs this work found

These are worth more than the film. Every one was invisible to a green gate.

1. **The compiler dropped theme roles in silence.** The theme builder copied
   from a hand-kept list of nine names while `THEME_ROLES` had twenty. A role
   could be declared in `theme_map`, pass the schema, pass the token check, be
   reported as applied by every diagnostic, and still never reach the film —
   because the emitter fell back to its own default and the design board showed
   the default too. Found by noticing that a legend rendered in `--hss-ink`
   while the stylesheet said `--hss-on-variant`. Both the base theme and the
   per-`--mode` theme now derive from `THEME_ROLES`, so the two cannot disagree
   and a new role cannot be half-added. This is the `baseBg` bug's shape again:
   *a list maintained beside the thing it must match*.

2. **`reel-contrast` was blind to SVG text.** Its node pattern matched `<div>`
   and `<span>` only. It had already been widened once, for chips. A graphics-
   heavy film reopened the same hole with a hundred labels in it. The pattern is
   now `div|span|text` with a backreferenced closer, and the chart ink claims
   are asserted against `RUNTIME_CSS` rather than trusted.

3. **The grid was drawn on the wrong axis.** One orientation everywhere meant
   horizontal rules behind a chart whose scale runs left to right, with the tick
   labels parked on top of the category names in the gutter.

4. **`.hss-chart-value` lost a specificity tie.** `.hss-chart-svg text` is
   (0,1,1) and beats `.hss-chart-value` at (0,1,0), so every value label would
   have silently taken the muted axis ink instead of full ink. Fixed with a
   descendant selector; `reel-contrast` now asserts the tie-break.

5. **Four labels ran off the viewBox.** The horizontal-bar gutter was a constant
   (176) while the longest category was 21 characters; the donut's list started
   at a fixed x that a long region name overran; the top axis tick had the unit
   appended and started at `padL-14` with `text-anchor:end`; and a bar reaching
   the top of the plot put its value label at a negative `y`. All four were
   found by measuring `getBBox()` of every `<text>` against the viewBox in a
   real browser — not by the extent gate, which measures element hosts and would
   have reported "fits" for all four.

6. **The regression gate's baseline was `HEAD`, so committing broke it.** Ten
   assertions compare the current emitter against the previous one; while the
   change is uncommitted `HEAD` *is* the previous one, and the moment it lands
   `HEAD` becomes the current one and every check compares the file to itself.
   The gate goes red on a commit that dropped no rule. Pinned to `baf1d56`, the
   last commit before the emitter gained the R1 types, with a comment saying why
   — moving the pin is now a deliberate act rather than something a commit does
   by accident.

---

## 5. What is still not right

- **The numbers are unaudited.** See §1. This is the film's real limitation.
- **Fonts are stand-ins.** Balto and Alright Sans are licensed; see Design.md §2.
- **`series.length` is uncapped.** Six colours are defined; an eighth series
  wraps back to `--hss-s1` and silently repeats a colour. The schema should
  reject a series count above the palette size.
- **No reference line.** "2.1 is replacement" wants a rule across the chart at a
  value the axis can name. `max` sets the scale but there is no `mark_at`.
- **The donut's legend is drawn twice** — once as SVG swatch rows beside the
  ring, once as the HTML legend above the plot. `legend: false` suppresses the
  HTML one, but the default is wrong for `donut` specifically.
