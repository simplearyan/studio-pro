# /prompts-engineer Redesign — Readability + Split Workflow (Plan)

> Goal: turn the prompts-engineer into the **left half of a two-pane studio** —
> design & copy the prompt on one side, paste it into Gemini in the adjacent
> window, paste the reply back into an **AI Console** on the same page, then
> hand the generated code straight to the Test Renderer / Gallery / Google
> Sheets for preview and sharing. And fix readability: clearer text contrast,
> larger type floor, calm visual hierarchy.

Sibling docs: `PROMPTS-ENGINEER-PLAN.md` (modules/assembler), `DESIGNS-GALLERY-PLAN.md`
(Form/Sheets pipeline). The screenshot that motivated this: PE left + Gemini
Flash right, side by side — this plan makes that loop first-class instead of
something the user improvises.

---

## 1. Diagnosis of the current page (from the live screenshot)

| Problem | Evidence | Fix |
|---|---|---|
| Hint text too faint | `#475569`/`#64748b` on `#141922` cards ≈ 2.8–3.4:1 — fails WCAG for body-size text | New text ramp (§2), minimum 4.5:1 for all running text |
| Type floor too low | 15× `font-size:10px`, 10× `11px`, 4× `9.5px` hints | Floor: 11px labels, 10.5px hints, 12px mono prompt body |
| Module cards visually noisy | every module has icon+name+hint+toggle+badge+chevron in one row | Keep, but calm: single accent, dimmed chrome, clearer open/close affordance |
| Prompt preview is dense | mono 11px, tint colors close in value | 12px/1.75 mono, stronger 3-color tint, sticky section headers in preview |
| No place to put the **reply** | user must leave to test-renderer to paste | AI Console pane (§4) |
| No guided loop | copy → external AI → paste → preview is all manual | Stepper + one-click handoffs (§5) |

Non-goals: changing the assembler output, the module schema, or the contract text.

---

## 2. R1 — Contrast & readability token pass (pure CSS, no behavior change)

New design tokens on `:root` (replaces scattered literals):

```
--bg:      #0a0e17     page
--card:    #121826     module cards        (was #141922 — fine)
--card-2:  #0d1117     prompt preview bg
--line:    #1f2937     hairlines           (was #1a2230/#1e2533 mix)
--tx-hi:   #f4f7fb     headings            (~15:1)
--tx:      #dce5f1     body/labels         (~12:1)
--tx-2:    #a7b7cc     secondary values    (~7.5:1)
--tx-3:    #7f92ab     hints/captions      (~5:1 on card — AA)
--acc:     #5b9bff     interactive accent  (was #3b82f6 text-on-dark uses)
--acc-ink: #0b1220     text on accent
--ok:      #34d399 · --warn: #fbbf24 · --bad: #f87171
```

Rules:
- **No text below 4.5:1 on its background.** `#475569` and `#64748b` are banned
  as *text* colors (allowed for borders/shadows only).
- Type floor: labels 11px, hints 10.5px, prompt preview 12px mono / 1.75,
  module names 13.5px, section titles 12px caps.
- Weight system: 700 module names, 600 labels, 500 hints (Rubik 500 legible at 10.5px+).
- Prompt tint (on `--card-2`): brief `#e8eef7`, contract `#94a6c4` (≈6:1),
  timings/titles `#aab4ff`, labels caps `#8fa2c0`. Verified ≥4.5:1 each.
- Focus states: 2px `--acc` ring on all interactive elements (currently only some).
- The "Paste the copied prompt…" explainer under the copy bar becomes a proper
  `--tx-2` caption at 11px, not 10px `#475569`.

Acceptance: run a scripted contrast audit of every text node's computed
color vs effective bg ≥ 4.5:1 (dev-tools snippet shipped in the doc appendix).

---

## 3. R2 — Two-pane workspace shell ("Builder | AI Console")

Desktop ≥1280px becomes a resizable split:

```
┌───────────────────────────────┬───────────────────────────────┐
│  BUILDER (min 400px)          │  AI CONSOLE (min 360px)       │
│  modules accordion            │  ① PROMPT  (assembled, copy)  │
│  (live prompt moves here too  │  ② REPLY   (paste AI output)  │
│   as a tab, not duplicate)    │  ③ CODE    (parsed, 3 tabs)   │
│                               │  ④ SEND    (handoff buttons)  │
└───────────────────────────────┴───────────────────────────────┘
```

- **Drag handle** between panes (8px hit area, double-click = 50/50; persisted
  in localStorage `pe_split`).
- Panes collapse to icons; collapsed console becomes a slim rail with a badge
  when a reply is waiting.
- 768–1279px: segmented tabs `Builder | Prompt | Console` (full-width swap, keeps
  all three reachable). <768px: same tabs + floating Copy FAB (existing).
