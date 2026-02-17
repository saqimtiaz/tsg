// filepath: c:\Users\saq\webdav\tsg\stories\vite.config.js
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  root: '.', // Root directory
  publicDir: 'public', // Static assets
  base: '/tsg/stories/', // Use relative paths for production

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: './index.html'
      },
      output: {
        entryFileNames: 'assets/app.[hash].js',
        chunkFileNames: 'assets/chunk.[hash].js',
        assetFileNames: 'assets/[name].[hash][extname]'
      }
    }
  },

  server: {
    port: 3000,
    open: true,
    cors: true
  },

  plugins: [
    VitePWA({
      registerType: 'autoUpdate',

      // Use injectManifest mode to keep your existing SW
      srcDir: 'public',           // your SW location
      filename: 'sw.js',          // your SW file
      strategies: 'injectManifest',       // inject precache manifest into your SW

      includeAssets: ['fonts/**/*', 'icons/**/*'],

      manifest: {
        "name": "TSG Stories",
        "short_name": "TSG Stories",
        "start_url": "/tsg/stories/",
        "scope": "/tsg/stories/",
        "display": "standalone",
        "background_color": "#111111",
        "theme_color": "#111111",
        "icons": [
            { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
            { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
        ],
        "share_target": {
            "action": "/tsg/stories/index.html",
            "method": "POST",
            "enctype": "multipart/form-data",
            "params": {
            "files": [
                {
                "name": "photo",
                "accept": ["image/*"]
                }
            ]
            }
        }
        },

      workbox: {
        // precache all JS/CSS/HTML/asset files
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf}'],

        // runtime caching (fonts or external resources)
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ]
});
