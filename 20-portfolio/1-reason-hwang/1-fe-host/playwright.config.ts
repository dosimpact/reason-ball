import { defineConfig, devices } from '@playwright/test';

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;

const calculationSpec = /index-dcf-calculation\.spec\.ts$/;
const visualizerSpec = /index-dcf-visualizer\.spec\.ts$/;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: externalBaseURL ?? 'http://127.0.0.1:2800',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: externalBaseURL ? undefined : {
    command: 'pnpm dev',
    url: 'http://127.0.0.1:2800',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'calculation',
      testMatch: calculationSpec,
    },
    {
      name: 'chromium',
      testIgnore: calculationSpec,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      testMatch: visualizerSpec,
      use: { ...devices['Pixel 5'] },
    },
  ],
});
