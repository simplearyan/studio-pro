# Design Gallery — Page Redesign Plan

**Target:** `docs/html-in-canvas/designs.html` only. No changes to `hic-modal.js`, `hic-frame.js`, or the modal.
**Inspiration:** YouTube homepage (header, filter chips, video cards) + general professional-gallery patterns (Dribbble/Figma Community: content-first, chrome-second).
**Guiding principle:** the animated canvas thumbnails are the product — everything else gets quieter.

---

## 1. What's wrong today (from the current screenshot)

| Area | Problem |
|---|---|
| Header | Sub-tagline text + count pill clutter the brand zone; search box has a heavy inset shadow + border competing with 3 side-by-side buttons; the 🪄 emoji button breaks the button language. |
| Filter chips | **Two competing filter rows** (tag chips + Studio/Community/All toggle) that wrap; every chip shows a count; the blue "All 40" pill shouts louder than the content. |
| Cards | Permanent 4-button row (Preview / Prompt / Code / kebab) on every card = visual noise ×40 cards; title + meta + tag pills + buttons = 4 stacked rows below each thumb; card border + hover lift + blue glow makes the grid feel boxed-in. |
| Grid | Full-bleed with no max-width; tags duplicate the filter chips already at the top. |

---

## 2. Design tokens (add once, use everywhere)

Add a `:root` block at the top of the `<style>` so the page is themeable and matches the modal:

```css
:root{
  --bg:#0b0f1a; --surface:#141922; --surface-2:#1c2433; --surface-3:#232b3b;
  --border:#1e2533; --text:#f1f5f9; --text-2:#94a3b8; --text-3:#64748b;
  --accent:#2563eb; --radius-s:8px; --radius-m:12px; --radius-l:16px;
}
```

Then mechanically replace hardcoded hexes in the page CSS with these vars (pure refactor, no visual change). This alone kills a lot of the inconsistency.

---

## 3. Header (YouTube app-bar pattern)

**Structure stays** (sticky 3-zone grid at ~line 286). Restyle:

