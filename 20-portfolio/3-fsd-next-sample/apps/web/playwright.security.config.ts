import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3211";

export default defineConfig({
  testDir: "./tests/security",
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-security-report", open: "never" }]],
  outputDir: "test-results-security",
  use: { ...devices["Desktop Chrome"], baseURL, screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: {
    command: "pnpm build && pnpm --filter @fsd-next-sample/web start --hostname 127.0.0.1 --port 3211",
    cwd: "../..",
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      // Run the real HTTP client and server authorization with a mock AI
      // provider. No Supabase service or authenticated session is supplied.
      APP_RUNTIME_MODE: "development",
      AI_PROVIDER: "mock",
      AI_ALLOWED_CHAT_MODELS: 'gpt-5.6-terra,gpt-5-mini',
      AI_CHAT_MODEL_CAPABILITIES: '{}',
      NEXT_PUBLIC_APP_RUNTIME_MODE: "development",
      NEXT_PUBLIC_DATA_PROVIDER: "supabase",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "security-test-placeholder",
      NEXT_PUBLIC_APP_URL: baseURL,
    },
  },
});
