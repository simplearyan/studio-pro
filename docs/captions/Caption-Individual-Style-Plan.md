# Captions — Individual Style, Markdown-Style (Analysis + Plan)

**Status:** planned · not implemented
**Ask:** markdown text clips let the user style globally (Markdown panel) *and* individually
(per-clip Properties). Captions feel like they force a choice: use the extra "Caption" card
to tweak one caption, or convert it to a text clip. Make per-caption styling as natural as
markdown's per-text-clip styling.

---

## 1. Current architecture (mapped from `index.html`)

### Markdown text clips
- **Global:** `State.markdownConfig`, edited in the Markdown tab (Heading / Text / Math /
  Image cards). `applyMarkdownStyle()` (~15325) re-bakes every `_mdGenerated` clip from it.
- **Individual:** each md clip is a normal text clip, so its Properties cards work — but
  `applyMarkdownStyle` **overwrites the whole style on every global change**, so individual
  edits are fragile (clobbered by the next global tweak). No per-clip unlink toggle.

### Caption clips (text clips with `subtitleId`)
- **Global:** `State.subtitleConfig`, edited in the Captions tab via
  `captionStyleControlHtml(group, 'global')` (+ advanced bg-box/texture groups).
- **Individual — already exists, and it's the better model:**
  - `sub.effects` holds per-caption overrides; `bakeSubtitleStyleIntoClip` (~14253) merges
    `{...subtitleConfig, ...sub.effects}` into the clip on every render.
  - `setClipEffect` (~6823) **mirrors** any caption-valid key into `sub.effects`, so edits
    made in the normal text cards (Typography font/weight, Sizing size/line/letter, …) are
    already per-caption overrides that **survive global style changes**.
  - The **Caption card** (`cardCaption`, ~8864) exposes scale / color / stroke / shadow / bg /
    position / offset / animations with an inherit model (`__inherit__` option showing
    "Global (value)"), an "Overridden/Linked" badge, quick presets, and **Reset to Global
    Style** (`resetSubtitleClipStyle`). Per-field revert exists too (`setSubCaptionAnim`).
  - **Convert to text** (`convertSubtitleClipToText`) bakes everything and unlinks — one-way.

**So functionally, captions already have global + per-caption individual styling — the gaps
are UI/UX, not plumbing.**

---

## 2. The real gaps (why it *feels* like "card or convert")

| # | Gap | Where it bites |
|---|---|---|
| G1 | **The Caption card has no typography.** It covers scale/color/stroke/shadow/bg/position/anim — but *not* font family / size / weight / style / line-height / letter-spacing. To change one caption's font the user must use the separate Typography/Sizing cards. | Card feels like a half-surface; the full individual surface is split across cards. |
| G2 | **Per-field inherit affordance is missing outside the Caption card.** Typography/Sizing edits on a caption clip look like plain text-clip edits — no "Global (Rubik)" hint, no per-field revert arrow, no indication they're overrides (or that overrides survive global changes). | Users can't tell they're overriding, can't revert one field (only all, via the card). |
| G3 | **Discoverability.** Nothing tells the user "you can style one caption without converting." The Linked/Overridden badge is subtle; the Caption card only appears when a caption clip is selected. | Users reach for "Convert to text clip" to do something they could already do. |
| G4 | *(parity note, markdown's own flaw)* `applyMarkdownStyle` clobbers per-clip edits — captions' inherit model is the *better* pattern. | If we later want markdown per-clip edits to survive, copy captions' override model, not the other way. |

---

## 3. Implementation plan (recommended: A, then B)

### Phase A — Complete the Caption card as the one-stop individual surface (~1.5–2 h)
Make the Caption card expose *every* shared text property with inherit semantics, so a user
never needs the generic cards or conversion for individual styling:

1. **Add typography groups to `captionStyleControlHtml`** (new `group`s: `font`, `size`,
   `weight`, `style`, `lineHeight`, `letterSpacing`) — reusing the existing
   `sliderRow`/`colorBox`/`lblCls` helpers so they match the current groups pixel-for-pixel:
   - Font: select of `State.importedSystemFonts`/`State.googleFonts`/defaults (same list as
     the Typography card)
   - Size: slider 10–400 → `fontSize`
   - Weight: select 400/600/700/900
   - Style: select normal/italic
   - Line height / letter spacing: sliders
2. **Per-field inherit on every group** — extend the pattern `capAnimSel` already uses
   (`__inherit__` + "Global (value)") to `scale`/`color`/`stroke`/`shadow`/`bg` and the new
   typography groups. Implementation: for clip mode, each control renders the current value
   *plus* a tiny "Global" chip when `sub.effects[key]` is undefined (click = no-op, it
   already inherits), and a small revert arrow when overridden (calls
   `setSubCaptionAnim(clipId, key, '__inherit__')` + `updateSidebarPanel()`). Keeps the card
   compact — one extra chip per row, not a full dropdown per row.
3. **Order the card** to match the text-first Basic order: Typography (font/size/weight/
   style) → Spacing (line/letter) → Scale → Color → Stroke → Shadow → Background →
   Position → Animations, with the existing sub-headers.
4. **Keep** the preset strip, Overridden badge, Reset to Global, Convert to Text buttons.

### Phase B — Override hints in the generic text cards (~1 h)
For caption clips, make the existing Typography/Sizing cards caption-aware (G2):

- When a caption clip's `fontFamily`/`fontSize`/… differs from `subtitleConfig`, show a small
  `Global: <value>` hint + revert arrow in that row (reuses `setSubCaptionAnim` +
  `updateSidebarPanel`). When it matches, show nothing (zero clutter).
- Implementation is a per-row conditional in the text card builders (they already receive
  `clip`), gated on `clip.subtitleId && fx[key] !== cfg[key]`.

### Phase C (optional, bold) — Reversible "Edit as Text" mode (~1–1.5 h)
Add a toggle in the Caption card: **"Full text editing"** — when on, the clip renders with
the complete text-clip card set (Typography, Sizing, Letter Styles, Background, Extrude…),
with every edit recorded in `sub.effects` (already automatic via the mirror). Reversible:
toggle off = back to the compact Caption card, overrides kept. This gives markdown-style
"just a text clip" editing *without* one-way conversion.

### Not in scope
- Changing `applyMarkdownStyle` override behavior (G4) — noted for a future markdown plan.
- The Captions tab's own Style section (already the global surface; leave as-is).

---

## 4. Effort & risk

- A: ~1.5–2 h, one file (`index.html`), additive — new groups + chips in an existing builder.
- B: ~1 h, conditional hints in text-card builders.
- C: ~1–1.5 h, a mode toggle; risk: `sub.effects` grows large on caption clips (fine —
  reset-to-global clears it).
- Risk: per-field revert chips must call `setSubCaptionAnim` (exists) and re-render both the
  panel and canvas; horizontal dock must stay compact (chips are inline, ~16 px tall).
- No data migration: `sub.effects` schema already stores overrides; `SUBTITLE_EFFECT_KEYS`
  already includes the typography keys.

## 5. Test plan

1. Select a caption clip → Caption card shows typography + spacing groups with Global chips.
2. Override font size on ONE caption → only that caption changes; global style change still
   re-styles every non-overridden field (regression of `bakeSubtitleStyleIntoClip`).
3. Per-field revert (chip) → field snaps back to global; badge flips Overridden → Linked
   only when all fields are reverted; Reset to Global still clears everything.
4. Convert to text still bakes the final merged style (animations included).
5. Save/reload project → overrides round-trip through the project JSON.
6. Both docks, `vite build` ✓, console clean.
