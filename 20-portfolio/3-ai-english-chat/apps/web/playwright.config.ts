import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { liveBaseURL } from "./tests/e2e/live/settings";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"]) {
  if (!process.env[name]) throw new Error(`Missing ${name} for real Supabase E2E`);
}

const production = process.env.PLAYWRIGHT_LIVE_PRODUCTION === "1";
const target = new URL(liveBaseURL);
if (production && !["127.0.0.1", "localhost"].includes(target.hostname)) {
  throw new Error("Production E2E must start its own loopback server.");
}

// Ordinary live tests use an existing server; production tests own build + start.
export default defineConfig({
  testDir: "./tests/e2e/live",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"], ["html", { outputFolder: production ? "playwright-live-production-report" : "playwright-report", open: "never" }], ["json", { outputFile: production ? "test-results-live-production/results.json" : "test-results/results.json" }]],
  outputDir: production ? "test-results-live-production" : "test-results",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: liveBaseURL,
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: production ? {
    command: `pnpm --filter @ai-english-chat/web build && pnpm --filter @ai-english-chat/web start --hostname ${target.hostname} --port ${target.port || "80"}`,
    cwd: "../..",
    url: liveBaseURL,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      ...process.env,
      PLAYWRIGHT_LIVE_PRODUCTION: "1",
      APP_RUNTIME_MODE: "production",
      NEXT_PUBLIC_APP_RUNTIME_MODE: "production",
      NEXT_PUBLIC_DATA_PROVIDER: "supabase",
      NEXT_PUBLIC_APP_URL: liveBaseURL,
      AI_PROVIDER: "oauth-proxy",
      AI_API_MODE: "responses",
      AI_IMAGE_PROVIDER: "oauth-proxy",
      AI_SPEECH_PROVIDER: "oauth-proxy",
      CHATGPT_OAUTH_PROXY_URL: "http://127.0.0.1:2890/v1",
      OPENAI_API_KEY: "",
    },
  } : undefined,
});
