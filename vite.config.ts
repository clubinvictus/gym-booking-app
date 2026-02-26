import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['flavicon.png', 'logo.png', 'logo white.png', 'logo black.png'],
      manifest: {
        name: 'Invictus Calendar',
        short_name: 'Invictus',
        description: 'Gym Session Booking and Management Platform',
        theme_color: '#000000',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/flavicon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/flavicon.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/flavicon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
