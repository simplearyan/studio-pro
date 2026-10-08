# Studio Reel — variety & export direction plan

**Status:** proposal, not yet implemented. Written after the verdict: *"films
come out in the same format and style, and export is not trustworthy — learn
from what test-renderer and automation/html-in-canvas offer; export without
ffmpeg, MediaBunny only, MP4 **and** WebM, driven through CDP; say what to add,
what to improve, and which direction to move ahead in."*

---

## 0. The two complaints, stated honestly

1. **Visual sameness.** Eight films, one skeleton. Every scene is a centered
   flex column: overline → title → support component → body → shape emphasis.
   Tokens, ramp and copy change; structure never does. Measured below (§2).
2. **Export distrust.** The studio-reel export chain demonstrably works today
   (evidence in §3), but *one of the three* export surfaces in this repo still
   shells out to ffmpeg, the editor's WebM path is wall-clock, and there is no
   automated export gate — so "it can't export" is a reasonable impression to
   have hit. All three are addressed by Track T (§5.1).

---

## 1. What exists today — three layers, one repo

| layer | input | render | encode | formats | evidence |
|---|---|---|---|---|---|
| **studio-reel** (`automation/studio-reel/`) | storyboard JSON → `reel-compile` → 10 gates | CDP drives `test-renderer.html`, pure `onFrame(t)` per frame | **in-page MediaBunny → WebCodecs** (no ffmpeg anywhere in the chain) | MP4 only | 9 MP4s in `_exports/reel/`; reel-site verified 1920×1080 · 975 frames · 32.500s by re-read + ffprobe |
| **html-in-canvas** (`automation/html-in-canvas/`) | StudioPro API composition scripts | `-m cdp`: standalone page + `Page.captureScreenshot` per frame (**deterministic, byte-identical runs**) — *or* `-m editor`: drives the real editor export pump | cdp mode: **ffmpeg** (CRF presets). editor mode: MediaBunny / FTRT / standard | MP4 + WebM (`-f`) | README parity numbers; the only ffmpeg left in the repo |
| **test-renderer editor** (`docs/html-in-canvas/test-renderer.html`, 2684 lines) | tabs: Preview / AI / Code; gallery; **⬇ Import HTML** (imports `films/*/reel-preview.html` as a stage) | live page | export modal: **MP4 — MediaBunny (frame-exact)** or **WebM — MediaRecorder (wall-clock)** via `src/workers/export-worker.js` | MP4 + WebM | export menu at line ~485; vendored `public/vendor/mediabunny/` |

Cross-layer facts worth keeping in mind:

- `reel-preview.html` files are first-class editor citizens — Import HTML
  already round-trips a film into the editor.
- `automation/shared/skills/` already contains an API reference (`AGENTS.md`)
  and three style guides: `kinetic-text.md`, `product-launch.md`,
  `social-reel.md`, plus `html2canvas-gotchas.md`.
- `docs/html-in-canvas/designs.html` seeds 5 full design systems;
  `automation/html-in-canvas/templates/` holds glassmorphism / gradient-card /
  premium-gradient / design-tokens.
- The original motion plan (`automation/studio-reel/PLAN-motion-and-tailwind.md`
  §4) already ranks the motion gaps P1–P6, and `docs/automation/Transitions-Plan.md`
  exists — this plan does not duplicate them, it sequences them (§5.3).

---

## 2. Diagnosis A — why every film looks the same

Numbers from the current corpus (8 films, 64 scenes):

