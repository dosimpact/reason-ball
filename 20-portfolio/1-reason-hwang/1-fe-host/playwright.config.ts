import { defineConfig, devices } from '@playwright/test';

const calculationSpec = /index-dcf-calculation\.spec\.ts$/;
const visualizerSpec = /index-dcf-visualizer\.spec\.ts$/;
const secSpec = /sec-intelligent-ui\.spec\.ts$/;
const secLiveUrl = process.env.SEC_LIVE_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/sec-chat-report.json' }],
  ],
  use: {
    baseURL: secLiveUrl || 'http://127.0.0.1:2800',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: secLiveUrl ? undefined : {
    command: 'pnpm dev',
    url: 'http://127.0.0.1:2800',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'sec-live', testMatch: secSpec, use: { ...devices['Desktop Chrome'] } },
    {
      name: 'calculation',
      testMatch: calculationSpec,
    },
    {
      name: 'chromium',
      testIgnore: [calculationSpec, secSpec],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      testMatch: visualizerSpec,
      use: { ...devices['Pixel 5'] },
    },
  ],
});
