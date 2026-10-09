import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the project at /<repo>/ - keep this in sync with the repo name.
const BASE = '/retro-pocket-games/';
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  base: BASE,
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
      '@kits': fileURLToPath(new URL('./src/kits', import.meta.url)),
      '@games': fileURLToPath(new URL('./src/games', import.meta.url)),
      '@store': fileURLToPath(new URL('./src/store', import.meta.url)),
      '@data': fileURLToPath(new URL('./src/data', import.meta.url)),
      '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
      '@utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
      '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
      '@i18n': fileURLToPath(new URL('./src/i18n', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    // No manualChunks for pixi.js: the engine is reached only through dynamic imports (see
    // App.loadEngine), so Rollup splits it out of the entry chunk and keeps it off the home path.
    chunkSizeWarningLimit: 800,
  },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Retro Pocket',
        short_name: 'RetroPocket',
        description: 'A pocket arcade - 85 retro games in one installable PWA.',
        start_url: './?source=pwa',
        scope: './',
        display: 'standalone',
        display_override: ['fullscreen', 'standalone', 'minimal-ui'],
        orientation: 'any',
        background_color: '#0a0a12',
        theme_color: '#0a0a12',
        categories: ['games', 'entertainment'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          { name: 'Daily Challenge', url: './#/daily' },
          { name: 'Surprise me', url: './#/surprise' },
          { name: 'Achievements', url: './#/achievements' },
          { name: 'Scores', url: './#/scores' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        // Every chunk (engine + all 85 games) is precached above, so a separate runtime cache
        // for /assets/ would only duplicate storage.
      },
      devOptions: { enabled: false },
    }),
  ],
});
