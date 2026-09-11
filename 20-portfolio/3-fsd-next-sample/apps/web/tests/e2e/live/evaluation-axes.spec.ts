import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { adminClient, expect, test } from "./fixtures";

type Axis = { key: string; label: string; score: number; feedback: string; evidence: Array<{ messageId: string; quote: string; rationale: string }> };
const axisLabels = { taskCompletion: "과업 달성", comprehensibility: "이해 가능성", grammar: "문법", vocabulary: "어휘·표현", interaction: "상호작용" };
const headers = { Origin: "http://dodonet.iptime.org:13000" };
const manualPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHmsAAAAASUVORK5CYII=";
async function transcript(conversationId: string) {
  const result = await adminClient().from("messages").select("id,role,author_id,status,plain_text").eq("conversation_id", conversationId).order("sequence_number");
  expect(result.error).toBeNull(); return result.data!;
}
async function send(page: Page, conversationId: string, text: string, count: number) {
  await page.getByTestId("chat-input").fill(text);
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  await expect.poll(async () => (await transcript(conversationId)).filter(row => row.role === "assistant" && row.status === "complete").length, { timeout: 90_000 }).toBe(count);
}
async function visibleAxes(page: Page, axes: Axis[]) {
  for (const axis of axes) {
    const panel = page.getByTestId(`evaluation-axis-${axis.key}`);
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(axis.label);
    await expect(panel.locator("span").first()).toHaveText(String(axis.score));
    await expect(panel.getByTestId("evaluation-axis-feedback")).toHaveText(axis.feedback);
    await expect(panel.locator("blockquote")).toHaveCount(axis.evidence.length);
    for (const [index, evidence] of axis.evidence.entries()) {
      await expect(panel.locator("blockquote").nth(index)).toContainText(evidence.quote);
      await expect(panel.locator("blockquote footer").nth(index)).toHaveText(evidence.rationale);
    }
  }
}
// LEARN-05 partial: explicit whole-mission evaluation with per-axis learner-turn
// provenance. This does not claim automatic or independently selected-turn scoring.
test("LEARN-05 five manual evaluation axes distinguish clear meaning from grammar and restore owned evidence and feedback", async ({ page, account }) => {
  test.setTimeout(240_000);
  // A bounded owned fixture makes task and interaction evidence independent of
  // whichever public mission happens to appear first in the remote catalog.
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
  await send(page, run.conversationId, "Hello, my name is Alex. I wants a cup of tea.", 1);
  await send(page, run.conversationId, "Thank you. How much does a cup of tea cost, please?", 2);
  const before = await transcript(run.conversationId);
  expect(before).toHaveLength(4);
  const learnerRows = before.filter(row => row.role === "user" && row.author_id === account!.id);
  expect(learnerRows).toHaveLength(2);
  const evaluating = page.waitForResponse(response => new URL(response.url()).pathname === "/api/ai/evaluate", { timeout: 90_000 });
  await page.getByRole("button", { name: "미션 마치고 평가받기", exact: true }).click();
  const evaluated = await evaluating;
  expect(evaluated.ok()).toBe(true);
  const { evaluation } = await evaluated.json() as { evaluation: { id: string; totalScore: number; axes: Axis[] } };
  await test.info().attach("actual-five-axis-evaluation", { body: JSON.stringify({ learnerRows, evaluation }, null, 2), contentType: "application/json" });
  expect(evaluation.axes.map(axis => axis.key).sort()).toEqual(Object.keys(axisLabels).sort());
  for (const axis of evaluation.axes) {
    expect(axis.label).toBe(axisLabels[axis.key as keyof typeof axisLabels]);
    expect(Number.isInteger(axis.score)).toBe(true);
    expect(axis.score).toBeGreaterThanOrEqual(0); expect(axis.score).toBeLessThanOrEqual(100);
    expect(axis.feedback.trim().length).toBeGreaterThanOrEqual(10);
    expect(axis.feedback).toMatch(/[가-힣]/);
    expect(axis.evidence.length).toBeGreaterThan(0);
    for (const evidence of axis.evidence) {
      const source = learnerRows.find(row => row.id === evidence.messageId);
      expect(source, `Axis ${axis.key} must cite an actual owned learner row`).toBeDefined();
      // Server creates this quote from source.text.slice(0,500), never model prose.
      // Exact comparison avoids tolerating fabricated or paraphrased evidence.
      expect(evidence.quote).toBe(source!.plain_text.slice(0, 500));
      expect(evidence.rationale.trim().length).toBeGreaterThan(0);
    }
  }
  const byKey = Object.fromEntries(evaluation.axes.map(axis => [axis.key, axis]));
  // A clear request with subject/verb disagreement must not collapse grammar
  // into comprehensibility; the polite price question demonstrates interaction.
  expect(byKey.grammar.score).toBeLessThan(100);
  expect(byKey.comprehensibility.score).toBeGreaterThan(byKey.grammar.score);
  expect([byKey.grammar.feedback, ...byKey.grammar.evidence.map(item => item.rationale)].join(" ")).toMatch(/wants?|주어|동사|일치/i);
  expect(byKey.grammar.evidence.some(item => item.messageId === learnerRows[0].id)).toBe(true);
  expect(byKey.interaction.evidence.some(item => item.messageId === learnerRows[1].id)).toBe(true);
  expect(evaluation.totalScore).toBe(Math.round(byKey.taskCompletion.score * 0.4
    + byKey.comprehensibility.score * 0.15 + byKey.grammar.score * 0.15
    + byKey.vocabulary.score * 0.15 + byKey.interaction.score * 0.15));
  const stored = await adminClient().from("mission_evaluations").select("id,mission_run_id,total_score,rubric_scores").eq("id", evaluation.id).single();
  expect(stored.error).toBeNull();
  expect(stored.data).toEqual({ id: evaluation.id, mission_run_id: run.id, total_score: evaluation.totalScore, rubric_scores: { version: 2, weights: { taskCompletion: 0.4, comprehensibility: 0.15, grammar: 0.15, vocabulary: 0.15, interaction: 0.15 }, axes: evaluation.axes } });
  await visibleAxes(page, evaluation.axes);
  await page.reload();
  await expect(page.getByTestId("conversation-id")).toHaveText(run.conversationId);
  await visibleAxes(page, evaluation.axes);
  const restored = await page.request.get(`/api/mission-runs/${run.id}`);
  expect(restored.ok()).toBe(true);
  expect((await restored.json()).run.evaluation).toMatchObject({ id: evaluation.id, totalScore: evaluation.totalScore, axes: evaluation.axes });
  expect(await transcript(run.conversationId)).toEqual(before);
  const reloaded = await adminClient().from("mission_evaluations").select("id,mission_run_id,total_score,rubric_scores").eq("id", evaluation.id).single();
  expect(reloaded.error).toBeNull(); expect(reloaded.data).toEqual(stored.data);
});
