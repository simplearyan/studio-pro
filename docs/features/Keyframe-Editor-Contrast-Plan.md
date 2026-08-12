# Keyframe Editor — Color & Contrast Fix Plan

**Status:** Plan (not implemented)
**Area:** Animations tab → **Custom** (keyframe editor), `renderCustomKeyframeEditor` in `index.html`
**Date:** Aug 2026

---

## 1. The problem

When a user enables keyframing on a property (clicks the diamond on a row in the
**Custom Keyframes** editor), the row switches to the "keyframed" style — and in
**dark mode** the colors fall apart:

- The property name, value and keyframe-count text become hard to read.
- The **Add keyframe** button text is nearly invisible.
- The active (keyframing-on) diamond icon almost disappears.

Measured live (dark / vscode-dark theme, keyframed row, WCAG contrast ratios):

| Element | Color | Contrast vs row bg | Verdict |
|---|---|---|---|
| Property name (11px) | `surface-300` #a3a3a3 | **2.38 : 1** | ✗ fails (needs 4.5:1) |
| Value (10px mono) | `surface-300` | **2.38 : 1** | ✗ fails |
| Keyframe count (9px) | `surface-300` | **2.38 : 1** | ✗ fails |
| "Add" button text (9px) | `surface-500` #666666 | **1.05 : 1** | ✗ invisible |
| Diamond toggle (active) | `brand-500` #6366f1 | **1.35 : 1** | ✗ invisible |
| "Delete" chip (active) | `brand-400` on `brand-500/10` | **~1.8 : 1** | ✗ fails |

Light mode is mostly fine (name 16:1, value 9:1, Add 5.6:1) — the fixes below are
dark-mode focused, with one light-mode border bug to fix too.

---

## 2. Root causes

### Cause A — `brand-300` and `brand-950` don't exist in the theme

The `brand` palette in `tailwind.config.js` only defines
`50 / 100 / 400 / 500 / 600 / 700`. But the code uses:

```js
// keyframe row (line ~11367)
'border-brand-300 dark:border-brand-500/40 bg-brand-50/30 dark:bg-brand-950/10'
```

Tailwind silently generates **no CSS** for unknown shades, so:

- `dark:bg-brand-950/10` → **never applies** → in dark mode the row keeps the
  *light* tint `bg-brand-50/30` (a pale indigo at 30% over the dark card = the
  muddy grey `[97,99,104]` we measured). This is why every text color on the row
  reads too dark.
- `border-brand-300` → **never applies** → in light mode the row's border falls
  back to `currentColor` (dark grey) instead of indigo.

`brand-300` / `brand-950` are used in **18 places** across the app (Tex-template
buttons, the Caption card, SFX trim handles, Audio Library multi-select rows,
subtitle cards, hover states) — all currently dropping those styles silently. This
is a latent app-wide bug, not just the keyframe editor.

### Cause B — dark-mode text/controls are too dark for a brand-tinted row

Even after Cause A is fixed, `dark:text-surface-300` and `dark:text-surface-500`
are too dark once they sit on *any* tinted row in dark mode. The keyframe editor's
9–11px text needs lighter dark-mode colors than the generic cards use.

---

## 3. Fix plan

### Step 1 — Root fix: complete the brand palette (1 file, 1 line change)

In `tailwind.config.js`, add the missing indigo shades (standard Tailwind indigo
values, which the brand palette is already based on):

```js
brand: {
  50: '#eef2ff', 100: '#e0e7ff',
  300: '#c7d2fe',                    // ← new
  400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca',
  800: '#3730a3', 900: '#312e81', 950: '#1e1b4b'   // ← new
}
```

This one change fixes **all 18 usages**: `border-brand-300` and
`dark:bg-brand-950/*` finally generate CSS everywhere (keyframe rows, Tex hover,
Caption card border, SFX handles, audio multi-select, subtitle cards).

### Step 2 — Keyframed row tint in dark mode (`renderCustomKeyframeEditor`)

```diff
- 'border-brand-300 dark:border-brand-500/40 bg-brand-50/30 dark:bg-brand-950/10'
+ 'border-brand-300 dark:border-brand-500/40 bg-brand-50/30 dark:bg-brand-950/20'
```

Bump the dark tint 10% → 20% so a keyframed row reads clearly as "branded" in
dark mode. (With `brand-950` now defined this finally takes effect.)

### Step 3 — Dark-mode text/control contrast on keyframed rows

Targets (on the corrected dark row ≈ `[36,35,45]`):

| Element | Before | After | Expected ratio |
|---|---|---|---|
| Property name | `dark:text-surface-300` | `dark:text-surface-100` | ~8.5 : 1 ✓ |
| Value | `dark:text-surface-300` | `dark:text-surface-200` | ~3.6 : 1 ✓ |
| Keyframe count | `dark:text-surface-300` | `dark:text-surface-200` | ~3.6 : 1 ✓ |
| "Add" button | `text-surface-500 … dark:hover:text-surface-300` | add `dark:text-surface-300 dark:hover:text-surface-100` | ~3.6 : 1 ✓ |
| Diamond toggle (active) | `text-brand-500` | `text-brand-600 dark:text-brand-400` | ~4.6 : 1 ✓ |
| "Delete" chip (active) | `dark:text-brand-400 dark:bg-brand-500/10` | `dark:text-brand-300 dark:bg-brand-500/25` | ~6.5 : 1 ✓ |
| Prev/Next arrows | `text-surface-400` | add `dark:text-surface-300` | ~3.6 : 1 ✓ |

The non-keyframed row keeps its plain style (`border-surface-200 … bg-surface-50/50
dark:bg-surface-900/10`) — only the **keyframed** state changes, exactly what the
request targets.

### Step 4 — Verify

