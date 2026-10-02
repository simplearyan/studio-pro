# Legacy clip authoring: removal plan + `future-waapi/` verdict

**Status:** **Part A and Phases 1–2 executed** — see §A.4, §E, §F and the §G audit. Phases 0, 3 and 4 are still plan-only.
**Companion to:** [HTML-ENGINE-CONSOLIDATION-PLAN.md](HTML-ENGINE-CONSOLIDATION-PLAN.md) — that
plan did Phases 1–2 (the WAAPI compiler); this one is the *execution* detail for its Phase 3–4
plus a direct answer on `future-waapi/`.
**Scope:** the two header buttons (`#btnAddHtml`, `#btnAddWaaapi`), the legacy `type: 'html'`
clip path they exist to feed, and the `future-waapi/` research folder.

---

## 0. The short answer

- **`future-waapi/` is not important.** Nothing in the app imports it. Two of its three libs are
  already superseded by code we ship; one idea (`data-animate`) is worth lifting. **Salvage that
  one file, then delete the folder.**
- **The two header buttons are safe to remove — but the HTML one is not quite a pure UI delete.**
  A `type: 'html'` clip is a *real clip type that existing projects contain*. We can remove the
  button today; we can only remove the engine behind it after a load-time migration exists. The
  phases below are ordered so that **nothing a user can load today stops working at any step.**

---

## Part A — `future-waapi/`: verdict and what to do with it

### A.1 Is it needed? No.

Evidence, from the tree rather than assumption:

- `grep -rl "future-waapi"` across the repo returns exactly three files: its own
  `docs/IMPLEMENTATION-GUIDE.md`, `docs/HTML-ENGINE-CONSOLIDATION-PLAN.md`, and `README.md`.
  **Zero** matches under `src/`, **zero** in `index.html`. Nothing imports it.
  *(Measured before the deletion in §A.4; the folder is now gone.)*
- It is tracked in git (all 9 files), 64 KB, and its README describes the app as
  html2canvas-only with WAAPI "unproven" — the opposite of the code as of the Phase 1–2 port.

### A.2 What is actually in it

| File | Status |
|---|---|
| `lib/svg-renderer.js` — "SVG foreignObject capture, replaces html2canvas (5–15 ms vs 500 ms)" | **Already shipped as HIC.** Superseded. |
| `lib/waapi-seek.js` — seek via `document.getAnimations()` | **Cannot drive HIC.** HIC renders into a detached `foreignObject` where CSS animations are never applied, so `getAnimations()` has nothing to seek. Superseded by `WAAPIAdapter.compileKeyframes` (`src/engines/hic/adapters/waapi.js`). |
| `lib/data-animate-adapter.js` — `<div data-animate="fade-in" data-delay=".2s">` → animation | **The one salvageable idea.** |
| `examples/*.html`, `docs/*.md` | Demo + prose for the above. Not referenced. |

### A.3 The salvage

`data-animate` is authoring sugar: it makes a clip cheap to *emit* for an AI agent or a human
hand. It fits the compiler we already have, with one adjustment:

- Its current implementation calls `el.animate(...)` (the WAAPI API) at runtime. That is the one
  thing that will not survive contact with HIC — the same reason `waapi-seek.js` is dead.
- **Lift it as a source-to-source pre-pass, not a runtime engine.** Add a function on the existing
  adapter that rewrites `data-animate` attributes into the *same* `@keyframes` + `animation:`
  declarations `compileKeyframes()` already consumes. Then `data-animate` is just a second syntax
  for the one animation pipeline, and there is still exactly one engine.

