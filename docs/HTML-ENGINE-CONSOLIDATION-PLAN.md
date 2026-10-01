# HTML Engine Consolidation Plan

**Question:** should the editor drop "static HTML" clips and "WAAPI HTML" clips and keep
only HTML-in-Canvas?

**Answer: yes — consolidate on HTML-in-Canvas, but in four ordered phases rather than one
delete.** Two of the phases are free (they remove code nothing imports), one phase is a
port that *loses nothing*, and only the last one deletes the old render path — after a
project-load migration exists.

Everything below is measured from the tree at `880e71d`, not assumed.

---

## Status

| Phase | State |
|---|---|
| 1 · delete dead modules | **shipped** |
| 2 · port WAAPI presets onto HIC | **shipped** — with one premise corrected, see §6 |
| 3 · retire the authoring UI + load-time migration | not started |
| 4 · delete the html2canvas path | not started |

---

## 1. What is actually there

There are **two** HTML renderers, not three. The three names you see in the UI are two
code paths plus one flag:

| UI name | Clip type | Renderer | Notes |
|---|---|---|---|
| HTML clip | `type: 'html'` | hidden iframe + **html2canvas** | the "static HTML" path |
| WAAPI clip | `type: 'html'` **+ `_isWaaapi: true`** | **same iframe + html2canvas** | preview uses a live iframe overlay; export falls back to html2canvas + `seekToFrame` |
| HTML-in-Canvas | `type: 'hic'` | SVG `foreignObject` + `onFrame(t)` | per-clip, deterministic, seekable |

The evidence that HTML and WAAPI are one path:

- The preset grid declares WAAPI entries as `type: 'html'` with `_isWaaapi: true`
  (`index.html` 2441–2490, 7 presets + 1 "Load WAAPI Example" action).
- The capture banner says it outright: `═══ HTML + WAAPI clips: html2canvas + seekToFrame ═══`
  (6839–6900) and `═══ WAAPI Capture: uses html2canvas + seekToFrame (same as HTML clips) ═══`
  (11315–11359).
- Both go through the same export wait hook: `_needsHtmlWait` (37937, 38538).

So "remove static HTML but keep WAAPI" is not a real option on its own — removing either
removes the html2canvas code the other one needs. The real choice is **one HTML engine or
two**, and both answers are about HIC vs html2canvas.

### 1.1 The WAAPI *content* is already portable to HIC

`src/html-in-canvas/adapters/waapi.js` already ships the bridge:

- `hasKeyframes(css)` — detects `@keyframes` in a clip's CSS
- `generateWAAPIAdapter(fps)` — emits an `onFrame(time)` that seeks
  `document.getAnimations({subtree:true})` to `time` and pauses them
- `wrapWithWAAPI(existingJs, fps)` — returns the adapter alone, or prepended to a clip's own
  `onFrame`

That means the 8 WAAPI presets can become HIC clips **with their CSS untouched** — the
adapter supplies the `onFrame` they lack, and they become seekable and export-exact in the
process. Nothing is lost by retiring the WAAPI *path*; the presets get promoted.

### 1.2 Dead code that is already safe to delete

Both engine prototypes exist as ESM modules **that nothing imports**:

| Path | Lines | Imported by |
|---|---|---|
| `src/html-clips/renderer.js` | 414 | nothing |
| `src/html-clips/editor.js` | 470 | nothing |
| `src/html-clips/index.js` | 175 | nothing |
| `src/html-in-canvas/renderer.js` | 201 | nothing |
| `src/html-in-canvas/preload.js` | 119 | nothing |
| `src/html-in-canvas/adapters/waapi.js` | 101 | nothing |
| `src/html-in-canvas/presets/index.js` | 81 | nothing |
| `src/html-in-canvas/index.js` | 19 | nothing |

The only file under `src/` that `index.html` loads is the vendored
`src/html-clips/html2canvas.min.js` (line 113) — the library, not the module. So the
editor carries **~1,600 lines of a second, unwired copy of each engine**, on top of the
live inline copy inside `index.html`.

### 1.3 Duplication inside `index.html`

- **Two byte-identical copies of the `WAAPI_PRESETS` object literal** (26816 inside
  `_applyWaaapiPreset`, 27161 inside `addWaaapiClipToTimeline`) — all 7 presets twice.
- **Three byte-identical copies of the `seekToFrame` adapter string** (6968, 8244, 26980).
- The same `_needsHtmlWait` scan duplicated in the FTRT and standard export pumps
  (37937–37942, 38538–38543).
- Two code-editor modals that do the same job: `htmlEditorModal` (markup 124–180) and
  `hicEditorModal` (markup 208–311), plus their own JS blocks (26840–26947, 27498–27900).
