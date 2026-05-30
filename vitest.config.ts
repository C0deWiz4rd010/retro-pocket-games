import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
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
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/games/**/core/**', 'src/kits/**', 'src/utils/**', 'src/store/**'],
      reporter: ['text', 'html'],
    },
  },
});
