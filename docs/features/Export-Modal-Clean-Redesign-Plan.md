# Export Modal — Clean Redesign Plan

> **Date:** 2026-08-17
> **Status:** Plan — no code yet
> **Scope:** `index.html` export modal markup only (settings card ~index.html:116–425, progress card ~425–470, success card ~470+). Pure Tailwind utility classes — no dedicated modal CSS exists (global 6 px scrollbar styling is in `src/styles/style.css:49–54`).
> **Trigger:** user screenshot — the Fast (FTRT) tab's Compare probe pushes the card past the viewport, the footer buttons clip ("partially visible"), and the dense single-column stack of tiny labels reads poorly.

---

## 1. What's wrong today (screenshot + markup)

| # | Problem | Evidence in code |
|---|---|---|
| 1 | **Modal clips its footer on tall content** — no scrolling anywhere in the chain | `exportOverlay` is `items-center justify-center` with **no `overflow-y-auto`**; settings card is `max-w-md w-full` with **no `max-h`**; the FTRT tab's Compare block (`exportGroup-ftrt` ~index.html:235–290) makes the card taller than the viewport → `Cancel` / `Start Export` get cut off |
| 2 | **Too narrow for the content it carries** | `max-w-md` = 448 px; the Compare result rows wrap mid-line (`Standard (MediaBunny) 30.0s wall · 1.00× real-time · 22.0 fps`) |
| 3 | **Inconsistent section treatment** — some sections are boxed (Compare box, Fast-Mode row, custom-range box), most are bare label + grid floating in `space-y-6` | Resolution (`exportResolutionSection` ~index.html:318), Frame Rate (`exportFpsSection` ~334), Duration Scope (~394) are unboxed; Compare box (~235) is boxed |
| 4 | **Tiny, low-contrast labels everywhere** | `text-[10px]`/`text-[11px]` uppercase section labels, `text-[10px] opacity-75` card subtitles — below comfortable reading size |
| 5 | **Weak responsiveness** — grids don't collapse, tabs degrade to cryptic initials | `grid-cols-2`/`grid-cols-3` are fixed; tab labels collapse to `Std` / `MB` / `F` / `A` via `hidden sm:inline` |
| 6 | **Compare row alignment is fragile** | `flex items-center justify-between` with a `font-mono` value that wraps and misaligns under the label |
| 7 | **Stale help text** | FTRT note (~index.html:290) still says *"Start Export uses the Fast (FTRT) pipeline; MediaBunny stays available on its own tab. Video clips export in real time (1×) until the M1b frame pool."* — M1b shipped; M1c is the current state. Also the old line *"Full FTRT export lands next"* in the note text under the probe results |
| 8 | **"Fast Mode" toggle sits inside the Frame Rate section** but it's a render-mode option, and its row is another inconsistent box | `exportFastMode` label row ~index.html:364–370 |
| 9 | **Progress card is narrower than the settings card** (`max-w-sm` vs `max-w-md`) — visual jump when switching views | `exportProgress` ~index.html:425 |

## 2. Design principles (matching the app's CapCut-flat language)

- **One consistent container grammar:** every setting group lives in the same boxed container the Compare block uses today — `rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50` — with a uniform section header (`text-[11px] font-bold uppercase tracking-widest`).
- **Never clip, never scroll the page:** the overlay scrolls; the card is capped at a viewport-safe height.
- **Two-column density on wider screens, one column on phones** — resolution + fps side by side on `sm+`; the Compare box full-width below.
- **Text floors:** nothing below 11 px for body/captions, 12 px minimum for interactive labels; mono values get `tabular-nums` so digits align.
- **A sticky footer** so `Cancel` / `Start Export` are always visible even when the body scrolls.

## 3. Redesign spec

### 3.1 Sizing & scroll behavior (fixes #1, #2, #9)

