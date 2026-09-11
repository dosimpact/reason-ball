import { randomUUID } from "node:crypto";
import type { APIRequestContext, Page } from "@playwright/test";
import { adminClient, expect, signIn, test } from "./fixtures";

const origin = "http://dodonet.iptime.org:13000";
const headers = { Origin: origin };
const manualPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHmsAAAAASUVORK5CYII=";

async function createCharacter(creator: APIRequestContext) {
  const response = await creator.post("/api/characters", { headers, data: {
    name: `Prerequisite partner ${randomUUID()}`, role: "Friendly practice partner", tagline: "Disposable prerequisite test",
    description: "Help a learner introduce themselves.", personality: ["다정함"], personaGoal: "Welcome the learner.",
    learningGoal: "Practice greetings.", speakingStyle: "Short clear English.", relationship: "Practice partner", teachingStyle: "Give gentle correction.",
    prohibitedInstructions: ["Do not ask for private data."], accent: "American", level: "입문", topics: ["일상"],
    palette: ["#ff8067", "#ffc65c"], emoji: "🌱", visibility: "public", publishStatus: "published", imageUrl: manualPng,
  } });
  expect(response.ok(), `Create character ${response.status()}`).toBe(true);
  return (await response.json()).item.id as string;
}
function missionDraft(characterId: string, prerequisites: string[] = []) {
  return {
    title: `Prerequisite greeting ${randomUUID()}`, subtitle: "Introduce yourself politely.", description: "Greet the partner and give a fictional name.",
    category: "일상", location: "Practice cafe", difficulty: "입문", durationMinutes: 3,
    objectives: [{ id: "greeting", label: "Greet and introduce yourself", hint: "Hello, my name is Alex." }],
    steps: [{ id: "greeting", label: "Greet and introduce yourself", hint: "Hello, my name is Alex.", required: true, successCriteria: ["Learner gives a polite greeting", "Learner gives a fictional name"] }],
    keyPhrases: [{ english: "Hello, my name is Alex.", korean: "안녕하세요, 제 이름은 알렉스예요." }],
    successThreshold: 70, prerequisites, rewardTitle: "Greeting keepsake", rewardPalette: ["#ff8067", "#ffc65c"], rewardEmoji: "🌱",
    rewardImageUrl: manualPng, recommendedCharacterId: characterId, publishStatus: "published",
  };
}
async function createMission(creator: APIRequestContext, draft: ReturnType<typeof missionDraft>) {
  const response = await creator.post("/api/missions", { headers, data: draft });
  expect(response.ok(), `Create published mission ${response.status()}`).toBe(true);
  return (await response.json()).item.id as string;
}
async function startFromDetail(page: Page, missionId: string) {
  await page.goto(`/missions/${missionId}`);
  const started = page.waitForResponse(response => new URL(response.url()).pathname === "/api/mission-runs" && response.request().method() === "POST");
  await page.getByTestId("start-mission").click();
  const response = await started;
  expect(response.ok(), `Start mission ${response.status()}`).toBe(true);
  const { run } = await response.json();
  await expect(page.getByTestId("conversation-id")).toHaveText(run.conversationId);
  return run;
}
async function expectStartDenied(request: APIRequestContext, missionId: string, characterId: string) {
  for (const endpoint of ["/api/mission-runs", "/api/conversations"]) {
    const response = await request.post(endpoint, { headers, data: { missionId, characterId } });
    expect(response.status(), endpoint).toBe(409);
    expect((await response.json()).error.code).toBe("MISSION_PREREQUISITES_REQUIRED");
  }
}
async function countRuns(owner: string, mission: string) {
  const result = await adminClient().from("mission_runs").select("id").eq("owner_id", owner).eq("mission_id", mission);
  expect(result.error).toBeNull();
  return result.data!.length;
}

