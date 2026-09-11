import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { adminClient, expect, signIn, test } from "./fixtures";

const origin = "http://dodonet.iptime.org:13000";
const headers = { Origin: origin };
function publicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function login(client: SupabaseClient, account: { id: string; email: string; password: string }) {
  const result = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  expect(result.error).toBeNull();
  expect(result.data.user?.id).toBe(account.id);
}
async function startOwnedRun(page: Page) {
  const response = await page.request.get("/api/missions");
  expect(response.ok()).toBe(true);
  const { items } = await response.json() as { items: Array<{ id: string; recommendedCharacterId: string; prerequisites: string[] }> };
  const mission = items.find((item) => item.recommendedCharacterId && !item.prerequisites.length);
  expect(mission).toBeDefined();
  const started = await page.request.post("/api/mission-runs", { headers,
    data: { missionId: mission!.id, characterId: mission!.recommendedCharacterId },
  });
  expect(started.ok()).toBe(true);
  const { run } = await started.json() as { run: { id: string; conversationId: string } };
  return run;
}
async function saveOwnedNote(page: Page, conversationId: string) {
  const draft = { kind: "expression", text: `Private note ${randomUUID()}`, meaning: "Owned source", originalText: "", source: { conversationId } };
  const response = await page.request.post("/api/me/notebook", { headers, data: { id: randomUUID(), draft } });
  expect(response.ok()).toBe(true);
  const { entry, outcome } = await response.json();
  expect(outcome).toBe("created");
  expect(entry.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(entry.draft).toEqual(draft);
  expect(entry.createdAt).toEqual(expect.any(String));
  return { entry, draft };
}
async function baseline(ownerId: string, runId: string) {
  const admin = adminClient();
  const profile = await admin.from("profiles").select("experience_points").eq("id", ownerId).single();
  const run = await admin.from("mission_runs").select("id,status,score,awarded_evaluation_id,awarded_mission_reward_id,completed_at").eq("id", runId).single();
  const rewards = await admin.from("reward_unlocks").select("id,mission_evaluation_id").eq("user_id", ownerId).order("id");
  const notebook = await admin.from("learning_notebook_entries").select("id,draft").eq("user_id", ownerId).order("id");
  for (const result of [profile, run, rewards, notebook]) expect(result.error).toBeNull();
  return { profile: profile.data, run: run.data, rewards: rewards.data, notebook: notebook.data };
}

test("direct member and anon clients cannot execute server-only completion or notebook RPCs", async ({ page, account, createAccount }) => {
  const run = await startOwnedRun(page);
  const { draft } = await saveOwnedNote(page, run.conversationId);
  const before = await baseline(account!.id, run.id);
  const attacker = publicClient();
  const anonymous = publicClient();
  const attackerAccount = await createAccount();
  await login(attacker, attackerAccount);
  // SQL signatures are copied from the committed migrations. UUID arguments are
  // syntactically valid; no admin client is used to invoke these privileged RPCs.
  const completionArgs = { _mission_run_id: run.id, _mission_evaluation_id: randomUUID(),
    _mission_reward_id: randomUUID(), _expected_owner_id: account!.id };
  const notebookArgs = { _owner_id: account!.id, _request_id: randomUUID(), _draft: draft,
    _identity_key: JSON.stringify([draft.kind, draft.text.toLowerCase(), ""]) };
  try {
    for (const client of [attacker, anonymous]) {
      for (const rpc of ["complete_mission_run", "complete_mission_run_unchecked"]) {
        const result = await client.rpc(rpc, completionArgs);
        expect.soft(result.error?.code, `${rpc} must reject execution, not merely fail evaluation lookup`).toBe("42501");
        expect.soft(result.error?.message).toContain("permission denied for function");
      }
      const notebook = await client.rpc("save_learning_notebook", notebookArgs);
      expect.soft(notebook.error?.code).toBe("42501");
      expect.soft(notebook.error?.message).toContain("permission denied for function");
    }
    expect(await baseline(account!.id, run.id)).toEqual(before);
  } finally {
    await attacker.auth.signOut();
  }
});

test("notebook RLS hides another learner's rows and rejects forged source, identity and direct writes", async ({ page, account, createAccount, browser }) => {
  const run = await startOwnedRun(page);
  const { entry, draft } = await saveOwnedNote(page, run.conversationId);
  const before = await baseline(account!.id, run.id);
  const owner = publicClient();
  const attacker = publicClient();
  const attackerAccount = await createAccount();
  await login(owner, account!);
  await login(attacker, attackerAccount);
  const other = await browser.newContext({ baseURL: origin });
  try {
    await signIn(other.request, attackerAccount);
    const own = await owner.from("learning_notebook_entries").select("id,draft").eq("id", entry.id);
    expect(own.error).toBeNull();
    expect(own.data).toEqual([{ id: entry.id, draft }]);
    const hidden = await attacker.from("learning_notebook_entries").select("id,draft").eq("id", entry.id);
    expect(hidden.error).toBeNull();
    expect(hidden.data).toEqual([]);
    const receiptRead = await attacker.from("learning_notebook_requests").select("request_id").eq("user_id", account!.id);
    expect(receiptRead.error?.code).toBe("42501");
    const sourceForgery = await other.request.post("/api/me/notebook", { headers, data: { id: randomUUID(), draft } });
    expect(sourceForgery.status(), "B cannot save a notebook entry sourced from A's private conversation").toBe(404);
    for (const extra of [{ ownerId: account!.id }, { identity: "forged" }]) {
      const forged = await other.request.post("/api/me/notebook", { headers, data: { id: randomUUID(), draft, ...extra } });
      expect(forged.status()).toBe(400);
    }
    // Even using B's own user_id cannot bypass the trusted server's source and
    // deduplication checks through a direct INSERT into the read-only table.
    const directInsert = await attacker.from("learning_notebook_entries").insert({ user_id: attackerAccount.id,
      id: randomUUID(), draft, identity_key: JSON.stringify([draft.kind, draft.text.toLowerCase(), ""]) });
    expect(directInsert.error?.code).toBe("42501");
    const list = await other.request.get("/api/me/notebook");
    expect(list.ok()).toBe(true);
    expect((await list.json()).notebook.entries).toEqual([]);
    expect(await baseline(account!.id, run.id)).toEqual(before);
  } finally {
    await other.request.post("/api/auth/logout", { headers });
    await other.close();
    await owner.auth.signOut();
    await attacker.auth.signOut();
  }
});
