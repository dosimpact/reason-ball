import { randomUUID } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import { adminClient, expect, signIn, test } from "./fixtures";
const origin = "http://dodonet.iptime.org:13000";
const headers = { Origin: origin };
const manualPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHmsAAAAASUVORK5CYII=";
// Actual API publishing fixtures with manual PNG; no AI image claim.
async function createCharacter(creator: APIRequestContext) {
  const response = await creator.post("/api/characters", { headers, data: {
    name: `Prerequisite partner ${randomUUID()}`, role: "Friendly practice partner", tagline: "Disposable prerequisite test",
    description: "Help a learner introduce themselves.", personality: ["다정함"], personaGoal: "Welcome the learner.",
    learningGoal: "Practice greetings.", speakingStyle: "Short clear English.", relationship: "Practice partner", teachingStyle: "Give gentle correction.",
    prohibitedInstructions: ["Do not ask for private data."], accent: "American", level: "입문", topics: ["일상"],
    palette: ["#ff8067", "#ffc65c"], emoji: "🌱", visibility: "public", publishStatus: "published", imageUrl: manualPng,
  } });
  expect(response.ok(), `Create character ${response.status()}`).toBe(true);
  return (await response.json()).item.id as string;
}
function missionDraft(characterId: string, prerequisites: string[] = []) {
  return {
    title: `Prerequisite greeting ${randomUUID()}`, subtitle: "Introduce yourself politely.", description: "Greet the partner and give a fictional name.",
    category: "일상", location: "Practice cafe", difficulty: "입문", durationMinutes: 3,
    objectives: [{ id: "greeting", label: "Greet and introduce yourself", hint: "Hello, my name is Alex." }],
    steps: [{ id: "greeting", label: "Greet and introduce yourself", hint: "Hello, my name is Alex.", required: true, successCriteria: ["Learner gives a polite greeting", "Learner gives a fictional name"] }],
    keyPhrases: [{ english: "Hello, my name is Alex.", korean: "안녕하세요, 제 이름은 알렉스예요." }],
    successThreshold: 70, prerequisites, rewardTitle: "Greeting keepsake", rewardPalette: ["#ff8067", "#ffc65c"], rewardEmoji: "🌱",
    rewardImageUrl: manualPng, recommendedCharacterId: characterId, publishStatus: "published",
  };
}
async function createMission(creator: APIRequestContext, draft: ReturnType<typeof missionDraft>) {
  const response = await creator.post("/api/missions", { headers, data: draft });
  expect(response.ok(), `Create published mission ${response.status()}`).toBe(true);
  return (await response.json()).item.id as string;
}

async function favorites(owner: string, mission: string) {
  const result = await adminClient().from("mission_favorites").select("mission_id").eq("user_id", owner).eq("mission_id", mission);
  expect(result.error).toBeNull(); return result.data!;
}

test("PROFILE-03 archived saved mission hides content, remains removable, and old receipt replay cannot restore it", async ({ page, request, account, createAccount }) => {
  await signIn(request, await createAccount());
  try {
    const character = await createCharacter(request);
    const draft = missionDraft(character);
    const mission = await createMission(request, draft);
    await page.goto(`/missions/${mission}`);
    const savedResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/me/saved-missions" && response.request().method() === "PUT");
    await page.getByRole("button", { name: "미션 저장", exact: true }).click();
    const saved = await savedResponse;
    expect(saved.ok()).toBe(true);
    const originalRequest = saved.request().postDataJSON();
    expect(originalRequest).toEqual({ missionId: mission, saved: true, requestId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    const originalResult = (await saved.json()).result;
    expect(originalResult).toEqual({ missionId: mission, saved: true });
    expect(await favorites(account!.id, mission)).toEqual([{ mission_id: mission }]);
    const archived = await request.patch(`/api/missions/${mission}`, { headers, data: { action: "archive" } });
    expect(archived.ok()).toBe(true);
    await page.goto("/profile");
    await page.getByRole("tab", { name: "저장 미션", exact: true }).click();
    const library = page.getByTestId("profile-saved-missions");
    await expect(library.getByRole("heading", { name: "현재 볼 수 없는 미션", exact: true })).toBeVisible();
    await expect(library).not.toContainText(draft.title);
    await expect(library.locator(`a[href="/missions/${mission}"]`)).toHaveCount(0);
    const entries = await page.request.get("/api/me/saved-missions");
    expect(entries.ok()).toBe(true);
    expect((await entries.json()).items).toEqual([{ missionId: mission, mission: null, savedAt: expect.any(String) }]);
    await page.reload();
    await page.getByRole("tab", { name: "저장 미션", exact: true }).click();
    await expect(library.getByRole("heading", { name: "현재 볼 수 없는 미션", exact: true })).toBeVisible();
    await library.getByRole("button", { name: "미션 저장 해제", exact: true }).click();
    await expect(library).toContainText("저장된 미션이 아직 없어요.");
    expect(await favorites(account!.id, mission)).toEqual([]);
    const replay = await page.request.put("/api/me/saved-missions", { headers, data: originalRequest });
    expect(replay.ok()).toBe(true);
    // Receipt returns its historical result, not current saved state.
    expect((await replay.json()).result).toEqual(originalResult);
    expect(await favorites(account!.id, mission)).toEqual([]);
    const current = await page.request.get("/api/me/saved-missions");
    expect(current.ok()).toBe(true);
    expect((await current.json()).items).toEqual([]);
    const changed = await page.request.put("/api/me/saved-missions", { headers, data: { ...originalRequest, saved: false } });
    expect(changed.status()).toBe(409);
    expect(await favorites(account!.id, mission)).toEqual([]);
    await page.reload();
    await page.getByRole("tab", { name: "저장 미션", exact: true }).click();
    await expect(library).toContainText("저장된 미션이 아직 없어요.");
    expect((await page.request.get(`/api/missions/${mission}`)).status()).toBe(404);
  } finally { await request.post("/api/auth/logout", { headers }); }
});
