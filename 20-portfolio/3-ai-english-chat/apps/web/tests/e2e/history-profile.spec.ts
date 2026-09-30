import { expect, test } from "@playwright/test";

import { installCleanAppState } from "./test-setup";

test.describe("History and profile", () => {
  test.beforeEach(async ({ page }) => {
    await installCleanAppState(page);
  });

  test("searches deterministic seeded conversation history", async ({ page }) => {
    await page.goto("/history");

    await expect(page.getByTestId("history-page")).toBeVisible();
    await expect(page.getByText("Mia와 호텔 체크인")).toBeVisible();
    await expect(page.getByText("Leo와 카페 주문")).toBeVisible();

    const search = page.getByRole("searchbox", { name: "대화 기록 검색" });
    await search.fill("oat milk");
    await expect(page.getByText("Leo와 카페 주문")).toBeVisible();
    await expect(page.getByText("Mia와 호텔 체크인")).toBeHidden();

    await search.fill("존재하지 않는 기록");
    await expect(page.getByText("검색한 대화 기록이 없어요.")).toBeVisible();

    await search.fill("oat milk");
    await page.getByRole("link", { name: "이어서 대화" }).click();
    await expect(page).toHaveURL(
      /\/chat\/leo-barista\?mission=coffee-order$/,
    );
    await expect(page.getByTestId("chat-workspace")).toBeVisible();
  });

  test("switches profile tabs and shows favorite and locked rewards", async ({
    page,
  }) => {
    await page.goto("/profile");

    await expect(page.getByTestId("profile-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "민지의 영어 여정" }),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "학습 요약" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByText("누적 1,280 XP")).toBeVisible();
    await expect(page.getByTestId("learning-progress")).toContainText("데모 학습 기록");
    await expect(page.getByRole("img", { name: "최근 7일 총 42분 학습 시간 그래프" })).toBeVisible();
    await expect(page.getByText("+18% 성장")).toHaveCount(0);

    await page.getByRole("tab", { name: "즐겨찾기" }).click();
    await expect(page.getByTestId("profile-favorites")).toBeVisible();
    await expect(page.getByTestId("character-card-mia-hotelier")).toBeVisible();
    await expect(page.getByTestId("character-card-leo-barista")).toBeHidden();

    await page.getByRole("tab", { name: "보상 컬렉션" }).click();
    await expect(page.getByTestId("reward-collection")).toBeVisible();
    const lockedReward = page.getByTestId("reward-hotel-check-in");
    await expect(lockedReward).toContainText("완료하면 열리는 장면");
    await expect(lockedReward).not.toContainText("해금됨");
    await expect(page.getByText("아직 잠긴 미션 보상").first()).toBeVisible();
  });

  test("keeps history visible when its character is no longer in discovery", async ({ page }) => {
    await page.goto("/history");
    // Wait for the initial query/effect lifecycle before publishing a storage
    // update; navigation completion alone does not imply client readiness.
    await expect(page.getByText("Mia와 호텔 체크인")).toBeVisible();
    await page.evaluate(() => {
      const updatedAt = "2026-09-05T12:00:00.000Z";
      localStorage.setItem("lingua-chat-parity-v1", JSON.stringify({
        activeByRoute: {}, deletedConversationIds: [], conversations: [{
          id: "archived-character-chat", characterId: "archived-character", characterName: "Archived tutor",
          createdAt: updatedAt, updatedAt, title: "보관한 캐릭터와의 학습", draft: "", artifacts: [], votes: {},
          routeKey: "archived-character:free", theme: "light", modelId: "gpt-5-mini",
          messages: [{ id: "old-turn", role: "user", parts: [{ type: "text", text: "I remember this lesson." }] }],
        }],
      }));
      window.dispatchEvent(new CustomEvent("lingua-chat-conversations-changed"));
    });
    const record = page.getByRole("article").filter({ hasText: "보관한 캐릭터와의 학습" });
    await expect(record).toBeVisible();
    await expect(record).toContainText("I remember this lesson.");
    await expect(record.getByRole("link", { name: "이어서 대화" })).toHaveAttribute("href", "/chat/archived-character?conversation=archived-character-chat");
  });
});
