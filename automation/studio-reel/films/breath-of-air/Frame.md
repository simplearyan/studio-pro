# A Breath of Air — Frame Language

> The design system, inverted for the frame: the same tokens, rewritten so an
> agent can compose a video **without guessing scale**. Authored once per brand.
>
> Every number here is **measured out of** `pollution-story.js`. Where the plan's
> worked example (`docs/hyperframes/Studio-Reel-Plan.md` §3.2) and the shipped film
> disagree, the film wins and the disagreement is recorded in `NOTES.md`.

## Stage

- aspect: `16:9` · fps: `30`
- **design space: 1920 × 1080**
- background: `ink`

> **This is a finding, not a preference.** The plan's worked example declares a
> design space of `800 × 450`. The film that actually ships is authored in
> **output pixels** — a 104px title, a 620px orb, a 330px card, a 1180px grid.
> Declaring `800 × 450` here would be a lie the compiler would enforce into the
> pixels. R0 declares the truth; R2 must decide whether to rescale the corpus or
> redefine the design space. See `NOTES.md` §2.

- glow: allowed, decorative only, `blur(60px)` or softer, `opacity ≤ .55`

## Safe areas

- title-safe: **5%** (54px) all sides · action-safe: 3% (32px)
- the attribution `.foot` sits at `bottom: 44–46px` — **4.1%**, i.e. inside
  action-safe and outside title-safe, which is the correct band for a credit
- max text width: 860px (scene 4's `.sub`) · max lines: 3

## Type ramp (design-space px)

| role | size | weight | tracking | measured from |
|---|---|---|---|---|
| `kicker` | 16 | 600 | `6px` | all four scenes, identical |
| `title` | 104 / 96 / 82 / 78 | 700 | `-3px` / `-2px` | s1 / s4 / s2 / s3 |
| `lead` | 26 / 24 | 400 | 0 | s1+s4 / s2 |
| `stat` | 74 / 60 | 700 | 0 | s1 `.num` / s2 `.big` |
| `body` | 28 / 20 / 18 | 600 / 600 / 400 | 0 | s3 `.h` / s4 `.ask` / smalls |
| `caption` | 14 / 16 | 400 | `1–2px` | `.foot` |

- the `title` is the only ramp with **four** steps. It is not a scale the author
  chose per scene; it is one ramp read at four points, and the order
  `104 > 96 > 82 > 78` tracks *emphasis*, not scene order.
- rule: one title per scene; at most **two** stats (s1 has exactly two)
- gradient-filled numerals (`background-clip: text`) are legal on `stat` only

## Motion language

Enter, measured — every one is `fadeUp` unless stated:

| name | shape | duration | ease | used by |
|---|---|---|---|---|
| `fadeUp` | `translateY(24–28px) → 0`, opacity 0→1 | 0.6–0.8s | `ease-out` | kicker, title, lead, card |
| `pop` | `scale(.7) → 1.06 → 1` | 0.7s | `cubic-bezier(.2,.9,.3,1.2)` | `.stat` |
| `slot` | `translateY(40px) scale(.96) → 0` | 0.7s | `cubic-bezier(.2,.9,.3,1.1)` | `.sol` |
| `grow` | `scaleX(0) → 1`, origin left | 0.9s | `ease-out` | `.bar` |
| `riseSun` | `translateY(120px) scale(.85) → 0` | 2.2s | `cubic-bezier(.2,.8,.3,1)` | `.sun` |

- **exit: none.** There is no fade-out anywhere in the film. Every scene boundary
  is a **hard cut**. The plan's §3.2 specifies `exit: fadeOut 0.3s`; the shipped
  film uses none of it, so the frame language declares none, and `fade_out_ms`
  is 0 on all four scenes. See `NOTES.md` §3.
- **ambient: `drift` only, decorative only.** `translate3d(0,0,0) → (0,-26px,0)
  → (0,0,0)` at 9s and 11s, `ease-in-out`, infinite. It appears on exactly two
  elements, both `.orb`, both in scene 1. Never on type — the frame language
  forbids it and the film obeys.
- easing vocabulary: `{ ease-out, ease-in-out, cubic-bezier(.2,.9,.3,1.2),
  cubic-bezier(.2,.9,.3,1.1), cubic-bezier(.2,.8,.3,1) }` — five curves, and no
  scene invents a sixth.

## Beat grid

| beat | length | scene |
|---|---|---|
| hold | 6.0s | 1, 4 |
| long | 7.0s | 2, 3 |

- the film's grid is **6/7/7/6**, not the plan's `3.0 / 1.5 / 6.0`. It is
  coarser: this is a four-beat film, not a twelve-beat one. The grid is therefore
  declared as `long: 7.0s` and `hold: 6.0s`; `3.0` and `1.5` exist in the plan's
  example but nothing in the film uses them.
- copy budget: **≤ 12 words per beat** — measured, the longest lead is
  *"Air pollution is among India's biggest health threats — and it is
  measurable."* (11 words) and the longest caption is *"of the world's most
  polluted cities are in India"* (9 words). Nothing is truncated, so the budget
  was never tested at its edge. See `NOTES.md` §5.
- ≤ 2 lines per element: **untested**. No element in the film wraps.

## Rules

- At most one accent per scene. Negative stats use `alarm`, positive use `signal`.
- Never animate type with `ambient` — the only ambient loops are on orbs.
- A scene's background gradient is part of that scene's tone, never shared.
