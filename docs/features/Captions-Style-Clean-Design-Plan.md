# Captions Style: Clean Design Pass (match the text Properties panel)

## Goal

Restyle the caption style UI — the global **Style** tab (Captions panel) and
the **per-caption card** (Properties panel) — using the exact card and control
tokens the text-clip Properties panel already uses. The caption style logic
already shares the text-clip effect schema and the same renderers
(`drawTextBackground`, `drawCaptionLetters`, stroke/shadow/extrude), so this
is a **pure UI refactor**: same fields, same write handlers, same render
output — just the clean, familiar presentation.

## The target pattern (from the text Properties panel, verified in code)

- **Card token** (`cardTypography` L8599, `cardSpacing` L8695,
  `cardTextBg` L8790): `<details class="group bg-white dark:bg-surface-800
  border border-surface-300 dark:border-surface-700 shadow-sm rounded-lg
  …" open>` with a header (`bg-surface-100 dark:bg-surface-800/80`, icon +
  bold title + chevron) and a body of
  `px-3 py-2 flex flex-col gap-2 bg-surface-50 dark:bg-surface-900/50`.
- **Header/corner toggle**: a small switch in the card header (Background
  card) or beside a sub-section title — the body dims + disables when off.
- **Sub-sections**: nested groups inside a card, each with an icon+label
  header + inline toggle (e.g. the Background card's Stroke / Drop Shadow /
  3D Extrude), separated by `border-t`, content dimmed when its toggle is off.
- **Color row**: `relative flex items-center … rounded p-1` with a swatch,
  mono hex text, and a full-cover invisible `<input type=color>`.
- **Slider row**: label + value badge (e.g. `48px`) on one line, `custom-slider`
  underneath; `grid grid-cols-2 gap-2` for paired fields.

## Current caption style UI (the gap)

- `captionStyleControlHtml` (L16536) renders every field as a compact
  `sub-style-group` row: icon+label, an inherit chip (**Global** text or a
  revert arrow), then the control. Dense, little hierarchy, and a chip column
  on every row.
- The global Style tab (L17190) crams **Typography** (font/size/weight/style/
  line-height/letter-spacing/scale/color) into one card with Style/Effects
  sub-tabs (L17008), then **Position** (L17162) and **Advanced** (L17180)
  hold the box stroke/shadow/extrude/texture controls — the box family is
  split away from Background and hidden under "Advanced".
- The per-caption card (Properties, ~L8988) repeats the same rows + chips for
  clip scope.
- The two panels look unrelated even though they edit the same effect keys.

## Design mapping

| Caption field group (now) | Becomes (target) |
|---|---|
| Font / weight / style / line-height / letter-spacing / scale / color | **Typography** card + **Sizing & Spacing** card (mirror `cardTypography` / `cardSpacing` exactly) |
| Stroke + Shadow (glyph) | **Fill & Effects** card: Text color row, then nested **Stroke** and **Shadow** sub-sections with inline toggles (the `cardTextBg` sub-section pattern) |
| Background + box stroke/shadow/extrude/texture | **Background** card: a direct clone of `cardTextBg` — Fill Color + Opacity, Padding + Radius, nested Stroke / Drop Shadow / 3D Extrude / Texture sub-sections, each with its own toggle + dimming. No more "Advanced" split. |
| Position / bottom offset | **Position** card (keep, restyle to the card token) |
| Quick Styles strip + Animation tab | Unchanged |

### The one structural difference: per-caption overrides

Text clips are standalone, so their cards have no inherit concept. Captions
have the **global style + per-caption overrides** model (`State.subtitleConfig`
merged with `sub.effects`), and the current chip column exists to show which
fields are overridden. The clean version keeps that model but moves it out of
the row:

- **Global Style tab**: no chips at all (everything is global by definition).
- **Per-caption card**: each card header gets a small **"Reset to global"**
  icon (clears that card's keys via the existing
  `setSubCaptionAnim('…','key','__inherit__')` mechanism), and per-field
  overrides show a tiny revert icon that appears **on hover** next to the
  control (replacing the always-visible chip). A footer button keeps
  `resetAllSubtitleOverrides()` ("Reset all to global").

## Concrete steps

1. **Shared builders** in `renderSubtitlesPanel` (so both the global tab and
   the per-caption card render through one code path, like
   `captionStyleControlHtml` already does):
   - `textCard(title, icon, inner, subAccKey)` — the text-properties card
     token, with `data-sub-acc` so the persisted open-state fix (commit
     `db49ce0`) keeps working.
   - `colorRow(k, def)` — swatch + hex + invisible input, emitting the
     existing `put(k, 'this.value')` handlers.
   - `sliderRow(k, min, max, fmt)` — label + value-badge + `custom-slider`,
     emitting the existing handlers.
   - `subSection(title, icon, enableKey, inner)` — icon+label header + inline
     toggle, body dimmed via `opacity-40 pointer-events-none` when off.
2. **Rewrite the card set** for the global Style tab: Typography, Sizing &
   Spacing, Fill & Effects, Background, Position (replace `typoCard` /
   `styleFieldsHtml` / `effectsFieldsHtml` / `advCard` / `posCard`).
   Background = port of `cardTextBg` (same markup pattern, `State.subtitleConfig`
   handlers + `saveSubtitlesToStorage` + `renderSubtitlesPanel()`).
3. **Rewrite `captionStyleControlHtml`** group bodies to the new rows while
   keeping its `mode`/`clipId` dispatch and `put`/`putToggle` writers; move the
   inherit chip to a hover-revert icon (`setSubCaptionAnim(…,'__inherit__')`)
   with `title` tooltips.
4. **Per-caption card**: render the same card set with `mode='clip'`; add
   per-card "Reset to global" header icons + keep the full reset footer.
5. **Position card** restyle to the token.
6. **Verify** (UI-only change — no renderer/schema edits, so exports are
   untouched): `node --check` + `npm run build`; live checks in both vertical
   and horizontal docks — card toggles dim+disable, color rows update the
   swatch/hex, sliders update badges, per-caption override indicator +
   hover-revert works, cards keep open-state across re-renders (the collapse
   bug), and a caption still renders identically before/after (canvas hash).

## Risks / notes

- **Panel height**: cards are taller than the old compact rows. Vertical dock
  scrolls (already the behavior); horizontal-dock cards are fixed `w-[280px]`
  like the text cards — fine.
- **Override discoverability**: the hover-revert icon must be obvious — use a
  consistent icon (`rotate-ccw`), `title` text ("Reset to global (…value)"),
  and keep the card-header reset as the always-visible fallback.
- **Open-state persistence**: every new card must carry `data-sub-acc` keys so
  the delegated toggle listener continues to prevent the auto-collapse bug.
- **No schema/render changes**: this plan deliberately touches only
  `renderSubtitlesPanel` + `captionStyleControlHtml` markup; the canvas,
  export, and conversion paths are untouched.
