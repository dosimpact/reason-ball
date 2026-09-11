import { randomUUID } from "node:crypto";
import { adminClient, expect, test } from "./fixtures";

test.use({ sessionKind: "guest" });

test("guest on external HTTP sends real AI chat and restores its own session and persisted messages", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  await page.getByRole("button", { name: "새 채팅", exact: true }).click();
  await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", /^[0-9a-f-]{36}$/);
  await expect(page.getByRole("textbox", { name: "영어 메시지", exact: true })).toBeEnabled();
  const conversationId = (await page.getByTestId("chat-workspace").getAttribute("data-conversation-id"))!;
  const session = await page.request.get("/api/auth/session");
  expect(session.ok()).toBe(true);
  const { user } = await session.json();
  expect(user.isAnonymous).toBe(true);
  expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
  const phrase = `Please greet me with one short English sentence. Guest marker ${randomUUID()}`;
  await page.getByRole("textbox", { name: "영어 메시지", exact: true }).fill(phrase);
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  async function messages() {
    const result = await adminClient().from("messages").select("id,role,status,author_id,plain_text").eq("conversation_id", conversationId).order("sequence_number");
    expect(result.error).toBeNull();
    return result.data!;
  }
  await expect.poll(async () => (await messages()).some(row => row.role === "user" && row.author_id === user.id && row.plain_text === phrase)).toBe(true);
  await expect.poll(async () => (await messages()).filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length, { timeout: 120_000 }).toBeGreaterThan(0);
  await expect(page.getByTestId("message-assistant").last()).toBeVisible();
  const stored = await messages();
  const conversation = await adminClient().from("conversations").select("owner_id").eq("id", conversationId).single();
  expect(conversation.error).toBeNull();
  expect(conversation.data!.owner_id).toBe(user.id);
  await page.reload();
  await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", conversationId);
  await expect(page.getByTestId("message-user")).toContainText(phrase);
  await expect(page.getByTestId("message-assistant").last()).toBeVisible();
  const restored = await page.request.get("/api/auth/session");
  expect(restored.ok()).toBe(true);
  expect((await restored.json()).user).toMatchObject({ id: user.id, isAnonymous: true });
  expect(await messages()).toEqual(stored);
  // Authenticated anonymous users may reach media validation. Invalid bodies
  // exercise the gate without invoking unavailable image/speech providers.
  for (const path of ["/api/ai/image", "/api/ai/speech"]) {
    const response = await page.request.post(path, { headers: { Origin: "http://dodonet.iptime.org:13000" }, data: {} });
    expect(response.status(), `Guest can reach validation for ${path}`).toBe(400);
    expect((await response.json()).code).toBe("VALIDATION_ERROR");
  }
});
