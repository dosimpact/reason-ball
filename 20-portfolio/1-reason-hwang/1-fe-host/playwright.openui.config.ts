import { defineConfig, devices } from '@playwright/test';
const baseURL = process.env.OPENUI_LIVE_BASE_URL;
if (!baseURL) throw new Error('Set OPENUI_LIVE_BASE_URL to an owned validation server. See docs/stock/tech-shared/openui-migration.md.');
export default defineConfig({
  testDir: './tests/e2e', testMatch: 'generative-ui.spec.ts', timeout: 180_000,
  expect: { timeout: 90_000 }, workers: 1,
  use: { ...devices['Desktop Chrome'], baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  outputDir: 'test-results/openui',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/openui', open: 'never' }], ['json', { outputFile: 'test-results/openui-results.json' }]],
});
