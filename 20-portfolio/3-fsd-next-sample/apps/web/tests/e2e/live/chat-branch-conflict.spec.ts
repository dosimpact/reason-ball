import type { Page } from "@playwright/test";
import { adminClient, expect, test } from "./fixtures";

test("CHAT-06 REF-16 a stale edit checkpoint rejects repeated saves, preserves the draft, and cancel restores the other tab's real turn", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /외우지 말고/ })).toBeVisible();
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  await page.getByRole("button", { name: "새 채팅", exact: true }).click();
  const input = page.getByRole("textbox", { name: "영어 메시지", exact: true });
  await expect(input).toBeEnabled();
  const id = (await page.getByTestId("chat-workspace").getAttribute("data-conversation-id"))!;
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  async function rows() {
    const result = await adminClient().from("messages")
      .select("id,client_message_id,role,status,plain_text,parts,parent_message_id,sequence_number")
      .eq("conversation_id", id).order("sequence_number");
    expect(result.error).toBeNull(); return result.data!;
  }
  async function send(target: Page, text: string, answers: number) {
    await target.getByRole("textbox", { name: "영어 메시지", exact: true }).fill(text);
    const response = target.waitForResponse(result => new URL(result.url()).pathname === "/api/ai/chat" && result.request().method() === "POST");
    await target.getByRole("button", { name: "메시지 보내기", exact: true }).click();
    expect((await response).ok()).toBe(true);
    await expect.poll(async () => (await rows()).filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length, { timeout: 120_000 }).toBe(answers);
    await expect(target.getByRole("button", { name: "메시지 보내기", exact: true })).toBeVisible();
  }
  const original = "Please teach me one short hotel greeting.";
  await send(page, original, 1);
  const before = await rows();
  expect(before).toHaveLength(2);
  const source = before[0];
  const expectedTail = before.at(-1)!.id;
  const tab = await page.context().newPage();
  try {
    await tab.goto(page.url());
    await expect(tab.getByTestId("message-user")).toContainText(original);
    await expect(tab.getByTestId("message-assistant")).toHaveCount(1);
    await page.getByTestId("message-user").hover();
    await page.getByTestId("message-user").getByRole("button", { name: "메시지 편집", exact: true }).click();
    await expect(page.getByRole("button", { name: "수정한 메시지 보내기", exact: true })).toBeVisible();
    await expect(input).toHaveValue(original);
    // Editing only changes this tab's preview; no branch mutation has occurred.
    expect(await rows()).toEqual(before);
    const draft = "My unsaved replacement asks for a short restaurant greeting.";
    await input.fill(draft);
    const concurrent = "Thanks. Please give me one short checkout sentence.";
    await send(tab, concurrent, 2);
    const committed = await rows();
    expect(committed).toHaveLength(4);
    expect(committed.slice(0, 2)).toEqual(before);
    expect(committed[2].plain_text).toBe(concurrent);
    expect(committed.at(-1)!.id).not.toBe(expectedTail);
    let unexpectedGenerations = 0;
    page.on("request", request => {
      if (new URL(request.url()).pathname === "/api/ai/chat" && request.method() === "POST") unexpectedGenerations++;
    });
    const attempts: Array<{ requestId: string; expectedTailId: string; parts: unknown }> = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const patch = page.waitForResponse(response => new URL(response.url()).pathname === `/api/conversations/${id}/messages/${source.id}` && response.request().method() === "PATCH");
      await page.getByRole("button", { name: "수정한 메시지 보내기", exact: true }).click();
      const response = await patch;
      expect(response.status()).toBe(409);
      expect((await response.json()).error.code).toBe("VERSION_CONFLICT");
      attempts.push(response.request().postDataJSON());
      const error = page.getByRole("alert").filter({ hasText: "This resource changed after it was loaded" });
      await expect(error).toBeVisible();
      await expect(input).toHaveValue(draft);
      await expect(page.getByRole("button", { name: "수정한 메시지 보내기", exact: true })).toBeEnabled();
      expect(await rows()).toEqual(committed);
      expect(unexpectedGenerations).toBe(0);
      await error.getByRole("button", { name: "안내 닫기", exact: true }).click();
    }
    expect(attempts[0]).toMatchObject({ expectedTailId: expectedTail, parts: [{ type: "text", text: draft }] });
    expect(attempts[0].requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(attempts[1]).toEqual(attempts[0]);
    const receipt = await adminClient().from("message_branch_requests").select("request_id").eq("request_id", attempts[0].requestId);
    expect(receipt.error).toBeNull();
    expect(receipt.data).toEqual([]);
    await page.getByRole("button", { name: "취소", exact: true }).click();
    await expect(page.getByRole("button", { name: "수정한 메시지 보내기", exact: true })).toHaveCount(0);
    await expect(input).toHaveValue("");
    await expect(page.getByTestId("message-user")).toHaveCount(2);
    await expect(page.getByTestId("message-user").last()).toContainText(concurrent);
    await expect(page.getByTestId("message-assistant")).toHaveCount(2);
    expect(unexpectedGenerations).toBe(0);
    expect(await rows()).toEqual(committed);
    await page.reload();
    await expect(page.getByTestId("message-user").first()).toContainText(original);
    await expect(page.getByTestId("message-user").last()).toContainText(concurrent);
    await expect(page.getByTestId("message-assistant")).toHaveCount(2);
    expect(await rows()).toEqual(committed);
  } finally {
    await tab.close();
  }
});
