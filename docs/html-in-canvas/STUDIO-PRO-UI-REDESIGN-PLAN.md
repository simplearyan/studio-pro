# Studio Pro UI redesign plan — the 3-click desktop editor

**Status:** proposal with an interactive mockup
(`studio-pro-redesign.html`, same folder). Inputs: the measured analysis in
`clip-lite/docs/STUDIO-PRO-UI-LESSONS.md`, the verdict *"it is fast but its
UI makes it slow"*, and one house rule: **nothing may be more than 3 clicks
away.**

---

## 1. Goals and non-goals

| | |
|---|---|
| **G1 — 3-click rule** | every *frequent* task completes in ≤3 interactions (clicks or keystrokes). A command palette makes "anything" literally 2 keystrokes: `Ctrl+K`, type, `Enter`. Anything that cannot meet the budget gets a palette command or a shortcut, or it is redesigned. |
| **G2 — scalable components** | adding a control = adding a **data row**, not growing a function. One metadata table per region (`{type, min, max, step, unit, format, target}`), one generic renderer, handlers generated from the same row — the lesson behind why the current sidebar is 2,000 lines (§3.7 of the lessons doc). |
| **G3 — bounded render cost** | no whole-panel `innerHTML` rebuild per action. A sidebar interaction must not destroy scroll, open states or selection — therefore no 40-line restore code. Target: panel action < 4 ms, zero `updateSidebarPanel()`-style full rebuilds in the hot paths. |
| **G4 — keep what aged well** | the perf code ships unchanged: signature-keyed layer caches, scratch canvases, viewport-windowed waveforms, `content-visibility` rows, Web Worker export, undo gesture coalescing, the promise-based dialog trio. |

**Non-goals:** no feature removal; no from-scratch rewrite (37.6k lines are
migrated *by region*, behind flags, with existing behavior green throughout);
no change to Clip Lite's mobile/sheet primitive (this plan is desktop-first,
that product is mobile-first — the lessons doc already drew that line);
no docking-system port beyond what exists.

---

## 2. Current state → what the user actually feels

Each row is an anti-pattern from the lessons doc mapped to its **user-visible
symptom**, because "it takes a lot of time to do anything" is a UI cost, not
an engine cost:

| measured in `index.html` | symptom in use |
|---|---|
| `updateSidebarPanel` = 1,993-line `innerHTML` rebuild, called from 198 sites; 40+ lines restoring scroll/details/nav **because the rebuild destroyed them** | panels jump, lose place, feel sluggish after every tweak |
| `renderClips` tears down and recreates every clip node (111 call sites) | timeline hitches on small edits |
| 6 sidebar tabs + nested animation sub-tabs, each swap full-rebuilding | hunting: the feature exists but costs 4–6 clicks + scroll |
| 12 full-screen overlays/modals (export, projects, reimport, template gallery, template editor, HIC editor, AI panel, notice/confirm/name…) | every secondary task opens a world; Esc stacks are fragile (11 competing `document.onkeydown` assignments) |
| 388 inline `onclick` strings, 287 `window.*` globals, logic inside markup | slow to extend; each new control needs a global → components multiply |
| metadata scattered: effect coercion lists (~45 names), subtitle maps (~80 names), slider min/max/step inline in markup | the actual root cause of component count — the sidebar cannot be generated, so it is written |
| class-surgery state (`className` reassignment at [index.html:15007](index.html#L15007), ~12-class removal for dock states) | brittle visual state; a missed class = invisible UI |
| render = mutate (`_projectDirty = true` from renders) | speculative UI (previewing, hovering) is unsafe → features avoid previewing → more clicking |

**Verdict:** the engine is fast; the *cockpit* converts each action into
rebuilds, scrolls and dialogs. The redesign attacks conversion rate, not
speed.

---

## 3. The redesigned UI

### 3.1 Shell — four zones, one overlay host

```
┌──────────────────────────────────────────────────────────────┐
│ Topbar:  project ▾   ⟲ ⟳   ⌘K hint        [ ◉ Export ]  ?    │
├──┬─────────────────────────────────────┬─────────────────────┤
│R │                                     │ INSPECTOR           │
│a │            CANVAS / STAGE           │ contextual:         │
│i │      (selection = the center)       │ selection schema →  │
│l │                                     │ generated controls  │
│  ├─────────────────────────────────────┤                      │
│  │ TIMELINE · ruler · tracks · playhead│                      │
├──┴─────────────────────────────────────┴──────────────────────┤
│ status · click-budget badge · toasts                         │
└──────────────────────────────────────────────────────────────┘
   overlays: [palette ⌘K] [export sheet] [notice/confirm/prompt trio]
```

- **Left rail (5 modes max):** Build · Style · Motion · Media · AI. The
  current 6 tabs map as: `properties`→Build/Style context, `animations`→Motion,
  `audio_library`+`presets`→Media, `subtitles`+`markdown`→**contextual**
  (selecting the subtitle track opens subtitle controls — tabs that exist
  only for one selection type disappear into context).
- **Right inspector:** always shows *the selection*. Nothing global lives
  here except project-level sections at the bottom.
- **Bottom timeline:** stays; clip rendering becomes targeted (patch the one
  clip, lesson §3.1) instead of teardown.
- **One overlay host** for palette, export sheet, and the
  notice/confirm/prompt trio — one focus trap, one Esc stack, no 11-way
  `document.onkeydown` war (single delegated key router).

### 3.2 Command palette — how "anything" becomes 2 keystrokes

A registry: `{id, title, group, keywords, shortcut, when, run}`. Sources that
already exist are harvested into it: every menu item, every sidebar control,
every template/effect/preset (fuzzy-searchable by name), project switch,
export presets, subtitle sync, zoom/fit, theme. Rules:

1. If a feature is deeper than 3 clicks, shipping it **requires** a palette
   entry (and usually a shortcut).
2. New components register commands, not new panels (G2 extends to IA).
3. Recents and frecents float to the top — the 3rd time you use something it
   is 2 keystrokes + ↑↑.

### 3.3 Data-driven controls — the scalability fix

Per region, one table of rows; one `renderControls(rows, target)`; handlers
generated from the same row (coercion/format/commit live in the row, not in
45 hardcoded setter names). The inspector is `selectionSchema → rows`. The
sidebar stops being *written* and becomes *declared* — this is the single
change that makes "more features" not mean "more slowness" (§3.7).

### 3.4 Render model

- one dispatcher per region (lesson §2.7): `dispatch(region, state)` →
  targeted update of that region's nodes; no full-panel rebuild, so no
  scroll-restore code exists to begin with;
- state in attributes (`data-active`, `data-dock`), styled by CSS — no class
  surgery (§3.5);
- renders are pure; side effects live in named commands (§3.2), so hover/
  preview/speculative renders are safe;
- icons hydrate per inserted subtree (§3.8), keys route through one listener
  (§3.4), layout choreography uses double-rAF (§3.6);
- layout prefs persisted as data (§2.6): rail width, inspector width,
  collapsed sections, palette frecents.

### 3.5 3-click budget (audit table)

| task | today (structure) | redesigned path | budget |
|---|---|---|---|
| export video | menu → modal → fields → start | topbar **Export** → preset → start | 2 |
| apply an animation | Anim tab → subtab → scroll → click | select → **Motion** → click effect | 2 |
| find any effect/command | hunt tabs/subtabs | `⌘K` → type → `Enter` | 2 keystrokes |
| add text / shape / media | toolbar/submenu hunting | `⌘K` → "add text" → `Enter` | 2 keystrokes |
| switch project | projects modal → find → open | `⌘K` → name → `Enter` | 2 keystrokes |
| split at playhead | toolbar → split | shortcut `S` | 1 |
| subtitles on/off, edit style | tab → subtab → control | select subtitle track → inspector | 2 |
| undo/redo | buttons or `⌘Z` | unchanged | 1 |
| change a numeric property | sidebar → find slider (rebuild) | inspector slider, same row, no rebuild | 1 drag |

---

## 4. Migration phases (by region, never big-bang)

| phase | scope | acceptance |
|---|---|---|
| **P0 — foundations** | one key router; overlay host + dialog trio moved onto it; command registry + `⌘K` palette (commands harvested from existing menus) | palette exports/switches projects; Esc never steals; existing export gates green |
| **P1 — inspector** | `selectionSchema` + `renderControls` for the top-20 controls; inspector becomes contextual; kill class-surgery for its state | 3-click table rows for property tasks pass; no `updateSidebarPanel` call in inspector paths |
| **P2 — rail** | 5-mode rail replaces 6 tabs; contextual promotion of subtitles/markdown; `data-active` styling | every former tab reachable ≤2 interactions; keyboard: `1..5` switch modes |
| **P3 — timeline** | targeted clip patching (no teardown), undo coalescing verified | editing a clip no longer recreates `.clip` nodes; UI perf marks < 4 ms |
| **P4 — panels** | sidebar sub-regions converted to data tables (animations, audio, presets), scrolling lists get `content-visibility` | adding a control = one row (asserted in review); rebuild count in hot paths = 0 |
| **P5 — overlays** | remaining modals (projects, reimport, template gallery/editor, HIC editor, AI) become palette-reachable views on the one host | ≥12 overlays → 1 host + 3 primitives; click audit re-run |

Each phase keeps the existing test/export suites green (the CDP export chain
is the regression net). Instrumentation: `performance.mark` around region
dispatch, a dev-only counter for `innerHTML` full rebuilds per action — the
counter is the gate that G3 doesn't rot.

**Risks:** the 388 inline handlers must keep working during transition —
phases *wrap* them (registry shims) rather than rewrite them; palette scope
creep (ship nav/effects/export first, harvest the long tail later); and the
one thing not to copy — per the lessons doc, Clip Lite must not inherit any
of this desktop docking DNA.

---

## 5. Mockup

`studio-pro-redesign.html` (same folder, self-contained, no dependencies) is
the interactive preview: rail + contextual inspector + timeline + `⌘K`
palette + export sheet, with a **live click-budget badge** proving the table
in §3.5 — select things, use the palette, watch every task land ≤3. It is a
design mock: state is local, nothing persists, no editor code is touched.
