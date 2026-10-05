# A Breath of Air — Design System

> The brand package for this film. Tokens only — no video decisions live here.
> Every value below was **measured out of** `pollution-story.js`, not invented, so
> that the compiled reel can be diffed against the film it came from.

## Palette

| token | value | role | where it is used in the film |
|---|---|---|---|
| `ink` | `#05070d` | the black every scene resolves to | `backgroundColor`; the last stop of scene 1 and scene 3 |
| `night` | `#0a1220` | mid ground behind a scene | scene 1's radial, 45% |
| `dusk` | `#123a52` | the cold middle of the closing scene | scene 4 gradient, 55% |
| `paper` | `#f8fafc` | headline on dark | scene 1 title |
| `slate` | `#a9b6c9` | body on dark | scene 1 sub |
| `signal` | `#38bdf8` | the accent / data colour | start of the stat gradient |
| `iris` | `#a78bfa` | the accent's far end | end of the stat gradient |
| `alarm` | `#fb7185` | warning, and the `alarm` tone | scene 2 kicker, cards, bar |
| `amber` | `#f59e0b` | the bar's far end | scene 2 bar gradient |
| `moss` | `#34d399` | positive, and the `positive` tone | scene 3 kicker, cards |
| `sun` | `#ffd9a0` | the one warm light source | scene 4 sun core |
| `dawn` | `#ffb266` | the sun's edge | scene 4 sun, 35% |

### Tones

A tone is a **palette variant**, never a new colour. Three exist, and every
colour a scene uses must come from its tone.

| tone | accent | body | for |
|---|---|---|---|
| `normal` | `signal` | `slate` | the shared problem — cool, factual |
| `alarm` | `alarm` | `#d6aab6` | a measured, bad number |
| `positive` | `moss` | `#86a89b` | what works |

> **Measured.** Scene 1 uses `signal`/`iris` on `slate`. Scene 2 uses `alarm`
> with `#d6aab6` body and `#b98d99` smalls. Scene 3 uses `moss` with `#86a89b`.
> The three tones are not a proposal — they are the three colour worlds the film
> already had, named.

## Type

| role | family | weight | measured size |
|---|---|---|---|
| Display | Space Grotesk | 700 | 104 / 82 / 78 / 96 px — see the ramp |
| Body | Inter | 400 / 600 | 26 / 24 / 18 px |
| Numerals | Space Grotesk | 700 | 74 / 60 px, gradient-filled |

Mono is **not used by this film**. It is carried in the frame language because
`Frame.md` is a brand-level document and the reel format supports it, but a
design that does not use it must not have it invented into a scene.

## Spacing

| token | value | measured from |
|---|---|---|
| `unit` | 8 | the film's gaps are 8/10/12/16/18/26/34 — all multiples |
| `radius` | 20 | `.card`, `.sol` |
| `gutter` | 32 | `.sol` horizontal padding |
| `scene-gap` | 18 | the flex `gap` on the scene stack |

## Logo

- wordmark: **A Breath of Air** (no icon)
