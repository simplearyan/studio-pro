# Two Queens, One King — Design

The design system, extracted from `reference/two-queens-mock.html`. Fourth
design to go through the pipeline, after breath-of-air (glass-dark),
jan-suraaj (neo-brutalist, Devanagari) and studio-pro-showcase (synthwave
brutalism).

**This is the first design that ships two themes.** Every other film has one
palette, hardcoded in the emitter, and the compiled clip carries it. Material
3 is light/dark by construction — the mock ships both token tables and a
`data-theme` toggle on `<html>`. So this film authors both and compiles twice.
§7 explains the decision.

**Every word in the film is quoted from the mock** — the question, the givens,
the three steps, the equations. Unlike studio-pro-showcase, nothing here is
sourced from this repo.

---

## 1. What kind of design this is

**Material 3 (2023 token set), used cleanly.** Not Material You's expressive
playfulness, not Material 2's elevation ramp — the plain baseline M3 that
Google ships as a token reference:

- **Weight 500 for headings.** M3 dropped the old bold-display convention.
  Display size and tight tracking carry the hierarchy; the weight stays at the
  middle. This is the single loudest difference from the previous two films,
  which both ran 800-weight display type.
- **Large radii, small radii, and nothing in between.** `8px` on a chip,
  `14px` on an option, `20px` on a card, `24px` on an answer block, `999px` on
  a pill. The scale is discrete by design.
- **Tonal surfaces, not shadows.** Elevation M3 is five levels of *container
  colour* first and a very soft shadow second. A panel is `--container` on
  `--bg`, not white on grey.
- **The container / on-container pairing.** `--primary-container` is only ever
  painted with `--on-primary-container`, never with `--primary`. That rule is
  the reason the palette in §2 has twice as many tokens as it needs.
- **One accent.** Green `--primary` carries essentially everything
  structural. `--tertiary` (amber) appears exactly twice in the mock: the
  "Try it yourself" overline and the chip in the hero.
- **Mono for machine facts.** `Roboto Mono` carries the step labels, the tab
  numbers, the device-bar caption and the keyboard hints — never prose.

## 2. Colour tokens

Two complete tables, copied verbatim from the mock's `:root` and
`:root[data-theme="dark"]`. `modes.dark.tokens` in the storyboard holds the
second one; the base table is the first.

### Light

| token | hex | role in the film |
|---|---|---|
| `--bg` | `#f8faf8` | stage background |
| `--surface` | `#ffffff` | card fill |
| `--container` | `#eef3f0` | tonal panel, tile fill |
| `--container-hi` | `#e3ebe6` | meter track, option key badge |
| `--on-surface` | `#191c1a` | every heading and paragraph |
| `--on-variant` | `#404943` | secondary prose, credits |
| `--outline` | `#707972` | option borders |
| `--outline-var` | `#c0c9c2` | hairline dividers |
| `--primary` | `#006c50` | overlines, active tab, badge fill |
| `--on-primary` | `#ffffff` | text on `--primary` |
| `--primary-container` | `#b4f0d3` | the answer block |
| `--on-primary-container` | `#002116` | text on that block |
| `--tertiary` | `#7a5900` | step-2 accent |
| `--tertiary-container` | `#ffdea0` | hero chip |
| `--on-tertiary-container` | `#261a00` | text on the chip |
| `--error` | `#ba1a1a` | not used in the film |
| `--success` | `#006c50` | ✓ badge |

### Dark

| token | hex |
|---|---|
| `--bg` | `#101412` |
| `--surface` | `#171d1a` |
| `--container` | `#1c2320` |
| `--container-hi` | `#262d2a` |
| `--on-surface` | `#e0e3e0` |
| `--on-variant` | `#c0c9c2` |
| `--outline` | `#8a938c` |
| `--outline-var` | `#404943` |
| `--primary` | `#6ddbb1` |
| `--on-primary` | `#00382a` |
| `--primary-container` | `#00513b` |
| `--on-primary-container` | `#b4f0d3` |
| `--tertiary` | `#efc04f` |
| `--tertiary-container` | `#5b4300` |
| `--on-tertiary-container` | `#ffdea0` |
| `--error` | `#ffb4ab` |
| `--success` | `#6ddbb1` |

Note what the dark table does *not* do: the containers get darker but they do
not invert. `--primary-container` goes from a pale mint to a deep green and
`--on-primary-container` flips with it, because M3 defines those two as a
pair. The film's text is always the `on-` token, never the base token, which
is what makes a single authored copy correct in both modes.

## 3. Elevation

Two levels are defined and both are nearly invisible by design:

```
light  --e1: 0 1px 2px rgba(0,0,0,.14),  0 1px 3px 1px rgba(0,0,0,.08)
light  --e2: 0 1px 2px rgba(0,0,0,.14),  0 2px 6px 2px rgba(0,0,0,.08)
dark   --e1: 0 1px 2px rgba(0,0,0,.5),   0 1px 3px 1px rgba(0,0,0,.35)
dark   --e2: 0 1px 2px rgba(0,0,0,.5),   0 2px 6px 2px rgba(0,0,0,.35)
```

Dark raises the *opacity*, not the geometry. The film's shadow uses the mode's
own `--e2`, so the dark version genuinely gets deeper shadow instead of the
same shadow re-declared.

## 4. Type

