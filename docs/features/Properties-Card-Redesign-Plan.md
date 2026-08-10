# Properties Card Redesign — density & CapCut-style layout

**Status:** plan (not implemented)
**File affected:** `index.html` (shared `propCard` / `propRow` builders + a few hand-rolled cards) and possibly `src/styles/style.css`
**Measured on the live editor (Aug 2026):** Basic tab, text clip, vertical dock

---

## 1. The problem — quantified

| Metric | Value |
|---|---|
| Cards in Basic tab (text clip) | 5 (Transform, Opacity, Content, Typography, Spacing) |
| Total content height | **1,383 px** |
| Visible viewport | 698 px |
| Scroll overflow | **198 %** — the user scrolls ~2 full screens to see one tab's controls |
| Card heights | Transform 297 · Content 331 · Spacing 242 · Typography 197 · Opacity 188 |

Even after the 4-tab split, a single tab is a long scroll. The culprit is **chrome, not controls**:

| Chrome item (per card) | Height cost |
|---|---|
| Header (`p-3` + `text-sm` + icon + chevron + border-b) | ~45 px |
| Body padding (`p-3` top + bottom) | 24 px |
| Row gap (`gap-2.5` = 10 px between rows) | ~10 px × rows |
| Value chip (`px-2 py-0.5` + border + shadow) | ~21 px per row |
| Label row margin (`mb-1.5`) | 6 px per row |

For 5 cards ≈ 11 rows: ~445 px of chrome vs ~460 px of controls — **the chrome eats nearly half the panel**.

---

## 2. Current card anatomy (for reference)

`propCard` (line ~8146):
```
<details class="group relative bg-white dark:bg-surface-800 border
        border-surface-300 dark:border-surface-700 shadow-sm rounded-lg
        overflow-hidden flex flex-col">          ← boxed card chrome
    <summary class="p-3 ... border-b">
        <i class="w-4 h-4"/> Title  <chevron w-4 h-4>
    </summary>
    <div class="p-3 flex flex-col gap-2.5 bg-surface-50 ...">  ← padded body
        propRow rows (label + value chip + input)
    </div>
</details>
```

`propRow`: label row (`mb-1.5`, 10 px uppercase label + value chip) over the input.

The boxed-card language (border, rounded corners, shadow, background, padded header)
comes from the earlier CapCut-density pass — but the padding/gaps/chips are still loose.

---

## 3. CapCut inspiration — how they kill scroll

CapCut's property panel (video clip → Adjust) is a **single continuous sheet**:

- **No per-section card boxes** — thin section dividers, not bordered cards. The panel reads
  as one scrollable form, so there's no chrome repetition.
- **Dense rows (~28–32 px)** — the label and slider share one line (label left, slider
  right/fill); no value chip, no stacked label-over-slider.
- **First section open, the rest collapsed** — you land on Transform; everything else is a
  one-line header until clicked.
- **Inline section jump** — the tab bar itself is the navigation; long sections get compact
  sub-headers.

The takeaway for us: **de-card the chrome, tighten the rows, collapse the long tail.**

---

## 4. Options

### Option A — Density pass (keep the card look) · ~45 min

Shrink the chrome without changing the structure:

- `summary` `p-3` → `px-2.5 py-2` (saves ~8 px/card) · title `text-sm` → `text-[13px]` ·
  icon `w-4` → `w-3.5`
- Body `p-3` → `p-2.5`, `gap-2.5` → `gap-2`
- Value chip: drop `border` + `shadow-sm`, `px-2 py-0.5` → `px-1.5 py-px` (flat, ~4 px/row)
- Label `mb-1.5` → `mb-1`; label row to `text-[9px]`

**Result (est):** Basic tab 1,383 → ~1,100 px (≈ −20 %). Cards keep their boxed identity.

**Measured (implemented, not committed):** Basic tab (text clip) 1,383 → **1,151 px (≈ −16.8 %)**

| Card | Before | After |
|---|---|---|
| Transform | ~300 | 263 |
| Opacity & Blending | ~200 | 160 |
| Text Content | ~315 | 279 |
| Typography | ~200 | 165 |
| Sizing & Spacing | ~230 | 212 |
| **Container scrollHeight** | **1,383** | **1,151** |

What landed (all scoped to `updateSidebarPanel`, lines 8022–10622):

- Card `summary` `p-3` → `px-3 py-2` on the shared `propCard` + 13 hand-rolled cards;
  header `rightSlot` overlays re-pinned `h-11` → `h-9` (a11y Phase 3 pattern kept intact)
- Card bodies `p-3` → `px-3 py-2`, `gap-2.5/3` → `gap-2` (incl. the audio Trim & Fades card)
- Label/row margins `mb-1.5` → `mb-1`; value chip `px-2 py-0.5` → `px-1.5 py-px`;
  color swatch rows `p-1.5` → `p-1`
