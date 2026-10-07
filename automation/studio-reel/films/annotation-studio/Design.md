# Annotation Studio — draw on anything — Design

*Sixth film. First light mode, first film built on the annotation marks.*

The brief: a film about the Annotation Studio Pro mock, using annotation itself
as the design language, in light mode with clean fonts and a clean palette.
Every decision below serves that: colour means someone circled something, type
stays out of the way, and the marks carry the show.

---

## 1. Palette — paper, one blue, four pens

Near-white `#f7f8fa` stage, hairline `#e2e6ec` borders, ink `#131720`. One blue
(`#2563eb`) does all the pointing: overlines, pills, meters, the export slabs,
the first ring. The four annotation inks — amber `#f59e0b`, rose `#f43f5e`,
violet `#8b5cf6`, teal `#0d9488` — appear ONLY on marks. That is the whole
colour system: on this film, a saturated hue on screen always means a mark
landed, so the eye learns to watch for them.

The mark inks are tokens but deliberately NOT theme roles. A colour reachable
through `theme_map` swaps with the mode, and a ring changing hue mid-film is
not a re-theme, it is a different pen. One mode, no `modes` block: the studio's
own panels are dark, but this film is about the marks, and marks read loudest
on paper.

### The one contrast failure, and the shade that fixed it

`card: filled` makes the export scene three blue slabs. The panel label rides
at 0.75 opacity (a runtime rule this film does not own), so white-on-`#2563eb`
measured **3.61:1** in the real browser and `reel-contrast` failed it. Pointing
`fill` at blue-700 got **4.48:1** — still short. Blue-800 `#1e40af` lands at
**5.64:1** and changes nothing else: same slab, one shade deeper. The film's
final floor is 4.86:1 (muted text on paper), every one of the 48 text nodes
above WCAG AA.

## 2. Typography — Inter, because the product is Inter

The mock is an Inter UI, so the film is set in what the studio looks like:
Inter 400–800 for everything readable, JetBrains Mono for the machine voices —
overlines, tool chips, the credit. No display face to invent, no stand-in to
justify: the clean-fonts ask is answered by using the product's own face and
nothing louder.

The ramp (1920×1080): title 96/800, title_hi 64/700, lead 30/400, body 24/400,
overline 20/700 mono tracked 0.18em, mono 20/500. Titles are the only 800s, so
each scene has exactly one place to look before the marks arrive.

## 3. Marks as layout

A scene is a centred column, so a mark can only attach to an element — and
that constraint is the design. Every annotated phrase gets its OWN element:
the ring wraps the hero title, the highlighter sits behind one line, the
underline runs under the pills row, the box frames one panel, the arrow points
at one card. There is no scene where a mark floats near something; `of` is
always a sentence you can say out loud.

Timing is the other half. Every mark is a separate element with its own clock:
the words land first (slide/fade/pop at 400–1300ms), the mark draws itself
after (1400–3650ms), the `draw` entrance pinning the host at full opacity while
the stroke carries the phase. The beat is claim → pause → annotation, repeated
seven times; that pause is the film's rhythm and the reason it feels like
someone is marking a page rather than a page animating itself.

Colour rhythm per scene: s1 ring blue · s2 highlight amber + underline blue ·
s3 arrow rose + box violet · s4 box blue + arrow amber · s5 ring violet +
highlight teal · s6 blue/rose/amber · s7 no marks (the close lands clean).

## 4. Component choices

- `card: filled` — the export scene is three blue slabs of resolution (1920 /
  2560 / 3840), white numerals, meters filled 50/67/100 so the row reads as a
  scale rather than three unrelated prices.
- `tiles: tonal` — aspect-ratio cards sit on the paper with no borders of their
  own; `pills: outlined` so nine chips do not become nine blocks; `answer: text`
  so "Press record." lands flat on the page.
- Radii 14px cards/tiles (web-panel, not Material), 999px chips, 0 answers.
- Scene backgrounds all name the stage except s6, the showcase, which lifts to
  pure `#ffffff` — the marks' own scene is the brightest surface in the film.

## 5. Motion

Entrances are the film's existing vocabulary: slide for claims, fade for
prose, pop for the stat. The marks get `in.type: "draw"` — the host holds
still while `stroke-dashoffset` (circle, arrow) or width (highlight) interpolates
from t. Legacy marks (box, underline) keep a plain fade, because they are CSS
borders with nothing to draw. Nothing uses a CSS transition; the whole film is
a function of t and scrubs like every other reel.