| axis | measured | effect |
|---|---|---|
| element census | text **84**, shape 33, pills 7, everything else single digits; **`image` used by 0 of 8 films**; `chart` by **1 of 8** | films are typographic columns, period |
| scene backgrounds | flat 31, dots 17, gradient 4, blueprint 1, none 11 | the stage never changes character |
| entrances | `fade`/`slide`/`draw` ≈ everything; 22 of 23 eases never authored | motion reads the same in every scene |
| transitions | none — scenes hard-cut on the emitter's fixed curve (P1 unshipped) | scene changes are abrupt, not designed |
| layout | one grammar: `.hss-scene` = centered column, `align` = left/center only | no split, no grid-of-columns, no full-bleed, no poster composition |
| type | 6 roles, sizes vary; no word/char-level animation (P2 unshipped) | titles always arrive as one slab |
| camera | none (P4 unshipped) | every frame is locked off |
| format | all 8 films 16:9 | no vertical/square cuts even though `aspect: "9:16"` compiles |

Root cause: **the emitter's layout grammar has one entry (centered stack), and
the gates reward the safe middle** (extent wants margins, contrast wants
measured inks). Both are good gates; neither rewards composition. Variety must
therefore be *authored vocabulary* (new layouts, new motion), not gate
loosening.

The honest second half: **the de facto scene template** — overline → title →
component → body → emphasis — is repeated because it is the only template that
has ever passed every gate. It needs siblings, each proven the same way.

---

## 3. Diagnosis B — export reality vs. the impression

**What already works (keep):**

- `npm run reel:export` → CDP + test-renderer + in-page MediaBunny → MP4,
  then the file is re-read with MediaBunny **in Node** (size, duration,
  dimensions, packet count) and the run fails if the file is not a video.
  Zero ffmpeg involvement. 9/9 films exported on this machine.
- The cdp strategy in `automation/html-in-canvas/render.js` is deterministic:
  two runs → byte-identical files (README-measured sha256).

**What is actually broken or missing:**

1. **ffmpeg survives in one place**: `render.js -m cdp` encodes screenshots
   with ffmpeg (CRF presets, `-q` flag). The repo's only ffmpeg dependency —
   and the target is "MediaBunny only, CDP-driven".
2. **No WebM from studio-reel** (`export-films.cjs` has zero webm paths), and
   the editor's WebM is MediaRecorder **wall-clock** capture — nondeterministic
   timing, and the README's own troubleshooting says realtime encoders can
   stall to flat frames.
3. **No export gate.** Nothing exports a fixture automatically; an export
   regression is discovered by a human watching it fail. (The historical
   "valid MP4 containing a flat grey field" bug in the editor path is exactly
   the class that needs a gate.)
