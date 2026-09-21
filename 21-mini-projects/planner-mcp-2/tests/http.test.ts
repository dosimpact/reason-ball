import { afterEach, it, expect, vi } from "vitest";
import { assertAllowedRequest } from "../src/app/server/http";
afterEach(() => vi.unstubAllEnvs());
it("allows configured external origin and localhost but rejects unlisted hosts or cross-origin writes", () => {
  vi.stubEnv("PLANNER_ALLOWED_ORIGINS", "http://dodonet.iptime.org:14000");
  const request = (host: string, origin: string) =>
    new Request("http://localhost:4000/api/projects", {
      method: "POST",
      headers: { host, origin },
    });
  expect(() =>
    assertAllowedRequest(
      request("dodonet.iptime.org:14000", "http://dodonet.iptime.org:14000"),
    ),
  ).not.toThrow();
  expect(() =>
    assertAllowedRequest(request("127.0.0.1:4000", "http://127.0.0.1:4000")),
  ).not.toThrow();
  expect(() =>
    assertAllowedRequest(
      request("dodonet.iptime.org:14001", "http://dodonet.iptime.org:14001"),
    ),
  ).toThrow("not allowed");
  expect(() =>
    assertAllowedRequest(
      request("dodonet.iptime.org:14000", "https://external.invalid"),
    ),
  ).toThrow("Cross-origin");
  vi.stubEnv("PLANNER_ALLOWED_ORIGINS", "");
  expect(() =>
    assertAllowedRequest(
      request("dodonet.iptime.org:14000", "http://dodonet.iptime.org:14000"),
    ),
  ).toThrow("not allowed");
});
