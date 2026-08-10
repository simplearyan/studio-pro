# Accessibility Audit — Properties Panel Form Fields

**Status:** Plan only — no code changed
**Date:** Aug 2026
**Trigger:** DevTools "Issues" panel shows 3 warning/error groups while toggling the
Properties sub-tabs (Transform / Appearance / Media). The attached screenshot lists:

| # | Issue | Count | Severity badge |
|---|-------|-------|----------------|
| 1 | A form field element should have an `id` or `name` attribute | 12 | blue (info) |
| 2 | Interactive element inside of a `<summary>` element | 51 | red (error) |
| 3 | No label associated with a form field | 217 | blue (info) |

---

## 1. What are these issues? (plain terms)

### Issue 1 — "A form field element should have an `id` or `name` attribute" (12)

Form fields are the controls the browser treats as form inputs: `<input>`, `<select>`,
`<textarea>`. When one has neither an `id` nor a `name`, the browser can't identify it:

- **Autofill** (address, passwords, credit cards) keys off `name`/`id` heuristics, so fields
  without them never get autofill suggestions.
- Extensions, password managers, and browser history features also key off these attributes.

### Issue 2 — "Interactive element inside of a `<summary>` element" (51)

Every property card is a `<details>` / `<summary>` accordion. The card **header** (`<summary>`)
contains the "card on/off" toggle switch (`propSwitch` — a real `<input type="checkbox">`
inside a `<label>`), and in horizontal docks it also holds reset/chevron markup.

The problem: a `<summary>` is itself interactive (clicking it toggles the accordion). Nesting
**another** interactive control (a checkbox) inside it creates ambiguous keyboard/AT behavior:

- A keyboard user pressing Enter/Space on the `<summary>` toggles the accordion — and the inner
  checkbox is not reliably reachable/announced.
- Screen readers may announce the inner control, may announce the summary, or both — inconsistent.

### Issue 3 — "No label associated with a form field" (217)

Each property row shows a text label, but it's a bare `<label>` element with **no `for`
attribute** and the input has **no `id`** — so the label and the input are not *connected*.
The label is visual only.

- Screen reader users hear "slider" or "checkbox" with no context about *what* it controls.
- Clicking the label text doesn't focus the control (small hit-target problem).
- This is the biggest count because it applies to nearly every range slider, color picker,
  and select across the whole editor, not just the Properties panel.

> Why the counts look "wrong": the screenshot counts (12 / 51 / 217) are **document-wide
> totals** accumulated across the whole page — timeline controls, export modal, captions tab,
> markdown panel, settings, plus every property card. They grow as you toggle sub-tabs because
> the panel re-renders the cards and the Issues panel re-scans the live DOM. On a single
> Properties panel render we measured: **49 fields, 26 unlabeled, 21 without id/name,
> 3 `<summary>` headers of which 2 contain interactive children** (see §5).

---

## 2. Where do they come from?

All three funnel through the **shared property-card builders** (the CapCut-density refactor
from the Phase 2/4 work) plus the hand-rolled cards that predate them:

| Builder / pattern | Line | Issue it causes |
|---|---|---|
| `propSlider()` — `<input type="range">` | ~8198 | no `id`/`name` (1), no label link (3) |
| `colorRow()` — `<input type="color">` | ~8183 | no `id`/`name` (1), no label link (3) |
| `propSwitch()` — card-header checkbox | ~8204 | inside `<summary>` (2), no `id`/`name` (1) |
| `toggleRow()` — body switch row | ~8212 | checkbox has no `id`/`name` (1); label text is a `<span>`, switch label wraps input (OK) |
| `propCard()` — `<summary>` header | ~8146 | hosts `rightSlot` (the switch) inside `<summary>` (2) |
| Hand-rolled `<select>`s (Shape Type, Mask Type, font lists, etc.) | various | no `id`/`name` (1), no `<label for>` (3) |
| Legacy font/typography cards | ~8230–8900 | same patterns, pre-builder |

