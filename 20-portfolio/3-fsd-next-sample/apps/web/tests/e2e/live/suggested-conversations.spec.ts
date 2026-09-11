import { randomUUID } from "node:crypto";
import { test, expect, adminClient } from "./fixtures";

test("REF-05 suggested questions start distinct real conversations and restore a lost creation response after reload", async ({ page, account }) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  await page.getByRole("button", { name: "새 채팅", exact: true }).click();
  const input = page.getByRole("textbox", { name: "영어 메시지", exact: true });
  await expect(input).toBeEnabled();
  const originalUrl = page.url();
  const originalId = (await page.getByTestId("chat-workspace").getAttribute("data-conversation-id"))!;
  const sourceId = randomUUID();
  const source = await page.request.post(`/api/conversations/${originalId}/messages`, {
    headers: { Origin: "http://dodonet.iptime.org:13000" },
    data: { id: sourceId, clientMessageId: sourceId, parts: [{ type: "text", text: "Keep this original conversation." }] },
  });
  expect(source.ok(), await source.text()).toBe(true);
  await page.reload();
  await input.fill("My unfinished original draft.");

  async function ownedConversations() {
    const rows = await adminClient().from("conversations").select("id,character_id,mission_id").eq("owner_id", account!.id);
    expect(rows.error).toBeNull();
    return rows.data!;
  }
  async function messages(id: string) {
    const rows = await adminClient().from("messages").select("id,role,status,plain_text").eq("conversation_id", id).order("sequence_number");
    expect(rows.error).toBeNull();
    return rows.data!;
  }
  const originalMessages = await messages(originalId);
  const recommendations = page.getByRole("region", { name: "추천 질문으로 새 대화", exact: true });
  const firstQuestion = "Let's practice introducing ourselves.";
  const newPosts: string[] = [];
  let aiPosts = 0;
  page.on("request", (request) => {
    if (request.method() !== "POST") return;
    const path = new URL(request.url()).pathname;
    if (path === "/api/conversations") newPosts.push(request.postDataJSON().id);
    if (path === "/api/ai/chat") aiPosts += 1;
  });
  // Two same-task clicks exercise the immediate single-flight guard.
  await recommendations.getByRole("button", { name: firstQuestion, exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(input).toHaveValue(firstQuestion);
  await expect(page.getByTestId("chat-workspace")).not.toHaveAttribute("data-conversation-id", originalId);
  const firstId = (await page.getByTestId("chat-workspace").getAttribute("data-conversation-id"))!;
  expect(newPosts).toEqual([firstId]);
  expect(new URL(page.url()).searchParams.get("conversation")).toBe(firstId);
  expect(await messages(firstId)).toEqual([]);
  expect(aiPosts).toBe(0);
  const afterFirst = await ownedConversations();
  expect(afterFirst).toHaveLength(2);
  expect(new Set(afterFirst.map((row) => row.character_id)).size).toBe(1);
  expect(afterFirst.every((row) => row.mission_id === null)).toBe(true);
  const runs = await adminClient().from("mission_runs").select("id").eq("owner_id", account!.id);
  expect(runs.error).toBeNull(); expect(runs.data).toEqual([]);
  await page.reload();
  await expect(input).toHaveValue(firstQuestion);
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  await expect.poll(async () => (await messages(firstId)).filter((row) => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length, { timeout: 120_000 }).toBe(1);
  expect((await messages(firstId)).filter((row) => row.role === "user").map((row) => row.plain_text)).toEqual([firstQuestion]);
  expect(aiPosts).toBe(1);

  await page.goto(originalUrl);
  await expect(input).toHaveValue("My unfinished original draft.");
  expect(await messages(originalId)).toEqual(originalMessages);
  const secondQuestion = "Could you help me plan my day?";
  let loseResponse = true;
  await page.route("**/api/conversations", async (route) => {
    if (route.request().method() !== "POST" || !loseResponse) return route.continue();
    loseResponse = false;
    const committed = await route.fetch();
    expect(committed.ok()).toBe(true);
    await route.abort("failed");
  });
  await recommendations.getByRole("button", { name: secondQuestion, exact: true }).click();
  await expect(recommendations.getByRole("alert")).toBeVisible();
  await expect(input).toHaveValue("My unfinished original draft.");
  expect(newPosts).toHaveLength(2);
  const lostId = newPosts[1];
  expect(lostId).not.toBe(firstId);
  expect(await ownedConversations()).toHaveLength(3);
  // The row is already real: opening it through its saved URL must allow editing
  // without a later retry from the original conversation replacing that work.
  const lostUrl = new URL(originalUrl);
  lostUrl.searchParams.set("conversation", lostId);
  await page.goto(lostUrl.toString());
  await expect(input).toHaveValue(secondQuestion);
  const revisedQuestion = `${secondQuestion} I have a meeting at noon.`;
  await input.fill(revisedQuestion);
  await page.goto(originalUrl);
  await page.reload();
  await expect(recommendations.getByRole("button", { name: "추천 대화 시작 다시 시도", exact: true })).toBeVisible();
  expect(newPosts).toHaveLength(2);
  await recommendations.getByRole("button", { name: "추천 대화 시작 다시 시도", exact: true }).click();
  await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", lostId);
  await expect(input).toHaveValue(revisedQuestion);
  expect(newPosts).toEqual([firstId, lostId, lostId]);
  expect(await ownedConversations()).toHaveLength(3);
  expect(await messages(lostId)).toEqual([]);
  expect(await messages(originalId)).toEqual(originalMessages);
  expect(aiPosts).toBe(1);
  await page.reload();
  await expect(input).toHaveValue(revisedQuestion);
  await expect(recommendations.getByRole("button", { name: firstQuestion, exact: true })).toBeEnabled();
  await page.goto(originalUrl);
  await expect(input).toHaveValue("My unfinished original draft.");
  await expect(recommendations.getByRole("button", { name: secondQuestion, exact: true })).toBeEnabled();
  await expect(recommendations.getByRole("alert")).toHaveCount(0);
});

test("REF-05 a late creation response does not navigate away from the user's chosen screen", async ({ page, account }) => {
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  await page.getByRole("button", { name: "새 채팅", exact: true }).click();
  const input = page.getByRole("textbox", { name: "영어 메시지", exact: true });
  await expect(input).toBeEnabled();
  const originalUrl = page.url();
  const recommendations = page.getByRole("region", { name: "추천 질문으로 새 대화", exact: true });
  const question = "Let's practice introducing ourselves.";
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  let committed!: (id: string) => void;
  const saved = new Promise<string>((resolve) => { committed = resolve; });
  let hold = true;
  const ids: string[] = [];
  await page.route("**/api/conversations", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    ids.push(route.request().postDataJSON().id);
    if (!hold) return route.continue();
    hold = false;
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    committed((await response.json()).item.id);
    await held;
    await route.fulfill({ response });
  });
  try {
    await recommendations.getByRole("button", { name: question, exact: true }).click();
    const createdId = await saved;
    await page.getByRole("navigation", { name: "주요 메뉴", exact: true }).getByRole("link", { name: "프로필", exact: true }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByTestId("learning-progress")).toBeVisible();
    const loaded = page.waitForResponse((response) => new URL(response.url()).pathname === `/api/conversations/${createdId}/messages` && response.request().method() === "GET");
    release();
    const restored = await loaded;
    expect(restored.ok()).toBe(true);
    await restored.finished();
    // Let the completed fetch's promise and scheduled React work settle.
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page).toHaveURL(/\/profile$/);
    await page.goto(originalUrl);
    await expect(recommendations.getByRole("button", { name: "추천 대화 시작 다시 시도", exact: true })).toBeVisible();
    await recommendations.getByRole("button", { name: "추천 대화 시작 다시 시도", exact: true }).click();
    await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", createdId);
    await expect(input).toHaveValue(question);
    expect(ids).toEqual([createdId, createdId]);
    const rows = await adminClient().from("conversations").select("id").eq("owner_id", account!.id);
    expect(rows.error).toBeNull(); expect(rows.data).toHaveLength(2);
  } finally {
    release();
  }
});