// Manual PNG fixtures supply published content. Passing A is earned through real
// chat, evaluation and completion, never a forged passed run or localStorage flag.
test("MISSION-09 real prerequisite blocks UI and direct starts until this learner earns completion", async ({ page, account, request, createAccount, playwright }) => {
  test.setTimeout(300_000);
  await signIn(request, await createAccount());
  const outsider = await playwright.request.newContext({ baseURL: origin });
  try {
    await signIn(outsider, await createAccount());
    const character = await createCharacter(request);
    const prerequisite = await createMission(request, missionDraft(character));
    const dependent = await createMission(request, missionDraft(character, [prerequisite]));
    await page.goto(`/missions/${dependent}`);
    await expect(page.getByTestId("mission-prerequisite-gate")).toBeVisible();
    await expect(page.getByTestId("start-mission")).toHaveCount(0);
    await expectStartDenied(page.request, dependent, character);
    expect(await countRuns(account!.id, dependent)).toBe(0);
    const conversations = await adminClient().from("conversations").select("id").eq("owner_id", account!.id).eq("mission_id", dependent);
    expect(conversations.error).toBeNull();
    expect(conversations.data).toEqual([]);
    const run = await startFromDetail(page, prerequisite);
    await page.getByTestId("chat-input").fill("Hello! My name is Alex. It is very nice to meet you today.");
    await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
    await expect.poll(async () => {
      const result = await adminClient().from("messages").select("id").eq("conversation_id", run.conversationId).eq("role", "assistant").eq("status", "complete");
      expect(result.error).toBeNull(); return result.data!.length;
    }, { timeout: 120_000 }).toBe(1);
    const evaluated = page.waitForResponse(response => new URL(response.url()).pathname === "/api/ai/evaluate", { timeout: 90_000 });
    const completed = page.waitForResponse(response => new URL(response.url()).pathname === `/api/mission-runs/${run.id}/complete`, { timeout: 90_000 }).catch(() => null);
    await page.getByRole("button", { name: "미션 마치고 평가받기", exact: true }).click();
    const evaluation = await evaluated;
    expect(evaluation.ok()).toBe(true);
    expect((await evaluation.json()).evaluation.passed).toBe(true);
    const completion = await completed;
    expect(completion).not.toBeNull(); expect(completion!.ok()).toBe(true);
    const persisted = await adminClient().from("mission_runs").select("status,completed_at,awarded_evaluation_id,owner_id").eq("id", run.id).single();
    expect(persisted.error).toBeNull();
    expect(persisted.data).toMatchObject({ status: "passed", owner_id: account!.id });
    expect(persisted.data!.completed_at).not.toBeNull();
    expect(persisted.data!.awarded_evaluation_id).not.toBeNull();
    await page.goto(`/missions/${dependent}`);
    await page.reload();
    await expect(page.getByTestId("mission-prerequisite-gate")).toHaveCount(0);
    await expect(page.getByTestId("start-mission")).toBeVisible();
    const unlockedRun = await startFromDetail(page, dependent);
    expect(unlockedRun.attemptNumber).toBe(1);
    const dependentVersion = await adminClient().from("missions").select("current_version_id").eq("id", dependent).single();
    expect(dependentVersion.error).toBeNull();
    expect(unlockedRun.missionVersionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(unlockedRun.missionVersionId).toBe(dependentVersion.data!.current_version_id);
    expect(await countRuns(account!.id, dependent)).toBe(1);
    await expectStartDenied(outsider, dependent, character);
  } finally {
    await outsider.post("/api/auth/logout", { headers }); await outsider.dispose();
    await request.post("/api/auth/logout", { headers });
  }
});

test("MISSION-09 pinned run resumes after a new version adds prerequisites while new starts are denied", async ({ page, request, account, createAccount }) => {
  await signIn(request, await createAccount());
  try {
    const character = await createCharacter(request);
    const prerequisite = await createMission(request, missionDraft(character));
    const draft = missionDraft(character);
    const dependent = await createMission(request, draft);
    const existing = await startFromDetail(page, dependent);
    const conversationUrl = page.url();
    const revised = await request.patch(`/api/missions/${dependent}`, { headers, data: {
      action: "create-version", expectedVersion: 1, draft: { ...draft, prerequisites: [prerequisite] },
    } });
    expect(revised.ok(), `Publish changed prerequisites ${revised.status()}`).toBe(true);
    const { versionId } = await revised.json();
    expect(versionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(versionId).not.toBe(existing.missionVersionId);
    const published = await adminClient().from("missions").select("current_version_id,status").eq("id", dependent).single();
    expect(published.error).toBeNull();
    expect(published.data).toEqual({ current_version_id: versionId, status: "published" });
    await page.goto(`/missions/${dependent}`);
    await expect(page.getByTestId("mission-prerequisite-gate")).toBeVisible();
    // Documented legacy POST without a conversation resumes an existing active
    // run. It does not request a new attempt, so assert its preserved identity.
    const legacy = await page.request.post("/api/mission-runs", { headers, data: { missionId: dependent, characterId: character } });
    expect(legacy.ok()).toBe(true);
    expect((await legacy.json()).run).toMatchObject({ id: existing.id, missionVersionId: existing.missionVersionId });
    const create = await page.request.post("/api/conversations", { headers, data: { missionId: dependent, characterId: character } });
    expect(create.status()).toBe(409);
    expect((await create.json()).error.code).toBe("MISSION_PREREQUISITES_REQUIRED");
    const newAttempt = page.waitForResponse(response => new URL(response.url()).pathname === "/api/conversations" && response.request().method() === "POST");
    await page.goto(`/chat/${character}?mission=${dependent}&attempt=new`);
    expect((await newAttempt).status()).toBe(409);
    await expect(page.getByRole("alert").filter({ hasText: "선수 미션" })).toBeVisible();
    const remaining = await adminClient().from("conversations").select("id").eq("owner_id", account!.id).eq("mission_id", dependent);
    expect(remaining.error).toBeNull();
    expect(remaining.data).toEqual([{ id: existing.conversationId }]);
    expect(await countRuns(account!.id, dependent)).toBe(1);
    await page.goto(conversationUrl);
    await page.reload();
    await expect(page.getByTestId("conversation-id")).toHaveText(existing.conversationId);
    const resume = await page.request.post("/api/mission-runs", { headers, data: {
      missionId: dependent, characterId: character, conversationId: existing.conversationId,
    } });
    expect(resume.ok()).toBe(true);
    const resumed = (await resume.json()).run;
    expect(resumed).toMatchObject({ id: existing.id, missionVersionId: existing.missionVersionId, attemptNumber: 1 });
    expect(resumed.steps).toEqual(existing.steps);
    expect(await countRuns(account!.id, dependent)).toBe(1);
    await expect(page.getByTestId("chat-input")).toBeEnabled();
  } finally { await request.post("/api/auth/logout", { headers }); }
});
