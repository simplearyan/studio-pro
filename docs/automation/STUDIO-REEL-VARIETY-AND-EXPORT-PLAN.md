# Studio Reel — variety & export direction plan

**Status:** Track T (§5.1) is implemented and gated; the export gate is green
in fixture mode with one known film-mode failure (below). Track V has shipped
V1 (style report) and V2 (`split`); packs (§5.2b) and the site→film worked
example (§5.2c) landed with `reel-landing-film`. Tracks M and W and V3–V7 are
not started. What is done, what is left, and why is written in §9. Written
after the verdict: *"films come out in the same format and style, and export
is not trustworthy — learn from what test-renderer and
automation/html-in-canvas offer; export without ffmpeg, MediaBunny only, MP4
**and** WebM, driven through CDP; say what to add, what to improve, and which
direction to move ahead in."*

---

## 0. The two complaints, stated honestly

1. **Visual sameness.** Eight films, one skeleton. Every scene is a centered
   flex column: overline → title → support component → body → shape emphasis.
   Tokens, ramp and copy change; structure never does. Measured below (§2).
2. **Export distrust.** The studio-reel export chain demonstrably works today
   (evidence in §3), but *one of the four* export surfaces in this repo still
   shells out to ffmpeg, the editor's WebM path is wall-clock, and there is no
   automated export gate — so "it can't export" is a reasonable impression to
   have hit. All three are addressed by Track T (§5.1).

---

## 1. What exists today — four surfaces, one repo

| layer | input | render | encode | formats | evidence |
|---|---|---|---|---|---|
| **md-render** (`automation/md-render/`) | markdown/JSON script → `parseMarkdownToClips()` (or `importSpcomp` for JSON) | puppeteer-core drives the *real editor* export modal: `setRadio(format/resolution/fps)` → `submitExport()` → 500 ms progress poll → blob pulled from `window._exportDoneUrl` | editor pump: **FTRT default (4× realtime)** / MediaBunny / standard | MP4 + WebM · 720p–2160p · bitrate ladder 3/8/15/30 Mbps · `-t` applies a design template before export | `render.js` 493 lines; batch via `automation/batch.js` |
| **studio-reel** (`automation/studio-reel/`) | storyboard JSON → `reel-compile` → 10 gates | CDP drives `test-renderer.html`, pure `onFrame(t)` per frame | **in-page MediaBunny → WebCodecs** (no ffmpeg anywhere in the chain) | MP4 only | 9 MP4s in `_exports/reel/`; reel-site verified 1920×1080 · 975 frames · 32.500s by re-read + ffprobe |
| **html-in-canvas** (`automation/html-in-canvas/`) | StudioPro API composition scripts | `-m cdp`: standalone page + `Page.captureScreenshot` per frame (**deterministic, byte-identical runs**) — *or* `-m editor`: drives the real editor export pump | cdp mode: **ffmpeg** (CRF presets). editor mode: MediaBunny / FTRT / standard | MP4 + WebM (`-f`) | README parity numbers; the only ffmpeg left in the repo |
| **test-renderer editor** (`html-in-canvas/test-renderer.html`, 2684 lines) | tabs: Preview / AI / Code; gallery; **⬇ Import HTML** (imports `films/*/reel-preview.html` as a stage) | live page | export modal: **MP4 — MediaBunny (frame-exact)** or **WebM — MediaRecorder (wall-clock)** via `src/workers/export-worker.js` | MP4 + WebM | export menu at line ~485; vendored `public/vendor/mediabunny/` |

Cross-layer facts worth keeping in mind:

- `reel-preview.html` files are first-class editor citizens — Import HTML
  already round-trips a film into the editor.
- `automation/shared/skills/` already contains an API reference (`AGENTS.md`)
  and three style guides: `kinetic-text.md`, `product-launch.md`,
  `social-reel.md`, plus `html2canvas-gotchas.md`.
- `html-in-canvas/designs.html` seeds 5 full design systems;
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

## 4A. Deep dive — `automation/html-in-canvas/render.js` (517 lines)

### Complete option matrix