- Selects `p-2` → `py-1.5 px-2` (9 property selects); math-mode toggle rows `py-1` → `py-0.5`;
  Align & Flip divider `mt-2 pt-2` → `mt-1.5 pt-1.5`; Text Content textarea `h-20` → `h-16`
- **Container** `p-4 gap-6` → `p-3 gap-3` (the 24 px inter-card gap was the single biggest
  hidden cost — 96 px of the old total)

Verified live: slider drags still update, accordions collapse, both docks render (horizontal
cards 280 × ~191, all open), `vite build` ✓, console clean. Gap to the −20 % target is the
boxed chrome itself (borders + header band + shadow) — that's exactly what Option B strips.

### Option B — Flat section headers (recommended) · 1–1.5 h

De-card the chrome while keeping the accordion + state logic:

- `details`: drop `border`, `shadow-sm`, `rounded-lg`, `bg-white` — body keeps a subtle
  `bg-surface-50 dark:bg-surface-900/50` so sections still read as grouped
- `summary`: becomes a slim divider row — `px-1 py-1.5`, `text-[10px] uppercase tracking-widest
  text-surface-400`, no background, no border-b (or a hairline only), icon `w-3 h-3`
- Body: `p-2` (top padding only), `gap-1.5`
- Value chip → inline text next to the label (no chip box), CapCut-style
- Apply to the shared `propCard`/`propRow` builders → every migrated card changes at once;
  hand-rolled cards (Background, Letter Styles, audio panel) get the same treatment in a
  second pass

**Result (est):** Basic tab 1,383 → ~900 px (≈ −35 %), and the panel visually reads as one
CapCut-style property sheet. Works in both docks (horizontal cards stay 280 px wide but
shorter).

### Option C — Property sheet + jump chips (bold) · 2–3 h

Everything in B, plus two scroll-killers:

1. **Jump chips** — a compact second row under the sub-tab bar listing the current tab's
   cards (`Transform · Crop · Opacity · Speed`), each a tiny pill that scrolls that card
   into view (reuses `scrollToPropertyCard`). Instant navigation, no scrolling. In the
   horizontal dock these become a vertical mini-rail.
2. **Search/filter** — a small input at the top of the panel that filters rows by label
   (CapCut lacks it, but Figma/Canva properties have it and it's the ultimate scroll-killer
   for power users). Hide rows that don't match; show a "no matches" hint.

**Result:** scrolling becomes optional — jump chips for known targets, search for fuzzy ones.

---

## 5. Recommended pitch

**Ship Option B now, then Option C's jump chips as a fast follow.**

- B gives the biggest win per effort (−35 % height, CapCut look) and touches only the shared
  builders, so it lands in one pass with zero logic changes.
- Jump chips are a small, independent addition (a `map` over the group's card ids + the
  existing `scrollToPropertyCard`) that makes the remaining scroll painless — and they
  double as a "what's in this tab" overview.
- Search (C) can wait until the design settles.

Also worth bundling with B: **collapse-by-default for non-primary cards** — only the first
card (Transform) renders `open`; the rest start collapsed as slim header rows, cutting the
initial paint scroll in half. The `detailsState` restore (which now force-opens in horizontal
docks) already handles per-card state.

---

## 6. Implementation steps (Option B)

1. `propCard` (~8146): strip card chrome from `details`; slim `summary` to a divider row;
   body `p-2 gap-1.5`.
2. `propRow` (~8174): value chip → inline text; `mb-1.5` → `mb-1`.
3. `propSlider` / `colorRow` / `propSwitch` / `toggleRow` (~8190+): tighten paddings to match.
4. Hand-rolled cards (text Background ~8688, Letter Styles ~8564, audio accordion ~9300,
   markdown fx groups ~15822): apply the same header/body classes.
5. Keep the accordion, `detailsState` restore, `rightSlot` absolute overlay, and both-dock
   logic untouched.
6. Horizontal dock: verify 280 px cards stay legible at the tighter density.

**Effort:** ~1–1.5 h, mostly class-string edits. Jump chips: +~30 min.

---

## 7. Risks / gotchas

- **Don't touch the toggle-in-header positioning** — the `rightSlot` absolute overlay
  (`top-0 h-11`, from the a11y Phase 3 fix) must still line up with the slimmer header;
  re-verify the vertical-centering offset after changing the summary padding.
- **`detailsState` restore** — keep the horizontal-dock force-open (a2edeca) intact; the
  collapse-by-default idea must only apply to the *initial* render, never override the
  user's saved state.
- **Density ≠ cramped** — keep ≥ 24 px touch targets for sliders and ≥ 28 px header height;
  CapCut's density works because its rows are simple, not because they're tiny.
- **Value chips are informational** (show current value while dragging) — if they become
  inline text, make sure the `oninput` updates still write to the right span (the existing
  handlers reference `this.previousElementSibling.querySelector(...)` — changing the DOM
  shape breaks them; update selectors in the same pass).
- **Both docks** — vertical gains the most; horizontal cards are width-bound (280 px), so
  verify rows don't wrap at the tighter gap.