1. `npm run build` — confirms the new brand shades compile.
2. Live probe (reuse the canvas-blend contrast measurement): enable keyframing on
   a property in dark mode, measure all elements above, confirm ≥ 3:1 (text ≥ 4.5
   where feasible).
3. Repeat in light mode — confirm no regressions (name 16:1, value 9:1, Add 5.6:1
   stay put) and that the light-mode row border is now indigo (`brand-300`) instead
   of `currentColor`.

---

## 4. Acceptance criteria

- [ ] Dark mode: property name ≥ 4.5:1; value / kf count / Add / arrows ≥ 3:1
- [ ] Dark mode: active diamond (brand-400) ≥ 3:1; Delete chip (brand-300) ≥ 4.5:1
- [ ] Light mode: all ratios unchanged or better (no regressions)
- [ ] Light mode: keyframed row border is indigo `brand-300`, not dark grey
- [ ] `brand-300` / `brand-950` utilities generate CSS (grep dist for `.dark\:bg-brand-950` and `.border-brand-300`)
- [ ] `vite build` passes; console clean

---

## 5. Out of scope

- The keyframe *behavior* (add/delete/seek/easing) — untouched.
- The Animations tab preset grid / easing chips (already fixed in Parts B–C).
- The Properties panel cards (their own token already handles dark mode).

---

## 6. Implementation status (main plan) ✅

Implemented in commit `20db254` — `tailwind.config.js` (+brand `300/800/900/950`)
+ `index.html` (row tint → `dark:bg-brand-950/20`, dark-mode text/control colors).
Measured live after the fix:

| Element | Before (dark) | After (dark) | After (light) |
|---|---|---|---|
| Property name | 2.38 : 1 ✗ | **14.2 : 1** ✓ | 14.6 : 1 ✓ |
| Value / kf count | 2.38 : 1 ✗ | **9.7 : 1** ✓ | ✓ |
| Add button | 1.05 : 1 ✗ | **6.2 : 1** ✓ | 4.6 : 1 ✓ |
| Delete chip | ~1.8 : 1 ✗ | **10.4 : 1** ✓ | ✓ |
| Diamond toggle | 1.35 : 1 ✗ | **5.2 : 1** ✓ | 6.1 : 1 ✓ |
| Row border (light) | currentColor (grey) | — | **#c7d2fe indigo** ✓ |

---

## 7. Follow-up sweep — `brand-200` still missing (9 usages) ⚠️

Audit (Aug 2026): the brand palette now defines `50 / 100 / 300 / 400 / 500 / 600 /
700 / 800 / 900 / 950` — the **only** remaining gap is `brand-200`. `brand-800` is
defined but currently unused (harmless). All other color families used by the app
(`surface` 50–950, default Tailwind palettes) resolve.

All 9 `brand-200` usages are **light-mode borders** (`border-brand-200 …`) that
today silently fall back to `currentColor` (heavy dark indigo from a nearby
`text-brand-600`) instead of a light indigo — the same latent bug class fixed for
`brand-300` in this plan.

| Line | Where | Usage | Dark twin |
|---|---|---|---|
| 8469 | Text Content card — **Captions** badge | `border-brand-200` | `dark:border-brand-700` |
| 8476 | **Convert to text** button | `border-brand-200` | `dark:border-brand-700` |
| 8483 | LaTeX template row | `border-brand-200` | `dark:border-brand-700` |
| 8485 | **LaTeX** badge | `border-brand-200` | `dark:border-brand-700` |
| 8671 | **Rainbow** letter button | `border-brand-200` | `dark:border-brand-500/20` |
| 8972 | Caption card — **Linked** badge | `border-brand-200` | `dark:border-brand-700` |
| 9060 | **Upload Texture** button | `border-brand-200` | `dark:border-brand-500/20` |
| 10430 | **Embedded in element** badge | `border-brand-200` | `dark:border-brand-700` |
| 20184 | Import-media drop circle | `border-brand-200` | `dark:border-brand-500/20` |

### Fix options (next sweep)

- **Option 1 (minimal, zero visual churn):** add `brand-200` as a tone between
  `brand-100` and the current `brand-300`, leaving `brand-300` unchanged. All 9
  borders start rendering light indigo; nothing else moves.
- **Option 2 (align to Tailwind's indigo scale):** note that the current
  `brand-300: '#c7d2fe'` is actually indigo-*200*'s value (stock indigo-300 is
  `#a5b4fc`). Adding `brand-200: '#c7d2fe'` and shifting `brand-300: '#a5b4fc'`
  makes the palette match stock indigo exactly, but subtly deepens every existing
  `border-brand-300` element (keyframe rows, Caption card, Tex buttons) — needs a
  visual pass if chosen.

Acceptance for the follow-up: `vite build` passes; grep dist for `.border-brand-200`
non-zero; light-mode spot-check the 9 sites show a light indigo border; no dark-mode
regression.

---

## 8. Reusable contrast audit helper 🔧

Added to `index.html` (next to the keyframe functions) and exposed globally for
future design audits — no more pasting the canvas-blend probe into the console:

- `window.auditContrast(el, { selector })` → `{ label, fg, bg, ratio, passAA, passUI }`
  — blends translucent backgrounds (rgb/rgba/oklab accepted by canvas, so Tailwind
  v4 alpha utilities work) in correct paint order over the nearest opaque ancestor,
  then computes the WCAG ratio against the element's (or a child's) text color.
- `window.auditContrastAll(selectorOrEl, childSelector)` — sweep a whole panel in
  one call and filter to elements that have a measurable color.

Verified: returns the same numbers as the manual probe used in §6 (dark keyframed
row → name 14.23 : 1, Add 6.15 : 1, diamond 5.2 : 1, blended bg `rgb(36,35,45)`).