| flag | values | default | what it actually does |
|---|---|---|---|
| `-m, --mode` | `cdp` \| `editor` | `cdp` | selects the whole pipeline (below). Legacy aliases `gui`, `mediabunny`, `ftrt`, `standard` are mapped to `--mode editor --encoder <x>` **and reported**, so a stale command tells on itself |
| `-e, --encoder` | `mediabunny` \| `ftrt` \| `standard` | `mediabunny` | editor mode only; maps `${encoder}-${format}` onto the editor's export radio (`video-ftrt-mp4`, `video-mediabunny-mp4`, …). In cdp mode it is ignored *with a warning* |
| `-q, --quality` | `draft` \| `standard` \| `ultra` | `ultra` | cdp: ffmpeg CRF **28 / 23 / 18**. editor: passed through — the editor modal owns the bitrate |
| `-f, --format` | `mp4` \| `webm` | `mp4` | container; validated, unknown values print the allowed list |
| `--fps` | any > 0 | `30` | validated as a positive number |
| `-u, --url` | URL | auto | skips port auto-detect; ports tried **7000 → 3000 → 3001**, 1.5 s timeout each, with a copy-pasteable remediation message when none answer |
| `--retries` | int | `3` | whole-render retry loop, 2 s backoff between attempts |
| `--no-headless` | flag | headless | shows the Chrome window |
| positional | `script.js [output]` | — | script resolves against CWD; output defaults to `output/<script>_<quality>_<fps>fps_<modeTag>.<fmt>` (mode tag = `cdp` or `editor_<encoder>`) |

`validateOptions()` returns an error *string* (or null) rather than throwing —
the CLI prints it and exits 1 before launching anything. Worth copying for the
reel CLI: bad input fails in <1 s, not after a browser cold start.

### The two pipelines, step by step

**`-m cdp` (default) — deterministic reference render:**
1. Launch headless Chrome 1920×1080 → detect dev server → `goto` → wait for
   `window.StudioPro`.
2. **Script injection** (`SCRIPT_INJECT`, shared by both modes so they can
   never disagree): strip comments and `module.exports`/`export default`,
   rebuild as a function, `new Function('return ' + fnStr)()`, call it with
   `(window.StudioPro, window.State)`.
3. Extract every visible `type: 'hic'` clip: `{html, css, js (the compiled
   onFrame), fonts, systemFonts, duration, start, 1920×1080, effects}`.
4. **Font preload once** — a single page loads the union of all fonts across
   all clips before any capture (frames never race font loading).
5. Per clip: build a *standalone* page and seek `onFrame(t)` per frame via CDP
   `Page.captureScreenshot` → PNGs on disk.
6. Multi-clip: copy every clip's frames into one concat dir **in timeline
   order**, encode once, then `cleanupFrames()` everything.
7. Encode with **ffmpeg** CRF — the only ffmpeg in the repo, and the exact
   call T1.2 deletes.

**`-m editor` — the only automated consumer of the real export path:**
`StudioProClient.execute(script)` → `preloadHtmlClips()` → open the export
modal, set format/resolution/fps radios, submit → poll progress → pull the
finished blob from `window._exportDoneUrl` → write to disk → **verify the file
exists** (the editor reports failures by logging, not throwing — so the check
is on the artifact, not the return value).

### Determinism evidence (the core lesson)

| | cdp mode | editor mode |
|---|---|---|
| timing | frame index → t = i/fps, exact seek | realtime pump, wall clock |
| runs | two runs → **byte-identical** files (README-measured sha256) | nondeterministic; README parity table shows **90 / 150 frames differ** between encoders |
| purpose | reference renders, regression probes, parity harnesses | proves the *shipped* export path works |
| encode | ffmpeg CRF | MediaBunny / FTRT / standard |

The architectural split — **one CLI, two strategies, each with a stated purpose
and an honesty warning when flags don't apply to the chosen mode** — is exactly
what studio-reel's `--mode reference|editor` should copy (plan §4, T1).

### Option-matrix gaps reel should not inherit

- No resolution flag (hardcoded 1920×1080) and no `--changed-since` — every
  run is a full render (T1.6).
- Quality is CRF in one mode and a meaningless pass-through in the other;
  md-render's named bitrate ladder (§4B) is the better UX (T1.2).
