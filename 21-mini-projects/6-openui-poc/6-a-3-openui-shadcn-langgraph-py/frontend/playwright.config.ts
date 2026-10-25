import { defineConfig } from "@playwright/test";

// Requires the explicitly started project-owned frontend and Python backend.
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 150_000,
  expect: { timeout: 120_000 },
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "output/playwright/report", open: "never" }]],
  outputDir: "output/playwright/results",
  use: {
    baseURL: process.env.CHAT_TEST_URL || "http://127.0.0.1:3046",
    channel: "chrome",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
