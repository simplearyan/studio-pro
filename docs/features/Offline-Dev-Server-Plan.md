# Offline Dev Server — Plan

**Status:** plan (not implemented)
**Scope:** `index.html` head + `public/` vendor assets (Vite dev & build)

## 1. Problem

Running `npm run dev` while offline breaks StudioPro at **boot**. The console shows
exactly four errors (see screenshot):

```
Failed to load resource: fonts.googleapis.com/... — net::ERR_INTERNET_DISCONNECTED
Failed to load resource:   lucide.min.js:1 — net::ERR_INTERNET_DISCONNECTED
Failed to load resource:   tex-svg.js:1 — net::ERR_INTERNET_DISCONNECTED
Uncaught ReferenceError: lucide is not defined   (index):1017
```

The last one is the killer: the app script calls `lucide.createIcons()` **synchronously
at boot**, so when the Lucide CDN script fails to load, the entire editor never starts.

## 2. Dependency audit (everything in `<head>`)

| # | Resource | Location in `index.html` | Load | Offline impact | Priority |
|---|---|---|---|---|---|
| 1 | **Lucide icons** `unpkg.com/lucide@1.28.0/dist/umd/lucide.min.js` | line 74 | **sync, blocking** | **App fails to boot** (`ReferenceError`, 51 unguarded `lucide.*` call sites) | 🔴 Critical |
| 2 | **Google Fonts** `fonts.googleapis.com/css2?...` (10 families) | line 70 | sync CSS | UI/text-clip fonts fall back to system fonts — app still runs | 🟡 High (UX) |
| 3 | **MathJax** `cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js` | line 87 | async | Math clips (`renderAsMath`) don't render; already guarded with retry loop (line ~3657), app runs | 🟠 Medium |
| 4 | **Runtime Google Font imports** — `loadGoogleFonts()` / `importGoogleFontFromInput()` (lines 1936, 7114) | JS | async, per user font | User-imported fonts silently missing | 🟠 Low |

Vite itself needs **zero** network: the project, `src/styles/style.css` (Tailwind
`@import` only), and all app code are local. Only these four CDN touches break offline.

---

## 3. Fix strategy (phased)

### Phase 0 — Boot hardening (do first; tiny, fixes the crash immediately)

1. **Add a local Lucide shim before the app script** so a missing CDN can never throw:
   ```html
   <script>
       // Offline-safe fallback: if the Lucide CDN is unreachable, keep a no-op
       // createIcons so the app boots; icons are swapped in when the vendor copy
       // loads (or by Phase 1's local script).
       window.lucide = window.lucide || { createIcons: function () {}, createIconsSync: function () {} };
   </script>
   ```
   This alone converts the boot `ReferenceError` into a running (icon-less) editor.

2. **CDN `onerror` fallback** on the Lucide `<script>` tag — if the CDN copy fails,
   inject the local vendor copy (Phase 1) and re-run `lucide.createIcons()`:
   ```html
   <script src="https://unpkg.com/lucide@1.28.0/dist/umd/lucide.min.js"
           onerror="loadLocalLucide()"></script>
   ```
   `loadLocalLucide()` appends `<script src="/vendor/lucide.min.js">`, then calls
   `lucide.createIcons()` on its `onload`. Online users keep the CDN cache; offline
   users get the local copy — no code changes anywhere else.

### Phase 1 — Vendor Lucide locally (the real fix)

- The repo **already contains a local copy**: `_archive/lucide.min.js` (409 KB,
  UMD build — exactly what the app's `lucide.createIcons()` global needs).
- Copy it to `public/vendor/lucide.min.js` (Vite serves `public/` at the root →
  URL `/vendor/lucide.min.js`, correct MIME, bundled into `dist/` on build).
- Replace the CDN `<script src>` with the local file. Optionally keep the CDN-first
  + `onerror` fallback from Phase 0 so you never regress online caching.
- **No JS refactor required**: the app already talks to the global `lucide` object;
  a vendored UMD file provides the identical global. (Alternative worth noting:
  `npm i lucide` + `import { createIcons } from 'lucide'` with
  `window.lucide = { createIcons }` — bundler-friendly but touches nothing else;
  not needed.)

### Phase 2 — Vendor Google Fonts locally

The app needs 10 families (UI: **Plus Jakarta Sans**, **JetBrains Mono**; text clips:
**Rubik**, Inter, Bangers, Bebas Neue, Fredoka, Lora, Montserrat, Oswald).

1. **Download the woff2 files** for the exact weights/italics the app uses (the CSS
   `family=...` list at line 70) into `public/fonts/`.
   - Use the Google Fonts CSS URL's `woff2` srcs (or `gfonts`/`fontsource` npm
     packages) so the files are the same subsets the CDN would serve.
