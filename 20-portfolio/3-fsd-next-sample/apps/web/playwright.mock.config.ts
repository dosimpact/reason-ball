import { defineConfig, devices } from "@playwright/test";

const port = 3210;
const baseURL = `http://127.0.0.1:${port}`;
const production = process.env.PLAYWRIGHT_PRODUCTION === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: "**/live/**",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: production ? "playwright-production-report" : "playwright-report" }]],
  outputDir: production ? "test-results-production" : "test-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /.*\.mobile\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      testMatch: /.*\.mobile\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: production
      ? `pnpm --filter @fsd-next-sample/web build && pnpm --filter @fsd-next-sample/web exec next start --hostname 127.0.0.1 --port ${port}`
      : `pnpm --filter @fsd-next-sample/web exec next dev --webpack --hostname 127.0.0.1 --port ${port}`,
    cwd: "../..",
    env: {
      ...process.env,
      APP_RUNTIME_MODE: "mock",
      AI_PROVIDER: "mock",
      AI_ALLOWED_CHAT_MODELS: 'gpt-5.6-terra,gpt-5-mini,text-only-test,unverified-test',
      AI_CHAT_MODEL_CAPABILITIES: JSON.stringify({
        'text-only-test': { vision: false, documents: false, tools: false, reasoning: false },
        'unverified-test': {},
      }),
      NEXT_PUBLIC_APP_RUNTIME_MODE: "mock",
      NEXT_PUBLIC_APP_URL: baseURL,
    },
    url: baseURL,
    reuseExistingServer: !production && !process.env.CI,
    timeout: production ? 180_000 : 120_000,
  },
});
