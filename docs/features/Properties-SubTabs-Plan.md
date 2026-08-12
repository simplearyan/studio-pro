# Properties Sub-Tabs Plan (CapCut-style Transform / Appearance / Media)

> Status: **plan only — no code changed.** Proposal to turn the Properties tab's
> grouped nav (Phase 3) into true filter sub-tabs: the user picks a group and
> *only that group's cards render* — like CapCut's "Edit / Animation / Speed"
> contextual tabs, and like our own ANIMATIONS tab's In/Out/Loop sub-tabs.

## 1. Goal

Today the Properties tab shows **all** ~21 accordion cards in one scrollable list,
with a nav (pill bar in the vertical dock, rail in the horizontal dock) that
groups them under Transform / Appearance / Media headers and scrolls to the
clicked card. The user wants the CapCut model instead:

- A **sub-tab bar** at the top: `Transform | Appearance | Media`
- Selecting **Transform** → only the Transform cards render (Transform, Crop, Mask)
- Selecting **Appearance** → only Appearance cards render (Color, Stroke, Blending, Shadow, Texture, Extrude…)
- Selecting **Media** → only Media cards render (Source, Speed, Typography, SFX…)
- Groups with **no cards for the current clip type are hidden** (e.g. a text clip has no Source/Speed)

Clean, contextual, less scroll — the flat 21-card sprawl becomes three focused
sections.

## 2. How it works today (the parts this plan touches)

All in `index.html` inside `updateSidebarPanel()`:

| Piece | Location | What it does |
|---|---|---|
| `navGroupOf` map | ~L10525 | card id → group (`transform` / `appearance` / `media`) |
| `navGroups` | ~L10533 | the 3 group headers + their filtered items (already drops empty groups) |
| `#propertiesLayoutNav` | ~L10558 | pill bar (vertical dock) / icon rail (horizontal dock); group headers are `toggleNavGroup` collapse toggles, items are `scrollToPropertyCard` buttons with scroll-spy |
| `#propertiesCardContainer` | ~L10591 | **all** cards rendered in fixed order, one scrollable list |
| `updateActivePropertyNav` / `scrollNavBtnIntoView` | ~L2465 | scroll-spy highlight on the nav item |
| accordion state | `State.ui.detailsState[summaryTitle]` (L7989, L10607) | open/close persistence, **keyed by summary text** — collides across cards sharing a title (video "Speed" vs audio "Speed") |
| ANIMATIONS sub-tab pattern | `subTabSwitcher` + `State.activeAnimMainTab` (L9733–9804) | the existing CapCut-style segmented chip bar to reuse |

The Phase 3 groups already give us the group→items mapping; this plan promotes
those groups from **navigation** into **filtering**.

## 3. Proposed design

### 3.1 New state

```
State.activePropGroup      // 'transform' | 'appearance' | 'media' (default 'transform')
```

Persisted in `State.ui` like `navGroups`. If the active group has **no cards** for
the selected clip type, fall back to the first non-empty group (same filtering the
`navGroups` array already does today). No auto-jump otherwise — respect the user's
choice when switching between clips.

### 3.2 The sub-tab bar

Reuse the ANIMATIONS `subTabSwitcher` segmented-chip styling (`bg-surface-100 …
p-1 rounded-xl border`, active = white pill + shadow via `activeSubTabClass`), so
the app speaks one sub-tab language. Three chips: **Transform / Appearance / Media**
(icons: move / palette / film), hidden when their group is empty for the clip type.
Sits pinned at the top of the Properties body, directly under the panel header —
the same position Captions/Markdown put their sub-tabs.

A new `setPropGroup(key)` handler sets `State.activePropGroup` and re-renders.

### 3.3 Card filtering — the core change

Two ways to filter; **recommend B**:

- **A. Visibility toggle:** keep rendering every card but wrap each group's cards
  in `<div data-group="…">` containers and toggle `hidden`. Cheapest, but keeps
  dead DOM and keeps building all 21 cards' HTML every render.
- **B. Conditional render (recommended):** build `cardsHtml` from only the active
  group's card builders (the HTML string concatenation already gates most cards on
  clip type — just gate on `groupOf(cardId) === activePropGroup` too). Only the
  visible cards exist in the DOM. Simpler scroll behavior, smaller re-render cost.

Ordering within a group follows today's render order (e.g. Appearance: Color →
Stroke → Extrude → Blending → Shadow → Texture → fonts).

### 3.4 What happens to the nav rail / pill bar

**Recommend Option A: remove the per-item nav entirely** (CapCut has none).

- Vertical dock: sub-tab chips + filtered card list. The pill bar with its 21 item
  pills is deleted.
- Horizontal dock: the left `w-32` rail becomes the **sub-tab selector** (3 chips
  stacked), and only the active group's cards render as 280px columns. Rail keeps
  its purpose, cards lose nothing.

