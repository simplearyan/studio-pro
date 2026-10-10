# HIC toolkit — Material redesign + relocation plan

**Status:** R1 (relocation) **executed** — runtime files live at root
`html-in-canvas/`, old URLs covered by redirect stubs in this folder, all
path constants and both `_siteBase` derivations updated, gate battery +
fixture export gate + `vite build` verified green from the new location.
R2 (tokens/light mode) **executed** — hic-theme.css gained the extended M3
roles (state layers, shape, type scale, motion, scrim + page-chrome panel
steps); prompts-engineer's inline token copy + duplicate theme boot deleted
in favour of the shared files; test-renderer and designs chrome colors
tokenized (345 replacements, dark values kept as fallbacks so dark rendering
is unchanged) — all three pages now render complete light **and** dark.
The §8 duration fix also **executed**: `mhDur` editable field + one
`setClipDuration()` write path, live-verified (clamps 0.5–600s, mid-playback
pickup, import/AI paths share the write). R3–R5 (components, responsive,
restyle pass) not started. Written 2026-10-10 from the sources, not from
memory; every line number and constraint below was read out of the files
listed in §1 or out of the automation that consumes them.

Three asks, three answers up front:

1. **Redesign** the html-in-canvas toolkit pages to clean Google Material,
   responsive, light **and** dark. Yes — and the good news is ~60% of the
   Material layer already exists (`hic-theme.css` is a full M3 token set with
   both themes). The work is consolidation + components + responsive, not a
   ground-up restyle. See §3–§5.
2. **Relocate** the folder out of `docs/` into its own root folder. Yes —
   with one naming recommendation (`html-in-canvas/`) and a precise list of
   every path constant that must change, including two *runtime* base-URL
   derivations that will silently break vendored asset loading if missed.
   See §6–§7.
3. **Why can't animations be longer than 5 seconds?** They can be — 5s is a
   per-preset *default*, not an engine limit. The engine (`onFrame(t)`, t in
   ms, modulo loop) has no length opinion; the modal follows
   `PRESETS[key].dur`; only three import paths clamp (60s / 600s). The real
   gap is that test-renderer has **no duration input in its UI at all** —
   the duration is read-only text in the modal header. Full answer with
   lines in §8.

---

## 1. The ten files, what they actually are

| file | lines | role | who consumes it |
|---|---|---|---|
| `test-renderer.html` | 2693 | **The studio page**: gallery + stage modal + CodeMirror HTML/CSS/JS tabs + AI paste tab + import + export (frame-exact MP4 via MediaBunny/WebCodecs, wall-clock WebM via MediaRecorder) | humans; **automation** (`export-films.cjs` `PAGE_PATH`, `doctor.cjs`, `reel-export-gate.cjs` drive it via CDP); GitHub Pages |
| `designs.html` | 1256 | Designs gallery: thumbnails rendered live through hic-frame, copy-prompt, Google Forms/Sheets submit, import handoff to test-renderer | humans; Pages |
| `prompts-engineer.html` | 1760 | Visual prompt builder, 8 modules, M3-styled, **1–30s duration slider** (the page that proves >5s works) | humans; Pages |
| `hic-frame.js` | 599 | Renderer core: HTML → SVG foreignObject raster, pure `onFrame(t)` seek, lazy Tailwind runtime inject, CSS `@keyframes` materialization (T1.7) | test-renderer, designs, **reel gates** |
| `hic-modal.js` | 1087 | Shared clip preview modal (player, scrubber, export) | designs.html |
| `hic-storyboard.js` | 2224 | Reel **emitter runtime**: storyboard JSON → gated markup + pure `onFrame` | **reel automation only** (`EMITTER` in reel-compile/contrast/extent/fidelity/motion) — no page loads it |
| `hic-theme.css` | 109 | M3 token layer, light + dark, `data-theme` switch | test-renderer, designs |
| `hic-theme.js` | 66 | No-flash theme boot + toggle wiring (`localStorage('hic_theme')`, system default) | test-renderer, designs |
| `designs-gallery.json` | 565 | 40 design entries (title/prompt/duration/html/css/js) | designs.html |
| `fix-webm-duration.js` | 513 | Vendored third-party (ysFixWebmDuration) — patches the WebM Duration element MediaRecorder never writes | designs, test-renderer |

Also in the folder, not in the ask: `studio-pro-redesign.html` (721-line dark
mockup for STUDIO-PRO-UI-REDESIGN-PLAN.md) and **13 dated plan `.md` files**
(PLAN.md, PHASE-2-PLAN.md, EXPORT-TEST-RESULTS.md, …). §6 moves these
differently from the runtime files.

### The one hard constraint that shapes everything

