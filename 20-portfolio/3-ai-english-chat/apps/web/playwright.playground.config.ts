import { defineConfig, devices } from "@playwright/test";

// Playground exists only on a non-production server. Use an explicitly owned
// development server rather than replacing a running app or production build.
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "playground.spec.ts",
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-playground-report", open: "never" }]],
  outputDir: "test-results-playground",
  use: { ...devices["Desktop Chrome"], baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000", trace: "retain-on-failure", screenshot: "only-on-failure" },
});
