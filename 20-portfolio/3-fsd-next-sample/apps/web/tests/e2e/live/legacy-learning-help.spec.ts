import { randomUUID } from "node:crypto";
import { adminClient, expect, test } from "./fixtures";

test("LEARN-04 legacy prefixed user IDs can request real correction after reload without changing history", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  await page.getByRole("button", { name: "새 채팅", exact: true }).click();
  await expect(page.getByTestId("chat-input")).toBeEnabled();
  const id = await page.getByTestId("chat-workspace").getAttribute("data-conversation-id");
  const legacyId = `user-${randomUUID()}`;
  const original = "I wants a cup of tea, please.";
  const saved = await page.request.post(`/api/conversations/${id}/messages`, {
    headers: { Origin: "http://dodonet.iptime.org:13000" },
    data: { clientMessageId: legacyId, parts: [{ type: "text", text: original }] },
  });
  expect(saved.ok()).toBe(true);
  const before = await adminClient().from("messages").select("id,client_message_id,role,plain_text").eq("conversation_id", id!);
  expect(before.error).toBeNull();
  expect(before.data).toHaveLength(1);
  await page.reload();
  const user = page.getByTestId("message-user");
  await expect(user).toHaveAttribute("data-message-id", legacyId);
  await page.getByTestId("chat-input").fill("Keep this draft.");
  await user.getByText("학습 도움", { exact: true }).click();
  const generated = page.waitForResponse(response => new URL(response.url()).pathname === "/api/ai/learning-assistance");
  await user.getByRole("button", { name: "문장 교정", exact: true }).click();
  const response = await generated;
  expect(response.ok()).toBe(true);
  const result = await response.json();
  expect(result).toMatchObject({ messageId: before.data![0].id, targetText: original, source: "provider" });
  await expect(user.getByTestId("learning-help-result")).toContainText(result.result.suggestion);
  await expect(page.getByTestId("chat-input")).toHaveValue("Keep this draft.");
  const after = await adminClient().from("messages").select("id,client_message_id,role,plain_text").eq("conversation_id", id!);
  expect(after.error).toBeNull();
  expect(after.data).toEqual(before.data);
});
