import { expect, test } from "@playwright/test";
import { defaultPreferences } from "../../src/entities/learner/model/preferences";
import type { SavedMissionRequest } from "../../src/entities/mission/model/saved-missions";

test("saved mission endpoints require authentication and reject forged owner, state and cross-site writes", async ({ request }) => {
  const body = { requestId: "64000000-0000-4000-8000-000000000001", missionId: "64000000-0000-4000-8000-000000000002", saved: true };
  for (const path of ["/api/me/saved-missions", "/api/me/saved-missions?ownerId=other"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toBe("no-store");
  }
  expect((await request.put("/api/me/saved-missions", { data: body })).status()).toBe(401);
  for (const extra of [{ ownerId: "other" }, { saved: "true" }, { requestId: "bad" }, { missionId: "../private" }]) {
    expect((await request.put("/api/me/saved-missions", { data: { ...body, ...extra } })).status()).toBe(400);
  }
  expect((await request.put("/api/me/saved-missions", { data: body, headers: { Origin: "https://untrusted.example", "Sec-Fetch-Site": "cross-site" } })).status()).toBe(403);
});

// Tests the production HTTP client with controlled replies, not live Supabase.
test("HTTP saved-mission fixture retries a lost removal response and recovers list failures", async ({ page }) => {
  const ownerId = "65000000-0000-4000-8000-000000000001";
  const missionId = "65000000-0000-4000-8000-000000000002";
  let unavailable = true;
  let saved = true;
  const requests: SavedMissionRequest[] = [];
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { user: { id: ownerId, email: null, isAnonymous: true, createdAt: "2026-09-10T00:00:00Z" } } }));
  await page.route("**/api/me/preferences", (route) => route.fulfill({ json: { preferences: { ownerId, revision: 1, settings: defaultPreferences } } }));
  for (const path of ["characters", "missions"]) await page.route(`**/api/${path}`, (route) => route.fulfill({ json: { items: [] } }));
  await page.route("**/api/mission-runs", (route) => route.fulfill({ json: { runs: [] } }));
  await page.route("**/api/me/learning", (route) => route.fulfill({ json: { snapshot: { histories: [], favoriteCharacterIds: [], completedMissionIds: [], unlockedRewardIds: [], streak: 0, xp: 0, weeklyMinutes: 0 } } }));
  await page.route("**/api/me/progress", (route) => route.fulfill({ json: { progress: { today: "2026-09-10", source: "account", expressionCount: 0, days: [] } } }));
  await page.route("**/api/me/saved-missions", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill(unavailable ? { status: 503, json: {} } : { json: { items: saved ? [{ missionId, savedAt: "2026-09-10T00:00:00.000Z", mission: null }] : [] } });
      return;
    }
    requests.push(route.request().postDataJSON());
    saved = false;
    await route.fulfill(requests.length === 1 ? { status: 503, json: {} } : { json: { result: { missionId, saved: false } } });
  });
  await page.goto("/profile");
  await page.getByRole("tab", { name: "저장 미션", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "목록을 비우지 않았습니다." })).toBeVisible();
  unavailable = false;
  await page.getByRole("button", { name: "저장 미션 다시 불러오기" }).click();
  const library = page.getByTestId("profile-saved-missions");
  await expect(library).toContainText("현재 볼 수 없는 미션");
  await expect(library.getByRole("link")).toHaveCount(0);
  await library.getByRole("button", { name: "미션 저장 해제", exact: true }).click();
  await expect(library.getByRole("alert")).toBeVisible();
  await expect(library.getByRole("article")).toHaveCount(1);
  await library.getByRole("button", { name: "미션 저장 다시 시도", exact: true }).click();
  await expect(library).toContainText("저장된 미션이 아직 없어요.");
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
  expect(requests[0]).toMatchObject({ missionId, saved: false });
  await page.reload();
  await page.getByRole("tab", { name: "저장 미션", exact: true }).click();
  await expect(library.getByRole("article")).toHaveCount(0);
});
