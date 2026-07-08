import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Rilievo Incendi',
        short_name: 'Incendio',
        description: 'Censimento rapido piante danneggiate da incendio',
        lang: 'it',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        background_color: '#f5f4ef',
        theme_color: '#14532d',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
        navigateFallback: 'index.html'
      }
    })
  ],
  server: { port: 5173, strictPort: true }
});
