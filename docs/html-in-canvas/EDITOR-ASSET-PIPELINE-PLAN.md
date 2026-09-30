# Editor Asset Pipeline — Port Plan (Google Fonts · LaTeX · MDX · Tailwind)

> Goal: give **HTML-in-Canvas clips** in Studio Pro the same rich-content powers the
> test renderer got in `d17aff6` — web fonts, math, markdown, Tailwind — using the
> editor's existing dependencies wherever possible, with export parity in FTRT and
> MediaBunny modes.

> **Update (post-`1c8d598`):** while export-testing the new test-renderer presets we
> found (and fixed) an export-geometry bug that directly shapes this plan — see
> §0.1. Phase A now also includes a **Phase A2: dedicated scale wrapper in the
> editor's SVG builder** so the same failure mode is designed out of the editor.

---

## 0.1. New lesson from `1c8d598` — never scale the preset's own DOM

The test renderer's 1080p export styled **the preset's first sandbox child** as
the 800×450 scale wrapper. Two presets broke it:

- **MDX Report:** first child was the hidden markdown source (`display:none`) →
  the transform landed on nothing → video rendered unscaled (16px text across
  1920×1080).
- **Tailwind Cards:** the wrapper applied, but the preset root's `min-h-full`
  resolved `min-height:100%` against the 1920×1080 sandbox instead of the forced
  450px → all content pushed to the bottom of the frame.

Fix: a **dedicated wrapper div** is created, ALL sandbox children are moved into
it, and *that* is scaled. Layout can never depend on user/preset DOM structure.

**Why the editor already needs this too:** the editor's SVG builder wraps the
sandbox clone in its own fixed 800×450 div (independent of clip DOM) — so the
MDX failure mode can't happen there. But the same *class* of bug (geometry keyed
on clip DOM) can reappear in any future export path (e.g. MP4 frame pipeline,
thumbnail generation). Phase A2 codifies the wrapper pattern in a shared helper
(`buildHicSvgShell(w, h, innerDom, css)`) used by every rasterization site.

---

---

## 0. Why one integration point is enough

All HIC rendering flows through one code path in `index.html`:

| Consumer | Path |
|---|---|
| Live preview / seek | `drawCanvas()` → `_hicSig` block (line ~6974) |
| FTRT export | pre-render loop (line ~36233) calls `drawCanvas()` + `waitForHicRenders()` |
| MediaBunny export | same `drawCanvas()` + wait pattern |

So the pipeline hooks **only** into the `_hicSig` block: when a clip's html/css/js
signature changes, run the asset pipeline async, store the processed result, and
let the existing double-buffer + `_contentRev` machinery handle the async fill.
Exports inherit everything automatically — we only add a **pre-flight warm-up**
so no export frame waits on a first-time font fetch.

---

## 1. Phase A — `HicAssets` service (foundation)

Port the test-renderer pipeline into a module-scope service in `index.html`:

```js
const HicAssets = {
  _fontCssCache: {},        // css2-URL -> inlined CSS (fonts as data URIs)
  _scriptsLoaded: {},       // src -> Promise (load-once per session)
  _tailwindReady: null,     // lazy loader promise
  _markedReady: null,       // lazy import('marked')

  async ensureScripts(html),          // sequential <script src> hoisting (KaTeX race fix)
  async embedStylesheets(html, css),  // <link> / @import -> fetch -> inline url() refs as data URIs
  async ensureTailwind(),             // lazy-load local @tailwindcss/browser once
  async typesetMath(sandboxEl, html), // MathJax tex-svg (already vendored)
  async renderMarkdown(html),         // <script type="text/markdown"> blocks -> HTML
}
```

Port verbatim from the test renderer (already debugged there):
- **Sequential script loading** — dynamic scripts ignore `defer`; auto-render must not
  beat the main library to the global scope.
- **Div-wrap parse** — a bare `DOMParser.parseFromString(html)` hoists a leading
  `<link>` into `<head>` and `body.innerHTML` silently drops it.
