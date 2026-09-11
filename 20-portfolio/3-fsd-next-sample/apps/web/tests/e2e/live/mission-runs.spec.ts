import type { Page } from "@playwright/test";
import type { MissionHint } from "@/entities/mission-run/model/types";
import { adminClient, expect, signIn, test } from "./fixtures";

type Mission = {
  id: string;
  recommendedCharacterId: string;
  prerequisites: string[];
  steps: Array<{ id: string; hint?: string }>;
};
type Run = {
  id: string; conversationId: string; missionVersionId: string; characterVersionId: string;
  attemptNumber: number; steps: Array<{ id: string; status: string }>; currentStepOrder: number;
};

async function startMissionFromDetail(page: Page) {
  const response = await page.request.get("/api/missions");
  expect(response.ok()).toBe(true);
  const { items } = await response.json() as { items: Mission[] };
  const mission = items.find((item) => item.recommendedCharacterId && !item.prerequisites.length && item.steps.filter((step) => step.hint).length >= 2);
  expect(mission, "A published mission with authored step hints and no prerequisite is required").toBeDefined();
  await page.goto(`/missions/${mission!.id}`);
  const started = page.waitForResponse((item) => item.request().method() === "POST" && new URL(item.url()).pathname === "/api/mission-runs");
  await page.getByTestId("start-mission").click();
  const result = await started;
  expect(result.ok()).toBe(true);
  const { run } = await result.json() as { run: Run };
  await expect(page.getByTestId("chat-input")).toBeEnabled();
  await expect(page.getByTestId("conversation-id")).toHaveText(run.conversationId);
  return { mission: mission!, run };
}

// LEARN-01; MISSION-10 attempt identity only (evaluation/best-score covered separately).
test("mission start, reload resume, and explicit new attempt preserve separate real runs and ownership", async ({ page, request, account, createAccount }) => {
  const { mission, run } = await startMissionFromDetail(page);
  expect(run.attemptNumber).toBe(1);
  const before = await adminClient().from("mission_runs").select("id, owner_id, conversation_id, mission_version_id, character_version_id, attempt_number").eq("id", run.id).single();
  expect(before.error).toBeNull();
  expect(before.data).toMatchObject({ owner_id: account!.id, conversation_id: run.conversationId, attempt_number: 1 });
  await page.reload();
  await expect(page.getByTestId("conversation-id")).toHaveText(run.conversationId);
  const resumed = await page.request.post("/api/mission-runs", {
    headers: { Origin: "http://dodonet.iptime.org:13000" },
    data: { missionId: mission.id, characterId: mission.recommendedCharacterId, conversationId: run.conversationId },
  });
  expect(resumed.ok()).toBe(true);
  expect((await resumed.json()).run).toMatchObject({ id: run.id, conversationId: run.conversationId, attemptNumber: 1 });
  await page.goto(`/missions/${mission.id}`);
  const nextResponse = page.waitForResponse((item) => item.request().method() === "POST" && new URL(item.url()).pathname === "/api/mission-runs");
  await page.getByTestId("start-mission").click();
  expect((await nextResponse).ok()).toBe(true);
  const next = (await (await nextResponse).json()).run as Run;
  expect(next.id).not.toBe(run.id);
  expect(next.conversationId).not.toBe(run.conversationId);
  expect(next.attemptNumber).toBe(2);
  await expect(page.getByTestId("conversation-id")).toHaveText(next.conversationId);
  const unchanged = await adminClient().from("mission_runs").select("id, owner_id, conversation_id, mission_version_id, character_version_id, attempt_number").eq("id", run.id).single();
  expect(unchanged.error).toBeNull();
  expect(unchanged.data).toEqual(before.data);
  const other = await createAccount();
  await signIn(request, other);
  try {
    expect((await request.get(`/api/mission-runs/${run.id}`)).status()).toBe(404);
    const otherRuns = await request.get("/api/mission-runs");
    expect(otherRuns.ok()).toBe(true);
    expect((await otherRuns.json()).runs).toEqual([]);
    const stolen = await request.post("/api/mission-runs", {
      headers: { Origin: "http://dodonet.iptime.org:13000" },
      data: { missionId: mission.id, characterId: mission.recommendedCharacterId, conversationId: run.conversationId },
    });
    expect(stolen.status()).toBe(409);
  } finally {
    expect((await request.post("/api/auth/logout", { headers: { Origin: "http://dodonet.iptime.org:13000" } })).ok()).toBe(true);
  }
});

