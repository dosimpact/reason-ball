import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { test, expect, adminClient, signIn } from "./fixtures";

async function ownerId(page: Page): Promise<string> {
  const response = await page.request.get("/api/auth/session");
  expect(response.ok()).toBe(true);
  const { user } = await response.json();
  expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
  return user.id;
}

async function firstCharacter(page: Page) {
  await page.goto("/characters");
  const card = page.locator('[data-testid^="character-card-"]').first();
  await expect(card).toBeVisible();
  const id = (await card.getAttribute("data-testid"))!.replace("character-card-", "");
  const name = await card.getByRole("heading").innerText();
  return { id, name, card };
}

async function firstMission(page: Page) {
  await page.goto("/missions");
  const card = page.locator('[data-testid^="mission-card-"]').first();
  await expect(card).toBeVisible();
  const id = (await card.getAttribute("data-testid"))!.replace("mission-card-", "");
  const title = await card.getByRole("heading").innerText();
  return { id, title, card };
}

test("all learner preferences persist in Supabase and restore in the profile", async ({ page }) => {
  await page.goto("/profile");
  await page.getByRole("tab", { name: "설정", exact: true }).click();
  const settings = { displayName: "실연동 학습자", learnerLevel: "B2", dailyGoal: 20,
    learningGoal: `Hotel practice ${randomUUID()}`, interests: ["여행", "직장"],
    correctionMode: "summary", koreanExplanation: "detailed", responseLength: "long", voice: "coral", rate: 0.75, autoplay: true };
  await expect(page.getByText("현재 계정에 비공개로 저장합니다.", { exact: false })).toBeVisible();
  await page.getByLabel("표시 이름", { exact: true }).fill(settings.displayName);
  await page.getByLabel("학습자 레벨").selectOption(settings.learnerLevel);
  await page.getByLabel("하루 학습 목표").selectOption(String(settings.dailyGoal));
  await page.getByLabel("학습 목표", { exact: true }).fill(settings.learningGoal);
  for (const interest of ["여행", "일상", "직장", "학업", "문화"]) {
    await page.getByLabel(`관심 상황 ${interest}`).setChecked(settings.interests.includes(interest));
  }
  await page.getByLabel("교정 방식").selectOption(settings.correctionMode);
  await page.getByLabel("한국어 설명 양").selectOption(settings.koreanExplanation);
  await page.getByLabel("답변 길이").selectOption(settings.responseLength);
  await page.getByLabel("기본 AI 음성").selectOption(settings.voice);
  await page.getByLabel("기본 음성 속도").selectOption(String(settings.rate));
  await page.getByLabel("새 표현 자동 재생").check();
  await page.getByRole("button", { name: "설정 저장", exact: true }).click();
  await expect(page.getByText("학습 설정을 저장했어요.")).toBeVisible();
  const id = await ownerId(page);
  const stored = await adminClient().from("learner_preferences").select("settings").eq("user_id", id).single();
  expect(stored.error).toBeNull();
  expect(stored.data?.settings).toEqual(settings);
  await page.reload();
  await expect(page.getByRole("heading", { name: `${settings.displayName}의 영어 여정` })).toBeVisible();
  await page.getByRole("tab", { name: "설정", exact: true }).click();
  for (const [label, value] of Object.entries({ "표시 이름": settings.displayName, "학습자 레벨": settings.learnerLevel,
    "하루 학습 목표": String(settings.dailyGoal), "학습 목표": settings.learningGoal, "교정 방식": settings.correctionMode,
    "한국어 설명 양": settings.koreanExplanation, "답변 길이": settings.responseLength,
    "기본 AI 음성": settings.voice, "기본 음성 속도": String(settings.rate) })) {
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(value);
  }
  for (const interest of settings.interests) await expect(page.getByLabel(`관심 상황 ${interest}`)).toBeChecked();
  await expect(page.getByLabel("새 표현 자동 재생")).toBeChecked();
});

