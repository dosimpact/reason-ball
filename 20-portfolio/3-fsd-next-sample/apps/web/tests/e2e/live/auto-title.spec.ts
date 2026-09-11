import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { adminClient, expect, test } from "./fixtures";

const headers = { Origin: "http://dodonet.iptime.org:13000" };
async function openChat(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  await page.getByRole("button", { name: "새 채팅", exact: true }).click();
  await expect(page.getByTestId("chat-input")).toBeEnabled();
  const id = (await page.getByTestId("chat-workspace").getAttribute("data-conversation-id"))!;
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  return id;
}
async function stored(id: string) {
  const result = await adminClient().from("conversations").select("title,title_source").eq("id", id).single();
  expect(result.error).toBeNull(); return result.data!;
}
async function rows(id: string) {
  const result = await adminClient().from("messages").select("id,role,status,plain_text").eq("conversation_id", id).order("sequence_number");
  expect(result.error).toBeNull(); return result.data!;
}
async function rename(page: Page, title: string) {
  await page.getByRole("button", { name: "대화 관리", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "대화 관리", exact: true });
  await dialog.getByLabel("대화 제목").fill(title);
  await dialog.getByRole("button", { name: "제목 저장", exact: true }).click();
  await expect(dialog).not.toBeVisible();
}
async function send(page: Page, id: string, text: string, count: number) {
  await page.getByTestId("chat-input").fill(text);
  const generated = page.waitForResponse(response => new URL(response.url()).pathname === "/api/ai/chat" && response.request().method() === "POST");
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  const response = await generated;
  expect(response.ok()).toBe(true);
  expect(response.headers()["x-ai-provider"]).not.toBe("mock");
  await expect.poll(async () => (await rows(id)).filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length, { timeout: 120_000 }).toBe(count);
  await expect(page.getByRole("button", { name: "메시지 보내기", exact: true })).toBeVisible();
}

test("REF-17 first real user turn titles the live header and history; manual rename survives later generation, regeneration and clear", async ({ page }) => {
  test.setTimeout(300_000);
  const id = await openChat(page);
  expect((await stored(id)).title_source).toBe("pending");
  const prompt = "Please teach me one polite hotel greeting in a short sentence.";
  await send(page, id, prompt, 1);
  await expect.poll(() => stored(id)).toEqual({ title: prompt, title_source: "auto" });
  // This assertion intentionally precedes any navigation/reload: terminal refresh must update the open header.
  await expect(page.getByTestId("conversation-title")).toHaveText(prompt);
  await page.getByRole("link", { name: "대화 기록", exact: true }).first().click();
  const history = page.getByTestId("persisted-history").filter({ hasText: prompt });
  await expect(history).toBeVisible();
  await history.getByRole("link", { name: "이어서 대화", exact: true }).click();
  await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", id);
  await page.reload();
  await expect(page.getByTestId("conversation-title")).toHaveText(prompt);
  const manual = `My own title ${randomUUID()}`;
  await rename(page, manual);
  await expect.poll(() => stored(id)).toEqual({ title: manual, title_source: "manual" });
  await send(page, id, "Please give one shorter alternative.", 2);
  expect(await stored(id)).toEqual({ title: manual, title_source: "manual" });
  const oldAssistant = (await rows(id)).filter(row => row.role === "assistant").at(-1)!.id;
  const assistant = page.getByTestId("message-assistant").last();
  await assistant.hover();
  await assistant.getByRole("button", { name: "답변 다시 생성", exact: true }).click();
  await expect.poll(async () => (await rows(id)).some(row => row.id === oldAssistant)).toBe(false);
  await expect.poll(async () => (await rows(id)).filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length, { timeout: 120_000 }).toBe(2);
  await expect(page.getByRole("button", { name: "메시지 보내기", exact: true })).toBeVisible();
  expect(await stored(id)).toEqual({ title: manual, title_source: "manual" });
  await page.getByTestId("chat-input").fill("/clear");
  await page.getByTestId("chat-input").press("Enter");
  await page.getByRole("dialog", { name: "메시지를 초기화할까요?" }).getByRole("button", { name: "메시지 초기화 확인" }).click();
  await expect.poll(() => rows(id)).toEqual([]);
  await page.reload();
  await expect(page.getByTestId("conversation-title")).toHaveText(manual);
  expect(await stored(id)).toEqual({ title: manual, title_source: "manual" });
});