The **automation contract**: the reel gates and exporters drive
`test-renderer.html` through CDP against named globals and DOM ids —
`PRESETS`, `currentPresetKey`, `modalRenderer`, `modalSlider`, `importFilm`'s
`parseImportedFile → fillPanesFromImport → setClip` chain, and the export pump's
`window.__hicExportProgress` / `window.__hicExportResult` protocol. A redesign
that renames or restructures those breaks the gate battery silently. Treat
them as a public API: restyle around them, don't refactor through them. The
designs↔test-renderer import handoff (`hic-code` JSON payload) is a second
such contract.

## 2. What is already Material (measured)

- `hic-theme.css` is a complete **M3 baseline token set** for two themes:
  primary/secondary-container, the full surface-container ladder, outline
  variants, elevation shadows, success/warning/error + containers, and
  `color-scheme` per theme. Theme switching: `data-theme` on `<html>`,
  system-preference default, no-flash boot in `hic-theme.js`.
- `prompts-engineer.html` is the **most M3-complete page** (its token copy
  predates hic-theme.css; same `hic_theme` key): Material Symbols Rounded,
  `--md-*` everywhere, state layers, 15 `@media` rules — it is the reference
  implementation for the other two pages.
- test-renderer and designs **link hic-theme.css** but are dark-first:
  unstyled rules fall back to legacy dark hex values, so light mode is
  partial (works where tokens were adopted, raw dark where they weren't).
- Responsive is thin outside prompts-engineer: **test-renderer has only 4
  `@media` rules, designs 6, prompts-engineer 15.** test-renderer's stage
  modal, code tabs and gallery grid are desktop-only today.

So the redesign is: *promote prompts-engineer's practice to a shared
component layer, finish the light-mode sweep, and add responsive structure to
the two desktop-only pages.*

## 3. Design system plan (one source, three pages)

### D1 — `hic-theme.css` → tokens only, plus two new files

```
html-in-canvas/
  hic-theme.css        # M3 tokens ONLY (exists; extend)
  hic-components.css   # NEW — shared M3 components (buttons, chips, cards,
                       #       top app bar, tabs, dialogs, slider, text fields)
  hic-theme.js         # theme boot (exists; unchanged)
```

Extend the token file with the M3 roles the pages currently hardcode:
state layers (`--md-state-hover/press/overlay`), shape scale
(`--md-shape-xs…xl`), type scale (M3 display/title/label/body roles mapped
onto the fonts already loaded), motion durations + M3 emphasized/de-emphasized
curves, and `--md-scrim`. Rule: **no raw hex outside token definitions.**

### D2 — component library with a live style board

`hic-components.css` ships the components all three pages re-implement today
(buttons, chips, cards, segmented tabs, dialog/sheet, slider, top app bar,
nav rail, snackbar/toast, code-editor chrome). Proof it works: a
`styleboard.html` page (in the two-queens/gallery pattern — one card per
component, both themes, each state). This is also where a future pack could
sample looks, the way the reel packs seed from test-renderer PRESETS.

### D3 — per-page restyle, automation contract frozen

- **test-renderer**: gallery becomes M3 cards with state layers + duration
  pill; stage modal keeps every id the automation touches (`modalSlider`,
  `mhMeta`, `PRESETS`…) and gets a visual cleanup only; CodeMirror panes get
  M3 editor chrome (surface-container-lowest, outline-variant separators);
  AI tab gets text fields + filled/tonal buttons. **Add the duration control
  (§8) in the same pass** — it belongs in the modal header meta line.
- **designs**: grid → M3 cards; submit form → M3 text fields in a dialog;
  same top bar as the other pages.
- **prompts-engineer**: drop its inline token duplicate, link the shared
  files (same `hic_theme` key, so user preference carries across pages).

### D4 — light/dark completion rule

Every rule in all three pages resolves in **both** themes. Method, not
vibes: a small CDP script (in the `reel-contrast` mold) walks each page in
both `data-theme` values and reports computed background/ink pairs that land
below WCAG AA — the same measurement `reel-contrast.cjs` already does for
films; reuse its idea, not its file. No screenshot review as the primary
check.

### D5 — responsive plan (mobile-first breakpoints)

M3's own breakpoints: compact 0–600, medium 600–840, expanded 840+.

| page | compact | medium | expanded (today) |
|---|---|---|---|
| test-renderer gallery | 1 column | 2 | 3–4 |
| stage modal | **fullscreen dialog** (M3 full-screen dialog pattern) | inset dialog | inline player zone |
| code tabs | single pane + tab bar (HTML/CSS/JS) | 2 panes | 3 panes side by side |
| top bar | icon-only actions, menu overflow | +labels | full labels |
| prompts-engineer | modules stack; bottom action bar | 2-col | dashboard grid (keep) |
| designs | 1 column cards | 2 | 3–4 |

Touch: keep the `@media (hover:none)` rule the designs plan already
prescribed — HUD/actions always visible where there is no hover. Verify each
page at 360 / 600 / 840 / 1280 px widths in both themes before calling a page
done.

## 4. Sequencing (each phase independently shippable + verifiable)

| phase | what | proof |
|---|---|---|
| R1 | Relocation (§6–§7) — mechanical, no visual change | full gate battery + fixture export gate green from the new path; Pages build copies to the new dest |
| R2 | Tokens: extend hic-theme.css, strip prompts-engineer's inline copy, finish the light-mode sweep on all three pages | D4 contrast walk passes both themes; manual toggle shows no dark islands in light mode |
| R3 | Components: hic-components.css + styleboard.html; adopt in test-renderer chrome | styleboard renders both themes; test-renderer visuals change, **gate battery green** (automation contract untouched) |
| R4 | Responsive: test-renderer + designs breakpoints, fullscreen dialog on compact | 4 widths × 2 themes checked per page; export + import still work at compact width |
| R5 | Restyle designs + prompts-engineer onto the shared layer | D4 walk on all three; cross-page theme preference persists |

R1 first: moving while restyling doubles the diff and makes a broken path
look like a styling bug. (This mirrors the repo's own P1 lesson — rename,
change nothing.)

## 5. Non-goals

- No build step, no framework, no runtime Tailwind in the pages' own chrome
  (the pages stay raw static files — that is what makes them gate-able and
  Pages-shippable as-is).
- `hic-storyboard.js` gets no visual redesign — it has no visuals; it is an
  automation-facing compiler and touching it risks the reel battery for zero
  user-facing gain.
- `fix-webm-duration.js` is vendored third-party; never restyle/reformat it.
- The editor app (`src/`, `index.html`) is out of scope; this plan covers
  only the toolkit pages.

## 6. Relocation — target layout

**Recommended name: `html-in-canvas/` (root).** Rationale: `automation/html-in-canvas/`
(the render CLI), `src/engines/hic/`, the pipeline plan doc, and every
existing comment already use this name; a new name (`code-to-video/`,
`canvas-to-video/`) would rename the concept in one place while three others
keep saying html-in-canvas. "Code to video" stays what the *product* does;
"html in canvas" is what this *engine* is — and the automation folder needs
that name kept distinct anyway.

```
html-in-canvas/                  # NEW root folder — runtime only
  test-renderer.html
  designs.html
  designs-gallery.json
  prompts-engineer.html
  styleboard.html                # added in R3
  hic-frame.js  hic-modal.js  hic-storyboard.js
  hic-theme.css  hic-components.css (R3)  hic-theme.js
  fix-webm-duration.js
  README.md                      # NEW: what each file is + the automation contract (§1)
docs/html-in-canvas/             # kept — plans only
  (the 13 existing *-PLAN.md / *-RESULTS.md files)
  REDESIGN-AND-RELOCATION-PLAN.md (this file)
  studio-pro-redesign.html       # static mockup, referenced by the plans — stays with them
```

Method: `git mv` the runtime files (history preserved), leave the dated plans
in `docs/` (they are the folder's historical record and the pipeline plan
explicitly treats them as carried documents), add the README.

## 7. Every path that must change (checked, not guessed)

**Runtime base-URL derivations — the dangerous ones.** Both pages compute the
site base by finding `/docs/` in their own path:

- `test-renderer.html:2503–2505` — `location.pathname.indexOf('/docs/')` →
  loads `vendor/mediabunny/mediabunny.min.js`
- `hic-frame.js:278–279` — same rule → loads
  `vendor/tailwind-browser/index.global.js`

After the move there is no `/docs/` segment, so `_siteBase` collapses to `'/'`
— correct locally, **wrong on GitHub Pages** (`/studio-pro/html-in-canvas/…`
must resolve to `/studio-pro/vendor/…`). Fix: derive the base from the
page's own directory (strip the known folder name + filename from
`pathname`) instead of the `/docs/` marker. Both files, same helper, one
comment pointing at the other.

