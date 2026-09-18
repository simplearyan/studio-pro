# /designs — Community Prompt & Code Gallery (Plan)

> A new gallery page where creators **store HIC animation prompts + code** in Google
> Sheets (via an invisible Google Form), browse preset cards, **copy prompt/code with
> one click**, preview in a shared modal, and **export directly** (Save Frame / WebM /
> standalone HTML) — without ever opening the test-renderer page.

> Reuses the proven thumb-maker (firethumb) "static backend": Google Form → Sheet →
> GitHub Action → static JSON → GitHub Pages. Reference:
> `canvas-animator/thumb-maker ✅/doc/Community Preset Sharing Architecture.md`
> and `update_community_presets.py`.

---

## 1. Architecture (zero backend, zero cost)

```
┌─────────────┐   invisible fetch POST (no-cors)   ┌───────────────┐
│ /designs    │ ─────────────────────────────────▶ │  Google Form   │
│ Submit      │        entry.XXXX ids               │  (3-8 fields)  │
│ modal       │                                     └──────┬────────┘
└─────────────┘                                            │ auto-append
                                                           ▼
┌──────────────────────────────┐   sheet CSV export   ┌───────────────┐
│ GitHub Action (cron 6h)      │ ◀─────────────────── │ Google Sheet   │
│ python sync_designs.py:      │                      │ (the database) │
│  fetch → validate → assemble │                      └───────────────┘
│  → commit designs-gallery.json                                      │
└──────────────┬──────────────────────────────────────────────────────┘
               │ push (pages workflow redeploys)
               ▼
┌──────────────────────────────┐   fetch (same-origin)  ┌──────────────┐
│ docs/html-in-canvas/         │ ◀────────────────────  │ /designs page │
│ designs-gallery.json         │                        │ + test-render │
└──────────────────────────────┘                        └──────────────┘
```

**Why this fits:** same-origin static JSON (no CORS), free unlimited rows
(Sheets caps at 5M rows), one 50k-char cell limit per field (HIC code is
typically 3–8k chars — safe), submissions curatable by deleting Sheet rows.

---

## 2. Data model

Google Form fields (each becomes a Sheet column):

| Column | Required | Validation | Notes |
|---|---|---|---|
| `title` | ✅ | 2–60 chars | matches the `<title>` convention |
| `creator` | ✅ | 1–40 chars | display name, no login |
| `tags` | — | comma list | e.g. `fonts, latex, tailwind, subtitle` |
| `prompt` | ✅ | ≤ 8,000 chars | the creative brief WITHOUT the contract (the page re-wraps it with `aiBuildPrompt()` so contract updates propagate) |
| `html` | ✅ | ≤ 30,000 chars | must start with `<title>`; CDN tags allowed (KaTeX/marked/fonts/tailwind) |
| `css` | ✅ | ≤ 20,000 chars | |
| `js` | ✅ | ≤ 20,000 chars | must define `onFrame(time)` |

Synced output — `docs/html-in-canvas/designs-gallery.json`:

```json
{ "updatedAt": "2026-09-18T00:00:00Z",
  "designs": [ { "id": "d_<rownum>_<slug>", "title": "…", "creator": "…",
                 "tags": ["…"], "prompt": "…", "duration": 5000,
                 "html": "…", "css": "…", "js": "…", "createdAt": "…" } ] }
```

**Validator rules in the Action** (reject → skip row, log):
- `onFrame(` present in js; js compiles via `new Function`
- no `requestAnimationFrame|setTimeout|setInterval|@keyframes` in js/css (determinism contract)
- html starts with `<title>`; size caps; UTF-8 clean
- duplicate title+creator → keep newest

---

## 3. Page: `docs/html-in-canvas/designs.html`

Colocated with `test-renderer.html` (added to `viteStaticCopy` in `vite.config.js`)
so it ships on Pages at `<base>docs/html-in-canvas/designs.html` and can share code.

### 3.1 Design language — Material 3 + Rubik + Tailwind v4
- **Font:** Rubik for everything UI (already in `tailwind.config.js` as `font-rubik`); weights 400/500/600/700.
- **Color:** map Material 3 roles onto the repo's existing `surface`/`brand` tokens —
  `surface-container` cards on a `surface` page bg, `primary` = brand-600 buttons,
  `tertiary` accents for tags. Dark theme default (matches the studio), light optional later.
- **Shape/elevation:** 16–24px rounded corners (Material 3 "large"), elevation via
  Tailwind `shadow-sm/md/lg` on cards + state-layer hover (`hover:bg-slate-50/5`).
- **Components:** top app bar, search bar, filter chip row, Filled/Outlined buttons,
  cards, FAB (mobile submit), bottom sheets on mobile, snackbars for copy confirmations.

### 3.2 Layout (responsive)
| Breakpoint | Grid | Modal | Submit |
|---|---|---|---|
| <640px | 1 col cards, list-style row | full-screen sheet w/ sticky toolbar | FAB bottom-right |
| 640–1024px | 2 cols | centered dialog 92vw | FAB |
| 1024px+ | 3–4 cols | centered dialog max-w-4xl | header button + FAB |

### 3.3 Card anatomy
- 16:9 **live thumbnail**: lazy-rendered by a shared mini-renderer at 400×225
  (IntersectionObserver, offscreen cards get a neutral gradient + title skeleton).
