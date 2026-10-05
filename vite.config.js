import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// GitHub Pages deploys under /studio-pro/; local dev/builds use the root. The
// PWA plugin respects `base` for the SW registration path and every precache
// URL, so both deploy targets work. See docs/features/PWA-Offline-Service-Worker.md.
const isActions = process.env.GITHUB_ACTIONS === 'true';
const base = isActions ? '/studio-pro/' : '/';

export default defineConfig({
  base: base,
  plugins: [
    // Ship the HIC test-renderer page (raw copy, no bundling) so it is reachable
    // on GitHub Pages at <base>docs/html-in-canvas/test-renderer.html. Static
    // copy keeps the file byte-identical between dev and production.
    viteStaticCopy({
      targets: [
        /* Classic (non-module) scripts referenced by index.html are NOT bundled
           or emitted by Vite — the tag is left verbatim, so without a copy the
           file 404s in production. This adapter must load before the app script
           that compiles the ported WAAPI presets. */
        { src: 'src/engines/hic/adapters/waapi.js', dest: 'src/engines/hic/adapters', rename: { stripBase: true } },
        /* v4 keeps the full source dir under dest unless stripped — stripBase
           flattens so the file lands at <outDir>/docs/html-in-canvas/ */
        { src: 'docs/html-in-canvas/test-renderer.html', dest: 'docs/html-in-canvas', rename: { stripBase: true } },
        /* Every page in docs/studio-lite/ ships: the tier/palette mock, the
           YouTube-Create study, both Clip Lite iterations, and index.html — the
           folder's front door, which Pages serves for the bare directory URL
           <base>docs/studio-lite/. Globbed rather than listed one by one so a new
           prototype deploys without editing this file. Like the HIC pages they load
           the vendored Tailwind runtime and the fonts by RELATIVE path (../../vendor,
           ../../fonts), so they need no bundling — only to exist under
           <outDir>/docs/studio-lite/. */
        { src: 'docs/studio-lite/*.html', dest: 'docs/studio-lite', rename: { stripBase: true } },
        /* ...and its web app manifest. Without this the page links a manifest
           that 404s in production, so it cannot be installed from the deployed
           site — the html glob above does not match it. */
        { src: 'docs/studio-lite/*.webmanifest', dest: 'docs/studio-lite', rename: { stripBase: true } },
        /* The live Clip Lite app in clip-lite/ — its page, its own web app
           manifest (without this the page links a manifest that 404s on Pages
           and cannot be installed), and the self-check suite that drives it.
           All three are listed individually rather than globbed because this
           folder is a real app, not a folder of prototypes, and the split
           matters on purpose:

           Clip Lite is copied rather than added to build.rollupOptions.input.
           As a rollup entry Vite treats the page as an app shell and VitePWA
           then injects STUDIO PRO's <link rel="manifest"> and a root-scoped
           register('/sw.js', {scope:'/'}) into it — verified in the build
           output before this was changed. That silently overwrites the
           app-specific manifest this folder ships and puts the page under
           Studio Pro's service worker, which is the opposite of what the app
           wants (CLIP-LITE-HOME-PLAN.md §8 risk 6). Static copy keeps
           dist/clip-lite/index.html byte-identical to the source file.

           The frozen docs/studio-lite/ copies above keep shipping unchanged,
           so the old URL keeps working. See clip-lite/docs/CLIP-LITE-HOME-PLAN.md. */
        { src: 'clip-lite/index.html', dest: 'clip-lite', rename: { stripBase: true } },
        { src: 'clip-lite/selfcheck.html', dest: 'clip-lite', rename: { stripBase: true } },
        { src: 'clip-lite/manifest.webmanifest', dest: 'clip-lite', rename: { stripBase: true } },
        /* /designs gallery page + its synced data file (Phase A/B of
           docs/html-in-canvas/DESIGNS-GALLERY-PLAN.md) */
        { src: 'docs/html-in-canvas/designs.html', dest: 'docs/html-in-canvas', rename: { stripBase: true } },
        { src: 'docs/html-in-canvas/designs-gallery.json', dest: 'docs/html-in-canvas', rename: { stripBase: true } },
        /* /prompts-engineer builder page (Phase A of PROMPTS-ENGINEER-PLAN.md) */
        { src: 'docs/html-in-canvas/prompts-engineer.html', dest: 'docs/html-in-canvas', rename: { stripBase: true } },
        /* The shared HIC libs the pages above load by RELATIVE path. Without
           these the deployed pages 404 their own engine (hic-frame.js is
           referenced by all three), so the gallery renders blank and logs
           "mountFrameControls is not defined". hic-theme.* is the Material 3
           token layer those pages resolve every --md-* colour from. */
        { src: 'docs/html-in-canvas/hic-*.js', dest: 'docs/html-in-canvas', rename: { stripBase: true } },
        { src: 'docs/html-in-canvas/hic-theme.css', dest: 'docs/html-in-canvas', rename: { stripBase: true } },
        /* WebM duration patcher — loaded by designs.html and test-renderer.html
           for the export toolbar, same relative-path story as the libs above. */
        { src: 'docs/html-in-canvas/fix-webm-duration.js', dest: 'docs/html-in-canvas', rename: { stripBase: true } }
      ]
    }),
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
        // Stable identity so the installed app is not treated as a new one if
        // start_url ever moves — Chrome keys the app on `id` first, then on
        // start_url, and a changed key leaves the old icon on the home screen.
        id: 'studio-pro',
        // Chrome refuses to offer "Install app" unless it can find BOTH a
        // 192x192 and a 512x512 icon. Until these landed the only entry was
        // og-image.png at 1200x630, which is neither, so the app was not
        // installable at all. Regenerate with `node tools/make-app-icons.cjs`.
        //
        // Paths are relative on purpose: the manifest is served from the app
        // root under whatever `base` is, so relative srcs resolve correctly in
        // dev ("/") and on Pages ("/studio-pro/") without the plugin rewriting
        // them. og-image.png is deliberately NOT listed — it is a 1200x630
        // social card, not an icon, and listing it only confused validators.
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Android adaptive icons are cropped to a circle of 80% diameter, so
          // this one is drawn smaller and its mark sits inside that safe zone.
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          // iOS ignores the manifest and reads <link rel="apple-touch-icon">,
          // which index.html also carries — this entry is for other consumers.
          { src: 'icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,woff,ttf,png,svg,ico,webp,jpg,jpeg}'],
        // Nothing under docs/ or clip-lite/ is precached, and that is the point of the line.
        // A workbox precache is served cache-first and only revalidated when its
        // manifest changes, so a phone that installed the app once keeps the HTML
        // it first downloaded — indefinitely — while a desktop on the same build
        // fetches the new one. That is how a prototype can sit three commits
        // behind on the device that is supposed to be demonstrating it, and it is
        // not fixable from the page: there is no reload that beats a cache-first
        // precache. The pages under here are prototypes and design studies, not
        // app features, so paying a network round trip for them is the right
        // trade. Nothing in src/ or index.html fetches a docs/ path at runtime —
        // the references there are comments — so the app shell is unaffected.
        // Verified against a built sw.js: 14 docs paths before, 0 after. clip-lite/ is
        // excluded for the same reason and measured the same way — see the
        // navigateFallbackDenylist note below, which explains why both halves
        // are needed together.
        globIgnores: ['docs/**', 'clip-lite/**'],
        // MathJax's combined bundle (tex-svg.js) is ~2.1 MB — above workbox's
        // 2 MB default precache limit, so raise it.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Only the app shell navigations fall back to index.html. Requests that
        // name a real static file under docs/ keep their own response — without
        // the "not a navigation" exclusion the SPA fallback serves the app UI in
        // place of the page. Folder-wide rather than one entry per page: the test
        // renderer, the designs gallery, the prompts builder and the Studio Lite
        // mock all live there, and each new one used to reintroduce the bug.
        // The second pattern catches the bare folder URL (/docs/studio-lite/), which
        // carries no .html suffix and would otherwise be handed the app shell.
        //
        // Both .html patterns are anchored on the PATH, not with a trailing `$`,
        // and that is load-bearing. Workbox tests the denylist against the whole
        // URL, so a page loaded with a query string — and the self-check loads
        // every one of its five frames as `<page>.html?db=<name>` so each gets
        // its own IndexedDB — ends in `?db=sc-pixel`, not `.html`, and a `$`
        // anchor lets it straight through to the SPA fallback. Measured: with
        // `/clip-lite\/.*\.html$/` in place, a request for
        // /clip-lite/selfcheck.html?r=1 returned the Studio Pro app shell —
        // correct URL, wrong document. The bare-folder patterns already used
        // `[^?#]*` for this reason; the .html ones did not.
        //
        // clip-lite/ needs the same treatment. It is a root-level app folder,
        // so without a denylist entry a visitor who already has Studio Pro
        // installed is served the app shell at /clip-lite/. The denylist exempts
        // a URL from the fallback; globIgnores above keeps the HTML out of the
        // cache-first precache, which would otherwise pin a stale copy of an app
        // that is still being iterated. Both are needed — either one alone still
        // breaks the page for a returning visitor. Measured: precache is
        // 88 entries / 7256.84 KiB with Clip Lite included, 86 / 6889.11 KiB with it excluded.
        navigateFallbackDenylist: [/docs\/[^?#]*\.html/, /docs\/[^?#]*\/$/, /clip-lite\/[^?#]*\.html/, /clip-lite\/[^?#]*\/$/],
        cleanupOutdatedCaches: true,
        // Runtime caching for the few remaining cross-origin calls:
        //   - unpkg / jsDelivr (CDN-first Lucide, any stray CDN scripts):
        //     StaleWhileRevalidate keeps the CDN copy usable offline.
        //   - fonts.googleapis.com / fonts.gstatic.com (runtime-imported user
        //     fonts via loadGoogleFonts / importGoogleFontFromInput): the CSS and
        //     the woff2 files it references are cached so user fonts keep working
        //     offline too.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname === 'unpkg.com' || url.hostname === 'cdn.jsdelivr.net',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'cdn-vendor',
              expiration: { maxEntries: 10, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: ({ url }) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 3000,
    open: false
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  }
});
