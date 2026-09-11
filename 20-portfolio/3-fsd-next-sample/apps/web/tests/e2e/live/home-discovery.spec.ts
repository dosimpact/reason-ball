import { randomUUID } from "node:crypto";
import { adminClient, expect, test } from "./fixtures";
import type { Character, Mission } from "../../../src/shared/api/learning/contracts";
const headers = { Origin: "http://dodonet.iptime.org:13000" };
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHmsAAAAASUVORK5CYII=";

test("DISC-01 home uses saved interests, real conversation popularity and beginner-only public missions", async ({ page }) => {
  test.setTimeout(180_000);
  async function character(topics: string[], publishStatus: "draft" | "published") {
    const response = await page.request.post("/api/characters", { headers, data: {
      name: `Home ${randomUUID()}`, role: "Practice partner", tagline: "Home discovery fixture", description: "English practice",
      personality: ["다정함"], personaGoal: "Practice greetings", learningGoal: "Say hello", speakingStyle: "Brief English",
      relationship: "Partner", teachingStyle: "Gentle correction", prohibitedInstructions: [], accent: "American", level: "입문",
      topics, palette: ["#ff8067", "#ffc65c"], emoji: "🌱", visibility: publishStatus === "published" ? "public" : "private",
      publishStatus, imageUrl: png,
    } });
    expect(response.ok()).toBe(true);
    return (await response.json()).item as Character;
  }
  const school = await character(["학업", "여행"], "published");
  const work = await character(["직장", "일상"], "published");
  const draft = await character(["학업", "여행"], "draft");
  const missions: Mission[] = [];
  for (const difficulty of ["입문", "중급"] as const) {
    const response = await page.request.post("/api/missions", { headers, data: {
      title: `Home ${difficulty} ${randomUUID()}`, subtitle: "Practice hello", description: "A simple greeting",
      category: "일상", location: "Practice room", difficulty, durationMinutes: 3, recommendedCharacterId: school.id,
      objectives: [{ id: "hello", label: "Say hello", hint: "Hello" }],
      steps: [{ id: "hello", label: "Say hello", hint: "Hello", required: true, successCriteria: ["Say hello"] }],
      keyPhrases: [], rewardTitle: "Hello keepsake", rewardPalette: ["#ff8067", "#ffc65c"], rewardEmoji: "🌱",
      rewardImageUrl: png, successThreshold: 70, prerequisites: [], publishStatus: "published",
    } });
    expect(response.ok()).toBe(true);
    const created = (await response.json()).item as Mission;
    expect(created.difficulty).toBe(difficulty);
    missions.push(created);
  }
  async function chooseInterests(interests: string[]) {
    await page.goto("/profile");
    await page.getByRole("tab", { name: "설정", exact: true }).click();
    await expect(page.getByTestId("profile-settings")).toContainText("현재 계정에 비공개로 저장합니다.");
    for (const value of ["여행", "일상", "직장", "학업", "문화"]) await page.getByLabel(`관심 상황 ${value}`, { exact: true }).setChecked(interests.includes(value));
    await page.getByRole("button", { name: "설정 저장", exact: true }).click();
    await expect(page.getByText("학습 설정을 저장했어요.", { exact: true })).toBeVisible();
    await page.goto("/");
  }
  await chooseInterests(["학업", "여행"]);
  const recommended = page.getByTestId("home-recommendations");
  await expect(recommended.locator('[data-testid^="character-card-"]').first()).toHaveAttribute("data-testid", `character-card-${school.id}`);
  await expect(recommended.getByTestId(`character-card-${draft.id}`)).toHaveCount(0);
  await chooseInterests(["직장", "일상"]);
  await expect(recommended.locator('[data-testid^="character-card-"]').first()).toHaveAttribute("data-testid", `character-card-${work.id}`);
  await page.reload();
  await expect(recommended.locator('[data-testid^="character-card-"]').first()).toHaveAttribute("data-testid", `character-card-${work.id}`);
  const beginners = page.getByTestId("home-beginner-missions");
  await expect(beginners.getByTestId(`mission-card-${missions[1].id}`)).toHaveCount(0);
  const ids = await beginners.locator('[data-testid^="mission-card-"]').evaluateAll(nodes => nodes.map(node => node.getAttribute("data-testid")!.replace("mission-card-", "")));
  expect(ids.length).toBeGreaterThan(0);
  const catalog = await page.request.get("/api/missions");
  expect(catalog.ok()).toBe(true);
  const rows = (await catalog.json()).items as Mission[];
  for (const id of ids) expect(["입문", "초급"]).toContain(rows.find(item => item.id === id)!.difficulty);
  // Distinct popularity comes from three actual conversations, never a fabricated counter.
  const createdIds: string[] = [];
  for (let index = 0; index < 3; index++) {
    await page.goto(`/chat/${school.id}`);
    await expect(page.getByTestId("chat-input")).toBeEnabled();
    createdIds.push((await page.getByTestId("chat-workspace").getAttribute("data-conversation-id"))!);
  }
  expect(new Set(createdIds).size).toBe(3);
  async function count(expected: number) {
    const result = await adminClient().from("characters").select("conversation_count").eq("id", school.id).single();
    expect(result.error).toBeNull();
    expect(result.data!.conversation_count).toBe(expected);
    const actual = await adminClient().from("conversations").select("id", { count: "exact", head: true }).eq("character_id", school.id).neq("status", "deleted");
    expect(actual.error).toBeNull();
    expect(actual.count).toBe(expected);
  }
  await count(3);
  await page.goto("/");
  const popular = page.getByTestId("home-popular-characters");
  await expect(popular.locator('[data-testid^="character-card-"]').first()).toHaveAttribute("data-testid", `character-card-${school.id}`);
  await expect(popular.getByTestId(`character-card-${school.id}`)).toContainText("3개 대화");
  await expect(popular.getByTestId(`character-card-${draft.id}`)).toHaveCount(0);
  expect((await page.request.delete(`/api/conversations/${createdIds[0]}`, { headers })).ok()).toBe(true);
  await count(2);
  expect((await page.request.delete(`/api/conversations/${createdIds[0]}?purge=true`, { headers })).ok()).toBe(true);
  await count(2);
  await page.reload();
  await expect(popular.getByTestId(`character-card-${school.id}`)).toContainText("2개 대화");
});
