# HTML-in-Canvas consolidation — dead-code & orphaned-file audit

> **Partially executed** (2026-10-02, uncommitted). §1.1 (the WAAPI overlay renderer + DOM
> hooks) and §1.2/§1.3 (the legacy HTML-clip editor UI and the single-line orphans) are
> **removed**. §2 (files) is untouched. Line numbers below are from `index.html` @
> `b8fee6e` (38,161 lines) — the original audit; the file is now 37,629 lines (−532).

## How this was measured

- **In-editor symbols:** `grep -n <symbol> index.html`, then trace each hit to a
  reachable entry point (`applyProject`, `updatePropertiesPanel`, `drawCanvas`).
- **Files:** `git grep -l <basename>` (tracked files only, so `node_modules/`,
  `dist/`, `vendor/`, `_demo_assets/`, `_exports/` are excluded by construction).
- **Reachability key:** a legacy clip cannot exist, because `migrateLegacyHtmlClips`
  rewrites every `type: 'html'` clip to `type: 'hic'` on load (`index.html:33357`)
  and no creator remains. So anything gated on `type === 'html'` or on a flag that is
  never set is unreachable.

---

## Status

| Section | State |
|---|---|
| §1.1 WAAPI iframe-overlay renderer | ✅ removed (`drawCanvas` block, setup vars, debug log, hide-inactive loop, no-active-clips tail, DOM hooks `#waapiOverlayContainer` / `#waapiOverlayCanvas`, aspect-reset `_waCont`) |
| §1.2 legacy HTML-clip editor UI | ✅ removed (`#htmlEditorModal` markup + 5 functions + `_htmlEditorClipId`, the two `isHtml` sidebar cards, `htmlHTML`, `navItems`/`basicCardIds`/`basicCardHtml` branches, `strokeHTML` html clause) |
| §1.3 single-line orphans | ✅ removed (`_htmlEditorLiveTimer`, two `_htmlRendering` deletes; `_waapiOverlaySig` went with §1.1) |
| §3 not-from-consolidation | untouched (intentional) |

Verification: `vite build` passes (bundle 2,516 → 2,464 kB), inline classic scripts parse
clean, the editor boots with no console errors, the HIC panel + HIC code editor still work,
and a legacy `type: 'html'` clip still migrates to `hic`.

---

## 1. In-editor dead code

### 1.1 The WAAPI iframe-overlay renderer (dead: `_isWaaapi` is never set)

`grep "_isWaaapi\s*[:=]" index.html` returns **no assignment** — the only writes that
remain are `delete`. Every one of the 19 HTML-in-Canvas presets is `_isHic`
(`index.html:2443`+, `_hicKey`), so `_hasWaapiActive` is always `false`.

| Block | Lines | Evidence |
|---|---|---|
| Overlay setup + `_isWaaapi` scan | `5803–5817` | `_allWaCont`, `_overlayCanvas`, `_waapiActiveIds`, `_waapiMinTrackZ`, `_trackCount`, `_waapiDebugInfo`, `_hasWaapiActive` are defined here; every later read is inside this dead block |
| `_waapiDebugInfo` debug log | `7879` | the array is never pushed to → the `console.debug` never fires |
| "Hide inactive overlays" loop | `7882–7889` | only reads `_allWaCont` / `_waapiActiveIds` |
| Layer 2: iframe overlay + overlay canvas | `7893–8053` | `if (_hasWaapiActive …)` — never entered |
| Same-block `else` (`_oc2`) | `8058–8060` | dead branch |
| No-active-clips `else`, WAAPI half | `8063–8071` | `_waCont3` / `_oc3` only; the rest of that block (`placeholder` / `canvas` toggles) **is live** |
| Static DOM hooks | `1543–1544` | `#waapiOverlayContainer` / `#waapiOverlayCanvas` exist only for this renderer |
| Aspect-ratio reset | `3772–3775` | removes `#waapiOverlayContainer` that is never created by live code |
| `_waapiContentWritten`, `_waapiOverlaySig`, `_overlayCanvas` | `7918`, `7929`, `7944`, `7930`, `5804`+`7986–8052` | only referenced inside the block; `_waapiOverlaySig` is assigned once and never read |

### 1.2 The legacy HTML-clip editor UI (dead: only reachable for `type: 'html'`)

| Block | Lines | Evidence |
|---|---|---|
| `#htmlEditorModal` markup | `127–183` | opened only by `openHtmlEditor` |
| `let htmlHTML` + `if (isHtml)` card | `12508`, `15022–15066`, `15254–15271`, `15278` | `const isHtml = clip.type === 'html'` (`12460`) can never be true; `htmlHTML` is only inserted behind `(isHtml ? htmlHTML : '')` (`15278`) |
| `isWaaapi` preset button row | `15041–15051` | nested under `isHtml`, then under `isWaaapi` (also never true) |
| `openHtmlEditor` | `26447` (call site `15028`) | caller is inside the dead `isHtml` card |
| `closeHtmlEditor` | `26478` (call sites `149–150`) | buttons live in the dead modal |
| `_updateHtmlEditorPreview` | `26503` (call sites `26464`, `26466`, `26545`) | all callers are the dead modal functions |
| `_htmlEditorApplyPreset` | `26533` (call sites `138–147`) | buttons live in the dead modal |
| `_applyHtmlTemplate` | `26375` (call sites `15053–15066`, `15269–15271`, `26538`) | every caller is dead (card or modal) |
| `_applyWaaapiPreset` | `26437` (call sites `15043–15051`) | all callers are in the dead `isWaaapi` row; it is a thin alias to `applyHicPreset` |
| `_htmlEditorClipId` / `_htmlEditorLiveTimer` | `26444` / `26445` | the timer is declared and **never used**; the id only feeds the dead modal |
| `isWaaapi` panel read | `12462` | feeds only the dead row |
| `strokeHTML`'s `clip.type === 'html'` | `13355` | branch unreachable (harmless no-op) |

