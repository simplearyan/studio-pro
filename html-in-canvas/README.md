# html-in-canvas — the HIC toolkit

HTML in, animated video out. Three pages plus the engine they share, all raw
static files (no build step) so every page is gate-able and shippable to
GitHub Pages as-is. Moved here from `docs/html-in-canvas/` in R1 of
`docs/html-in-canvas/REDESIGN-AND-RELOCATION-PLAN.md`; the old URLs redirect
via stubs in that folder, which also keeps the dated plan documents.

## Pages

| page | what it is |
|---|---|
| `test-renderer.html` | The studio: gallery + stage + CodeMirror HTML/CSS/JS tabs + AI paste + import + frame-exact MP4 / wall-clock WebM export |
| `designs.html` | Designs gallery — 40 entries from `designs-gallery.json`, thumbnails rendered live, copy-prompt, Google Sheets submit |
| `prompts-engineer.html` | Visual prompt builder (8 modules, 1–30s duration slider) |
| `styleboard.html` | Component style board (planned, R3) |

## Engine (shared)

| file | what it is |
|---|---|
| `hic-frame.js` | Renderer core: HTML → SVG foreignObject raster, pure `onFrame(t)` seek, lazy Tailwind runtime, CSS `@keyframes` materialization |
| `hic-modal.js` | Shared clip preview modal (player, scrubber, export) |
| `hic-storyboard.js` | Reel emitter runtime — **automation-only**, no page loads it |
| `hic-theme.css` / `hic-theme.js` | M3 token layer (light + dark) + no-flash theme boot (`localStorage('hic_theme')`) |
| `fix-webm-duration.js` | Vendored third-party: patches the WebM Duration element MediaRecorder never writes — do not restyle or reformat |

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
