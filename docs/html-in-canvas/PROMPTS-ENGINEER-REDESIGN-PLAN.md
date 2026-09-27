# prompts-engineer.html — UI/UX Analysis & Material 3 Redesign Plan

Scope: full visual + interaction redesign of the Prompt Engineer page with a
Google **Material 3** clean aesthetic, **light + dark** themes. No build step —
everything stays in the single HTML file (CSS variables, inline JS), consistent
with the other html-in-canvas pages.

---

## 1 · Current state (audited live at 1440px, 390px, code + DOM)

### What the page is
Two-pane workbench: **left = prompt builder** (Format chip grid + 8 toggleable
module cards), **right = LIVE PROMPT panel** (Prompt/Code/Preview tabs, recipes,
zoom, copy actions). Topbar with Gallery / Test Renderer / Try in Renderer /
Copy Prompt. FAB "Copy" appears < 1025px. Sticky right rail ≥ 1280px.

### Strengths to keep
- Information architecture is right: builder ↔ live prompt side-by-side, char
  counts per module, HARD CONTRACT + duration warning inline, tabs for
  prompt/code/preview, handoff to TR/Gallery via localStorage (`pe_handoff`).
- Real utility details already present: prompt zoom (A−/A+), per-expander
  persistence, "N chars brief" status, Play/scrub preview, aspect/bg controls
  shared from hic-frame.js.

### Problems found

**Theming**
1. **Dark-only, hardcoded.** Body `#0b0f1a`, panels `#141922/#161d2b`,
   borders `#2d3748`, ~0 CSS custom properties for color — a light theme means
   touching every rule. No `color-scheme` meta, no `data-theme` hook.
2. **No token layer** for type/shape/elevation either: radii 10–12px ad hoc,
   Rubik at ad-hoc sizes, shadows inconsistent (blue-tinted module border vs
   gray borders elsewhere).

**Visual design (vs Material 3)**
3. Emoji module/chip icons clash with the clean UI (nine different colors in
   the Format grid fight the single purple accent).
4. No state layers: hover/press are flat border/bg swaps; no elevation story;
   selected Format chip is a plain blue outline (reads as focus, not choice).
