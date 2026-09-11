import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { adminClient, expect, signIn, test } from "./fixtures";

const uuid = /^[0-9a-f-]{36}$/;

test.setTimeout(240_000);

async function openChat(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /외우지 말고/ })).toBeVisible();
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  await page.getByRole("button", { name: "새 채팅", exact: true }).click();
}

async function conversationId(page: Page) {
  await expect(page.getByRole("textbox", { name: "영어 메시지" })).toBeEnabled();
  await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", uuid);
  return (await page.getByTestId("chat-workspace").getAttribute("data-conversation-id"))!;
}

async function rows(id: string) {
  const result = await adminClient().from("messages").select("id, role, status, plain_text").eq("conversation_id", id).order("sequence_number");
  expect(result.error).toBeNull();
  return result.data!;
}

async function send(page: Page, text: string, id: string) {
  await page.getByRole("textbox", { name: "영어 메시지" }).fill(text);
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  await expect.poll(async () => (await rows(id)).some(row => row.role === "user" && row.plain_text === text)).toBe(true);
  await expect.poll(async () => (await rows(id)).filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length, { timeout: 120_000 }).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "메시지 보내기", exact: true })).toBeVisible();
}

async function command(page: Page, text: string) {
  await page.getByRole("textbox", { name: "영어 메시지" }).fill(text);
  await page.getByRole("textbox", { name: "영어 메시지" }).press("Enter");
}

test("new chat button and keyboard create distinct owned DB conversations and restore on reload", async ({ page, account }) => {
  await openChat(page);
  const first = await conversationId(page);
  await page.reload();
  expect(await conversationId(page)).toBe(first);
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  await page.keyboard.press("Control+Shift+O");
  await expect(page.getByTestId("chat-workspace")).not.toHaveAttribute("data-conversation-id", first);
  const second = await conversationId(page);
  const stored = await adminClient().from("conversations").select("id, owner_id").in("id", [first, second]);
  expect(stored.error).toBeNull();
  expect(stored.data).toHaveLength(2);
  expect(stored.data?.every(row => row.owner_id === account!.id)).toBe(true);
  await page.reload();
  expect(await conversationId(page)).toBe(second);
});

