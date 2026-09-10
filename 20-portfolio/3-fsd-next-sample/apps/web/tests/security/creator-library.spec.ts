import { expect, test } from "@playwright/test";
import { seedCharacters, seedMissions } from "../../src/shared/api/learning/mock-data";
import { defaultPreferences } from "../../src/entities/learner/model/preferences";

test("owned creations require a session even when a forged owner is provided", async ({ request }) => {
  for (const path of ["/api/me/creations", "/api/me/creations?ownerId=other"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toBe("no-store");
  }
});

// Controlled HTTP replies exercise the production client, not live Supabase.
test("HTTP creator library uses account ownership, keeps lifecycle states and recovers errors", async ({ page }) => {
  const ownerId = "66000000-0000-4000-8000-000000000001";
  const character = { ...seedCharacters[0], id: "66000000-0000-4000-8000-000000000002", creator: "Account owner", publishStatus: "draft" };
  const mission = { ...seedMissions[0], id: "66000000-0000-4000-8000-000000000003", learnerCount: 500, publishStatus: "published" };
  let unavailable = true;
  let owned = true;
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { user: { id: ownerId, email: null, isAnonymous: true, createdAt: "2026-09-10T00:00:00Z" } } }));
  await page.route("**/api/me/preferences", (route) => route.fulfill({ json: { preferences: { ownerId, revision: 1, settings: defaultPreferences } } }));
  for (const path of ["characters", "missions"]) await page.route(`**/api/${path}`, (route) => route.fulfill({ json: { items: [] } }));
  await page.route(`**/api/characters/${character.id}`, (route) => route.fulfill({ json: { item: character } }));
  await page.route(`**/api/missions/${mission.id}`, (route) => route.fulfill({ json: { item: mission } }));
  await page.route("**/api/mission-runs", (route) => route.fulfill({ json: { runs: [] } }));
  await page.route("**/api/me/learning", (route) => route.fulfill({ json: { snapshot: { histories: [], favoriteCharacterIds: [], completedMissionIds: [], unlockedRewardIds: [], streak: 0, xp: 0, weeklyMinutes: 0 } } }));
  await page.route("**/api/me/progress", (route) => route.fulfill({ json: { progress: { today: "2026-09-10", source: "account", expressionCount: 0, days: [] } } }));
  await page.route("**/api/me/creations", (route) => route.fulfill(unavailable ? { status: 503, json: {} } : { json: { creations: { source: "account", items: owned ? [
    { kind: "character", id: character.id, title: character.name, summary: character.tagline, status: "draft" },
    { kind: "mission", id: mission.id, title: mission.title, summary: mission.subtitle, status: "published" },
    { kind: "mission", id: "processing", title: "Processing mission", summary: "", status: "generating" },
    { kind: "character", id: "reviewing", title: "Review character", summary: "", status: "review" },
  ] : [] } } }));
  await page.goto("/profile");
  await page.getByRole("tab", { name: "내 생성물" }).click();
  await expect(page.getByRole("button", { name: "내 생성물 다시 불러오기" })).toBeVisible();
  unavailable = false;
  await page.getByRole("button", { name: "내 생성물 다시 불러오기" }).click();
  await expect(page.getByTestId("profile-creations")).toContainText("로그인한 계정이 소유한 콘텐츠");
  await expect(page.getByTestId("profile-created-mission-processing")).toContainText("생성 중");
  await expect(page.getByTestId("profile-created-mission-processing").getByRole("link")).toHaveCount(0);
  await expect(page.getByTestId("profile-created-character-reviewing")).toContainText("검토 중");
  await page.goto(`/characters/${character.id}/edit`);
  await expect(page.getByTestId("character-name")).toHaveValue(character.name);
  await page.goto(`/missions/${mission.id}/edit`);
  await expect(page.getByTestId("mission-title")).toHaveValue(mission.title);
  owned = false;
  await page.reload();
  await expect(page.getByRole("heading", { name: "편집할 수 없는 콘텐츠예요." })).toBeVisible();
  await expect(page.getByTestId("mission-title")).toHaveCount(0);
});
