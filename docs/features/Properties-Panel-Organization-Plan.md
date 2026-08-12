# Properties Panel Reorganization Plan (CapCut-inspired)

> Status: **plan only — no code changed.** Analysis of the current panel + docking
> system, the problems found, and a phased plan to reorganize it like CapCut.

## 1. How it works today

### 1.1 The panel and its 4 docks

`#propertiesSidebar` is an `<aside>` that can dock in **4 positions**, cycled by the
dock button in its header:

| Dock | Orientation | Sizing | Resize | Content container |
|---|---|---|---|---|
| `left` / `right` | Vertical side panel | fixed width (default **320px**) | col-resize on inner edge | `flex-col` (vertical stack) |
| `top` / `bottom` | Horizontal strip | fixed height (default **256px**) | row-resize on inner edge | `flex-row flex-nowrap overflow-x-auto` (horizontal scroll) |
| `top`/`bottom` + fullWidth | App-wide strip | full width | row-resize | same horizontal scroll |

The `isHorizontal` flag used by the renderers means **"panel is docked top/bottom"**
(computed in `updateSidebarPanel` at line ~8063 and `applyInspectorLayout`).

### 1.2 Panel header

Always a horizontal 40px strip with:
- **6 global tabs**: Properties · Animations · Audio · Presets · Captions · Markdown
- Action icons: headphones (sync audio) · widen (only for top/bottom) · dock-cycle · close

### 1.3 The Properties tab (per-element cards)

When a clip is selected, Properties renders a **nav rail + accordion cards**:

- **Vertical dock** → horizontal pill nav on top (with scroll-spy) + cards stacked
  full-width, each card a `<details>` accordion (header: icon + title + chevron;
  body: `p-3` column of stacked controls).
- **Horizontal dock** → vertical icon nav rail (`w-32`) on the left + cards as
  fixed **`w-[280px]` columns** in a horizontal scroll row. In this mode the
  accordion summaries are pinned open (no chevron — the nav rail is the index).

Up to **21 possible cards** depending on clip type:
Scene · Source · Speed · Transform · Content · Typography · Spacing · Letter Styles ·
Background (text) · Shape · Crop · Mask · Color · Stroke · Extrude 3D · Blending ·
Shadow · Texture · Sound FX · PC Fonts · Google Fonts.

Audio clips get their own nav-rail card set (Load Audio · Auto-Duck · Volume Duck ·
Volume · Trim & Fades · EQ · Speed · Pitch · Reverb · Denoise · Voice Effects).
The Animations tab has its own dock-aware layout (left nav / pill sub-tabs with
Transform · Text · Custom keyframes).

### 1.4 Dock-awareness matrix (the core finding)

| Tab | Vertical dock (left/right) | Horizontal dock (top/bottom) |
|---|---|---|
| **Properties** (clip cards) | ✅ full layout | ✅ nav rail + 280px cards |
| **Animations** | ✅ | ✅ |
| **Audio clip properties** | ✅ | ✅ nav rail + cards |
| **Audio Library** (`renderAudioTab`) | ⚠️ usable | ❌ always `flex-col` — cramped vertical scroll in a 256px strip |
| **Presets** (`renderPresetsLibrary`) | ⚠️ usable | ❌ always `flex-col` |
| **Captions** (`renderSubtitlesPanel`) | ⚠️ usable | ❌ always `flex-col` |
| **Markdown** (`renderMarkdownPanel`) | ⚠️ usable | ❌ always `flex-col` |

Only the clip-property tab (and Animations / audio properties) adapts to the dock.
The four content-library tabs are hard-coded to a vertical stack, so docking the
panel top/bottom makes them nearly unusable (a 256px-tall vertical scroller).

## 2. Audit findings (problems)

1. **Inconsistent dock-awareness** — 4 of 6 tabs ignore the dock orientation
   (matrix above). This is the biggest usability gap.
2. **Card sprawl with no grouping** — up to 21 accordion cards as flat peers.
   Source, Transform, Crop, Mask, Color, Blending, Shadow, Texture, Stroke,
   Extrude are all equal nav items; nothing signals which are primary.
3. **Flat nav hierarchy** — the nav rail has no group headers or collapsible
   groups, so a video clip shows ~14 equal entries.
4. **Repeated inline markup** — every card and every control row (slider row,
   segmented chip, value chip) is hand-written per card (~21 builders). This
   causes the styling inconsistencies we keep patching (tints, spacing) and makes
   a redesign touch hundreds of lines.
5. **Header chrome doesn't adapt** — in a short 256px horizontal dock the 40px
   header + tab row eat ~25% of the height before content starts; tabs stay
   full-width text pills even when there's no room.
6. **Two ad-hoc tab levels** — panel-level tabs (6 global) plus tab-level sub-tabs
   (Captions: captions/style; Markdown: content/style; Animations: in/out/loop)
   live in different places with different styles (some under the panel header,
   some inside the tab body).
7. **Accordion state keyed by title** — `State.ui.detailsState[summary title]`
   collides across clips (e.g. a "Speed" card in a video vs an audio clip, or
   "Transform" in different tabs share open/close state).
8. **No per-property reset** — CapCut offers a small reset per control; we have
   none, so users must drag sliders back by hand.

## 3. CapCut design principles to borrow

- **Contextual tabs per selection** — CapCut shows only the tabs relevant to the
  selected element (Edit / Animation / Speed / Audio / Caption), never 20 peers.
- **Sections with tiny labels, not heavy boxes** — groups are separated by a small
  uppercase label + whitespace; controls are compact rows, not bordered cards.
