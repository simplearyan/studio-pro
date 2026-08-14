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
        cleanupOutdatedCaches: true
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
