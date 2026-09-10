import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

// Build registration check, not proof of a successful Supabase token refresh.
// The security webServer builds the production app before this test runs.
test("production build registers the session Proxy for pages and APIs", async () => {
  const manifest = JSON.parse(await readFile(
    path.resolve(process.cwd(), ".next/server/functions-config-manifest.json"),
    "utf8",
  ));
  const proxy = manifest.functions["/_middleware"];
  expect(proxy).toBeDefined();
  expect(proxy.runtime).toBe("nodejs");
  expect(proxy.matchers.length).toBeGreaterThan(0);

  const matches = (pathname: string) => proxy.matchers.some(
    (matcher: { regexp: string }) => new RegExp(matcher.regexp).test(pathname),
  );
  for (const pathname of ["/", "/profile", "/api/auth/session", "/api/conversations"]) {
    expect(matches(pathname), pathname).toBe(true);
  }
  for (const pathname of ["/_next/static/chunk.js", "/_next/image", "/favicon.ico", "/avatar.webp"]) {
    expect(matches(pathname), pathname).toBe(false);
  }
});
