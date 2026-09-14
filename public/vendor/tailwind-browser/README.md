# Vendored: @tailwindcss/browser

- Source: `@tailwindcss/browser@4.3.3` (npm)
- File: `index.global.js` (copied from `node_modules/@tailwindcss/browser/dist/`)
- Why: HTML-in-Canvas clips can use Tailwind utility classes. The browser build
  compiles them at runtime — vendored so it works offline and matches the exact
  version of the app's PostCSS toolchain (no cdn.tailwindcss.com, no production
  warning).
- Version bump: update the npm devDependency, then re-copy dist/index.global.js here.
- Loaded on demand by docs/html-in-canvas/test-renderer.html (and, after the
  editor asset-pipeline port, by the Studio Pro HIC renderer) — never in the
  app's own UI path.