- **2-column compact rows** where pairs exist (X/Y offset, width/height, blur x/y)
  — halves vertical scroll.
- **Segmented chips** for discrete options (presets, align, direction) — already
  used in places; standardize the pattern.
- **Big slider + preset chips** for continuous-but-chunky values (Speed: 0.5–4×).
- **Per-control reset** (tiny circular arrow) on anything with a non-default value.
- **Value always visible** — right-aligned chip next to the label, not hidden
  behind the thumb.

## 4. Proposed organization

### A. Group the Properties nav rail (CapCut "Edit" grouping)

Keep the accordion-card engine (it works and persists state), but introduce
**3 collapsible groups** in the nav:

1. **Transform** — Transform · Crop · Mask
2. **Appearance** — Color · Blending · Shadow · Texture · Stroke · Extrude 3D ·
   Background (text) · Letter Styles
3. **Media** — Source · Content/Typography/Spacing/Fonts (text) · Shape ·
   Speed · Sound FX

Group headers are tiny uppercase labels; groups collapse to a single row when the
user hides them. Nav items get a subtle **primary/secondary weight** (Transform +
Speed primary; the rest lighter). In vertical dock the groups become an
expandable section list; in horizontal dock they stay as group headers in the rail.

### B. Make every tab dock-aware (fix the matrix)

Give Captions, Markdown, Presets, and Audio Library the same two-mode treatment the
Properties tab already has, reusing the `isHorizontal` pattern:

- **Vertical dock** → current vertical layout (unchanged).
- **Horizontal dock** → a left icon rail (or a sticky top chip bar) + content as
  `w-[280px]`-ish scroll columns, exactly like the Properties cards. For Captions
  and Markdown this means wrapping each section (Generate, List, Style…) as a
  column instead of one long scroll.
- Shared helper `dockClasses()` returns the right container classes for the
  current dock so the four tabs stop hard-coding `flex flex-col`.

### C. Extract shared builders (kills the duplication)

Introduce small builder helpers and migrate cards incrementally:

- `card({ id, icon, title, body, open })` — the `<details>` wrapper with the
  correct dock-aware classes.
- `propRow(label, controlHtml, valueHtml)` — the label + control + right-aligned
  value row used by every slider.
- `segmented(options, active, onChange)` — the chip strip.
- `toggleRow(label, hint, checked, onChange)` — switch rows (Fast Mode style).

Migrating one card at a time (Transform first, then Color/Blending/Shadow) lets
each migration be verified without rewriting all 21 at once. This is also the
foundation for CapCut's compact styling.

### D. Compact control styling (CapCut density)

- Slider rows: label left (10px bold, muted), value chip right — already the
  pattern; standardize spacing (`gap-1.5`, consistent paddings).
- Pairs go 2-column (`X / Y`, `W / H`, `Blur X / Y`).
- Segmented chips and toggles get the unified chip styling used in Captions.
- Per-row **reset** button appears when the value ≠ default.

### E. Header & tab-level cleanup

- When the panel is horizontal (short), collapse the 6 panel tabs to **icon-only**
  pills with tooltips so the header stays ~40px and content keeps the space.
- Standardize **sub-tab placement**: every tab with sub-tabs (Captions, Markdown,
  Animations) shows its sub-tabs as a slim chip bar directly under the panel
  header, identical styling, so the two-level pattern is consistent.
- Fix accordion-state keying: key by card `id` (or a `data-key`), not the summary
  title, so video/audio "Speed" cards stop sharing state.

## 5. Phased implementation plan

| Phase | Scope | Files | Risk | Est. |
|---|---|---|---|---|
| **1 — Dock-aware libraries** | Make Captions, Markdown, Presets, Audio Library render the horizontal-card mode when docked top/bottom; add `dockClasses()` helper | `index.html` | Low | ½–1 day |
| **2 — Shared builders + compact rows** | Add `card()`, `propRow()`, `segmented()`, `toggleRow()`; migrate Transform + Color + Blending + Shadow cards to them with CapCut-density styling (2-col pairs, resets) | `index.html`, `src/styles/style.css` | Medium | 1–2 days |
| **3 — Grouped nav rail** | 3 collapsible groups in the Properties nav, primary/secondary weights | `index.html` | Low–Med | ½ day |
| **4 — Header & chrome** | Icon-only panel tabs in horizontal dock; standardized sub-tab chip bar; details-state keying fix | `index.html` | Low | ½ day |
| **5 — (optional) migrate remaining cards** | SFX, Speed, Typography, Fonts, Audio cards onto the builders | `index.html` | Medium | 1–2 days |

**Verify each phase** in the live preview: select a video, image, text, shape and
audio clip in **all 4 docks**; check nav scroll-spy, accordion persistence across
clip switches, and that Captions/Markdown/Presets stay usable in the horizontal
dock.

## 6. Decisions to confirm before implementing

1. **Keep the 6 global tabs**, or move Audio Library + Presets out of the panel
   (CapCut opens media libraries in their own dock)? Keeping them is less work and
   preserves the current muscle memory.
2. **Default dock** — CapCut is always a right-side panel. Should the editor
   default to `right` instead of the current `left`, or keep user's saved layout?
3. **Grouping names** — ok with Transform / Appearance / Media, or prefer
   CapCut-style (Adjust / Effects / Audio)?
4. **How far to push compactness** — 2-column sliders everywhere can make narrow
   cards feel tight; the plan assumes 280px cards stay the horizontal minimum.
