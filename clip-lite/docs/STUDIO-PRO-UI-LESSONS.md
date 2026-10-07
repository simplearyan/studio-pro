# Studio Pro UI-Component Lessons for Clip Lite

Analysis of `../index.html` (Studio Pro editor) against `clip-lite/index.html`,
written 2026-10-07. Source numbers were measured directly from the file — line
references point at `index.html` at that revision (37,598 lines / 2.5 MB).

The question this answers: **Studio Pro is a desktop-first editor packed with
features and perf code and full of different UI components. When Clip Lite grows
its own component count, what do we copy, and what do we refuse to copy?**

---

## 1. What Studio Pro actually is

- One `index.html`: 37,598 lines, a single ~34,500-line inline script (lines
  1688–36216) plus a module script for the export worker (36218+). ~970
  functions, one global `State` object (2,485 references).
- Component inventory: ~12 full-screen overlays/modals (export, projects,
  reimport, templates gallery, template editor, HIC code editor, AI panel,
  notice/confirm/name modals…), 6 sidebar tabs, dropdown menus, two canvas
  flyouts, context menus, and an inspector that docks left/right/bottom with a
  resizer.
- Wiring is mostly markup-driven: **388 inline `onclick`/`oninput` strings,
  287 `window.*` globals** (markup strings can only reach globals), 105
  `innerHTML` writes, 77 whole-document `lucide.createIcons()` rescans over 484
  icons, 11 separate `document.onkeydown =` assignments.
- Render model: `updateSidebarPanel` is a **1,993-line `innerHTML` rebuild**
  called from 198 sites (line 11848); `renderClips` removes *every* `.clip`
  node and recreates them, called from 111 sites (line 28342).
- Perf code: signature-keyed offscreen layer cache (line 5577), grow-only
  scratch canvases (line 11241), viewport-windowed waveform rasterization
  (line 28847), `content-visibility:auto` list rows (line 17188), GPU detect +
  offscreen canvases, video-frame latch, export in a Web Worker (line 36218),
  undo gesture coalescing (line 15989).

Clip Lite today: 3,565 lines in one file, 13 inline handlers, 27
`addEventListener`, 18 `innerHTML` writes, `toast()`, one `refresh()` entry
point per region, whole-JSON snapshot undo. It is mobile-first; sheets are its
primitive.

---

## 2. Adapt — patterns worth taking

### 2.1 Promise-based dialog trio
`showNoticeModal` / `confirmModal` / `promptNameModal` (lines 33995 / 34036 /
34088): **one hidden DOM instance each**, driven by an options object (tone,
title, message, labels), resolved through a Promise, Enter/Escape/backdrop
built in. N possible dialogs → 3 components. Clip Lite has no confirm/prompt
primitive at all — build this before there are five bespoke ones.

### 2.2 Undo gesture coalescing
`pushUndo(snapshot, coalesceKey)` (line 15989): the first snapshot of a burst
is kept; repeats with the same key within 1,200 ms only refresh the window. A
slider scrub becomes **one** undo entry. Clip Lite pushes whole-JSON history
snapshots per action — without coalescing, every slider drag becomes dozens of
entries the moment sliders push on `input`.

### 2.3 Signature-keyed render caches
`_layerSig` + `getStaticLayer` (line 5577): build a cheap string from every
property that affects a raster; skip re-render when sig + size match; bound the
cache (64 entries). `getSharedScratch(name, w, h)` (line 11241): grow-only
named scratch canvases instead of alloc-per-frame. Both transfer directly to
Clip Lite's per-frame text/filmstrip drawing.

### 2.4 Viewport-windowed painting
`drawCachedWaveform` (line 28847) rasterizes only the *visible* segment of a
clip and positions a small canvas at the left offset. Clip Lite already gates
the ruler this way (`paintRulerSoon` re-paints only when the scroll bucket
changes) — keep that discipline as timelines grow.

### 2.5 `content-visibility:auto` on long list rows
One CSS property per row with `contain-intrinsic-size` (line 17188) — free
rendering wins for Clip Lite's media lists.

### 2.6 Persisted layout state as data
`State.inspector = {visible, dock, width}` restored by `applyInspectorLayout`
/ `saveLayoutSettings` (line 3191). The *idea* — layout prefs are data that
survives reload — maps onto Clip Lite's sheet/rail/iPad plans: store them in
the settings doc, not in code.

