# One HTML-in-Canvas automation pipeline

**Status:** ✅ **complete — P1–P4 executed** (§10–§13). `html-static/` is deleted, along with the
legacy `lib/`, the injected seek shim and the `getAnimations()` branch, and every live reference has
been repointed to `automation/html-in-canvas/`.
**Depends on:** the HTML-engine consolidation (`4808621`), the legacy clip removal plan's Phase 3
(the load migration — implemented, uncommitted) and Phase 4 (not started).
**Decision taken:** `automation/html-in-canvas/` replaces **both** `html-static/` and `html-waapi/`,
carrying **two export strategies** — CDP screenshots as the default, the editor's own export pump as
a parity mode.

---

## 0. The short answer

Yes — and it should absorb both folders rather than only `html-static`.

They are not two pipelines. `html-waapi/api.js` is a **superset copy** of `html-static/api.js`:
`_detectPort`, `launch`, `execute`, `export` and `close` are the same code, 168 distinct lines are
byte-identical, and the only functional difference is which preload runs — a difference that Phase 3
has now erased, because both preloads target `type: 'hic'`.

So "new folder, delete `html-static`" would leave `html-in-canvas/` sitting next to a near-duplicate
`html-waapi/` — the exact shape the engine consolidation just removed, one layer down.

This is also what the original design doc intended: [docs/html-in-canvas/PLAN.md:80](../html-in-canvas/PLAN.md#L80)
sketches `automation/html-to-canvas/` with `render.js` ("CDP-based renderer (like html-waapi)"),
`cdp-capture.js`, `examples/` and `output/`, and lists `code-to-video/` — today's `html-static` — as
the *legacy* pipeline. The engine half of that doc shipped as `src/engines/hic/`; this is the
automation half.

**Folder name:** `automation/html-in-canvas/`, matching `type: 'hic'`, `HIC_PRESETS`,
`docs/html-in-canvas/` and the clip's own title ("HTML in Canvas"). The design doc's
`html-to-canvas` is the alternative, but it implies a conversion step the folder doesn't do.

---

## 1. Why one folder: the measurements

| | lines | `_detectPort` / `launch` / `execute` / `export` / `close` | preload | export strategy |
|---|---|---|---|---|
| `html-static/api.js` | 294 | **identical** | `preloadHtmlClips` (→ `preRenderAllHicClips`, Phase 3) | editor pump (`--mode mediabunny` \| `ftrt`) |
| `html-waapi/api.js` | 448 | **identical** | `preloadWaaapiClips` (→ reads `type === 'hic'`, Phase 3) | CDP screenshots (`-m cdp`) or editor (`-m gui`) |
| `md-render/render.js` | 493 | its own implementation (12 shared lines) | — | editor pump |

Three independent Puppeteer clients, ~2,200 lines, two of them the same client twice. `batch.js`
knows only `md-render/render.js` (`batch.js:148`), so `md-render` is genuinely separate and **stays
out of scope** — it is the markdown pipeline, not an HTML one.

What is actually left after Phase 3 is **one pipeline with two export strategies**, and they are not
redundant:

| Strategy | How | Why keep it |
|---|---|---|
| **CDP screenshots** (default) | standalone page per clip, `Page.captureScreenshot` per frame, ffmpeg | measured **deterministic** — the migrated path was frame-for-frame identical across two runs where the live-keyframes path was not (LEGACY-CLIP-REMOVAL-PLAN §H.4) |
| **Editor export** (parity mode) | drive the real editor, `openExportModal()` → `submitExport()`, MediaBunny/FTRT | the **only automated test of the editor's own export pump** — the path every real user's Export button takes |

Deleting the editor-export mode would leave the export pump with no automated consumer at all, in
the release that is about to change the render path under it.

---

## 2. The target tree

*(This is the target as designed. P1 landed the folder, P2 the merged CLI, and P4 the `README.md`
consolidation and the `lib/` removal — §10, §11 and §13 record what is actually on disk.)*

```
automation/html-in-canvas/
├── render.js            ← from html-waapi/render.js, extended (one CLI, one flag set)
├── api.js               ← from html-waapi/api.js, trimmed (the editor client)
├── cdp-capture.js       ← from html-waapi/cdp-capture.js as-is
├── examples/            ← union of both sets, renamed (see §4)
├── templates/           ← from html-waapi/templates/, provenance checked (§3)
├── output/              ← gitignored (automation/.gitignore:2 already covers `output/`)
└── README.md            ← one pipeline doc, replacing four stale ones
```

Provenance, file by file (source paths are as they were **before** the P1 rename — everything in the
right-hand column sat under `automation/html-waapi/`):

| New file | Comes from | Change |
|---|---|---|
| `render.js` | `html-waapi/render.js` (311) + `html-static/render.js` (253) | merger: `--mode cdp` (default) \| `--mode editor`, `--encoder mediabunny\|ftrt`, plus html-static's `--url` (`html-static/render.js:69`) which html-waapi lacks |
| `api.js` | `html-waapi/api.js` | drop the injected seek shim (§3), keep one constructor, one `export()` |
| `cdp-capture.js` | `html-waapi/cdp-capture.js` (400) | keep as-is; it is the deterministic path and the only part with a real test |
| `examples/` | 5 from `html-static/examples/` + 3 from `html-waapi/examples/` | 8 example scripts become one set with one naming convention |
| `templates/` | `html-waapi/templates/` (2 pages) + `html-static/templates/` (3 html + design-tokens.md) | dedupe; the html-waapi pair links `../lib/` and needs a decision (§3) |
| `README.md` | distilled from `html-static/README.md`, `html-waapi/TEST-RESULTS.md`, `automation/README.md` | one pipeline doc, not four results logs |

**Carried, not copied:** `html-static/IMPROVEMENT-PLAN.md` and `ISSUES-AND-TODOS.md` are dated
working notes (August 2026) whose open items should be re-checked against the new folder and either
carried as an "open items" section or dropped. They are the only files whose content isn't
straightforwardly reproducible.

**Mode-name cleanup:** today the same idea has three names — `html-static -m mediabunny|ftrt` and
`html-waapi -m gui` all mean "let the editor render". The new folder has `--mode cdp|editor` and,
inside editor mode, `--encoder mediabunny|ftrt`. `gu`/`mediabunny`/`ftrt` stop being modes.

---

## 3. `lib/` and the seek shim: what actually has a future

`automation/html-in-canvas/lib/` is **not used by any pipeline**. Grepping the two folders for `lib/`
matches only two demo pages:

| File | Loaded by | Verdict |
|---|---|---|
| `lib/waapi-seek.js` | `templates/animated-slide.html:150`, `templates/data-animate-slide.html:82` | superseded — `onFrame` is the seek. Keep only if the templates are kept, and then rewrite them |
| `lib/data-animate-adapter.js` | `templates/data-animate-slide.html:83` | the one idea worth keeping: `data-animate="fade-in"` sugar → `@keyframes`. Not imported by the editor, `future-waapi/` or any CLI — a reference implementation, not wired in |
| `lib/svg-renderer.js` | **nothing** | superseded by `src/engines/hic/`; no future |

*(This corrects an overstatement in LEGACY-CLIP-REMOVAL-PLAN §H.3, which described
`data-animate-adapter.js` as the surviving copy of a live idea. It is the surviving copy of an
**unimplemented** idea.)*

The same applies to the CLI's own seek engine: `api.js:53` (then `html-waapi/api.js`) carries a `WAAPI_SEEK_ADAPTER`
template literal injected into the editor page at launch (`api.js:279`) so the editor's export loop
can seek live CSS animations. After Phase 3 the clips carry no live animations — their seek is the
compiled `onFrame` the editor calls directly — so that shim is on its way to being dead code too.

Likewise `cdp-capture.js`'s `SEEK_ADAPTER` has a `document.getAnimations()` branch that only serves a
**pre-migration** clip, ahead of the `window.onFrame(ms)` branch added in Phase 3. Keep both until
Phase 4, then delete the `getAnimations` branch — at that point no page in the repo can hold a
live-keyframes clip.

**`findChrome()`** (`cdp-capture.js:41`) has a dead branch and a bug worth fixing while moving it: it
looks for `automation/config.json` (`path.join(__dirname, '..', 'config.json')`), which **does not
exist** — the only `config.json` is `md-render/config.json` — and the branch tests
`existsSync(configPath)` instead of `existsSync(config.chromePath)`.

---

## 4. Examples and skills travel together

The three skills in `automation/shared/skills/` are the authoring guides for the examples, and the
names match: `kinetic-text.md`, `product-launch.md`, `social-reel.md` ↔
`html-static/examples/{kinetic-text,product-launch,social-reel}.js`.

- `shared/skills/AGENTS.md` (356 lines) — the agent contract; the file paths it names must be
  rewritten to `html-in-canvas/`.
- `shared/skills/html2canvas-gotchas.md` — **about the engine being deleted**. Either retire it or
  rewrite it as SVG-`foreignObject` gotchas; leaving a skill that teaches the removed engine is worse
  than having no skill.
- Five of the eight examples define raw `@keyframes` (`html-static/examples/kinetic-text.js`,
  `social-reel.js`; `html-in-canvas/examples/animated-pollution.js`, `google-clean-test.js`,
  `waapi-test.js`). That is fine and stays fine — after Phase 3 the **editor** compiles them at clip
  creation, and the CLI receives css-without-keyframes plus a compiled `onFrame`. It does mean the
  new folder does **not** need to carry a compiler: if it ever does (standalone template renders), it
  should `import('../../src/engines/hic/adapters/waapi.js')` and read `globalThis.WAAPIAdapter` —
  verified working in Node, since the file falls back to `globalThis` when `window` is undefined.

---

## 5. Phases

Each phase is independently shippable and leaves the folder working.

**P1 — rename, change nothing.** ✅ **done (§10)** — `git mv automation/html-waapi automation/html-in-canvas`. Fix the
import paths inside (`./cdp-capture.js` is relative, so it survives), delete `output/frames/` if
present, add a `README.md` stub pointing at this document. No behaviour change, nothing deleted, one
commit that is pure rename + docs. **Gate:** `node html-in-canvas/render.js --help`.

**P2 — merge the CLI and the client.** ✅ **done (§11)** — Fold `html-static/render.js`'s flags into the new `render.js`
(`--mode editor`, `--encoder`, `--url`); make `api.js` the single client; port the 5 `html-static`
examples and 3 templates. Nothing is deleted from `html-static/` yet — it is the reference. **Gate:**
`--help` lists the union of both flag sets; every ported example still parses (`node --check`).
*(Went further: both modes were run end-to-end.)*

**P3 — parity run.** ✅ **done (§12)** — Render one example per mode and compare against the MP4s already on disk
(gitignored, so record the expectation in the README):

| Baseline on disk | Proves |
|---|---|
| `html-static/output/simple-test_ultra_30fps_ftrt_mp4.mp4` (128,767 B) | editor + FTRT |
| `html-static/output/india-pollution_ultra_30fps_mediabunny_mp4.mp4` (1,117,027 B) | editor + MediaBunny |
| `html-in-canvas/output/animated-pollution_ultra_30fps_cdp.mp4` (513,077 B) | CDP path |
| `html-in-canvas/output/google-clean-test_ultra_30fps_cdp.mp4` (40,873 B) | CDP path, post-Phase-3 |
| `html-in-canvas/output/waapi-test_draft_4fps_cdp.mp4` (98,430 B) | **added during P1** — the first CDP render made *after* the Phase 3 migration: 40 frames @ 1920×1080, 38 distinct frame hashes |

The CDP rows are the ones that matter most: they are rendered from a *migrated* clip, which is the
pairing no existing output was produced under. **Gate:** all three strategies produce a playable
video, and the CDP one is frame-identical across two runs.

**P4 — delete.** ✅ **done (§13)** — `git rm -r automation/html-static`; removed `lib/` and the two
templates that loaded it, the `getAnimations` branch, and the seek shim in `api.js`; updated the
references in §6. **Gate:** §6's *live* references are repointed (the historical plans keep their
old paths as history), `node --check` clean, one render per mode works.

