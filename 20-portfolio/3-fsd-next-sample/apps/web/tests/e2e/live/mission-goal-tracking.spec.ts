import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { APIRequestContext, Page } from "@playwright/test";
import type { MissionRun } from "@/entities/mission-run/model/types";
import { adminClient, expect, signIn, test } from "./fixtures";

const headers = { Origin: "http://dodonet.iptime.org:13000" };
const manualPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHmsAAAAASUVORK5CYII=";
const greeting = "Hello! My name is Alex. It is nice to meet you.";
const price = "How much does one cup of tea cost, please?";

async function publishCafe(creator: APIRequestContext) {
  const character = await creator.post("/api/characters", { headers, data: {
    name: `Goal tracking barista ${randomUUID()}`, role: "Friendly cafe barista", tagline: "Practice two cafe goals",
    description: "Help a learner introduce themselves and ask the price of tea.", personality: ["다정함"],
    personaGoal: "Welcome the learner and serve tea.", learningGoal: "Practice greetings and asking prices.",
    speakingStyle: "Short clear English.", relationship: "Cafe barista", teachingStyle: "Reply naturally to the learner in the cafe. Tea costs three dollars. Do not claim that your own examples are the learner's achievements.",
    prohibitedInstructions: ["Do not ask for private data."], accent: "American", level: "입문", topics: ["일상"],
    palette: ["#ff8067", "#ffc65c"], emoji: "🌱", visibility: "public", publishStatus: "published", imageUrl: manualPng,
  } });
  expect(character.ok(), `Publish character ${character.status()}`).toBe(true);
  const characterId = (await character.json()).item.id as string;
  const steps = [
    { id: "greeting", label: "Greet and introduce yourself", hint: "Hello, my name is Alex.", required: true,
      successCriteria: ["The learner gives a polite greeting AND their fictional name. An assistant greeting or example is not learner evidence."] },
    { id: "price", label: "Ask how much one cup of tea costs", hint: price, required: true,
      successCriteria: ["The learner explicitly asks the price of one cup of tea. The assistant saying the price or asking a question is not learner evidence."] },
  ];
  const mission = await creator.post("/api/missions", { headers, data: {
    title: `Automatic cafe goals ${randomUUID()}`, subtitle: "Introduce yourself and ask the tea price.",
    description: "Both goals require actual learner speech. Either goal may be achieved first; unrelated small talk achieves neither goal.",
    category: "일상", location: "Practice cafe", difficulty: "입문", durationMinutes: 3,
    objectives: steps.map(({ id, label, hint }) => ({ id, label, hint })), steps,
    keyPhrases: [{ english: price, korean: "차 한 잔은 얼마인가요?" }], successThreshold: 70, prerequisites: [],
    rewardTitle: "Cafe goal keepsake", rewardPalette: ["#ff8067", "#ffc65c"], rewardEmoji: "🌱", rewardImageUrl: manualPng,
    recommendedCharacterId: characterId, publishStatus: "published",
  } });
  expect(mission.ok(), `Publish mission ${mission.status()}`).toBe(true);
  return (await mission.json()).item.id as string;
}

async function start(page: Page, missionId: string): Promise<MissionRun> {
  await page.goto(`/missions/${missionId}`);
  const pending = page.waitForResponse(response => new URL(response.url()).pathname === "/api/mission-runs" && response.request().method() === "POST");
  await page.getByTestId("start-mission").click();
  const response = await pending;
  expect(response.ok()).toBe(true);
  const run = (await response.json()).run as MissionRun;
  await expect(page.getByTestId("conversation-id")).toHaveText(run.conversationId!);
  expect(run.steps).toHaveLength(2);
  return run;
}

async function readRun(page: Page, runId: string): Promise<MissionRun> {
  const response = await page.request.get(`/api/mission-runs/${runId}`);
  expect(response.ok()).toBe(true);
  return (await response.json()).run;
}

async function transcript(conversationId: string) {
  const result = await adminClient().from("messages").select("id,role,author_id,status,parts")
    .eq("conversation_id", conversationId).order("sequence_number");
  expect(result.error).toBeNull();
  return result.data!.map(row => ({ ...row,
    text: (row.parts as Array<{ type: string; text?: string }>).filter(part => part.type === "text").map(part => part.text ?? "").join("").trim(),
  }));
}