Suggested home: a new `expandDataAnimate(html, css)` on `WAAPIAdapter` in
[src/engines/hic/adapters/waapi.js](../src/engines/hic/adapters/waapi.js), called by
`registerPortedWaaapiPresets` (and later by the HIC editor's save path) *before* `compileKeyframes`.
The preset `data-animate` mappings (`fade-in`, `slide-up`, `grow-right`, …) become `@keyframes`
templates — a table, no logic.

Do **not** port `svg-renderer.js` or `waapi-seek.js`. Both would re-introduce a fourth engine.

### A.4 Disposition — **executed**

1. ~~Copy the animation table + attribute parsing out of `lib/data-animate-adapter.js` into the
   adapter as `expandDataAnimate`.~~ **Still open, but no longer blocked on the folder** — see §A.5.
2. ✅ `git rm -r future-waapi/` — done; git history preserves it, and an on-disk copy was
   redundant and actively misleading (its README contradicted the shipped code).
3. ✅ `docs/HTML-ENGINE-CONSOLIDATION-PLAN.md` §7.2 updated to record it.

Leaving the folder in place is the only option I would argue against: a future reader will find a
"next-generation animation system" that is neither next-generation nor wired in.

### A.5 Step 1 was not actually a prerequisite

The original ordering — lift the idea *before* deleting the folder — assumed the folder held the
only copy of the `data-animate` implementation. It did not. Every non-markdown file in it was a
byte-identical duplicate of one under `automation/html-waapi/`:

| `future-waapi/` | md5 | Byte-identical copy that stays |
|---|---|---|
| `lib/waapi-seek.js` | `611efcd5…` | `automation/html-waapi/lib/waapi-seek.js` |
| `lib/data-animate-adapter.js` | `aac3f916…` | `automation/html-waapi/lib/data-animate-adapter.js` |
| `lib/svg-renderer.js` | `221acf4f…` | `automation/html-waapi/lib/svg-renderer.js` |
| `examples/animated-slide.html` | `3f381948…` | `automation/html-waapi/templates/animated-slide.html` |
| `examples/data-animate-slide.html` | `c8b74565…` | `automation/html-waapi/templates/data-animate-slide.html` |

So the folder was a stale fork of a tree that is still in use — `automation/html-waapi/templates/*`
loads those libs through `../lib/`, and `api.js` / `render.js` / `cdp-capture.js` drive them. Only
the four markdown files existed nowhere else, and `docs/DATA-ANIMATE-PLAN.md` was the only one whose
subject is not superseded; its plan is summarised in §A.3 and the verdict itself is recorded in both
plan documents, so no load-bearing content was lost.

**Consequence for the `expandDataAnimate` work:** read the animation table out of
`automation/html-waapi/lib/data-animate-adapter.js` — that is now the only copy.

---

## Part B — Removing the header's HTML and WAAPI clip buttons

### B.1 What is actually in the header

Three adjacent buttons, `index.html:1317–1326`:

| Line | Button | Icon | Feeds |
|---|---|---|---|
| 1317 | `#btnAddHtml` → `addHtmlClipToTimeline()` | `code` | `type: 'html'` clip (html2canvas engine) |
| 1320 | `#btnAddWaaapi` → `addWaaapiClipToTimeline()` | `play-circle` (emerald) | **already delegates to HIC** |
| 1323 | `#btnAddHic` → `addHicClipToTimeline()` | `sparkles` (violet) | `type: 'hic'` clip — **keep this one** |

The WAAPI button is *already* vestigial: `addWaaapiClipToTimeline` (27152) is a two-line
delegation to `addHicClipToTimeline('waaapi_' + preset)`. Its only other purpose is
`loadWaaapiExample`. So the emerald button and the violet button create the *same kind of clip* —
which is most of why the two "don't work very well": users are told there are two systems, and
only one of them is the good one.

### B.2 Dependency map — what each removal actually touches

**`#btnAddHtml`** is the *only* caller of `addHtmlClipToTimeline` (27071). That function is the
sole creator of a `type: 'html'` clip. `type: 'html'` then flows into:

- the sidebar **HTML Content** card (`cardHtmlContent`, 15386 and 15618) and its nav item (15478);
- the **legacy HTML Code Editor modal** (`#htmlEditorModal`, markup 137–180, JS `openHtmlEditor`
  26841 / `closeHtmlEditor` 26872) — which *early-returns unless `clip.type === 'html'`*, so it is
  reachable only from that card;
- the `_applyWaaapiPreset` sidebar buttons (15405–15413);
- the html2canvas render path in `drawCanvas` (5818, 6877, 6909, 6921, 8233, 8321, 8334);
- `preRenderHtmlClip` (26948) and the two export-pump `_needsHtmlWait` hooks (37916, 38517);
- `preRenderAllHtmlClips` (27015).

**`#btnAddWaaapi`** is the *only* header caller of `addWaaapiClipToTimeline`. Its other caller is
`loadWaaapiExample` (27159), which is itself only reachable from the `waaapi_loadExample`
`_isAction` tile in the preset grid (2501–2503), which only shows under the `WAAPI` preset filter
(15875).

So removing the WAAPI button + its filter category also removes: the example loader, the
`waaapi_loadExample` tile, and `addWaaapiClipToTimeline` (after repointing the loader or deleting
it). `_applyWaaapiPreset` (26831) dies with the HTML card.

### B.3 The one real gap to close first — **closed by Phase 2 (§F)**

`addHtmlClipToTimeline` is today the **only way to start from a blank HTML clip**. Every HIC entry
point is preset-driven: `addHicClipToTimeline(presetKey)` falls back to `googleClean` when the key
is unknown (27287), so calling it with no argument gives Google Clean, not an empty canvas.

If we delete `#btnAddHtml` without addressing this, we remove the ability to author a clip from
scratch. **Before Phase 2**, add a `blank` HIC preset (empty html/css, `onFrame` no-op) and either
give `addHicClipToTimeline` a `'blank'` preset key or add a small "Blank" tile to the HTML-in-Canvas
category. That single addition makes `#btnAddHtml` genuinely redundant instead of merely hidden.

### B.4 Phasing — each step is independently shippable and non-breaking

> **Ordering rule:** UI entry points go first (reversible, no data effect); engine deletion goes
> last (irreversible, depends on the migration having shipped and been exercised).

#### Phase 0 — Safety gate (do this before touching code)

The gate is the **round-trip test**, and it is the definition of "without breaking anything":

> Load a pre-change `.spcomp` project containing **both** a `type: 'html'` clip and a
> `_isWaaapi: true` clip. It must render, animate, and export. Save it. Reload it. The second
> load must be byte-stable — same clip count, same types, no clip duplicated or silently
> converted twice.

Add this as a fixture/project under whatever the existing test harness is; if none exists, a
manual checklist is acceptable for Phase 1 but **not** for Phase 3+.

Also capture a **baseline** of today's behaviour for the export pumps: the notes in
`docs/html-in-canvas/EXPORT-TEST-RESULTS.md` and `EXPORT-SPEED-COMPARISON.md`. Phase 4 changes the
export path; without a baseline you cannot tell a regression from noise.

#### Phase 1 — Delete the WAAPI button (lowest risk, highest clarity)

1. Delete `#btnAddWaaapi` markup (1320–1322).
2. Delete the `waaapi` entry from the preset-category list (15868) and its filter branch (15875),
   and collapse `presetMeta`'s WAAPI branch (15888) into the HIC branch. The ported presets stay
   visible under **HTML in Canvas** — they are HIC clips, and the grid already shows them there.
3. Repoint or delete `loadWaaapiExample` (27159) and the `waaapi_loadExample` preset (2501):
   - *Option A (recommended):* re-key it as a HIC example loader (`addHicClipToTimeline`), retitle
     "Load Example", move it under the HIC category.
   - *Option B:* delete the tile, the loader, and `addWaaapiClipToTimeline` outright.
4. Delete `addWaaapiClipToTimeline` (27152) — **only if** Option B, and **only after** confirming
   no out-of-tree caller relies on it (search shows none; `automation/` does not call it).

**Why safe:** the button created nothing the HIC button cannot. Zero clip data changes.
**Verify:** the HTML-in-Canvas grid still lists all 19 presets; adding one produces `type: 'hic'`;
`_isWaaapi` still appears in no `DEFAULT_PRESETS` entry.

#### Phase 2 — Add the blank HIC entry point, then delete the HTML button

1. Add the `blank` HIC preset + entry point (§B.3). Verify it creates an empty editable HIC clip.
2. Delete `#btnAddHtml` markup (1317–1319).
3. Keep `addHtmlClipToTimeline` **in place, unreferenced** for now — old projects may still hold
   `type: 'html'` clips that Phase 3 will migrate, and the function is harmless dead weight for one
   release. (Do not delete it in the same commit as the button; separating them keeps the diff
   revertible.)

**Why safe:** no new `type: 'html'` clip can be created; existing ones are untouched and still
render on the exact path they render on today.
**Verify:** a project saved before this phase still opens, renders its HTML clip, and exports it.

#### Phase 3 — Load-time migration (`type: 'html'` → `type: 'hic'`)

This is the step that makes Phase 4 possible, and the step the round-trip gate exists for.

```
on project load / .spcomp import, for each clip where type === 'html':
    js = WAAPIAdapter.hasKeyframes(clip.css)
           ? WAAPIAdapter.wrapWithWAAPI(clip.js || '')
           : (clip.js || '')
    clip.html = WAAPIAdapter.expandDataAnimate(clip.html)   // if Part A shipped
    clip.type = 'hic'
    clip.js   = js
    clip.presetId = clip.presetId || null
    delete clip._isWaaapi
    delete clip._htmlIframe, _htmlCanvas, _htmlReady, _htmlNeedsRefresh, _htmlSig
    clip._migratedFrom = 'html'        // idempotency guard: never migrate twice
```

The mapping is behaviour-preserving by construction:

- a clip with `@keyframes` becomes an animated HIC clip carrying the identical CSS;
- a clip with its own `onFrame` keeps it;
- a clip with neither was already a *static* capture under html2canvas, and becomes a static HIC
  clip — the same picture.

This is the *eager* version of the in-place migration already implemented in `applyHicPreset`
(27330–27343); this phase runs it on load instead of on first edit.

**Same-release obligation:** the two automation CLIs preload clips through the API this phase
retires, so the port in §B.6 must ship *with* Phase 3 — a phase later is a broken release.
**Discharged — see §H.**

**Verify (the Phase 0 gate, now mandatory):** the fixture loads, renders, exports, and re-saves
identical; a clip with `_migratedFrom` set is not migrated again; no `type: 'html'` clip remains in
`State.clips` after load; **and one example from each `automation/` pipeline still renders** (§B.6).
**Executed as far as it could be — see §H.4 and §H.6.**

#### Phase 4 — Delete the dead engine

Only after Phase 3 has shipped and the fixture passes end-to-end:

- the html2canvas branch in `drawCanvas` (5818, 6877–6921) and the iframe-overlay path
  (8233, 8321–8334);
- `preRenderHtmlClip` (26948–27027) and, **only once `automation/html-static/api.js:263` has been
  repointed at `preRenderAllHicClips` (§B.6 — that port ships with Phase 3)**, `preRenderAllHtmlClips`
  (27015);
- the two `_needsHtmlWait` scans in the export pumps (37916, 38517);
- `addHtmlClipToTimeline` (27071) and `#htmlEditorModal` markup + JS (137–180, 26841–26947) and the
  two sidebar HTML cards (15386, 15618) + nav item (15478) + `_applyWaaapiPreset` buttons
  (15405–15413, 26831);
- the `_isWaaapi` flag and every site that reads it (5818, 6877, 6909, 6921, 8233, 8321, 8334,
  12824, 16129, 16137, 16219, 26950, 27015, 27335, 37916, 38517);
- `window.WAAPI_SEEK_ADAPTER` (the deferred Phase-2 shim) once no pre-migration project can load;
- the `<script src="…html2canvas.min.js">` tag and `src/html-clips/html2canvas.min.js`.

**Result:** one HTML engine; ~800 lines of inline render/UI code and the two legacy buttons gone;
198 KB off the initial load and the precache; no per-frame capture penalty in export.
**Verify:** re-run the export-speed comparison against the Phase 0 baseline; precache entry count
drops; the fixture still round-trips; and both `automation/` pipelines still produce a video (§B.6).

### B.5 What NOT to touch

- **`src/engines/hic/adapters/waapi.js`** — the live compiler. Do not delete it with the buttons;
  it is what the ported presets are compiled by.
- **`automation/md-render/`** — a standalone Node tool under the shared `automation/package.json`,
  importing nothing under `src/` and driving no editor global. Genuinely unaffected.
- **`docs/html-in-canvas/hic-*.js`** — the shared layer the live docs pages depend on.
- **`_archive/`** — a pre-existing backup folder; not part of this change.

*(`automation/html-static/` and `automation/html-waapi/` used to be listed here as unaffected. They
are not — see §B.6.)*

### B.6 Correction: the `html-static` / `html-waapi` CLIs are NOT independent of the editor

> **Renamed, then deleted since:** `automation/html-waapi/` is now **`automation/html-in-canvas/`**
> (P1 of [HTML-IN-CANVAS-PIPELINE-PLAN.md](automation/HTML-IN-CANVAS-PIPELINE-PLAN.md)), and
> `automation/html-static/` has since been **deleted** (P4 of the same plan). Paths in this section
> and in §A.5/§H are as they were when those findings were recorded — nothing about the finding
> changes, and the plan above supersedes the “port both” conclusion with “merge both, then delete”.

This section replaces an earlier claim in §B.5 that `automation/` is untouched by these phases,
based on `grep -rn "src/html-clips\|src/html-in-canvas\|src/engines" automation/` returning only
prose. **That test was the wrong test.** The dependency is on the editor's *runtime globals*, not on
its modules, so a module grep cannot find it.

Both folders share one `automation/package.json` and one `automation/node_modules` (62 MB) — neither
has its own, contrary to what an earlier draft of this document said.

`automation/html-static/api.js` is a Puppeteer client of the **running editor**. It refuses to start
unless it finds a Vite server (`api.js:96–120`), waits for `window.StudioPro` (`api.js:127`), and
then:

| What it calls | Where | Broken by |
|---|---|---|
| `window.preRenderAllHtmlClips()` | `api.js:263` | **Phase 4** deletes that function; the call sits inside a `typeof === 'function'` guard, so it fails **silently** |
| `StudioPro.createHtmlClip()` → `createClipBase('html')` | `index.html:10926` | **Phase 3** migrates `type: 'html'` away — `preRenderAllHtmlClips` filters `c.type === 'html'`, so it would find **zero** clips and report success over a blank export |
| `openExportModal()`, `exportSelectOption()`, `submitExport()`, `#exportProgressText`, `#ftrtFbOverlay`, `State.isExporting` | `api.js:171–236` | survives, but is a permanent coupling worth knowing about |

The editor's side of that contract is deliberate and large: `window.StudioPro` is **460 lines**
(`index.html:10872–11331` — `fonts`, `createHtmlClip`, `createComposition`, `project`, `text`,
`html`, `image`, `video`, `audio`, `shape`, `scene`), and the **root** `package.json` carries a
dedicated `"dev:automation": "vite --port 7000"` matching the `PORT_PRIORITY = [7000, 3000, 3001]`
in `api.js:42`. `automation/html-waapi/api.js:188` likewise reads `c._isWaaapi`, which Phase 4 deletes.

**Decision: keep the batch path and port it.** The port is a **Phase 3 obligation, not a Phase 4
tidy-up** — the moment Phase 3 rewrites clip types, the old preload finds nothing to preload, and the
failure is silent in the one code path nobody is watching.

> **The silent-blank risk below was real, and is now fixed and measured.** A pre-merge editor-mode
> baseline of `google-clean-test` (`automation/html-in-canvas/output/google-clean-test_ultra_30fps_
> mediabunny_mp4.mp4`) is a valid, playable 5-second MP4 containing **four distinct states of a flat
> grey field** — the failure this section predicted, shipped into an artifact nobody looked at. The
> merged pipeline renders the same clip with 42 distinct states. Evidence and method:
> [HTML-IN-CANVAS-PIPELINE-PLAN.md §12.4](automation/HTML-IN-CANVAS-PIPELINE-PLAN.md).

1. ✅ **done (§H)** — `html-static/api.js:263` — `preloadHtmlClips()` calls `window.preRenderAllHicClips()`.
2. ✅ **done (§H)** — `index.html` — `StudioPro.createHtmlClip()` builds `type: 'hic'` (it already took
   `html`, `css`, `js`; it also needed `presetId: null` and the `_hicSig` reset the HIC path relies on).
   The same normalisation now sits in `_createClipFromDef`, so `createComposition` + `html()` and the
   whole def-based API are covered too.
3. ✅ **done (§H)** — `html-waapi/api.js:188` — the `c._isWaaapi` filter becomes `c.type === 'hic'`.
4. ⬜ **planned** — consolidate the two CLIs, or at least share the preload: they are one pipeline with
   two strategies — 168 distinct lines of `html-static/api.js` (294) are byte-identical to
   `html-waapi/api.js` (448), including all of `_detectPort`/`launch`/`execute`/`export`/`close`, and
   the whole difference is which `preload*` runs. Keeping two copies after Phase 4 would re-create
   exactly the duplication the HTML-engine consolidation just removed.
   → **now has its own plan: [HTML-IN-CANVAS-PIPELINE-PLAN.md](automation/HTML-IN-CANVAS-PIPELINE-PLAN.md).**
   It resolves this by absorbing **both** folders into one `automation/html-in-canvas/` — and its
   P1–P4 are ordered **before** Phase 4 here, because these CLIs are the only end-to-end test of the
   editor's HTML path and Phase 4 is the last change to it.
5. 🟡 **partly done** — the standalone CDP seek path was run end-to-end in headless Chrome (§H.4); the
   full `render.js` run (which needs a dev server on port 7000/3000/3001 and ffmpeg) was not. That
   full run is now **P3** of [HTML-IN-CANVAS-PIPELINE-PLAN.md](automation/HTML-IN-CANVAS-PIPELINE-PLAN.md),
   against the four MP4 baselines already in `automation/*/output/`.

---

## C. Risk table

| Step | Blast radius | Reversible? | Gate |
|---|---|---|---|
| Phase 1 (WAAPI button) | UI + preset grid only; no clip data | yes — revert the commit | grid still lists 19 presets |
| Phase 2 (blank HIC + HTML button) | UI only; `addHtmlClipToTimeline` left dead | yes | pre-change project still renders |
| Phase 3 (load migration) | **project load path — touches user data** | yes (guard is `_migratedFrom`), but must be exercised | round-trip fixture **required** |
| Phase 4 (engine delete) | render + export paths; irreversible | no | Phase 3 shipped + baseline compared |
| Phase 3/4 × `automation/` | two batch CLIs, silently — their preloads go quiet before they error | yes, but a blank export looks like success | one example from each pipeline renders (§B.6) |

The only step that can lose user data is Phase 3, and it is idempotent-guarded and additive — it
reads old fields into new ones and deletes only transient `_html*` cache fields. Phase 4 deletes
code that Phase 3 has already proven unreachable.

---

## D. Recommended sequence

1. **Part A** (independent): lift `data-animate` into the adapter, `git rm -r future-waapi/`.
   **Half done** — the folder is deleted (§A.4–A.5); the `expandDataAnimate` pre-pass is still
   open, and its reference implementation now survives only in `automation/html-waapi/lib/`.
2. **Phase 0**: stand up the round-trip fixture; capture the export baseline. **Still open — and now
   it is the gate for two pipelines, not one (§B.6).**
3. ✅ **Phase 1**: delete the WAAPI button + filter, resolve the example loader (§E).
4. ✅ **Phase 2**: add blank-HIC, delete the HTML button (§F).
5. **Phase 3**: ship the load migration; run the fixture on real pre-change projects for one release.
   **Carries §B.6**: the two batch CLIs must be repointed in the same release or they go quiet.
6. **Phase 4**: delete the engine, the modal, the cards, the flag, and the shim.

Phases 1–2 were a single afternoon and shipped. Phases 3–4 are gated on the fixture, not on courage —
and since §B.6 they are also gated on the two `automation/` CLIs still rendering.

---

## E. Phase 1 — what actually shipped

The `waaapi` category was not just a filter: the seven ported presets carried
`category: 'WAAPI'`, and the `hic` filter *excluded* that category (`_isHic && category !== 'WAAPI'`).
So "keep them visible under HTML in Canvas" required editing the entries, not only the filter.

| # | Change | Where |
|---|---|---|
| 1 | `#btnAddWaaapi` markup deleted | header |
| 2 | `{ id: 'waaapi', … }` deleted from the category chip list | preset grid |
| 3 | `'waaapi'` filter branch deleted; `'hic'` simplified to `return p._isHic === true;` | preset grid |
| 4 | `presetMeta`'s WAAPI branch deleted (the `_isHic` branch below it now catches them) | preset grid |
| 5 | the 7 ported presets: `category: 'WAAPI'` → `category: 'HTML in Canvas'` | `DEFAULT_PRESETS` |
| 6 | `waaapi_loadExample` retitled `▶ Load Example`, recategorised, `action` → `loadHicExample` | `DEFAULT_PRESETS` |
| 7 | `loadWaaapiExample` → `loadHicExample`, calling `addHicClipToTimeline('waaapi_*')` directly | helpers |
| 8 | `addWaaapiClipToTimeline` deleted — step 4 of §B.4 made it an orphan | helpers |

Two deliberate deviations from §B.4, both recorded here rather than left implicit:

- **`addWaaapiClipToTimeline` is gone.** §B.4 said delete it "only if Option B", on the assumption
  that Option A would leave the loader calling it. Repointing the loader to `addHicClipToTimeline`
  removed its last caller, so keeping a dead `…Waaapi…` wrapper would have contradicted the point
  of the phase. A repo-wide search found no caller outside `index.html` (the `automation/` tools
  never touch editor globals).
- **`window.loadWaaapiExample` survives as a one-line alias** to `loadHicExample`, so a custom
  preset saved before this change still resolves its `action` string.

### Verified (dev server, `localhost:4345`)

- Category chips now read **All · Math · Text · Shapes · Media · Keyframes · HTML in Canvas** — no
  `WAAPI` chip.
- Under **HTML in Canvas**: **20 cards = 19 presets + the `▶ Load Example` action tile.**
- `addHicClipToTimeline` returns `type: 'hic'`, `_isWaaapi` absent, for every ported key
  (`waaapi_googleClean` 579 B css / 6,530 B compiled js, `waaapi_countUp`, `waaapi_voxChart`,
  `waaapi_staggerReveal`) and every HIC key.
- The `▶ Load Example` tile runs the loader: **exactly 4 clips at 0 / 5 / 10 / 15 s**, 250 px each,
  and logs `[HIC] Example loaded: 4 animated clips (20s)`. Zero console errors.
- `npm run build` passes; `dist/index.html` 2,548.11 → **2,547.21 kB** (gzip 477.95).

### Left open after Phase 1

- **Three names appear twice under HTML in Canvas** — *Google Clean*, *Gradient Hero*, *iOS Glass*
  exist as both an `hic_*` (hand-written `onFrame`) and a `waaapi_*` (compiled `@keyframes`)
  preset. That duplication predates this change (it was already visible under *All*), but the HIC
  filter is now the place you notice it. Either rename the ported pair or retire the three native
  tiles.
- **Phase 2's blank-clip gap is untouched** (§B.3): `addHicClipToTimeline()` with no key still
  falls back to `googleClean`, so `#btnAddHtml` is still the only route to an empty canvas. Do not
  delete that button before the `blank` preset exists. **Closed by Phase 2 — see §F.**
- Under the **HTML in Canvas** filter the seven ported (`waaapi_*`) tiles are declared before the
  native `hic_*` ones, so the category reads as *Blank, 7 ported, Load Example, 12 native*. Grouping
  the ported tiles with the native ones is a pure array reorder, deliberately not bundled with the
  phases above.

---

## F. Phase 2 — what actually shipped

§B.3 framed the choice as "give `addHicClipToTimeline` a `'blank'` preset key **or** add a tile".
Both were done, because the two entry points answer different questions — the header button is the
one-click replacement for the deleted `#btnAddHtml`, and the tile is what makes a blank clip
*discoverable* to someone browsing the preset library. There is exactly one preset behind them.

| # | Change | Where |
|---|---|---|
| 1 | `HIC_PRESETS.blank = { name: 'Blank', dur: 5, html: '', css: '', js: '' }` | `HIC_PRESETS` |
| 2 | `addHicClipToTimeline()` no longer falls back to Google Clean: no key → `blank`, an unknown key → `googleClean` as before | `addHicClipToTimeline` |
| 3 | `#btnAddHic` retitled `Add Blank HTML-in-Canvas Clip` (it now adds a blank clip) | header |
| 4 | `hic_blank` grid tile, declared before every other preset so it is the **first** tile under HTML in Canvas | `DEFAULT_PRESETS` |
| 5 | `#btnAddHtml` markup deleted | header |
| 6 | `addHtmlClipToTimeline` **kept**, now unreferenced | helpers |

Two decisions worth naming:

- **The header button changes behaviour.** It used to add Google Clean; it now adds a blank clip.
  That is what §B.3 asked for ("give `addHicClipToTimeline` a `'blank'` preset key") and it is the
  only shape that actually replaces the removed header affordance, but it does mean the fastest
  route to a *preset* is now the grid. The fallback for an **unknown** key is unchanged, so nothing
  that passes a key can regress.
- **The blank preset is genuinely empty**, per §B.3. A freshly added blank clip draws nothing on the
  canvas — it is a transparent clip whose only on-screen presence is its timeline bar and its
  sidebar card. That is the honest state of "empty", and the card is one click from the code editor,
  but it is the one place a user could reasonably read an empty canvas as a bug.

### Verified (dev server, `localhost:4345`)

- No `#btnAddHtml` in the DOM; `#btnAddHic` present, `title="Add Blank HTML-in-Canvas Clip"`.
- `addHicClipToTimeline()` → `{ title: 'Blank', type: 'hic', duration: 5 }` with `html`, `css` and
  `js` all the empty string. `addHicClipToTimeline('googleClean')` still yields Google Clean (292 B
  html), and an unknown key still falls back to Google Clean.
- The grid under HTML in Canvas is **21 cards = 20 presets + the `▶ Load Example` action tile**,
  in the order *Blank, Google Clean, Brutal Shadow, iOS Glass, Vox Chart, Count Up, Gradient Hero,
  Stagger Reveal, ▶ Load Example, …12 native…*.
- **A blank clip is authorable end to end:** the sidebar renders `#cardHicContent` with its three
  textareas plus the *Open Code Editor* button; typing `<h1 class="t">Hello</h1>` into the HTML
  field writes it onto the clip, and `openHicEditor(clip.id)` then opens on that same clip with the
  typed markup in `#hicEditorHTML`.
- `npm run build` passes, 90 precache entries, zero console errors, no failed requests.

### What Phase 2 deliberately did not do

- **`addHtmlClipToTimeline` is still defined.** Old projects hold `type: 'html'` clips and Phase 3
  is what migrates them; the function stays dead weight until Phase 4.
- **The legacy HTML code editor, the sidebar HTML cards and the html2canvas path are untouched.**
  They are now reachable only from a clip that already exists, which is exactly the Phase 3 problem.

---

## G. Status audit — verified against the tree, not this document

When someone asks "are the phases done?", the answer has to come from the code, not from a plan that
describes the work. This is that check: **search for the artifact each phase must leave behind.** A
shipped phase leaves traces; an unshipped one leaves the old code standing.

| Phase | Artifact it must leave | Found? | Evidence |
|---|---|---|---|
| Part A | `future-waapi/` gone | ✅ | folder absent on disk; removed in `a36f427` |
| Phase 1 | no `#btnAddWaaapi`, no `waaapi` chip | ✅ | `btnAddWaaapi` has **zero** matches in `index.html`; chip list ends at HTML in Canvas |
| Phase 2 | `#btnAddHtml` gone, blank entry point present | ✅ | 21 grid cards with *Blank* first; `#btnAddHic` titled *Add Blank HTML-in-Canvas Clip* |
| **Phase 0** | round-trip fixture + export baseline | ⚠️ | the round trip was **executed**, but ad hoc in the browser — no committed fixture file, no recorded export baseline (§H.6) |
| **Phase 3** | load-time migration | ✅ | `migrateLegacyHtmlClips` at `index.html:27332`, called from `applyProject` at `33920` — see §H *(was ❌ at the time of this audit)* |
| **Phase 4** | the legacy engine gone | ✅ | html2canvas path retired 2026-10-02 — see §G.1 |

Three commits exist on `main` (`4808621`, `00e64c4`, `a36f427`) and they cover Part A, Phase 1 and
Phase 2. Phase 3 is implemented and verified but **uncommitted** (§H). Phase 4's html2canvas
retirement has since been **executed** (2026-10-02); the dead-but-inert UI it also names
(`#htmlEditorModal`, the sidebar HTML cards, `_isWaaapi` read sites) is left for a follow-up. Phase 0
was run without being written down as a fixture.

### G.1 Phase 4 targets — the html2canvas half is now retired

> **Executed 2026-10-02.** The html2canvas library and `<script>` tag, the `type: 'html'` render
> branch, `preRenderHtmlClip` / `preRenderAllHtmlClips`, `addHtmlClipToTimeline`, `__waapiSeekFrame`,
> `WAAPI_SEEK_ADAPTER` (and its two consumers), and the two `_needsHtmlWait` export waits are all
> deleted; `src/html-clips/` is gone. `migrateLegacyHtmlClips` + `htmlToHicCode` are kept. The table
> below is the pre-execution audit, kept for provenance: its *Where it still is* column describes the
> state **before** the change. Still inert-but-present: `#htmlEditorModal`, the sidebar HTML cards,
> and the `_isWaaapi` read sites (all unreachable now that no clip can be `type: 'html'` or
> `_isWaaapi`).

| Target | Where it still is |
|---|---|
| `html2canvas.min.js` | `src/html-clips/html2canvas.min.js`, **198,689 bytes**, still loaded at `index.html:113` |
| html2canvas render branch | `index.html:6874–7070` |
| iframe overlay path | `8232`, `8320`, `8333` |
| `window.WAAPI_SEEK_ADAPTER` | `index.html:123` |
| `#htmlEditorModal` | markup `136`; JS `26841`, `26869` |
| `window.preRenderHtmlClip` | `26944` |
| `window.preRenderAllHtmlClips` | `27010` — and still called by the editor itself at `33854` |
| `window.addHtmlClipToTimeline` | `27067` |
| `_isWaaapi` | live read sites at `5817`, `6876`, `6908`, `6920`, `8232`, `8320`, `8333`, `12823`, `16125`, `16133`, `16215`, `26946` |

*Updated after Phase 3 (§H):* every target in §G.1 is still standing, so **Phase 4 is still fully
intact as a body of work** — but `type: 'html'` is no longer a clip type the app can *create* or
*load*. The remaining legacy code is now reached by nothing; that is precisely what makes Phase 4 a
pure deletion instead of a migration.

### G.2 What this means for `automation/`

`automation/html-static` is the **only automated consumer of the path Phases 3 and 4 change** — the
closest thing this repo has to an end-to-end test of it. That is an argument for repointing it
during Phase 3 (done — §H.1), not for deleting it now.

---

## H. Phase 3 — what actually shipped

Executed this turn, **uncommitted**. Five files: `index.html` (+123/−21 — the migration and the
creation path), `automation/html-static/api.js` (+7/−4), `automation/html-waapi/api.js` (+27/−73),
`automation/html-waapi/render.js` (+7/−3), `automation/html-waapi/cdp-capture.js` (+18/−1).

### H.1 One conversion, two call sites

There is now **exactly one** `type: 'html'` → `'hic'` conversion in the codebase,
`htmlToHicCode(html, css, js, fps)` (`index.html:27280`). It is called from two places, and those two
places are the only ways a legacy clip can reach the app:

| Call site | Why it is there |
|---|---|
| `migrateLegacyHtmlClips(clips)` ← `applyProject()` | the **load** path — every saved project ever written |
| `StudioPro._createClipFromDef()`, `case 'hic'` | the **creation** path — `createHtmlClip`, `createComposition`, `html()` |

The rule it applies, in order — the same precedence `WAAPIAdapter.wrapWithWAAPI` already uses, so a
migrated clip and an agent-authored one are indistinguishable:

1. `hasOnFrame(js)` → return the clip **untouched**. An author's `onFrame` is already deterministic;
   compiling keyframes on top of it would replace intent with inference.
2. `!hasKeyframes(css)` → untouched. Nothing to compile; the clip was already a static capture.
3. else `compileKeyframes(css, fps)` and take **both halves**: `compiled.js` (the `onFrame` that
   writes interpolated values as inline styles) *and* `compiled.css` (the same stylesheet with the
   consumed `@keyframes` and their `animation:` declarations stripped). The stripped half is
   load-bearing, not cosmetic: a still-running `animation:` wins the cascade over the inline values
   the adapter writes, and the docs pages raster HIC in a real DOM where CSS animations do apply.

`applyProject` is not one load path among several — it is the choke point all of them funnel
through (localStorage restore, `.json` import, `.spcomp`, project switch: call sites at 33689, 34102,
34168, 35303/35307/35313). The migration sits immediately after `State.clips` is rebuilt at 33915,
*before* the pre-render calls, so `preRenderAllHtmlClips` finds nothing to capture and
`preRenderAllHicClips` does the work instead.

Every legacy per-clip cache is dropped on the way across (`_isWaaapi`, `_htmlIframe`, `_htmlCanvas`,
`_htmlReady`, `_htmlNeedsRefresh`, `_htmlSig`, `_htmlRendering`, `_htmlContentWritten`,
`_waapiContentWritten`, `_hicR`, `_lastHicFrameSig`) — a migrated clip must not arrive with a raster
that belongs to the engine it just left.

### H.2 Idempotency is enforced twice over, not once

`clip._migratedFrom = 'html'` is the explicit guard, and it is **not** in `PROJECT_RUNTIME_FIELDS`, so
it is serialised and survives a save/reload. The second guard is structural: after migration the clip
is no longer `type: 'html'`, and the predicate tests for that first. Either alone would do; together
they mean a project can be loaded, saved, reloaded and loaded again without a second compile pass.

### H.3 Three deliberate deviations from the §B.4 sketch

1. **`WAAPIAdapter.expandDataAnimate` is not called.** §B.4's sketch writes
   `clip.html = WAAPIAdapter.expandDataAnimate(clip.html)`. Part A deleted `future-waapi/` without
   lifting that file (§A.5 records why the lift was not a prerequisite), and — the part that makes
   this a *correct* omission rather than a shortcut — **no legacy HTML clip ever had
   `data-animate` support**: the adapter lived in a folder nothing imported. Applying it now would
   not preserve behaviour, it would invent it. The pointer to the only surviving copy
   (`automation/html-waapi/lib/data-animate-adapter.js`) is in §A.5 and in
   `HTML-ENGINE-CONSOLIDATION-PLAN.md` §7.2.
2. **The creation path was closed too, not just the load path.** §B.4 only asked for a load-time
   migration. That leaves `StudioPro.createHtmlClip()` and the whole `_createClipFromDef` API able to
   mint fresh `type: 'html'` clips forever — which would make Phase 4's deletion reachable only in
   theory, since a new legacy clip could appear at any time. One line in `_createClipFromDef`
   (`type = labelType === 'html' ? 'hic' : labelType`) closes it, and it also fixed a latent bug: the
   `html` case called a `createClipBase(...)` that **is not defined anywhere in `index.html`**, so
   `createHtmlClip()` had been throwing on every call.
3. **`renderWidth`/`renderHeight` are kept, not deleted.** They were the html2canvas capture size; HIC
   renders at canvas resolution and ignores them. Deleting them would break a downgrade (open a
   migrated project in an older build) for no gain, so they stay as inert data.

### H.4 Verified

Editor (dev server, `localhost:4345`): a three-clip legacy project built and pushed through
`applyProject` — the real load path, not a unit call.

| Clip | Input | Result |
|---|---|---|
| `leg_static` | static css, no js | `hic`, css verbatim (68), js `''` |
| `leg_anim` | css with `@keyframes` + `animation:`, no js | `hic`, css stripped to 16 chars, js = 5,916-char compiled adapter |
| `leg_author` | css with `@keyframes` **and** its own `onFrame` | `hic`, css verbatim (153), js verbatim (46) — author wins |

- All three: `_migratedFrom === 'html'`, every `_html*` cache gone, `_hicR` rasterised afterwards.
- **Round trip:** `serializeProject()` → `applyProject()` → `serializeProject()` → `applyProject()`. The
  two loads are identical and the two clip arrays are **byte-identical**; the only top-level diff is
  `savedAt`. No double compile (js length stays 5,916, not ~11.8 K).
- **Real persistence:** the migrated project was autosaved, the page **reloaded**, and it came back
  with the same three clips, the same lengths and **no second migration log**.
- `State.clips.filter(c => c.type === 'html').length === 0`; `preRenderAllHtmlClips` would find 0;
  the export pumps' `_needsHtmlWait` scan is false; zero console errors.
- `StudioPro.createHtmlClip('<div>…', keyframedCss)` → `type: 'hic'`, `presetId` null, `_hicSig` set,
  keyframes compiled; `StudioPro.createComposition({clips:[StudioPro.html(…)]})` likewise.
- `npm run build` passes; `dist/index.html` 2,554.20 kB; precache still 90 entries.

CLIs: `node --check` clean on all four files, then the seek path was exercised for real in headless
Chrome (throwaway harness, since deleted). Two clips, 9 frames each, captured twice:

| Clip | Animates | Frame-for-frame identical across two runs |
|---|---|---|
| migrated (`onFrame`, css stripped → driven **only** by the new `window.onFrame(ms)` branch) | ✅ 9/9 distinct | ✅ **yes** |
| legacy (live `@keyframes` → driven by `getAnimations()`) | ✅ 9/9 distinct | ❌ **no** |

### H.5 The finding worth keeping: the batch path got *more* deterministic, not less

The `cdp-capture.js` change was written as a compatibility shim — "migrated clips lost their live CSS
animations, so also call `onFrame`". The measurement says something better: the **migrated** clip is
reproducible run-to-run and the **live-keyframes** clip is not. Once Phase 3 has converted a project,
the batch renderer stops depending on animation phase at all. The seek adapter runs `getAnimations()`
first and `onFrame(ms)` second by design, because the adapter writes inline styles and must win the
cascade.

For `render.js` (`cdp` mode) the repoint is therefore not a workaround at all: `extractClipData`
now reads `type === 'hic'`, gets `css` already stripped and `js` already carrying `onFrame`, and
hands both to a standalone page that seeks deterministically. Verified live: the editor exposes all
three migrated clips to that filter with non-empty `html`/`css`/`js`.

### H.6 Left open

- **The CLIs were moved after this section was written.** `automation/html-waapi/` →
  `automation/html-in-canvas/` (P1). The `/−` line counts above describe the tree as it was during
  Phase 3; the file contents are unchanged.
- **Phase 0 still has no committed fixture.** The round trip was run in the browser and the numbers
  are above, but as an ad-hoc script, not a file the next person can re-run. Phase 4 changes the
  render path itself, so it still wants the fixture — built, not remembered.
- **No export-speed baseline was recorded** (that half of Phase 0 is untouched).
- **Neither CLI was run end-to-end.** The repointed code paths were each exercised directly (seek in
  headless Chrome; `preRenderAllHicClips` queuing; the filtered clip reads), but a full
  `render.js examples/*.js` needs a dev server on port 7000/3000/3001 **and** ffmpeg, and neither was
  started. The `-m gui` mode (`StudioProWAAPI.export`) is entirely unexercised.
- **The two CLIs remain two CLIs** (§B.6 item 4).
- `automation/html-waapi/api.js`'s `preloadWaaapiClips` was reduced from 82 lines of per-clip
  offscreen-iframe construction to a call to `preRenderAllHicClips`. That is the right shape *if* the
  GUI export still needs an explicit preload — worth confirming against the `-m gui` path above.
