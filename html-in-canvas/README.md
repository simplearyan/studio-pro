# html-in-canvas — the HIC toolkit

HTML in, animated video out. Three pages plus the engine they share, all raw
static files (no build step) so every page is gate-able and shippable to
GitHub Pages as-is.

**Live:** [designs](https://simplearyan.github.io/studio-pro/html-in-canvas/designs.html) ·
[test-renderer](https://simplearyan.github.io/studio-pro/html-in-canvas/test-renderer.html) ·
[prompts-engineer](https://simplearyan.github.io/studio-pro/html-in-canvas/prompts-engineer.html) —
or `npm run dev` and open `http://localhost:3000/html-in-canvas/<page>`.

Moved here from `docs/html-in-canvas/` in R1 of
[`docs/html-in-canvas/REDESIGN-AND-RELOCATION-PLAN.md`](../docs/html-in-canvas/REDESIGN-AND-RELOCATION-PLAN.md);
the old URLs redirect via stubs in that folder, which also keeps the dated
plan documents — including this folder's structure plan,
[`STRUCTURE-PLAN.md`](../docs/html-in-canvas/STRUCTURE-PLAN.md).

## Pages

| page | what it is |
|---|---|
| `test-renderer.html` | The studio: gallery + stage + CodeMirror HTML/CSS/JS tabs + AI paste + JSON import (duration auto-detected from the choreography) + storyboard deep links + frame-exact MP4 / wall-clock WebM export |
| `designs.html` | Designs gallery — 40 entries from `designs-gallery.json`, thumbnails rendered live, copy-prompt, Google Sheets submit, preview modal ([`hic-modal.js`](hic-modal.js)) |
| `prompts-engineer.html` | Visual prompt builder — 8 modules, recipes, 1–30 s slider (typeable to 600 s), and a preview rail that measures a pasted reply's real length |
| `styleboard.html` | Component style board (planned, R3 — see the structure plan) |

## Engine (shared, in `engine/`)

| file | loaded by | what it is |
|---|---|---|
| [`engine/hic-frame.js`](engine/hic-frame.js) | all three pages | Renderer core: HTML → SVG `foreignObject` raster, pure `onFrame(t)` seek, lazy Tailwind runtime, CSS `@keyframes` materialization, design-space/frame controls, and the authored-length probe (`probeAuthoredSec`) that measures how long a clip's choreography really runs |
| [`engine/hic-modal.js`](engine/hic-modal.js) | designs | Shared clip preview modal (player, scrubber, export toolbar) |
| [`engine/hic-storyboard.js`](engine/hic-storyboard.js) | test-renderer + automation | Storyboard → clip compiler: powers the `#storyboard=` deep link and the IITM Storyboard preset; automation-only on the reel side (the emitter the `reel-*` gates drive) |
| [`engine/hic-theme.css`](engine/hic-theme.css) · [`engine/hic-theme.js`](engine/hic-theme.js) | css: all · js: test-renderer, prompts-engineer | M3 token layer (light + dark) + no-flash theme boot (`localStorage('hic_theme')`) |
| [`engine/fix-webm-duration.js`](engine/fix-webm-duration.js) | designs, test-renderer | Vendored third-party: patches the WebM Duration element MediaRecorder never writes — do not restyle or reformat |
| [`designs-gallery.json`](designs-gallery.json) | designs, prompts-engineer | The gallery data (40 designs + `updatedAt`) |

## Folder structure — the rule

**Pages and data flat at the root, engine libraries in `engine/`, documents
in `docs/html-in-canvas/`.** This folder is deployed, its files load each
other by relative path, and its filenames are named in `vite.config.js`, the
redirect stubs and the automation — so layout is contract, not taste.

```
html-in-canvas/
├── designs.html · test-renderer.html · prompts-engineer.html   ← live URLs
├── designs-gallery.json                                        ← gallery data
├── README.md                                                   ← this file
└── engine/            ← hic-frame, hic-modal, hic-storyboard,
                          hic-theme.js/.css, fix-webm-duration
```

[`docs/html-in-canvas/STRUCTURE-PLAN.md`](../docs/html-in-canvas/STRUCTURE-PLAN.md)
records the inventory, the contracts, and how the `engine/` split (S3) was
applied — including the deploy-skew decision.

## The automation contract (frozen API)

The reel automation drives `test-renderer.html` through CDP against named
globals and DOM ids: `PRESETS`, `currentPresetKey`, `modalRenderer`,
`modalSlider`, the import chain (`parseImportedFile → fillPanesFromImport →
setClip`), and the export pump protocol (`window.__hicExportProgress` /
`window.__hicExportResult`). The designs↔test-renderer handoff (`hic-code`
JSON) is a second contract. Restyle around these; don't rename them. The
consumers: `automation/studio-reel/export-films.cjs` (PAGE_PATH),
`automation/shared/export/doctor.cjs`, `automation/studio-reel/reel-export-gate.cjs`,
and the five `reel-*` gates (EMITTER → `hic-storyboard.js`).

## Site-base rule

Both `test-renderer.html` and `hic-frame.js` derive the site base (for
`vendor/…` assets) by finding `/html-in-canvas/` in their own path —
`/studio-pro/` under GitHub Pages, `/` locally. If you rename this folder,
change both derivations together.