| role | family | weight |
|---|---|---|
| body / display | **Google Sans Flex** | 400 / 500 / 600 |
| machine facts | **Roboto Mono** | 400 / 500 |
| fallback | Roboto, system-ui, Segoe UI | — |

```
https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@400;500&family=Google+Sans+Flex:wght@400;500;600&display=swap
```

The mock never uses Roboto directly — it is the last entry in the `--sans`
fallback stack. The film uses Google Sans Flex and Roboto Mono only.

### The authored ramp (1920 × 1080 design space)

| role | size | weight | tracking | case |
|---|---|---|---|---|
| `overline` | 22 | 500 | `0.16em` | upper |
| `title` | 92 | 500 | `-0.01em` | — |
| `title_hi` | 58 | 500 | `-0.01em` | — |
| `lead` | 32 | 400 | — | — |
| `body` | 26 | 400 | — | — |
| `mono` | 22 | 500 | `0.06em` | upper |
| `math` | 62 | — | — | — |
| `math_sm` | 40 | — | — | — |

`math` / `math_sm` are new and exist only because `.hss-latex` had no
font-size at all — see NOTES.md §2.

## 5. Radius

`8` chip · `14` option and `.math` · `20` card and up-next · `24` answer and
device · `999` pill and badge.

The theme layer maps a single `--hss-radius`, so the film uses `20px` — the
card radius, which is the film's dominant surface. A per-element radius is not
expressible (NOTES.md §2).

## 6. Component vocabulary in the film

| mock component | film element |
|---|---|
| `.chip` hero chip | `text` role `overline`, tertiary-container isn't expressible → tertiary ink |
| `.overline` section label | `text` role `overline`, primary ink |
| `.tabs` numbered tab | `pills` row (the outline pill is the closest thing) |
| `.card.tonal` / `.card` | `tiles` (icon / head / body) and `card` panels |
| `.given dl .row` | `tiles`, one per given |
| `.goal` primary-container block | `latex` in primary-container ink |
| `.step` numbered timeline | overline + title_hi, one scene per step |
| `.math` | `latex` |
| `.answer` | `answer` + `stat` |
| `.badge` | `pills` |
| `.plan time` mono chip | `credit` |
| `#snack` | not in the film — a snackbar is an interaction, and a film has no second viewer |

Three mock components are deliberately absent: the **theme toggle** (it is the
film's build matrix, not a frame of it), the **"Try it yourself" buttons**
(answering needs a click), and the **script/code cards** (Part 2, which is
about the mock's own animation, not about the maths).

## 7. Light and dark: why two compiled films

A clip is not a stylesheet. `compileStoryboard` resolves `background` to one
hex and `theme` to one set of custom properties, both baked into `clip.html`
and `clip.css` at build time. There is no runtime re-themeing and no
`prefers-color-scheme` hook in the emitter.

So the film is authored **once** and compiled **twice**:

```
node automation/studio-reel/reel-compile.cjs --only two-queens --mode light --write-html
node automation/studio-reel/reel-compile.cjs --only two-queens --mode dark  --write-html
```

`--mode` merges `design.modes.<mode>.tokens` over the base `design.tokens`
before anything reads a colour, and replaces `background` and `elevation`.
Both runs are gated by the same three scripts. The two artefacts are
`reel-preview-light.html` and `reel-preview-dark.html`.

What stays identical: every scene, every element, every timestamp, the font
stack, the radii, the border. What changes: the stage hex, the eleven
`on-surface`/`container`/`primary` tokens, and the shadow opacity. Nine of the
eighteen tokens are shared between the tables; the rest are not, which is why
duplicating the colour per element was not an option.

## 8. Content

Straight from the mock, quoted:

> **Two Queens, One King** — "Drawing 4 cards from a standard deck — working
> out the joint probability, then turning it into a short."
> Chip: "Joint probability · Card draws"

> **Given** — Deck: Standard, 52 cards · Draw: 4 cards · Queens: `X = 2` ·
> Kings: `Y = 1` · Goal: find `f_{XY}(2, 1)`

> **1 · Total possible outcomes** — "The number of ways to draw *any* 4 cards
> from 52 is a straightforward combination:"
> `$$\binom{52}{4} = \frac{52!}{4!(52-4)!} = 270{,}725$$`

> **2 · Favorable outcomes** — "The Queens — 4 in the deck, we need 2:
> `\binom{4}{2} = 6`" · "The King — 4 in the deck, we need 1:
> `\binom{4}{1} = 4`" · "The last card — needs to be neither Queen nor King,
> leaving `52 - 4 - 4 = 44` candidates: `\binom{44}{1} = 44`"

> **3 · Putting it together** — "Multiply the favorable combinations and
> divide by the total:"
> `$$\text{Probability} = \frac{\binom{4}{2} \times \binom{4}{1} \times \binom{44}{1}}{\binom{52}{4}}$$`
> `$$= \frac{6 \times 4 \times 44}{270{,}725} = \frac{1{,}056}{270{,}725} \approx 0.0039006\ldots$$`

> **Answer** — "Probability ≈ 0.0039", "✓ Matches option A"

> **Part 2 · Build the short** — "Preview the 15-second explainer, then grab
> the script and the code behind it."

The film runs the maths only. 1,056 / 270,725 ≈ 0.0039 is *about* one hand in
256, and the film's closing scene says so — that is the intuition check, and
it is arithmetic the mock does not print.