- Two sidebar cards: `cardHtmlContent` (15366) and `cardHicContent` (15423).

### 1.4 What the html2canvas path costs today

- **198 KB** vendored `html2canvas.min.js`, loaded unconditionally on every page load
  (line 113) and precached by the service worker (part of the 86-entry / ~7.5 MB precache).
- Per the repo's own WAAPI comparison table, ~500 ms per captured frame versus ~5–15 ms
  for the foreignObject path.
- Its own pre-render pass (`preRenderHtmlClip`, 26947) and two export-pump wait hooks.
- A documented limitation list (no `backdrop-filter`, frozen CSS animation, CORS images).

---

## 2. Recommendation

**Keep HTML-in-Canvas as the single HTML engine. Retire the iframe + html2canvas path in
four phases, and port the WAAPI presets rather than dropping them.**

Order matters because the binding constraint is not code, it is **saved projects**: a
project that already contains `type: 'html'` clips must still open after the renderer is
gone. Each phase below keeps that true, and only the last one removes the code.

### Phase 1 — delete the dead modules (no behaviour change)

Remove `src/html-clips/` (renderer, editor, index, README) and `src/html-in-canvas/`
(renderer, preload, presets, adapters, index) — except that `adapters/waapi.js` is wanted
by Phase 2, so move that one file before deleting the rest.

- **Why safe:** nothing imports them; the live code is inline in `index.html`.
- **Kept:** `src/html-clips/html2canvas.min.js` (still referenced by line 113).
- **Result:** ~1,600 lines gone, bundle unchanged (these files are not in the bundle
  today), zero runtime difference.
- **Verify:** `npm run build` still emits the same page count, and the HIC pages still
  render (they load `docs/html-in-canvas/hic-*.js`, untouched).

### Phase 2 — port the WAAPI presets onto HIC

1. Move `adapters/waapi.js` to the HIC module home (Phase 4's structure).
2. Convert the 7 WAAPI preset entries (2441–2490) into HIC preset entries, each carrying
   `html` + `css` from today's `WAAPI_PRESETS` and `js` = `wrapWithWAAPI('')`.
3. Add them to `HIC_PRESETS`, which takes the grid from 12 to 19 real presets.
4. Delete the two duplicated `WAAPI_PRESETS` literals and the three duplicated adapter
   strings — the adapter now lives in one place and is generated, not copy-pasted.

- **Why safe:** the CSS is unchanged; the adapter only adds `onFrame`. The presets get
  *better* (seekable, export-exact, no 500 ms/frame capture).
- **Also fixes:** the `_isWaaapi` preview/export split — one render path, one behaviour.
- **Verify:** each ported preset renders identically at t=0 and animates across its
  duration; scrub to three times inside the clip and confirm frames differ; export a short
  clip from a ported preset and check the animation is present in the file.

### Phase 3 — retire the authoring UI, keep the loader

Remove the *entry points*, not the engine:

- `#btnAddHtml` (1306) and `#btnAddWaaapi` (1309), and the HTML category in the preset grid.
- `htmlEditorModal` markup (124–180) + its JS (26840–26947) + `openHtmlEditor`, and the
  `cardHtmlContent` sidebar card and nav item (15366, 15458).
- Keep, for now: the drawCanvas html branch (6838–7060), `preRenderHtmlClip` (26947) and
  the two `_needsHtmlWait` hooks — old projects still need them.

Then add the **load-time migration**, which is what makes Phase 4 safe:

```
on project load / .spcomp import:
  for each clip where type === 'html':
      js = hasKeyframes(clip.css) ? wrapWithWAAPI(clip.js || '') : (clip.js || '')
      clip.type = 'hic'
      clip.html, clip.css, clip.js = clip.html, clip.css, js
      clip._migratedFrom = 'html'      // so a re-save never re-migrates
```

- A clip with `@keyframes` becomes an animated HIC clip with the identical CSS.
- A clip with its own `onFrame` keeps it.
- A clip with neither (the "static HTML" case) becomes a static HIC clip — which is exactly
  what it already was, since html2canvas captured it statically at the current frame.
- The `_isWaaapi` flag disappears; there is nothing left for it to mean.

- **Verify:** open a project saved before this change with at least one HTML and one WAAPI
  clip; confirm both render, animate, export, and survive a round-trip through `.spcomp`
  without being migrated twice.

### Phase 4 — delete the html2canvas path

Once Phase 3 has shipped for a release (or a project-age guard passes), remove:

- the html2canvas branch in `drawCanvas` (6838–7060) and the second iframe path
  (8180–8290)
- `preRenderHtmlClip` (26947–27027), the `preRenderAllHicClips` sibling stays
- the `_needsHtmlWait` scans in both export pumps (37937–37942, 38538–38543)
- the `<script src="src/html-clips/html2canvas.min.js">` tag (113)
- `src/html-clips/html2canvas.min.js` and the now-empty `src/html-clips/`
- the `_htmlIframe` / `_htmlCanvas` / `_htmlNeedsRefresh` / `_htmlExportIframe` clip
  state and its cleanup sites (3763, 6902–7000, 8200–8290, 26959–26990, 33371)

- **Result:** one HTML engine, ~800 lines of inline render/UI code gone, 198 KB off the
  initial load and the precache, and no per-frame capture penalties in export.
- **Verify:** the export-speed comparison in `docs/html-in-canvas/EXPORT-SPEED-COMPARISON.md`
  is the baseline; re-run it. Precache entry count should drop.

---

## 3. What must NOT be touched in this cleanup

- **`automation/html-static/` and `automation/html-waapi/`** — separate Node + Puppeteer
  CLIs under their own `automation/package.json` (`puppeteer-core`), reading `.js`/`.md`
  files and capturing frames in a real browser page. They reference **nothing** under `src/`
  (see §7.1), so deleting the editor's engine modules cannot affect them. *(Corrected: the
  `data-animate-adapter.js` / `svg-renderer.js` files this section used to attribute to
  `html-waapi/` actually live in `future-waapi/lib/` — see §7.2.)*
