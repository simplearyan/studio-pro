import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages deploys under /studio-pro/; local dev/builds use the root. The
// PWA plugin respects `base` for the SW registration path and every precache
// URL, so both deploy targets work. See docs/features/PWA-Offline-Service-Worker.md.
const isActions = process.env.GITHUB_ACTIONS === 'true';
const base = isActions ? '/studio-pro/' : '/';

export default defineConfig({
  base: base,
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
        // MathJax's combined bundle (tex-svg.js) is ~2.1 MB — above workbox's
        // 2 MB default precache limit, so raise it.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: base + 'index.html',
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