- **Raw-vs-absolute URL replacement** — fetch absolute refs, replace the *original*
  relative strings in the sheet (`split(absoluteUrl)` misses `url(fonts/x.woff2)`).

### Integration into the `_hicSig` block (line ~6974)

Current flow on signature change: compile `onFrame` → set sandbox innerHTML →
async image preload → render.

New flow:

```
sig change
  → _hr._assetsReady = false; _hr._assetsVer++
  → HicAssets.ensureScripts(html)            (scripts stripped from html)
  → HicAssets.renderMarkdown(html)           (md blocks replaced)
  → image preload (existing code)
  → HicAssets.ensureTailwind() + mount + capture <style>   (if classes detected)
  → HicAssets.embedStylesheets(html, css + projectFonts)   (Google Fonts etc.)
  → MathJax typeset on sandbox               (if $...$ / $$...$$ present)
  → _hr._processedHtml / _hr._processedCss stored
  → _hr._assetsReady = true; _contentRev++; drawCanvas() again
```

Render path uses `_processedHtml/_processedCss` instead of raw `clip.html/css`.
Every stage caches, so **seeks never re-fetch** — work happens only on real
content edits.

### Pre-flight for exports (both modes)

Before the FTRT/MediaBunny frame loops start:

```js
await Promise.all(hicClips.map(c => HicAssets.warmUp(c)));  // full pipeline once
```

plus extend `waitForHicRenders()` to also await `_assetsReady`. Result: the
pre-render loop keeps its ~175 fps because every clip is already processed
before frame 0 (this also *improves* the 0→40% UX story — no font stalls
mid-pre-render).

### A2 — Dedicated scale wrapper shared by every rasterization site

Codify the `1c8d598` fix as the only sanctioned way to build an HIC SVG:

```js
function buildHicSvgShell(w, h, innerDom, css) {
  // fixed 800x450 inner stage, scaled from center of the pipeline —
  // NEVER from a user/preset element
  var s = w / 800, sy = h / 450;
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'">'
    +'<foreignObject width="'+w+'" height="'+h+'">'
    +'<style xmlns="http://www.w3.org/1999/xhtml">'+css+'</style>'
    +'<div xmlns="http://www.w3.org/1999/xhtml" style="width:800px;height:450px;overflow:hidden;transform:scale('+s+','+sy+');transform-origin:0 0;">'
    + innerDom + '</div></foreignObject></svg>';
}
```

The live-preview path already matches this shape; refactor it to call the
helper so future rasterization sites (export frames, thumbnails) inherit the
guarantee by construction. **Rule: nothing inside `innerDom` may be relied on
for geometry** — no `firstElementChild` scaling, no assumption that the first
child is visible (it may be a `display:none` data block), no `min-h-full`
interaction with the outer sandbox size.

---

## 2. Phase B — Google Fonts for HIC clips

The editor already has font plumbing: `State.googleFonts` (project font list),
the font picker, `importGoogleFontFromInput()`, and css2 URL builders at 5 sites
(lines 2696, 6726, 8007, 9090, 9193). But those inject `<link>` tags, which the
SVG rasterizer **cannot load** — HIC clips currently fall back to system fonts.

**Do:**
- **B1 — Detection:** on sig change, collect font-family names from
  `clip.css` + `clip.html` inline styles; intersect with `State.googleFonts`
  (plus any name already imported by the user).
- **B2 — Embed:** build css2 URLs (same `wght@400;600;700;900` pattern the app
  already uses) → `HicAssets.embedStylesheets` inlines the woff2 files as data
  URIs into `_hr._processedCss`, cached globally per URL.
- **B3 — Zero-effort path:** fonts picked in the properties tab for a HIC clip
  just work — no `<link>` tags needed by users, in preview *and* export.