- **`automation/md-render/`** — emits text/shape/image/math clips; unaffected.
- **`future-waapi/`** — a research lab referenced only from docs. It contains a *different*
  idea (declarative `data-animate` attributes). If that idea is still wanted it belongs in
  the HIC adapter as authoring sugar, not as a fourth engine.
- **`docs/html-in-canvas/hic-*.js`** — the shared layer the three live pages depend on.
- **The Markdown generator** — verified to emit text clips, never `html`/`waapi`; nothing to
  change.

---

## 4. Target folder structure

The consolidation is also the forcing function for the structure Studio Lite needs. Today
the engines live in a 38,689-line `index.html`; that file, not the third engine, is the
real blocker.

```
src/
├── engines/
│   ├── hic/                     ← the surviving HTML engine
│   │   ├── renderer.js          ← SVG foreignObject + frame cache
│   │   ├── preload.js           ← web-font embedding, image inlining
│   │   ├── adapters/waapi.js    ← @keyframes → onFrame (moved here in Phase 2)
│   │   └── presets/index.js
│   ├── draw/                    ← brushes, sketch passes, annotation elements
│   ├── render/                  ← drawCanvas, per-clip dispatch, hit-testing
│   └── export/                  ← MediaBunny / FTRT / MediaRecorder pumps
├── project/                     ← schema, serialize, .spcomp, migrations
└── ui/                          ← sidebar cards, modals, timeline

docs/html-in-canvas/             ← the three live pages + hic-frame/modal/storyboard/theme
vendor/                          ← vendored libs only (lucide, mathjax, perfect-freehand)
```

Two rules that make this survive the next feature:

1. **One engine per directory, one copy per engine.** The duplication in §1.3 (two preset
   literals, three adapter strings, two export wait hooks) is the symptom to design out —
   a shared `project/migrations/` module is what lets Phase 3 and Phase 4 exist at all.
2. **Vendor drift is checked, not trusted.** `hic-frame.js` and `hic-modal.js` are still
   hand-copied into the IITM repo. That is the same failure mode as the duplicated adapter
   strings, one repository over, and it is what `docs/STUDIO-LITE-PLAN.md` §4.4 calls the
   seam-first extraction.

---

## 5. Effort and sequencing

| Phase | Risk | Blocks Studio Lite? |
|---|---|---|
| 1 · delete dead modules | none | no — pure cleanup |
| 2 · port WAAPI presets | low | no — adds HIC coverage |
| 3 · retire UI + add migration | medium — must not lose clips | yes — this is the schema story |
| 4 · delete html2canvas path | medium — needs Phase 3 shipped first | yes — removes the second renderer |

Phase 1 and 2 are safe to do immediately and in that order. Phases 3 and 4 should be one
release apart: 3 ships the migration while the old renderer still exists, so a bad
migration is recoverable by opening the project in the previous build.

The single most valuable thing to build before Phase 3 is the **test harness** —
`docs/STUDIO-LITE-PLAN.md` P0. "Without breaking anything" is currently unenforceable: there
is no test runner in this repo, so a migration bug would only be found by a user.