- **Height/padding:** `padding:12px 32px` → `padding:10px 24px`; border-bottom stays but soften to `var(--border)`.
- **Brand zone:** drop the `.sub` tagline entirely (it becomes the footer line). Keep `Design Gallery` + count, but the count becomes muted text (`--text-3`, font-weight 600, no pill/box). Optional YouTube touch: a small colored play-glyph logo mark before the wordmark.
- **Search (the YouTube pill):**
  - `border-radius:10px` → `999px`; remove the inset shadow; border `1px solid var(--surface-3)`.
  - Height 36px, max-width `min(560px,42vw)`, centered zone as today.
  - Focus state: 1px `--text-2` ring + slightly lighter bg — **no blue glow** (YouTube's search never glows blue).
  - Placeholder shortens to `Search designs`.
  - Add keyboard affordance: `/` focuses search, `Esc` clears (2 lines of JS).
- **Actions:** one primary + icon ghosts, all 32px tall:
  - `New` stays the only blue pill (`--accent`, icon + label) — mirrors YouTube's "Create" button.
  - `Test Renderer` → icon-only ghost button (play triangle) with `title` tooltip.
  - `🪄` → inline SVG wand icon in the same ghost style (no emoji).
  - Ghost style: transparent bg, `--text-2` icon, hover = `var(--surface-2)` circle.

**Net effect:** 1 pill + 1 blue button + 2 quiet icons. Same functions, half the chrome.

---

## 4. Filter row — merge into ONE scrollable row

Today: `#chipsRow` (wrapping pills w/ counts) + `.seg-toggle` on a second visual row (~line 311). Change to:

- **Single row:** chips left, Studio/Community/All right — same line, same height (30px), vertically centered. The inline `justify-content:space-between` style on `.chips-row` already does this; the fix is preventing the wrap clutter.
- **Chips (YouTube 2024 chip language):**
  - Drop the per-chip counts entirely (edit the builder at ~line 573 — remove the `<span class="n">` markup). If counts are missed, show them in `title` tooltip only.
  - Shape: `border-radius:8px` (not pills), height 30px, `padding:0 13px`, font 12px/600.
  - Inactive: **flat** `var(--surface-2)` bg, `--text` label, **no border**. Hover: `var(--surface-3)`.
  - Active: **inverted** — `#e2e8f0` bg with `#0b0f1a` text (YouTube's exact active-chip treatment). Only ONE accent-colored element per screen region.
- **Overflow:** `overflow-x:auto; scrollbar-width:none` + fade-out mask on the right edge; chips never wrap to a second line.
- **Seg toggle:** same 8px radius / same active treatment as chips (active = inverted light, not `#334155`); drop the purple `.community-on` special case — a small purple dot before "Community" preserves the distinction without a second active color.

---

## 5. Cards — YouTube card pattern (the big change)

Replace the boxed card with YouTube's chrome-less card. Edit the card template in `renderGrid()` (~lines 644–664) + card CSS (~lines 63–86).

### 5a. Structure — before → after

```
BEFORE                              AFTER
┌────────────────────────┐          ╭────────────────────────╮
│  [canvas thumbnail]    │          │ [canvas thumb]    (5s)▸│  ← duration pill, bottom-right
├────────────────────────┤          ╰────────────────────────╯
│ Title                   13.5px   │ Title (1 line, 14px/600)
│ @studio · 5s            10.5px   │ @studio · 5s · Motion   ← ONE muted line (12px)
│ [MOTION] [PREMIUM]      pills    │ (hover) ✦prompt ✦code ⋮ ← icon row, top-right of thumb
│ [▶ Preview][Prompt][Code][⋮]     │
└────────────────────────┘
```

- **Card chrome gone:** `.dcard` loses `background`, `border`, and the hover `translateY` + blue glow. The card is just `border-radius:12px` around the thumb + text below on page background.
- **Thumbnail:** keeps animated canvas + skeleton. Adds:
  - **Duration pill** bottom-right: `rgba(0,0,0,.8)` bg, white 11px tabular text, `4px 7px`, radius 4px (exactly YouTube's badge).
  - **Hover action row** top-right on a subtle right-edge gradient scrim: three 28px ghost icon buttons — Prompt (copy), Code (copy, disabled state preserved), kebab (opens existing `#cardMenu`). Icon-only + `title`/`aria-label`; same `data-act` values so **no handler changes**.
- **Text block:** title 14px/600 one-line ellipsis; meta line merges creator + duration + first tag (`@studio · 5s · Motion`, `--text-2`, 12px, dot separators). Minitag pills are deleted — tags remain filterable via the chips row and are still in the kebab flow.
- **Primary interaction:** clicking anywhere on the card opens the preview modal (already the card click behavior — keep). The blue "Preview" button disappears; the whole card is the button.

### 5b. Hover behavior

- Thumbnail: `filter:brightness(1.06)` + hover action row fades in (`opacity 0→1, 120ms`). No scale/translate.
- Title: color `--text` → white; card gets `cursor:pointer` (already).
- Respect `prefers-reduced-motion` (disable the fade/skeleton animation).

### 5c. Grid

- `gap:14px` → `18px 16px`; page content gets `max-width:1440px; margin:0 auto` (wrapper div or padding tweak) so ultra-wide screens don't stretch cards silly.
- Community empty state (`.com-empty`) and footer unchanged, except footer inherits the dropped header tagline: `prompts & code for HTML-in-Canvas animations`.

---

## 6. Accessibility & quality pass (do with phase 3)

- Cards: `tabindex="0"`, `role="button"`, Enter/Space opens preview; focus-visible ring `2px solid var(--accent)` offset 2px.
- Icon-only buttons: `aria-label` (Prompt, Code, More, Test Renderer, wand).
- `/` focuses search; `Esc` in search clears + blurs.
- Contrast: `--text-3` (#64748b) only for ≥12px non-essential text (it's ~4.6:1 on `--bg`); meta lines use `--text-2`.
- Verify disabled Code button (`hasCode=false`) is visibly distinct in the ghost-icon style (opacity .35 + `not-allowed` cursor).

---

## 7. Implementation order (mechanical, low-risk)

| Step | Touches | JS changes |
|---|---|---|
| 1. Tokens + header restyle | CSS `:root`, `.topbar` block (~17–36), header markup (~286–310) | tiny: `/` + Esc handlers |
| 2. Single-row chips | `.chips-row`/`.chip` CSS (~47–53, 311–320), chip builder (~573) | drop count spans |
| 3. Cards + grid | `.dcard*` CSS (~63–86), `renderGrid` template (~644–664) | template only; handlers unchanged |
| 4. A11y + reduced-motion + max-width | CSS + card attrs | Enter/Space on card |

All changes are CSS + one template function in **one file**. The kebab menu (`#cardMenu`, ~729+), search logic, seg-toggle logic (~590), community view, and the modal are untouched.

## 8. Verification checklist (live, per repo pattern)

1. Vite restart → open `/docs/html-in-canvas/designs.html`, console clean.
2. Header: search focus ring, `/` shortcut, New opens design flow, icon buttons navigate (Test Renderer / prompts-engineer).
3. Chips: filtering works per tag, active chip inverted, horizontal scroll on narrow viewport, no counts.
4. Seg toggle: Studio/Community/All switching, community empty state, purple-dot indicator.
5. Cards: click → modal opens with correct design; hover icons → Prompt copies, Code copies (disabled when `hasCode=false`), kebab menu opens with all items (Copy HTML/CSS/JS, Download .json, community extras).
6. Screenshots before/after at 1280px and 800px widths for the PR description.