```
exportOverlay:  items-center justify-center  →  overflow-y-auto py-6 [sm:py-8] items-start
                (keep flex-col; add "my-auto" trick: a h-full flex wrapper so the card
                 centers when it fits and top-aligns + scrolls when it doesn't)
exportSettings: max-w-md  →  w-full max-w-xl
                add: max-h-[calc(100dvh-3rem)] flex flex-col
                body wrapper: overflow-y-auto pr-1 (uses the global 6px scrollbar)
                footer: sticky bottom-0 with a surface/backdrop blur so buttons stay visible
exportProgress: max-w-sm → max-w-md (match the settings card)
```

### 3.2 Grouped, boxed sections (fixes #3, #8)

The `space-y-6` flat stack becomes `space-y-4` over **five boxed groups** (+ the tab row):

1. **Format** — the tab bar (`exportTab-*`) keeps its segmented look; active tab keeps the brand ring; labels: keep full names on `sm+`, but replace cryptic initials with **icons-only** below `sm` (`span.hidden sm:inline` stays for text, no `Std/MB/F/A`).
2. **Container — Compare (FTRT tab only)** — already boxed; tighten internally (see 3.4).
3. **Container — Resolution** — box wraps the existing 3 cards; cards keep `text-center`, bump subtitle `text-[10px] → text-[11px]`.
4. **Container — Frame rate** — box wraps the 3×2 grid + the Custom input; move **Fast Mode** toggle into its own **row inside this box** (label "Fast Mode — Skip safety delays", same switch) OR promote it to a standalone boxed row between Frame rate and Duration — decide in implementation, keep it visually a sibling of the boxes, never nested under a bare label.
5. **Container — Duration scope** — box wraps the radio row + the custom-range inputs; on `sm+` keep the two inputs side-by-side, stack on phones.

