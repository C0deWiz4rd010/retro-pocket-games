import { defineConfig } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}/retro-pocket-games/`,
    // System Chrome: no separate browser download needed. Override with PW_CHANNEL="" in CI.
    channel: process.env.PW_CHANNEL === undefined ? 'chrome' : process.env.PW_CHANNEL || undefined,
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/retro-pocket-games/`,
    reuseExistingServer: true,
    timeout: 240_000,
  },
});