4. **No parity harness** (README open item: "every parity number was produced
   by a shell one-liner").
5. **Failure triage is folklore**: origin-bound modules (`file://` kills the
   vendored MediaBunny), stale Chrome sessions (`taskkill //IM chrome.exe`),
   Vite-vs-http-server, port auto-detect. The reported "not able to export"
   is most likely one of these — see §8 Q1; `export-doctor` (T1.4) makes
   every one of them a one-line diagnosis instead of a dead run.

---

## 4. What to learn from each surface

**From `test-renderer.html` (the editor):**
- **Import HTML round trip** — the design loop should be: compose/iterate in
  the editor (live, styled, with the AI tab), then import as a film. The reel
  pipeline becomes the *verifier and exporter* of designs born in the editor.
- **The AI tab** (Get AI Code / Paste Reply) — a prompt → code → paste loop
  already exists; it can author compositions *and* storyboard fragments.
- **Export modal UX** — format / fps / resolution as explicit, remembered
  choices; "MP4 — MediaBunny, frame-exact" labeling is the right honesty.
- **What it renders that reel cannot**: freeform placement, layers, whatever
  the Designs Gallery seeds contain — each seed is a latent film art
  direction.

**From `automation/html-in-canvas/` (the composition pipeline):**
- **`StudioPro.keyframes()`** — per-property keyframes over the editor's clip
  model (this is P5 energy without waiting for P5).
- **Templates** (glassmorphism, gradient-card, premium-gradient, design-tokens)
  — reusable surfaces the emitter's `surface` vocabulary should absorb.
- **Style guides** in `shared/skills/` (`kinetic-text`, `product-launch`,
  `social-reel`) — these are the missing "film recipes"; each guide should
  become a scene-recipe family in the reel (§5.2).
- **The deterministic-vs-editor split** — two strategies, one command, each
  with a stated purpose; studio-reel should copy that honesty (`--mode
  reference|editor`).

**From `designs.html` (gallery):** 5 seed systems = 5 ready art directions
(tokens + component personality) importable as `design.json` starting points.

---

## 5. The plan

### 5.1 Track T — one export substrate, no ffmpeg, MP4 + WebM (do first)

1. **Extract a shared harness** `automation/shared/export/` from
   `export-films.cjs`: CDP frame pump (render frame i at t = i/fps, pure
   `onFrame`) + in-page MediaBunny encoder + Node-side MediaBunny verifier.
   Both `export-films.cjs` and `html-in-canvas/render.js` consume it.
2. **Kill the ffmpeg encode in `render.js -m cdp`**: screenshots stop being
   the transport (frames go to the in-page encoder as they are rendered, the
   way export-films already does). `-q draft|standard|ultra` remaps from CRF
   to bitrate ladders; `-f mp4|webm` keeps working.
3. **WebM done frame-exactly**: MP4 = `avc1` (what runs today), WebM = VP9
   via WebCodecs — *not* MediaRecorder. `--format mp4|webm|both` on
   `export-films` (default `mp4`, so existing behavior is unchanged).
   Verification covers both containers (codec string, duration, packets,
   dimensions) with MediaBunny in Node. **No ffprobe in any code path** —
   it was only ever a human convenience.
4. **`export-doctor`** preflight run automatically before a batch: browser
   binary found, WebCodecs available, origin not `file://`, vendored
   mediabunny reachable, dev server up *when the editor path needs it*, port
   free, disk space. Every historical failure mode becomes a named line.
5. **An export gate** (the missing gate #11): a 1-second fixture film
   exported to MP4 *and* WebM on every gate run, verified by re-read; plus a
   determinism probe (same input twice → identical frame hashes, computed
   in-page — the html-in-canvas framemd5 idea without ffmpeg).
6. **`--changed-since <ref>`** for both entry points: export only films whose
   storyboard/clip changed — the common "I edited one film" loop stops costing
   a full batch.

**Acceptance:** with ffmpeg absent from PATH, `npm run reel:export` and
`node html-in-canvas/render.js examples/simple-test.js` both exit 0, produce
verified MP4 *and* WebM, and the export gate is green in the normal battery.

### 5.2 Track V — visual variety (the core complaint)

Ranked by perceived-variety-per-effort:

1. **Vocabulary report → style gate.** Extend the motion gate's coverage
   report into a per-film *style report* (layouts used, element census,
   backgrounds, entrance mix, ease mix, aspect) and start it as an
   informational gate. What is measured gets authored. (Data for all of §2
   came from exactly such a report.)
2. **A second layout grammar — `layout` on the scene.** The emitter needs at
   least: `stack` (today's centered column), `split` (two columns: statement
   + evidence), `grid` (tile matrices that are not centered), `fullbleed`
   (type as poster, edge to edge), and `frame` (a bordered inset stage —
   the "video inside video" the product itself sells). Each layout gets the
   same discipline as a type: schema field, reconcile branch, extent proof.
3. **Use what already exists.** `image` (0/8 films) and `chart` (1/8) are
   shipped, gated capabilities sitting idle — next films must use them. A
   film brief that uses neither is a missed opportunity by default.
4. **Kinetic type (plan P2).** Word-by-word rise, per-character blur-in —
   the design sources already show the exact recipes (`.w`/`.ch` spans in
   test-renderer, `kinetic-text.md`). Biggest single win: every title stops
   arriving as one slab.
5. **Surface recipes from templates.** The emitter's `surface` enum knows
   gradient/dots/blueprint and the corpus uses flat+dots almost exclusively.
   Promote `templates/*.html` treatments (glass, premium gradient) into
   surface recipes so the stage can change character between scenes.
6. **Format variety.** Ship a 9:16 and a 1:1 cut of at least one film
   (the `social-reel.md` guide and `aspect` support already exist). The
   vertical reel is also the most honest "did layout survive?" test.
7. **Art-direction workflow.** Every new film declares a *visual thesis* in
   `Design.md` (one sentence: what this film looks like that no other does)
   and borrows one direction from the designs gallery or templates. Generalize
   the existing plan-§8 adoption discipline from "features" to "looks".

### 5.3 Track M — motion depth (sequence of existing plans, not a new one)

Execute `PLAN-motion-and-tailwind.md` §4 in order, each behind its own gate:
**P1 exits & scene transitions** first (this is what makes ≤3-second scenes
read as pace instead of chopping — see `docs/automation/Transitions-Plan.md`),
then **P2 text depth**, **P4 camera/parallax**, **P5 keyframe paths**, **P3
data motion**. Also: stop shipping an ease library nobody authors (22/23 eases
unused) — style guides should prescribe curves the way they prescribe ramp
steps.

### 5.4 Track W — the loop (workflow)

1. **Watch/preview mode** for reel-compile (README open item): `--watch`
   recompiles on storyboard change and hot-reloads the preview.
2. **Parity/comparison harness** (README open item): run twice, diff frame
   hashes, diff clip artifacts — automated versions of today's shell one-liners.
3. **Editor → film loop**: document + script the Import-HTML path so a design
   made in test-renderer becomes a storyboard with gates instead of a
   screenshot.
4. **AI → storyboard**: the AI tab's prompt/reply loop gains a "paste into
   storyboard.json" target (schema-gated, so bad fields fail loudly at the
   JSON pointer).

---

## 6. Non-goals

- No ffmpeg in any code path (after T1); no MediaRecorder for reference
  exports (wall-clock is for interactive saves only).
- No runtime Tailwind (Route B stays rejected; build-time compile is done).
- Reel does not grow a live editor; the editor does not grow a schema. Each
  keeps its job: the editor designs, the reel verifies and exports.
- Do not weaken extent/contrast to allow bolder compositions — add layout
  vocabulary instead (§2).

---

## 7. Milestones

| # | milestone | acceptance |
|---|---|---|
| M1 | **Export unification** (T1.1–T1.4) | ffmpeg absent from PATH; both CLIs export verified MP4+WebM; `export-doctor` names every known failure mode |
| M2 | **Export gate + determinism probe** (T1.5–T1.6) | gate runs in the normal battery; double-run frame hashes match; `--changed-since` works |
| M3 | **Style report + second layout (`split`)** (V1–V2) | report green per film; one new film uses ≥2 layouts and its Design.md states the thesis |
| M4 | **Kinetic type + surfaces + image/chart adoption** (V4–V6) | new vocabulary in ≥3 films; ease/style coverage report visibly diversifies |
| M5 | **Transitions (P1) + vertical cut** (M3 + V6) | a 9:16 export verified; transition gate added |
| M6 | **Camera/keys (P4/P5) + watch mode + AI loop** (M1.1, M4) | end-to-end: design in editor → storyboard → gated film → export |

---

## 8. Open questions

1. **Which export failed, and with what?** (command + error text). The
   three surfaces behave differently: studio-reel's chain was verified green
   on this machine today (9/9 films); the likely candidates are the editor's
   modal (wall-clock WebM / realtime stall) or `render.js` (needs Vite +
   ffmpeg + fresh Chrome). `export-doctor` will answer this for everyone, but
   one failing log line would pin it now.
2. **Is wall-clock WebM ever acceptable?** If the editor's WebM is only for
   quick interactive saves, T1.3's frame-exact WebM becomes the only WebM the
   pipeline produces and the MediaRecorder path can be labeled "preview".
3. **Priority between tracks**: this plan puts export trust first (M1–M2)
   and variety second (M3–M4) because variety work multiplies *through* a
   trustworthy exporter — but if a specific delivery needs a look sooner, M3
   can start in parallel; nothing in it depends on T1.