async function send(page: Page, run: MissionRun, text: string, answerCount: number) {
  await page.getByTestId("chat-input").fill(text);
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  await expect.poll(async () => (await transcript(run.conversationId!))
    .filter(row => row.role === "assistant" && row.status === "complete").length, { timeout: 120_000 }).toBe(answerCount);
  await expect(page.getByTestId("message-user").last()).toContainText(text);
  await expect(page.getByRole("button", { name: "답변 생성 중지", exact: true })).toHaveCount(0);
  return (await transcript(run.conversationId!)).filter(row => row.role === "assistant").at(-1)!.text;
}

async function assertProgress(page: Page, run: MissionRun, statuses: string[], currentOrder?: number) {
  await expect.poll(async () => (await readRun(page, run.id)).steps.map(step => step.status), { timeout: 90_000 }).toEqual(statuses);
  const saved = await readRun(page, run.id);
  const panel = page.getByTestId("mission-progress");
  await expect(panel).toHaveCount(1);
  await expect(panel).toBeVisible();
  for (const [index, step] of saved.steps.entries()) {
    const row = panel.getByTestId(`mission-progress-step-${step.id}`);
    await expect(row).toHaveAttribute("data-status", statuses[index]);
    await expect(row).toContainText(step.label);
    if (statuses[index] === "active") await expect(row).toHaveAttribute("aria-current", "step");
    else await expect(row).not.toHaveAttribute("aria-current", "step");
  }
  if (currentOrder !== undefined) {
    expect(saved.currentStepOrder).toBe(currentOrder);
    await expect(panel.getByTestId("mission-current-step")).toHaveText(`현재 단계: ${saved.steps.find(step => step.order === currentOrder)!.label}`);
  } else {
    await expect(panel.getByTestId("mission-current-step")).toHaveText("필수 목표를 모두 달성했어요.");
  }
  return saved;
}

async function noFinalOutcome(owner: string, runId: string, initialXp?: number) {
  const admin = adminClient();
  const [run, evaluations, rewards, profile] = await Promise.all([
    admin.from("mission_runs").select("status,awarded_evaluation_id,completed_at").eq("id", runId).single(),
    admin.from("mission_evaluations").select("id").eq("mission_run_id", runId),
    admin.from("reward_unlocks").select("id").eq("mission_run_id", runId),
    admin.from("profiles").select("experience_points").eq("id", owner).single(),
  ]);
  for (const result of [run, evaluations, rewards, profile]) expect(result.error).toBeNull();
  expect(run.data).toEqual({ status: "in-progress", awarded_evaluation_id: null, completed_at: null });
  expect(evaluations.data).toEqual([]);
  expect(rewards.data).toEqual([]);
  if (initialXp !== undefined) expect(profile.data!.experience_points).toBe(initialXp);
  return profile.data!.experience_points as number;
}

async function assertOwnedEvidence(run: MissionRun, owner: string, expectedTexts: string[]) {
  const rows = await transcript(run.conversationId!);
  for (const [index, step] of run.steps.entries()) {
    expect(step.status).toBe("completed");
    expect(step.evidenceMessageIds.length).toBeGreaterThan(0);
    for (const id of step.evidenceMessageIds) {
      const evidence = rows.find(row => row.id === id);
      expect(evidence, "Evidence is a canonical stored learner message ID").toBeDefined();
      expect(evidence!.role).toBe("user");
      expect(evidence!.author_id).toBe(owner);
      expect(evidence!.text).toBe(expectedTexts[index]);
    }
  }
}

