import { defineConfig, devices } from "@playwright/test";

// Explicitly target the already-running project servers; never claim sibling ports.
export default defineConfig({
  testDir: "./tests/report-e2e",
  timeout: 300_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  outputDir: "output/playwright/results",
  reporter: [["list"], ["html", { outputFolder: "output/playwright/report", open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    channel: "chrome",
    headless: false,
    viewport: { width: 1440, height: 1000 },
    baseURL: process.env.BASE_URL ?? "http://localhost:3044",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
