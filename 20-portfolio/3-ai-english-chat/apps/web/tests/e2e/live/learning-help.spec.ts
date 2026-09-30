import type { Locator } from "@playwright/test";
import { adminClient, expect, test } from "./fixtures";
import { assistanceResponseSchema } from "../../../src/entities/learning-assistance/model/assistance";

// LEARN-04/06: actual provider correction/rephrase/reply and non-destructive use.
test("LEARN-04/06 NFR-10 real correction, simpler text and reply help preserve original messages and unsent draft", async ({ page }) => {
  test.setTimeout(360_000);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /외우지 말고/ })).toBeVisible();
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  await page.getByRole("button", { name: "새 채팅", exact: true }).click();
  const input = page.getByRole("textbox", { name: "영어 메시지", exact: true });
  await expect(input).toBeEnabled();
  const id = await page.getByTestId("chat-workspace").getAttribute("data-conversation-id");
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  await input.fill("I wants to check in. Please answer in one short sentence.");
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  async function storedMessages() {
    const result = await adminClient().from("messages").select("id,client_message_id,role,status,plain_text")
      .eq("conversation_id", id!).order("sequence_number");
    expect(result.error).toBeNull();
    return result.data!;
  }
  await expect.poll(async () => (await storedMessages()).filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length,
    { timeout: 120_000 }).toBe(1);
  await expect(page.getByRole("button", { name: "메시지 보내기", exact: true })).toBeVisible();
  const original = await storedMessages();
  expect(original.filter(row => row.role === "user")).toHaveLength(1);
  const draft = "Keep this unsent next sentence.";
  await input.fill(draft);

  async function requestHelp(message: Locator, mode: "correction" | "rephrase" | "reply", buttonName: string) {
    const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === "/api/ai/learning-assistance"
      && response.request().method() === "POST", { timeout: 120_000 });
    await message.getByRole("button", { name: buttonName, exact: true }).click();
    const response = await responsePromise;
    expect(response.ok(), await response.text()).toBe(true);
    const body = assistanceResponseSchema.parse(await response.json());
    expect(body.source).toBe("provider");
    expect(body.mode).toBe(mode);
    expect(body.result.suggestion).toMatch(/[A-Za-z]/);
    expect(body.result.suggestion).not.toMatch(/[가-힣]/);
    expect(body.result.brief).toMatch(/[가-힣]/);
    expect(body.result.explanation).toMatch(/[가-힣]/);
    expect(Object.keys(response.request().postDataJSON()).sort()).toEqual(["conversationId", "messageId", "mode"]);
    const messageId = await message.getAttribute("data-message-id");
    expect(body.messageId).toBe(messageId);
    expect(body.targetText).toBe(original.find(row => row.id === messageId || row.client_message_id === messageId)!.plain_text.trim());
    const result = message.getByTestId("learning-help-result");
    await expect(result).toContainText(body.result.suggestion);
    await expect(result).toContainText(body.result.brief);
    await expect(result.getByText(body.result.suggestion, { exact: true })).toHaveAttribute("lang", "en");
    await expect(result.getByText(body.result.brief, { exact: true })).toHaveAttribute("lang", "ko");
    await expect(result).toContainText("AI 생성 도움말");
    if (await result.locator("details").getAttribute("open") === null) {
      await result.getByText("자세한 설명", { exact: true }).click();
    }
    await expect(result.getByText(body.result.explanation, { exact: true })).toBeVisible();
    await expect(result.getByText(body.result.explanation, { exact: true })).toHaveAttribute("lang", "ko");
    expect(await storedMessages()).toEqual(original);
    return { result, suggestion: body.result.suggestion };
  }

  const user = page.getByTestId("message-user");
  await user.getByText("학습 도움", { exact: true }).click();
  const correction = await requestHelp(user, "correction", "문장 교정");
  await expect(input).toHaveValue(draft);
  await correction.result.getByRole("button", { name: "도움 문장을 입력창에 덧붙이기", exact: true }).click();
  const appended = `${draft}\n${correction.suggestion}`;
  await expect(input).toHaveValue(appended);
  await requestHelp(user, "rephrase", "쉽게 바꾸기");
  await expect(input).toHaveValue(appended);
  const assistant = page.getByTestId("message-assistant").last();
  await assistant.getByText("학습 도움", { exact: true }).click();
  await requestHelp(assistant, "reply", "답변 추천");
  await expect(input).toHaveValue(appended);
  expect(await storedMessages()).toEqual(original);
  await page.reload();
  await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", id!);
  await expect(input).toHaveValue(appended);
  await expect(page.getByTestId("message-user")).toHaveCount(1);
  await expect(page.getByTestId("learning-help-result")).toHaveCount(0);
  expect(await storedMessages()).toEqual(original);
});
