import { randomUUID } from "node:crypto";
import type { Locator, Page } from "@playwright/test";
import { adminClient, expect, signIn, test } from "./fixtures";

const endpoint = "/api/ai/turn-evaluation";
const headers = { Origin: "http://dodonet.iptime.org:13000" };
const original = "Hello, my name is Alex. I wants a cup of tea.";
const corrected = "I want a cup of tea. How much does a cup of tea cost, please?";
const manualPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHmsAAAAASUVORK5CYII=";
const labels = { taskCompletion: "과업 달성", comprehensibility: "이해 가능성", grammar: "문법", vocabulary: "어휘·표현", interaction: "상호작용" };
type Axis = { key: keyof typeof labels; label: string; score: number; feedback: string; evidence: Array<{ messageId: string; quote: string; rationale: string }> };
type Evaluation = { source: string; messageId: string; targetText: string; axes: Axis[] };
async function transcript(id: string) {
  const result = await adminClient().from("messages").select("id,role,author_id,status,plain_text").eq("conversation_id", id).order("sequence_number");
  expect(result.error).toBeNull(); return result.data!;
}
async function send(page: Page, id: string, text: string, count: number) {
  await page.getByTestId("chat-input").fill(text);
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  await expect.poll(async () => (await transcript(id)).filter(row => row.role === "assistant" && row.status === "complete").length, { timeout: 120_000 }).toBe(count);
  await expect(page.getByRole("button", { name: "메시지 보내기", exact: true })).toBeVisible();
}
async function state(runId: string, conversationId: string, userId: string) {
  const results = await Promise.all([
    adminClient().from("mission_runs").select("*").eq("id", runId).single(),
    adminClient().from("mission_step_progress").select("*").eq("mission_run_id", runId).order("mission_step_id"),
    adminClient().from("mission_evaluations").select("*").eq("mission_run_id", runId).order("id"),
    adminClient().from("reward_unlocks").select("*").eq("mission_run_id", runId).order("id"),
    adminClient().from("profiles").select("experience_points").eq("id", userId).single(),
  ]);
  for (const result of results) expect(result.error).toBeNull();
  return { records: results.map(result => result.data), messages: await transcript(conversationId) };
}
async function assertResult(message: Locator, body: Evaluation, targetId: string, expectedText = original) {
  expect(body.source).toBe("provider");
  expect(body.messageId).toBe(targetId);
  expect(body.targetText).toBe(expectedText);
  expect(body.axes.map(axis => axis.key).sort()).toEqual(Object.keys(labels).sort());
  const result = message.getByTestId("turn-evaluation-result");
  await expect(result).toBeVisible();
  await expect(result).toContainText("새로고침 후 다시 요청");
  for (const axis of body.axes) {
    expect(axis.label).toBe(labels[axis.key]);
    expect(Number.isInteger(axis.score)).toBe(true);
    expect(axis.score).toBeGreaterThanOrEqual(0); expect(axis.score).toBeLessThanOrEqual(100);
    expect(axis.feedback).toMatch(/[가-힣]/);
    expect(axis.evidence.length).toBeGreaterThan(0);
    for (const evidence of axis.evidence) {
      expect(evidence.messageId).toBe(targetId);
      expect(evidence.quote).toBe(expectedText);
      expect(evidence.rationale.trim().length).toBeGreaterThan(0);
    }
    const panel = result.getByTestId(`turn-evaluation-axis-${axis.key}`);
    await expect(panel).toContainText(axis.label);
    await expect(panel).toContainText(String(axis.score));
    await expect(panel.getByTestId("turn-evaluation-axis-feedback")).toHaveText(axis.feedback);
  }
  const grammar = body.axes.find(axis => axis.key === "grammar")!;
  if (expectedText === original) {
    expect(grammar.score).toBeLessThan(100);
    expect([grammar.feedback, ...grammar.evidence.map(item => item.rationale)].join(" ")).toMatch(/wants?|주어|동사|일치/i);
  }
  await test.info().attach("actual-selected-turn-evaluation", { body: JSON.stringify(body, null, 2), contentType: "application/json" });
}