**Option B (fallback):** keep a per-group item list under the sub-tabs (two-level:
sub-tab filters, items scroll). More chrome, more clicks; only if the user wants
direct one-click access to e.g. "Mask" without scrolling the group.

Removing the nav also removes the scroll-spy machinery (`updateActivePropertyNav`,
`scrollNavBtnIntoView`, the horizontal scroll-spy `setTimeout`, `navBtn_*` ids,
`navScrollTop` restore) — deleting dead code instead of leaving it half-wired.

### 3.5 Accordion persistence (must-do before shipping filtering)

`State.ui.detailsState` is keyed by **summary title**; switching sub-tabs unmounts
cards, so every switch would re-read title-keyed state and cards would lose their
open/close position — and the known video/audio "Speed" title collision gets worse.
Fix: key by **card id** (`detailsState[cardId]`) at save (L7989) and restore
(L10607), with a one-time migration of existing title keys → card ids. This also
closes plan finding #7 from `Properties-Panel-Organization-Plan.md`.

### 3.6 Save Preset button

Currently the last item in the nav. Move it to the **right end of the sub-tab bar**
as an icon button (heart), or a slim footer row under the cards. Recommend the
sub-tab bar slot so it stays one click away in both docks.

## 4. Phased implementation

| Phase | Scope | Risk | Est. |
|---|---|---|---|
| **1 — Vertical dock filtering** | `State.activePropGroup` + `setPropGroup`; sub-tab chips (ANIMATIONS styles); conditional `cardsHtml` per group; hide empty groups; keep the old nav visible for now (parallel, no deletion) | Low | ½ day |
| **2 — Horizontal dock** | rail becomes sub-tab selector (3 chips), filtered 280px columns | Low–Med | ½ day |
| **3 — Nav removal & cleanup** | delete pill bar/rail items + scroll-spy + `navBtn_*` + `navScrollTop` restore; move Save Preset into the sub-tab bar | Med | ½ day |
| **4 — Accordion keying fix** | save/restore by card id + migration; verify open/close survives sub-tab switches and clip switches | Med | ½ day |
| **5 — Polish & verify** | auto-fallback to first non-empty group; remember selection; all 4 docks × video/image/text/shape/audio/scene clips; build + console clean | Low | ½ day |

Order matters: do **Phase 4 before/with Phase 1** if shipping filtering early, so
accordion state doesn't glitch on the first sub-tab switch.

## 5. What stays untouched

- The card builders (Phase 2/4 migration) — only the container wiring changes.
- `toggleNavGroup` collapse: no longer needed (sub-tabs replace collapse), removed
  with the nav — or kept as a "collapse all" on the sub-tab bar if wanted.
- Clip-type gating (`isText`, `isShape`, `isImageOrVideo`…) — unchanged; the
  `navGroupOf` mapping already assigns every card a group.

## 6. Risks / gotchas

1. **Accordion state loss across sub-tab switches** if the title-keyed keying isn't
   fixed first (Phase 4). This is the #1 reason to sequence carefully.
2. **Losing one-click access** to a specific card (e.g. straight to "Mask"). CapCut
   accepts this; Option B exists if the user doesn't.
3. **Dead scroll-spy code**: if removed, make sure nothing else calls
   `updateActivePropertyNav` / `scrollNavBtnIntoView` (the horizontal scroll-spy
   timer at ~L10210 and the nav restore at ~L10614 reference `propertiesLayoutNav`).
4. **Empty groups**: a video clip has no Texture/Extrude (text-only) — sub-tab bar
   must filter per clip type, or users land on an empty section.
5. **Render cost**: conditional rendering (3.3-B) builds only ~7 cards per group
   instead of ~21 — a win, but verify the details-state restore loop still runs
   over the smaller `details` set correctly.

## 7. Verification checklist (after implementation)

- [ ] Video clip: Transform shows Transform/Crop/Mask only; Appearance shows
      Color/Stroke/Blending/Shadow; Media shows Source/Speed. No empty groups.
- [ ] Text clip: Appearance shows Color/Stroke/Extrude/Texture/fonts; Media shows
      Typography/Spacing/SFX; Transform shows Transform/Crop/Mask.
- [ ] Sub-tab switch preserves each card's open/close state (Phase 4).
- [ ] Both docks: chips (vertical) / rail (horizontal) switch groups; cards render
      280px columns in horizontal.
- [ ] Switching clips while on a group the new clip lacks → falls back to first
      non-empty group.
- [ ] Save Preset reachable from both docks.
- [ ] `vite build` clean, console clean, no `ReferenceError` on removed nav helpers.

## 8. Decisions to confirm

1. **Remove the per-item nav entirely (Option A)** vs keep a two-level list (B)?
2. **Horizontal dock**: sub-tabs as the left rail, or a top chip bar with the
   cards below it?
3. **Save Preset**: sub-tab bar icon vs a slim footer row?
4. **Selection memory**: remember the last group globally, or per clip type
   (remember you were on Appearance for text clips but Media for audio)?
