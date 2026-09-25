# Design Gallery — Mobile Responsiveness Plan

**Target:** `docs/html-in-canvas/designs.html` only. Companion to `DESIGNS-PAGE-REDESIGN-PLAN.md` (desktop, committed `e7e3f39`).
**Inspiration:** YouTube's native mobile app — persistent **bottom bar**, **full-width expanding search**, center **+** create button.
**Breakpoints:** `≤768px` = mobile layout; `480px` = refinements. Desktop (>768) unchanged.

**Current mobile problems** (from the 430px screenshot): the header crams brand + collapsed search + New + 2 ghost icons into ~90px; the chips row wraps awkwardly next to the segmented Studio/Community/All toggle; the New button is the only "create" affordance and sits far from the thumb.

---

## 1. Bottom navigation bar (YouTube app pattern) — `≤768px`

A fixed bottom bar replaces the header's action cluster as the primary control surface.

**Items (4):**

| Slot | Item | Behavior |
|---|---|---|
| 1 | **Home** (gallery icon) | scroll to top. **Active state**: filled `--text` icon + small pill/dot under it. This is the current tab — highlight it, like YT's "Home" while browsing the feed. |
| 2 | **Search** (magnifier icon) | opens the full-width expanding search (section 2). Never a real tab — it's an action. |
| 3 | **Create** — **center, raised**: 54px circle, `--accent` bg, white `+`, floats 6px above the bar, subtle shadow | opens the New-design flow (`#newDesignBtn.click()` — reuse the existing handler via delegation or direct call). |
| 4 | **Studio / Community toggle** — two stacked labels (YT's Subscriptions/You style): each item = icon (factory / globe) + tiny 10px label; the **active one is highlighted** (`--text` icon+label), inactive `--text-2` | switches `activeView`, mirroring the header toggle. This is where Studio/Community live on mobile per your request. |
| 4b | **All** | folded away on mobile: it's just Studio+Community combined; drop the redundant "All" from the bottom bar. All remains reachable on desktop only. |

**Placement & chrome:**
- `position:fixed; bottom:0; left:0; right:0; height:56px + safe-area` (`env(safe-area-inset-bottom)` for iPhones).
- bg `--surface` + top border `--border`; icons 24px, labels 10px, active tint `--text` (YT is white-on-dark) vs `--text-2` inactive.
- Body gets `padding-bottom:76px` (56 + breathing room) so the footer/last card is never hidden.
- Desktop: hidden (`display:none`).

**JS wiring (small):**
- The bar is static HTML (not part of `renderGrid`), so handlers are one-time: Home → `scrollTo({top:0})`; Search → `toggleSearchOverlay(true)`; Create → `newDesignBtn.click()` (reuses all existing open/validate logic); Studio/Community → set `activeView`, sync `.on` classes with the header toggle (one `setView(view)` helper extracted from the current `segToggle` click handler; both UIs call it).
- A11y: `role="navigation"`, `aria-label="Mobile navigation"`, `aria-current="true"` on the active view item, `aria-label` per item.

---

## 2. Expanding search — tap magnifier → full-width overlay (YT app pattern)

**≤768px behavior:**
- The header searchbox is **hidden** on mobile. The bottom-bar Search item opens a **search mode**:
  - Header transforms: brand + actions fade out; a full-width search pill slides in with back-arrow (closes), magnifier, and a live input focused immediately (`input.focus()` with `preventScroll`).
  - Type → `renderGrid()` reuses the existing `query` pipeline — no new filter code.
  - Recent searches could be a nice-to-have (localStorage, max 5) — **phase 2**, not needed for v1.
- Esc / back arrow / ✕ clears and exits search mode; closing with text keeps the results.
- Desktop unchanged (inline pill + `/` shortcut stays).

**Implementation notes:**
- Add a class `search-mode` on `<body>`; CSS (≤768) hides `.brand`/`.top-actions` buttons and shows the full-width pill (`.searchbox` repurposed, `flex:1`).
- JS: `toggleSearchMode(on)`; back button exits and optionally restores previous query.

---

## 3. Header simplification (≤768px)

- **Header keeps:** brand (smaller, 16px) + count; **hides:** `.btn-plus`, both `.gbtn` icons (they move to the bottom bar as Create/ghost items), and the inline searchbox (replaced by search-mode).
- The two ghost icons (Test Renderer, prompt builder) move **into the bottom bar? No** — keep bottom bar to 4 items for clean rhythm (YT uses 4–5). Instead:
  - Test Renderer + prompt-builder become **overflow items in the kebab menu** (desktop) and on mobile they're reachable via the **Create flow** (New button's existing UI already links to the prompt builder).
  - Alternative (simpler, chosen): keep them as **two small ghost icons in the mobile header** right side, at 30px — acceptable since header is now brand + 2 icons (clean, and zero new UI patterns). *(Decision: keep both as compact header ghosts.)*
