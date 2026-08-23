import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))

// Das Backend haengt in Produktion hinter nginx unter /server/ (siehe
// conf.d/nginx.conf). Der Dev-Proxy spiegelt genau diese Regel, damit der
// API-Pfad in Dev und Prod identisch ist - vorher stand in RequestHelper.js
// eine feste localhost-Adresse, die vor jedem Deployen von Hand geaendert
// werden musste.
export default defineConfig({
  plugins: [react()],
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