- **B4 — Offline:** the PWA runtime cache already covers
  `fonts.googleapis.com`/`fonts.gstatic.com` (StaleWhileRevalidate, 365d), so
  embedded fonts survive offline sessions too.

**Verify:** set Playfair Display on a HIC clip → canvas preview shows the real
font → 1080p FTRT export keeps it.

---

## 3. Phase C — Tailwind support (uses installed v4 toolchain)

The project has `tailwindcss@4.3.3` + `@tailwindcss/postcss` installed. The
Play-CDN approach from the test renderer works but needs the network and runs
the older v3 engine. Better: the **official v4 browser build**.

- **C1 — Dependency:** `npm i -D @tailwindcss/browser@4.3.3` (same version
  family as the installed toolchain). Vite bundles it as a lazy chunk
  (`import('@tailwindcss/browser')` on first Tailwind-using clip) and workbox
  precaches it → **offline-capable, no CDN dependency**.
- **C2 — Capture:** mount processed html into the clip sandbox → wait for the
  injected utilities `<style>` (same MutationObserver pattern as the test
  renderer, watching the right element) → capture its text into
  `_hr._processedCss` → **remove the style from the document**.
- **C3 — Preflight isolation (the critical regression risk):** unlike the
  standalone test page, in-editor the browser build's *preflight reset* would
  restyle the whole app UI (buttons, scrollbars, fonts). Mitigations, in order:
  1. Capture-and-remove immediately after generation (window is short but real —
     combine with mounting inside a detached container first, then move to sandbox).
  2. Scope the captured CSS into the SVG only — it lives in `_processedCss`,
     injected inside `<foreignObject>`, never in `document.head`.
  3. Guard test after implementation: open editor, add Tailwind clip, diff
     computed styles of app header buttons before/after. Must be byte-identical.
- **C4 — CDN fallback:** if the dynamic import fails (old build), fall back to
  `cdn.tailwindcss.com` script (v3 engine, still better than nothing).

**Verify:** Tailwind Cards preset renders fully styled; app UI unaffected;
export parity.

---

## 4. Phase D — LaTeX / math support (zero new dependencies)

**Use the MathJax 3 already vendored** (`vendor/mathjax/tex-svg.js`, offline
precached, used by text clips today). This beats porting KaTeX for the editor:

| | KaTeX (test renderer) | MathJax tex-svg (editor) |
|---|---|---|
| Dependency | katex.min.js + CSS + **60 font files embedded as data URIs** | none — already vendored |
| Offline | needs embed cache | works today |
| Output | HTML+fonts | **self-contained SVG** — serializes cleanly through XMLSerializer into foreignObject |
| Speed | faster typeset | fine for clip-level (typeset once per sig change) |

**Do:**
- **D1 — Detection:** regex `$...$`, `$$...$$`, `\(...\)`, `\[...\]` in clip html
  after mount.
- **D2 — Typeset:** `await MathJax.typesetPromise([sandboxEl])` once per sig
  change; call `MathJax.typesetClear([sandboxEl])` before re-typesetting a
  rebuilt sandbox (MathJax marks elements as done).
- **D3 — Serialization check:** confirm MathJax SVG survives
  `XMLSerializer` → SVG → canvas raster (it uses explicit paths +
  `currentColor`, no external refs — expected clean; verify `xlink` namespacing).
- **D4 — Authoring surface:** document `$$...$$` syntax in the HIC card
  placeholder + add a "Math" entry to the AI prompt library contract.
- **D5 — Optional KaTeX path (later, only if needed):** if users need
  pixel-faster typesetting or display-style micro-kerning parity with the test
  renderer, reuse `HicAssets.embedStylesheets` (Phase A) to inline KaTeX CSS +
  fonts. Not required for v1.

**Verify:** LaTeX Math preset in editor: typeset fractions render on canvas,
theorem animates, export keeps math at 1080p.

---

## 5. Phase E — MDX / markdown support

