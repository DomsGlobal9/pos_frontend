import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * The till is an installable PWA, and that is the single most valuable POS-specific choice in this
 * product. It buys three things at once:
 *
 *   - instant load after the first visit, which is most of the 150 ms scan-to-line budget
 *   - it keeps working when the shop's line drops
 *   - it installs onto a shop's Windows machine or tablet with no app store, no installer and no
 *     per-shop packaging -- which is why this is not Electron
 *
 * Port 5175 because Inventory admin (5173) and two other local configs already claim 5173-5174,
 * and all of them are open at once during the cut-over.
 */
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  // The version a device reports in its check-in (POS-DEV-004), so the owner can see which till is
  // still on an old build.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      // 'prompt' + our own register (src/lib/update.js): a new version waits until the till is idle,
      // rather than reloading under a cashier mid-bill. It looks for one every 15 minutes.
      registerType: 'prompt',
      injectRegister: false,
      // Injected by the plugin, not hand-written: a hand-written service worker that caches the app
      // shell wrongly is how a shop ends up stuck on a version from last month with no way to
      // clear it.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // A till is opened once and left open for a trading day. Skip waiting so a fix reaches the
        // counter on the next reload rather than whenever the last tab happens to close.
        skipWaiting: false,
        clientsClaim: true,
        // NEVER cache the API. Stock, prices and a customer's balance must not be served from a
        // service worker -- a cached balance is exactly the number that is wrong. What the till
        // keeps for offline use is held deliberately in IndexedDB, not accidentally here.
        navigateFallbackDenylist: [/^\/api\//]
      },
      manifest: {
        name: 'ScaleEzy POS',
        short_name: 'POS',
        description: 'The till: sell, take payment, print the bill.',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        // A till is a counter job, landscape on a shop machine or tablet. Never sold on phones.
        display: 'standalone',
        orientation: 'landscape',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ],
  server: {
    port: 5175,
    // So the till calls /api/v1/... in dev exactly as it will in production, rather than carrying a
    // different base URL in each environment.
    proxy: {
      '/api': {
        target: 'http://localhost:4007',
        changeOrigin: true
      }
    }
  }
})