---

## 6. Phases 1–2 shipped: what actually happened

**Phase 1** went exactly as written: `src/html-clips/{renderer,editor,index,README}` and
`src/html-in-canvas/{renderer,preload,presets/index,index}` deleted, `html2canvas.min.js`
kept, `adapters/waapi.js` kept. Nothing imported any of them — only docs referenced
them — so there is no behaviour change: no bundle movement, same page count.

**Phase 2 needed one premise corrected.** §1.1 assumed the adapter's `getAnimations()` seek
could drive HIC. It cannot, and the reason is structural: HIC never applies the clip CSS to
the live sandbox — the stylesheet is injected *inside* the SVG string — so
`document.getAnimations()` on the sandbox is always empty, and inside the SVG raster the
stylesheet runs on its own throwaway timeline. Nothing is seekable across that boundary.

The adapter was therefore **rewritten as a compiler**
(`src/engines/hic/adapters/waapi.js`), keeping the public surface (`hasKeyframes`,
`hasOnFrame`, `wrapWithWAAPI`, `generateWAAPIAdapter`) and adding
`compileKeyframes(css, fps) -> { css, js }`:

- `@keyframes`, `animation:` shorthand, `from`/`to`/`n%`, `cubic-bezier()`/`steps()`/keyword
  easing, `both` fill, infinite iteration, `translateX/Y`/`scale`/`rotate`,
  `var(--x[, fallback])` in values *and* delays, and `calc(a + b)` delays are parsed into a
  small model;
- the model is emitted as an `onFrame(t)` that writes the interpolated values as **inline
  styles** — which do serialise into the `foreignObject` clone, so every frame is exact in
  preview *and* export;
- the `animation:` declarations and the consumed `@keyframes` blocks are **stripped** from
  the CSS that ships to the raster. Necessary either way: an active animation outranks
  inline styles in the cascade, so leaving one in would let a frozen `opacity: 0` win.

**The seven presets now live once.** They were re-specified in place on the existing
`DEFAULT_PRESETS` WAAPI entries — `type: 'text', category: 'WAAPI', _isHic: true,
_hicKey: 'waaapi_<name>'`, keeping their `data: { html, css }` — and are compiled into
`HIC_PRESETS` at load. Both byte-identical `const WAAPI_PRESETS = {...}` literals are gone
(−21.7 KB), so the copies went from **three to one**, and `HIC_PRESETS` is 19 presets.
`addWaaapiClipToTimeline()` / `_applyWaaapiPreset()` are now thin delegations onto
`addHicClipToTimeline()` / `applyHicPreset()`; the latter accepts a legacy `_isWaaapi` clip
and migrates it in place — Phase 3's migration, eager, for the one clip the user acted on.

**The three `seekToFrame` copies collapsed to one — but were not deleted.** They became a
single `window.WAAPI_SEEK_ADAPTER` in `<head>`. Deleting the shim in Phase 2 would regress
the *export* of projects saved before the port, which is exactly what Phase 3's migration
exists to convert. The removal stays in Phase 4, where §2 already lists it.

Two defects found while verifying, both fixed:

1. **Classic scripts never reached `dist/`.** Vite leaves a non-module `<script src>`
   verbatim and does not emit the file, so `src/html-clips/html2canvas.min.js` has been
   **404ing in production** — which is most of why "static HTML is not working very well".
   The adapter would have 404'd the same way, so it now ships via `viteStaticCopy`
   (`src/engines/hic/adapters/waapi.js` → `dist/src/engines/hic/adapters/waapi.js`, precache
   87 → 88 entries). *html2canvas was left alone: it is deleted in Phase 4 anyway, and
   switching it back on in production is a behaviour change nobody asked for.*
2. **`onFrame` could see the whole page.** The renderer scoped `document.getElementById` to
   the clip's sandbox but not `querySelector`/`querySelectorAll`, so a preset's
   `document.querySelector('.b1')` searched the app shell. Both are now scoped for the
   duration of the call. The compiled adapter depends on this; the existing
   `querySelector`-based HIC presets get more correct as a side effect.

Also corrected in passing: the "WAAPI" chip now selects the ported entries
(`_isHic && category === 'WAAPI'`) and the "HTML in Canvas" chip excludes them; and
`presetMeta` now reaches its `_isHic` branch, which was unreachable behind
`p.type === 'text'` — so HIC presets had been labelled "Text".

**Verified** on the dev server by measured inline styles and raster pixels (the preview
webview does not composite, so there are no screenshots):

- all 7 presets compile — 18 animations total, correct selector/duration/iteration/fill,
  and **no** `animation:` or `@keyframes` leftovers in the output CSS;
