import { expect, test } from "@playwright/test";
import { isPlaygroundEnabled, playgroundUnavailableResponse } from "../../src/shared/lib/playground-policy";

test("server production signals close the playground despite mock or public settings", async () => {
  for (const environment of [
    { NODE_ENV: "production", APP_RUNTIME_MODE: "mock" },
    { NODE_ENV: "development", APP_RUNTIME_MODE: "production" },
    { NODE_ENV: "test", APP_RUNTIME_MODE: " production " },
  ]) {
    expect(isPlaygroundEnabled(environment)).toBe(false);
    const response = playgroundUnavailableResponse(environment)!;
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.json()).error.code).toBe("NOT_FOUND");
  }
});

test("development and test permit playground routes without changing environment", () => {
  const environment = Object.freeze({ NODE_ENV: "development", APP_RUNTIME_MODE: "mock" });
  expect(isPlaygroundEnabled(environment)).toBe(true);
  expect(playgroundUnavailableResponse(environment)).toBeUndefined();
  expect(isPlaygroundEnabled({ NODE_ENV: "test" })).toBe(true);
  expect(environment.APP_RUNTIME_MODE).toBe("mock");
});
