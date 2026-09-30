import { expect, test } from "@playwright/test";
import { seedCharacters } from "../../src/shared/api/learning/mock-data";
import { defaultPreferences } from "../../src/entities/learner/model/preferences";

const conversationId = "58000000-0000-4000-8000-000000000001";
const ownerId = "58000000-0000-4000-8000-000000000002";

test("activity writes reject missing authentication, forged duration and cross-site requests", async ({ request }) => {
  const body = { conversationId, requestId: ownerId, active: true };
  expect((await request.post("/api/me/activity", { data: body })).status()).toBe(401);
  for (const extra of [{ seconds: 600 }, { ownerId }, { active: "true" }, { requestId: "bad" }]) {
    expect((await request.post("/api/me/activity", { data: { ...body, ...extra } })).status()).toBe(400);
  }
  expect((await request.post("/api/me/activity", { data: body, headers: { Origin: "https://untrusted.example", "Sec-Fetch-Site": "cross-site" } })).status()).toBe(403);
});

// A real browser drives the production HTTP client against response fixtures.
// This is not a real Supabase write or a wall-clock accuracy certification.
test("HTTP fixture starts only on interaction, preserves retry identity and stops after idle", async ({ page }) => {
  await page.clock.install();
  const character = seedCharacters[0];
  const requests: Array<{ conversationId: string; requestId: string; active: boolean }> = [];
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { user: { id: ownerId, email: null, isAnonymous: true, createdAt: "2026-09-10T00:00:00Z" } } }));
  await page.route("**/api/me/preferences", (route) => route.fulfill({ json: { preferences: { ownerId, revision: 1, settings: defaultPreferences } } }));
  await page.route("**/api/me/learning", (route) => route.fulfill({ json: { snapshot: { histories: [], favoriteCharacterIds: [], completedMissionIds: [], unlockedRewardIds: [], streak: 0, xp: 0, weeklyMinutes: 0 } } }));
  await page.route(`**/api/conversations/${conversationId}/context`, (route) => route.fulfill({ json: { context: { conversationId, character, characterAliases: [character.id], missionAliases: [] } } }));
  await page.route(`**/api/conversations/${conversationId}`, (route) => route.fulfill({ json: { item: { id: conversationId, characterId: character.id, missionId: null, title: "Activity", status: "active", modelId: "gpt-5.6-terra", createdAt: "2026-09-10T00:00:00Z", updatedAt: "2026-09-10T00:00:00Z" } } }));
  await page.route(`**/api/conversations/${conversationId}/messages?*`, (route) => route.fulfill({ json: { items: [], hasMore: false } }));
  await page.route("**/api/me/activity", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill(requests.length === 1
      ? { status: 503, json: { error: { message: "Unavailable" } } }
      : { json: { activity: { acceptedSeconds: 0, recordedAt: "2026-09-10T00:00:00Z" } } });
  });
  await page.goto(`/chat/${character.id}?conversation=${conversationId}`);
  const input = page.getByRole("textbox", { name: "영어 메시지" });
  await expect(input).toBeEnabled();
  expect(requests).toHaveLength(0);
  await input.fill("My unsent practice");
  await expect(page.getByTestId("learning-activity-warning")).toBeVisible();
  await expect(input).toHaveValue("My unsent practice");
  await page.getByRole("button", { name: "학습 시간 기록 다시 시도" }).click();
  await expect(page.getByTestId("learning-activity-warning")).toHaveCount(0);
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
  expect(requests[0]).toMatchObject({ conversationId, active: true });
  await page.clock.fastForward(65_000);
  await expect.poll(() => requests.at(-1)?.active).toBe(false);
  const stoppedCount = requests.length;
  await page.clock.fastForward(30_000);
  expect(requests).toHaveLength(stoppedCount);
  await expect(input).toHaveValue("My unsent practice");
});