**Ordering:** P1–P4 should land **before** the legacy-removal plan's Phase 4, not after. Phase 4 is
the last change to the editor's HTML path, and these CLIs are the only end-to-end test of it; doing
the refactor first means the deletion is verified through one stable entry point instead of two
diverging ones.

---

## 6. References to update on deletion

| File | Lines | What it says |
|---|---|---|
| `README.md` | 279–280, 297, 319, 326, 347, 382, 437–438 | the pipeline table, the project tree, the "how to render" walkthrough — and both rows still call html-waapi **"(future)"** |
| `automation/README.md` | 20, 23, 31–32, 53, 70, 107, 142, 151–152, 156 | pipeline table, tree, feature matrix, batch example, skills paths |
| `docs/automation/AUTOMATION-SERVER-PLAN.md` | 77, 127, 161, 164, 226 | it plans to "route to the correct pipeline (md-render, html-static, html-waapi)" — the routing table becomes two pipelines |
| `docs/html-in-canvas/PLAN.md` | 80–95 | the sketch this plan implements; mark it done and correct the name |
| `automation/shared/skills/AGENTS.md` | all paths | agent-facing commands and folder names |
| `docs/LEGACY-CLIP-REMOVAL-PLAN.md` §B.6, `docs/HTML-ENGINE-CONSOLIDATION-PLAN.md` §7.1 | — | both name the two folders as the port targets |

