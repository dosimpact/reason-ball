import { expect, test } from "@playwright/test";
import { createUuid } from "../../src/shared/lib/uuid";

test("uses native UUID generation when available", () => {
  const expected = "12345678-1234-4234-8234-123456789abc";
  expect(createUuid({ randomUUID: () => expected, getRandomValues: () => { throw new Error("unexpected fallback"); } })).toBe(expected);
});

test("HTTP fallback sets UUID v4 and variant bits and preserves random bytes", () => {
  const source = {
    getRandomValues<T extends ArrayBufferView | null>(array: T): T {
      if (array instanceof Uint8Array) array.set(Array.from({ length: 16 }, (_, index) => index));
      return array;
    },
  };
  expect(createUuid(source)).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
});

test("fallback produces distinct canonical UUIDs using secure random values", () => {
  const source = { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) };
  const ids = Array.from({ length: 100 }, () => createUuid(source));
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("does not replace failed secure randomness with weak generated IDs", () => {
  expect(() => createUuid({ getRandomValues: () => { throw new Error("secure random unavailable"); } })).toThrow("secure random unavailable");
});