// LEARN-04: preview a different pinned step; help must not advance the run.
test("selected-step AI hints preserve a draft and real mission progress across reload", async ({ page }) => {
  test.setTimeout(150_000);
  const { mission, run } = await startMissionFromDetail(page);
  const initial = await page.request.get(`/api/mission-runs/${run.id}`);
  expect(initial.ok()).toBe(true);
  const initialRun = (await initial.json()).run;
  const writes: string[] = [];
  const endpoint = `/api/mission-runs/${run.id}/hints`;
  let hintPosts = 0;
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname === endpoint && request.method() === "POST") hintPosts += 1;
    if (["POST", "PATCH", "PUT"].includes(request.method()) &&
      (pathname.startsWith("/api/ai/") || /\/api\/mission-runs\/[^/]+\/(progress|complete)/.test(pathname))) writes.push(pathname);
  });
  await page.getByRole("button", { name: "단계별 힌트 열기" }).click();
  const option = mission.steps.find((step) => step.hint && step.id !== run.steps[0].id)!;
  await page.getByTestId("chat-input").fill("Keep this unsent draft");
  await page.getByLabel("연습할 단계").selectOption(option.id);
  expect(hintPosts).toBe(0);
  const hints: MissionHint[] = [];
  for (const [depth, label] of [[1, "1. 의도 힌트"], [2, "2. 핵심 표현"]] as const) {
    const generated = page.waitForResponse(response => new URL(response.url()).pathname === endpoint && response.request().method() === "POST");
    await page.getByRole("button", { name: label, exact: true }).click();
    const response = await generated;
    expect(response.ok(), await response.text()).toBe(true);
    const hint: MissionHint = (await response.json()).hint;
    expect(hint).toMatchObject({ runId: run.id, stepId: option.id, depth });
    expect(hint.contextMessageId).toBeUndefined();
    hints.push(hint);
    await expect(page.getByTestId("mission-hint-text")).toHaveText(hint.result.text);
    await expect(page.getByTestId("chat-input")).toHaveValue("Keep this unsent draft");
  }
  const pattern = hints[1].result.text;
  await page.getByRole("button", { name: "이 힌트를 입력창에 덧붙이기", exact: true }).click();
  await expect(page.getByTestId("chat-input")).toHaveValue(`Keep this unsent draft\n${pattern}`);
  await expect(page.getByTestId("message-user")).toHaveCount(0);
  const afterPreview = await page.request.get(`/api/mission-runs/${run.id}`);
  expect((await afterPreview.json()).run).toEqual(initialRun);
  expect(writes).toEqual([]);
  const messages = await adminClient().from("messages").select("id").eq("conversation_id", run.conversationId);
  expect(messages.error).toBeNull();
  expect(messages.data).toEqual([]);
  const rows = await adminClient().from("mission_hint_requests").select("id,mission_step_id,depth,result").eq("mission_run_id", run.id).order("depth");
  expect(rows.error).toBeNull();
  expect(rows.data).toEqual(hints.map(hint => ({ id: hint.id, mission_step_id: option.id, depth: hint.depth, result: hint.result })));
  await page.reload();
  await expect(page.getByTestId("conversation-id")).toHaveText(run.conversationId);
  await expect(page.getByTestId("chat-input")).toHaveValue(`Keep this unsent draft\n${pattern}`);
  await page.getByRole("button", { name: "단계별 힌트 열기" }).click();
  await page.getByLabel("연습할 단계").selectOption(option.id);
  await expect(page.getByTestId("mission-hint-text")).toHaveText(pattern);
  expect(hintPosts).toBe(2);
  expect((await (await page.request.get(`/api/mission-runs/${run.id}`)).json()).run).toEqual(initialRun);
  expect(writes).toEqual([]);
});
