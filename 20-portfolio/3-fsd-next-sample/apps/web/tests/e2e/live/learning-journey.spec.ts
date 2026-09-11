import { randomUUID } from "node:crypto";
import { adminClient, expect, test } from "./fixtures";

const missionId = "22222222-2222-4222-8222-222222222221";

test("learner saves private preferences to Supabase and restores them after reload", async ({ page }) => {
  await page.goto("/profile");
  await page.getByRole("tab", { name: "설정", exact: true }).click();
  await expect(page.getByText("현재 계정에 비공개로 저장합니다.", { exact: false })).toBeVisible();
  const goal = `Supabase browser check ${randomUUID()}`;
  await page.getByLabel("학습 목표", { exact: true }).fill(goal);
  await page.getByLabel("학습자 레벨").selectOption("B1");
  await page.getByRole("button", { name: "설정 저장", exact: true }).click();
  await expect(page.getByText("학습 설정을 저장했어요.")).toBeVisible();
  const { user } = await (await page.request.get("/api/auth/session")).json();
  expect(user.isAnonymous).toBe(false);
  const saved = await adminClient().from("learner_preferences").select("settings").eq("user_id", user.id).single();
  expect(saved.error).toBeNull();
  expect(saved.data?.settings).toMatchObject({ learningGoal: goal, learnerLevel: "B1" });
  await page.reload();
  await page.getByRole("tab", { name: "설정", exact: true }).click();
  await expect(page.getByLabel("학습 목표", { exact: true })).toHaveValue(goal);
  await expect(page.getByLabel("학습자 레벨")).toHaveValue("B1");
});

test("learner saves and removes a real mission across reloads", async ({ page }) => {
  await page.goto(`/missions/${missionId}`);
  await expect(page.getByRole("heading", { name: "Check in at a Hotel", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "미션 저장", exact: true }).click();
  await expect(page.getByRole("button", { name: "미션 저장 해제", exact: true })).toHaveAttribute("aria-pressed", "true");
  const { user } = await (await page.request.get("/api/auth/session")).json();
  const stored = await adminClient().from("mission_favorites").select("mission_id").eq("user_id", user.id);
  expect(stored.error).toBeNull();
  expect(stored.data).toContainEqual({ mission_id: missionId });
  await page.reload();
  await page.getByRole("button", { name: "미션 저장 해제", exact: true }).click();
  await expect(page.getByRole("button", { name: "미션 저장", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(page.getByRole("button", { name: "미션 저장", exact: true })).toHaveAttribute("aria-pressed", "false");
});

test("mission chat persists the user and assistant turns and restores the same conversation", async ({ page }) => {
  await page.goto(`/missions/${missionId}`);
  await page.getByRole("link", { name: "미션 시작하기", exact: true }).click();
  const composer = page.getByRole("textbox", { name: "영어 메시지" });
  await expect(composer).toBeEnabled();
  const conversationId = (await page.getByTestId("conversation-id").innerText()).trim();
  expect(conversationId).toMatch(/^[0-9a-f-]{36}$/);
  await composer.fill("Hello, I would like to check in, please.");
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  await expect(page.getByTestId("message-assistant").last()).not.toBeEmpty();
  // Verify persisted user and assistant rows independently of model wording.
  await expect.poll(async () => {
    const rows = await adminClient().from("messages").select("role, status, plain_text").eq("conversation_id", conversationId);
    expect(rows.error).toBeNull();
    return rows.data?.filter((row) => row.status === "complete" && row.plain_text.trim() && ["user", "assistant"].includes(row.role)).length;
  }, { timeout: 120_000 }).toBe(2);
  const saved = await adminClient().from("messages").select("plain_text").eq("conversation_id", conversationId).eq("role", "assistant").single();
  expect(saved.error).toBeNull();
  await expect(page.getByTestId("message-assistant").last()).toContainText(saved.data!.plain_text);
  await page.reload();
  await expect(page.getByTestId("conversation-id")).toHaveText(conversationId);
  await expect(page.getByTestId("message-user")).toContainText("Hello, I would like to check in, please.");
  await expect(page.getByTestId("message-assistant").last()).toContainText(saved.data!.plain_text);
});
