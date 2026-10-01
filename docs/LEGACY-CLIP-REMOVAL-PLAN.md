# Legacy clip authoring: removal plan + `future-waapi/` verdict

**Status:** **Phases 1 and 2 executed** — see §E and §F. Part A and Phases 3–4 are still plan-only.
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

### A.4 Disposition

1. Copy the animation table + attribute parsing out of `lib/data-animate-adapter.js` into the
   adapter as `expandDataAnimate`.
2. `git rm -r future-waapi/` — git history preserves it; an on-disk copy is redundant and
   actively misleading (its README contradicts the shipped code).
3. Add one line to `docs/HTML-ENGINE-CONSOLIDATION-PLAN.md` §7.2 marking it done.

Leaving the folder in place is the only option I would argue against: a future reader will find a
"next-generation animation system" that is neither next-generation nor wired in.

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

### B.3 The one real gap to close first

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

**Verify (the Phase 0 gate, now mandatory):** the fixture loads, renders, exports, and re-saves
identical; a clip with `_migratedFrom` set is not migrated again; no `type: 'html'` clip remains in
`State.clips` after load.

#### Phase 4 — Delete the dead engine

Only after Phase 3 has shipped and the fixture passes end-to-end:

- the html2canvas branch in `drawCanvas` (5818, 6877–6921) and the iframe-overlay path
  (8233, 8321–8334);
- `preRenderHtmlClip` (26948–27027) and `preRenderAllHtmlClips` (27015);
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
drops; the fixture still round-trips.

### B.5 What NOT to touch

- **`src/engines/hic/adapters/waapi.js`** — the live compiler. Do not delete it with the buttons;
  it is what the ported presets are compiled by.
- **`automation/html-static/`, `automation/html-waapi/`, `automation/md-render/`** — separate Node
  tools under their own `package.json`, importing nothing under `src/`. `automation/html-waapi/api.js:188`
  reads `_isWaaapi` from a page it drives, so **Phase 4 must not break that CLI** — check it (or
  have it read `type === 'hic'`) before deleting the flag. It renders from a live page, so it is not
  affected by the editor's UI at all.
- **`docs/html-in-canvas/hic-*.js`** — the shared layer the live docs pages depend on.
- **`_archive/`** — a pre-existing backup folder; not part of this change.

---

## C. Risk table

| Step | Blast radius | Reversible? | Gate |
|---|---|---|---|
| Phase 1 (WAAPI button) | UI + preset grid only; no clip data | yes — revert the commit | grid still lists 19 presets |
| Phase 2 (blank HIC + HTML button) | UI only; `addHtmlClipToTimeline` left dead | yes | pre-change project still renders |
| Phase 3 (load migration) | **project load path — touches user data** | yes (guard is `_migratedFrom`), but must be exercised | round-trip fixture **required** |
| Phase 4 (engine delete) | render + export paths; irreversible | no | Phase 3 shipped + baseline compared |

The only step that can lose user data is Phase 3, and it is idempotent-guarded and additive — it
reads old fields into new ones and deletes only transient `_html*` cache fields. Phase 4 deletes
code that Phase 3 has already proven unreachable.

---

## D. Recommended sequence

1. **Part A** (independent): lift `data-animate` into the adapter, `git rm -r future-waapi/`.
2. **Phase 0**: stand up the round-trip fixture; capture the export baseline.
3. **Phase 1**: delete the WAAPI button + filter, resolve the example loader.
4. **Phase 2**: add blank-HIC, delete the HTML button.
5. **Phase 3**: ship the load migration; run the fixture on real pre-change projects for one release.
6. **Phase 4**: delete the engine, the modal, the cards, the flag, and the shim.

Phases 1–2 are a single afternoon and are safe today. Phases 3–4 are gated on the fixture, not on
courage.

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