2. **Add `public/fonts/fonts.css`** with local `@font-face` rules (same family names
   + weights as today, so no text-clip or CSS changes).
3. **Swap the `<link>` at line 70** to `href="/fonts/fonts.css"` (local-first).
   Optional: keep a second Google Fonts `<link>` for browsers with a network to top
   up any missing weights (`display=swap` keeps it non-blocking).
4. Confirm the Tailwind theme (`tailwind.config.js` `font-sans`/`font-mono`) still
   resolves to the local families — no change expected, names stay identical.

### Phase 3 — Vendor MathJax locally

- `mathjax@3/es5/tex-svg.js` is a **single self-contained bundle** (~1 MB) and the
  app config sets `svg: { fontCache: 'none' }` — SVG output embeds glyph paths, so
  **no extra font files** are fetched at render time.
- Download it to `public/vendor/mathjax/tex-svg.js` and swap the `src` at line 87.
- The existing guard + retry loop (line ~3657) stays as-is; math then works offline
  with zero code changes.
- Size note: 1 MB is fine for a local dev server and a static `dist/` deploy; if it
  ever matters, lazy-load MathJax only when the first `renderAsMath` clip is used.

### Phase 4 — Runtime Google Font imports (nice-to-have)

`loadGoogleFonts()` / `importGoogleFontFromInput()` inject Google Fonts `<link>`s for
user-saved fonts (`studiopro_google_fonts`). Offline they 404 silently. Options, in
order of effort:

1. Detect the failure (`link.onerror`) and show a small toast: "Offline — font X
   unavailable" (keeps expectations clear).
2. Cache the fetched CSS + woff2 in Cache Storage on first success; serve from cache
   offline (Phase 5's service worker does this automatically).

### Phase 5 (future) — Full offline for production, not just dev

- Add `vite-plugin-pwa` with a **service worker that precaches** the whole `dist/`
  (including `vendor/` and `fonts/`). Then the deployed site (GitHub Pages) also
  runs fully offline after the first visit, and the dev-mode `onerror` fallbacks
  become belt-and-suspenders.
- Out of scope for the immediate "local dev offline" ask, but it's the natural end
  state: zero CDN dependencies at runtime.

---

## 4. Implementation outline (when approved)

1. `mkdir public/vendor && cp _archive/lucide.min.js public/vendor/lucide.min.js`
2. Add the Lucide shim + `onerror` fallback snippet in `<head>` (Phase 0).
3. Swap the Lucide `<script src>` (line 74) to the vendor file.
4. Download font woff2s → `public/fonts/`, write `public/fonts/fonts.css`, swap the
   fonts `<link>` (line 70).
5. Download MathJax → `public/vendor/mathjax/tex-svg.js`, swap the `<script src>`
   (line 87).
6. Optional: `link.onerror` toast for runtime font imports (Phase 4).

No `vite.config.js` change is required — everything under `public/` is served and
copied to `dist/` as-is. (`optimizeDeps` is only relevant for imports, and these are
plain script/link tags.)

## 5. Verification checklist

- [ ] **Offline boot:** network disabled (or DevTools → Network → Offline) +
      `npm run dev` → editor boots, timeline/toolbar render, no console errors.
- [ ] **Icons:** all `data-lucide` icons render (toolbar, panels, timeline).
- [ ] **Fonts:** UI + text-clip fonts render identically to online (Rubik text clip
      looks right, not a generic fallback).
- [ ] **Math:** a `$$...$$` markdown clip / `renderAsMath` text clip renders.
- [ ] **Online regression:** with network on, everything still works; if CDN-first
      fallback is used, the CDN copy loads and the local copy is never double-loaded.
- [ ] **Build:** `npm run build` includes `vendor/` + `fonts/` in `dist/` and the
      built site loads offline (via file/static server).
- [ ] No `ERR_INTERNET_DISCONNECTED` / `ReferenceError` for app assets in the console.