- **E1 — Dependency:** `npm i marked` (~10KB gzip). Lazy:
  `HicAssets._markedReady = import('marked')` on first markdown clip — no
  initial-load cost; vite bundles + precaches.
- **E2 — Convention (authoring):** markdown lives inside the clip html in a
  inert block:

  ```html
  <script type="text/markdown" id="mdSrc">
  # Q4 Growth Metrics
  - **DAU:** +24% YoY
  </script>
  <div id="mdOut"></div>
  ```

  Pipeline replaces every `script[type="text/markdown"]` with its parsed HTML
  (inserted at the same position / into the paired target if `data-target` is
  present). Static markdown renders with **no user JS**; animation via the
  normal `onFrame(t)` over the parsed children (same model as the preset).
- **E3 — HTML safety:** parse with `marked` (no raw-HTML passthrough config),
  keeping the demo's entity-decoding fix for `&amp;` inside script blocks.
- **E4 — Preset:** port `mdx-report` preset to this convention.

**Verify:** MDX Report preset renders parsed headings/list cards in editor,
stagger animation via onFrame, export parity.

---

## 6. Phase F — Presets + editor surfaces

- **F1 — `HIC_PRESETS` (line 25243):** add `latexMath`, `mdxReport`,
  `customFont`, `tailwindCards` using the editor conventions (MathJax syntax
  for math; markdown script blocks for MDX; Google Fonts auto-embed for the
  font preset; utility classes for Tailwind).
- **F2 — Presets tab:** the HIC sub-tab already iterates `HIC_PRESETS`
  (line 13581) → the four appear automatically with cards; verify
  `addPresetToTimeline` JSON path for them (the earlier `"undefined" is not
  valid JSON` bug must not reappear — presets are registry objects, not
  JSON-encoded).
- **F3 — Properties tab:** nothing new needed (html/css/js textareas already
  there); update the HTML placeholder to hint `$$math$$`, markdown blocks,
  and Tailwind classes.
- **F4 — AI prompt contract:** extend the Copy-AI-Prompt system prompt with the
  new syntax support (math delimiters, markdown blocks, Tailwind allowed now)
  so generated code uses them correctly.

---

## 7. Phase G — Export parity, perf, and test matrix

- **G1 — Warm-up before loops** (both FTRT + MediaBunny): `Promise.all(warmUp)`
  then start; also await inside `waitForHicRenders`.
- **G2 — Static-layer interplay:** math/markdown/tailwind processing is
  time-invariant → static detection (`!_onFrame && no CSS animation`) must keep
  working so static-skips stay free. Assets never invalidate per frame.
- **G3 — Perf guards:** pipeline runs only on sig change; global font cache;
  Tailwind capture cached per sig; MathJax typeset once per sig. Add
  `[HIC assets] …ms` console timing for warm-up.
- **G3.1 — Geometry regression test (new, from `1c8d598`):** for every preset,
  assert that the 1920×1080 export raster matches the 800×450 preview scaled
  2.4× (sampled pixel-compare, as used in the test-renderer fix). Catches any
  future "scale keyed on clip DOM" regression automatically — for **both**
  export modes.
- **G4 — Test matrix (the 16-preset project):**

  | Check | Expectation |
  |---|---|
  | Preview seek across all 16 | fonts/math/md/tw render correctly |
  | App-UI leak probe | header/panel computed styles unchanged with Tailwind clip present |
  | FTRT 1080p export | visual parity, pre-render fps within ~10% of current |
  | MediaBunny export | visual parity |
  | Export geometry parity (G3.1) | ≥99% sampled pixel match, preview vs export, every preset |
  | Hidden-first-child clip | MDX-style `display:none` source block never affects scale |
  | Offline (SW active) | fonts + math + tailwind still render (local/precached) |
  | Legacy 12 presets | byte-identical rasters (pipeline is a no-op for them) |

---

## 8. Delivery order & sizing