**Automation constants** (each prints the path; update + run):

| file | what |
|---|---|
| `automation/studio-reel/export-films.cjs:54` | `PAGE_PATH = '/docs/html-in-canvas/test-renderer.html'` |
| `automation/shared/export/doctor.cjs:88,183` | renderer existence check + CDP target URL |
| `automation/studio-reel/reel-export-gate.cjs:169` | page URL; `:231` doc-comment |
| `reel-compile.cjs:68`, `reel-contrast.cjs:67`, `reel-extent.cjs:68`, `reel-fidelity.cjs:29`, `reel-motion.cjs:60` | `EMITTER` → `hic-storyboard.js` path (×5) |
| `automation/meta/render-meta.mjs:43` | `TR_URL` (note: already carries a stale `/studios/studio-pro-editor/` prefix — fix while there) |
| `automation/fix-*.mjs` (5 one-off patch scripts) | reference the old path; they are already-applied one-time patches → move to `_archive/` rather than edit |

**Build/deploy:** `vite.config.js:26,64–77` — every `docs/html-in-canvas/*`
static-copy target becomes `html-in-canvas/*`, and the **public URL changes**
from `<base>docs/html-in-canvas/test-renderer.html` to
`<base>html-in-canvas/test-renderer.html`. Anywhere that URL is linked from
outside (the IITM site handoff, READMEs, the meta clips) must be updated; to
not break existing bookmarks leave a 12-line redirect stub
(`docs/html-in-canvas/index.html` with `<meta http-equiv="refresh">` +
canonical link) at the old path — it is copied by the existing
`docs/studio-lite/*.html`-style glob pattern or gets its own target.

