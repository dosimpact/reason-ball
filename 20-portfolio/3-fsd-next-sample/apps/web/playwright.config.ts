import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"]) {
  if (!process.env[name]) throw new Error(`Missing ${name} for real Supabase E2E`);
}

// Exercise the same HTTP origin and forwarded port as remote users.
// The existing real-service development server is managed outside Playwright.
export default defineConfig({
  testDir: "./tests/e2e/live",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  outputDir: "test-results",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://dodonet.iptime.org:13000",
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
