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
        icons: [{ src: 'og-image.png', sizes: '1200x630', type: 'image/png' }]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,woff,ttf,png,svg,ico,webp,jpg,jpeg}'],
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
        navigateFallbackDenylist: [/docs\/.*\.html$/, /docs\/[^?#]*\/$/],
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
