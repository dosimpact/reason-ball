import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"]) {
  if (!process.env[name]) throw new Error(`Missing ${name} for Supabase E2E`);
}

const baseURL = "http://127.0.0.1:3212";

export default defineConfig({
  testDir: "./tests/supabase",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"], ["html", { outputFolder: "playwright-supabase-report", open: "never" }]],
  outputDir: "test-results-supabase",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm build && pnpm --filter @fsd-next-sample/web start --hostname 127.0.0.1 --port 3212",
    cwd: "../..",
    url: baseURL,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      APP_RUNTIME_MODE: "development",
      NEXT_PUBLIC_APP_RUNTIME_MODE: "development",
      NEXT_PUBLIC_DATA_PROVIDER: "supabase",
      NEXT_PUBLIC_APP_URL: baseURL,
      // Keep real auth, HTTP repositories, RLS and storage; only AI output is deterministic.
      AI_PROVIDER: "mock",
      AI_ALLOWED_CHAT_MODELS: "gpt-5.6-terra,gpt-5-mini",
      AI_CHAT_MODEL_CAPABILITIES: "{}",
    },
  },
});
