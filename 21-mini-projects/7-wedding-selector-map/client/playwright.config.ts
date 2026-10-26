import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
const port = Number(process.env.WEDDING_E2E_PORT || 3097);

export default defineConfig({
  testDir: './e2e/playwright/tests',
  fullyParallel: true,
  workers: 3,
  timeout: 30000,
  expect: { timeout: 7000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || `http://127.0.0.1:${port}/client/`,
    browserName: 'chromium',
    channel: existsSync('/Applications/Google Chrome.app') ? 'chrome' : undefined,
    viewport: { width: 1440, height: 1024 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.BASE_URL ? undefined : {
    command: `python3 scripts/serve.py --port ${port}`,
    url: `http://127.0.0.1:${port}/client/`,
    reuseExistingServer: false,
    timeout: 15000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
