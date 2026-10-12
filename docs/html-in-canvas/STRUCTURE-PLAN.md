# html-in-canvas — folder structure plan

**Status:** S1 and S3 applied. S2 is a placeholder for known future work.

## 0. Why this folder needs a structure *plan* rather than a structure

This folder is **deployed**. Its three pages are live URLs on GitHub Pages
(linked from the root README's "Play it live" section), its files load each
other by **relative path**, and its exact filenames are named in build config,
redirect stubs and automation. Unlike a docs folder, you cannot reorganize it
by taste: every move is a contract change. So the structure is what it is on
purpose (§1), the rule for new files is written down (§3), and anything more
ambitious lives here as a plan with its blast radius attached (§4).

## 1. Inventory (current)

| Kind | Files |
|---|---|
| **Pages** (live URLs) | `test-renderer.html`, `designs.html`, `prompts-engineer.html` |
| **Engine** (loaded by relative path) | `engine/hic-frame.js`, `engine/hic-modal.js`, `engine/hic-storyboard.js`, `engine/hic-theme.js`, `engine/hic-theme.css`, `engine/fix-webm-duration.js` |
| **Data** | `designs-gallery.json` (40 designs, fetched by `designs.html` and `prompts-engineer.html`) |
| **Docs** | `README.md` only — plans live here in `docs/html-in-canvas/` (see §3) |

## 2. What pins the layout

| Contract | Where it lives | What it forbids |
|---|---|---|
| **Live URLs** | root README "Play it live" section · GitHub Pages `/html-in-canvas/*.html` | Renaming or moving the three pages without a redirect story |
| **Static-copy targets** | `vite.config.js` (exact filenames, `dest: 'html-in-canvas'`) | Moving any shipped file without updating every target |
| **Relative loads** | each page's `<script src>` / `<link>` / `fetch()` | Moving an engine file without editing all of its consumers |
| **Redirect stubs** | `docs/html-in-canvas/*.html` meta-refresh to `../../html-in-canvas/<name>.html` | Renaming pages (the stubs are filename-pinned) |
| **Automation contract** | `reel-export-gate.cjs`, `export-films.cjs`, `doctor.cjs` drive `…/html-in-canvas/test-renderer.html` and named globals | Moving the page; renaming `PRESETS`, `currentPresetKey`, `modalRenderer`, the import chain, the export pump protocol |
| **Site-base rule** | `test-renderer.html` + `hic-frame.js` derive the site base by finding `/html-in-canvas/` in their own path | Renaming the folder itself |

## 3. The rule (S1 + S3 applied)

**Pages and data flat at the folder root, engine libraries in `engine/`,
non-runnable documents in `docs/html-in-canvas/`.**

- **S1 (applied):** `UNLIMITED-DURATION-PLAN.md` moved out of the folder to
  [`docs/html-in-canvas/UNLIMITED-DURATION-PLAN.md`](UNLIMITED-DURATION-PLAN.md)
  — nothing in the repo referenced its old path, and the move makes the folder
  match the convention the other four plan docs already follow.
- **S2 (future, trivial):** `styleboard.html` (R3 of the redesign plan) lands
  flat at the root when built, gets a `vite.config.js` copy target, a row in
  the folder README's page table, and its live URL in the root README.

## 4. S3 — an `engine/` subfolder (applied)

Applied at the owner's request (`implement structure plan`): the six engine
files moved to `engine/` via `git mv`, all thirteen relative load tags across
the three pages updated (`engine/…`), the three `vite.config.js` copy targets
retargeted to `dest: 'html-in-canvas/engine'`, and the living docs (root
README shared-layer table, this folder's README) re-linked. The redirect
stubs and the site-base rule needed no change — pages and folder name did
not move. Verification: all three pages load from `engine/` with zero
console errors, the reel automation gate passes, and the production build
ships `dist/html-in-canvas/engine/` with no root-level lib references.

**Deploy-skew decision (explicit, per step 6):** pages and engine files ship
in the same commit, so every deployed set is self-consistent. A browser
holding a cached *old* page requests the old root lib URLs, which 404 after
deploy — GitHub Pages serves with `max-age=600`, so the window is ~10
minutes and a hard refresh clears it. Accepted rather than shipping duplicate
root copies, which would defeat the structure and double maintenance.

**Historical note:** before S3 the trigger condition was “only if the folder
grows past ~6 engine files or ~5 pages”; the owner's explicit instruction
superseded the trigger, which is the right precedence — the plan documents
risk, the owner spends it.

**Verification after any S3 step:** all three pages load with zero console
errors locally (`/html-in-canvas/…` and under the Pages base), the reel
automation gate passes (`node automation/studio-reel/reel-export-gate.cjs`),
`npm run build` output contains no references to the old paths, and the root
README's links resolve.

## 5. Non-goals

- **Renaming the folder** — the site-base rule, the live URLs, the stubs and
  the automation all name `/html-in-canvas/`. It is a public path.
- **Bundling the pages** — raw static files are the point: byte-identical
  between dev and production, gate-able over CDP, deployable by copy.