- `topbar` padding drops to `10px 16px`; brand `h1` 17px.

---

## 4. Chips row on mobile

- **Tag chips and the view toggle separate:**
  - Tag chips (All/Code/Data/…) stay a **horizontal scroller** under the header (as today).
  - **Studio/Community/All toggle moves to the bottom bar** (section 1) — remove it from the chips row on mobile.
- Chip row gets `overscroll-behavior-x: contain` to avoid history-swipe conflicts.
- Active chip keeps the inverted (light-on-dark) treatment; 34px touch height on mobile (currently 30px — bump for touch).

## 5. Cards & grid (≤768px)

- 2-column grid stays (current behavior, matches screenshot); `gap:16px 10px` as committed.
- **Touch targets:** HUD buttons are hover-revealed on desktop, but **touch has no hover** — HUD must be **always visible on touch devices**. CSS `@media (hover:none)` → `.thumb-hud{opacity:1}` and keep the duration pill visible. Keep 28px buttons but expand tap area with padding.
- Card tap opens preview (unchanged); HUD buttons keep `stopPropagation` (unchanged).

## 6. Modal on small screens (already solid — verify only)

- Component already handles portrait/narrow via `.hicm-modal.portrait` + media queries; modal markup is full-height flex. **No changes** — just regression-check at 390px: open modal, tabs, Apply, close, backdrop tap.

## 7. Toast repositioning

- `#toast` sits at `bottom:26px` — it would collide with the 56px bottom bar on mobile. ≤768px: `bottom: calc(76px + env(safe-area-inset-bottom))`.

## 8. Kebab menu & cardMenu on mobile

- `#cardMenu` is `position:fixed` and opens near the button; on narrow screens ensure `max-width:calc(100vw - 24px)` and clamp to viewport: the existing openCardMenu already clamps via CSS. Verify only.

---

## 9. Implementation order

| Step | Scope |
|---|---|
| 1 | Bottom bar markup + CSS (fixed, safe-area) + `setView()` extraction + Home/Search/Create wiring |
| 2 | Search-mode: body class, full-width pill transform, focus/restore, back-arrow ✕ |
| 3 | Header simplification (hide actions, smaller brand), chips row: toggle removed from chips row on mobile + 34px touch chips |
| 4 | Touch card adaptations (`@media (hover:none)`), toast bottom offset, body padding |
| 5 | Verify at 430px, 390px, 768px; console clean; screenshots before/after |

## 10. Verification checklist

1. 430px & 390px: bottom bar visible with 4 items; Create opens the New flow; Search opens full-width search, type filters live, ✕/back exits; Home scrolls up; Studio/Community switch grids and stay in sync with... (header toggle hidden on mobile — so just bottom bar; desktop unaffected).
2. Chips scroller swipes horizontally without triggering page back-swipe; active chip inverted.
3. HUD always visible on touch (no hover dependency); kebab menu clamped in viewport; toast above bottom bar.
4. Desktop (>768): nothing changed — same header, chips, cards as `e7e3f39`.
5. Modal regression at 390px: open/Apply/close, portrait design (9:16) stays 480px portrait modal.
6. Console clean at all sizes.
