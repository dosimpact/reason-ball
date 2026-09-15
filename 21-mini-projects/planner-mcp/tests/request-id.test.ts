import { expect, it, vi, afterEach } from "vitest";
import { createRequestId } from "../src/shared/lib/request-id";

afterEach(() => vi.unstubAllGlobals());

it("creates distinct UUID v4 request IDs", () => {
  const first = createRequestId();
  expect(first).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  expect(createRequestId()).not.toBe(first);
});

it("works without secure-context randomUUID", () => {
  vi.stubGlobal("crypto", {
    getRandomValues: (bytes: Uint8Array) => bytes.fill(0),
  });
  expect(createRequestId()).toBe("00000000-0000-4000-8000-000000000000");
});