**Doc references:** grep hits in `docs/automation/*.md`, `automation/meta/README.md`,
`automation/studio-reel/PLAN-motion-and-tailwind.md` — update the ones that
state live paths; dated plans stay historical (a note at the top of the
folder README covers that).

**Verification for R1 (the definition of done):**

1. `reel-schema · fidelity · contrast · extent · regression · motion · style`
   all green, plus `reel-compile --pack-check all`.
2. `reel-export-gate` fixture mode PASS (it exercises doctor + PAGE_PATH +
   import chain + export from the new location).
3. `vite build` and confirm `dist/html-in-canvas/` contains the pages and
   `dist/docs/html-in-canvas/` contains only the redirect stub.
4. Open the built pages in a browser: vendored mediabunny + Tailwind load
   (no console 404), gallery renders, one export works.

## 8. The 5-second question, answered from the source

**There is no 5-second limit in the engine — 5s is the default duration each
preset *declares*, and test-renderer simply has no UI to change it.**

Evidence:

- `test-renderer.html:624+` — every entry in `PRESETS` hardcodes `dur: 5`
  (seconds). That number is data, chosen because these are sting-length
  templates.
- The whole player follows it: `modalSlider.max = p.dur * 1000`
  (`:879`), playback loops `(performance.now() - modalStart) % (dur*1000)`
  (`:1103`), export renders `p.dur` seconds (`:2356`, `:2551`). Change
  `dur`, everything downstream follows — the engine (`onFrame(t)`, t in ms,
  pure) has no length opinion at all.
- The only clamps are on **import paths**, not the engine: AI-paste marker
  clamps 1–60s (`:1930`), custom stage open clamps 1–60s (`:954`), storyboard
  import allows up to 600s (`:1625`), designs-gallery submit validates
  500–60000ms (`designs.html:1110`). `prompts-engineer.html` ships a 1–30s
  slider (`:1026`) — proof >5s is supported everywhere.
- The gap: the modal header shows duration as **read-only text** (`mhMeta`,
  `:387`) — there is no input. So in practice every clip you author in
  test-renderer is 5s unless you paste AI/imported code carrying a duration
  marker.

**Fix (ships in R3):** make `mhMeta`'s duration part an editable field
(0.5–600s, step 0.5, matching the widest existing clamp): on commit, set
`PRESETS[currentPresetKey].dur`, `modalSlider.max`, `ovTotal`, and the meta
line — the same four writes the AI-paste path already performs
(`:2059–2065`), so there is exactly one code path for "duration changed".
`aiCurrentDur()` then automatically asks the AI for choreography at the
chosen length instead of always 5000ms.

Cost note, honest: frame-exact MP4 export renders every frame, so 60s at
30fps ≈ 1800 frames ≈ 20× the 5s export time; the WebM MediaRecorder path is
wall-clock, so a 60s clip takes ≥60s to record. The duration field should
surface a hint at >30s rather than pretend exports stay instant.

## 9. Risks

| risk | mitigation |
|---|---|
| Redesign renames an automation-contracted global/id | §1 contract list; gate battery runs after every visual phase (R3–R5) |
| `_siteBase` break ships a silently broken Pages build | fixed derivation in R1 + step 4 of its verification (check the *built* pages, not the source) |
| Light-mode sweep misses a hardcoded dark hex | D4 measured contrast walk, not eyeballing |
| Redirect stub forgotten → external links 404 | stub is part of R1's definition of done, verified in `dist/` |
| Big-bang rewrite stalls | phases are independently shippable; R1 alone already delivers the folder the user asked for |