- `--fps` is free-form although only 24/30/60 are ever used — validate
  against a list like `mode`/`format` already are.
- No post-encode verification in this file (the reel's Node-side MediaBunny
  re-read is stronger and should become shared, T1.1).

---

## 4B. Deep dive — `automation/md-render/render.js` (493 lines): markdown → video

### What it is

The smallest possible authoring-to-video path: **a human writes prose, gets an
MP4.** Markdown is parsed into editor clips, loaded into the real StudioPro
timeline, and exported through the editor's own pump — no storyboard JSON, no
gates, no emitter.

**Markdown contract:** `# Title` → title clip · each paragraph → a text clip ·
`![alt](img)` → an image clip · `---` → scene break. That is the entire
language, and it is enough to author a film in a text editor.

### Complete option matrix

| flag | values | default | notes |
|---|---|---|---|
| positional | `scripts/*.md` or `.json` | — | `.md` → `State.markdownText` + `parseMarkdownToClips()`; `.json` → `importSpcomp(data)` |
| `-o, --output` | path | auto | auto-name encodes **every parameter**: `<script>_<quality>_<bitrate>_<fps>_<encoder>_<res>.ext` — e.g. `demo_high_15Mbps_60fps_FTRT-H264_1080p.mp4`; provenance is in the filename |
| `-r, --resolution` | `720p` \| `1080p` \| `1440p` \| `2160p` | `1080p` | `RESOLUTION_MAP` 1280×720 … 3840×2160 (2160p) |
| `--fps` | `12, 24, 30, 60` | `30` | documented list (not validated, but documented) |
| `-f, --format` | `ftrt-mp4` \| `ftrt-webm` \| `mediabunny-mp4` \| `mediabunny-webm` \| `std-mp4` \| `std-webm` | `ftrt-mp4` | mode+codec in one flag; FTRT = **4× realtime** frame-index loop, MediaBunny/standard = 1× |
| `-q, --quality` | `draft` \| `standard` \| `high` \| `ultra` | `ultra` | **named bitrate caps: 3 / 8 / 15 / 30 Mbps**, labeled by destination (draft = preview, standard = social, high = YouTube) |
| `-t, --template` | template id | — | calls `window.applyDesignTemplate(id, 'apply')` **before export** — one flag restyles the whole film |
| `--debug` | flag | headless | visible Chrome window |
| config.json | `chromePath`, `devServerPort` (7000), `outputDir` | — | system Chrome via puppeteer-core, `--enable-webcodecs` |

### Pipeline, step by step

1. **Dev-server discovery**: ports `config → 3000 → 3001 → 5173 → 5174`, each
   probed over IPv4 *then* IPv6 (Vite may listen on either).
2. **Server identity check**: fetches the page and requires `@vite/client` in
   the HTML — refuses to run against `npx http-server`/`serve` with an
   explicit "NEVER use" message. A wrong server is diagnosed *before* a 30 s
   timeout produces garbage.
3. Launch Chrome → `goto` `networkidle0` → wait for three window globals
   (`startMediaBunnyExport`, `openExportModal`, `submitExport`).
4. Load script (md → clips, or JSON → `importSpcomp`) → optional `-t`
   template.
5. Drive the **UI itself**: `openExportModal()`, `setRadio('exportFormat',
   …)`, `setRadio('exportResolution', …)`, `setRadio('exportFrameRate', …)`,
   `setExportQuality(q)`, `setRadio('exportScope', 'full')`,
   `submitExport()`.
6. Poll every 500 ms; print `NN% (Xs) t=…` only when progress advances ≥5 pp.
7. Fetch `window._exportDoneUrl` → base64 → `writeFileSync`. On blob failure
   it warns and *continues* (Chrome may have downloaded it anyway).

### What reel should take from md-render — in detail

1. **Authoring ergonomics is the missing layer.** Reel requires 100+ lines of
   schema-gated JSON to say what md says in 20 lines of prose. md-render
   proves the parse is trivial (paragraphs → clips). Reel should gain a
   **`.md` → storyboard front-end**: prose + `---` breaks + `![](img)` plus a
   front-matter `pack:` reference; the pack's recipes fill the structure, the
   gates verify the result. This is the biggest lesson in this file.
