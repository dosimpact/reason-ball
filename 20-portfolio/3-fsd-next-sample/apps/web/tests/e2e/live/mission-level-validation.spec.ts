import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { test, expect, adminClient } from "./fixtures";
const origin = "http://dodonet.iptime.org:13000";
const fixtureImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHmsAAAAASUVORK5CYII=";
const unique = () => `Level boundary ${randomUUID()}`;
async function seedCharacter(page: Page, publishStatus: 'draft' | 'published' = 'draft') {
  const response = await page.request.post('/api/characters', {
    headers: { Origin: origin },
    data: {
      name: unique(), role: 'Friendly practice partner', tagline: 'Disposable creator test',
      description: 'A private test character for English practice.', personality: ['다정함'],
      personaGoal: 'Help a learner feel welcome.', learningGoal: 'Practice a short greeting.',
      speakingStyle: 'Short and clear English.', relationship: 'Learning partner',
      teachingStyle: 'Give one gentle correction.', prohibitedInstructions: ['Never request personal data.'],
      accent: 'American', level: '입문', topics: ['일상'], palette: ['#ff8067', '#ffc65c'],
      emoji: '🌱', visibility: 'private', publishStatus, imageUrl: fixtureImage,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()).item as { id: string; name: string };
}


// Check the UI boundary independently from the direct API regression below.
test("MISSION-03 Pre-A1 rejects eleven words without losing draft and persists ten words", async ({ page, account }) => {
  const character = await seedCharacter(page, "published");
  const title = unique();
  const invalidPhrase = "Please help me find the nearest train station in this city.";
  const validPhrase = "Please help me find the nearest train station in town.";
  expect(invalidPhrase.split(/\s+/)).toHaveLength(11);
  expect(validPhrase.split(/\s+/)).toHaveLength(10);
  const mutations: string[] = [];
  page.on("request", request => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/missions") mutations.push(request.url());
  });
  await page.goto("/missions/new");
  await page.getByTestId("mission-title").fill(title);
  await page.getByLabel("한 줄 설명", { exact: true }).fill("Ask for directions in a short sentence.");
  await page.getByLabel("상세 설명", { exact: true }).fill("Find a station with a practice partner.");
  await page.getByLabel("장소", { exact: true }).fill("Town square");
  await page.getByRole("combobox", { name: /^함께할 캐릭터/ }).selectOption(character.id);
  await page.getByRole("combobox", { name: "난이도", exact: true }).selectOption("입문");
  await page.getByRole("button", { name: "다음 단계", exact: true }).click();
  await page.getByRole("button", { name: "목표 추가", exact: true }).click();
  await page.getByLabel("목표 1", { exact: true }).fill("Ask for directions");
  await page.getByLabel("목표 1 힌트", { exact: true }).fill("Please help me.");
  await page.getByRole("button", { name: "단계 추가", exact: true }).click();
  await page.getByLabel("단계 1", { exact: true }).fill("Find the station");
  await page.getByLabel("단계 1 성공 조건", { exact: true }).fill("Ask where the station is");
  await page.getByRole("button", { name: "표현 추가", exact: true }).click();
  await page.getByLabel("영어 표현 1", { exact: true }).fill(invalidPhrase);
  await page.getByLabel("표현 1 뜻", { exact: true }).fill("가까운 기차역을 찾도록 도와주세요.");
  await page.getByRole("button", { name: "다음 단계", exact: true }).click();
  const lengthError = page.getByRole("alert").filter({ hasText: "입문 표현은 한 문장에 10단어 이하로 작성해 주세요." });
  await expect(lengthError).toBeVisible();
  await expect(page.getByLabel("영어 표현 1", { exact: true })).toHaveValue(invalidPhrase);
  await expect(page.getByLabel("목표 1", { exact: true })).toHaveValue("Ask for directions");
  await expect(page.getByLabel("단계 1 성공 조건", { exact: true })).toHaveValue("Ask where the station is");
  await expect(page.getByTestId("save-mission")).toHaveCount(0);
  expect(mutations).toEqual([]);
  const absent = await adminClient().from("missions").select("id").eq("owner_id", account!.id).eq("title", title);
  expect(absent.error).toBeNull(); expect(absent.data).toEqual([]);
  await page.getByRole("button", { name: "이전", exact: true }).click();
  await expect(page.getByTestId("mission-title")).toHaveValue(title);
  await expect(page.getByRole("combobox", { name: "난이도", exact: true })).toHaveValue("입문");
  await page.getByRole("button", { name: "다음 단계", exact: true }).click();
  await expect(page.getByLabel("영어 표현 1", { exact: true })).toHaveValue(invalidPhrase);
  await page.getByLabel("영어 표현 1", { exact: true }).fill(validPhrase);
  await page.getByRole("button", { name: "다음 단계", exact: true }).click();
  await expect(page.getByTestId("mission-validation-summary")).toContainText("Pre-A1 짧은 문장 정책");
  await expect(lengthError).toHaveCount(0);
  const saved = page.waitForResponse(response => new URL(response.url()).pathname === "/api/missions" && response.request().method() === "POST");
  await page.getByTestId("save-mission").click();
  const response = await saved;
  expect(response.ok()).toBe(true);
  const mission = (await response.json()).item;
  expect(mission.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(mutations).toHaveLength(1);
  const stored = await adminClient().from("missions").select("id,owner_id,current_version_id,status").eq("id", mission.id).single();
  expect(stored.error).toBeNull(); expect(stored.data!.owner_id).toBe(account!.id); expect(stored.data!.status).toBe("draft");
  const version = await adminClient().from("mission_versions").select("target_vocabulary").eq("id", stored.data!.current_version_id).single();
  expect(version.error).toBeNull();
  expect(version.data!.target_vocabulary).toEqual([{ english: validPhrase, korean: "가까운 기차역을 찾도록 도와주세요." }]);
  const versionsBefore = await adminClient().from("mission_versions").select("id").eq("mission_id", mission.id).order("id");
  expect(versionsBefore.error).toBeNull();
  expect(mission.versionNumber).toBe(1);
  const invalidVersion = await page.request.patch(`/api/missions/${mission.id}`, {
    headers: { Origin: origin },
    data: {
      action: "create-version", expectedVersion: mission.versionNumber,
      draft: { ...response.request().postDataJSON(), keyPhrases: [{ english: invalidPhrase, korean: "가까운 기차역을 찾도록 도와주세요." }] },
    },
  });
  expect(invalidVersion.status()).toBe(400);
  expect((await invalidVersion.json()).error.fieldErrors["draft.keyPhrases.0.english"]).toEqual(["입문 표현은 한 문장에 10단어 이하로 작성해 주세요."]);
  const unchanged = await adminClient().from("missions").select("current_version_id").eq("id", mission.id).single();
  expect(unchanged.error).toBeNull();
  expect(unchanged.data!.current_version_id).toBe(stored.data!.current_version_id);
  const versionsAfter = await adminClient().from("mission_versions").select("id").eq("mission_id", mission.id).order("id");
  expect(versionsAfter.error).toBeNull(); expect(versionsAfter.data).toEqual(versionsBefore.data);
  await page.goto(`/missions/${mission.id}/edit`);
  await page.reload();
  await expect(page.getByTestId("mission-title")).toHaveValue(title);
  await expect(page.getByRole("combobox", { name: "난이도", exact: true })).toHaveValue("입문");
  await page.getByRole("button", { name: "다음 단계", exact: true }).click();
  await expect(page.getByLabel("영어 표현 1", { exact: true })).toHaveValue(validPhrase);
  await expect(page.getByLabel("표현 1 뜻", { exact: true })).toHaveValue("가까운 기차역을 찾도록 도와주세요.");
  await expect(page.getByLabel("목표 1", { exact: true })).toHaveValue("Ask for directions");
});

// The same boundary must reject direct API input before any database write.
test("MISSION-03 direct API rejects an eleven-word Pre-A1 phrase before creating a mission", async ({ page, account }) => {
  const character = await seedCharacter(page, "published");
  const title = unique();
  const phrase = "Please help me find the nearest train station in this city.";
  expect(phrase.split(/\s+/)).toHaveLength(11);
  const response = await page.request.post("/api/missions", { headers: { Origin: origin }, data: {
    title, subtitle: "Short directions practice.", description: "Find the station.", category: "일상", location: "Town square",
    difficulty: "입문", durationMinutes: 3,
    objectives: [{ id: "directions", label: "Ask for directions", hint: "Please help me." }],
    steps: [{ id: "directions", label: "Find the station", hint: "Please help me.", required: true, successCriteria: ["Ask where the station is"] }],
    keyPhrases: [{ english: phrase, korean: "가까운 기차역을 찾도록 도와주세요." }],
    successThreshold: 70, prerequisites: [], rewardTitle: "Directions keepsake", rewardPalette: ["#ff8067", "#ffc65c"], rewardEmoji: "🌱",
    recommendedCharacterId: character.id, publishStatus: "draft",
  } });
  expect(response.status(), "Server must enforce the same Pre-A1 phrase limit as the UI").toBe(400);
  expect((await response.json()).error.fieldErrors["keyPhrases.0.english"]).toEqual(["입문 표현은 한 문장에 10단어 이하로 작성해 주세요."]);
  const rows = await adminClient().from("missions").select("id").eq("owner_id", account!.id).eq("title", title);
  expect(rows.error).toBeNull(); expect(rows.data).toEqual([]);
});
