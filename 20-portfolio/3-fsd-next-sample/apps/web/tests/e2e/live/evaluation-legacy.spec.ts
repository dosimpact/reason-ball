import { randomUUID } from "node:crypto";
import { adminClient, expect, test } from "./fixtures";

const historicalAxes = [
  { key: "taskCompletion", label: "과업 완수", score: 81, evidence: [] },
  { key: "appropriateness", label: "상황 적절성", score: 72, evidence: [] },
  { key: "grammar", label: "문법·명료성", score: 64, evidence: [] },
  { key: "vocabulary", label: "어휘 활용", score: 55, evidence: [] },
];
// Historical fixture insertion tests hydration, not a new provider evaluation.
// Only the fixture account's own run is modified and cleanup cascades its rows.
for (const shape of ["axes-array", "numeric-rubric"] as const) {
  test(`LEARN-05 historical ${shape} keeps four original labels and stored total after five-axis upgrade`, async ({ page, account }) => {
    test.setTimeout(120_000);
    const catalog = await page.request.get("/api/missions");
    expect(catalog.ok()).toBe(true);
    const { items } = await catalog.json() as { items: Array<{ id: string; prerequisites: string[]; recommendedCharacterId: string }> };
    const mission = items.find(item => !item.prerequisites.length && item.recommendedCharacterId);
    expect(mission).toBeDefined();
    await page.goto(`/missions/${mission!.id}`);
    const starting = page.waitForResponse(response => new URL(response.url()).pathname === "/api/mission-runs" && response.request().method() === "POST");
    await page.getByTestId("start-mission").click();
    const started = await starting;
    expect(started.ok(), await started.text()).toBe(true);
    const { run } = await started.json() as { run: { id: string; conversationId: string } };
    await expect(page.getByTestId("conversation-id")).toHaveText(run.conversationId);
    const owned = await adminClient().from("mission_runs").select("owner_id").eq("id", run.id).single();
    expect(owned.error).toBeNull(); expect(owned.data?.owner_id).toBe(account!.id);
    const total = shape === "axes-array" ? 67 : 59;
    const rubric = shape === "axes-array" ? { axes: historicalAxes }
      : Object.fromEntries(historicalAxes.map(axis => [axis.key, axis.score]));
    const fixture = {
      id: randomUUID(), mission_run_id: run.id, status: "completed", evaluator_model_id: "historical-fixture-before-five-axis",
      total_score: total, passed: false, rubric_scores: rubric,
      feedback: { summary: `과거 ${shape} 평가 기록`, strengths: ["인사를 시도했어요."], improvements: ["다음에는 질문도 연습해 보세요."] },
      corrections: [], completed_learning_goals: [], vocabulary_observed: [], completed_at: new Date().toISOString(),
    };
    const inserted = await adminClient().from("mission_evaluations").insert(fixture).select("*").single();
    expect(inserted.error).toBeNull();
    const updated = await adminClient().from("mission_runs").update({ status: "failed", score: total, stars: 0 })
      .eq("id", run.id).eq("owner_id", account!.id);
    expect(updated.error).toBeNull();
    let aiRequests = 0;
    page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/ai/") && request.method() === "POST") aiRequests += 1; });
    for (let reload = 0; reload < 2; reload += 1) {
      await page.reload();
      await expect(page.getByTestId("conversation-id")).toHaveText(run.conversationId);
      const panel = page.getByTestId("mission-result-panel");
      await expect(panel).toBeVisible();
      await expect(panel.locator("header").getByText(String(total), { exact: true })).toBeVisible();
      await expect(panel).toContainText(fixture.feedback.summary);
      await expect(panel.locator('[data-testid^="evaluation-axis-"]')).toHaveCount(4);
      for (const axis of historicalAxes) {
        const axisPanel = panel.getByTestId(`evaluation-axis-${axis.key}`);
        await expect(axisPanel).toContainText(axis.label);
        await expect(axisPanel.locator("span").first()).toHaveText(String(axis.score));
        await expect(axisPanel.getByTestId("evaluation-axis-feedback")).toHaveCount(0);
        await expect(axisPanel.locator("blockquote")).toHaveCount(0);
      }
      await expect(panel.getByTestId("evaluation-axis-comprehensibility")).toHaveCount(0);
      await expect(panel.getByTestId("evaluation-axis-interaction")).toHaveCount(0);
      const response = await page.request.get(`/api/mission-runs/${run.id}`);
      expect(response.ok(), await response.text()).toBe(true);
      const restored = (await response.json()).run;
      expect(restored.score).toBe(total);
      expect(restored.evaluation).toMatchObject({ id: fixture.id, totalScore: total, passed: false });
      expect(restored.evaluation.axes).toEqual(historicalAxes);
      // Neither synthesize feedback nor recompute a historical stored total.
      expect(restored.evaluation.totalScore).not.toBe(Math.round(81 * 0.4 + (72 + 64 + 55) * 0.2));
      const stored = await adminClient().from("mission_evaluations").select("*").eq("id", fixture.id).single();
      expect(stored.error).toBeNull(); expect(stored.data).toEqual(inserted.data);
      expect(aiRequests).toBe(0);
    }
  });
}