// Manual PNGs only set up authored catalogue resources. Goal completion is never seeded:
// every progress change below must follow a real learner turn and actual model classification.
test("LEARN-02 each learner turn updates goals without final evaluation, unrelated talk does not complete a goal, and mobile reload restores evidence", async ({ page, account, request, createAccount }, testInfo) => {
  test.setTimeout(420_000);
  await signIn(request, await createAccount());
  try {
    const missionId = await publishCafe(request);
    await page.setViewportSize({ width: 390, height: 844 });
    const run = await start(page, missionId);
    const xp = await noFinalOutcome(account!.id, run.id);
    await assertProgress(page, run, ["active", "locked"], 1);
    await send(page, run, greeting, 1);
    const afterGreeting = await assertProgress(page, run, ["completed", "active"], 2);
    await noFinalOutcome(account!.id, run.id, xp);
    await send(page, run, "My favorite color is blue.", 2);
    const afterUnrelated = await assertProgress(page, run, ["completed", "active"], 2);
    expect(afterUnrelated.steps[0].evidenceMessageIds).toEqual(afterGreeting.steps[0].evidenceMessageIds);
    expect(afterUnrelated.steps[1].evidenceMessageIds).toEqual([]);
    await noFinalOutcome(account!.id, run.id, xp);
    const finalReply = await send(page, run, price, 3);
    const completedGoals = await assertProgress(page, run, ["completed", "completed"]);
    await assertOwnedEvidence(completedGoals, account!.id, [greeting, price]);
    expect(finalReply, "The actual barista acknowledges completion or offers a natural wrap-up").toMatch(/well done|good job|great job|nice work|great work|complete|finish|enjoy|see you|have a (?:great|nice|good)|잘했|완료|마무리|수고/i);
    await noFinalOutcome(account!.id, run.id, xp);
    await page.reload();
    await expect(page.getByTestId("conversation-id")).toHaveText(run.conversationId!);
    const restored = await assertProgress(page, run, ["completed", "completed"]);
    expect(restored.steps).toEqual(completedGoals.steps);
    await noFinalOutcome(account!.id, run.id, xp);
    await testInfo.attach("actual-automatic-goals", { body: JSON.stringify({ afterGreeting, afterUnrelated, completedGoals, finalReply }, null, 2), contentType: "application/json" });
  } finally { await request.post("/api/auth/logout", { headers }); }
});

test("LEARN-02 later goal achieved first leaves the earlier goal active instead of marking a completed prefix", async ({ page, account, request, createAccount }, testInfo) => {
  test.setTimeout(300_000);
  await signIn(request, await createAccount());
  try {
    const run = await start(page, await publishCafe(request));
    const xp = await noFinalOutcome(account!.id, run.id);
    const baseline = await assertProgress(page, run, ["active", "locked"], 1);
    const forgedProgress = await page.request.patch(`/api/mission-runs/${run.id}/progress`, {
      headers, data: { stepId: run.steps[0].id, status: "completed", evidenceMessageIds: [] },
    });
    expect(forgedProgress.status()).toBe(403);
    expect((await forgedProgress.json()).error.code).toBe("MISSION_PROGRESS_SERVER_MANAGED");
    expect((await readRun(page, run.id)).steps).toEqual(baseline.steps);
    // Use an ordinary owner's publishable-key SDK session, never the admin client,
    // to prove bypassing the app route cannot forge goal completion either.
    const ownerClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    expect((await ownerClient.auth.signInWithPassword({ email: account!.email, password: account!.password })).error).toBeNull();
    try {
      const owned = await ownerClient.from("mission_step_progress").select("mission_step_id,status")
        .eq("mission_run_id", run.id).eq("mission_step_id", run.steps[0].id);
      expect(owned.error).toBeNull();
      expect(owned.data).toEqual([{ mission_step_id: run.steps[0].id, status: "active" }]);
      const forged = await ownerClient.from("mission_step_progress")
        .update({ status: "completed", evidence_message_ids: [] })
        .eq("mission_run_id", run.id).eq("mission_step_id", run.steps[0].id).select("mission_step_id,status");
      if (forged.error) expect(forged.error.code).toBe("42501");
      else expect(forged.data).toEqual([]);
    } finally { await ownerClient.auth.signOut(); }
    expect((await readRun(page, run.id)).steps).toEqual(baseline.steps);
    await noFinalOutcome(account!.id, run.id, xp);
    await send(page, run, price, 1);
    const outOfOrder = await assertProgress(page, run, ["active", "completed"], 1);
    expect(outOfOrder.steps[0].evidenceMessageIds).toEqual([]);
    expect(outOfOrder.steps[1].evidenceMessageIds).toHaveLength(1);
    await noFinalOutcome(account!.id, run.id, xp);
    await page.reload();
    await expect(page.getByTestId("conversation-id")).toHaveText(run.conversationId!);
    const restored = await assertProgress(page, run, ["active", "completed"], 1);
    expect(restored.steps).toEqual(outOfOrder.steps);
    await send(page, run, greeting, 2);
    const completedGoals = await assertProgress(page, run, ["completed", "completed"]);
    await assertOwnedEvidence(completedGoals, account!.id, [greeting, price]);
    await noFinalOutcome(account!.id, run.id, xp);
    await testInfo.attach("actual-out-of-order-goals", { body: JSON.stringify({ outOfOrder, completedGoals }, null, 2), contentType: "application/json" });
  } finally { await request.post("/api/auth/logout", { headers }); }
});
