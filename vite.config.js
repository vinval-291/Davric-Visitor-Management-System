import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // "prompt", not "autoUpdate". A silent reload could wipe a
      // half-filled visitor form while somebody is standing at the
      // desk. The user is asked instead.
      registerType: 'prompt',
      injectRegister: false, // registered from React, so no inline script
      includeAssets: ['davric-logo.webp', 'icons/*.png'],

      manifest: {
        id: '/',
        name: 'Dav-Ric Group Visitor Management',
        short_name: 'Dav-Ric VMS',
        description:
          'Visitor registration, signatures and arrival notifications for Dav-Ric Group reception.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f7f7f7',
        theme_color: '#ff000d',
        lang: 'en',
        categories: ['business', 'productivity'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          {
            name: 'Register a visitor',
            short_name: 'New visitor',
            url: '/reception/new',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Visitor notifications',
            short_name: 'Alerts',
            url: '/pa',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
        ],
      },

      // Our own service worker, injected with the asset manifest.
      // See src/sw.js for why Workbox's generator is not used.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,webp,svg,woff2}'],
      },

      devOptions: { enabled: false },
    }),
  ],

  server: { port: 5173 },

  build: {
    rollupOptions: {
      output: {
        // Split the dependencies out of the app bundle. They change
        // only when we upgrade a package, so a returning tablet keeps
        // them cached across every deploy of our own code.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (id.includes('react-router')) return 'vendor-router'
          if (id.includes('/react/') || id.includes('react-dom')) return 'vendor-react'
        },
      },
    },
  },
})
