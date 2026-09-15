import { describe, expect, it } from "vitest";
import { assertLocal, requestJson, httpError } from "../src/app/server/http";
import { PlannerError } from "../src/shared/lib/errors";
it("reads bounded JSON and rejects missing, malformed and oversized bodies", async () => {
  const request = (body: string) =>
    new Request("http://localhost", { method: "POST", body });
  expect(await requestJson(request('{"ok":true}'))).toEqual({ ok: true });
  await expect(
    requestJson(new Request("http://localhost")),
  ).rejects.toMatchObject({ code: "SCHEMA_INVALID" });
  await expect(requestJson(request("{broken"))).rejects.toMatchObject({
    code: "SCHEMA_INVALID",
  });
  await expect(
    requestJson(request('"' + "x".repeat(2_000_000) + '"')),
  ).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
});
it.each([
  ["FORBIDDEN", 403],
  ["DOCUMENT_NOT_FOUND", 404],
  ["REVISION_CONFLICT", 409],
  ["SCHEMA_INVALID", 400],
])("maps %s to HTTP %s", (code, status) => {
  expect(httpError(new PlannerError(String(code), "test")).status).toBe(status);
});
it("does not expose internal errors in HTTP responses", async () => {
  const response = httpError(new Error("private-path-or-token"));
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("private-path-or-token");
});
describe("Local request origin", () => {
  it("allows an explicitly configured LAN host, including origin-free MCP requests", () => {
    for (const origin of [undefined, "http://192.168.0.45:3100"]) {
      const request = new Request("http://localhost:3100/api/planner", {
        headers: { host: "192.168.0.45:3100", ...(origin ? { origin } : {}) },
      });
      expect(() => assertLocal(request, "")).toThrow();
      expect(() => assertLocal(request, " 192.168.0.45 ")).not.toThrow();
    }
  });
  it("does not allow wildcard hosts or foreign origins in LAN mode", () => {
    for (const origin of [
      "http://evil.example",
      "http://192.168.0.45:3200",
      "null",
    ]) {
      expect(() =>
        assertLocal(
          new Request("http://localhost:3100", {
            headers: { host: "192.168.0.45:3100", origin },
          }),
          "192.168.0.45",
        ),
      ).toThrow();
    }
    expect(() =>
      assertLocal(new Request("http://192.168.0.46:3100"), "192.168.0.45"),
    ).toThrow();
    expect(() =>
      assertLocal(new Request("http://evil.example"), "*"),
    ).toThrow();
  });
  it("uses Host for Next's normalized internal URL", () => {
    expect(() =>
      assertLocal(
        new Request("http://localhost:3100/api/planner", {
          headers: { host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100" },
        }),
      ),
    ).not.toThrow();
  });
  it("rejects foreign hosts, origins and null origin", () => {
    for (const origin of [
      "https://evil.example",
      "null",
      "http://127.0.0.1:3200",
    ])
      expect(() =>
        assertLocal(
          new Request("http://localhost:3100", {
            headers: { host: "localhost:3100", origin },
          }),
        ),
      ).toThrow();
    expect(() =>
      assertLocal(
        new Request("http://evil.example", {
          headers: { host: "evil.example" },
        }),
      ),
    ).toThrow();
  });
});
