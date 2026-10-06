# Studio Pro Showcase — Design

The design system, extracted from `reference/portfolio-mock.html`. Third
design to go through the pipeline, after breath-of-air (glass-dark) and
jan-suraaj (neo-brutalist).

**The mock's copy is a template — "Maya Chen, Design Engineer".** Only the
*system* is reused. Every word in the film comes from this repo's README,
`package.json` and `clip-lite/`; see §7.

---

## 1. What kind of design this is

**Synthwave brutalism** — a neo-brutalist skeleton wearing a neon palette.
Distinct from both earlier films, and the combination is the point:

- **Brutalist structure.** Hard offset shadows (`3px 3px 0 #000` through
  `12px 12px 0`), square corners, thick black borders, no blur on elevation.
  Same grammar as jan-suraaj.
- **Synthwave palette.** Violet, magenta, coral, amber and teal on near-black.
  Where jan-srutaj used *flat saturated blocks*, this one puts a saturated
  **block behind oversized display type** — the name is reversed out of a
  violet slab, which is the single most recognisable move here.
- **Monospace scaffolding.** Nav, labels, badges and counts are all JetBrains
  Mono uppercase with wide tracking. The prose is Inter; the display is heavy.
- **Dot grid** on near-black, and a **marquee ticker** strip (`26s linear
  infinite`, translating `-50%`).
- **Bordered badges** with a small glyph: `◆ AVAILABLE FOR WORK`, `📍 LISBON, PT`.

## 2. Colour tokens

From `tailwind.config.theme.extend`.

| token | hex | used for |
|---|---|---|
| `coal` | `#151217` | page background |
| `panel` | `#211C29` | raised surface |
| `ink` | `#15121A` | dark text on light |
| `paper` | `#FBF6EC` | light surface, primary button |
| `sun` | `#FFC93C` | amber section label |
| `coral` | `#FF5A5F` | red accent, ticker |
| `teal` | `#00A896` | green accent, ticker |
| `violet` | `#7B61FF` | **the name slab** |
| `pink` | `#FF6FA5` | magenta accent |

Shadow tints `brutal-sun` / `-coral` / `-teal` / `-violet` / `-pink` are the
`8px 8px 0` offset in the brand colour instead of black.

## 3. Type

| role | family | weights |
|---|---|---|
| body | **Inter** | 400/500/600/700/800 |
| display | **Inter 800** | the name slab is Inter extra-bold, *not* Space Grotesk |
| mono | **JetBrains Mono** | 400/500/700 — nav, labels, counts, ticker |

`Space Grotesk` (500/600/700) is loaded and declared, but the hero renders in
Inter 800. Recorded because it is the kind of detail that is easy to assume the
other way round.

`https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap`

## 4. Elevation

`brutal-xs 3px` · `brutal-sm 5px` · `brutal 8px` · `brutal-lg 12px`, all
`0 0 rgba(0,0,0,1)`, plus five colour variants.

## 5. Motion

Almost none, and one exception: the **marquee ticker**, `26s linear infinite`.
Buttons and badges move on hover by shadow-collapse. In a film the ticker
becomes a single leftward slide across one scene — a marquee has no second
viewer.

## 6. Component vocabulary

| component | shape |
|---|---|
| name slab | display type reversed out of a solid brand block, hard shadow |
| section label | mono uppercase on an amber/coral block, hard shadow (`WORK`) |
| meta badge | bordered mono uppercase with a glyph (`◆ AVAILABLE FOR WORK`) |
| count | mono `04 SELECTED PROJECTS` |
| primary button | paper fill, black text, hard shadow |
| ghost button | transparent, bordered, hard shadow |
| ticker strip | full-bleed, bordered top and bottom, coloured glyphs between words |
| work card | `panel` surface, hard shadow, image block, mono meta |

## 7. Content (for authoring the film)

All taken from this repository, not from the mock.

**Studio Pro** — "A pro-feeling video editor and motion-graphics studio that
runs entirely in your browser." No accounts, no uploads, no backend. A timeline
from text, shapes, images, video, audio, math, ink and **HTML-in-Canvas** clips;
export MP4/WebM. "Nothing leaves your machine." "Deterministic by construction" —
no `requestAnimationFrame`, no `setTimeout`, no live CSS animation; fixed
800 × 450 design space; vanilla HTML/CSS/JS. HIC code editor and an AI tab.
`mediabunny` for encoding. MPL-2.0, Chromium. Live at
`simplearyan.github.io/studio-pro`.

**A Breath of Air** — a 26-second, four-clip HTML-in-Canvas film about air
pollution, written as plain HTML/CSS and rendered to MP4 by the terminal
pipeline. The R0 gate is 780/780 frames byte-identical.

**Studio Pro Lite** — `clip-lite/`. "A working phone video editor in one file":
import real video, build a filmstrip and waveform from the source, scrub on a
pinned playhead, export with MediaRecorder.

**Aryan** — the creator and sole author of this repository
(`simplearyan <aryanphone00620@gmail.com>`, github `simplearyan/studio-pro`).