# PWA / Service Worker — Full Offline for the Deployed Site

**Status:** plan → implemented
**Goal:** after a user visits the deployed site **once**, the whole app (editor,
icons, fonts, MathJax) works from the browser cache with **no network** — the
same offline guarantee the dev server now has, but for production.

Phases 0–3 vendored Lucide, Google Fonts and MathJax locally so the *code itself*
never needs the network. This step adds a **service worker** so the *browser*
remembers the files between visits.

---

## 1. How it impacts things

| Aspect | Before | After |
|---|---|---|
| First visit (online) | loads from server | identical — precaches everything in the background |
| **Later visits, offline** | blank/failed page | **fully working app** from cache |
| `npm run dev` | unchanged | unchanged — **no service worker in dev** (opt-in via `devOptions`) |
| `npm run build` | `dist/` files only | `dist/` + generated **`sw.js`** + **`manifest.webmanifest`** + inline SW registration |
| Installability | no | app manifest + icon → "Add to home screen" / Install prompt |
| GitHub Pages deploy | push `dist/` | push `dist/` (now includes the SW) — no server config needed |

### What gets precached

The **entire `dist/`**: HTML, the app JS/CSS bundles, `public/vendor/` (Lucide,
MathJax), `public/fonts/` (all 66 woff2 + `fonts.css`), images, manifest.
Workbox precaches only files whose names **change when their content changes**
(hashed bundles); the big MathJax file (2.1 MB) is included by raising
`maximumFileSizeToCacheInBytes` above the 2 MB workbox default.

### Caveats to know

- **Service workers need HTTPS** (or `localhost`). GitHub Pages is HTTPS, so it's
  fine in production; `vite preview` on `localhost` also works for testing.
- The SW only activates **after the first successful visit** — a brand-new user
  who goes offline before ever visiting gets nothing (impossible to avoid).
- Old cached copies are **automatically pruned** (workbox `cleanupOutdatedCaches`).

---

## 2. What if the user updates code? (deploy flow)

1. **Rebuild:** `npm run build` → new hashed asset filenames + a **new `sw.js`**
   whose precache manifest lists the new files.
2. **Redeploy:** push the new `dist/` (GH Actions does this already).
3. **Users update automatically** (`registerType: 'autoUpdate'`):
   - On their next visit (or when the page is refreshed), the browser fetches the
     new `sw.js`, installs it, **activates it and reloads the page once** — they
     get the new version without doing anything.
   - Old precache entries from the previous build are pruned automatically.
4. **No manual cache clearing, ever.** If a user is mid-session with a tab open,
   the new SW takes control on their next navigation/reload. (If you ever prefer
   a "Update available — refresh?" prompt instead of auto-reload, switch
   `registerType` to `'prompt'` and add a small UI.)

> Dev tip: the service worker is **not** registered while using `npm run dev`,
> so iterating on code is unaffected — you'll never be served a stale dev page.

---

## 3. Do we need to download packages? (package.json changes)

**Yes — one-time dev dependencies** (they only run at build time; the generated
`sw.js` needs no runtime library):

```bash
npm install -D vite-plugin-pwa workbox-build workbox-window
```

- **`vite-plugin-pwa` ^1.3.0** — the plugin (supports Vite ^8).
- **`workbox-build` ^7.4** — generates the precache service worker at build time.
- **`workbox-window` ^7.4** — required peer; with `injectRegister: 'inline'` the
  registration script is inlined and this package is not actually bundled.

**This needs network once** (the `npm install`). After that:
- `package.json` + `package-lock.json` gain the three devDependencies — commit them.
- `npm run build` generates `sw.js` **fully offline** — no CDN involved.
- `node_modules` grows by ~a few MB (workbox tooling, dev-only).

No runtime dependencies, no CDN, nothing the deployed page fetches.

---

## 4. Implementation (what was changed)

### `vite.config.js`

```js
import { VitePWA } from 'vite-plugin-pwa';

const isActions = process.env.GITHUB_ACTIONS === 'true';
const base = isActions ? '/studio-pro/' : '/';

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'inline',
      manifest: {
        name: 'StudioPro — Free Online Video Editor',
        short_name: 'StudioPro',
        description: 'Free browser-based video editor: multi-track timeline, Markdown-to-video, captions, keyframes and fast MediaBunny export.',
        theme_color: '#171717',
        background_color: '#171717',
        display: 'standalone',
        icons: [{ src: 'og-image.png', sizes: '1200x630', type: 'image/png' }]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,woff,ttf,png,svg,ico,webp,jpg,jpeg}'],
        // MathJax's combined bundle is 2.1 MB — above workbox's 2 MB default.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: base + 'index.html',
        cleanupOutdatedCaches: true
      }
    })
  ]
});
```

- `base` is respected for the SW registration path and every precache URL, so the
  GitHub Pages deploy (`/studio-pro/`) and local builds (`/`) both work.
- `navigateFallback` serves `index.html` from cache for any in-app navigation
  while offline.
- `devOptions.enabled` stays **false** (default) → no SW in `npm run dev`.

### Generated in `dist/` on every build

- `sw.js` — the precache service worker (contains the full file list + hashes).
- `manifest.webmanifest` — app manifest.
- `index.html` — gains a tiny inline `registerSW()` snippet that registers the SW.

---

## 5. Verification checklist

- [ ] `npm run build` succeeds; `dist/sw.js`, `dist/manifest.webmanifest` exist.
- [ ] `grep registerSW dist/index.html` shows the inline registration.
- [ ] `npm run preview` (or GH Pages) → first load online → DevTools →
      Application → Service Workers shows an **activated** worker; Cache Storage
      lists `workbox-precache` with the assets.
- [ ] Reload → Network panel → **Offline** → the app still boots, icons render,
      fonts render, MathJax renders a formula.
- [ ] Rebuild after a code change → reload → new SW activates, old precache
      entries pruned, no stale UI.
- [ ] `npm run dev` shows **no** service worker (dev unaffected).
