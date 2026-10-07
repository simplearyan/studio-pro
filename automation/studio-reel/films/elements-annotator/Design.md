# Vox Emphasis Animator — say it louder — Design

*Seventh film. The double rule's debut, and the second light-mode film in the
reel.*

The brief was the element use case itself: text with annotation — circle
emphasis, a double-line rule, a highlighter — set light with clean fonts. The
mock (Elements Annotator v0.4) is a zinc-and-rose Tailwind app whose entire
job is drawing those three marks over words, so the film is built from exactly
those three and nothing else: no arrows, no boxes, no charts. Sixth film
proved the mark vocabulary; this one proves it has a house style.

---

## 1. Palette — zinc paper, one rose, seven pens

`#f4f4f5` stage (the mock's own light canvas — bg-zinc-100), white surfaces,
ink `#18181b`, hairlines `#e4e4e7`. One rose `#e11d48` carries the UI voice:
overlines and chips. Rose-600 rather than the mock's rose-500 button colour
because overlines are text — rose-500 on zinc measured below 4.5:1 for normal
text, rose-600 passes as bold-large and keeps the film honest at 4.27:1 floor.

Everything else saturated is a PEN, taken from the mock's element library and
used nowhere else:

| pen | hex | where the mock uses it |
|---|---|---|
| pen-blue | `#3b82f6` | circle_pen_double, and the closing rule |
| pen-emerald | `#10b981` | circle_clean |
| pen-purple | `#a855f7` | circle_pen_messy |
| pen-amber | `#f59e0b` | the thick stroke (mock's `#fbbf24`, one step deeper for paper) |
| hl-yellow | `#fde047` | hl_yellow highlighter |
| hl-cyan | `#67e8f9` | hl_cyan highlighter |
| pen-red | `#ef4444` | circle_pen_single — declared, not spent; the palette is the mock's |

Like film six, pens are tokens but NOT theme roles: a pen that re-themes is a
different pen. One mode, no `modes` block.

## 2. Typography — Inter, because the mock is Inter

The mock loads `Inter:wght@400;500;600;700` and nothing else. The film sets
Inter 400–700 for every readable word and JetBrains Mono for the machine
voices (overlines, credit) — the same division film six uses, now a reel
convention rather than a per-film decision.

Ramp at 1920×1080: title 96/700, title_hi 64/700, lead 30, body 24, overline
20 mono tracked 0.18em. Weight tops out at 700 — the mock has no 800, and a
heavier film would be borrowing a voice the product does not have.

## 3. The three marks, and why the double rule is SVG

- **Circle** — same stretched ellipse as film six: `preserveAspectRatio="none"`
  + non-scaling-stroke + `pathLength="1"`, so it hugs any box at 3px.
- **Highlighter** — a width wipe at 0.4 alpha over its target; the tint is the
  mock's highlighter hex, the ink underneath stays the stage ink.
- **Double rule (new)** — `dbl-underline`: two 3px rules in a fixed 12px strip
  pinned 9px below the target, each its own draw node, both wiped left to
  right by the same dash. It is SVG rather than two CSS bars for one reason:
  the legacy `underline` is a bar that FADES, and this film's whole argument
  is that marks draw themselves. Horizontal lines tolerate the x-stretch the
  way the circle does; the fixed height keeps the rules on the baseline
  instead of scaling with the text box.

Timing is the shared language: words land at 450–1100ms, marks draw at
1350–3350ms, `in.type: "draw"` pins the host while the stroke carries the
phase. Scene s2 is the thesis shot — three lines, three marks, three clocks,
each pen arriving after its sentence has settled.

## 4. Components and surfaces

`tiles: tonal` for the aspect cards (quiet surfaces on paper), `pills:
outlined` so chips read as swatches — which is what the mock's element cards
are — `answer: text` for the close. Radii 14/14/999/0, same web-panel voice
as film six. Scene s2 lifts to pure white: the thesis shot gets the brightest
surface in the film, and every other scene stays on zinc paper.

## 5. Motion

Slide for claims, fade for prose, pop nowhere — this film has no stat. Marks
draw on their own entrance (`draw`), legacy kinds are not used at all, and
nothing transitions in CSS: the film is a function of t and scrubs like every
other reel in the pipeline.