- scrubbing is exact: `.divider` 0px @0.35s → 54.77px @0.9s → 80px at the end; `.bar`
  height 0px @0.5s → 40% @2s (so `var(--h)` *and* the `var(--d)` delay resolve); `.stat`
  0.308 opacity @0.35s (delay `var(--d)` read from inline style); `float` infinite at
  −7.55px @2.25s;
- the raster itself changes between frames (display-canvas sum 25.3M → 30.3M) and the
  `data:` SVG carries the inline values — the compiler drives real pixels, not just DOM;
- `addWaaapiClipToTimeline()` (toolbar, no argument), the example loader (4 clips),
  `addPresetToTimeline('waaapi_googleClean')` and the legacy migration all yield
  `type: 'hic'`; no `_isWaaapi` flag survives in `DEFAULT_PRESETS`;
- zero console errors and zero non-localhost requests.

**Not yet verified:** the export pumps (no FTRT/MediaBunny run) and the `automation/` batch
renderers. Both deserve a pass before Phase 3, alongside the P0 test harness.

---

## 7. The batch and research folders: verdict

Answered from the tree, not assumed.

| Folder | Referenced by the app? | Verdict |
|---|---|---|
| `automation/md-render/` | no | keep — unaffected |
| `automation/html-static/` | no | keep — documented batch path |
| `automation/html-waapi/` | no | **keep, but converge onto the compiler** (§7.1) |
| `future-waapi/` | nothing imports it | salvage `data-animate`, then archive (§7.2) |

### 7.1 `automation/html-waapi` still works — and should share the compiler

Deleting the editor's engine modules cannot break it. `grep -rn "src/html-clips\|src/html-in-canvas\|src/engines" automation/` returns only prose (in `html-static/ISSUES-AND-TODOS.md` and its `templates/`); the real imports are `puppeteer-core`, `path`, `fs`, `url` and sibling files. It runs under `automation/package.json`, with its own 83 MB `node_modules`, as `node html-waapi/render.js <file>`.

The interesting part: `html-waapi` **also** positions CSS animations with
`document.getAnimations()` (`cdp-capture.js:65`) — and there it works, because it screenshots a
**live page where the CSS is actually applied**. That is exactly the property HIC lacks (§6).
So the repo now holds one animation input (a `@keyframes` clip) positioned two different ways:
a live-browser seek in batch, a compiled `onFrame` in the editor. Both are deterministic, but
they are different code and can drift — the same failure mode as the three `seekToFrame` copies
we just collapsed.

**Recommendation:** keep both pipelines, and have `html-waapi` call
`WAAPIAdapter.compileKeyframes` instead of carrying its own shim. That makes “what the editor
previews” and “what batch renders” the same thing *by construction*, and removes the fourth copy
of the seek snippet. It is a small change: the compiler already emits exactly the per-frame
values the batch loop needs.

*(Doc bug found while checking: `automation/README.md:23` documents
`node html-waapi/render.js html-waapi/examples/animated-slide.js`, but that file does not exist —
the folder holds `animated-pollution.js`, `google-clean-test.js`, `waapi-test.js`. The
`html-static` and `md-render` example commands are fine.*)

### 7.2 `future-waapi/` — superseded, with one idea worth lifting

Nothing imports it: `grep -rn "future-waapi"` outside the folder itself and `docs/` returns
zero. 64 KB, three libs, two example pages. Its README says *“the working html2canvas approach
remains stable… when WAAPI is proven, merge it in.”* That has now happened, in a different
shape — so two of its three libs are superseded by shipped code:

| File | Status |
|---|---|
| `lib/svg-renderer.js` — “SVG foreignObject capture, replaces html2canvas (5–15 ms vs 500 ms)” | **That is what HIC already is.** Superseded. |
| `lib/waapi-seek.js` — the `getAnimations()` seek | **Provably cannot drive HIC** (§6). Superseded by the compiler. |
| `lib/data-animate-adapter.js` — `<div data-animate="fade-up" data-delay=".2s">` → animations | **The salvageable idea.** |

`data-animate` is authoring sugar, and it is a good fit now: it lowers the cost of *emitting* a
clip for an AI agent or a human, and it compiles into the same model `compileKeyframes` already
produces — one pre-pass that turns the attributes into keyframe specs, no engine of its own.
That is the plan's own position, restated with evidence: it belongs in the adapter, not as a
fourth engine.

**Recommendation:** lift `data-animate` into the adapter, then archive the folder. Left in
place it is now actively misleading — it describes the editor as html2canvas-only and WAAPI as
unproven, which is the opposite of the code.