test("character favorite is shared by discovery, home and profile and removal persists", async ({ page }) => {
  const { id, name, card } = await firstCharacter(page);
  const uid = await ownerId(page);
  await card.getByRole("button", { name: `${name} 즐겨찾기 추가`, exact: true }).click();
  await expect(card.getByRole("button", { name: `${name} 즐겨찾기 해제`, exact: true })).toHaveAttribute("aria-pressed", "true");
  const stored = await adminClient().from("character_favorites").select("character_id").eq("user_id", uid).eq("character_id", id);
  expect(stored.error).toBeNull();
  expect(stored.data).toEqual([{ character_id: id }]);
  await page.goto("/");
  await expect(page.getByTestId("home-favorite-characters")).toContainText(name);
  await page.goto("/profile");
  await page.getByRole("tab", { name: "즐겨찾기", exact: true }).click();
  await expect(page.getByTestId("profile-favorites")).toContainText(name);
  await page.reload();
  await page.getByRole("tab", { name: "즐겨찾기", exact: true }).click();
  await page.getByTestId("profile-favorites").getByRole("button", { name: `${name} 즐겨찾기 해제`, exact: true }).click();
  await expect(page.getByTestId("profile-favorites")).toContainText("아직 즐겨찾는 캐릭터가 없어요.");
  const removed = await adminClient().from("character_favorites").select("character_id").eq("user_id", uid).eq("character_id", id);
  expect(removed.error).toBeNull();
  expect(removed.data).toEqual([]);
  await page.goto("/characters");
  await expect(page.getByTestId(`character-card-${id}`).getByRole("button", { name: `${name} 즐겨찾기 추가`, exact: true })).toHaveAttribute("aria-pressed", "false");
});

test("saved mission restores in profile and unsaving removes its Supabase row", async ({ page }) => {
  const { id, title, card } = await firstMission(page);
  const uid = await ownerId(page);
  await card.getByRole("link", { name: /미션 상세 보기/ }).click();
  await page.getByRole("button", { name: "미션 저장", exact: true }).click();
  await expect(page.getByRole("button", { name: "미션 저장 해제", exact: true })).toHaveAttribute("aria-pressed", "true");
  const stored = await adminClient().from("mission_favorites").select("mission_id").eq("user_id", uid).eq("mission_id", id);
  expect(stored.error).toBeNull();
  expect(stored.data).toEqual([{ mission_id: id }]);
  await page.goto("/profile");
  await page.getByRole("tab", { name: "저장 미션", exact: true }).click();
  await expect(page.getByTestId("profile-saved-missions")).toContainText(title);
  await page.reload();
  await page.getByRole("tab", { name: "저장 미션", exact: true }).click();
  await page.getByTestId("profile-saved-missions").getByRole("button", { name: "미션 저장 해제", exact: true }).click();
  await expect(page.getByTestId("profile-saved-missions")).toContainText("저장된 미션이 아직 없어요.");
  const removed = await adminClient().from("mission_favorites").select("mission_id").eq("user_id", uid).eq("mission_id", id);
  expect(removed.error).toBeNull();
  expect(removed.data).toEqual([]);
  await page.goto(`/missions/${id}`);
  await expect(page.getByRole("button", { name: "미션 저장", exact: true })).toHaveAttribute("aria-pressed", "false");
});

