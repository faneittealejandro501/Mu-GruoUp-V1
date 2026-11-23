import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { terrainTextures } from './tools/flyff/terrain-textures.mjs';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    terrainTextures(),
    {
      name: 'bundle-admin-config',
      generateBundle() {
        for (const name of ['world-rules', 'monsters', 'items', 'item-options', 'npcs', 'classes-skills']) {
          const fileName = `ADMIN/${name}.json`;
          this.emitFile({ type: 'asset', fileName, source: readFileSync(new URL(fileName, import.meta.url)) });
        }
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'icon.svg', 'ota-manifest.json'],
      workbox: {
        maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,wav,ogg,glb,f32,u8,wasm}'],
        globIgnores: ['assets/aistudio/**'],
        runtimeCaching: [
          {
            urlPattern: /\/mugroup\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mugroup-assets-cache',
              expiration: {
                maxEntries: 600,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: /\/ADMIN\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'mugroup-admin-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
            },
          },
        ],
      },
      manifest: {
        name: "MuGro-up' · Offline & Sync",
        short_name: "MuGro-up'",
        description: "Juego Web3D MuGro-up' Offline-First con Babylon.js, Dexie IndexedDB y salas en red local.",
        theme_color: '#0c1018',
        background_color: '#0c1018',
        display: 'standalone',
        orientation: 'landscape',
        start_url: './',
        icons: [
          {
            src: './icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: './pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          { src: './pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: './pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  build: {
    chunkSizeWarningLimit: 5500,
  },
});
