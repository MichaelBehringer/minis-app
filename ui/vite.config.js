import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))

// Das Backend haengt in Produktion hinter nginx unter /server/ (siehe
// conf.d/nginx.conf). Der Dev-Proxy spiegelt genau diese Regel, damit der
// API-Pfad in Dev und Prod identisch ist - vorher stand in RequestHelper.js
// eine feste localhost-Adresse, die vor jedem Deployen von Hand geaendert
// werden musste.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt': die App fragt nach, statt im Hintergrund zu wechseln. Wer
      // gerade eine Messe einteilt, soll dabei nicht neu geladen werden.
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'app-icon.svg'],
      manifest: {
        id: '/',
        name: 'Ministrantenplan Wemding',
        // Kurz halten: unter dem Symbol auf dem Startbildschirm ist nur Platz
        // fuer rund 12 Zeichen.
        short_name: 'Ministranten',
        description: 'Einsätze und Einteilung der Ministranten der Pfarrei Wemding',
        lang: 'de',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#5c4b9c',
        background_color: '#ffffff',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          // Ohne maskable-Variante zeigt Android das Symbol in einem weissen
          // Kreis statt flaechig.
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Nur die App-Shell. Das Hintergrundbild der Anmeldung ist bewusst
        // nicht dabei (webp fehlt im Muster) - es waere der groesste Brocken
        // und wird am Handy ohnehin nicht geladen.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: 'index.html',
        // Die API darf nie aus dem Cache kommen - sonst zeigt die App
        // veraltete Einteilungen.
        navigateFallbackDenylist: [/^\/server\//],
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    // Auf allen Netzwerkschnittstellen lauschen, nicht nur auf localhost.
    // Sonst ist der Dev-Server vom Handy im gleichen WLAN nicht erreichbar -
    // und genau dort soll diese App bedient werden.
    host: true,
    port: 3000,
    proxy: {
      '/server': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/server/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    // Ausdruecklich gesetzt, nicht dem Standard von Vite ueberlassen: Vite 8
    // hat ihn auf Safari 16.4 angehoben. Aeltere iPads bekommen keine neuere
    // iPadOS-Version mehr und wuerden das Bundle nicht mehr einlesen koennen -
    // in der Anwendung waere das ein weisser Bildschirm ohne jede Meldung.
    target: ['es2019', 'safari13.1', 'chrome80', 'firefox78'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
  },
})
