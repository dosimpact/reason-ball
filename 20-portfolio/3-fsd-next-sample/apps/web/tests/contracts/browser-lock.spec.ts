import { expect, test } from "@playwright/test";
import { withBrowserStorageLock } from "../../src/shared/lib/browser-lock";

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
test.afterEach(() => {
  if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
  else Reflect.deleteProperty(globalThis, "navigator");
});

test("prefers native Web Locks and preserves the operation result", async () => {
  const names: string[] = [];
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { locks: {
    request: async (name: string, operation: () => unknown) => { names.push(name); return operation(); },
  } } });
  await expect(withBrowserStorageLock("owner:conversation", () => 42)).resolves.toBe(42);
  expect(names).toEqual(["owner:conversation"]);
});

test("rejects asynchronous operations instead of releasing the storage lock early", async () => {
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { locks: {
    request: async (_name: string, operation: () => unknown) => operation(),
  } } });
  await expect(withBrowserStorageLock("key", async () => 42)).rejects.toThrow("must be synchronous");
});

test("does not run an unprotected operation when both lock providers are absent", async () => {
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
  let ran = false;
  await expect(withBrowserStorageLock("key", () => { ran = true; })).rejects.toThrow("잠금");
  expect(ran).toBe(false);
});