- The current right-column "LIVE PROMPT" card becomes **tab ① inside the
  console** on split mode; on tabbed modes it remains its own tab. No content
  duplication — one DOM node, re-parented by CSS grid areas (no JS moves).
- Stepper strip across the top of the console:
  `1 Design → 2 Copy → 3 Generate (external) → 4 Paste → 5 Send` — the active
  step auto-advances from user actions (copy sets step 3; paste sets step 5),
  purely visual, clickable to scroll.

---

## 4. The AI Console (new, right pane)

Port + reuse what already exists on the sibling pages (do not reinvent):

**① PROMPT** — the assembled prompt (existing `promptBody` node), Copy Full
Prompt (existing `doCopy`), Reset. Adds "Open in Gemini" link button —
`https://gemini.google.com/app` in a new tab (we **cannot iframe Gemini**;
X-Frame-Options blocks it — the adjacent-window pattern from the screenshot
remains, the console just sits beside it).

**② REPLY** — a large paste textarea (like the test-renderer's `#aiReply`).
Port `aiParseReply` (fenced-block parser incl. the CDN-tag-in-html preservation
fix) from designs.html. Shows live parse state: "3 blocks found (html 1.2k, css
0.8k, js 0.6k)" as you paste.

**③ CODE** — three sub-tabs HTML/CSS/JS showing the parsed blocks (readonly
view first; optional: reuse CodeMirror here later — v1 uses plain `<pre>` with
copy buttons per block to keep the page light).

**④ SEND** — the money row (§5).

---

## 5. R3 — Handoffs: Preview · Share · Save

The console's SEND step offers, enabled only when parsed code exists:

| Action | Mechanism | Notes |
|---|---|---|
| **Preview in Test Renderer** | store `{html,css,js,dur,title}` in localStorage `tr_code_handoff`, navigate `test-renderer.html#paste=1` | test-renderer consumes it: injects `__custom` preset (same path as `#aiwant`), **auto-applies the code to the stage**, lands on Preview tab playing. No URL size limits. |
| **Open as Gallery draft** | existing `pe_handoff` slot + `designs.html#new=1`, extended to carry `html/css/js` too | lands pre-applied in the draft modal |
| **Save to Google Sheets** | the existing Form pipeline (Phase C/D of the gallery): same 8 `entry.*` POST, `mode:'no-cors'`, pre-filled from parsed code + `<title>` + duration | reuses the designs submit validator (onFrame present, no rAF/setTimeout, 30k caps, `<title>`-first) — port that function, don't duplicate logic: extract to a tiny shared `hic-shared.js` (already anticipated in designs plan §7) loaded by both pages |
| **Copy code blocks** | fenced ```html/css/js``` to clipboard | for manual flows |
| **Download .json** | existing `hic-code` payload shape | matches gallery import |

Security note: Sheets save stays public-by-obscurity like the gallery;
moderation = delete the Sheet row.

---

## 6. R4 — Polish

- Empty states: console ② shows a hint card ("Paste Gemini's reply here — the
  three fenced blocks are detected automatically"); ④ disabled buttons get
  explanatory tooltips.
- Reduced motion: respect `prefers-reduced-motion` on the stepper/collapses.
- Keyboard: `Ctrl/Cmd+Enter` in ② parses; `Ctrl/Cmd+Shift+C` copies prompt
  anywhere on the page.
- A11y: panes are landmarks (`role="complementary"` with labels), stepper is
  `aria-current`, all toggles keep `aria-label`.
- The doc appendix gains the contrast-audit snippet + the split-state schema.

---

## 7. Phases & estimates

| Phase | Scope | Files | Est. |
|---|---|---|---|
| **R1** | token pass + type floor + tint + focus states | prompts-engineer.html (CSS only) | ~1 session |
| **R2** | split shell, resizable panes, tabs, stepper, console ① | prompts-engineer.html | ~1 session |
| **R3** | reply parser port, code tabs, 4 handoffs, `tr_code_handoff` consumer in test-renderer, `hic-shared.js` extraction | prompts-engineer.html, test-renderer.html, designs.html, new hic-shared.js | ~1–2 sessions |
| **R4** | empty states, shortcuts, a11y, docs | same + docs | ~½ session |

Each phase ships independently usable; R1 alone fixes every readability issue
in the screenshot.

## 8. Risks

- **CodeMirror weight** — deferred to v2; ③ uses `<pre>` + copy buttons.
- **Shared-file extraction** (`hic-shared.js`) touches 3 pages — do it in R3
  with byte-identical constants and a syntax+behavior test of both consumers.
- **Split-shell complexity** — CSS grid areas only, no JS DOM re-parenting;
  tabbed fallback is a plain media-query change.
