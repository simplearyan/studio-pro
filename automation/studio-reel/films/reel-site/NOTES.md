# Reel-site — notes, review, and the full ledger

Everything about this effort in one place: the film, the site it promotes, and
the pipeline it was built on — **what we fixed, what is good, what is bad,
what to add, what to improve.**

---

## 0. What shipped

- **`films/reel-site/`** — 8th studio-reel film, 11 scenes, every scene ≤ 3s,
  32.5s total, white theme taken from the landing page's own `:root` tokens.
  Circle / underline / box / highlight / handwritten emphasis all appear; two
  scenes are raw `html` elements whose Tailwind utilities compile at build
  time (4.1KB stamped block, zero runtime).
- **`_exports/reel/reel-site.mp4`** — h264 1920×1080, 975 frames, 32.500s,
  7.5MB, exporter-verified (re-read in Node: size, duration, dimensions,
  packets) plus an independent ffprobe confirmation.
- **`reference/reel-landing.html`** — the source design, archived with the film.
- **`Design.md`** — the design-system record (tokens, ramp, contrast math,
  scene table, gate results).

---

## 1. What we fixed

1. **Cards shipped EMPTY through every gate.** `reconcile()` had no `cards`
   branch, so `items` never crossed into the IR: jan-suraaj j6-cards and
   studio-pro p2/p8-cards rendered `<div class="hss-cards"></div>` — three
   authored cards as an empty row, green everywhere. Found only because the
   new motion gate asked *what the entrance was moving* and the answer was
   nothing. Fixed in reel-compile (label/accent/muted carried; empty items →
   `unapplied`, a failed build, not a hole).
2. **Emitter `_group` zero-wrap bug.** A lone `card` had no
   `.hss-cardwrap` children to search, so its entrance was a no-op;
   `SETTLE_JS` now falls back to the host itself.
3. **Four accents below the 3:1 floor on light cards** (surfaced once the
   cards actually rendered): jan-suraaj `#FDCB0B→#9C7A06`,
   `#F38BA3→#C9455E`; studio-pro `#FFC93C→#A67400`, `#FF6FA5→#CC3B75`.
   All now ≥3.9:1; dark-surface uses of the same hexes untouched.
4. **T1 — `html` element + build-time Tailwind (plan §2 Route A).** Schema
   enum 12→13 with an `html` prop; `buildElHtml` renders markup verbatim and
   throws `unsafeHtml` on `<script>`; reconcile reports `<script>` as unsafe
   and empty markup as unapplied (both named, both dropped); `attachUtilities`
   scans the generated document, compiles candidates with `@tailwindcss/node`
   (theme + utilities layers, **no preflight**), and hangs one stamped block
   on `top._tw` which `compileStoryboard` appends next to the `.hss-*` rules.
   No candidates → no block → **byte-identical** (all 30 pre-existing
   artifacts sha256-verified unchanged). Regression gained 17 checks incl.
   "no committed preview loads Tailwind at runtime".
5. **Gates wired to the same paint**: contrast/extent/motion await
   `attachUtilities(top)` before cloning the page, fidelity maps `html` as
   verbatim passthrough, extent's `main()` went async.
6. **A regression check corrected for correctness**: the T1 check asserted
   "every film returns zero bytes" — true only while no film opted in.
   It now branches: films without `html` must still return zero bytes
   (byte-identity promise kept), films with `html` must get a stamped block
   (new positive coverage — reel-site exercises it).
7. **Authoring error caught by the schema gate** (the system working): three
   cards were authored with `accent`, which only exists on the `cards` type —
   the field would have been dropped in silence. Replaced with `meter_color`.

## 2. What we found and did NOT fix (open)

- **the-peak `s8-credit` is invisible for the entire film.** It authors no
  entrance, and the runtime path is `_ph(undefined) → null → _hidden`, so it
  sits at `opacity: 0` from 0–88s. Measured live: credit `opacity: 0`,
  control element `opacity: 1`. Every gate skips hidden elements, so it ships
  invisible behind green boards. One-line fix (`in: {type: "fade"}` on the
  credit) but it changes a real film's clip and needs its own commit plus
  contrast/extent re-runs — deliberately left out of T1.
- **22 of 23 easing curves are never authored** by any film (motion gate
  coverage report). The P0 library exists; the vocabulary is unused.

---

## 3. The site itself (`reference/reel-landing.html`)

### Good
- **Annotation as identity.** The four marks (underline/circle/box/highlight)
  are not illustrations of the product — they *are* the product, drawn
  on the headline as you read it. The film copies this directly.
- **One-blue discipline.** `#6965DB` does every pointing job; pink and yellow
  are reserved roles. Colour on screen always means something.
- **Honest motion.** Every animation is scroll- or state-triggered, never
  wall-clock for its own sake; `prefers-reduced-motion` collapses all of it;
  `:focus-visible` states everywhere; zero JS dependencies (vanilla, ~600
  lines including demos).
- **Real demos**, not screenshots: the draw canvas, before/after slider,
  filter row and AI-code generator all actually run.
- **Voice.** Kalam handwritten asides ("warmer sky here", "drag me") give the
  page a human annotation layer that matches the product thesis.

