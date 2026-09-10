import { expect, test } from "@playwright/test";
import { ensureBrowserSession } from "../../src/shared/api/auth/browser-session";

const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });
const guest = { id: "guest-id", email: null, isAnonymous: true, createdAt: "2026-09-10T00:00:00Z" };

test("coalesces concurrent session preparation into one anonymous account request", async () => {
  const paths: string[] = [];
  globalThis.fetch = async (input) => {
    const path = String(input);
    paths.push(path);
    return Response.json(path === "/api/auth/session" ? { user: null } : { user: guest });
  };
  const first = ensureBrowserSession();
  const second = ensureBrowserSession();
  expect(first).toBe(second);
  expect(await Promise.all([first, second])).toEqual([guest, guest]);
  expect(paths).toEqual(["/api/auth/session", "/api/auth/anonymous"]);
});

test("checks the current cookie session again after an earlier preparation completed", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({ user: { ...guest, id: `session-${calls}` } });
  };
  expect((await ensureBrowserSession()).id).toBe("session-1");
  expect((await ensureBrowserSession()).id).toBe("session-2");
  expect(calls).toBe(2);
});

test("does not create an anonymous account after a failed session lookup and permits retry", async () => {
  const paths: string[] = [];
  globalThis.fetch = async (input) => {
    paths.push(String(input));
    return Response.json({ error: "unavailable" }, { status: 503 });
  };
  await expect(ensureBrowserSession()).rejects.toThrow("로그인 상태");
  expect(paths).toEqual(["/api/auth/session"]);
  globalThis.fetch = async () => Response.json({ user: guest });
  expect(await ensureBrowserSession()).toEqual(guest);
});