| Phase | Delivers | Size | Commit after |
|---|---|---|---|
| A | `HicAssets` service + sig-block integration + warm-up | ~½ session | ✅ |
| A2 | `buildHicSvgShell` wrapper helper adopted by all raster sites | small | ✅ (with A) |
| B | Google Fonts embed for HIC | small | ✅ |
| C | Tailwind (local v4 browser build) + preflight isolation | medium (risk: C3) | ✅ |
| D | MathJax math | small | ✅ |
| E | marked markdown + convention | small | ✅ |
| F | 4 presets in registry + placeholders + AI contract | small | ✅ |
| G | warm-up polish + geometry parity test + full matrix | small | ✅ |

**Biggest risks, ranked:** (1) Tailwind preflight leaking into app UI →
mitigated by capture-and-remove + computed-style diff test; (2) MathJax async
typeset racing the double-buffer → integrate with `_contentRev` (pattern already
exists); (3) bundle growth → everything lazy (browser build, marked), zero
initial-load cost; (4) export geometry regressions → designed out by A2 wrapper
+ G3.1 pixel-parity test.

---

## 9. The whole plan in simple terms

**The problem:** HTML-in-Canvas clips can currently only use basic system
fonts. If you write math (`$$x^2$$`), markdown (`# Heading`), or Tailwind
classes (`bg-blue-500`) in a clip today, they either show as plain text or
nothing at all. The test renderer already solved this — this plan brings the
same powers into the editor.

**How it works, in one paragraph:** when you edit a clip's code, we run a
small "preparation" step once: load any libraries the clip needs (math,
markdown, Tailwind), download any web fonts it uses, and convert everything
into a self-contained form that our canvas renderer can draw. The result is
cached — seeking the playhead never re-downloads anything. Exports reuse the
same prepared result, so what you see in preview is exactly what lands in the
MP4/WebM.

**Each feature in plain words:**

- **Google Fonts (Phase B):** you already pick fonts in the properties tab.
  Today those fonts appear in text clips but silently fall back to system fonts
  inside HTML clips. We'll fetch the font files once and embed them into the
  clip's styles, so the font you pick is the font you get — in preview and in
  the exported video, even offline (the app already caches Google Fonts).

- **LaTeX math (Phase D):** write `$$E = mc^2$$` in a clip's HTML and it renders
  as real typeset math. We use the MathJax library that's **already shipped
  inside the app** (it powers text-clip math today) — nothing new to download,
  works offline, and its output is SVG that survives our render pipeline
  perfectly.

- **Markdown / MDX (Phase E):** put markdown inside a
  `<script type="text/markdown">` block in your clip and it becomes styled
  headings, lists, and cards — no JavaScript required. Animate the pieces with
  the normal `onFrame(t)` like any preset. Uses the tiny `marked` library,
  loaded only when a clip actually uses markdown.

- **Tailwind (Phase C):** use utility classes like `flex gap-4 bg-slate-900`
  directly in clip HTML. We bundle Tailwind's official browser build (same v4
  version the app's own styling uses) and load it only when a Tailwind clip
  exists — offline-capable, no CDN. It generates a small stylesheet for just
  the classes you used; we inject that inside the clip's render only, so the
  app's own UI can never be affected (checked by an automated style-diff test).

- **Safer exports (Phase A2 + G3.1):** while testing the new presets we found
  that export scaling broke when a clip's first element was hidden or used
  `min-h-full`. Fix: scaling now always uses a wrapper *we* create, never a
  user element — plus an automated test that compares every export against its
  preview pixel-by-pixel, so this class of bug can't silently return.

**Why it's fast:** everything happens once per edit, not per frame. The export
pre-render stage (the 0→40% part of the progress bar) gets *faster* with this
change because fonts are already embedded before the first frame — no mid-render
network stalls.

**Order of work:** foundation (A) → fonts (B) → Tailwind (C) → math (D) →
markdown (E) → presets (F) → hardening tests (G). Each phase ships and commits
independently, so we can stop after any phase and still have something usable.