### Bad / risky
- **`<script src="https://cdn.tailwindcss.com">`** — the runtime JIT CDN.
  It is fine for a mock; in production it is a FOUC risk, a network
  dependency for first paint, and unsupported for production builds. (Our
  film compiles the same classes at build time — the site should too:
  one `tailwindcss` CLI step removes the CDN entirely.)
- **Two `height: 420vh` scroll-scrub sections** — gorgeous on desktop, but
  they are a lot of scroll for the payoff, and the JS re-renders per frame on
  `requestAnimationFrame` scroll.
- The hero hand-drawn SVG paths are hardcoded `pathLength="1"` dash tricks —
  correct, but they will not survive a copy change without redrawing.
- No `<meta name="description">` / OG tags visible in the head — this is a
  landing page meant to be shared.

### Worth stealing back into the product story
The page's four-step scrub ("Underline it / Circle it / Box it / Highlight
it") and the AI section ("Animate with a sentence") are the two beats the
film quotes most directly.

---

## 4. The film — good and bad

### Good
- Pacing: 11 cuts at ≤3s each with entrances that finish 200–500ms before the
  cut — motion gate confirms **53/53 settle and stay settled**, and
  determinism holds across fresh page loads.
- White theme survives the browser gates: contrast green on every text node
  (overlines deliberately set in blue-ink at 6.3:1, hand note in blue at
  4.54:1 rather than pink's marginal 3.06:1), extent comfortable (398px
  tightest side margin — nothing is near an edge).
- The `html` scenes render real product truth: the code card and the stack
  chips are the first authored markup the pipeline has ever shipped, and they
  cost zero runtime bytes.

### Bad / accepted tradeoffs
- 3s scenes are **tight**: the last element of several scenes ends only
  200–400ms before the cut. Beautiful when it works; there is no slack for a
  future edit that adds one more element.
- Scenes hard-cut (the emitter's fixed cross-curve is the only transition —
  plan P1 is not shipped yet), so "nice clean animation from one scene to
  another" currently means *entrances*, not transitions.
- Only one ease is authored (`cubic-bezier(.2,0,0,1)`, the site's own) — the
  film leans on the default curve family.
- `s6-card-b` big text "1-click" is longer than the other cards' "2×"/"4K";
  it renders fine at extent but is the least balanced of the three.

---

## 5. What to ADD

**To the film**
1. A vertical 9:16 cut of s1/s2/s11 for social — the pipeline takes
   `aspect: "9:16"` already; the scenes would need re-blocking, not re-authoring.
2. A second film from the site's FAQ/keyboard material (two-queens-style
   explainer), so the site gets a series rather than one promo.
3. The Instrument Serif italic voice the site uses for accent lines — the
   font is loaded, the film does not use it yet.

**To the pipeline (ranked by leverage)**
1. **P1 exits + scene transitions** — the single biggest win for ≤3s scenes:
   a cut every 3 seconds reads as pace with exits, as absence without them.
2. **T2 `@theme` token bridge** — map a film's own tokens (`blue`, `pink`,
   `ink`) into the Tailwind theme so authored markup writes `bg-blue`,
   `text-ink` instead of `bg-[#6965DB]` (arbitrary values are the main
   verbosity in the two html scenes).
3. **A gate for "an element that never becomes visible"** — the-peak's credit
   class of bug (no entrance → `_hidden` forever) is invisible to every gate
   today because they all skip opacity-0 boxes. A tiny check: *an authored
   element with no entrance* → warn or fail.
4. P2 text motion depth (word-by-word rise like the site's `.w` spans) —
   would make titles feel like the page they quote.
5. Motion coverage should FAIL (not just report) when a new entrance type
   ships unexercised.

**To the site**
1. Replace the CDN with a build-time Tailwind step (we have proven the exact
   pattern in this repo: scan → oxide → stamped CSS).
2. Meta/OG tags, and a reduced-motion branch for the two 420vh scrubbers.

---

## 6. What to IMPROVE

- **3s-scene authoring ergonomics**: a timeline-dryrun hint that prints the
  *slack* per scene (cut − last-choreography-end) so a filmmaker sees "400ms
  of air" instead of discovering it by gating. (The overrun guard catches
  negatives only.)
- **Contrast on white themes**: the pink/yellow pair passes only because it
  is kept to large graphics; a documented "safe on paper" ink table (we
  computed one in Design.md) would stop the next white film from rediscovering
  3.06:1 by measurement.
- **Export ergonomics**: `export-films` exports everything by default; a
  `--changed-since <ref>` flag would make the common "I edited one film" case
  a one-command run.
- **Docs drift**: FILMS-level claims ("12 element types") needed a sweep when
  type 13 landed; keep a single count source or stop counting in prose.
- The regression OK-message still says "the five new types" — accurate
  historically, increasingly misleading as types accumulate.

---

## 7. Gate ledger for this film

`schema · compile (dark/light as applicable) · regression · fidelity ·
contrast · extent · motion · vendor-katex · npm run build ·
timeline-dryrun` — **all exit 0** with reel-site in the corpus; artifacts
regenerated and re-verified; export re-read-verified plus ffprobe
(1920×1080, 975 frames, 32.500s).