test("REF-17 title provenance protects explicit placeholders and normalizes first multipart Unicode text or attachment-only content", async ({ page }) => {
  const id = await openChat(page);
  const placeholder = (await stored(id)).title;
  expect((await stored(id)).title_source).toBe("pending");
  await rename(page, placeholder);
  await expect.poll(() => stored(id)).toEqual({ title: placeholder, title_source: "manual" });
  async function append(conversationId: string, parts: unknown[], clientMessageId = randomUUID()) {
    const response = await page.request.post(`/api/conversations/${conversationId}/messages`, { headers, data: { clientMessageId, parts } });
    expect(response.ok()).toBe(true);
    return clientMessageId;
  }
  await append(id, [{ type: "text", text: "The first real saved message must not replace an explicitly saved placeholder." }]);
  expect(await stored(id)).toEqual({ title: placeholder, title_source: "manual" });
  const catalog = await page.request.get("/api/characters");
  expect(catalog.ok()).toBe(true);
  const characterId = (await catalog.json()).items[0].id;
  async function create(titleMode?: "auto") {
    const response = await page.request.post("/api/conversations", { headers, data: { characterId, title: placeholder, ...(titleMode ? { titleMode } : {}) } });
    expect(response.ok()).toBe(true); return (await response.json()).item.id as string;
  }
  const explicit = await create();
  await append(explicit, [{ type: "text", text: "External explicit titles are manual without an auto mode." }]);
  expect(await stored(explicit)).toEqual({ title: placeholder, title_source: "manual" });
  const auto = await create("auto");
  expect((await stored(auto)).title_source).toBe("pending");
  const first = "  Hello\t  world\n";
  const second = `  ${"🙂한".repeat(50)} ending  `;
  const parts = [{ type: "text", text: first }, { type: "text", text: second }];
  const expected = Array.from(`${first}\n${second}`.replace(/\s+/g, " ").trim()).slice(0, 80).join("");
  const clientMessageId = await append(auto, parts);
  expect(await stored(auto)).toEqual({ title: expected, title_source: "auto" });
  await append(auto, parts, clientMessageId);
  expect(await rows(auto)).toHaveLength(1);
  await append(auto, [{ type: "text", text: "A later message cannot change the original automatic title." }]);
  expect(await stored(auto)).toEqual({ title: expected, title_source: "auto" });
  const attached = await create("auto");
  const uploaded = await page.request.post(`/api/conversations/${attached}/attachments`, { headers, data: { filename: "title-fixture.png", dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHmsAAAAASUVORK5CYII=" } });
  expect(uploaded.ok()).toBe(true);
  // The app API requires a text part; blank text contributes no title content.
  await append(attached, [{ type: "text", text: " \n " }, (await uploaded.json()).file]);
  expect(await stored(attached)).toEqual({ title: "첨부파일 대화", title_source: "auto" });
  await page.reload();
  await expect(page.getByTestId("conversation-title")).toHaveText(placeholder);
  expect(await stored(id)).toEqual({ title: placeholder, title_source: "manual" });
});


test("REF-17 concurrent owner HTTP message and rename preserve manual provenance; competing first messages title only once", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  const createdIds: string[] = [];
  // Use the real published catalog, independent of conversation DTO nesting.
  const catalog = await page.request.get("/api/characters");
  expect(catalog.ok()).toBe(true);
  const characterId = (await catalog.json()).items[0].id;
  async function create() {
    const response = await page.request.post("/api/conversations", {
      headers, data: { characterId, title: "Concurrent first message", titleMode: "auto" },
    });
    expect(response.ok()).toBe(true);
    const id = (await response.json()).item.id as string;
    createdIds.push(id);
    expect((await stored(id)).title_source).toBe("pending");
    return id;
  }
  function append(id: string, text: string) {
    return page.request.post(`/api/conversations/${id}/messages`, {
      headers, data: { clientMessageId: randomUUID(), parts: [{ type: "text", text }] },
    });
  }
  const aiRequests: string[] = [];
  page.on("request", request => {
    if (request.method() === "POST" && new URL(request.url()).pathname.startsWith("/api/ai/")) aiRequests.push(request.url());
  });
  // These are concurrent real HTTP transactions, not proof of a particular SQL lock/wait schedule.
  for (const order of ["message-first", "rename-first"] as const) {
    const id = await create();
    const manual = `Explicit concurrent title ${order}`;
    const text = `User-authored concurrent message ${order}`;
    const message = () => append(id, text);
    const renameRequest = () => page.request.patch(`/api/conversations/${id}`, {
      headers, data: { action: "update", title: manual },
    });
    const responses = await Promise.all(order === "message-first"
      ? [message(), renameRequest()]
      : [renameRequest(), message()]);
    for (const response of responses) expect(response.ok(), `Concurrent ${order}: ${response.status()}`).toBe(true);
    expect(await stored(id)).toEqual({ title: manual, title_source: "manual" });
    expect(await rows(id)).toEqual([expect.objectContaining({ role: "user", status: "complete", plain_text: text })]);
  }
  const id = await create();
  const candidates = ["First concurrent hotel greeting", "Second concurrent restaurant greeting"];
  const responses = await Promise.all(candidates.map(text => append(id, text)));
  for (const response of responses) expect(response.ok(), `Concurrent messages: ${response.status()}`).toBe(true);
  const firstTitle = await stored(id);
  expect(firstTitle.title_source).toBe("auto");
  expect(candidates).toContain(firstTitle.title);
  const persisted = await rows(id);
  expect(persisted).toHaveLength(2);
  expect(persisted.map(row => row.plain_text).sort()).toEqual([...candidates].sort());
  expect(persisted.every(row => row.role === "user" && row.status === "complete")).toBe(true);
  const later = await append(id, "A third later message must not replace either winning first title.");
  expect(later.ok()).toBe(true);
  expect(await stored(id)).toEqual(firstTitle);
  expect(await rows(id)).toHaveLength(3);
  expect(aiRequests).toEqual([]);
  const generations = await adminClient().from("chat_generations").select("conversation_id").in("conversation_id", createdIds);
  expect(generations.error).toBeNull();
  expect(generations.data).toEqual([]);
});
