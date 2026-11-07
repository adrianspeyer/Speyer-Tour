import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  globalSetup: './scripts/prepare-browser-tests.mjs',
  use: {
    baseURL: 'http://127.0.0.1:43187',
    headless: true,
    launchOptions: process.env.TOUR_BROWSER_EXECUTABLE_PATH
      ? { executablePath: process.env.TOUR_BROWSER_EXECUTABLE_PATH } : {},
  },
  webServer: {
    command: 'node scripts/test-server.mjs',
    url: 'http://127.0.0.1:43187/tests/fixture.html',
    reuseExistingServer: false,
  },
});
