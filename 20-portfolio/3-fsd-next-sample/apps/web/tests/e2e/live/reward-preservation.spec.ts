import { randomUUID } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import type { MissionCompletionResult } from "../../../src/entities/mission-run";
import { adminClient, expect, signIn, test } from "./fixtures";
const origin = "http://dodonet.iptime.org:13000";
const headers = { Origin: origin };
const authoredPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHmsAAAAASUVORK5CYII=";

async function xp(id: string) {
  const result = await adminClient().from("profiles").select("experience_points").eq("id", id).single();
  expect(result.error).toBeNull();
  return result.data!.experience_points as number;
}

async function seedCharacter(creator: APIRequestContext, publishStatus: 'draft' | 'published' = 'draft') {
  const response = await creator.post('/api/characters', {
    headers: { Origin: origin },
    data: {
      name: `Owned reward character ${randomUUID()}`, role: 'Friendly practice partner', tagline: 'Disposable creator test',
      description: 'A private test character for English practice.', personality: ['다정함'],
      personaGoal: 'Help a learner feel welcome.', learningGoal: 'Practice a short greeting.',
      speakingStyle: 'Short and clear English.', relationship: 'Learning partner',
      teachingStyle: 'Give one gentle correction.', prohibitedInstructions: ['Never request personal data.'],
      accent: 'American', level: '입문', topics: ['일상'], palette: ['#ff8067', '#ffc65c'],
      emoji: '🌱', visibility: 'public', publishStatus, imageUrl: authoredPng,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()).item as { id: string; name: string };
}

// Manual PNG is a real publishing fixture, never evidence of AI image generation.
// Evaluation and completion use the actual text provider and Supabase transactions.
test("REWARD-01/02/03/05/06 PROFILE-04 locked collection becomes earned and survives creator archive without duplicate XP", async ({ page, request, account, createAccount, playwright }) => {
  test.setTimeout(300_000);
  const creatorAccount = await createAccount();
  const creator = await playwright.request.newContext({ baseURL: origin });
  try {
  await signIn(creator, creatorAccount);
  expect(creatorAccount.id).not.toBe(account!.id);
  const character = await seedCharacter(creator, "published");
  const characterId = character.id;
  const beforeXp = await xp(account!.id);
  async function assertCompletedCount(expected: number) {
    const passedRuns = await adminClient().from("mission_runs").select("mission_id").eq("owner_id", account!.id).eq("status", "passed");
    expect(passedRuns.error).toBeNull();
    expect(new Set(passedRuns.data!.map(run => run.mission_id)).size).toBe(expected);
    const stat = page.getByTestId("learning-progress").getByRole("article")
      .filter({ has: page.getByRole("heading", { name: "완료한 미션", exact: true }) });
    await expect(stat.getByText(`${expected}개`, { exact: true })).toBeVisible();
  }
  await page.goto("/profile");
  await assertCompletedCount(0);
  // Explicit manual reward-image fixture through the real publishing API.
  // This verifies completion/Storage plumbing, never AI image generation.
  const mission = await creator.post("/api/missions", { headers, data: {
    title: `Greeting completion ${randomUUID()}`, subtitle: "Introduce yourself politely.", description: "Greet the partner and state a fictional name.",
    category: "일상", location: "Practice cafe", difficulty: "입문", durationMinutes: 3,
    objectives: [{ id: "greeting", label: "Greet and introduce yourself", hint: "Hello, my name is Alex." }],
    steps: [{ id: "greeting", label: "Greet and introduce yourself", hint: "Hello, my name is Alex.", required: true, successCriteria: ["Learner gives a polite greeting", "Learner introduces themselves using a fictional name"] }],
    keyPhrases: [{ english: "Hello, my name is Alex.", korean: "안녕하세요, 제 이름은 알렉스예요." }],
    successThreshold: 70, prerequisites: [], rewardTitle: "Greeting keepsake", rewardPalette: ["#ff8067", "#ffc65c"], rewardEmoji: "🌱",
    rewardImageUrl: authoredPng, recommendedCharacterId: characterId, publishStatus: "published",
  } });
  expect(mission.ok(), `Create published mission with stored fixture: ${mission.status()}`).toBe(true);
  const item = (await mission.json()).item;
  const ownership = await adminClient().from("missions").select("owner_id").eq("id", item.id).single();
  expect(ownership.error).toBeNull();
  expect(ownership.data!.owner_id).toBe(creatorAccount.id);
  await signIn(request, await createAccount());
  expect((await request.get(`/api/uploads/rewards/${item.id}`)).status()).toBe(404);
  expect((await page.request.get(`/api/uploads/rewards/${item.id}`)).status()).toBe(404);
  const privateRequests: string[] = [];
  const rewardAccessRequests: string[] = [];
  page.on("request", request => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.includes("/storage/v1/object/sign/character-private/")) privateRequests.push(pathname);
    if (pathname === `/api/uploads/rewards/${item.id}`) rewardAccessRequests.push(pathname);
  });
  const publicMission = await page.request.get(`/api/missions/${item.id}`);
  expect(publicMission.ok()).toBe(true);
  expect((await publicMission.text()).includes("/storage/v1/object/sign/character-private/")).toBe(false);
  // PROFILE-04: assert the collection itself before acquisition, not only the
  // mission detail's shared reward component. No original fetch while locked.
  await page.goto("/profile");
  await page.getByRole("tab", { name: "보상 컬렉션", exact: true }).click();
  const collectionLocked = page.getByTestId("reward-collection").getByTestId(`reward-${item.id}`);
  async function assertLockedCollection() {
    await expect(collectionLocked).toHaveAttribute("data-reward-state", "locked");
    await expect(collectionLocked.getByRole("img", { name: "잠긴 보상 실루엣", exact: true })).toBeVisible();
    await expect(collectionLocked).toContainText("완료하면 열리는 장면");
    await expect(collectionLocked.locator("..").getByText("아직 잠긴 미션 보상", { exact: true })).toBeVisible();
    await expect(collectionLocked.getByText("해금됨", { exact: true })).toHaveCount(0);
    expect(await collectionLocked.evaluate(element => getComputedStyle(element).backgroundImage)).not.toContain("url(");
    await expect(collectionLocked.locator("..").locator("time")).toHaveCount(0);
    expect(rewardAccessRequests).toEqual([]);
    expect(privateRequests).toEqual([]);
  }
  await assertLockedCollection();
  await page.reload();
  await page.getByRole("tab", { name: "보상 컬렉션", exact: true }).click();
  await assertLockedCollection();
  const beforeUnlocks = await adminClient().from("reward_unlocks").select("id").eq("user_id", account!.id).eq("mission_id", item.id);
  expect(beforeUnlocks.error).toBeNull(); expect(beforeUnlocks.data).toEqual([]);
  await page.goto(`/missions/${item.id}`);
  const locked = page.getByTestId(`reward-${item.id}`);
  await expect(locked).toHaveAttribute("data-reward-state", "locked");
  expect(await locked.getAttribute("style")).not.toContain("/storage/v1/");
  const silhouette = locked.getByRole("img", { name: "잠긴 보상 실루엣", exact: true });
  await expect(silhouette).toBeVisible();
  expect(await silhouette.evaluate(element => element.tagName.toLowerCase())).toBe("svg");
  await expect(silhouette.locator("image, use, [href], [src]")).toHaveCount(0);
  expect(privateRequests).toEqual([]);
  await test.info().attach("locked-reward-silhouette", { body: await locked.screenshot(), contentType: "image/png" });
  const started = page.waitForResponse(response => new URL(response.url()).pathname === "/api/mission-runs" && response.request().method() === "POST");
  await page.getByTestId("start-mission").click();
  expect((await started).ok()).toBe(true);
  const { run } = await (await started).json();
  await page.getByTestId("chat-input").fill("Hello! My name is Alex. It is very nice to meet you today.");
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  await expect.poll(async () => {
    const rows = await adminClient().from("messages").select("id").eq("conversation_id", run.conversationId).eq("role", "assistant").eq("status", "complete");
    expect(rows.error).toBeNull();
    return rows.data?.length;
  }, { timeout: 120_000 }).toBe(1);
  await expect(page.getByTestId("reward-character-reaction")).toHaveCount(0);
  const concurrentCompletions: MissionCompletionResult[] = [];
  await page.route(`**/api/mission-runs/${run.id}/complete`, async route => {
    const body = route.request().postDataJSON();
    // Forward the actual first browser request alongside two identical real callbacks.
    // No completion response, evaluator result, or database write is mocked.
    const responses = await Promise.all([
      route.fetch(),
      page.request.post(`/api/mission-runs/${run.id}/complete`, { headers, data: body }),
      page.request.post(`/api/mission-runs/${run.id}/complete`, { headers, data: body }),
    ]);
    for (const response of responses) {
      expect(response.ok(), `Concurrent completion status ${response.status()}`).toBe(true);
      concurrentCompletions.push((await response.json()).result);
    }
    await route.fulfill({ response: responses[0] });
  }, { times: 1 });
  const evaluated = page.waitForResponse(response => new URL(response.url()).pathname === "/api/ai/evaluate", { timeout: 90_000 });
  const completed = page.waitForResponse(response => new URL(response.url()).pathname === `/api/mission-runs/${run.id}/complete`, { timeout: 90_000 });
  // Attach handler immediately so failed evaluation cannot leave an unhandled timeout.
  const completion = completed.catch(() => null);
  await page.getByRole("button", { name: "미션 마치고 평가받기", exact: true }).click();
  const evaluationResponse = await evaluated;
  expect(evaluationResponse.ok(), `Actual evaluator status ${evaluationResponse.status()}`).toBe(true);
  const evaluation = await evaluationResponse.json();
  expect(evaluation.evaluation.passed).toBe(true);
  expect(evaluation.evaluation.axes.map((axis: { key: string }) => axis.key).sort()).toEqual(["taskCompletion", "comprehensibility", "grammar", "vocabulary", "interaction"].sort());
  const result = await completion;
  expect(result, "Passed evaluation must trigger completion").not.toBeNull();
  expect(result!.ok()).toBe(true);
  const snapshot = (await result!.json()).result;
  expect(snapshot.experiencePointsAwarded).toBeGreaterThan(0);
  expect(concurrentCompletions).toHaveLength(3);
  expect(concurrentCompletions.filter(result => !result.alreadyCompleted)).toHaveLength(1);
  expect(concurrentCompletions.filter(result => result.alreadyCompleted)).toHaveLength(2);
  for (const { alreadyCompleted: replayed, ...confirmed } of concurrentCompletions) {
    expect(typeof replayed).toBe("boolean");
    const { alreadyCompleted: browserReplayed, ...browserConfirmed } = snapshot;
    expect(typeof browserReplayed).toBe("boolean");
    expect(confirmed).toEqual(browserConfirmed);
  }
  const reaction = page.getByTestId("reward-character-reaction");
  await expect(reaction).toBeVisible();
  await expect(reaction).toContainText(character.name);
  await expect(reaction).toHaveAttribute("data-character-id", characterId);
  const reactionText = await reaction.innerText();
  await test.info().attach("confirmed-character-reaction", { body: await reaction.screenshot(), contentType: "image/png" });
  async function conversationMessages() {
    const rows = await adminClient().from("messages").select("id,role,parts").eq("conversation_id", run.conversationId).order("created_at");
    expect(rows.error).toBeNull();
    return rows.data!;
  }
  const messagesBeforeReactionReload = await conversationMessages();
  expect(messagesBeforeReactionReload).toHaveLength(2);
  await page.reload();
  await expect(reaction).toBeVisible();
  await expect(reaction).toHaveText(reactionText, { useInnerText: true });
  expect(await conversationMessages()).toEqual(messagesBeforeReactionReload);
  const firstUnlock = await adminClient().from("reward_unlocks").select("unlocked_at").eq("mission_run_id", run.id).single();
  expect(firstUnlock.error).toBeNull();
  const acquiredAt = firstUnlock.data!.unlocked_at;
  expect(Number.isFinite(Date.parse(acquiredAt))).toBe(true);
  const replay = await page.request.post(`/api/mission-runs/${run.id}/complete`, { headers, data: { evaluationId: evaluation.evaluation.id, rewardId: evaluation.rewardId } });
  expect(replay.ok()).toBe(true);
  expect((await replay.json()).result.alreadyCompleted).toBe(true);
  const rewards = await adminClient().from("reward_unlocks").select("id,user_id,mission_evaluation_id,unlocked_at").eq("mission_run_id", run.id);
  expect(rewards.error).toBeNull();
  expect(rewards.data).toEqual([expect.objectContaining({ user_id: account!.id, mission_evaluation_id: evaluation.evaluation.id, unlocked_at: acquiredAt })]);

  expect(await xp(account!.id)).toBe(beforeXp + snapshot.experiencePointsAwarded);
  const unlockResponse = await page.request.get(`/api/uploads/rewards/${item.id}`);
  expect(unlockResponse.ok()).toBe(true);
  const unlocked = (await unlockResponse.json()).reward;
  expect(unlocked.unlockedAt).toBe(acquiredAt);
  expect(unlocked.assetId).toMatch(/^[0-9a-f-]{36}$/);
  const original = await page.request.get(unlocked.url);
  expect(original.ok()).toBe(true);
  expect(await original.body()).toEqual(Buffer.from(authoredPng.split(",")[1], "base64"));
  expect((await request.get(`/api/uploads/rewards/${item.id}`)).status()).toBe(404);
  const initialEarnedResponse = await page.request.get("/api/me/earned-rewards");
  expect(initialEarnedResponse.ok()).toBe(true);
  expect((await initialEarnedResponse.json()).items).toEqual([{ id: item.id, unlockId: unlocked.unlockId, unlockedAt: acquiredAt, title: item.title, metadataSource: "published-version" }]);
  const originalPath = new URL(unlocked.url).pathname;
  const galleryImage = () => page.waitForResponse(response => response.request().resourceType() === "image" && new URL(response.url()).pathname === originalPath);
  const initialGalleryImage = galleryImage();
  await page.goto("/profile");
  await assertCompletedCount(1);
  await page.getByRole("tab", { name: "보상 컬렉션", exact: true }).click();
  const gallery = page.getByTestId(`reward-${item.id}`);
  await expect(gallery).toHaveAttribute("data-reward-state", "ready");
  await expect(gallery).toContainText("해금됨");
  async function assertGalleryOriginal(imageResponse: Awaited<ReturnType<typeof galleryImage>>) {
    expect(imageResponse.ok()).toBe(true);
    expect(await imageResponse.body()).toEqual(Buffer.from(authoredPng.split(",")[1], "base64"));
    await expect(gallery.locator("..").getByText(item.title, { exact: true })).toBeVisible();
    const acquisition = gallery.locator("..").getByTestId(`reward-acquired-${item.id}`);
    await expect(acquisition).toHaveAttribute("datetime", acquiredAt);
    const koreanDate = new Date(Date.parse(acquiredAt) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10).replaceAll("-", ". ");
    await expect(acquisition).toHaveText(`${koreanDate}. (한국 시간)`);
    await expect(acquisition.locator("..")).toContainText("획득일");
    await expect(gallery.getByRole("img", { name: "잠긴 보상 실루엣", exact: true })).toHaveCount(0);
    await expect(gallery.locator("..").getByText("아직 잠긴 미션 보상", { exact: true })).toHaveCount(0);
    const background = await gallery.evaluate(element => getComputedStyle(element).backgroundImage);
    expect(background).toContain(originalPath);
    // Decode the exact visible background URL, rather than trusting ready state alone.
    const dimensions = await gallery.evaluate(async element => {
      const url = getComputedStyle(element).backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
      if (!url) return null;
      const image = new Image();
      image.src = url;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    });
    expect(dimensions).toEqual({ width: 1, height: 1 });
  }
  await assertGalleryOriginal(await initialGalleryImage);
  // Archive only this fixture's owned resources through their actual lifecycle APIs.
  for (const [kind, id] of [["missions", item.id], ["characters", characterId]]) {
    const archived = await creator.patch(`/api/${kind}/${id}`, { headers, data: { action: "archive" } });
    expect(archived.ok(), `Archive owned ${kind}: ${archived.status()}`).toBe(true);
  }
  const restoredAccess = await page.request.get(`/api/uploads/rewards/${item.id}`);
  expect(restoredAccess.ok()).toBe(true);
  const restored = (await restoredAccess.json()).reward;
  expect(restored.assetId).toBe(unlocked.assetId);
  expect(restored.unlockId).toBe(unlocked.unlockId);
  expect(restored.unlockedAt).toBe(acquiredAt);
  const preservedOriginal = await page.request.get(restored.url);
  expect(preservedOriginal.ok()).toBe(true);
  expect(await preservedOriginal.body()).toEqual(await original.body());
  expect((await request.get(`/api/uploads/rewards/${item.id}`)).status()).toBe(404);
  const earnedResponse = await page.request.get("/api/me/earned-rewards");
  expect(earnedResponse.ok()).toBe(true);
  const earned = (await earnedResponse.json()).items;
  expect(earned).toEqual([{ id: item.id, unlockId: unlocked.unlockId, unlockedAt: acquiredAt, title: item.title, metadataSource: "published-version" }]);
  const outsiders = await request.get("/api/me/earned-rewards");
  expect(outsiders.ok()).toBe(true);
  expect((await outsiders.json()).items).toEqual([]);
  // The reward collection must not make archived discovery content public again.
  expect((await page.request.get(`/api/missions/${item.id}`)).status()).toBe(404);
  const archivedGalleryImage = galleryImage();
  await page.reload();
  await assertCompletedCount(1);
  await page.getByRole("tab", { name: "보상 컬렉션", exact: true }).click();
  await expect(gallery).toHaveAttribute("data-reward-state", "ready");
  await expect(gallery).toContainText("해금됨");
  await assertGalleryOriginal(await archivedGalleryImage);
  expect(await xp(account!.id)).toBe(beforeXp + snapshot.experiencePointsAwarded);
  const remaining = await adminClient().from("reward_unlocks").select("id,unlocked_at").eq("user_id", account!.id).eq("mission_id", item.id);
  expect(remaining.error).toBeNull();
  expect(remaining.data).toEqual([{ id: unlocked.unlockId, unlocked_at: acquiredAt }]);
  // DISC-01: a positive, actually awarded balance must reach the home summary.
  // The activity-only case separately checks zero XP and positive minutes/streak.
  const earnedXp = await xp(account!.id);
  expect(earnedXp).toBeGreaterThan(0);
  const homeXp = page.getByTestId("home-learning-summary").getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "쌓은 경험치", exact: true }) }).locator("p").first();
  await page.goto("/");
  await expect(homeXp).toHaveText(`${earnedXp.toLocaleString()} XP`);
  await page.reload();
  await expect(homeXp).toHaveText(`${earnedXp.toLocaleString()} XP`);
  expect(await xp(account!.id)).toBe(earnedXp);
  } finally {
    await request.post("/api/auth/logout", { headers });
    await creator.post("/api/auth/logout", { headers });
    await creator.dispose();
  }
});
