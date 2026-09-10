import { expect, test } from "@playwright/test";
import { installCleanAppState } from "./test-setup";

test("new conversation exposes its composer only after canonical navigation", async ({ page }) => {
  await installCleanAppState(page);
  // Observe every rendered frame, including the short-lived pre-navigation UI.
  await page.addInitScript(() => {
    const state = window as typeof window & { __prematureComposer?: boolean };
    const observe = () => {
      if (new URL(location.href).searchParams.get("attempt") === "new" && document.querySelector('[data-testid="chat-input"]')) {
        state.__prematureComposer = true;
      }
    };
    new MutationObserver(observe).observe(document, { childList: true, subtree: true });
  });
  await page.goto("/chat/mia-hotelier?attempt=new");
  // Deliberately fill as soon as the composer is available, without a URL wait.
  await page.getByTestId("chat-input").fill("Keep my first input.");
  await expect(page).toHaveURL(/conversation=/);
  await expect(page.getByTestId("chat-input")).toHaveValue("Keep my first input.");
  expect(await page.evaluate(() => (window as typeof window & { __prematureComposer?: boolean }).__prematureComposer)).toBeUndefined();
  await page.reload();
  await expect(page.getByTestId("chat-input")).toHaveValue("Keep my first input.");
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  await expect(page.getByTestId("message-user")).toHaveCount(1);
  await expect(page.getByTestId("message-user").getByText("Keep my first input.", { exact: true })).toBeVisible();
  await expect(page.getByText("● 대화 가능", { exact: false })).toBeVisible();
});

test("restores a saved lesson from history without discovery and rejects a mismatched route", async ({ page }) => {
  await installCleanAppState(page);
  await page.goto("/missions/hotel-check-in");
  await page.getByTestId("start-mission").click();
  await expect(page).toHaveURL(/conversation=/);
  await expect(page.getByTestId("mission-evaluation-panel")).toBeVisible();
  const savedUrl = page.url();
  const id = new URL(savedUrl).searchParams.get("conversation")!;
  await page.getByTestId("chat-input").fill("Please preserve my hotel lesson.");
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  await expect(page.getByTestId("message-user")).toContainText("preserve my hotel lesson");
  await expect(page.getByText("● 대화 가능", { exact: false })).toBeVisible();
  const originalRuns = (await (await page.request.get("/api/mission-runs")).json()).runs;
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("lingua-character-lab")!);
    saved.state.characters = saved.state.characters.filter((item: { id: string }) => item.id !== "mia-hotelier");
    saved.state.missions = saved.state.missions.filter((item: { id: string }) => item.id !== "hotel-check-in");
    localStorage.setItem("lingua-character-lab", JSON.stringify(saved));
  });
  await page.goto("/history");
  await page.locator(`a[href*="conversation=${id}"]`).first().click();
  await expect(page.getByTestId("mission-evaluation-panel")).toBeVisible();
  await expect(page.getByTestId("message-user")).toContainText("preserve my hotel lesson");
  const withoutMission = new URL(savedUrl);
  withoutMission.searchParams.delete("mission");
  await page.goto(withoutMission.href);
  await expect(page.getByTestId("mission-evaluation-panel")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", id);
  await expect(page.getByTestId("message-user")).toContainText("preserve my hotel lesson");
  expect((await (await page.request.get("/api/mission-runs")).json()).runs).toEqual(originalRuns);
  await page.getByTestId("chat-input").fill("Can I continue my saved lesson?");
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  await expect(page.getByTestId("message-user")).toHaveCount(2);
  await expect(page.getByText("● 대화 가능", { exact: false })).toBeVisible();
  const resumedRuns = (await (await page.request.get("/api/mission-runs")).json()).runs;
  expect(resumedRuns.map((run: { id: string }) => run.id)).toEqual(originalRuns.map((run: { id: string }) => run.id));
  const mismatch = new URL(savedUrl);
  mismatch.searchParams.set("mission", "coffee-order");
  await page.goto(mismatch.href);
  await expect(page.getByRole("alert").filter({ hasText: "일치하지" })).toBeVisible();
  await expect(page.getByTestId("chat-input")).toHaveCount(0);
  expect((await (await page.request.get("/api/mission-runs")).json()).runs).toEqual(resumedRuns);
});

test("missing saved conversations and missing mission lookups do not create free chats", async ({ page }) => {
  await installCleanAppState(page);
  await page.goto("/chat/mia-hotelier?conversation=missing-saved-chat");
  await expect(page.getByRole("alert").filter({ hasText: "저장된 대화를 찾을 수 없어요" })).toBeVisible();
  await expect(page.getByTestId("chat-input")).toHaveCount(0);
  await page.goto("/chat/mia-hotelier?mission=missing-mission");
  await expect(page.getByRole("alert").filter({ hasText: "미션을 불러올 수 없어요" })).toBeVisible();
  await expect(page.getByTestId("chat-input")).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("lingua-chat-parity-v1") ?? '{"conversations":[]}').conversations)).toHaveLength(0);
});

test("legacy display metadata is disclosed without blocking the saved lesson", async ({ page }) => {
  await installCleanAppState(page);
  await page.goto("/missions/hotel-check-in");
  await page.getByTestId("start-mission").click();
  await expect(page).toHaveURL(/conversation=/);
  await expect(page.getByTestId("mission-evaluation-panel")).toBeVisible();
  const id = new URL(page.url()).searchParams.get("conversation")!;
  await page.evaluate((conversationId) => {
    const store = JSON.parse(localStorage.getItem("lingua-chat-parity-v1")!);
    const saved = store.conversations.find((item: { id: string }) => item.id === conversationId);
    saved.learningContext.character.metadataSource = "current-resource";
    saved.learningContext.mission.metadataSource = "current-resource";
    localStorage.setItem("lingua-chat-parity-v1", JSON.stringify(store));
  }, id);
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "이전 버전의 일부 표시 정보가 저장되지 않아" })).toBeVisible();
  await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", id);
  await expect(page.getByTestId("mission-evaluation-panel")).toBeVisible();
  await expect(page.getByTestId("chat-input")).toBeEnabled();
});