### 1.3 Orphaned clip-state fields (no writer)

| Field | Lines | Evidence |
|---|---|---|
| `_htmlRendering` | `26793`, `32889` | only ever `delete`d, never set — a leftover in the migration/serialise cleanup |
| `_waapiContentWritten` | `7918`, `7929`, `7944`, `26795` | written only inside the dead overlay; also `delete`d in migration |
| `loadWaaapiExample` | `26625` | **no code caller** (`git grep loadWaaapiExample` → docs only). Documented as an intentional one-line back-compat alias in [LEGACY-CLIP-REMOVAL-PLAN.md](LEGACY-CLIP-REMOVAL-PLAN.md) §H — keep or drop is a decision, not an oversight |

---

## 2. Obsolete / unreferenced files

| File | Status | Evidence |
|---|---|---|
| `automation/shared/skills/html2canvas-gotchas.md` | **Obsolete** | the engine it documents is gone (marked obsolete in `b8fee6e`); 246 lines, 7 KB |
| `automation/html-in-canvas/templates/design-tokens.md` | **Stale content** | [HTML-IN-CANVAS-PIPELINE-PLAN.md](automation/HTML-IN-CANVAS-PIPELINE-PLAN.md):615 — still "describe the editor's html2canvas engine". The file itself is a live agent asset |
| `docs/html-in-canvas/hic-storyboard.js` | **Not dead — gap** | its header points at `templates/storyboard.schema.json`, which is **not checked in** (gap G1 in [Studio-Reel-Roadmap.md](hyperframes/Studio-Reel-Roadmap.md)). Used by [test-renderer.html](html-in-canvas/test-renderer.html):598 |
| `src/assets/fonts/testfont.ttf` (53 KB) | **Unreferenced by code** | `git grep testfont` → only `docs/project_context.md:20`; no `index.html` / CSS reference |
| `_archive/index_backup.html` (707 KB), `studiopro_editor_text.html` (688 KB), `lucide.min.js` (409 KB), `generate-context.{cjs,js}` | **Pre-consolidation backups** | tracked, but no live code references any of them |

---

## 3. Not from this consolidation (listed for completeness, don't bundle)

| File | Evidence |
|---|---|
| `tools/cutover-designs-modal.cjs`, `tools/cutover-tr-modal.cjs`, `tools/seed-designs-gallery.cjs` | `git grep -l` → **0 references**; one-off migration scripts |
| `tools/sync_designs.py` | 4 references (docs) — may still be a live generator |
| `_demo_assets/`, `_exports/`, `_freebuff/`, `vendor/`, `tools/__pycache__/` | gitignored working dirs; out of scope |

The `automation/html-in-canvas/examples/*` and `templates/*` files are referenced by
READMEs and used as CLI inputs (`automation/html-in-canvas/render.js`), so they are
**not** dead.

---

## 4. Suggested removal order (each independently revertible)

1. `_waapiOverlaySig` (`7930`) and `_htmlEditorLiveTimer` (`26445`) — single-line,
   zero-risk.
2. The legacy HTML-clip editor: modal markup `127–183`, the `isHtml` card branches,
   and the `openHtmlEditor` / `closeHtmlEditor` / `_updateHtmlEditorPreview` /
   `_htmlEditorApplyPreset` / `_applyHtmlTemplate` / `_applyWaaapiPreset` functions.
   Verify no `onclick="…"` string references them after removal.
3. The WAAPI overlay renderer (`5803–5817`, `7879–8071`, DOM hooks `1543–1544`,
   aspect reset `3772–3775`). Highest risk of the set: it sits inside `drawCanvas`.
   Re-run the build + boot smoke test and diff a rendered frame before/after.
4. `_htmlRendering` / `_waapiContentWritten` cleanup lines in migration/serialise.
5. Files: `automation/shared/skills/html2canvas-gotchas.md`; decide on
   `src/assets/fonts/testfont.ttf`; decide on `_archive/` (a separate `chore:` commit).

## 5. Explicitly KEEP

`migrateLegacyHtmlClips`, `htmlToHicCode`, `applyHicPreset`, `preRenderAllHicClips`,
`addHicClipToTimeline`, `HIC_PRESETS`, the 19 `waaapi_*` HIC presets, `loadHicExample`,
`_isHic` / `_hicKey`, the HIC code editor (`#hicEditorModal`, `openHicEditor`), and
`src/engines/hic/adapters/waapi.js`.

---

*Audit produced 2026-10-02. Nothing removed.*
