import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Force the new service worker to activate immediately, overriding cache
        skipWaiting: true,
        clientsClaim: true
      },
      includeAssets: ['flavicon.png', 'logo.png', 'logo white.png', 'logo black.png', 'pwa-192x192.png', 'pwa-512x512.png', 'maskable-icon.png'],
      manifest: {
        name: 'Invictus Calendar',
        short_name: 'Invictus',
        description: 'Gym Session Booking and Management Platform',
        theme_color: '#000000',
        background_color: '#ffffff',
        display: 'standalone',
        id: '/',
        start_url: '/',
        scope: '/',
        orientation: 'portrait',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/maskable-icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
})