### 2.7 One dispatcher per region
`setSidebarTab` only flips `State.sidebarTab` and calls `updateSidebarPanel()`,
which routes to the right sub-renderer (line 15007). Clip Lite's `refresh()` →
`layout + renderTL + panel + fitView` already is this pattern: keep exactly one
entry point per region so state and DOM cannot disagree.

### 2.8 Two-tier undo with runtime-field exclusion (design only)
Studio Pro separates cheap edit snapshots (effects only) from structural
timeline snapshots that keep *live references* so media elements and audio
graphs survive a restore (lines 15972–16075), with a `PROJECT_RUNTIME_FIELDS`
set kept out of serialized data. Clip Lite's clips are already pure data with
runtime handles in `srcs[]` — that separation is the same lesson; keep it.

---

## 3. Do NOT take — anti-patterns observed

### 3.1 Teardown-and-rebuild as the default renderer
`renderClips` removes all clip nodes and recreates them (line 28342);
`updateSidebarPanel` rebuilds `innerHTML` and then spends 40+ lines saving and
restoring scroll positions, `<details>` open states and nav scroll **because
the rebuild destroyed them** (line 11848). That restoration code is the tell.
→ Rebuild only the card that changed, or update in place.

### 3.2 Render = mutate
Both renderers set `_projectDirty = true` ("a sidebar re-render means the user
did something"). Rendering must be safe to call speculatively (measuring,
previewing); side effects belong in named command functions.

### 3.3 Logic inside markup strings
The text-area `oninput` embeds subtitle-sync logic in a template literal;
sliders patch labels via `this.previousElementSibling.querySelector('span:last-child > span')`
— the DOM structure becomes a de-facto API, and every handler needs a
`window.*` global (287 of them). CSP-hostile and un-searchable.
→ Keep Clip Lite's approach: handlers live in JS, DOM edits touch `textContent`
only.

### 3.4 `document.onkeydown` clobbering
11 components assign it; each nulls it on close. Two open components → one
silently loses Escape. → One delegated keydown router (Clip Lite has 2 key
listeners today — start clean).

### 3.5 Class-surgery state switching
`applyInspectorLayout` manually removes ~12 Tailwind class names then adds a
set per dock position (line 3191); `setSidebarTab` reassigns whole `className`
strings with duplicated active/inactive literals (line 15007).
→ Use `[data-dock]` / `data-active` attribute selectors in CSS instead of JS
class bookkeeping.

### 3.6 `setTimeout` choreography
10 ms after toggling the sidebar to re-measure, 50 ms before attaching a
menu's outside-click listener (line 15281). → Double-rAF or `transitionend`
for layout; delegated document clicks for menus.

### 3.7 Metadata scattered through code — the root cause
`setClipEffect` hardcodes a ~45-name list deciding string-vs-float coercion
plus an 80-name subtitle mapping (line 10099), while each slider's
min/max/step/format lives inline in its markup string. That is *why* the
sidebar is 2,000 lines.
**The actual lesson for "so many UI components":** component count is a
*metadata* problem. Hold one table per region
(`{type, min, max, step, unit, format, target}`), generate the controls from
it and their handlers from the same row. Add controls by adding rows, not by
growing a function.

### 3.8 Whole-document icon rescans
77 `lucide.createIcons()` calls each scan all 484 icons after every render.
→ Scope hydration to the inserted subtree, or inline the SVG.

### 3.9 Monolith gravity, and desktop docking wholesale
34.5k lines in one script, 2k-line functions. Clip Lite is fine at 3.5k lines
in one file *for now*, but `clip-lite/src/` scaffolds are the escape hatch —
use them before functions hit 300 lines. Do not import left/right/bottom
inspector docking with resizers at all: Clip Lite is mobile-first and sheets
are its primitive; only the *persistence* of layout prefs transfers.

---

## 4. One-line synthesis

Studio Pro's **performance code** aged well — signature caches, viewport
windowing, scratch canvases, the export worker: take it. Its **component
management** aged badly — rebuild-then-restore, markup-as-logic, metadata
duplicated across setter lists: all avoidable at 3,565 lines. The rule to keep:
state → single region dispatcher → data-driven controls → targeted updates,
with handlers in JS and rescans scoped.
