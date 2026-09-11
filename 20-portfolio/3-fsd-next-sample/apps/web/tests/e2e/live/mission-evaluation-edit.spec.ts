import { randomUUID } from "node:crypto";
import type { APIRequestContext, Page } from "@playwright/test";
import { adminClient, expect, signIn, test } from "./fixtures";
const origin = "http://dodonet.iptime.org:13000";
const headers = { Origin: origin };
const manualPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHmsAAAAASUVORK5CYII=";
async function createCharacter(creator: APIRequestContext) {
  const response = await creator.post("/api/characters", { headers, data: {
    name: `Evaluation edit partner ${randomUUID()}`, role: "Friendly practice partner", tagline: "Disposable evaluation edit test",
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
    title: `Evaluation edit ${randomUUID()}`, subtitle: "Introduce yourself politely.", description: "Greet the partner and give a fictional name.",
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

async function profileXp(owner: string) {
  const result = await adminClient().from("profiles").select("experience_points").eq("id", owner).single();
  expect(result.error).toBeNull(); return result.data!.experience_points as number;
}
async function awards(runId: string) {
  const result = await adminClient().from("reward_unlocks").select("id").eq("mission_run_id", runId);
  expect(result.error).toBeNull(); return result.data!;
}
async function sendTurn(page: Page, conversationId: string, text: string, expectedAnswers: number) {
  await page.getByTestId("chat-input").fill(text);
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  await expect.poll(async () => {
    const result = await adminClient().from("messages").select("id").eq("conversation_id", conversationId).eq("role", "assistant").eq("status", "complete");
    expect(result.error).toBeNull(); return result.data!.length;
  }, { timeout: 120_000 }).toBe(expectedAnswers);
  await expect(page.getByTestId("message-user").last()).toContainText(text);
}
async function evaluate(page: Page) {
  const pending = page.waitForResponse(response => new URL(response.url()).pathname === "/api/ai/evaluate", { timeout: 90_000 });
  await page.getByRole("button", { name: "미션 마치고 평가받기", exact: true }).click();
  const response = await pending;
  expect(response.ok(), `Real evaluator ${response.status()}`).toBe(true);
  return response.json();
}

// Publishing uses manual PNG prerequisites. Both evaluations and chat answers use the real provider.
test("LEARN-09/10 edited failed mission restores the same evaluation objectives without rewriting history", async ({ page, account, request, createAccount }) => {
  test.setTimeout(300_000);
  await signIn(request, await createAccount());
  try {
    const characterId = await createCharacter(request);
    const draft = missionDraft(characterId);
    draft.description = "Two required learner objectives: give a greeting AND fictional name; ask the price of one cup of tea. Only learner messages count as evidence.";
    draft.objectives.push({ id: "price", label: "Ask how much one cup of tea costs", hint: "How much does a cup of tea cost?" });
    draft.steps.push({ id: "price", label: "Ask how much one cup of tea costs", hint: "How much does a cup of tea cost?", required: true, successCriteria: ["The learner explicitly asks the price of one cup of tea; assistant statements are not learner evidence"] });
    const missionId = await createMission(request, draft);
    const baselineXp = await profileXp(account!.id);
    const run = await startFromDetail(page, missionId);
    const definitions = await adminClient().from("mission_steps").select("id,title").eq("mission_version_id", run.missionVersionId);
    expect(definitions.error).toBeNull(); expect(definitions.data).toHaveLength(2);
    const greetingId = definitions.data!.find(step => step.title === "Greet and introduce yourself")!.id;
    const priceId = definitions.data!.find(step => step.title === "Ask how much one cup of tea costs")!.id;
    expect(greetingId).toMatch(/^[0-9a-f-]{36}$/); expect(priceId).toMatch(/^[0-9a-f-]{36}$/);
    await sendTurn(page, run.conversationId, "Hello! My name is Alex. It is nice to meet you.", 1);
    const first = await evaluate(page);
    expect(first.evaluation.passed).toBe(false);
    expect(first.evaluation.completedStepIds).toEqual([greetingId]);
    const firstStored = await adminClient().from("mission_evaluations").select("*").eq("id", first.evaluation.id).single();
    expect(firstStored.error).toBeNull();
    const beforeBranch = await adminClient().from("messages").select("id").eq("conversation_id", run.conversationId);
    expect(beforeBranch.error).toBeNull(); expect(beforeBranch.data).toHaveLength(2);
    expect(await profileXp(account!.id)).toBe(baselineXp); expect(await awards(run.id)).toEqual([]);

    await page.getByRole("button", { name: "대화 이어서 연습하기", exact: true }).click();
    await page.getByTestId("message-user").getByRole("button", { name: "메시지 편집", exact: true }).click();
    const replacement = "How much does one cup of tea cost, please?";
    await page.getByTestId("chat-input").fill(replacement);
    const branchResponse = page.waitForResponse(response => response.request().method() === "PATCH" && new URL(response.url()).pathname.startsWith(`/api/conversations/${run.conversationId}/messages/`));
    await page.getByRole("button", { name: "수정한 메시지 보내기", exact: true }).click();
    expect((await branchResponse).ok()).toBe(true);
    await expect.poll(async () => {
      const saved = await adminClient().from("messages").select("id,role,status").eq("conversation_id", run.conversationId);
      expect(saved.error).toBeNull();
      return saved.data!.length === 2 && saved.data!.some(row => row.role === "assistant" && row.status === "complete") && saved.data!.every(row => !beforeBranch.data!.some(old => old.id === row.id));
    }, { timeout: 120_000 }).toBe(true);
    await expect(page.getByTestId("message-user")).toContainText(replacement);
    await expect(page.getByTestId("message-user")).not.toContainText("My name is Alex");
    const historical = await adminClient().from("mission_evaluations").select("*").eq("id", first.evaluation.id).single();
    expect(historical.error).toBeNull(); expect(historical.data).toEqual(firstStored.data);

    const second = await evaluate(page);
    expect(second.evaluation.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(second.evaluation.id).not.toBe(first.evaluation.id);
    expect(second.evaluation.passed).toBe(false);
    expect(second.evaluation.completedStepIds).toEqual([priceId]);
    expect(await profileXp(account!.id)).toBe(baselineXp); expect(await awards(run.id)).toEqual([]);
    const historicalAfter = await adminClient().from("mission_evaluations").select("*").eq("id", first.evaluation.id).single();
    expect(historicalAfter.error).toBeNull(); expect(historicalAfter.data).toEqual(firstStored.data);
    const persisted = await adminClient().from("mission_runs").select("id,status,attempt_number,awarded_evaluation_id").eq("owner_id", account!.id).eq("mission_id", missionId);
    expect(persisted.error).toBeNull(); expect(persisted.data).toEqual([{ id: run.id, status: "failed", attempt_number: 1, awarded_evaluation_id: null }]);

    // Accumulated run progress may retain historical achievements. Each evaluation must
    // nevertheless restore its OWN objectives, rather than silently inheriting old ones.
    const restored = await page.request.get(`/api/mission-runs/${run.id}`);
    expect(restored.ok()).toBe(true);
    const restoredRun = (await restored.json()).run;
    expect(restoredRun.evaluation.id).toBe(second.evaluation.id);
    expect(restoredRun.evaluation.completedStepIds).toEqual(second.evaluation.completedStepIds);
    await page.reload();
    await expect(page.getByTestId("conversation-id")).toHaveText(run.conversationId);
    await expect(page.getByRole("button", { name: "대화 이어서 연습하기", exact: true })).toBeVisible();
    const reloaded = await page.request.get(`/api/mission-runs/${run.id}`);
    expect(reloaded.ok()).toBe(true);
    expect((await reloaded.json()).run.evaluation).toEqual(restoredRun.evaluation);
    expect(await profileXp(account!.id)).toBe(baselineXp); expect(await awards(run.id)).toEqual([]);
  } finally { await request.post("/api/auth/logout", { headers }); }
});
