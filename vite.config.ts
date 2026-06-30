import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import Components from 'unplugin-vue-components/vite'
import { PrimeVueResolver } from '@primevue/auto-import-resolver'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === 'iconify-icon',
        },
      },
    }),
    ...(process.env.NODE_ENV !== 'production' ? [vueDevTools()] : []),
    Components({
      resolvers: [PrimeVueResolver()],
    }),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt', // never 'autoUpdate' — CRUD forms have unsaved state
      strategies: 'generateSW',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'branding_logo.svg'],
      manifest: {
        name: 'Kaheeta',
        short_name: 'Kaheeta',
        description: 'Your personal vaccination, membership, and expense vault',
        theme_color: '#002244',
        background_color: '#002244',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        screenshots: [
          {
            src: 'screenshots/screenshot-mobile.png',
            sizes: '390x844',
            type: 'image/png',
            label: 'Kaheeta — Vaccination, Membership & Expense Vault',
          },
          {
            src: 'screenshots/screenshot-desktop.png',
            sizes: '1280x800',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Kaheeta — Vaccination, Membership & Expense Vault (Desktop)',
          },
        ],
        shortcuts: [
          {
            name: 'Add Expense',
            short_name: 'Add Expense',
            url: '/?action=add-expense',
            icons: [{ src: 'shortcuts/shortcut-add-expense.png', sizes: '96x96', type: 'image/png' }],
          },
          {
            name: 'Add Vaccination',
            short_name: 'Add Vaccination',
            url: '/?action=add-vaccination',
            icons: [
              { src: 'shortcuts/shortcut-add-vaccination.png', sizes: '96x96', type: 'image/png' },
            ],
          },
          {
            name: 'Add Membership',
            short_name: 'Add Membership',
            url: '/?action=add-membership',
            icons: [
              { src: 'shortcuts/shortcut-add-membership.png', sizes: '96x96', type: 'image/png' },
            ],
          },
          {
            name: 'Open Reports',
            short_name: 'Open Reports',
            url: '/?action=open-reports',
            icons: [
              { src: 'shortcuts/shortcut-open-reports.png', sizes: '96x96', type: 'image/png' },
            ],
          },
          {
            name: 'Open Notes',
            short_name: 'Notes',
            url: '/?action=open-notes',
            icons: [{ src: 'shortcuts/shortcut-open-notes.png', sizes: '96x96', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [{ urlPattern: /\/api\/.*/i, handler: 'NetworkOnly' }],
      },
      devOptions: {
        enabled: false,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/chart.js')) return 'chart-js'
          if (id.includes('/jsbarcode')) return 'jsbarcode'
          if (id.includes('/browser-image-compression')) return 'image-compression'
          if (/\/primevue|\/@primevue|\/@primeuix/.test(id)) return 'primevue'
          if (/node_modules\/(vue|pinia|vue-router|@vue)\//.test(id)) return 'vendor'
        },
      },
    },
  },
})
