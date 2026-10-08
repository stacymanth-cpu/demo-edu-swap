import { defineConfig, devices } from '@playwright/test';

// Browser tests. Run with `npm run test:e2e`, which starts the Firebase Auth and Firestore
// emulators (project demo-eduswap, so no real data is touched) and then this config, which
// starts the app and the PIN server pointed at those emulators.
const APP_PORT = 5199;
const PIN_SERVER_PORT = 8799;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  globalSetup: './e2e/global-setup.ts',
  // The tests share one emulator database, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e/.output/report' }]],
  outputDir: 'e2e/.output/results',
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/start-pin-server.mjs',
      port: PIN_SERVER_PORT,
      reuseExistingServer: false,
      env: { LIVEKIT_TOKEN_PORT: String(PIN_SERVER_PORT), APP_ORIGIN: `http://localhost:${APP_PORT}` },
    },
    {
      command: `npx vite --port ${APP_PORT} --strictPort`,
      url: `http://localhost:${APP_PORT}`,
      reuseExistingServer: false,
      env: {
        VITE_USE_FIREBASE_EMULATORS: 'true',
        VITE_LIVEKIT_TOKEN_ENDPOINT: `http://localhost:${PIN_SERVER_PORT}/api/livekit/token`,
      },
    },
  ],
});