2. **`-t/--template` already exists in the editor** — `applyDesignTemplate`
   applies a whole design system by id in one call. Design packs (§5.2b) are
   that idea made storyboard-grade; the editor's template registry is a seed
   source for them.
3. **Quality should be a named destination, not a codec number.** md-render's
   ladder (draft 3 Mbps / standard 8 / high 15 / ultra 30) communicates
   *why* you would pick one; CRF 28/23/18 does not. T1.2's `-q` remap should
   adopt this ladder (keeping the existing three names working, adding
   `high`).
4. **Resolution × fps × format as first-class, documented matrices.** Reel is
   locked to 1920×1080 / 30; V6 (aspect) plus a `-r` flag makes vertical and
   draft-quality iteration cheap — a 720p draft is the natural preview.
5. **FTRT 4× as the default.** The fastest *verified* path should be the
   default everywhere; md-render already defaults to it (`ftrt-mp4`).
6. **Verify the server, not just the connection.** The `@vite/client` check is
   one line and kills an entire class of dead runs — it is a free
   `export-doctor` line (T1.4).
7. **Parameter-encoded filenames** — auto-generated outputs should carry
   quality/fps/encoder/resolution so any artifact can be traced to its flags.

### What reel should *not* copy

- **UI-driving as an API** (`setRadio` on modal DOM, waiting on three window
  globals) is brittle: any modal refactor silently breaks every automation.
  Reel keeps its programmatic export entry point.
- **No artifact verification** — md-render trusts the blob write; the "valid
  MP4 of a flat grey field" bug is the exact failure it cannot see. Reel's
  Node-side MediaBunny re-read stays the differentiator.
