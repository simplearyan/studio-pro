# Live Prompt Preview — Readability Redesign (Plan)

> Companion to `PROMPTS-ENGINEER-REDESIGN.md` (this is R1 scoped to the prompt
> panel). **The copied text stays byte-identical** — everything here is purely
> presentational, inside `tintPrompt()` + panel CSS.

---

## 1. Diagnosis (from the live screenshot)

| Problem | Evidence |
|---|---|
| **Contract wall** | 7 rules × 2–6 wrapped lines of identical gray mono = ~70% of the panel is one monotone block; the eye can't find the creative brief |
| Section boundaries invisible | `WHAT I WANT:` / `CONTENT:` / `HARD CONTRACT:` differ only by a tiny color shift at the same size |
| One-size-fits-all text | contract (reference material) and brief (the user's actual work) render at identical weight/size — inverse of their importance |
| Timings under-tinted | violet numbers work, but ms values inside the contract drown in gray |
| Panel wastes width on desktop | prompt card sits under the modules (full-width, short) instead of beside them |
| Mobile: 200px min-height panel | scrolling a long mono text in a squat box |

---

## 2. Design: hierarchy-first, color-second

### 2a. Collapse the contract (the big one)
- The HARD CONTRACT block renders as a **collapsed summary row**:
  `▸ HARD CONTRACT · 7 rules · always attached on copy` — one line, calm.
- Click expands it with the existing tinted text, slightly dimmer than the brief.
- **Default collapsed.** The user edits the brief; the contract is plumbing.
  (Expanded state persists in localStorage `pe_contract_open`.)

### 2b. Section headers become chips
Each top-level section renders as a small uppercase chip row, not a plain line:
`◆ FORMAT` / `◆ CONTENT` / `◆ TYPOGRAPHY` / `◆ PALETTE` / `◆ LAYOUT` /
`◆ CHOREOGRAPHY` / `◆ LIBRARIES` / `◆ TITLE` —
with a **per-module accent color** so sections are distinguishable at a glance:
format blue · content green · typography violet · palette pink · layout cyan ·
choreography amber · libraries teal · title sky.

### 2c. Two text roles, clearly split
- **Brief lines** (the creative content): 12.5px, weight 500, `#eef3fa`,
  line-height 1.8 — the visual protagonist.
- **Contract lines** (reference): 11px, weight 400, `#8fa2c0`, line-height 1.6 —
  visually quieter, never competing.
- Structural labels (`WHAT I WANT:`, `CONTENT:` …) become bold small-caps in the
  section's accent color; the content after them stays brief-colored.

### 2d. Timeline = mini visual summary
When CHOREOGRAPHY exists, the section header chip carries a **sparkline**:
one 40×10px bar per step positioned by start ms (bar length = duration,
color = amber). At-a-glance rhythm without reading.

### 2e. Numbers stay violet, plus units
Keep the `.n` violet tint; extend the regex to also catch `%` and `°`.

### 2f. Panel chrome
- Sticky mini-toolbar inside the panel: char count · contract toggle ·
  **Copy** (moves here from only-bottom) · font-size stepper (11/12.5/14px,
  persisted `pe_prompt_zoom`).
- `scrollbar-gutter: stable` to stop layout shift; thinner custom scrollbar.
- Empty state: friendly card ("Toggle modules to compose your brief…") with a
  Recipes shortcut.

### 2g. Responsive
| Width | Panel behavior |
|---|---|
| ≥1280px | prompt card becomes the **right rail column** (sticky, `7fr/5fr` workbench like designs page) instead of below-modules |
| 768–1279px | full-width card under modules (today), max-height 50vh |
| <768px | fixed-height sheet (55vh) with the sticky toolbar; font-size stepper matters most here |

---

## 3. Implementation notes

- All changes live in `tintPrompt()` (restructure into: parse sections → emit
  chips + role spans) + `.pc-body` CSS. ~120 lines total, one file.
- The module accent map derives from the existing module icons' hue family.
- Contract collapse = `<details>/<summary>` styled — free a11y, no JS state.
- Sparkline: computed in `refresh()` from `S.m6.steps` (already sorted data),
  rendered as inline SVG inside the choreography chip.
- Char count moves into the toolbar; `pc-head` keeps title + Recipes.
- No changes to `assemble()`, `doCopy()`, or exported text.

## 4. Acceptance checks

1. Collapsed: contract = one row; total visible brief ≫ contract.
2. Every section header visually distinct (color chips) at 100% zoom.
3. Brief vs contract distinguishable with color vision off (weight + size differ).
4. Zoom stepper 11→14px keeps ≥4.5:1 contrast everywhere (audit snippet from
   the redesign doc appendix).
5. Mobile 390px: panel usable one-handed; toolbar sticky; no horizontal scroll.
6. Copy byte-identical before/after (diff the clipboard payload in devtools).