test("discovery searches real catalog content and applies level and category filters", async ({ page }) => {
  const character = await firstCharacter(page);
  const charRow = await adminClient().from("characters").select("name").eq("id", character.id).single();
  expect(charRow.error).toBeNull();
  expect(charRow.data?.name).toBe(character.name);
  await page.getByRole("searchbox", { name: "캐릭터 검색" }).fill(`absent-${randomUUID()}`);
  await expect(page.locator('[data-testid^="character-card-"]')).toHaveCount(0);
  await page.getByRole("searchbox", { name: "캐릭터 검색" }).fill(character.name);
  await expect(page.getByTestId(`character-card-${character.id}`)).toBeVisible();
  const cardText = await page.getByTestId(`character-card-${character.id}`).innerText();
  const level = ["입문", "초급", "중급"].find((candidate) => cardText.includes(candidate));
  expect(level).toBeTruthy();
  await page.getByRole("group", { name: "레벨 필터" }).getByRole("button", { name: level!, exact: true }).click();
  await expect(page.getByTestId(`character-card-${character.id}`)).toBeVisible();
  const otherLevel = ["입문", "초급", "중급"].find((candidate) => candidate !== level)!;
  await page.getByRole("group", { name: "레벨 필터" }).getByRole("button", { name: otherLevel, exact: true }).click();
  await expect(page.getByTestId(`character-card-${character.id}`)).toHaveCount(0);
  const mission = await firstMission(page);
  const missionRow = await adminClient().from("missions").select("title").eq("id", mission.id).single();
  expect(missionRow.error).toBeNull();
  expect(missionRow.data?.title).toBe(mission.title);
  const rawCategory = (await mission.card.locator("span").first().innerText()).trim();
  const category = ({ travel: "여행", daily: "일상", relationship: "관계", work: "업무" } as Record<string, string>)[rawCategory] ?? rawCategory;
  await page.getByRole("searchbox", { name: "미션 검색" }).fill(`absent-${randomUUID()}`);
  await expect(page.locator('[data-testid^="mission-card-"]')).toHaveCount(0);
  await page.getByRole("searchbox", { name: "미션 검색" }).fill(mission.title);
  await page.getByRole("group", { name: "미션 카테고리 필터" }).getByRole("button", { name: category, exact: true }).click();
  await expect(page.getByTestId(`mission-card-${mission.id}`)).toBeVisible();
  const otherCategory = ["여행", "일상", "관계", "업무"].find((candidate) => candidate !== category)!;
  await page.getByRole("group", { name: "미션 카테고리 필터" }).getByRole("button", { name: otherCategory, exact: true }).click();
  await expect(page.getByTestId(`mission-card-${mission.id}`)).toHaveCount(0);
});