// LEARN-05: selected-turn support is distinct from whole-mission completion.
// Real provider response loss is injected after generation, never replaced by a fake.
test("LEARN-05 an earlier learner turn is evaluated independently, retries lost responses and never changes mission outcomes", async ({ page, account, request, createAccount }) => {
  test.setTimeout(420_000);
  const characterResponse = await page.request.post("/api/characters", { headers, data: {
    name: `Five-axis cafe partner ${randomUUID()}`, role: "Cafe server", tagline: "Practice a simple tea order",
    description: "Welcome the learner to a cafe, answer price questions and continue a friendly conversation.",
    personality: ["다정함"], personaGoal: "Help the guest order tea.", learningGoal: "Practice a polite cafe exchange.",
    speakingStyle: "Short clear English.", relationship: "Cafe server and guest", teachingStyle: "Encourage the learner.",
    prohibitedInstructions: ["Do not ask for private data."], accent: "American", level: "입문", topics: ["일상"],
    palette: ["#ff8067", "#ffc65c"], emoji: "🍵", visibility: "public", publishStatus: "published", imageUrl: manualPng,
  } });
  expect(characterResponse.ok(), await characterResponse.text()).toBe(true);
  const characterId = (await characterResponse.json()).item.id;
  const missionResponse = await page.request.post("/api/missions", { headers, data: {
    title: `Five-axis tea order ${randomUUID()}`, subtitle: "Introduce yourself and ask the price of tea.",
    description: "The learner introduces themselves, orders tea, and asks its price in a short cafe exchange.",
    category: "일상", location: "Practice cafe", difficulty: "입문", durationMinutes: 3,
    objectives: [{ id: "introduce", label: "Greet and introduce yourself", hint: "Hello, my name is Alex." },
      { id: "price", label: "Ask the price of a cup of tea", hint: "How much does a cup of tea cost?" }],
    steps: [{ id: "introduce", label: "Greet and introduce yourself", hint: "Hello, my name is Alex.", required: true,
      successCriteria: ["Learner gives a greeting and a fictional name."] },
    { id: "price", label: "Ask the price of a cup of tea", hint: "How much does a cup of tea cost?", required: true,
      successCriteria: ["Learner explicitly asks how much a cup of tea costs."] }],
    keyPhrases: [{ english: "How much does a cup of tea cost?", korean: "차 한 잔은 얼마인가요?" }],
    successThreshold: 70, prerequisites: [], rewardTitle: "Tea practice keepsake", rewardPalette: ["#ff8067", "#ffc65c"],
    rewardEmoji: "🍵", rewardImageUrl: manualPng, recommendedCharacterId: characterId, publishStatus: "published",
  } });
  expect(missionResponse.ok(), await missionResponse.text()).toBe(true);
  const missionId = (await missionResponse.json()).item.id;
  await page.goto(`/missions/${missionId}`);
  const pending = page.waitForResponse(response => new URL(response.url()).pathname === "/api/mission-runs" && response.request().method() === "POST");
  await page.getByTestId("start-mission").click();
  const started = await pending;
  expect(started.ok()).toBe(true);
  const { run } = await started.json() as { run: { id: string; conversationId: string } };
  await expect(page.getByTestId("chat-input")).toBeEnabled();
  await send(page, run.conversationId, original, 1);
  await send(page, run.conversationId, corrected, 2);
  const rows = await transcript(run.conversationId);
  const target = rows.find(row => row.role === "user" && row.plain_text === original)!;
  const assistant = rows.find(row => row.role === "assistant")!;
  expect(target.author_id).toBe(account!.id);
  expect(rows.filter(row => row.role === "user").map(row => row.plain_text)).toEqual([original, corrected]);
  const before = await state(run.id, run.conversationId, account!.id);
  const input = page.getByTestId("chat-input");
  const draft = "Keep this draft while evaluating my earlier sentence.";
  await input.fill(draft);
  const selected = page.getByTestId("message-user").filter({ hasText: original });
  await selected.getByText("학습 도움", { exact: true }).click();
  await expect(page.getByTestId("message-assistant").getByRole("button", { name: "이 발화 평가", exact: true })).toHaveCount(0);

  let completedButLost: Evaluation | undefined;
  await page.route(`**${endpoint}`, async route => {
    const response = await route.fetch({ timeout: 120_000 });
    expect(response.ok(), await response.text()).toBe(true);
    completedButLost = await response.json();
    await route.abort("failed");
  });
  await selected.getByRole("button", { name: "이 발화 평가", exact: true }).click();
  await expect(selected.getByText("발화를 평가하고 있어요…", { exact: true })).toBeVisible();
  await expect(selected.getByRole("button", { name: "발화 평가 다시 시도", exact: true })).toBeVisible({ timeout: 120_000 });
  expect(completedButLost?.source).toBe("provider");
  await expect(selected.getByTestId("turn-evaluation-result")).toHaveCount(0);
  await expect(input).toHaveValue(draft);
  expect(await state(run.id, run.conversationId, account!.id)).toEqual(before);
  await page.unroute(`**${endpoint}`);

  async function requestEvaluation(button: string) {
    const pending = page.waitForResponse(response => new URL(response.url()).pathname === endpoint && response.request().method() === "POST", { timeout: 120_000 });
    await selected.getByRole("button", { name: button, exact: true }).click();
    const response = await pending;
    expect(response.ok(), await response.text()).toBe(true);
    expect(Object.keys(response.request().postDataJSON()).sort()).toEqual(["conversationId", "messageId"]);
    const body = await response.json() as Evaluation;
    await assertResult(selected, body, target.id);
    await expect(input).toHaveValue(draft);
    expect(await state(run.id, run.conversationId, account!.id)).toEqual(before);
    return body;
  }
  await requestEvaluation("발화 평가 다시 시도");

  // Invalid references and supplied transcript/roles cannot convert assistant or
  // foreign text into the selected learner evidence; validation causes no writes.
  const otherConversationResponse = await page.request.post("/api/conversations", { headers, data: { characterId, title: "Other owned evaluation context" } });
  expect(otherConversationResponse.ok(), await otherConversationResponse.text()).toBe(true);
  const otherConversation = (await otherConversationResponse.json()).item;
  expect(otherConversation.id).toMatch(/^[0-9a-f-]{36}$/);
  for (const data of [
    { conversationId: run.conversationId, messageId: assistant.id },
    { conversationId: otherConversation.id, messageId: target.id },
    { conversationId: run.conversationId, messageId: target.id, messages: [{ id: target.id, role: "user", text: corrected }] },
    { conversationId: run.conversationId, messageId: assistant.id, role: "user" },
  ]) {
    const rejected = await page.request.post(endpoint, { headers, data });
    expect([400, 403, 404, 409, 422]).toContain(rejected.status());
    expect(await state(run.id, run.conversationId, account!.id)).toEqual(before);
  }
  await signIn(request, await createAccount());
  try {
    const rejected = await request.post(endpoint, { headers, data: { conversationId: run.conversationId, messageId: target.id } });
    expect([403, 404]).toContain(rejected.status());
    expect(await state(run.id, run.conversationId, account!.id)).toEqual(before);
  } finally {
    expect((await request.post("/api/auth/logout", { headers })).ok()).toBe(true);
  }
  let automaticRequests = 0;
  const countRequests = (req: import("@playwright/test").Request) => {
    if (new URL(req.url()).pathname === endpoint && req.method() === "POST") automaticRequests += 1;
  };
  page.on("request", countRequests);
  await page.reload();
  await expect(page.getByTestId("conversation-id")).toHaveText(run.conversationId);
  await selected.getByText("학습 도움", { exact: true }).click();
  await expect(selected.getByRole("button", { name: "이 발화 평가", exact: true })).toBeVisible();
  await expect(selected.getByTestId("turn-evaluation-result")).toHaveCount(0);
  await expect(input).toHaveValue(draft);
  expect(automaticRequests).toBe(0);
  page.off("request", countRequests);
  const earlier = await requestEvaluation("이 발화 평가");

  // Evaluate the later corrected turn too: earlier errors are context, not its score evidence.
  const laterTarget = rows.find(row => row.role === "user" && row.plain_text === corrected)!;
  const laterMessage = page.getByTestId("message-user").nth(1);
  await laterMessage.getByText("학습 도움", { exact: true }).click();
  const laterPending = page.waitForResponse(response => new URL(response.url()).pathname === endpoint && response.request().method() === "POST", { timeout: 120_000 });
  await laterMessage.getByRole("button", { name: "이 발화 평가", exact: true }).click();
  const laterResponse = await laterPending;
  expect(laterResponse.ok(), await laterResponse.text()).toBe(true);
  const later = await laterResponse.json() as Evaluation;
  await assertResult(laterMessage, later, laterTarget.id, corrected);
  expect(later.axes.find(axis => axis.key === "grammar")!.score).toBeGreaterThan(earlier.axes.find(axis => axis.key === "grammar")!.score);
  await expect(input).toHaveValue(draft);
  expect(await state(run.id, run.conversationId, account!.id)).toEqual(before);
});