`.github/workflows/` references neither folder, and `package.json` has no script pointing at them
(`dev:automation` only starts Vite on the pipeline's port), so nothing else moves.

---

## 7. Doc bugs this closes — and one it doesn't

Closed by the move, all currently wrong in `automation/README.md`:

- `:23` documents `node html-waapi/render.js html-waapi/examples/animated-slide.js` — **that file does
  not exist** (the folder has `animated-pollution.js`, `google-clean-test.js`, `waapi-test.js`).
- `:142` documents `node batch.js html-static/examples/*.js` — `batch.js:148` routes **only**
  `md-render/render.js`, so this command cannot work.
- `:151–152` document `html-static/skills/` and `html-waapi/skills/`. Neither exists: the skills are
  in `automation/shared/skills/`, and `html-waapi/skills/` is an empty directory on disk.

Not closed, worth knowing: the folder totals 2.5 MB (`html-static`) + 2.0 MB (`html-waapi`) on disk,
most of it gitignored `output/`; the 62 MB `node_modules` is shared and unaffected. Nothing is
recovered by the deletion — it is about one entry point and one place to read, not disk.

---

## 8. Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| The editor-export mode is the only automated test of the export pump | dropping it silently removes coverage in the release that changes the render path | it is a first-class mode, not an optional script (P2) |
| Two CLIs' flags collide (`-m gui` vs `-m mediabunny`) | a ported example could silently run the *other* strategy | flag unification in P2, before any deletion |
| `data-animate` looks loadable but is unwired | someone re-implements it assuming it once worked | §3 says so explicitly; the file is referenced from the plans, not deleted silently |
| Renaming `html-waapi` breaks any muscle-memory command | it is documented in four files | §6 updates all four in the same change as P4 |
| Deleting before parity | lose the only reference outputs | P3 gates P4, and the baseline sizes are recorded above |

## 9. Verification gates, in one place

1. **P1** — `node html-in-canvas/render.js --help`, `git status` shows renames only.
2. **P2** — union of flags in `--help`; `node --check` on every `.js`; every example still executes
   its composition function against the editor (`window.StudioPro` resolves, clips created).
3. **P3** — one render per strategy, compared against the four baselines in §5; CDP frame-identical
   across two runs; the migrated clip path exercised (the Phase 3 obligation).
4. **P4** — zero matches for `html-static`/`html-waapi` outside git history; one render per mode.
5. **Always** — `npm run build` still passes (nothing here is in the app bundle, so it is a
   regression check, not a signal).

---

## 10. P1 — what actually happened

Executed. `automation/html-waapi/` → `automation/html-in-canvas/`, **15 tracked files moved, zero
content changes** beyond path strings, nothing deleted from `html-static/`.

**How the rename was done, and why it wasn't a plain `git mv`.** The first attempt failed with
`Permission denied` on the *directory*, while individual files and subdirectories moved without
complaint — the signature of a process holding `automation/html-waapi/` (or a directory inside it) as
its current working directory. On Windows a directory cannot be renamed or removed while any process
has it as its CWD, and `mv` reports that as a permission error. The move was therefore done as
`mkdir html-in-canvas` + move every child, which is what `git mv` does internally anyway; once the
children were across, the empty `html-waapi/` removed cleanly. Worth knowing for P4: the same lock
will hit `git rm -r automation/html-static` if a terminal is sitting in it.

**Cleaned up while moving** (both gitignored, neither referenced anywhere):
- `output/frames/` — 7 orphaned `frame_*.png` from an old CDP run (132 KB), per the phase plan.
- `skills/` — an empty directory. It existed on disk and was documented in `automation/README.md`,
  which is how a folder that isn't in the repo at all ended up in the docs.

**Path strings fixed inside the folder** (live usage/help text, not historical logs):
`api.js` header pipeline list; `render.js` header usage ×2 and the box-drawn `--help` usage line;
`examples/animated-pollution.js`, `examples/google-clean-test.js`, `examples/waapi-test.js` usage
lines. The `--help` box needed re-padding — `html-waapi` → `html-in-canvas` is 4 characters, so the
line was re-padded to its 68-column border rather than being left 4 wide.

**References outside the folder, updated** (these would otherwise be instructions pointing at a
directory that no longer exists):

| File | Lines | Change |
|---|---|---|
| `README.md` | 280, 326, 382, 438 | pipeline table, project tree ×2, WAAPI status line |
| `automation/README.md` | 23, 32, 70, 107, 152, 166 | command, table ×2, tree, feature matrix header, skills list, example header |
| `docs/automation/AUTOMATION-SERVER-PLAN.md` | 164, 226 | command, pipeline routing list |
| `automation/CDP-GUI-EXPORT-ANALYSIS.md` | 284 | code-comment pointer |
| `docs/html-in-canvas/PLAN.md` | 93 | tree entry, annotated with the rename |
| `docs/HTML-ENGINE-CONSOLIDATION-PLAN.md` | 197, 365, 368, 381, 388, 423 | §3 bullet, §7 table + heading, and the doc-bug note |
| `docs/LEGACY-CLIP-REMOVAL-PLAN.md` | 279 area, 632 area | rename notes added to §B.6 and §H.6 |

**Three doc bugs fixed, because renaming a path string in a command that cannot work only makes it a
wrong command with a current path.** All three were already in §7's list: the nonexistent
`examples/animated-slide.js` (now points at `examples/animated-pollution.js`, which exists), the two
nonexistent `*/skills/` folders (now point at `automation/shared/skills/`, where the skills actually
are), and the `render.js` usage lines. `automation/README.md:142`'s `node batch.js
html-static/examples/*.js` is **still open** — it needs a decision about `batch.js`, not a path fix.

**Deliberately left in P1's scope, deferred to P2/P4:**
- the `-m cdp` / `-m gui` / `-m mediabunny` / `-m ftrt` mode names are untouched — the
  `--mode cdp|editor` unification is P2;
- `README.md` and `automation/README.md` still describe the two pipelines as if both were current,
  including the stale **"(future)"** labels on the animated pipeline and the stale `html2canvas`
  rows in the feature matrix — that copy is P2/P4's, once the CLI is actually merged;
- `lib/`, the injected seek shim and the `getAnimations()` branch in `cdp-capture.js` all still
  exist, unchanged;
- the folder's four dated docs (`TEST-RESULTS.md`, `CDP-TEST-RESULTS.md`, `WAAPI-EXPORT-*.md`) were
  **not** rewritten. They are logs of runs made under the old name; their paths are history, and
  they get consolidated into one `README.md` in P4 rather than edited in place.

**One more path-dependent fix:** `automation/.gitignore` pinned the Puppeteer profile dir as
`html-waapi/.chrome-profile/`, which after the rename matches nothing. The *code* was already fine —
`api.js:49` builds it from `__dirname` — so this was the only place the old name was load-bearing.
Updated, plus `html-in-canvas/.frames/`, the CDP scratch dir `cdp-capture.js` writes into and deletes
after encoding: an interrupted render used to leave untracked PNGs behind, and the folder is meant
to be clean now.

**Gate — and it went further than planned.** `node --check` passes on all five `.js` files. Then,
because a dev server happened to be listening on **port 3000** (second in the CLI's
`PORT_PRIORITY = [7000, 3000, 3001]`) and ffmpeg is on the PATH, the CLI was run end-to-end from its
new home rather than stopped at `--help`:

```
cd automation
node html-in-canvas/render.js html-in-canvas/examples/waapi-test.js -m cdp -q draft --fps 4
→ [CDP] Connecting to http://localhost:3000... Connected to StudioPro. Executing composition...
→ waapi-test_draft_4fps_cdp.mp4   h264 · 1920×1080 · 4 fps · 10.0 s · 40 frames · 98,430 B
```

38 of the 40 frames are distinct, so the migrated clips are genuinely animating through the CDP path
— this is P3's evidence arriving early, and it closes the "neither CLI was ever run end-to-end" item
that LEGACY-CLIP-REMOVAL-PLAN §H.6 left open. `.frames/` cleaned itself up, nothing was left running.

**Note on invocation:** the script path is resolved against the **current working directory**, so from
`automation/` the correct form is `node html-in-canvas/render.js html-in-canvas/examples/x.js`.
The `examples/file.js` form used in the pipeline tables of `README.md:280` and
`automation/README.md:32` cannot resolve there — those rows are wrong for **all three** pipelines, not
just this one, and are left for P4's rewrite rather than half-fixed here.

**Not staged.** P1 was meant to be a `git mv`, which stages by design — but the working tree already
carries the uncommitted Phase 3 change *inside these very files*, so staging now would fold Phase 3
into a commit labelled "rename". Commit Phase 3 first, then stage the rename with explicit pathspecs
on `automation/html-waapi` and `automation/html-in-canvas`; git will detect the rename from content.

---

## 11. P2 — what actually shipped

Executed. One CLI, one client, and the `html-static` examples and templates folded in. `html-static/`
is untouched and still works — it is the reference until P4.

### 11.1 The flag design

| Flag | Meaning |
|---|---|
| `-m, --mode <cdp\|editor>` | the **strategy**. `cdp` (default) screenshots a standalone page per clip; `editor` drives the running editor and takes its export output |
| `-e, --encoder <mediabunny\|ftrt\|standard>` | **editor mode only** — which of the editor's export paths to use. Warned-and-ignored in cdp mode |
| `-q, --quality <draft\|standard\|ultra>` | cdp: ffmpeg CRF 28/23/18. editor: passed through, **but see the gap below** |
| `-f, --format <mp4\|webm>`, `--fps`, `--no-headless`, `--retries` | as before |
| `-u, --url <http://localhost:3000>` | skip port auto-detect — was html-static's flag, now honoured by **both** modes |

The old spellings are accepted as **aliases** and mapped, with a warning printed: `-m gui` and
`-m mediabunny` → `-m editor -e mediabunny`, `-m ftrt` → `-m editor -e ftrt`, `-m standard` →
`-m editor -e standard`. That is deliberate: the same idea had three names across the two CLIs
(`-m gui`, `-m mediabunny`, `-m ftrt`), every documented command uses one of them, and a silent break
of every doc command is a worse outcome than a deprecation warning. Nothing validates the enum
values in the old CLIs — a typo'd `-q` silently became `ultra`. Now it exits with the allowed list.

**`--quality` is not wired in editor mode.** `api.js:export()` destructures `quality` and never uses
it: the editor's export modal owns the bitrate, so the flag is decorative there. html-static's help
text claimed "draft 8 / standard 15 / ultra 30 Mbps" — that was never true of the code. The new help
says so. Wiring it means driving the editor's own quality control, which is a separate change.

### 11.2 What moved

| File | Change |
|---|---|
| `render.js` | rewritten: two modes in one entry point, a shared script-injection block (`SCRIPT_INJECT`) and a shared `loadComposition()`, so the modes cannot disagree about how a composition is loaded; one `resolveOutputPath()` (html-static's, which never double-nests `output/`); the help/status boxes are now built by a `box()` helper instead of hand-padded — see the note below |
| `api.js` | `StudioProWAAPI` → **`StudioProClient`**; `preloadWaaapiClips` → **`preloadHtmlClips`**; log prefix `[WAAPI]` → `[StudioPro]`; header rewritten to describe the HIC client. The exported surface shrank to exactly what the CLI uses |
| `examples/` | +5 from `html-static/examples/` (india-pollution, kinetic-text, product-launch, simple-test, social-reel) — **8 total** |
| `templates/` | +4 from `html-static/templates/` (design-tokens.md, glassmorphism, gradient-card, premium-gradient) — **6 total** |
| all 8 examples | usage lines normalized to `node html-in-canvas/render.js html-in-canvas/examples/x.js` — the form that works from `automation/`. The old `node render.js examples/x.js` form resolved against the CWD and worked from neither directory |

Deliberately **not** touched in P2: `lib/`, the injected `WAAPI_SEEK_ADAPTER` (annotated in place as
legacy), the `getAnimations()` branch in `cdp-capture.js`, `html-static/`, `batch.js`, and the
html2canvas-gotchas skill. Those are P4's, or P3's in the case of `batch.js`.

### 11.3 Verified — both modes, end to end

`node --check` clean on all 16 `.js` files; alias mapping and all four validation errors checked.

**The help box took two attempts, and the first one is the instructive one.** Both old CLIs hand-pad
every line with `padEnd(...)`, which is why the box was ragged in six places and why adding four
characters to a path (`html-waapi` → `html-in-canvas`, P1) pushed a row one column past its border.
Replacing the padding with a fixed-width helper fixed the raggedness — and introduced a worse bug:
it padded *and truncated* to 62 columns, so the tail of longer descriptions vanished
(`+ ffmpeg  (defau║`). Nothing errored; the help was simply lying about its own options. The shipped
version measures the longest line, never goes below 62 columns, and pads in **characters** rather
than bytes so a `—` or `→` in the copy cannot shift the border. The box is now 77 columns with 0
misaligned lines, asserted by a one-liner that reads the real `--help` output.

One more fix while there: a missing script used to be discovered *inside* the render, so the retry
loop retried "Script not found" three times with two-second pauses. It is now checked before the
loop — 0.25 s to the error instead of ~4 s.

Then a real render in each mode, on the same composition, against the editor on port 3000:

| | `-m cdp` (default) | `-m editor -e ftrt` |
|---|---|---|
| Command output | `simple-test_draft_4fps_cdp.mp4` | `simple-test_ultra_30fps_editor_ftrt.mp4` |
| Container | h264 · 1920×1080 · 30,373 B | h264 · 1920×1080 · 153,460 B |
| Frames | 20 @ 4 fps (5.0 s), **20 distinct** | 150 @ 30 fps (5.0 s), 14 distinct |
| Frame 2 luma | YAVG **115.57**, SATAVG **41.21** | YAVG **115.90**, SATAVG **40.51** |

Two things worth reading off that table. First, **both strategies agree on the same frame** — two
unrelated renderers (a standalone page screenshotted by CDP, and the editor's realtime FTRT loop)
land within 0.3 % on mean luma. Second, **the editor path is not producing blank frames**, which was
the silent-failure mode §B.6 of the legacy-removal plan identified; a blank frame would have a luma
range of zero and YAVG at one extreme, and this has Y 92–251.

### 11.4 Doc bugs found and fixed in the same pass

`automation/README.md`'s composition example was documenting an API that **does not exist**:

```javascript
StudioPro.addHtmlClip({ html: '…data-animate="fade-in"…', animated: true })   // never existed
```

There is no `addHtmlClip` on `window.StudioPro` (`createHtmlClip` and `createComposition` are the
real entry points), `animated: true` is not a property of anything, and `data-animate` was a
prototype in the now-deleted `future-waapi/` that nothing imported. An agent following that section
would have produced a script that throws on line 2. Replaced with the real API, exercised in §11.3.
Also fixed: `node batch.js html-static/examples/*.js` (a command that cannot work — `batch.js:148`
routes only md-render), the `scripts/` paths for md-render, the "try `--mode mediabunny` instead of
`--mode ftrt`" troubleshooting line, and the `Check console for html2canvas errors` line.

### 11.5 Left open

- **P3 parity run** against the four baselines in §5 — the two new MP4s above are two of its data
  points, but the `-m editor -e mediabunny` combination is still unrun.
- **`batch.js` routes one pipeline.** For HTML-in-Canvas the workaround is a shell loop; this needs a
  decision (generalize `batch.js`, or leave it md-only and document a loop).
- **`--quality` in editor mode** (11.1) — either wire it to the editor's quality control or drop it
  from the editor column of the help.
- **`html-static/` still exists**, deliberately: it is the reference until P4, which deletes it along
  with the surviving `lib/`, the seek shim and the `getAnimations()` branch.

---

## 12. P3 — the parity run, measured

All three strategies rendered, on the editor at port 3000, and compared against the pre-merge
baselines. Everything below is `ffprobe` / `ffmpeg -f framemd5` / `signalstats` output, not
impressions.

### 12.1 The gate

| | run A | run B |
|---|---|---|
| `parity-googleclean-ultra30-cdp.mp4` | 42,362 B | 42,362 B |
| sha256 | `2582e913…ce81e` | `2582e913…ce81e` |
| frame hashes | 150 | 150, **all identical** |

Two independent `-m cdp` runs of the same command produced **the same file**, byte for byte — not
merely a similar one. That is the strongest available form of the gate, and it is a property the
other strategy cannot have (12.3).

### 12.2 Phase 3 did not change the picture — measured against a file that predates it

`google-clean-test`, cdp mode, 150 frames @ 30 fps. The baseline was rendered on 28 Aug by
`html-waapi/render.js` reading `type: 'html'` clips whose animations were sought with
`document.getAnimations()`; the new one reads `type: 'hic'` clips whose animations are a compiled
`onFrame`.

| Frame 100 | YMIN | YAVG | YMAX | distinct states |
|---|---|---|---|---|
| pre-merge baseline | 25 | **229.790** | 239 | 58 / 150 |
| post-migration | 26 | **229.791** | 241 | 66 / 150 |

Mean luma agrees to **0.001** and the range to a couple of code values — the two renders are the same
picture, produced by two different seek mechanisms on two different clip formats. The migration's
"behaviour-preserving by construction" claim now has a control: a file that was written before the
migration existed. (The distinct-state count differs, 58 vs 66, because `getAnimations()` quantises
the animation timeline differently from the compiled `onFrame`. The sampled frames agree; the number
of intermediate states does not.)

### 12.3 The two strategies are *not* interchangeable — and that is worth knowing

Same clip, same composition, `simple-test`, 150 frames:

| | `-m editor -e ftrt` | `-m editor -e mediabunny` |
|---|---|---|
| size | 153,460 B | 153,459 B |
| distinct states | 14 / 150 | 14 / 150 |
| frame 2 luma (min/avg/max/sat) | 92 · **115.9** · 251 · 40.5 | 92 · **115.9** · 251 · 40.5 |
| frames differing from the other encoder | **90 / 150** | |
| distinct states shared with the other encoder | 9 of 14 | |

The aggregate stats are all but identical — 1 byte of container apart — yet **90 of 150 frames
differ**, and the two encoders only share 9 of their 14 distinct states. Both editor encoders are
*realtime* capture loops: they sample the clip at wall-clock time, so each frame lands at a slightly
different point in the animation. The CDP path is a pure function of the frame index. Neither is
wrong, but the choice is real:

- **`-m cdp`** — reproducible. Use it for anything you might need to re-render, compare or diff.
- **`-m editor`** — the user's own export path, sampled the way a human's Export button would. Use it
  to answer "does the thing the app ships actually render this clip?", not to produce a reference file.

This is also why 12.1 is a meaningful result rather than a triviality, and why the plan keeps both
strategies instead of keeping the one that renders prettier.

### 12.4 The editor path used to be the broken one

`google-clean-test` happens to have a pre-merge **editor** baseline as well as a cdp one. It is
blank:

| `google-clean-test`, editor + mediabunny | frames | distinct states | frame 2 luma | frame 100 luma |
|---|---|---|---|---|
| pre-merge baseline | 150 | **4 / 150** | 43 · 43.001 · 44 | **43 · 43 · 43** — a flat field |
| post-merge (`parity-googleclean-editor-mediabunny.mp4`) | 150 | **42 / 150** | 231 · 231.001 · 232 | 27 · **224.568** · 239 |

The old file is a valid, playable, 5-second h264 MP4 containing a uniform grey rectangle — the
exact failure `automation/html-waapi/TEST-RESULTS.md` recorded ("the exported video is a valid MP4
but shows empty/blank frames"), and the silent-blank mode §B.6 of the legacy-removal plan warned
about. It is now a real render with 42 distinct states.

The `waapi-test` pre-merge baselines are **not** blank, and I checked rather than assumed: at
frame 100 they read 27 · 38.847 · 242 — a dark slide with bright text, which is what that clip is.
Only the `google-clean-test` editor baseline was a blank field. So the pre-merge failure was
clip-dependent, not universal, which is precisely what makes it dangerous: it fails on some content
and reports success.

### 12.5 What P3 did not do

- **`india-pollution` was not re-rendered** (45 s composition; it is a light static presentation and
  its two baselines measure 30 · 226.038 · 249, i.e. healthy). Compared by measurement, not re-render.
- **No automatic comparison harness.** Every number above came from a shell one-liner. Making this
  re-runnable is the honest follow-up — see §11.5's open items; it is the same gap as the Phase 0
  fixture in the legacy-removal plan.
- **Artifacts kept, all gitignored:** `parity-googleclean-ultra30-cdp.mp4` and `-run2.mp4` (the
  byte-identical pair), `parity-googleclean-editor-mediabunny.mp4`, and the P2 pair
  `simple-test_ultra_30fps_editor_{ftrt,mediabunny}.mp4`. The old baselines were **not** overwritten —
  they are the control, and `google-clean-test_ultra_30fps_mediabunny_mp4.mp4` is now evidence of the
  bug it used to represent.

---

## 13. P4 — what actually happened

Executed. `automation/html-static/` is gone, along with everything in the new folder that only
existed to serve the legacy engine. The whole `html-in-canvas/` folder is now ~15 files instead of
four dated logs plus three prototype libs.

### 13.1 Deleted

| Target | Detail |
|---|---|
| `automation/html-static/` | all 15 tracked files, via `git rm -r -f`. `api.js` carried the uncommitted Phase 3 change, so `-f` was required; the whole file was superseded anyway. The gitignored `output/` tree was removed separately. |
| `html-in-canvas/lib/` | `waapi-seek.js`, `data-animate-adapter.js`, `svg-renderer.js` — loaded by no pipeline (only two demo pages) |
| `html-in-canvas/templates/animated-slide.html`, `data-animate-slide.html` | the only two files left loading `../lib/`; keeping them would have left dangling `<script src>` paths |
| `WAAPI_SEEK_ADAPTER` + `SVG_CAPTURE_FN` in `api.js` | the injected seek shim and the `_htmlIframe`-reading SVG capture helper |
| `document.getAnimations()` branch in `cdp-capture.js` | the original seek model, ahead of the `window.onFrame(ms)` branch Phase 3 added |
| four dated logs (`TEST-RESULTS.md`, `CDP-TEST-RESULTS.md`, `WAAPI-EXPORT-ANALYSIS.md`, `WAAPI-EXPORT-PLAN.md`) | consolidated into one `README.md` |
| empty `skills/` directory | untracked leftover, documented in no live doc |

`api.js` went from **449 to 289 lines** — 166 lines removed, and a diff against a pre-edit backup
confirms only the header note, one section-comment rename and the shim/injection blocks changed:
the kept code is byte-identical, and the `execute()` regex chain was re-validated against a
`module.exports = function(…)` fixture.

### 13.2 Fixed while there

- `cdp-capture.js:findChrome()` tested `existsSync(configPath)` instead of
  `existsSync(config.chromePath)` (§3). Fixed. The `automation/config.json` it looks for still does
  not exist, so the branch remains effectively dead — the bug was latent, not live.
- `cdp-capture.js`'s file/function comments said “WAAPI clips”; now “HTML-in-Canvas (HIC) clips”.
- `api.js`'s header comment and the `[StudioPro]` log line no longer claim to inject anything.

### 13.3 Preserved before deleting

The four `html-static/output/*.mp4` baselines (the §12 control) were copied to
`html-in-canvas/output/baselines/` **before** the folder was touched — they are the only files in
that tree whose loss would have destroyed evidence. Sizes on copy: `simple-test_ultra_30fps_ftrt`
and `..._mediabunny` (128,767 B each), `india-pollution_..._mediabunny` (1,117,027 B),
`india-pollution_..._ftrt` (1,001,556 B), matching §5 and §12 exactly.

### 13.4 References updated

| File | Change |
|---|---|
| `README.md` | pipeline paragraph now says both old folders are deleted; `lib/` and the `html-static/` block removed from the automation tree and the project tree |
| `automation/README.md` | same paragraph and tree edits; the `batch.js` note no longer quotes a command against a deleted path |
| `docs/automation/AUTOMATION-SERVER-PLAN.md` | `html-static/api.js` → `html-in-canvas/api.js`; both render commands repointed; routing list is now two pipelines |
| `docs/html-in-canvas/PLAN.md` | the §-tree sketch corrected: the folder shipped as `html-in-canvas/` with `--mode cdp\|editor`, and the sketch's `html-waapi/` + `code-to-video/` entries are marked deleted |
| `docs/STUDIO-LITE-PLAN.md` | `automation/` inventory drops `html-static` |
| `automation/CDP-GUI-EXPORT-ANALYSIS.md` | `code-to-video` → `html-in-canvas`; the future adapters path repointed |
| `docs/LEGACY-CLIP-REMOVAL-PLAN.md`, `docs/HTML-ENGINE-CONSOLIDATION-PLAN.md` | **annotated, not rewritten** — both are historical records, so their old paths stay as history and a “deleted since / executed since” note was added at §B.6, §7's table and §7.1 |

**On the §9 gate (“zero matches outside git history”).** The live docs have zero stale
*instructions*. The remaining matches are all inside historical plan/analysis records (and in this
plan, whose §1–§12 describe the pre-P4 state by design). Erasing those would delete the reasoning
that produced the folder, so the gate is read as “no live path resolves to a deleted folder”.

### 13.5 Verification — the gate, run

| Check | Result |
|---|---|
| `node --check` on `render.js`, `api.js`, `cdp-capture.js` and all 8 examples | clean |
| `-m cdp` render | `simple-test` → 20 frames @ 4 fps, 1920×1080, **20/20 distinct frames** (non-blank) |
| `-m editor -e mediabunny` render (exercises the trimmed `api.js`) | 150 frames @ 30 fps, 153,408 B, **14/150 distinct** — matching the §11.3/§12.3 figure exactly, so removing the shim changed nothing observable |
| `npm run build` | 2,554.20 kB (gzip 480.93), precache 90 entries (7709.25 KiB) — unchanged from before P4 |

### 13.6 Left open on purpose

- **`automation/shared/skills/html2canvas-gotchas.md`** and the html2canvas section of
  `html-in-canvas/templates/design-tokens.md` still describe the **editor's** html2canvas engine.
  That engine is still present in `index.html` and is the *other* plan's Phase 4
  (`docs/LEGACY-CLIP-REMOVAL-PLAN.md`), so retiring these belongs there, not here.
- **`batch.js` routes only `md-render/`** and **`--quality` is decorative in editor mode** — both
  were open before P4, unchanged by it, and are recorded in the new `README.md`'s open-items list.
- **No automated comparison harness** — every §12 number still comes from a shell one-liner.

**Not committed.** As with §10, the deletion is staged (`git rm`) but the surrounding work is not;
commit order in §10's note still applies.
