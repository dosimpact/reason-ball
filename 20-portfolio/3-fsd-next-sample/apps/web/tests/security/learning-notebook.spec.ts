import { expect, test } from "@playwright/test";
import { seedCharacters } from "../../src/shared/api/learning/mock-data";
import { defaultPreferences } from "../../src/entities/learner/model/preferences";
import type { NotebookEntry, SaveNotebookRequest } from "../../src/entities/learning-notebook/model/notebook";

const id = "62000000-0000-4000-8000-000000000001";
const draft = { kind: "expression", text: "Could I check in?", meaning: "체크인 요청", originalText: "", source: { conversationId: id } };

test("notebook endpoints reject anonymous access, forged owner and identity, and cross-site mutation", async ({ request }) => {
  for (const path of ["/api/me/notebook", `/api/me/notebook?ownerId=${id}`]) {
    const response = await request.get(path);
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toBe("no-store");
  }
  expect((await request.post("/api/me/notebook", { data: { id, draft } })).status()).toBe(401);
  for (const data of [
    { id, draft, ownerId: id }, { id, draft, identity: "forged" }, { id: "bad", draft },
    { id, draft: { ...draft, source: { conversationId: "not-a-uuid" } } },
    { id, draft: { ...draft, kind: "correction" } },
  ]) expect((await request.post("/api/me/notebook", { data })).status()).toBe(400);
  expect((await request.post("/api/me/notebook", { data: { id, draft }, headers: { Origin: "https://untrusted.example", "Sec-Fetch-Site": "cross-site" } })).status()).toBe(403);
});

// Drives the real HTTP client against controlled replies, not live Supabase.
test("HTTP notebook fixture preserves retry identity after response loss and recovers a private library read", async ({ page }) => {
  const character = seedCharacters[0];
  const messageId = "63000000-0000-4000-8000-000000000002";
  const requests: SaveNotebookRequest[] = [];
  const entries: NotebookEntry[] = [];
  let unavailable = false;
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { user: { id, email: null, isAnonymous: true, createdAt: "2026-09-10T00:00:00Z" } } }));
  await page.route("**/api/me/preferences", (route) => route.fulfill({ json: { preferences: { ownerId: id, revision: 1, settings: defaultPreferences } } }));
  for (const path of ["characters", "missions"]) await page.route(`**/api/${path}`, (route) => route.fulfill({ json: { items: [] } }));
  await page.route("**/api/mission-runs", (route) => route.fulfill({ json: { runs: [] } }));
  await page.route("**/api/me/learning", (route) => route.fulfill({ json: { snapshot: { histories: [], favoriteCharacterIds: [], completedMissionIds: [], unlockedRewardIds: [], streak: 0, xp: 0, weeklyMinutes: 0 } } }));
  await page.route("**/api/me/progress", (route) => route.fulfill({ json: { progress: { today: "2026-09-10", source: "account", expressionCount: entries.length, days: [] } } }));
  await page.route("**/api/me/activity", (route) => route.fulfill({ json: { activity: { acceptedSeconds: 0, recordedAt: "2026-09-10T12:00:00Z" } } }));
  await page.route(`**/api/conversations/${id}/context`, (route) => route.fulfill({ json: { context: { conversationId: id, character, characterAliases: [character.id], missionAliases: [] } } }));
  await page.route(`**/api/conversations/${id}`, (route) => route.fulfill({ json: { item: { id, characterId: character.id, missionId: null, title: "Notebook", status: "active", modelId: "gpt-5.6-terra", createdAt: "2026-09-10T00:00:00Z", updatedAt: "2026-09-10T00:00:00Z" } } }));
  await page.route(`**/api/conversations/${id}/messages?*`, (route) => route.fulfill({ json: { items: [{ id: messageId, clientMessageId: null, role: "assistant", status: "complete", parts: [{ type: "text", text: "Could I check in?" }], sequenceNumber: 1, createdAt: "2026-09-10T00:00:00Z" }], hasMore: false } }));
  await page.route("**/api/me/notebook", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill(unavailable ? { status: 503, json: {} } : { json: { notebook: { version: 1, entries } } });
      return;
    }
    requests.push(route.request().postDataJSON());
    if (requests.length === 1) {
      entries.push({ ...requests[0], createdAt: "2026-09-10T12:00:00.000Z" });
      await route.fulfill({ status: 503, json: {} });
    } else await route.fulfill({ json: { entry: entries[0], outcome: "replayed" } });
  });
  await page.goto(`/chat/${character.id}?conversation=${id}`);
  await page.getByTestId("message-assistant").getByRole("button", { name: "복습 기록 저장", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "복습 기록 저장", exact: true });
  await dialog.getByLabel("뜻 또는 복습 메모").fill("My private note");
  await dialog.getByRole("button", { name: "복습 기록에 저장", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByLabel("뜻 또는 복습 메모")).toHaveValue("My private note");
  await dialog.getByRole("button", { name: "같은 내용으로 다시 저장" }).click();
  await expect(dialog.getByRole("status")).toContainText("저장했어요");
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
  expect(requests[0].draft.source).toEqual({ conversationId: id, messageId });
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  unavailable = true;
  await page.goto("/profile");
  await page.getByRole("tab", { name: "학습 표현", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "복습 기록을 불러오지 못했어요." })).toBeVisible();
  unavailable = false;
  await page.getByRole("button", { name: "복습 기록 다시 불러오기" }).click();
  await expect(page.getByTestId("profile-expressions").getByRole("article")).toHaveCount(1);
  await expect(page.getByTestId("profile-expressions")).toContainText("My private note");
});
