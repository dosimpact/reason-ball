import { randomUUID } from "node:crypto";
import type { APIRequestContext, Page } from "@playwright/test";
import { adminClient, expect, signIn, test } from "./fixtures";
const origin = "http://dodonet.iptime.org:13000";
const headers = { Origin: origin };
const manualPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHmsAAAAASUVORK5CYII=";
async function createCharacter(creator: APIRequestContext) {
  const response = await creator.post("/api/characters", { headers, data: {
    name: `Completed edit partner ${randomUUID()}`, role: "Friendly practice partner", tagline: "Disposable completed edit test",
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
    title: `Completed edit ${randomUUID()}`, subtitle: "Introduce yourself politely.", description: "Greet the partner and give a fictional name.",
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

// Manual image fixture is a publishing prerequisite, not an AI image-generation claim.
test("LEARN-09/10 completed mission keeps its historical award after evidence edit and requires a separate retake", async ({ page, account, request, createAccount }) => {
  test.setTimeout(300_000);
  await signIn(request, await createAccount());
  try {
    const missionId = await createMission(request, missionDraft(await createCharacter(request)));
    const baselineXp = await profileXp(account!.id);
    const run = await startFromDetail(page, missionId);
    await sendTurn(page, run.conversationId, "Hello! My name is Alex. It is nice to meet you.", 1);
    const completionResponse = page.waitForResponse(response => new URL(response.url()).pathname === `/api/mission-runs/${run.id}/complete`, { timeout: 90_000 }).catch(() => null);
    const evaluated = await evaluate(page);
    expect(evaluated.evaluation.passed).toBe(true);
    const completed = await completionResponse;
    expect(completed).not.toBeNull(); expect(completed!.ok()).toBe(true);
    const award = (await completed!.json()).result;
    expect(award.experiencePointsAwarded).toBeGreaterThan(0);
    expect(await profileXp(account!.id)).toBe(baselineXp + award.experiencePointsAwarded);
    expect(await awards(run.id)).toEqual([{ id: award.rewardUnlockId }]);
    const historical = await adminClient().from("mission_evaluations").select("*").eq("id", evaluated.evaluation.id).single();
    expect(historical.error).toBeNull();
    const originalRunResponse = await page.request.get(`/api/mission-runs/${run.id}`);
    expect(originalRunResponse.ok()).toBe(true);
    const originalRun = (await originalRunResponse.json()).run;
    const oldMessages = await adminClient().from("messages").select("id").eq("conversation_id", run.conversationId);
    expect(oldMessages.error).toBeNull(); expect(oldMessages.data).toHaveLength(2);

    await page.getByTestId("message-user").getByRole("button", { name: "메시지 편집", exact: true }).click();
    const replacement = "How much does one cup of tea cost, please?";
    await page.getByTestId("chat-input").fill(replacement);
    const branch = page.waitForResponse(response => response.request().method() === "PATCH" && new URL(response.url()).pathname.startsWith(`/api/conversations/${run.conversationId}/messages/`));
    await page.getByRole("button", { name: "수정한 메시지 보내기", exact: true }).click();
    expect((await branch).ok()).toBe(true);
    await expect.poll(async () => {
      const rows = await adminClient().from("messages").select("id,role,status").eq("conversation_id", run.conversationId);
      expect(rows.error).toBeNull();
      return rows.data!.length === 2 && rows.data!.some(row => row.role === "assistant" && row.status === "complete") && rows.data!.every(row => !oldMessages.data!.some(old => old.id === row.id));
    }, { timeout: 120_000 }).toBe(true);
    await expect(page.getByTestId("message-user")).toContainText(replacement);
    await expect(page.getByTestId("message-user")).not.toContainText("My name is Alex");
    const current = await adminClient().from("messages").select("id,client_message_id,role,parts").eq("conversation_id", run.conversationId).order("sequence_number");
    expect(current.error).toBeNull();
    const rejected = await page.request.post("/api/ai/evaluate", { headers, data: {
      runId: run.id, messages: current.data!.map(row => ({ id: row.client_message_id ?? row.id, role: row.role,
        text: (row.parts as Array<{ type: string; text?: string }>).filter(part => part.type === "text").map(part => part.text ?? "").join("").trim() })),
    } });
    expect(rejected.status()).toBe(409);
    expect((await rejected.json()).error.code).toBe("MISSION_RUN_FINALIZED");
    const replay = await page.request.post(`/api/mission-runs/${run.id}/complete`, { headers, data: { evaluationId: evaluated.evaluation.id, rewardId: evaluated.rewardId } });
    expect(replay.ok()).toBe(true); expect((await replay.json()).result.alreadyCompleted).toBe(true);
    const persisted = await adminClient().from("mission_evaluations").select("*").eq("mission_run_id", run.id);
    expect(persisted.error).toBeNull(); expect(persisted.data).toEqual([historical.data]);
    const restoredResponse = await page.request.get(`/api/mission-runs/${run.id}`);
    expect(restoredResponse.ok()).toBe(true);
    const restored = (await restoredResponse.json()).run;
    expect(restored.status).toBe("passed"); expect(restored.evaluation).toEqual(originalRun.evaluation);
    expect(restored.completion).toEqual(originalRun.completion);
    expect(restored.steps).toEqual(originalRun.steps);
    expect(await profileXp(account!.id)).toBe(baselineXp + award.experiencePointsAwarded);
    expect(await awards(run.id)).toEqual([{ id: award.rewardUnlockId }]);
    const conversationUrl = page.url();
    await page.reload();
    await expect(page.getByTestId("conversation-id")).toHaveText(run.conversationId);
    await expect(page.getByRole("button", { name: "새 시도로 다시 도전", exact: true })).toBeVisible();
    await page.goto("/profile");
    await page.getByRole("tab", { name: "보상 컬렉션", exact: true }).click();
    await expect(page.getByTestId(`reward-${missionId}`)).toHaveAttribute("data-reward-state", "ready");
    const rewardResponse = await page.request.get(`/api/uploads/rewards/${missionId}`);
    expect(rewardResponse.ok()).toBe(true);
    const reward = (await rewardResponse.json()).reward;
    expect(reward.unlockId).toBe(award.rewardUnlockId);
    const original = await page.request.get(reward.url);
    expect(original.ok()).toBe(true);
    expect(await original.body()).toEqual(Buffer.from(manualPng.split(",")[1], "base64"));

    await page.goto(conversationUrl);
    const retaken = page.waitForResponse(response => new URL(response.url()).pathname === "/api/mission-runs" && response.request().method() === "POST");
    await page.getByRole("button", { name: "새 시도로 다시 도전", exact: true }).click();
    const retakenResponse = await retaken;
    expect(retakenResponse.ok()).toBe(true);
    const next = (await retakenResponse.json()).run;
    expect(next.id).toMatch(/^[0-9a-f-]{36}$/); expect(next.id).not.toBe(run.id);
    expect(next.conversationId).toMatch(/^[0-9a-f-]{36}$/); expect(next.conversationId).not.toBe(run.conversationId);
    expect(next.attemptNumber).toBe(2); expect(next.best.score).toBe(evaluated.evaluation.totalScore);
    expect(next.evaluation).toBeUndefined(); expect(next.completion).toBeUndefined();
    await expect(page.getByTestId("conversation-id")).toHaveText(next.conversationId);
    expect(await awards(next.id)).toEqual([]);
    expect(await awards(run.id)).toEqual([{ id: award.rewardUnlockId }]);
    expect(await profileXp(account!.id)).toBe(baselineXp + award.experiencePointsAwarded);
  } finally { await request.post("/api/auth/logout", { headers }); }
});