5. Purple CTA (#a855f7-family) on dark navy is the only brand thread; orange
   warning callout and green Apply button are third-party accents with no
   relationship to it.

**UX / interaction**
6. **Mobile: topbar is `display:none` ≤ 768px** — Gallery/Test Renderer nav is
   unreachable; only the Copy FAB survives. Horizontal scroll at 390px
   (scrollWidth 436 vs clientWidth 373; Format grid `minmax` too wide).
7. **Nested scrolling**: prompt card has its own max-height scroll on top of
   window scroll (mobile `55vh` cap) — thumb-trap; page jumps between the two.
8. Toggles are `<button class="tgl">` with **no `role="switch"`/`aria-checked`**;
   Format chips lack `aria-pressed`; selected-vs-focus ambiguity (see 4);
   char pills are decorative but not hidden from AT; no `:focus-visible` styling.
9. Muted text (`#7c8798`-family) on panel backgrounds sits near/below 4.5:1 in
   several spots — will fail AA in light mode if ported naively.
10. Reset button sits next to Copy/To Gallery with equal weight — destructive
    action under-weighted (no confirm, text-level affordance missing).

---

## 2 · Target design language (Material 3, "clean")

- **Typography**: Google Sans Text vibe via **Roboto Flex** (UI) + **Roboto
  Mono** for prompt/code; strict M3 scale (Display 28 / Headline 22 / Title
  16·14 / Body 14·12 / Label 12·11, -0.1…0.2 tracking) replacing ad-hoc sizes.
- **Color**: M3 roles as CSS variables, **seeded from the existing purple**
  (keeps brand continuity):
  `primary #7C4DFF → light: #6750A8 / dark: #D6BCFA`-style mapping done
  properly: primary · on-primary · primary-container · secondary-container
  (selection) · surface · surface-container(low/high/highest) · outline +
  outline-variant · error/tertiary for warning · scrim.
- **Shape**: M3 scale — cards 16px (large), chips/fields 12px (medium),
  pills/full (small); FAB 16px.
- **Elevation**: levels 0–3 via shadow tokens + surface-container tints
  (no colored borders for structure; outline-variant for outlines only).
- **State layers**: single `--state` overlay pattern (hover 8%, press 12%,
  selected 10% opacity of on-color) applied via `::after` on every
  interactive component — consistent, cheap, very Material.
- **Motion**: M3 easings (`cubic-bezier(.2,0,0,1)` standard, emphasized for
  expander), 150/250ms; `prefers-reduced-motion` kills transforms.
- **Icons**: **Material Symbols Rounded** (one variable font, one weight
  axis) replacing all emoji — module icons become tonal 40px avatars.

## 3 · Light & dark theming mechanics

1. `:root { …light tokens }`, `[data-theme="dark"] { …dark tokens }`,
   `<meta name="color-scheme" content="light dark">`,
   `body { background: var(--surface) }` end-to-end (no hardcoded hex left).
2. Default = system (`prefers-color-scheme` at boot), then user override via
   **tri-state toggle** (light / system / dark) in the topbar as M3 icon
   button; persisted in `localStorage('hic_theme')` — same key the other two
   pages can adopt later (token file is designed to be extractable to
   `hic-theme.css` in a follow-up, not in this scope).
3. Both themes must pass **AA (4.5:1)** for body text, 3:1 for large/labels —
   dark mode is a *retune* (brighter containers, dimmer state layers), not an
   opacity flip of light.

## 4 · Component-by-component redesign

| Current | Redesign (M3) |
|---|---|
| Topbar | M3 top app bar: brand + supporting text, actions → icon buttons with tooltips; primary **Copy Prompt** = FilledTonal; elevation-on-scroll; ≤768px: actions collapse into a bottom app bar (nav fixed, not hidden) |
| Format grid | M3 **choice chips**: 40px tonal icon avatar + label, `aria-pressed`, selected = secondary-container + check icon, state layers; `grid-template-columns: repeat(auto-fill, minmax(96px,1fr))` (kills 390px overflow); intent input → outlined text field, floating label |
| Module cards | Outlined cards (16px radius, outline-variant): header = **M3 Switch** (`role="switch"`+`aria-checked`) · title (title-medium) · supporting text (body-small) · char badge (tonal pill, `aria-hidden`) · expand icon rotating 180°; body animates open with emphasized easing; content: M3 outlined selects (styled native), tracking → **slider with value bubble**, LIVE SAMPLE on surface-container-low with theme-aware specimen |
| LIVE PROMPT panel | surface-container-high card; **M3 primary tabs** (animated indicator) for Prompt/Code/Preview; zoom trio → icon-button group w/ tooltip; Recipes → M3 menu (list items + icons); "chars brief" → label-medium status with live region |
| Prompt view | Code surface = surface-container-lowest + Roboto Mono; syntax palette becomes light/dark token pairs (keyword=primary, string=tertiary, comment=outline…); HARD CONTRACT/OUTPUT FORMAT → expansion panels with icons; duration warning → tertiary-container callout (icon + AA text both themes) |
| Code view | Filled text-field styling, monospace, char counter, **Apply & Preview** = filled button (success via tertiary) |
| Preview view | Themed checkerboard (light gets 8% grid), stage on surface; transport = icon buttons + M3 slider (primary track); hic-frame.js aspect/bg controls recolored **via the same tokens** (no overrides) |
| Footer actions | **Copy Full Prompt** = Filled (primary, full-width ≤lg); To Gallery = FilledTonal; **Reset = text button with M3 confirm dialog** (destructive demoted, accidental-reset fixed) |
| FAB copy (<1025px) | Keep as M3 small FAB bottom-end (above bottom app bar), 16dp margins, hides when footer actions visible |

## 5 · UX fixes shipped with the reskin

1. Mobile nav restored (bottom app bar); zero horizontal scroll at 360px.
2. Single scroll flow on <1280px (prompt card max-height removed; page scroll
   only), sticky action bar; dual-pane with independent rail scroll ≥1280px.
3. Full keyboard pass: switches/chips/tabs menus reachable, `:focus-visible`
   = 3px primary state ring, logical DOM order.
4. Live regions: prompt char count (`aria-live=polite`), copy toasts.
5. Reduced-motion support; touch targets ≥ 44px on mobile.
6. All existing behavior preserved: recipes, zoom persistence, handoff
   (`pe_handoff`), gallery save, TR deep link, contract toggle persistence.

## 6 · Implementation phases (single-file, no build step)

1. **Tokens + theme** — variable layer, `data-theme` switcher, meta, font
   link; dark defaults verified pixel-identical-ish to today (low risk).
2. **A11y hardening** — switch/chip/tab ARIA + focus rings (markup only).
3. **Component reskin** — topbar → footer, state layers, elevation, icons
   (Material Symbols), syntax palette for both themes.
4. **Layout/UX** — bottom app bar, scroll fixes, confirm dialog, FAB.
5. **QA** — screenshot matrix (light/dark × 1440/768/360), contrast audit,
   keyboard walk, flows regression (Copy Full Prompt → AI tab paste, Try in
   Renderer handoff, Recipes),hic-frame controls visual check.

Est. footprint: ~1 file touched (`prompts-engineer.html`), mostly CSS rewrite
+ small markup/ARIA edits; JS logic untouched except theme toggle + confirm
dialog + menu wiring.