The **audio-clip** property branch and **text/markdown style cards** have their own duplicate
markup with the same gaps.

---

## 3. Do we need to solve them? What's the benefit?

**Short answer: yes — cheap to fix, and this editor is a *video editor*, where keyboard-driven
workflows (J/K/L scrubbing, tabbing between sliders) are the norm.**

| Benefit | Why it matters here |
|---|---|
| **Keyboard operability** | Fix #2 makes every card switch reachable by Tab/Enter from the header. Property panels are dense; users tweak values without a mouse. |
| **Screen-reader / AT support** | Fix #3 turns "slider, 50" into "Opacity slider, 50 percent". Needed for the editor to be usable by assistive tech at all. |
| **Autofill / browser features** | Fix #1 matters less for sliders, but the *name/color/text inputs* across the app would autofill correctly. |
| **Lighthouse / a11y score** | These three groups are the exact checks Lighthouse flags; fixing them moves the score from ~70s into the 90s. |
| **Future Tauri/webview ports** | The user plans a Tauri desktop app. Chromium's a11y tree feeds OS-level accessibility (Windows Narrator, macOS VoiceOver); fixing now carries over. |
| **Label click target** | Connected labels make the whole label text clickable — bigger hit area on tiny 10px labels. |

**Non-goals:** full WCAG AA compliance (focus rings everywhere, ARIA for the canvas, etc.) is a
separate, larger effort. This plan only closes the three reported DevTools groups.

---

## 4. Effort estimate

**Overall: Small-Medium. ~1 focused session (2–4 hours of edits + verify).** Because 90% of the
surface funnels through 4 shared builders, most of the work is *one* change in each builder —
the fix then propagates to every migrated card automatically.

