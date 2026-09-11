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

// Fixture images are manually authored PNGs stored by real publishing APIs.
// Both failed and passed evaluations come from the real model and user evidence.
test("LEARN-02/09/10 failed evaluation keeps one run and awards nothing until continued learner evidence passes", async ({ page, account, request, createAccount }) => {
  test.setTimeout(300_000);
  await signIn(request, await createAccount());
  try {
    const character = await createCharacter(request);
    const draft = missionDraft(character);
    draft.title = `Cafe recovery ${randomUUID()}`;
    draft.description = "The learner must introduce themselves and ask the price of one cup of tea. Both are required. Only learner messages count as evidence.";
    draft.objectives.push({ id: "price", label: "Ask how much one cup of tea costs", hint: "How much does a cup of tea cost?" });
    draft.steps.push({ id: "price", label: "Ask how much one cup of tea costs", hint: "How much does a cup of tea cost?", required: true, successCriteria: ["The learner explicitly asks the price of one cup of tea; a character saying the price is not learner evidence"] });
    const missionId = await createMission(request, draft);
    const beforeXp = await profileXp(account!.id);
    const run = await startFromDetail(page, missionId);
    // This first turn intentionally contains no price question.
    await sendTurn(page, run.conversationId, "Hello! My name is Alex. It is nice to meet you.", 1);
    const transcriptRows = await adminClient().from("messages")
      .select("id,client_message_id,role,parts").eq("conversation_id", run.conversationId).order("sequence_number");
    expect(transcriptRows.error).toBeNull();
    expect(transcriptRows.data).toHaveLength(2);
    const originalTranscript = transcriptRows.data!.map(message => ({
      id: message.client_message_id ?? message.id, role: message.role,
      text: (message.parts as Array<{ type: string; text?: string }>).filter(part => part.type === "text").map(part => part.text ?? "").join("").trim(),
    }));
    async function evaluationState() {
      const evaluationRows = await adminClient().from("mission_evaluations").select("id,status,passed")
        .eq("mission_run_id", run.id).order("id");
      const steps = await adminClient().from("mission_step_progress").select("mission_step_id,status,evidence_message_ids")
        .eq("mission_run_id", run.id).order("mission_step_id");
      const state = await page.request.get(`/api/mission-runs/${run.id}`);
      expect(evaluationRows.error).toBeNull(); expect(steps.error).toBeNull(); expect(state.ok()).toBe(true);
      return { evaluations: evaluationRows.data, steps: steps.data, run: (await state.json()).run,
        xp: await profileXp(account!.id), unlocks: await awards(run.id) };
    }
    const beforeForgery = await evaluationState();
    const userIndex = originalTranscript.findIndex(message => message.role === "user");
    const assistantIndex = originalTranscript.findIndex(message => message.role === "assistant");
    expect(userIndex).toBeGreaterThanOrEqual(0); expect(assistantIndex).toBeGreaterThanOrEqual(0);
    const editedText = structuredClone(originalTranscript);
    editedText[userIndex].text += " How much does one cup of tea cost?";
    const forgedRole = structuredClone(originalTranscript);
    forgedRole[assistantIndex].role = "user";
    const inventedId = structuredClone(originalTranscript);
    inventedId[userIndex].id = randomUUID();
    const duplicate = [originalTranscript[userIndex], originalTranscript[userIndex]];
    for (const messages of [editedText, forgedRole, inventedId, duplicate]) {
      const rejected = await page.request.post("/api/ai/evaluate", { headers, data: { runId: run.id, messages } });
      expect(rejected.status(), "Unstored or forged evidence must be rejected before evaluating").toBe(409);
      expect((await rejected.json()).error.code).toBe("EVALUATION_TRANSCRIPT_CHANGED");
      expect(await evaluationState()).toEqual(beforeForgery);
    }
    const first = await evaluate(page);
    expect(first.evaluation.passed).toBe(false);
    const failed = await adminClient().from("mission_runs").select("status,awarded_evaluation_id,completed_at").eq("id", run.id).single();
    expect(failed.error).toBeNull();
    expect(failed.data).toEqual({ status: "failed", awarded_evaluation_id: null, completed_at: null });
    expect(await awards(run.id)).toEqual([]);
    expect(await profileXp(account!.id)).toBe(beforeXp);
    await page.reload();
    await expect(page.getByTestId("conversation-id")).toHaveText(run.conversationId);
    await expect(page.getByRole("button", { name: "대화 이어서 연습하기", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "대화 이어서 연습하기", exact: true }).click();
    await sendTurn(page, run.conversationId, "Hello, my name is Alex. How much does one cup of tea cost, please?", 2);
    const beforeStale = await evaluationState();
    const stale = await page.request.post("/api/ai/evaluate", { headers, data: { runId: run.id, messages: originalTranscript } });
    expect(stale.status(), "An old transcript cannot omit the newly persisted turn").toBe(409);
    expect((await stale.json()).error.code).toBe("EVALUATION_TRANSCRIPT_CHANGED");
    expect(await evaluationState()).toEqual(beforeStale);
    const completion = page.waitForResponse(response => new URL(response.url()).pathname === `/api/mission-runs/${run.id}/complete`, { timeout: 90_000 }).catch(() => null);
    const second = await evaluate(page);
    expect(second.evaluation.passed).toBe(true);
    expect(second.evaluation.id).not.toBe(first.evaluation.id);
    const completed = await completion;
    expect(completed).not.toBeNull(); expect(completed!.ok()).toBe(true);
    const award = (await completed!.json()).result;
    const stored = await adminClient().from("mission_runs").select("id,status,attempt_number,awarded_evaluation_id").eq("owner_id", account!.id).eq("mission_id", missionId);
    expect(stored.error).toBeNull();
    expect(stored.data).toEqual([{ id: run.id, status: "passed", attempt_number: 1, awarded_evaluation_id: second.evaluation.id }]);
    const progress = await adminClient().from("mission_step_progress").select("status,evidence_message_ids").eq("mission_run_id", run.id);
    expect(progress.error).toBeNull(); expect(progress.data).toHaveLength(2);
    const learnerMessages = await adminClient().from("messages").select("id")
      .eq("conversation_id", run.conversationId).eq("role", "user").eq("author_id", account!.id);
    expect(learnerMessages.error).toBeNull();
    expect(learnerMessages.data).toHaveLength(2);
    const learnerEvidenceIds = learnerMessages.data!.map(message => message.id);
    for (const step of progress.data!) {
      expect(step.status).toBe("completed");
      expect(step.evidence_message_ids.length).toBeGreaterThan(0);
      for (const id of step.evidence_message_ids) expect(learnerEvidenceIds).toContain(id);
    }
    expect(await awards(run.id)).toHaveLength(1);
    expect(await profileXp(account!.id)).toBe(beforeXp + award.experiencePointsAwarded);
    const replay = await page.request.post(`/api/mission-runs/${run.id}/complete`, { headers, data: { evaluationId: second.evaluation.id, rewardId: second.rewardId } });
    expect(replay.ok()).toBe(true); expect((await replay.json()).result.alreadyCompleted).toBe(true);
    expect(await awards(run.id)).toHaveLength(1);
    expect(await profileXp(account!.id)).toBe(beforeXp + award.experiencePointsAwarded);
    await page.reload();
    await expect(page.getByTestId("conversation-id")).toHaveText(run.conversationId);
    await expect(page.getByRole("button", { name: "새 시도로 다시 도전", exact: true })).toBeVisible();
    const restored = await page.request.get(`/api/mission-runs/${run.id}`);
    expect(restored.ok()).toBe(true);
    expect((await restored.json()).run.completion.missionEvaluationId).toBe(second.evaluation.id);
  } finally { await request.post("/api/auth/logout", { headers }); }
});
