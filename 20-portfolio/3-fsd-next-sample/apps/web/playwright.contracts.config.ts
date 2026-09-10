import { defineConfig } from "@playwright/test";

// Node-side contracts only; this suite does not start a browser or a server.
export default defineConfig({
  testDir: "./tests/contracts",
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  outputDir: "test-results-contracts",
});
