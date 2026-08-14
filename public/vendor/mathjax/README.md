# public/vendor/mathjax — Vendored MathJax (offline-safe)

This folder holds a **local copy of MathJax 3** (`tex-svg.js`, the combined
bundle) so LaTeX math clips (`renderAsMath`) render with **zero network
requests**. `index.html` points at `vendor/mathjax/tex-svg.js` instead of
`https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js`.

Served by Vite as a static asset (files in `public/` are copied verbatim into
`dist/`), so no build config changes are needed.

## Why one file is enough

- `es5/tex-svg.js` is the **combined MathJax 3 bundle** — the input (TeX),
  the output (SVG) and the loader are all in a single self-contained file.
  It does **not** fetch sibling files from the CDN at runtime.
- The app config sets `svg: { fontCache: 'none' }` (in the `window.MathJax`
  block in `index.html`). With that, every rendered `<svg>` **embeds the glyph
  paths directly** in the output — MathJax never downloads its own font files,
  so no `.woff`/`.otf` assets need to be vendored.

## Do PC / system fonts get affected?

**No.** MathJax ships and embeds *its own* math fonts (currently none, thanks
to `fontCache: 'none'`); it never uses the system fonts, and the editor's
text/system font handling is completely separate. Vendoring MathJax only
changes *where the MathJax code comes from* — nothing about fonts.

## How to regenerate / update

```bash
curl -sL "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js" \
  -o public/vendor/mathjax/tex-svg.js
```

(`-L` follows the jsDelivr redirect; pin a specific version like
`mathjax@3.2.2` if you want reproducibility instead of the `@3` latest.)

Then confirm `index.html` references the local copy:

```html
<script id="MathJax-script" async src="vendor/mathjax/tex-svg.js"></script>
```

The relative path works in dev (`/vendor/mathjax/tex-svg.js`) and under the
`/studio-pro/` GitHub Pages base.

## Verify

1. `curl -s localhost:3000/vendor/mathjax/tex-svg.js` → 200 (a ~1 MB JS file).
2. Open the editor, add a `$$ ... $$` markdown clip or a text clip with
   `renderAsMath` on → the formula renders (SVG on canvas).
3. DevTools → Network: no `cdn.jsdelivr.net` request for MathJax.
4. `npm run build` → `dist/vendor/mathjax/tex-svg.js` is present.