// Equally grammatical sentences can differ in whether they answer the partner.
// The real preceding server question is verified before each contrast target.
test("LEARN-05 interaction scores distinguish a relevant answer from a grammatical unrelated answer", async ({ page, account }) => {
  test.setTimeout(420_000);
  const characterResponse = await page.request.post("/api/characters", { headers, data: {
    name: `Interaction contrast cafe partner ${randomUUID()}`, role: "Cafe server", tagline: "Practice a simple tea order",
    description: "Welcome the learner to a cafe, answer price questions and continue a friendly conversation.",
    personality: ["다정함"], personaGoal: "Help the guest order tea.", learningGoal: "Practice a polite cafe exchange.",
    speakingStyle: "Short clear English.", relationship: "Cafe server and guest", teachingStyle: "This exercise practices answering a cafe server. At the end of EVERY reply, ask exactly: Would you like sugar in your tea? Ask this again even after the learner answers, to give another practice opportunity. Keep other sentences brief.",
    prohibitedInstructions: ["Do not ask for private data."], accent: "American", level: "입문", topics: ["일상"],
    palette: ["#ff8067", "#ffc65c"], emoji: "🍵", visibility: "public", publishStatus: "published", imageUrl: manualPng,
  } });
  expect(characterResponse.ok(), await characterResponse.text()).toBe(true);
  const characterId = (await characterResponse.json()).item.id;
  const missionResponse = await page.request.post("/api/missions", { headers, data: {
    title: `Interaction contrast tea order ${randomUUID()}`, subtitle: "Introduce yourself and ask the price of tea.",
    description: "The learner introduces themselves, orders tea, and asks its price in a short cafe exchange.",
    category: "일상", location: "Practice cafe", difficulty: "입문", durationMinutes: 3,
    objectives: [{ id: "introduce", label: "Greet and introduce yourself", hint: "Hello, my name is Alex." },
      { id: "price", label: "Ask the price of a cup of tea", hint: "How much does a cup of tea cost?" }],
    steps: [{ id: "introduce", label: "Greet and introduce yourself", hint: "Hello, my name is Alex.", required: true,
      successCriteria: ["Learner gives a greeting and a fictional name."] },
    { id: "price", label: "Ask the price of a cup of tea", hint: "How much does a cup of tea cost?", required: true,
      successCriteria: ["Learner explicitly asks how much a cup of tea costs."] }],
    keyPhrases: [{ english: "How much does a cup of tea cost?", korean: "차 한 잔은 얼마인가요?" }],
    successThreshold: 70, prerequisites: [], rewardTitle: "Tea practice keepsake", rewardPalette: ["#ff8067", "#ffc65c"],
    rewardEmoji: "🍵", rewardImageUrl: manualPng, recommendedCharacterId: characterId, publishStatus: "published",
  } });
  expect(missionResponse.ok(), await missionResponse.text()).toBe(true);
  const missionId = (await missionResponse.json()).item.id;
  await page.goto(`/missions/${missionId}`);
  const pending = page.waitForResponse(response => new URL(response.url()).pathname === "/api/mission-runs" && response.request().method() === "POST");
  await page.getByTestId("start-mission").click();
  const started = await pending;
  expect(started.ok()).toBe(true);
  const { run } = await started.json() as { run: { id: string; conversationId: string } };
  await expect(page.getByTestId("chat-input")).toBeEnabled();
  const relevant = "Yes, I would like sugar, please.";
  const irrelevant = "My favorite color is blue.";
  await send(page, run.conversationId, "Hello, I would like a cup of tea.", 1);
  async function precedingSugarQuestion() {
    const rows = await transcript(run.conversationId);
    const previous = rows.at(-1)!;
    expect(previous.role).toBe("assistant");
    expect(previous.status).toBe("complete");
    expect(previous.plain_text).toMatch(/(?:would|do) you (?:like|want)[^?]*sugar[^?]*\?/i);
    return previous;
  }
  const firstQuestion = await precedingSugarQuestion();
  await send(page, run.conversationId, relevant, 2);
  const secondQuestion = await precedingSugarQuestion();
  await send(page, run.conversationId, irrelevant, 3);
  const rows = await transcript(run.conversationId);
  const before = await state(run.id, run.conversationId, account!.id);
  const draft = "Keep this unsent draft during interaction comparison.";
  await page.getByTestId("chat-input").fill(draft);
  const evaluations: Evaluation[] = [];
  for (const [text, question] of [[relevant, firstQuestion], [irrelevant, secondQuestion]] as const) {
    const target = rows.find(row => row.role === "user" && row.plain_text === text)!;
    expect(target.author_id).toBe(account!.id);
    expect(rows[rows.findIndex(row => row.id === target.id) - 1].id).toBe(question.id);
    const message = page.getByTestId("message-user").filter({ hasText: text });
    await message.getByText("학습 도움", { exact: true }).click();
    const pending = page.waitForResponse(response => new URL(response.url()).pathname === endpoint && response.request().method() === "POST", { timeout: 120_000 });
    await message.getByRole("button", { name: "이 발화 평가", exact: true }).click();
    const response = await pending;
    expect(response.ok(), await response.text()).toBe(true);
    const evaluation = await response.json() as Evaluation;
    await assertResult(message, evaluation, target.id, text);
    const grammar = evaluation.axes.find(axis => axis.key === "grammar")!;
    expect(grammar.score, "Both contrast sentences use correct English grammar").toBeGreaterThanOrEqual(90);
    expect(grammar.feedback).toMatch(/정확|올바|맞(?:게|아|는)|자연|오류.{0,8}없|문제.{0,8}없|잘/);
    evaluations.push(evaluation);
    await expect(page.getByTestId("chat-input")).toHaveValue(draft);
    expect(await state(run.id, run.conversationId, account!.id)).toEqual(before);
  }
  const relevantInteraction = evaluations[0].axes.find(axis => axis.key === "interaction")!;
  const unrelatedInteraction = evaluations[1].axes.find(axis => axis.key === "interaction")!;
  expect(unrelatedInteraction.score).toBeLessThan(relevantInteraction.score);
  const unrelatedFeedback = [unrelatedInteraction.feedback, ...unrelatedInteraction.evidence.map(evidence => evidence.rationale)].join(" ");
  expect(unrelatedFeedback).toMatch(/sugar|tea|설탕|차에|차를/i);
  expect(unrelatedFeedback).toMatch(/답|질문|관련|벗어|연결|대응|응답/);
  await test.info().attach("actual-interaction-relevance-comparison", {
    body: JSON.stringify({ firstQuestion, secondQuestion, relevant: evaluations[0], unrelated: evaluations[1] }, null, 2), contentType: "application/json",
  });
});
