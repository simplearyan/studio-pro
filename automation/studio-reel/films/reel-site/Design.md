# Reel site — design system

Eighth film, first to use the `html` element type and its build-time Tailwind
compile. Source of truth: `reference/reel-landing.html` — the landing page this
film promotes ("Reel — edit video, mark it up"). Every token below is that
page's own `:root` value, verbatim.

## Brief

- **White theme by request.** Paper `#FBFBFD`, ink `#14161F`. One blue does all
  the pointing; pink circles the hero claim; yellow only ever appears as the
  marker band behind dark text — a yellow that reads as text on paper would be
  a warning, so it never leaves the highlighter.
- **Every scene at most 3 seconds.** 11 scenes, 32.5s total. Entrances are
  choreographed to finish 200–500ms before the cut so every element settles
  and stays settled (motion gate: 53/53 rest).
- **The five emphasis kinds**, one per beat: circle (s1, s8, s11),
  underline (s2, s5, s7, s10), box (s3, s6), highlight (s4, s9), and the
  handwritten Kalam aside (s4) with its pink arrow.
- **Two `html` scenes** — the AI code card (s8) and the stack chips (s9).
  Their utility classes (`bg-[#14161F]`, `font-mono`, `rounded-full`,
  `shadow-2xl`, …) are compiled by reel-compile into one 4.1KB stamped
  stylesheet block; no Tailwind runtime, no CDN, no fetch.

## Tokens

| token | value | role |
|---|---|---|
| bg | `#FBFBFD` | paper |
| surface / surface-hi | `#FFFFFF` / `#F0EFFC` | panels |
| ink / mute / line | `#14161F` / `#636879` / `#E6E8F0` | text, secondary, rules |
| blue / blue-ink | `#6965DB` / `#4B47B5` | pointing / safe text-blue |
| pink / yel | `#FF4D8D` / `#FFD84D` | hero ring, arrow / marker band |
| tint | `#E6E5FA` | tonal card/tile fill |

`theme_map` mirrors these into the emitter roles (meter → blue, fill →
blue-ink, fill-tone → tint, on-variant → mute, …). No dark variant — the site
is a white theme and the film is about marks on paper.

## Type

Bricolage Grotesque 800 for headlines (the page's own face), JetBrains Mono
for overlines/labels (its `ui-monospace` voice), Kalam 400 for handwritten
asides. Ramp: title 96/-0.03em, title_hi 64/-0.025em, lead 30, body 24,
hand 44, overline 20 upper/0.18em.

Contrast choices that the browser gate confirmed: overlines use **blue-ink**
(6.3:1) rather than blue (4.54:1, a hair over AA for 20px); the hand note is
blue (4.54:1) since pink only clears 3.06:1 and is kept to large rings;
white-on-blue Tailwind chip measures 4.64:1; the code card is `#E8EAF2` on
`#14161F` (~14:1).

## Scene table (every scene ≤ 3.0s)

| # | scene | dur | emphasis |
|---|---|---|---|
| s1 | brand open — "Edit video, mark it up." | 2.6s | pink **circle** |
| s2 | hero — "Cut your video. Then draw on it." | 3.0s | blue **underline** |
| s3 | four marks pills | 3.0s | blue-ink **box** |
| s4 | feedback on the frame | 3.0s | yellow **highlight** + Kalam note + pink **arrow** |
| s5 | editor tiles | 3.0s | blue **underline** |
| s6 | speed/keyframes/4K cards | 3.0s | pink **box** |
| s7 | grade + filter pills | 3.0s | pink **underline** |
| s8 | AI sentence + code card (`html`) | 3.0s | blue **circle** |
| s9 | stack chips (`html`) | 3.0s | yellow **highlight** |
| s10 | keyboard pills | 3.0s | blue **underline** |
| s11 | CTA + credit | 2.9s | pink **circle** |

## Gates (all green)

schema, compile (53/53 elements, 11/11 scenes), regression (incl. "reel-site
authors html utilities → one stamped block"), fidelity, contrast (browser,
white theme), extent (tightest margin 398px side / 300px vertical), motion
(53/53 settle and stay settled; determinism across fresh loads),
vendor-katex, build, timeline-dryrun. Export: `_exports/reel/reel-site.mp4`,
h264 1920×1080, 975 frames, 32.500s, 7.5MB, verified by re-read.
