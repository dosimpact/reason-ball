import { liveBaseURL } from "./settings";
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
type PracticeMission = {
  id: string;
  recommendedCharacterId: string;
  prerequisites: string[];
  steps: Array<{ id: string; hint?: string }>;
};
type LiveFixtures = {
  sessionKind: "member" | "guest";
  account: TestAccount | undefined;
  createAccount: () => Promise<TestAccount>;
  practiceMission: PracticeMission;
};

const manualPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHmsAAAAASUVORK5CYII=";
const mutationHeaders = { Origin: liveBaseURL };

async function createPracticeMission(request: APIRequestContext, ownerId: string): Promise<PracticeMission> {
  const characterResponse = await request.post("/api/characters", { headers: mutationHeaders, data: {
    name: `Practice partner ${randomUUID()}`, role: "Cafe conversation partner", tagline: "Disposable live test character",
    description: "Help the learner greet someone and ask for tea.", personality: ["다정함"], personaGoal: "Welcome the learner.",
    learningGoal: "Practice a short cafe exchange.", speakingStyle: "Short clear English.", relationship: "Practice partner",
    teachingStyle: "Give gentle correction.", prohibitedInstructions: ["Do not ask for private data."], accent: "American",
    level: "입문", topics: ["일상"], palette: ["#ff8067", "#ffc65c"], emoji: "🍵",
    visibility: "public", publishStatus: "published", imageUrl: manualPng,
  } });
  expect(characterResponse.ok(), `Publish practice character: ${characterResponse.status()} ${await characterResponse.text()}`).toBe(true);
  const character = (await characterResponse.json()).item as { id: string };
  const missionResponse = await request.post("/api/missions", { headers: mutationHeaders, data: {
    title: `Practice cafe mission ${randomUUID()}`, subtitle: "Greet and order tea.",
    description: "Greet the cafe partner, introduce yourself, and ask the price of tea.",
    category: "일상", location: "Practice cafe", difficulty: "입문", durationMinutes: 3,
    objectives: [
      { id: "greeting", label: "Greet and introduce yourself", hint: "Hello, my name is Alex." },
      { id: "price", label: "Ask the price of tea", hint: "How much does tea cost?" },
    ],
    steps: [
      { id: "greeting", label: "Greet and introduce yourself", hint: "Hello, my name is Alex.", required: true, successCriteria: ["The learner greets and gives a fictional name."] },
      { id: "price", label: "Ask the price of tea", hint: "How much does tea cost?", required: true, successCriteria: ["The learner asks the price of tea."] },
    ],
    keyPhrases: [{ english: "How much does tea cost?", korean: "차는 얼마인가요?" }],
    successThreshold: 70, prerequisites: [], rewardTitle: "Cafe practice keepsake",
    rewardPalette: ["#ff8067", "#ffc65c"], rewardEmoji: "🍵", rewardImageUrl: manualPng,
    recommendedCharacterId: character.id, publishStatus: "published",
  } });
  expect(missionResponse.ok(), `Publish practice mission: ${missionResponse.status()} ${await missionResponse.text()}`).toBe(true);
  const mission = (await missionResponse.json()).item as PracticeMission;
  expect(mission).toMatchObject({ recommendedCharacterId: character.id, prerequisites: [] });
  expect(mission.steps.filter((step) => step.hint)).toHaveLength(2);
  const owned = await adminClient().from("missions").select("owner_id,status").eq("id", mission.id).single();
  expect(owned.error).toBeNull();
  expect(owned.data).toEqual({ owner_id: ownerId, status: "published" });
  return mission;
}

const ledgerPath = ".e2e-owned-accounts.json";
function ownsTestAccount(id: string) {
  const ids: unknown = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, "utf8")) : [];
  return Array.isArray(ids) && ids.includes(id);
}

/** Seed the access prerequisite for a mission authored by another test account. */
export async function assignTestMission(missionId: string, learnerId: string) {
  expect(ownsTestAccount(learnerId), "Mission assignment requires this suite's learner").toBe(true);
  const admin = adminClient();
  const mission = await admin.from("missions").select("owner_id,status,visibility").eq("id", missionId).single();
  expect(mission.error).toBeNull();
  expect(mission.data).toMatchObject({ status: "published", visibility: "public" });
  expect(ownsTestAccount(mission.data!.owner_id), "Mission assignment requires this suite's author").toBe(true);
  const assigned = await admin.from("mission_assignments").insert({ user_id: learnerId, mission_id: missionId });
  expect(assigned.error, "Assign this published test mission to its learner").toBeNull();
}

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
    headers: { Origin: liveBaseURL },
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
  practiceMission: async ({ page, account }, provide) => {
    expect(account, "A member account is required for the practice mission fixture").toBeDefined();
    await provide(await createPracticeMission(page.request, account!.id));
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
        headers: { Origin: liveBaseURL },
      });
      expect(logout.ok(), "Sign out this test browser before account cleanup").toBe(true);
      for (const id of guests) await deleteTestAccount(id);
    }
  },
});

export { expect };