The GPU-recommendation pill and browser-warning pill stay **below** the boxes, above the footer (they're already compact pills — keep as-is).

### 3.3 Responsive matrix

| Breakpoint | Tabs | Format cards | Res cards | FPS grid | Duration inputs | Compare row |
|---|---|---|---|---|---|---|
| `< 400 px` | icons only | 2 cols | 3 cols (keep, small) | 3 cols × 2 rows | stack 1 col | stack: label above controls |
| `400–639` | icons + short label | 2 cols | 3 cols | 3 cols × 2 rows | 2 cols | label above controls |
| `sm (640) +` | full labels | 2 cols | 3 cols | 3 cols × 2 rows | 2 cols | label + controls in one row |

### 3.4 Compare result block (fixes #4, #6)

- Row layout: `flex items-baseline justify-between gap-3` — label `shrink-0`, value `text-right font-mono tabular-nums whitespace-nowrap`.
- Split the value into **two lines per mode** when narrow (`< sm`): line 1 `30.0s wall`, line 2 `1.00× · 22.0 fps` — implemented as a small `flex-col sm:flex-row` value container, so it never wraps mid-unit.
- The speedup banner (`ftrtSpeedup`) keeps the brand tint; add `tabular-nums`.
- **Stale-text cleanup (#7):** replace the FTRT note with the current truth: *"Capture-only benchmark — the encoder adds the same overhead to both modes. Start Export uses the Fast (FTRT) pipeline; MediaBunny stays on its own tab. Video exports at capture speed (M1c work in progress)."* — or drop the parenthetical entirely and keep it short.

### 3.5 Typography & states (fixes #4)

- Section headers: `text-xs` (12 px) consistently (today mixes `text-xs` and `text-[10px]`).
- Card subtitles (`opacity-75`/`opacity-70`): `text-[11px]` + `text-surface-500 dark:text-surface-400` for readable contrast (no bare opacity).
- Selected card state stays the brand ring + tint (`bg-brand-500/10 ring-1 ring-inset ring-brand-500/50`) — already consistent across resolution/fps/format cards; make the **unselected** state uniform too (`border-surface-200 dark:border-surface-700` everywhere — already true).
- Inputs: unify `font-mono text-sm` for number fields (today mixes `text-xs` and `text-sm`), `tabular-nums`.

### 3.6 Footer

- `sticky bottom-0 -mx-1 px-1 pt-3 mt-4 bg-white dark:bg-surface-800/95 backdrop-blur-sm border-t border-surface-100 dark:border-surface-700` — Cancel (outline) + Start Export (brand, unchanged) always reachable.

## 4. Concrete change list (index.html only)

1. `exportOverlay` (~line 116) — add `overflow-y-auto`, `py-6 sm:py-8`, wrap card in a full-height flex shim.
2. `exportSettings` (~line 119) — `max-w-xl`, `max-h-[calc(100dvh-3rem)]`, `flex flex-col`; wrap the `space-y-6` body in a scrollable div; make footer sticky.
3. Tab labels (~lines 130–146) — drop `Std/MB/F/A` initials; icons-only below `sm`.
4. Wrap Resolution / Frame-rate / Duration-scope sections in the standard box container; move Fast-Mode row into the fps box.
5. FTRT note text (~line 290) — update stale M1 wording.
6. Compare result rows (~lines 250–270) — baseline alignment + `tabular-nums` + narrow-mode stacked value.
7. `exportProgress` (~line 425) — `max-w-sm` → `max-w-md`.
8. Typography pass — 10 px → 11 px/12 px per §3.5, unify input sizes, `tabular-nums` on all mono values.
9. `lucide.createIcons()` refresh is automatic on open (`switchExportTab`/`openExportModal`) — no JS change expected; verify icons render after re-render.

**No JS behavior changes** — every element id and `onclick` handler stays; this is a class-only refactor (plus the note text).

## 5. Phases & acceptance criteria

| Phase | Work | Done when |
|---|---|---|
| **A. Structure** ✅ done (2026-08-17) | Overlay scroll + card `max-w-xl`/`max-h` + sticky footer + progress-card width match | Verified live: overlay `overflow-y:auto`, card 576 px max-w / `calc(100dvh-6rem)` max-h, footer `position:sticky` pinned and visible at scroll-bottom, card `m-auto`-centered, progress card 448 px, build passes. Minor: footer border sits ~24 px above the card's bottom edge and 8 px short on the right under the scrollbar gutter — cosmetic (same bg below/behind), revisit in Phase C if it bothers |
| **B. Grouping** ✅ done (2026-08-17) | Box the three sections; move Fast-Mode row; uniform headers | Verified live: Resolution / Frame Rate / Duration Scope all wrapped in the standard box (`p-3 rounded-lg border bg-surface-50 dark:bg-surface-900/50`); Fast-Mode demoted to a divider row (`mt-3 pt-3 border-t`) inside the FPS box; custom-range inputs moved inside the Duration box as a divider section; DOM nesting + build pass; screenshot confirms rhythm |
| **C. Readability** | Typography floors, `tabular-nums`, Compare row restructure, note text update | No text below 11 px in the modal; Compare values never wrap mid-unit; stale M1b wording gone |
| **D. Responsive** | Breakpoint matrix pass (icons-only tabs, stacked Compare value, stacked duration inputs) | At 360 px and 400 px widths every control is reachable and no horizontal overflow; at `sm+` the two-column rhythm holds |

**Acceptance (overall):**
- [ ] `openExportModal()` + `switchExportTab('ftrt')` shows all controls and the full footer at 1366×768 and 1280×720, no scrollbar on the page body (only inside the card).
- [ ] At 360–400 px: no horizontal scroll, tabs are icon-only, Compare rows stack cleanly.
- [ ] Export still works end-to-end from the modal (MP4 via Fast and MediaBunny, GIF, audio) — regression: `submitExport` reads the same ids.
- [ ] Dark + light themes both pass a contrast skim (labels `surface-500 dark:surface-300`+).
- [ ] `npm run build` passes; no console errors on open/switch/export.

## 6. Out of scope

- The success card's video player, the progress card's internals (only width changes).
- Moving export settings into a multi-step wizard.
- Any JS/logic refactor — ids and handlers are sacred this pass.
