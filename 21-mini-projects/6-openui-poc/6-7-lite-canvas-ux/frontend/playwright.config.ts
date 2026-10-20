import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/canvas-e2e",
  timeout: 1500000,
  expect: { timeout: 15000 },
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://127.0.0.1:3048", channel: "chrome", viewport: { width: 1512, height: 982 }, trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: [
    { command: "uv run --directory ../backend-langgraph langgraph dev --port 2040 --no-browser", url: "http://127.0.0.1:2040/ok", reuseExistingServer: process.env.CANVAS_USE_RUNNING_SERVER === "1", timeout: 60000 },
    { command: "npm run dev", url: "http://127.0.0.1:3048", reuseExistingServer: process.env.CANVAS_USE_RUNNING_SERVER === "1", timeout: 60000 },
  ],
});
