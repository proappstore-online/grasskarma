import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { platformNavigationDenylist } from './src/pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2,wasm,json,md}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        // OAuth is a top-level navigation through `/.pas/auth/*`. Without this
        // exclusion Workbox's SPA navigation fallback returns index.html rather
        // than letting the platform issue the new session cookie.
        navigateFallbackDenylist: platformNavigationDenylist,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'GrassKarma',
        short_name: 'GrassKarma',
        description: 'Hyper-local lawn care — neighbours share a mower, street by street.',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#2d7d7d',
        orientation: 'any',
        // @ts-expect-error vite-plugin-pwa's ManifestOptions hasn't picked up the W3C-draft min_viewport_width field yet
        min_viewport_width: 360,
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  server: { host: true },
})
