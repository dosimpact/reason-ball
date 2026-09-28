import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e/playwright',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { ...devices['Desktop Chrome'], baseURL: process.env.BASE_URL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', testMatch: /(?:tutorial|complete|theme|curriculum|curriculum-workbook|monitoring|standalone-strategy)\.spec\.ts/ },
    { name: 'storybook', testMatch: /storybook\.spec\.ts/ },
  ],
});
