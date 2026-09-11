import { randomUUID } from "node:crypto";
import { adminClient, expect, test } from "./fixtures";

const headers = { Origin: "http://dodonet.iptime.org:13000" };
const authoredPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHmsAAAAASUVORK5CYII=";
test.setTimeout(240_000);

test("MISSION-02 actual structured AI draft populates creator fields and persists an owned draft", async ({ page, account }) => {
  await page.goto("/missions/new");
  await page.getByTestId("mission-prompt").fill("Create a short beginner English mission: greet a cafe staff member and politely order a cup of tea. Use two clear steps with hints and simple expressions.");
  const generation = page.waitForResponse(response => new URL(response.url()).pathname === "/api/ai/mission-draft");
  await page.getByTestId("generate-mission-draft").click();
  const generated = await generation;
  expect(generated.ok(), `Real mission draft status ${generated.status()}`).toBe(true);
  expect(generated.headers()["x-ai-provider"]).not.toBe("mock");
  const draft = await generated.json();
  await expect(page.getByTestId("mission-draft-source")).toHaveText("AI Route 응답");
  await expect(page.getByTestId("mission-title")).toHaveValue(draft.title);
  const title = `${draft.title.slice(0, 65)} ${randomUUID()}`;
  await page.getByTestId("mission-title").fill(title);
  const characters = await page.request.get("/api/characters");
  expect(characters.ok()).toBe(true);
  await page.getByRole("combobox", { name: /^함께할 캐릭터/ }).selectOption((await characters.json()).items[0].id);
  await page.getByRole("button", { name: "다음 단계", exact: true }).click();
  await expect(page.getByLabel("목표 1", { exact: true })).not.toHaveValue("");
  const objective = await page.getByLabel("목표 1", { exact: true }).inputValue();
  const firstStep = await page.getByLabel("단계 1", { exact: true }).inputValue();
  await page.getByRole("button", { name: "다음 단계", exact: true }).click();
  await page.getByRole("button", { name: "초안으로 저장", exact: true }).click();
  const saved = page.waitForResponse(response => new URL(response.url()).pathname === "/api/missions" && response.request().method() === "POST");
  await page.getByTestId("save-mission").click();
  expect((await saved).ok()).toBe(true);
  const item = (await (await saved).json()).item;
  const resource = await adminClient().from("missions").select("owner_id,status,current_version_id,title").eq("id", item.id).single();
  expect(resource.error).toBeNull();
  expect(resource.data).toMatchObject({ owner_id: account!.id, status: "draft", title });
  const steps = await adminClient().from("mission_steps").select("title,objective").eq("mission_version_id", resource.data!.current_version_id).order("step_order");
  expect(steps.error).toBeNull();
  expect(steps.data?.[0]?.title).toBe(firstStep);
  await page.reload();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(objective, { exact: true }).first()).toBeVisible();
});