test("notebook preserves private snapshots after source deletion without overwriting duplicates", async ({ page, request, createAccount }) => {
  async function assertExpressionCount(count: number) {
    const summary = page.getByTestId("learning-progress");
    const stat = summary.getByRole("article").filter({ has: page.getByRole("heading", { name: "저장한 표현", exact: true }) });
    await expect(stat.getByText(`${count}개`, { exact: true })).toBeVisible();
    const response = await page.request.get("/api/me/progress");
    expect(response.ok()).toBe(true);
    expect((await response.json()).progress.expressionCount).toBe(count);
  }
  await page.goto("/profile");
  await assertExpressionCount(0);
  const character = await firstCharacter(page);
  await page.goto(`/chat/${character.id}`);
  await expect(page.getByRole("textbox", { name: "영어 메시지" })).toBeEnabled();
  const uid = await ownerId(page);
  const conversationId = await page.getByTestId("chat-workspace").getAttribute("data-conversation-id");
  expect(conversationId).toMatch(/^[0-9a-f-]{36}$/);
  // Persist a real user-message fixture through the authenticated API. This tests
  // notebook behavior independently; AI generation is covered in chat.spec.ts.
  const messageId = randomUUID();
  const created = await page.request.post(`/api/conversations/${conversationId}/messages`, {
    headers: { Origin: "http://dodonet.iptime.org:13000" },
    data: { id: messageId, clientMessageId: messageId, parts: [{ type: "text", text: "Could I check in?" }] },
  });
  expect(created.ok(), await created.text()).toBe(true);
  await page.reload();
  const source = page.getByTestId("message-user").filter({ hasText: "Could I check in?" });
  await expect(source).toBeVisible();
  const dialog = page.getByRole("dialog", { name: "복습 기록 저장", exact: true });
  async function save(kind: string, text: string, meaning: string, originalText = "") {
    await source.getByRole("button", { name: "복습 기록 저장", exact: true }).click();
    await dialog.getByLabel("기록 종류").selectOption(kind);
    await dialog.getByLabel("저장할 표현", { exact: true }).fill(text);
    await dialog.getByLabel("뜻 또는 복습 메모").fill(meaning);
    if (kind === "correction") await dialog.getByLabel("교정 전 문장").fill(originalText);
    await dialog.getByRole("button", { name: "복습 기록에 저장", exact: true }).click();
  }
  await save("expression", "Could I check in?", "원래 복습 메모");
  await expect(dialog.getByRole("status")).toContainText("저장했어요");
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await save("expression", "could i check in?", "덮어쓰면 안 되는 메모");
  await expect(dialog.getByRole("status")).toContainText("이미 저장한 기록");
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await save("word", "reservation", "예약");
  await expect(dialog.getByRole("status")).toContainText("저장했어요");
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await save("correction", "Could I check in?", "정중한 요청", "I check in?");
  await expect(dialog.getByRole("status")).toContainText("저장했어요");
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  const rows = await adminClient().from("learning_notebook_entries").select("draft").eq("user_id", uid);
  expect(rows.error).toBeNull();
  expect(rows.data).toHaveLength(3);
  expect(rows.data).toEqual(expect.arrayContaining([
    { draft: expect.objectContaining({ kind: "expression", text: "Could I check in?", meaning: "원래 복습 메모" }) },
    { draft: expect.objectContaining({ kind: "word", text: "reservation" }) },
    { draft: expect.objectContaining({ kind: "correction", originalText: "I check in?" }) },
  ]));
  await page.goto("/profile");
  // Three notebook kinds contain only two distinct expression texts.
  await assertExpressionCount(2);
  await page.getByRole("tab", { name: "학습 표현", exact: true }).click();
  const library = page.getByTestId("profile-expressions");
  await expect(library.getByRole("article")).toHaveCount(3);
  await expect(library).toContainText("원래 복습 메모");
  await expect(library).not.toContainText("덮어쓰면 안 되는 메모");
  await library.getByLabel("복습 기록 필터").selectOption("correction");
  await expect(library.getByRole("article")).toHaveCount(1);
  await expect(library).toContainText("교정 전: I check in?");
  await page.reload();
  await assertExpressionCount(2);
  await page.getByRole("tab", { name: "학습 표현", exact: true }).click();
  await expect(library.getByRole("article")).toHaveCount(3);

  // LEARN-12 / PROFILE-03: deleting the source must preserve the saved snapshot.
  // Purge the test-owned source through the authenticated API, not an admin write.
  const notebookBefore = await page.request.get("/api/me/notebook");
  expect(notebookBefore.ok()).toBe(true);
  const savedNotebook = (await notebookBefore.json()).notebook;
  expect(savedNotebook.entries).toHaveLength(3);
  for (const entry of savedNotebook.entries) {
    expect(entry.draft.source.conversationId).toBe(conversationId);
  }
  const headers = { Origin: "http://dodonet.iptime.org:13000" };
  const removed = await page.request.delete(`/api/conversations/${conversationId}`, { headers });
  expect(removed.ok(), await removed.text()).toBe(true);
  const purged = await page.request.delete(`/api/conversations/${conversationId}?purge=true`, { headers });
  expect(purged.ok(), await purged.text()).toBe(true);
  const sourceRows = await adminClient().from("conversations").select("id").eq("id", conversationId);
  expect(sourceRows.error).toBeNull();
  expect(sourceRows.data).toEqual([]);
  const sourceMessages = await adminClient().from("messages").select("id").eq("conversation_id", conversationId);
  expect(sourceMessages.error).toBeNull();
  expect(sourceMessages.data).toEqual([]);
  const notebookAfter = await page.request.get("/api/me/notebook");
  expect(notebookAfter.ok()).toBe(true);
  expect((await notebookAfter.json()).notebook).toEqual(savedNotebook);
  await page.reload();
  await assertExpressionCount(2);
  await page.getByRole("tab", { name: "학습 표현", exact: true }).click();
  await expect(library.getByRole("article")).toHaveCount(3);
  await expect(library).toContainText("원래 복습 메모");
  await expect(library).toContainText("교정 전: I check in?");
  await expect(library).toContainText("reservation");
  const other = await createAccount();
  await signIn(request, other);
  try {
    const otherNotebook = await request.get("/api/me/notebook");
    expect(otherNotebook.ok()).toBe(true);
    expect((await otherNotebook.json()).notebook.entries).toEqual([]);
    expect((await request.get(`/api/conversations/${conversationId}`)).status()).toBe(404);
  } finally {
    expect((await request.post("/api/auth/logout", { headers })).ok()).toBe(true);
  }
});