| Phase | Scope | Touches | Effort | Risk |
|---|---|---|---|---|
| 0 | Measure baseline (this doc, live counts) | — | done | — |
| 1 | Give every form field an `id` + `name` | 4 builders + hand-rolled selects | **S** ~30–45 min | none (attribute only) |
| 2 | Connect labels via `for`/`id` (fix #3) | same builders; `propRow` already emits `<label>` | **S** ~30–45 min | low (id collisions) |
| 3 | Move the header switch out of `<summary>` (fix #2) | `propCard` + `propSwitch` + CSS | **M** ~45–60 min | medium (layout/click regression risk) |
| 4 | Same fixes for audio/text/markdown branches | duplicate markup, ~6–10 cards | **M** ~30–45 min | low |
| 5 | Verify: DevTools issues → 0, build, live test | — | **S** ~20 min | — |

Total: roughly **2.5–3.5 hours** including verification. Phases 1+2 fix the two *info* groups
(12 + 217 → ~0). Phase 3 fixes the only *error* group (51 → ~0) and is the only one with real
regression risk, so it ships with its own visual/click verification.

---

## 5. Measured baseline (live, single Properties render)

Captured on the running app with a video clip selected (one card set rendered):

```
<summary> elements                : 3   (2 contain an interactive child → issue #2)
total input/select/textarea       : 49
  ├─ with proper label link       : 23
  ├─ unlabeled                    : 26  (issue #3)
  └─ without id or name           : 21  (issue #1)
  ├─ input[type=range]            : 17
  ├─ input[type=checkbox]         : 4
  ├─ input[type=color]            : 1
  └─ select                       : 1
```

> Full-page totals (all tabs, modals, timeline) are roughly 4–5× these numbers, matching the
> screenshot's 12 / 51 / 217. Toggling sub-tabs re-renders the cards, so the Issues panel count
> grows — but the *underlying defect set is fixed once* because the builders are shared.

---

## 5b. Result — Phases 1–2 implemented (Aug 2026)

All form fields in the Properties panel now carry `id`/`name` and a connected `<label for>`
(or `aria-label` for controls without a visible label). Verified live across every clip type
× every sub-tab × both docks:

| Clip type | Group | total fields | no id/name | unlabeled |
|---|---|---:|---:|---:|
| video | transform | 20 | 0 | 0 |
| video | appearance | 18 | 0 | 0 |
| video | media | 2 | 0 | 0 |
| text | transform | 2 | 0 | 0 |
| text | appearance | 37 | 0 | 0 |
| text | media | 11 | 0 | 0 |
| shape | transform | 3 | 0 | 0 |
| shape | appearance | 19 | 0 | 0 |
| shape | media | 4 | 0 | 0 |
| audio | (whole panel) | 32 | 0 | 0 |

**Regression checks passed:** slider drag still updates its value chip (`1.00x`→`1.50x`),
card switches still toggle, label `for` matches the input id, horizontal dock renders the
same clean fields, `vite build` ✓, console clean.

**What was changed (index.html only):**
- `propSlider` / `colorRow` / `propSwitch` / `toggleRow` builders now emit `id="${clip.id}_${key}"`
  + `name="${key}"`; `propRow` and `colorRow` labels carry `for` pointing at the control id.
- `propRow`'s label `for` is derived from the input's own `id` attribute (can't drift).
- Hand-rolled selects (Shape Type, Mask Type, Font/Weight/Style/Decor, Casing, Blend Mode,
  Fitting, Direction ×2, Mask/Extrude, keyframe easing) got `id`/`name` + `for`/`aria-label`.
- The text Background card (17 fields) and Sizing & Spacing card (3 fields) migrated.
- Word/letter override controls (`advWord*`, `advLetter*`) got `aria-label`s.
- The audio panel (Auto-Duck, Volume Duck, Envelope/Trim/Fades, EQ, Speed, Pitch, Reverb,
  Voice Effects) got `id`/`name` + labels on all 32 fields; the duplicate `duckThreshold`
  key got a `duckThreshold2` id to avoid a collision.
- `inputGoogleFont` and the hidden file inputs (replace source, texture, SFX) got `aria-label`s.

**Phase 3 (the only error group) is done too — see §5c below.**

---

## 5c. Result — Phase 3 implemented (Aug 2026)

Moved every interactive child OUT of the `<summary>` DOM (Option A from the plan): the header
switch/button is now rendered as an absolutely-positioned sibling of the summary, pinned to
the header band (`top-0 h-11` / `h-10`, `flex items-center`), so it stays *visually* in the
header row but is no longer a descendant of the toggle-able `<summary>`.

**Before → after (live DevTools-style scan of the whole document):**

| Check | Before | After |
|---|---:|---:|
| Interactive elements inside `<summary>` | 51 | **0** |

**Where the fix landed (index.html):**
- `propCard` builder — the shared `rightSlot` (header switch / Reset button) moved out of the
  summary; `details` gained `relative`. This single fix covers every migrated card (Color,
  Stroke, Crop, Mask, Shadow, Texture, Extrude, …).
- `letterStylesHTML` — the Clear-all button moved out.
- `textBgHTML` Background card — the `bgEnable` toggle moved out.
- `createAudioAccordion` builder — the `enableKey` toggle moved out.
- Auto-Duck + Smart Volume Duck cards — the toggle buttons moved out.
- `headingFxGroup` (Markdown) — the enable toggle moved out.
- Markdown Heading + Text Style cards — the Style/Effects tab-switcher pills moved out
  (positioned between the title and chevron).

**Verified live:**
- 0 interactive-in-summary across video/text/shape × all sub-tabs, the whole audio panel,
  and the Markdown style tab — in both vertical (left) and horizontal (bottom) docks.
- Regression: stroke toggle flips `strokeEnable` via click + keyboard (change event), the
  Markdown fx toggle flips its config value, the Style/Effects pills still switch tabs, the
  chevron still collapses accordions, `vite build` ✓, console clean.
- Visual: switches/Reset buttons sit in the header row next to the chevron (screenshot-confirmed);
  no layout shift; horizontal-dock cards keep the switch at the right edge.

---

## 6. Implementation plan

### Phase 1 — Add `id` + `name` to every form field (fix #1, 12 → 0)

In each shared builder, derive an id from the effect key (`propSlider`, `colorRow`,
`propSwitch`, `toggleRow`), e.g. `id="${clip.id}_${key}"` and `name="${key}"`. Hand-rolled
`<select>`s (Shape Type, Mask Type, font lists) get the same treatment. Dedupe/fallback when
the same key appears twice in one card (e.g. `propPair` — append an index or suffix).

- **Acceptance:** DevTools Issues panel shows 0 "id or name" entries with any clip selected;
  no visible change.

### Phase 2 — Associate labels (fix #3, 217 → 0)

`propRow` already emits `<label>` — add `for="${id}"` using the same id scheme as Phase 1.
`colorRow` label gets `for` too. `toggleRow`: wrap the label *text* in a real `<label for>`
(the switch itself already nests its input in a label — that's valid implicit association).
Hand-rolled selects: add `<label for>` or `aria-label`.

- **Acceptance:** `document.querySelectorAll('input,select,textarea')` minus hidden =
  `labeled` count; screen-reader announcement includes control names (spot-check with the
  browser's a11y tree); label text click focuses the control.

### Phase 3 — Remove interactive children from `<summary>` (fix #2, 51 → 0)

The only interactive child is the header `propSwitch`. Two viable patterns:

- **Option A (recommended, least churn):** keep the switch *visually* in the header but move
  the `<input>` + its `<label>` OUT of the `<summary>` DOM (render them after the summary,
  absolutely positioned over the header slot), or restructure the header so the switch sits in
  a sibling row above the summary and the summary is just the title row.
- **Option B (cleaner a11y):** drop `<details>`/`<summary>` entirely and use a
  button-to-toggle + div pattern (the classic disclosure widget). More correct, but it means
  reworking `propCard`'s collapse state, chevron rotation, and the horizontal-dock
  always-open behavior — the higher-risk path.

Pick **A** for the 51-count fix (it directly satisfies the "no interactive element inside
summary" rule); keep **B** as a documented follow-up.

- **Acceptance:** DevTools shows 0 "interactive element inside summary"; card switch still
  toggles on/off with mouse and keyboard (Tab to it, Space/Enter); accordion still opens/
  closes; horizontal dock unchanged; no layout shift.

### Phase 4 — Replicate across the remaining branches

Apply Phases 1–3 to the audio-clip property branch and the text/typography/markdown style
cards (their own `toggleRow` at ~14541 and hand-rolled selects/inputs).

- **Acceptance:** select an audio clip and a text clip; Issues counts stay at 0 for those
  card sets too.

### Phase 5 — Verify

1. `vite build` passes.
2. Live: cycle every clip type × both docks, re-scan DevTools Issues → all three groups at 0.
3. Regression-click: card switches, sliders, color pickers, resets, accordions, sub-tab
   switches, keyboard shortcuts (T/Y/G/O/X/B, 1/2/3) still work.
4. Optional: run Lighthouse Accessibility category — expect 90+.

---

## 7. Risks / gotchas

- **id collisions** (Phase 1/2): the same effect key can render twice (e.g. `propPair`
  X/Y share a row; speed slider + speed ramp slider). Must suffix or the `for`/`id` link
  silently binds to the first match. **This is the main real bug risk.**
- **Phase 3 layout:** moving the switch out of the summary can shift the header row; verify
  both docks and the dimmed-body interaction (switch must stay clickable when the card body is
  `pointer-events-none`).
- **`sr-only` peers:** Tailwind `peer` selectors rely on the checkbox being a *previous
  sibling* of the visual track — don't reorder the input after the div in Phase 1.
- **Counts are document-wide:** expect the Issues panel to still show *some* entries from
  non-Properties areas (timeline, export modal) if those aren't covered — Phase 4 should
  sweep the visible ones, but the timeline toolbar inputs (if any) are out of scope.
