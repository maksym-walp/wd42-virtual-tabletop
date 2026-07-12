import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      manifest: {
        name: 'Walp Tabletop',
        short_name: 'Walp',
        description: 'Інструменти для настільної рольової гри Walp',
        start_url: '/',
        display: 'standalone',
        theme_color: '#5b440a',
        background_color: '#f4efe4',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Default globPatterns is narrower than it looks — verified that
        // favicon.ico/apple-touch-icon.png don't get precached without this,
        // and woff2 (self-hosted fonts) need it explicitly for offline use.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff2}'],
        // API-запити навмисно НЕ кешуються (NetworkOnly): персонажі, заклинання
        // тощо — дані конкретного юзера, і сервіс-воркер ніколи не повинен
        // віддавати їх офлайн як засталі. Не міняти на StaleWhileRevalidate/
        // NetworkFirst з кешем без дуже вагомої причини.
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // When running behind nginx on port 80, HMR websocket must connect to port 80
    hmr: {
      clientPort: 80,
    },
  },
});
