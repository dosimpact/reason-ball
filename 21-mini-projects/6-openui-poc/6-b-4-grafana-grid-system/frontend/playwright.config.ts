import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
const external = process.env.E2E_EXTERNAL_SERVERS === '1';
export default defineConfig({
  testDir: './e2e',
  timeout: 240_000,
  expect: { timeout: 20_000 },
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:3049', channel: 'chrome', headless: true, actionTimeout: 20_000, navigationTimeout: 45_000,
    viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: external ? undefined : [
    { command: 'uv run langgraph dev --port 2041 --no-browser', cwd: '../backend-langgraph',
      url: 'http://127.0.0.1:2041/comparison/documents', reuseExistingServer: false,
      env: { DOCUMENT_DATA_DIR: resolve(__dirname, '../backend-langgraph/data') }, timeout: 120_000 },
    { command: 'npm run dev', url: 'http://127.0.0.1:3049', reuseExistingServer: false,
      env: { LANGGRAPH_API_URL: 'http://127.0.0.1:2041' }, timeout: 120_000 },
  ],
});