test("rename and history restore a private conversation; share opens read-only in a second browser", async ({ page, browser, createAccount }) => {
  await openChat(page);
  const id = await conversationId(page);
  const phrase = `Please greet me briefly. Practice marker ${randomUUID()}`;
  await send(page, phrase, id);
  const title = `Live conversation ${randomUUID()}`;
  await page.getByRole("button", { name: "대화 관리", exact: true }).click();
  const manage = page.getByRole("dialog", { name: "대화 관리" });
  await manage.getByLabel("대화 제목").fill(title);
  await manage.getByRole("button", { name: "제목 저장" }).click();
  await expect.poll(async () => {
    const result = await adminClient().from("conversations").select("title").eq("id", id).single();
    expect(result.error).toBeNull();
    return result.data?.title;
  }).toBe(title);
  await page.goto("/history");
  const history = page.getByTestId("persisted-history").filter({ hasText: title });
  await expect(history).toBeVisible();
  await history.getByRole("link", { name: "이어서 대화" }).click();
  expect(await conversationId(page)).toBe(id);
  await expect(page.getByTestId("message-user")).toContainText(phrase);
  const other = await browser.newContext({ baseURL: "http://dodonet.iptime.org:13000" });
  try {
    await signIn(other.request, await createAccount());
    const denied = await other.request.get(`/api/conversations/${id}`);
    expect([403, 404]).toContain(denied.status());
    await page.getByRole("button", { name: "대화 공유", exact: true }).click();
    const href = await page.getByRole("dialog", { name: "대화 공유" }).getByRole("link", { name: "읽기 전용 화면 열기" }).getAttribute("href");
    expect(href).toMatch(/^\/shared\//);
    const viewer = await other.newPage();
    await viewer.goto(href!);
    await expect(viewer.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(viewer.getByLabel("공유된 메시지")).toContainText(phrase);
    await expect(viewer.getByRole("textbox", { name: "영어 메시지" })).toHaveCount(0);
    await viewer.reload();
    await expect(viewer.getByLabel("공유된 메시지")).toContainText(phrase);
  } finally { await other.close(); }
});

test("real AI send, edit and regeneration persist a single user turn across reloads", async ({ page }) => {
  test.setTimeout(300_000);
  await openChat(page);
  const id = await conversationId(page);
  await send(page, "Please greet me in one short sentence.", id);
  await page.getByTestId("message-user").hover();
  await page.getByTestId("message-user").getByRole("button", { name: "메시지 편집" }).click();
  const edited = "Please greet a hotel guest in one short sentence.";
  await page.getByRole("textbox", { name: "영어 메시지" }).fill(edited);
  await page.getByRole("button", { name: "수정한 메시지 보내기" }).click();
  await expect.poll(async () => (await rows(id)).filter(row => row.role === "user").map(row => row.plain_text)).toEqual([edited]);
  await expect.poll(async () => (await rows(id)).filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length, { timeout: 120_000 }).toBe(1);
  await expect(page.getByRole("button", { name: "메시지 보내기", exact: true })).toBeVisible({ timeout: 120_000 });
  const answer = page.getByTestId("message-assistant").last();
  await answer.hover();
  const regenerated = page.waitForResponse(response => response.url().includes("/regenerate") && response.request().method() === "POST");
  await answer.getByRole("button", { name: "답변 다시 생성" }).click();
  expect((await regenerated).ok()).toBe(true);
  await expect.poll(async () => (await rows(id)).filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length, { timeout: 120_000 }).toBe(1);
  await expect(page.getByRole("button", { name: "메시지 보내기", exact: true })).toBeVisible({ timeout: 120_000 });
  const saved = await rows(id);
  expect(saved.filter(row => row.role === "user")).toHaveLength(1);
  expect(saved.filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim())).toHaveLength(1);
  await page.reload();
  expect(await conversationId(page)).toBe(id);
  await expect(page.getByTestId("message-user")).toHaveCount(1);
  await expect(page.getByTestId("message-user")).toContainText(edited);
  await expect(page.getByTestId("message-assistant").last()).toContainText(saved.find(row => row.role === "assistant")!.plain_text);
});

test("clear, delete and purge require confirmation and durably remove only the test account's conversations", async ({ page, account }) => {
  await openChat(page);
  const first = await conversationId(page);
  await send(page, "Please say hello briefly.", first);
  await command(page, "/clear");
  const clear = page.getByRole("dialog", { name: "메시지를 초기화할까요?" });
  await clear.getByRole("button", { name: "취소", exact: true }).click();
  expect((await rows(first)).some(row => row.role === "user")).toBe(true);
  await command(page, "/clear");
  await clear.getByRole("button", { name: "메시지 초기화 확인" }).click();
  await expect.poll(async () => (await rows(first)).filter(row => row.role === "user").length).toBe(0);
  await page.reload();
  expect(await conversationId(page)).toBe(first);
  await expect(page.getByTestId("message-user")).toHaveCount(0);
  await command(page, "/new");
  await expect(page.getByTestId("chat-workspace")).not.toHaveAttribute("data-conversation-id", first);
  const second = await conversationId(page);
  await command(page, "/delete");
  const deletion = page.getByRole("dialog", { name: "이 대화를 삭제할까요?" });
  await deletion.getByRole("button", { name: "취소", exact: true }).click();
  expect(await conversationId(page)).toBe(second);
  await command(page, "/delete");
  await deletion.getByRole("button", { name: "대화 삭제 확인" }).click();
  await expect.poll(async () => (await page.request.get(`/api/conversations/${second}`)).status()).toBe(404);
  const third = await conversationId(page);
  await command(page, "/purge");
  const purge = page.getByRole("dialog", { name: "모든 대화를 삭제할까요?" });
  const confirm = purge.getByRole("button", { name: "모든 대화 삭제 확인" });
  await expect(confirm).toBeDisabled();
  await purge.getByLabel("모든 대화 삭제 확인 문구").fill("DELETE ALL");
  await confirm.click();
  await expect(purge).not.toBeVisible();
  // Purge opens a fresh empty chat; only previously existing conversations must disappear.
  await expect(page.getByTestId("chat-workspace")).not.toHaveAttribute("data-conversation-id", third);
  const fresh = await conversationId(page);
  expect([first, second, third]).not.toContain(fresh);
  expect(await rows(fresh)).toHaveLength(0);
  await page.goto("/history");
  for (const removed of [first, second, third]) {
    await expect(page.locator(`[href*="conversation=${removed}"]`)).toHaveCount(0);
  }
  await expect.poll(async () => {
    const result = await adminClient().from("conversations").select("id").eq("owner_id", account!.id).in("id", [first, second, third]).neq("status", "deleted");
    expect(result.error).toBeNull();
    return result.data?.length;
  }).toBe(0);
});


test("CHAT-03/06 middle-turn edit preserves earlier DB messages and replaces the entire later branch", async ({ page }) => {
  test.setTimeout(300_000);
  await openChat(page);
  const id = await conversationId(page);
  const prompts = [
    "Please greet me in one short sentence. My name is Alex.",
    "I would like tea. Acknowledge in one short sentence.",
    "I will pay cash. Acknowledge in one short sentence.",
  ];
  // Count each completed turn: an earlier answer must not satisfy the next wait.
  for (const [index, prompt] of prompts.entries()) {
    await page.getByRole("textbox", { name: "영어 메시지" }).fill(prompt);
    await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
    await expect.poll(async () => (await rows(id)).filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length, { timeout: 120_000 }).toBe(index + 1);
    await expect(page.getByRole("button", { name: "메시지 보내기", exact: true })).toBeVisible();
    await expect(page.getByTestId("message-user")).toHaveCount(index + 1);
  }
  const before = await rows(id);
  expect(before).toHaveLength(6);
  expect(before.map(row => row.role)).toEqual(["user", "assistant", "user", "assistant", "user", "assistant"]);
  const earlier = before.slice(0, 2);
  const removedIds = before.slice(2).map(row => row.id);
  const middle = page.getByTestId("message-user").nth(1);
  await middle.hover();
  await middle.getByRole("button", { name: "메시지 편집" }).click();
  const edited = "I would like coffee instead of tea. Acknowledge in one short sentence.";
  await page.getByRole("textbox", { name: "영어 메시지" }).fill(edited);
  const branchResponse = page.waitForResponse(response => response.request().method() === "PATCH" && new URL(response.url()).pathname.startsWith(`/api/conversations/${id}/messages/`));
  await page.getByRole("button", { name: "수정한 메시지 보내기" }).click();
  expect((await branchResponse).ok()).toBe(true);
  await expect.poll(async () => (await rows(id)).filter(row => row.role === "user").map(row => row.plain_text)).toEqual([prompts[0], edited]);
  await expect.poll(async () => (await rows(id)).filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length, { timeout: 120_000 }).toBe(2);
  await expect(page.getByRole("button", { name: "메시지 보내기", exact: true })).toBeVisible();
  const after = await rows(id);
  expect(after).toHaveLength(4);
  expect(after.slice(0, 2)).toEqual(earlier);
  expect(after.slice(2).every(row => !removedIds.includes(row.id))).toBe(true);
  const removed = await adminClient().from("messages").select("id").in("id", removedIds);
  expect(removed.error).toBeNull();
  expect(removed.data).toEqual([]);
  await expect(page.getByTestId("message-user")).toHaveCount(2);
  await expect(page.getByTestId("message-user").nth(1)).toContainText(edited);
  await expect(page.getByTestId("message-user").filter({ hasText: prompts[2] })).toHaveCount(0);
  await page.reload();
  expect(await conversationId(page)).toBe(id);
  await expect(page.getByTestId("message-user")).toHaveCount(2);
  await expect(page.getByTestId("message-assistant")).toHaveCount(2);
  await expect(page.getByTestId("message-user").first()).toContainText(prompts[0]);
  await expect(page.getByTestId("message-user").nth(1)).toContainText(edited);
  await expect(page.getByTestId("message-assistant").first()).toContainText(earlier[1].plain_text);
  await expect(page.getByTestId("message-assistant").last()).toContainText(after[3].plain_text);
  expect(await rows(id)).toEqual(after);
});