- Title (Rubik 600), creator + relative time, tag chips (click = filter).
- Action row: **Preview** (primary) · **Copy Prompt** (icon+label) · **Copy Code** ·
  overflow menu: copy html/css/js individually, download `.json`, open standalone.

### 3.4 Detail/preview modal — shared export logic
Port the test-renderer's modal + `Renderer` class (Phase B: copy; Phase E: extract
`hic-shared.js` served statically to both pages — see §7):
- Tabs **Preview / Code / AI** (identical UX to test-renderer).
- Full transport controls: play/pause, scrubber, duration + resolution meta.
- **Export in place:** Save Frame (png/jpg/webp + resolution), Export WebM
  (wall-clock paced), Export standalone `.html` (emoji favicon, CDN hoisting,
  library fallback) — all reusing the already-fixed export pipeline.
- Header actions: **Copy Prompt**, **Copy Code**, **Edit a copy** (loads into Code tab).
- The **AI tab** here reads the card's stored `prompt` — one click fills the builder.

### 3.5 One-click flows
1. **Copy Prompt** → `aiBuildPrompt(design.prompt, design.duration)` to clipboard +
   snackbar "Prompt copied — paste into Gemini, then paste the reply back here".
2. **Paste reply** → modal AI tab textarea → `aiParseReply` (with the CDN-tag fix)
   → Apply & Preview.
3. **Copy Code** → fenced ```html/css/js blocks → paste into test-renderer AI tab or
   the modal's Code tab.
4. **Deep link** — "Open in Test Renderer": `test-renderer.html#design=<id>`;
   test-renderer gains a ~20-line hash handler (fetch gallery JSON → apply code → open modal).

---

## 4. Submit modal (Phase C)

- Fields: title, creator, tags, duration (ms select), prompt (textarea), and
  **two input modes**: (a) paste AI reply → auto-parse into 3 panes, (b) direct
  html/css/js textareas. Client-side validation mirrors the Action's validator with
  inline M3 error text.
- Submit = `fetch(formResponseURL, { method:'POST', mode:'no-cors', body: FormData })`.
  Opaque response → optimistic success snackbar: "Queued! Appears in the gallery
  within ~6 h (sync runs every 6 h)."
- Save a localStorage copy of every submission ("My drafts") so nothing is lost if
  the silent POST fails.
- entry-ID mapping lives in one config const at the top of the page:
  `const FORM = { id:'…', entries:{ title:'entry.123', creator:'entry.456', … } }`.

---

## 5. GitHub Action (Phase D)

`.github/workflows/sync-designs.yml` — `schedule: cron '0 */6 * * *'` + `workflow_dispatch`:

```yaml
- checkout (with a fine-grained PAT or default GITHUB_TOKEN w/ contents:write)
- setup-python 3.12
- run: python tools/sync_designs.py   # reads SHEET_ID from repo variable
- commit designs-gallery.json (only if changed) → push (pages workflow redeploys)
```

`tools/sync_designs.py` (adapted from thumb-maker's script):
CSV export URL → column mapping → per-row validation (§2) → assemble JSON →
write file. Idempotent; newest first; skips invalid rows with a summary log.

**Concurrency guard:** `concurrency: group: sync-designs` so cron + manual runs
don't race; commit step tolerates "nothing to commit".

---

## 6. Seed data (so the page is never empty)

Ship a starter `designs-gallery.json` containing the **16 existing test-renderer
presets** (title/prompt/code already in `AI_PROMPTS` + `PRESETS`) plus the 6 new
prompt briefs as prompt-only entries — generated once by a small Node script, then
the Action takes over.

---

## 7. Code-sharing strategy (avoid divergence)

| Phase | Approach |
|---|---|
| B (now) | Copy `Renderer` + modal markup/CSS/JS into `designs.html` — fast, zero risk to test-renderer |
| E (later) | Extract `docs/html-in-canvas/hic-shared.js` (Renderer, export helpers, parser, prompt library) + add to `viteStaticCopy`; both pages `<script src>` it; test-renderer keeps working byte-identical |

---

## 8. Implementation phases

- **A — Skeleton + seed:** designs.html (app bar, search, chips, responsive card grid,
  Rubik/M3 tokens), seed gallery, static-copy + Pages check.
- **B — Preview modal:** port Renderer + modal; per-card live thumbnails; copy
  prompt/code; deep-link from test-renderer; standalone/WebM/frame export in modal.
- **C — Submit flow:** modal, validation, no-cors Form POST, drafts in localStorage.
- **D — Sync pipeline:** Form + Sheet setup checklist, sync_designs.py, workflow yml,
  commit loop verified with a test row.
- **E — Consolidation + polish:** extract hic-shared.js, a11y pass (focus trap,
  aria-labels), PWA precache entries for the new page, README/docs update.

**You (once) per phase D:** create the Google Form with the 8 fields, link it to a
Sheet, paste the Sheet ID + entry IDs into the workflow variable and the page's
`FORM` config. Everything else is code.

## 9. Risks & mitigations
- **no-cors can't confirm delivery** → optimistic UI + drafts + explicit "appears in ~6 h" copy.
- **Spam/oversized rows** → strict Action validation, size caps, manual curation by deleting Sheet rows.
- **Renderer divergence between pages** → Phase E extraction; until then, designs.html imports its copy from the same commit.
- **Pages cache staleness** → fetch with `cache:'no-store'` + `updatedAt` shown in the footer.
