import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  const basePath = process.env.VITE_BASE_PATH || '/';
  return {
    base: basePath,
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'favicon.png', 'apple-touch-icon.png'],
        manifest: {
          name: 'LedgerPro Enterprise',
          short_name: 'LedgerPro',
          description: 'Production-grade double-entry accounting system',
          theme_color: '#3b82f6',
          scope: basePath,
          start_url: basePath,
          icons: [
            {
              src: 'icons/icon-48.webp',
              sizes: '48x48',
              type: 'image/webp',
              purpose: 'any'
            },
            {
              src: 'icons/icon-72.webp',
              sizes: '72x72',
              type: 'image/webp',
              purpose: 'any'
            },
            {
              src: 'icons/icon-96.webp',
              sizes: '96x96',
              type: 'image/webp',
              purpose: 'any'
            },
            {
              src: 'icons/icon-128.webp',
              sizes: '128x128',
              type: 'image/webp',
              purpose: 'any'
            },
            {
              src: 'icons/icon-192.webp',
              sizes: '192x192',
              type: 'image/webp',
              purpose: 'any'
            },
            {
              src: 'icons/icon-256.webp',
              sizes: '256x256',
              type: 'image/webp',
              purpose: 'any'
            },
            {
              src: 'icons/icon-512.webp',
              sizes: '512x512',
              type: 'image/webp',
              purpose: 'any'
            },
            {
              src: 'icons/icon-512.webp',
              sizes: '512x512',
              type: 'image/webp',
              purpose: 'maskable'
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
