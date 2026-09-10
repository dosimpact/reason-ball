import { expect, test } from "@playwright/test";
import { defaultPreferences } from "../../src/entities/learner/model/preferences";

const ownerId = "57000000-0000-4000-8000-000000000001";

test("private learning preferences require authentication, strict inputs and same-origin mutations", async ({ request }) => {
  const url = "/api/me/preferences";
  const body = { expectedOwnerId: ownerId, expectedRevision: 0, settings: defaultPreferences };
  const read = await request.get(url);
  expect(read.status()).toBe(401);
  expect(read.headers()["cache-control"]).toBe("no-store");
  expect((await request.patch(url, { data: body })).status()).toBe(401);
  for (const data of [
    { ...body, ownerId },
    { ...body, expectedOwnerId: "browser" },
    { ...body, expectedRevision: -1 },
    { ...body, settings: { ...defaultPreferences, autoplay: "true" } },
    { ...body, settings: { ...defaultPreferences, learningGoal: "x".repeat(501) } },
  ]) expect((await request.patch(url, { data })).status()).toBe(400);
  expect((await request.patch(url, { data: body, headers: { Origin: "https://untrusted.example", "Sec-Fetch-Site": "cross-site" } })).status()).toBe(403);
});

// HTTP client/UI fixture only. Ownership and revision SQL are covered by test:db;
// this does not claim a live Supabase connection or authentication success.
test("HTTP fixture preserves profile edits on outage and conflict, then explicitly reloads the server version", async ({ page }) => {
  let revision = 4;
  let settings = { ...defaultPreferences, displayName: "서버 이름" };
  let failure: "outage" | "conflict" | undefined = "outage";
  const writes: Array<{ expectedOwnerId: string; expectedRevision: number; settings: typeof settings }> = [];
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { user: { id: ownerId, email: null, isAnonymous: true, createdAt: "2026-09-10T00:00:00Z" } } }));
  await page.route("**/api/characters", (route) => route.fulfill({ json: { items: [] } }));
  await page.route("**/api/missions", (route) => route.fulfill({ json: { items: [] } }));
  await page.route("**/api/mission-runs", (route) => route.fulfill({ json: { runs: [] } }));
  await page.route("**/api/me/learning", (route) => route.fulfill({ json: { snapshot: { histories: [], favoriteCharacterIds: [], completedMissionIds: [], unlockedRewardIds: [], streak: 0, xp: 0, weeklyMinutes: 0 } } }));
  await page.route("**/api/me/preferences", async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      writes.push(body);
      if (failure) {
        await route.fulfill({ status: failure === "outage" ? 503 : 409, json: { error: { message: failure === "outage" ? "설정 서버에 연결할 수 없어요." : "다른 창에서 설정이 바뀌었어요." } } });
        return;
      }
      settings = body.settings;
      revision += 1;
    }
    await route.fulfill({ json: { preferences: { ownerId, revision, settings } } });
  });
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "서버 이름의 영어 여정" })).toBeVisible();
  await page.getByRole("tab", { name: "설정" }).click();
  await page.getByLabel("표시 이름").fill("편집 중인 이름");
  const save = page.getByRole("button", { name: "설정 저장", exact: true });
  const alert = page.getByTestId("profile-settings").getByRole("alert");
  await save.click();
  await expect(alert).toContainText("설정 서버에 연결할 수 없어요.");
  await expect(page.getByLabel("표시 이름")).toHaveValue("편집 중인 이름");
  await expect(page.getByText("학습 설정을 저장했어요.")).toHaveCount(0);
  failure = "conflict";
  revision = 5;
  settings = { ...settings, displayName: "다른 창의 이름" };
  await save.click();
  await expect(alert).toContainText("다른 창에서 설정이 바뀌었어요.");
  expect(writes.map(({ expectedOwnerId, expectedRevision }) => ({ expectedOwnerId, expectedRevision }))).toEqual([
    { expectedOwnerId: ownerId, expectedRevision: 4 }, { expectedOwnerId: ownerId, expectedRevision: 4 },
  ]);
  await expect(page.getByLabel("표시 이름")).toHaveValue("편집 중인 이름");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "저장된 설정 다시 불러오기" }).click();
  await expect(page.getByLabel("표시 이름")).toHaveValue("다른 창의 이름");
  failure = undefined;
  await page.getByLabel("표시 이름").fill("확인 후 저장한 이름");
  await save.click();
  await expect(page.getByText("학습 설정을 저장했어요.")).toBeVisible();
  expect(writes[2]).toMatchObject({ expectedOwnerId: ownerId, expectedRevision: 5 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "확인 후 저장한 이름의 영어 여정" })).toBeVisible();
});

test("HTTP fixture does not replace unavailable preferences with editable defaults", async ({ page }) => {
  let unavailable = true;
  let writes = 0;
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { user: { id: ownerId, email: null, isAnonymous: true, createdAt: "2026-09-10T00:00:00Z" } } }));
  await page.route("**/api/me/preferences", async (route) => {
    if (route.request().method() !== "GET") writes += 1;
    await route.fulfill(unavailable
      ? { status: 503, json: { error: { message: "Unavailable" } } }
      : { json: { preferences: { ownerId, revision: 8, settings: { ...defaultPreferences, displayName: "복구된 설정" } } } });
  });
  await page.goto("/profile");
  await page.getByRole("tab", { name: "설정" }).click();
  await expect(page.getByText("학습 설정을 불러오지 못했어요. 저장된 값은 변경하지 않았습니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "설정 저장", exact: true })).toHaveCount(0);
  expect(writes).toBe(0);
  unavailable = false;
  await page.getByRole("button", { name: "설정 다시 불러오기", exact: true }).click();
  await expect(page.getByLabel("표시 이름")).toHaveValue("복구된 설정");
  expect(writes).toBe(0);
});
