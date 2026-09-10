import { expect, test } from "@playwright/test";
import { defaultPreferences } from "../../src/entities/learner/model/preferences";

test("learning progress is private and cannot be selected by a query-string owner", async ({ request }) => {
  for (const path of ["/api/me/progress", "/api/me/progress?ownerId=57000000-0000-4000-8000-000000000002"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect((await response.json()).error.code).toBe("AUTHENTICATION_REQUIRED");
  }
});

// HTTP response fixtures prove presentation and recovery, not live DB access.
test("HTTP fixture shows actual chart totals, empty dates and retry instead of invented progress", async ({ page }) => {
  const ownerId = "57000000-0000-4000-8000-000000000001";
  let unavailable = true;
  let empty = false;
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { user: { id: ownerId, email: null, isAnonymous: true, createdAt: "2026-09-10T00:00:00Z" } } }));
  await page.route("**/api/characters", (route) => route.fulfill({ json: { items: [] } }));
  await page.route("**/api/missions", (route) => route.fulfill({ json: { items: [] } }));
  await page.route("**/api/mission-runs", (route) => route.fulfill({ json: { runs: [] } }));
  await page.route("**/api/me/preferences", (route) => route.fulfill({ json: { preferences: { ownerId, revision: 1, settings: defaultPreferences } } }));
  await page.route("**/api/me/learning", (route) => route.fulfill({ json: { snapshot: { histories: [], favoriteCharacterIds: [], completedMissionIds: ["completed-a"], unlockedRewardIds: [], streak: 99, xp: 120, weeklyMinutes: 999 } } }));
  await page.route("**/api/me/progress", (route) => route.fulfill(unavailable
    ? { status: 503, json: { error: { message: "Unavailable" } } }
    : { json: { progress: { today: "2026-09-10", source: "account", expressionCount: empty ? 0 : 7, days: empty ? [] : [
      { date: "2026-09-08", minutes: 5, messages: 1, missionsStarted: 0, missionsCompleted: 0 },
      { date: "2026-09-09", minutes: 12, messages: 1, missionsStarted: 0, missionsCompleted: 1 },
    ] } } }));
  await page.goto("/profile");
  await expect(page.getByTestId("learning-progress-error")).toContainText("기록을 0으로 바꾸지 않았습니다.");
  await expect(page.getByTestId("learning-progress")).toHaveCount(0);
  await expect(page.getByTestId("header-learning-streak")).toHaveText("진도 확인");
  unavailable = false;
  await page.getByRole("button", { name: "학습 진도 다시 불러오기" }).click();
  const progress = page.getByTestId("learning-progress");
  await expect(progress).toContainText("내 계정의 학습 기록");
  await expect(progress.getByRole("img", { name: "최근 7일 총 17분 학습 시간 그래프" })).toBeVisible();
  await expect(progress.getByRole("article").filter({ hasText: "연속 학습" })).toContainText("2일");
  await expect(page.getByTestId("header-learning-streak")).toHaveText("2일");
  await expect(progress.getByRole("article").filter({ hasText: "저장한 표현" })).toContainText("7개");
  await expect(progress.getByTestId("learning-day-2026-09-10")).toContainText("0분");
  await expect(page.getByText("+18% 성장")).toHaveCount(0);
  await expect(page.getByText("LEVEL 8", { exact: true })).toHaveCount(0);
  await expect(progress).not.toContainText("999분");
  empty = true;
  await page.reload();
  await expect(progress).toContainText("아직 기록된 학습 시간이 없어요.");
  await expect(progress.getByRole("article").filter({ hasText: "연속 학습" })).toContainText("0일");
  await expect(page.getByTestId("header-learning-streak")).toHaveText("0일");
  await expect(progress.getByRole("img", { name: "최근 7일 총 0분 학습 시간 그래프" })).toBeVisible();
});
