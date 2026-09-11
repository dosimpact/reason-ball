import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { test as base, expect, type APIRequestContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

export function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type TestAccount = { id: string; email: string; password: string };
type LiveFixtures = {
  sessionKind: "member" | "guest";
  account: TestAccount | undefined;
  createAccount: () => Promise<TestAccount>;
};

const ledgerPath = ".e2e-owned-accounts.json";
function recordAccount(id: string, remove = false) {
  const ids = new Set<string>(existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, "utf8")) : []);
  if (remove) ids.delete(id); else ids.add(id);
  writeFileSync(ledgerPath, JSON.stringify([...ids]), { mode: 0o600 });
}

async function deleteTestAccount(id: string) {
  const admin = adminClient();
  // Messages cannot SET NULL their author during Auth deletion.
  for (const table of ["conversations", "missions", "characters"]) {
    const result = await admin.from(table).delete().eq("owner_id", id);
    expect(result.error, `Clean this test account's ${table}`).toBeNull();
  }
  // Only IDs recorded when this fixture created an account may reach this helper.
  // Storage owns a user/resource/file hierarchy; remove owned objects before Auth.
  const buckets = await admin.storage.listBuckets();
  expect(buckets.error).toBeNull();
  for (const bucket of buckets.data ?? []) {
    async function removePrefix(prefix: string) {
      const result = await admin.storage.from(bucket.id).list(prefix, { limit: 1000 });
      expect(result.error).toBeNull();
      const files: string[] = [];
      for (const item of result.data ?? []) {
        const path = `${prefix}/${item.name}`;
        if (item.id) files.push(path);
        else await removePrefix(path);
      }
      if (files.length) expect((await admin.storage.from(bucket.id).remove(files)).error).toBeNull();
    }
    await removePrefix(id);
  }
  expect((await admin.auth.admin.deleteUser(id)).error, "Remove temporary Auth account").toBeNull();
  recordAccount(id, true);
}

export async function signIn(request: APIRequestContext, account: TestAccount) {
  const response = await request.post("/api/auth/email", {
    headers: { Origin: "http://dodonet.iptime.org:13000" },
    data: { action: "sign-in", email: account.email, password: account.password },
  });
  expect(response.ok(), `Sign in: ${response.status()}`).toBe(true);
  expect((await response.json()).user.id).toBe(account.id);
}

export const test = base.extend<LiveFixtures>({
  sessionKind: ["member", { option: true }],
  createAccount: async ({}, provide) => {
    const accounts: TestAccount[] = [];
    await provide(async () => {
      const email = `e2e-${randomUUID()}@example.com`;
      const password = `E2e!${randomUUID()}aA9`;
      const result = await adminClient().auth.admin.createUser({ email, password, email_confirm: true });
      expect(result.error).toBeNull();
      const account = { id: result.data.user!.id, email, password };
      accounts.push(account);
      recordAccount(account.id);
      return account;
    });
    for (const account of accounts) await deleteTestAccount(account.id);
  },
  account: async ({ sessionKind, createAccount }, provide) => {
    await provide(sessionKind === "member" ? await createAccount() : undefined);
  },
  page: async ({ page, account }, provide) => {
    const guests = new Set<string>();
    const captures: Promise<void>[] = [];
    page.on("response", (response) => {
      if (new URL(response.url()).pathname !== "/api/auth/anonymous" || !response.ok()) return;
      captures.push(response.json().then((body) => {
        if (body.created === true && body.user?.isAnonymous === true) { guests.add(body.user.id); recordAccount(body.user.id); }
      }));
    });
    if (account) await signIn(page.request, account);
    try { await provide(page); }
    finally {
      await Promise.all(captures);
      const logout = await page.request.post("/api/auth/logout", {
        headers: { Origin: "http://dodonet.iptime.org:13000" },
      });
      expect(logout.ok(), "Sign out this test browser before account cleanup").toBe(true);
      for (const id of guests) await deleteTestAccount(id);
    }
  },
});

export { expect };
