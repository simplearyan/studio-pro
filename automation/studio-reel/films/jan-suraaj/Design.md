# JAN Suraj — Design

The design system, extracted from `reference/jan-suraaj-mock.html`. This file is
the **input contract** for a film in this style: anyone can author a different
film in JAN Suraj's look from these tokens alone, without opening the mock.

Source: a single self-contained HTML file, 51 KB, Tailwind via CDN with a
`tailwind.config` carrying the brand palette, plus Phosphor icons. Everything
below is lifted from that file — nothing is invented.

---

## 1. What kind of design this is

**Neo-brutalism.** The rules that actually define it, and that a film must
honour or it will not read as this brand:

- **Hard offset shadows, never blur.** `8px 8px 0px 0px rgba(0,0,0,1)` — a solid
  black block the same shape as the element, offset down-right. No spread, no
  feather. This is the single most recognisable feature and the one the emitter
  cannot do today.
- **Square corners.** The mock uses `rounded-xl` / `rounded-2-2xl` on *cards only*
  — as a counterpoint to the hard shadow, never as soft decoration. Shadows and
  rounding are not used together everywhere; where a card is rounded the shadow
  is still hard.
- **Thick black borders.** `border-black`, `border-2`. 62 occurrences of
  `border-black` in the file.
- **Flat colour fields.** Saturated blocks of saffron / green / blue side by
  side, no gradients between them.
- **Uppercase mono tags.** `VISION 01`, `EDUCATION`, `AGRICULTURE` in JetBrains
  Mono, small, tracked out.
- **Playful sticker accents.** Small icons rotated off-axis (`-rotate-6`,
  `z-10`) scattered as decoration, never aligned to the grid.
- **Bilingual by construction.** Hindi carries the meaning, English carries the
  scaffolding. Every heading has both registers.

## 2. Colour tokens

From `tailwind.config.colors.brand`. These are the whole palette.

| token | hex | used for |
|---|---|---|
| `coal` | `#0F0D0E` | page background (dark) |
| `gray` | `#231F20` | secondary surface, dot-grid ink on dark |
| `yellow` | `#FDCB0B` | brand yellow — logo, CTA, the "VISION & IDEAS" sticker, scrollbar thumb |
| `saffron` | `#F97316` | Vision 01 card, hover accents |
| `green` | `#16A34A` | Vision 02 card |
| `blue` | `#2563EB` | Vision 03 card, "Ambedkarite Blue" per the config comment |
| `pink` | `#F38BA3` | accent |
| `white` | `#FDFBF4` | off-white / khadi — card bodies in light mode, primary text on dark |

Shadow tints: `brutal-yellow` / `brutal-saffron` / `brutal-green` / `brutal-blue`
are the same `8px 8px 0` offset in the brand colour instead of black.

## 3. Type

| role | family | weights | where |
|---|---|---|---|
| English display | **Bebas Neue** | 400 | "VISION & IDEAS", uppercase only, wide tracking |
| Hindi display | **Khand** | 500/600/700 | all Hindi headings — the identity of the brand |
| Hindi body | **Hind** | 400/500/600/700 | Hindi paragraphs |
| Tags / mono | **JetBrains Mono** | 400/700 | `VISION 01`, section kickers |

Loaded as one request:
`https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Hind:wght@400;500;600;700&family=Khand:wght@500;600;700&family=JetBrains+Mono:wght@400;700&display=swap`

**Khand and Hind are Devanagari faces.** There is no Devanagari coverage in the
emitter's runtime at all — see `NOTES.md` §2.

## 4. Elevation

| token | value |
|---|---|
| `brutal-sm` | `4px 4px 0px 0px rgba(0,0,0,1)` |
| `brutal` | `8px 8px 0px 0px rgba(0,0,0,1)` |
| `brutal-lg` | `12px 12px 0px 0px rgba(0,0,0,1)` |

Interaction is the shadow collapsing, not a fade:
`transform: translate(4px,4px); box-shadow: 0px 0px 0px 0px` over `0.1s`.
Hover **moves the element onto its own shadow** — the opposite of lifting.

## 5. Backgrounds

Two, both CSS-only, both on `body`:

- `theme-bg-dots` — `radial-gradient(circle, … 2px, transparent 2px)` at
  `32px 32px`; ink `#CBD5E1` light / `#231F20` dark.
- `theme-bg-blueprint` — two `linear-gradient`s forming a 40px grid in yellow at
  15% light / 8% dark, over `#fcfaf0` light / `#12100a` dark.

These are **patterns**, not colours. A film needs them per scene, not once.

## 6. Component vocabulary seen in the mock

| component | shape |
|---|---|
| brand lockup | Devanagari wordmark + small yellow tagline |
| sticker label | uppercase mono, yellow fill, black border, hard shadow, slight rotation |
| vision card | rounded image block in a flat brand colour on top, dark body below, `VISION 0N` tag, Hindi heading, Hindi body, hard shadow |
| article panel | long-form dark surface, section kicker, headings, blockquote with a coloured left rule |
| stat / callout | oversized type on flat brand colour |
| CTA button | yellow fill, black border, hard shadow, black text |
| nav rail | icon buttons, square, bordered |

## 7. Motion

There is almost none, and that is deliberate. `transition-colors 0.2s` on the
body, `transition: transform 0.1s ease, box-shadow 0.1s ease` on hover. The
brand reads as **still and poster-like**. A JAN Suraj film should move text and
cards in simply — slide, fade, hard-shadow settle — and should not add ambient
loops or gradients, which would belong to the breath-of-air language instead.

## 8. Content (for authoring a film)

Extracted from the mock; all Hindi strings are quoted verbatim.

- **जन सुराज** — व्यवस्था परिवर्तन का महाभियान ("a great campaign for system
  change"). Bihar. Founded by **प्रशांत किशोर** (Prashant Kishore), described as
  a blueprint for Bihar's socio-economic renewal, not merely a political forum.
- Tagline: **सही लोग, सही सोच, सामूहिक प्रयास**
- **Vision 01** — गरीबी उन्मूलन का मास्टरप्लान. Capital formation at village
  level; the right to education breaks the cycle.
- **Vision 02** — बिहार में रोज़गार सृजन. Stop migration; agro-based industry.
- **Vision 03** — गांधी और अंबेडकर का मार्ग. Gram Swaraj meets social justice.
- **Economics** — "बिहार का पैसा बिहार में नहीं रुक रहा है". Cooperative societies
  at panchayat level; budget into government schools; women as owners of small
  industry, not just earners.
- **Employment** — पलायन (migration) called Bihar's greatest tragedy. Three-part
  plan: कृषि प्रसंस्करण (agro-processing), टेक्सटाइल हब (textile hubs),
  स्किल डेवलपमेंट (modern skills over paper degrees).
- **Philosophy** — गांधी का ग्राम स्वराज्य + अंबेडकर का सामाजिक न्याय = जन सुराज.
- **CTA** — पदयात्रा से जुड़ें ("join the yatra").

## 9. Using this file

A film in this style needs only: the eight colours, four font roles, the three
shadow steps, and the flat-card/label/sticker vocabulary. `Storyboard.md` maps
these onto scenes; `storyboard.json` is the machine-readable form.