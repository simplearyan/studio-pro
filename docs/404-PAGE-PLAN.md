# Custom 404 page — plan

**Do you need a framework? No.** GitHub Pages serves a custom `404.html` from the
root of the published site automatically, for any missing path, with a real 404
status — no SPA router, no server config, no dependency. This site is already
framework-free static HTML; the 404 page is one more static file. Adding a
framework (or a router) to get a 404 page would be strictly worse: more weight,
another build step, and it fights the "each page is a gate-able standalone file"
model the whole repo is built on.

## How GitHub Pages finds it

- Pages looks for a file literally named `404.html` at the **root of the
  published content**. For this project site that is `/studio-pro/404.html`, i.e.
  `dist/404.html` after `vite build`.
- It is returned with HTTP 404 for **any** unmatched URL under the site
  (`/studio-pro/whatever`, `/studio-pro/clip-lite/old`, a mistyped deep link).
- Because the service worker's `navigateFallback` is now **off** (see the
  clip-lite shadow fix), a missing navigation reaches the network and GitHub Pages
  hands back this page — the SW no longer swallows unknown URLs into the app shell.

## The one real subtlety: base-relative links

The page must work at both bases — `/` (local `npm run dev`) and `/studio-pro/`
(GitHub Pages). The repo already solved exactly this in
`html-in-canvas/test-renderer.html:2738`:

```js
var _slash = location.pathname.indexOf('/html-in-canvas/');
var _siteBase = _slash > 0 ? location.pathname.slice(0, _slash + 1) : '/';
```

The 404 page derives its base the same way (anchor on a known folder, or simply
take everything up to the last `/` after the repo name). Since a 404 can fire at
ANY depth, do not use plain relative links (`../foo`) — they break on nested 404s.
Resolve every href against the derived `_siteBase`:

```html
<script>
  /* siteBase = '/studio-pro/' on Pages, '/' locally. A 404 can fire at any
     depth, so links resolve from the site base, never the current directory.
     On Pages every URL — including any 404 — lives under the repo's first
     segment, so the first path segment IS the base. The only URL the dev
     server can show this page at is the single-segment '/404.html', which
     has no trailing slash, so the regex misses and falls through to '/'. */
  var m = location.pathname.match(/^\/[^/]+\//);
  var siteBase = m ? m[0] : '/';
  var links = [
    ['Studio Pro editor',        ''],
    ['Clip Lite (phone)',        'clip-lite/'],
    ['Clip Lite self-check',     'clip-lite/selfcheck.html'],
    ['HTML-in-Canvas studio',    'html-in-canvas/test-renderer.html'],
    ['Designs gallery',          'html-in-canvas/designs.html'],
    ['Prompt engineer',          'html-in-canvas/prompts-engineer.html']
  ];
  /* render the list into <ul id="nav"> with href = siteBase + path */
</script>
```

Deriving `siteBase` from the **first** path segment (`/^\/[^/]+\//`) is the
robust choice for a 404, because the failing URL can be arbitrarily deep and
there is no reliable "current folder" to climb from.

## Build wiring — copy, don't route

Add `404.html` via the existing `vite-plugin-static-copy` entries in
`vite.config.js`, **not** as a `build.rollupOptions.input` entry. Reason (same as
Clip Lite): a rollup HTML entry makes Vite treat the page as an app shell and
VitePWA injects the Studio Pro `<link rel="manifest">` + root `sw.js` registration
into it — wrong for a 404 page. Static copy keeps `dist/404.html` byte-identical
to the source.

```js
{ src: '404.html', dest: '.', rename: { stripBase: true } },   // → dist/404.html
```

## Precache

Add `404.html` to `workbox.globIgnores` (alongside `docs/**`, `clip-lite/**`,
`html-in-canvas/**`). It is served by GitHub Pages server-side, never by the SW,
so keeping it out of the cache-first precache avoids a stale entry and matches the
treatment of every other non-app-shell page.

## Design

Match the existing dark studio chrome (`#171717` theme, the Play-mark SVG favicon
data-URI reused from `index.html`). Big "Page not found", the derived URL shown
back, then the nav list. Self-contained: inline CSS, no external requests, works
offline-from-precache as a plain document. `noindex` meta so the 404 never enters
search.

## Files

| change | file | note |
|---|---|---|
| new 404 page | `404.html` | self-contained, base-derived links, dark chrome |
| copy to dist | `vite.config.js` static-copy | `dest:'.'` → `dist/404.html` |
| exclude from precache | `vite.config.js` `globIgnores` | add `'404.html'` |

## Verification

1. `npm run build` → `dist/404.html` exists at the dist root, byte-identical to source.
2. Local: `npm run dev`, open `http://localhost:3000/does-not-exist` — dev server
   does not auto-serve 404.html, so instead open `/404.html` directly and confirm
   every nav link resolves (no 404 on the targets) under `/`.
3. Pages: after deploy, hit `https://simplearyan.github.io/studio-pro/zzz` → the
   custom page renders (not the default GitHub 404), and each link resolves under
   `/studio-pro/`.
4. Confirm `dist/sw.js` still has **no** `NavigationRoute` and `404.html` is not in
   the precache manifest.

## Non-goals

- No client-side router, no framework. The 404 is a static document; GitHub Pages
  does the matching. The clip-lite shadow fix (`navigateFallback: null`) is what
  lets unknown URLs reach this page in the first place.