test("LEARN-09/10 real evaluation restores goals, new expressions and next mission, completes once and starts a separate attempt", async ({ page, account }) => {
  const characters = await page.request.get("/api/characters");
  expect(characters.ok()).toBe(true);
  const characterId = (await characters.json()).items[0].id;
  // Explicit manual reward-image fixture through the real publishing API.
  // This verifies completion/Storage plumbing, never AI image generation.
  const mission = await page.request.post("/api/missions", { headers, data: {
    title: `Greeting completion ${randomUUID()}`, subtitle: "Introduce yourself politely.", description: "Greet the partner and state a fictional name.",
    category: "일상", location: "Practice cafe", difficulty: "입문", durationMinutes: 3,
    objectives: [{ id: "greeting", label: "Greet and introduce yourself", hint: "Hello, my name is Alex." }],
    steps: [{ id: "greeting", label: "Greet and introduce yourself", hint: "Hello, my name is Alex.", required: true, successCriteria: ["Learner gives a polite greeting", "Learner introduces themselves using a fictional name"] }],
    keyPhrases: [{ english: "Hello, my name is Alex.", korean: "안녕하세요, 제 이름은 알렉스예요." }],
    successThreshold: 70, prerequisites: [], rewardTitle: "Greeting keepsake", rewardPalette: ["#ff8067", "#ffc65c"], rewardEmoji: "🌱",
    rewardImageUrl: authoredPng, recommendedCharacterId: characterId, publishStatus: "published",
  } });
  expect(mission.ok(), `Create published mission with stored fixture: ${mission.status()}`).toBe(true);
  const item = (await mission.json()).item;
  const nextMission = await page.request.post("/api/missions", { headers, data: {
    title: `Next greeting practice ${randomUUID()}`, subtitle: "Ask a friendly follow-up question.", description: "Introduce yourself, then ask how the other person is.",
    category: "일상", location: "Practice cafe", difficulty: "입문", durationMinutes: 3,
    objectives: [{ id: "followup", label: "Ask how your partner is", hint: "How are you today?" }],
    steps: [{ id: "followup", label: "Ask how your partner is", hint: "How are you today?", required: true, successCriteria: ["Learner asks how their partner is"] }],
    keyPhrases: [{ english: "How are you today?", korean: "오늘 어떻게 지내세요?" }],
    successThreshold: 70, prerequisites: [item.id], rewardTitle: "Follow-up keepsake", rewardPalette: ["#ff8067", "#ffc65c"], rewardEmoji: "🌱",
    rewardImageUrl: authoredPng, recommendedCharacterId: characterId, publishStatus: "published",
  } });
  expect(nextMission.ok(), await nextMission.text()).toBe(true);
  const recommended = (await nextMission.json()).item;
  await page.goto(`/missions/${item.id}`);
  const started = page.waitForResponse(response => new URL(response.url()).pathname === "/api/mission-runs" && response.request().method() === "POST");
  await page.getByTestId("start-mission").click();
  expect((await started).ok()).toBe(true);
  const { run } = await (await started).json();
  await page.getByTestId("chat-input").fill("Hello! My name is Alex. I is happy to meet you today.");
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  await expect.poll(async () => {
    const rows = await adminClient().from("messages").select("id").eq("conversation_id", run.conversationId).eq("role", "assistant").eq("status", "complete");
    expect(rows.error).toBeNull();
    return rows.data?.length;
  }, { timeout: 120_000 }).toBe(1);
  const evaluated = page.waitForResponse(response => new URL(response.url()).pathname === "/api/ai/evaluate", { timeout: 90_000 });
  const completed = page.waitForResponse(response => new URL(response.url()).pathname === `/api/mission-runs/${run.id}/complete`, { timeout: 90_000 });
  // Attach handler immediately so failed evaluation cannot leave an unhandled timeout.
  const completion = completed.catch(() => null);
  await page.getByRole("button", { name: "미션 마치고 평가받기", exact: true }).click();
  const evaluationResponse = await evaluated;
  expect(evaluationResponse.ok(), `Actual evaluator status ${evaluationResponse.status()}`).toBe(true);
  const evaluation = await evaluationResponse.json();
  expect(evaluation.evaluation.passed).toBe(true);
  expect(evaluation.evaluation.axes.map((axis: { key: string }) => axis.key).sort()).toEqual(["taskCompletion", "comprehensibility", "grammar", "vocabulary", "interaction"].sort());
  expect(evaluation.evaluation.newExpressions.length).toBeGreaterThan(0);
  expect(evaluation.evaluation.newExpressions.length).toBeLessThanOrEqual(3);
  expect(evaluation.evaluation.corrections.length).toBeGreaterThan(0);
  const result = await completion;
  expect(result, "Passed evaluation must trigger completion").not.toBeNull();
  expect(result!.ok()).toBe(true);
  const snapshot = (await result!.json()).result;
  expect(snapshot.experiencePointsAwarded).toBeGreaterThan(0);
  const storedEvaluation = await adminClient().from("mission_evaluations").select("feedback,corrections").eq("id", evaluation.evaluation.id).single();
  expect(storedEvaluation.error).toBeNull();
  expect(storedEvaluation.data!.feedback.newExpressions).toEqual(evaluation.evaluation.newExpressions);
  expect(storedEvaluation.data!.corrections).toEqual(evaluation.evaluation.corrections);
  async function assertResultDetails() {
    const panel = page.getByTestId("mission-result-panel");
    const goals = panel.getByTestId("mission-result-goals");
    for (const step of evaluation.run.steps) {
      const displayed = goals.locator(`[data-step-id="${step.id}"]`);
      await expect(displayed).toContainText(step.label);
      await expect(displayed).toHaveAttribute("data-completed", String(evaluation.evaluation.completedStepIds.includes(step.id)));
    }
    for (const strength of evaluation.evaluation.strengths) await expect(panel.getByText(`• ${strength}`, { exact: true })).toBeVisible();
    const corrections = panel.getByTestId("mission-result-corrections");
    for (const correction of evaluation.evaluation.corrections) {
      await expect(corrections.getByText(correction.original, { exact: true })).toBeVisible();
      await expect(corrections.getByText(correction.suggested, { exact: true })).toBeVisible();
      await expect(corrections.getByText(correction.explanation, { exact: true })).toBeVisible();
    }
    const expressions = panel.getByTestId("mission-result-expressions");
    await expect(expressions.getByRole("listitem")).toHaveCount(evaluation.evaluation.newExpressions.length);
    for (const expression of evaluation.evaluation.newExpressions) {
      expect(expression.english).toMatch(/[A-Za-z]/); expect(expression.meaning).toMatch(/[가-힣]/);
      await expect(expressions.getByText(expression.english, { exact: true })).toHaveAttribute("lang", "en");
      await expect(expressions.getByText(expression.meaning, { exact: true })).toHaveAttribute("lang", "ko");
    }
    await expect(panel.getByTestId("next-mission-link")).toHaveAttribute("href", `/missions/${recommended.id}`);
    await expect(panel.getByTestId("next-mission-link")).toHaveText(recommended.title);
  }
  await assertResultDetails();
  const replay = await page.request.post(`/api/mission-runs/${run.id}/complete`, { headers, data: { evaluationId: evaluation.evaluation.id, rewardId: evaluation.rewardId } });
  expect(replay.ok()).toBe(true);
  expect((await replay.json()).result.alreadyCompleted).toBe(true);
  const rewards = await adminClient().from("reward_unlocks").select("id,user_id,mission_evaluation_id").eq("mission_run_id", run.id);
  expect(rewards.error).toBeNull();
  expect(rewards.data).toEqual([expect.objectContaining({ user_id: account!.id, mission_evaluation_id: evaluation.evaluation.id })]);
  const note = `Remember the greeting ${randomUUID()}`;
  await page.getByLabel("다음 시도에서 기억하고 싶은 표현이나 목표를 적어 두세요.").fill(note);
  await page.getByRole("button", { name: "메모 저장", exact: true }).click();
  await expect(page.getByText("복습 메모를 저장했어요.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("다음 시도에서 기억하고 싶은 표현이나 목표를 적어 두세요.")).toHaveValue(note);
  await assertResultDetails();
  const resultUrl = page.url();
  await page.getByTestId("next-mission-link").click();
  await expect(page).toHaveURL(new RegExp(`/missions/${recommended.id}$`));
  await expect(page.getByRole("heading", { name: recommended.title, exact: true })).toBeVisible();
  const nextStarted = page.waitForResponse(response => new URL(response.url()).pathname === "/api/mission-runs" && response.request().method() === "POST");
  await page.getByTestId("start-mission").click();
  const startedRecommendation = await nextStarted;
  expect(startedRecommendation.ok(), await startedRecommendation.text()).toBe(true);
  expect((await startedRecommendation.json()).run.missionId).toBe(recommended.id);
  await expect(page.getByRole("textbox", { name: "영어 메시지", exact: true })).toBeEnabled();
  await page.goto(resultUrl);
  await assertResultDetails();
  const restored = await page.request.get(`/api/mission-runs/${run.id}`);
  expect(restored.ok()).toBe(true);
  expect((await restored.json()).run.completion).toMatchObject({
    missionRunId: run.id, missionEvaluationId: evaluation.evaluation.id,
    rewardUnlockId: snapshot.rewardUnlockId, experiencePointsAwarded: snapshot.experiencePointsAwarded,
    alreadyCompleted: true,
  });
  const retake = page.waitForResponse(response => new URL(response.url()).pathname === "/api/mission-runs" && response.request().method() === "POST");
  await page.getByRole("button", { name: "새 시도로 다시 도전", exact: true }).click();
  expect((await retake).ok()).toBe(true);
  const next = (await (await retake).json()).run;
  expect(next.id).not.toBe(run.id);
  expect(next.attemptNumber).toBe(2);
  expect(next.best.score).toBe(evaluation.evaluation.totalScore);
});