- **No retries** (reel's render.js has `--retries 3`; keep it) and **base64
  blob transport** (doubles memory; stream or write from the page side).
- Failures often `log` rather than throw (`_exportDoneUrl` null ⇒ warning,
  exit 0) — an exit code that lies is worse than a crash.

---

## 4C. Deep dive — test-renderer PRESETS: how the complex recipes are actually built

The 17 presets are not screenshots — each is a complete, animated design
machine. Understanding their anatomy is what makes them portable to films.

### Anatomy of a preset

`PRESETS` (test-renderer.html:624) is an object keyed by id; every entry is:

| field | contents |
|---|---|
| `name`, `cat`, `dur` | gallery label, category, duration |
| `html` | the whole stage markup — may inline a Google Fonts `<link>` and CDN `<script>` tags (KaTeX, marked) directly in the block |
| `css` | the full custom design; presets compose hand-written CSS *around* Tailwind utilities, not instead of them |
| `js` | optional `onFrame(t)` — a **pure function of time**; every complex choreography lives here |

### The dependency layer (the runner injects it for you)

- **Tailwind**: on import, existing tailwind script tags are stripped
  (line 1469), then if the markup uses utilities *without* a CDN script the
  runner injects `cdn.tailwindcss.com` (lines 1481–1483). The file's own
  note (line 1477): the editor compiles with local `@tailwindcss/browser`
  v4 while the standalone page uses the Play runtime — **utility coverage
  skews between the two**; a class that renders in preview can silently miss
  in export. That skew is exactly why reel's compile-time `attachUtilities`
  (no runtime, theme+utilities layers) is the right call.
- **KaTeX**: if the markup hints at `renderMathInElement`/katex css but no
  `katex.min.js`, the runner injects the three CDN tags (lines 1493–1496).
- **MDX**: the `mdx-report` pattern — hidden `<div style="display:none">`
  holds raw markdown, `marked.parse()` runs once inside `onFrame` init, then
  each parsed child is staggered from `t` (250 + 350·i ms, 700 ms ease-out-
  quart rise). No build step, no MDX compiler — markdown → DOM → time.
- **The AI tab's prompts are the recipe book**: they document, in prose, the
  exact recipes for KaTeX proof choreography, two-font editorial reveals,
  per-word karaoke fill (inset() clip sweep driven from time), blur-crossfade
  font-pairing transitions, mono manifesto staggers — all ending in the house
  rule *"deterministic from time only"*.

### What reel's `html` element can copy verbatim vs. what needs a bridge

| preset capability | reel `html` element today | bridge needed |
|---|---|---|
| Google Fonts `<link>` in markup | passes (only `<script` is rejected); loads at render time | works now; **vendor** for offline/deterministic export (T1.8) |
| Tailwind utility classes | compile at build via `attachUtilities` — shipped in T1 | none; strip the CDN script (the ban already forces this) |
| KaTeX CDN scripts | rejected at element level (script ban) | use the film-level `design.math.src` inlined KaTeX that already exists |
| `marked`/MDX runtime parse | rejected (script ban) | **preprocess MD → static markup at compile time** (T1.9) |
| CSS `@keyframes` in markup | passes the gate, but see the mismatch: `cdp-capture.js` **seeks `document.getAnimations()` per frame** (line 283) while the reel export pump (`export-films` + `hic-frame`) never does → wall-clock drift | **seek animations in the shared harness** (T1.7) |
| IntersectionObserver reveals (`.rv`) | observers don't fire in a frame-seek pump | rewrite as time-driven (storyboard entrance, or a seeked CSS animation) |
| `onFrame(t)` choreography per element | not available at element level — the storyboard owns time | port the recipes as pack scene-recipes + motion vocabulary (V4/V7) |

Row 5 is the most important finding in this section: **the seek code already
exists in this repo** (cdp-capture does it for html-in-canvas), it just has
not been carried into the shared export harness. Doing so makes complex,
preset-style CSS animation inside reel `html` elements frame-exact for free.

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
7. **Seek CSS animations in the shared pump** (T1.7): `cdp-capture.js` already
   seeks `document.getAnimations()` per frame before each screenshot — carry
   the identical seek into the shared harness so `export-films` (and anything
   built on it) renders CSS `@keyframes` **and** transitions frame-exactly.
   This is what unlocks copying complex preset animation into reel `html`
   elements verbatim instead of rewriting everything as storyboard motion.
8. **Vendor web fonts** (T1.8): `design.fonts` / `font_href` load Google Fonts
   over the network at render time; gates and exports depend on connectivity
   and CDN state. Compile step: fetch the woff2 files once → local/data
   `@font-face` in the generated doc. Then the battery runs **offline** and
   two runs of the same film cannot differ because a CDN changed.
9. **Compile-time markup preprocessing** (T1.9): the MDX pattern
   (`marked.parse` at runtime) is script-banned in elements by design.
   Preprocess markdown → static markup inside `reel-compile` (same slot the
   KaTeX blob already occupies), so preset-style content lands as gated
   markup instead of a runtime dependency.

**Acceptance:** with ffmpeg absent from PATH, `npm run reel:export` and
`node html-in-canvas/render.js examples/simple-test.js` both exit 0, produce
verified MP4 *and* WebM, and the export gate is green in the normal battery —
with the network unplugged (fonts vendored, no CDN tags) and CSS-keyframed
scenes matching on a double-run (T1.7).

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

### 5.2b Design packs — repeatable art directions (the PRESETS model)

**Goal:** a film's look becomes a *named, versioned, one-flag choice*. Pick
`neo-brutal` and get a completely different design; pick it again next month
(or in another film) and get the *same* design back. The screenshot of
`test-renderer.html` is the proof of concept: its `PRESETS` constant holds 17
named recipes (Google Clean, Gradient Hero, Neo-Brutal, iOS Glass, Data Chart,
Stagger Grid, Fireship Terminal, Material You, iOS Gradient, Vox Title, Text
Reveal, Google Search, LaTeX Math, MDX Report, Custom Font, Tailwind Cards,
Story Reel 9:16), each rendered live as a gallery card, applied on click,
previewable before committing. Design packs lift that model one level up —
from *one page's look* to *a whole film's art direction*.

**Pack = a directory** `automation/studio-reel/packs/<pack-name>/`:

| file | contents | consumed by |
|---|---|---|
| `pack.json` | `name`, `thesis` (one sentence: what this looks like that no other pack does), `aspect` support, `fonts[]`, `ramp[]`, tokens (bg / ink / accents / radius), **motion signature** (ease mix, entrance defaults, transition default), list of scene recipes | schema gate (new enum + fields, same discipline as the `html` element type) |
| `recipes/*.json` | scene-recipe templates — layout + element slots + emphasis defaults. These deliberately give the de-facto template from §2 *siblings* (stack/split/grid/fullbleed/frame once V2 ships) | `reel-compile` defaults |
| `example.json` | one complete storyboard using only this pack that passes **all 10 gates** | regression gate |
| `preview.html` *(optional)* | one 16:9 gallery card, same thumbnail contract as the PRESETS grid | docs gallery |

**Rules:**
1. A film declares `"pack": "<name>"` at storyboard root. Default = `studio-white`
   (today's look), so all 8 existing films compile unchanged.
2. Packs set **defaults, not absolutes** — explicit storyboard fields override
   them. A pack is a fork-able starting point, not a cage.
3. Every pack ships with a gate-passing `example.json`. A look that cannot
   pass extent/contrast/motion is not a pack, it is an idea.
4. The style report (V1) logs pack + how much the film overrode it, so drift
   in either direction is visible.
5. Packs live in git — repeatable by construction, diffable, reviewable.

**Seed sources (all already in-repo):** the 17 test-renderer PRESETS;
`designs.html`'s 5 design systems; `automation/html-in-canvas/templates/`
(glassmorphism, gradient-card, premium-gradient, design-tokens); the three
`shared/skills/` style guides (each prescribes a motion/type personality);
`reel-site`'s white landing-page theme (becomes the `studio-white` default).

**Workflow (the loop the user asked for):** open the pack gallery → click a
card → scaffold a new storyboard from the pack's recipes → write copy → gates
→ export. To repeat a look later: reference the pack name; to remix: fork the
directory. CLI sugar: `npm run reel:new -- --pack neo-brutal` scaffolds
`pack.json` + `example.json` + a storyboard stub.

Sequencing: schema/defaults plumbing slots in after V1 (the style report tells
us what a pack must control); recipes need V2's layouts to have anything
interesting to choose between; seed packs land with M4.

### 5.2c Site → film: capturing a real landing page (worked example)

**The reference site** (`Reel — video editor with built-in annotation`,
684 lines, 12 sections), measured from source — this is the first candidate
for a "film about a site with *that site's* design":

| axis | what the site uses | where it lands in the plan |
|---|---|---|
| color | `--bg`/`--ink` CSS vars + palette: **#FFD84D** highlighter yellow, **#6965DB** brand indigo, **#14161F** ink, #0F1233/#2A2468 deep navies, #FF4D8D/#FF9A6B warm accents, #F0EFFC tint | pack `tokens` + `ramp` (§5.2b) — contrast gate verifies the inks |
| fonts | **Google Fonts API**: Bricolage Grotesque 400/600/800 (display+body), **Kalam** 400/700 (handwritten annotation accents — the product's whole motif), Instrument Serif ital (editorial accents) | `design.json` `fonts.*` roles + `font_href`; vendored offline by T1.8 |
| tailwind | **Play CDN** (`cdn.tailwindcss.com`), no config — default theme + arbitrary values + hand-written CSS (custom `--ease`/`--d1..d4` vars) | strip the CDN script (element rule already bans it); utilities compile via `attachUtilities` — the default theme + arbitrary values cover this site with no config |
| motion | **23 @keyframes** — entrances `grow/pop/rip/wup` (`both/forwards`, `--ease-out`), ambient loops `bob/float/sway/fly/ring`, plus reveal-on-scroll `.rv` via IntersectionObserver → transition | entrances → pack motion signature + storyboard motion; ambient loops → CSS inside `html` elements, made frame-exact by **T1.7**; `.rv` observers must be rewritten as time-driven |
| structure | 12 sections: hero · scroll-scrub · markup · edit · filters · color · presets · grade · ai · keys · faq · cta | scene recipes: hero/cta → `fullbleed` poster (V2), markup/edit/filters/color → `split`, presets → `grid`, scrub → a real site **screenshot** scrubbed by `image` (V3), faq → `stack` |
| discipline | respects `prefers-reduced-motion` | keep: the film is the motion; the page's own stillness is not the target |

**The workflow, end to end:**
1. **Extract** palette/fonts/eases/keyframes from the site source into a
   `reel-landing` pack (§5.2b) — one pass, every future film about this site
   reuses it.
2. **Author** one scene recipe per *section archetype* (poster / split / grid
   / list), not per section — 12 sections collapse into 5 recipes.
3. **Port animation** in two tiers: cheap tier = storyboard entrances/emphasis
   (gated today); complex tier = CSS keyframes inside `html` elements (gated
   once T1.7 lands). The site's IntersectionObserver reveals map 1:1 onto the
   entrance vocabulary — they are the same intent, time-driven instead of
   scroll-driven.
4. **Assets**: real section screenshots (headless capture) feed `image`
   elements for the scrub/demo scenes; the film never needs the live page.
5. **Verify** with the existing gates + the style report, **export** offline
   (T1.8) to MP4 and WebM.

**Verdict:** the plan already covers the *design* side (packs, tokens, fonts,
Tailwind compile, layouts). The three export-side gaps this analysis surfaced
— CSS-animation seeking (T1.7), font vendoring (T1.8), compile-time MD (T1.9)
— are now part of Track T; with them the pipeline can carry a site's design,
motion and typography into a repeatable film without inventing anything new.

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
5. **Markdown front-end** (the md-render lesson, §4B): accept a `.md` script
   (`# title`, paragraphs, `![](img)`, `---`, front-matter `pack:`) that
   compiles to a storyboard skeleton filled from the pack's recipes, then
   through the same 10 gates. Prose in, gated film out.
6. **CLI ergonomics convergence**: both render CLIs gain md-render's named
   quality ladder, parameter-encoded output filenames, documented
   resolution/fps matrices, and a server-identity check (`@vite/client` /
   export-doctor line) before any browser work.

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
| M7 | **Design packs + markdown front-end** (§5.2b, W5–W6) | two named packs dress the *same* copy in two visibly different films; a pack re-applied in a later film reproduces its predecessor's look; a `.md` draft compiles through all gates to an export |
| M8 | **Site → film** (T1.7–T1.9, §5.2c) | a film built from a real landing page carries its palette, Google Fonts and keyframes; exports verified **offline**; double-run hashes match on CSS-keyframed scenes |

---

## 8. Open questions

1. **Which export failed, and with what?** (command + error text). The
   three surfaces behave differently: studio-reel's chain was verified green
   on this machine today (9/9 films); the likely candidates are the editor's
   modal (wall-clock WebM / realtime stall) or `render.js` (needs Vite +
   ffmpeg + fresh Chrome). `export-doctor` will answer this for everyone, but
   one failing log line would pin it now. — **partially answered by §9**: the
   doctor now names the preflight modes; the one export-shaped failure still
   open is not an encode failure at all but film-mode determinism (§9).

---

## 9. Status — what shipped, what is left

Written 2026-10-10 against the gate battery as it runs today. Every "done"
line below was verified by a command, not by reading the diff.

### Done (all green in the battery)

| item | evidence |
|---|---|
| **T1.1 shared export harness** — `automation/shared/export/` (doctor, encoder page, in-page encoder, serve, MediaBunny Node verifier) consumed by both CLIs | `reel-export-gate` preflight prints all 10 doctor lines OK |
| **T1.2 ffmpeg removed from the cdp chain** — `render.js -m cdp` encodes via the shared in-page encoder; CRF → bitrate ladder | no `spawn(ffmpeg)` remains; doctor reports ffmpeg "not required — ignored" |
| **T1.3 frame-exact WebM** — VP9 via WebCodecs (not MediaRecorder); `--format mp4\|webm\|both` on export-films | fixture gate exports both: `gate.mp4 avc` + `gate.webm vp9`, both re-read in Node |
| **T1.4 export-doctor** — preflight naming every historical failure mode, run before every batch/gate | 10 named lines incl. disk space, vendored modules, origin |
| **T1.5 export gate (#11)** — `reel-export-gate.cjs`: doctor → import → determinism → motion → MP4+WebM verified | fixture mode **PASS, exit 0** |
| **T1.6 determinism probe** — every frame hashed twice in-page; `--changed-since <ref>` on export-films | probe `0-1000ms · 30 frames · double-run identical true` |
| **T1.7 CSS-animation seek** — `hic-frame` materializes `@keyframes` per frame; motion probe catches a frozen raster | fixture's only animation is `@keyframes`; 30/30 distinct frames |
| **T1.8 font vendoring** — `automation/shared/fonts.cjs`, cache gitignored, data-URI `@font-face` | reel-landing-film renders Kalam/Instrument Serif offline; no `<link>` in previews |
| **T1.9 compile-time markdown** — `shared/markdown.cjs` + `md:true` schema field, preprocessed in reconcile; `<script>` in rendered output fails the build | schema+reconcile branches; regression gate: "copy is escaped" |
| **V1 style report** — `reel-style.cjs`, informational per-film census | runs report-only over 9 films |
| **V2 second layout** — `layout:"split"` + per-element `col` in schema + emitter (columns as direct scene children) | schema gate + fidelity green; `reel-landing-film` markup/edit/keys scenes are split |
| **§5.2b packs** — `packs/studio-white` + `packs/reel-landing`, recipes, `example.json`, root `pack` field, `--pack-check` | `reel-compile --pack-check all`: 2 packs pass |
| **§5.2c site→film** — `films/reel-landing-film` (36s, 8 scenes) carries the reference site's palette, fonts and keyframes; battery green on it (schema/fidelity/contrast/extent/motion/regression) | 7 gates + packs pass with the film in the corpus |
| **npm surface** — `reel:doctor`, `reel:gate`, `reel:style`, `reel:packs`, `reel:watch` | `package.json` scripts |

### Left (the honest list)

1. **Film-mode determinism fails on `reel-landing-film`'s keys window** —
   the only red line in the battery. `reel-export-gate --film
   reel-landing-film --probe 22000:27000` hashes 151 frames and reports
   *first mismatch at frame 13* (≈433 ms into the window, scene `keys`, the
   split scene with CSS-keyframed `html` elements); the cta window
   (31000:36000) matches. Two candidates were eliminated: the gate's own
   import auto-play race is fixed (playback is stopped before probing), and
   the mismatch survives that fix with identical *final* states — so
   something inside the keys scene's animation diverges mid-window and
   heals. Not yet bisected to the element. Fixture mode, which exercises the
   same T1.7 materialization path, is deterministic — so this is a scene-
   content bug, not a harness bug. **Until it is fixed, the M8 acceptance
   ("double-run hashes match on CSS-keyframed scenes") is not met.**
2. **Track M not started** — transitions (P1), kinetic type (P2), data
   motion (P3), camera/keys (P4/P5). The motion gate says it plainly:
   "exits / ambient / keyframes: no vocabulary shipped yet".
3. **V3–V7 not started** — `image` adoption (still 0 films), surface
   recipes, format variety (no 9:16/1:1 cut), grid/fullbleed/frame layouts,
   the art-direction workflow beyond the two seed packs.
4. **`--changed-since` is reel-only** — `render.js` still has no
   changed-film filter.
5. **The editor's WebM is still wall-clock** (MediaRecorder) — T1.3 made
   the *pipeline's* WebM frame-exact; the editor's own export modal is
   untouched, and open question 2 (label it "preview"?) is still open.
6. **A `.md` draft does not yet compile to a film** — T1.9 gives elements a
   markdown payload; the md-render-style front-end (a `.md` file →
   storyboard skeleton, §5.2 item 5) is unbuilt.
7. **Known tooling note:** `automation/shared/export/serve.cjs` briefly
   appeared ESM-only under `require()` during a teardown; it could not be
   reproduced on a clean run (the gate uses it green every time). Flagged in
   case it recurs — likely a stale module cache, not the file.
2. **Is wall-clock WebM ever acceptable?** If the editor's WebM is only for
   quick interactive saves, T1.3's frame-exact WebM becomes the only WebM the
   pipeline produces and the MediaRecorder path can be labeled "preview".
3. **Priority between tracks**: this plan puts export trust first (M1–M2)
   and variety second (M3–M4) because variety work multiplies *through* a
   trustworthy exporter — but if a specific delivery needs a look sooner, M3
   can start in parallel; nothing in it depends on T1.
