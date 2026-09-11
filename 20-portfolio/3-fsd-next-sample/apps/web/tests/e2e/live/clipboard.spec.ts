import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

async function storedMessage(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  await page.getByRole("button", { name: "새 채팅", exact: true }).click();
  await expect(page.getByTestId("chat-input")).toBeEnabled();
  const id = await page.getByTestId("chat-workspace").getAttribute("data-conversation-id");
  const text = `Copy this exact practice sentence ${randomUUID()}.`;
  const response = await page.request.post(`/api/conversations/${id}/messages`, {
    headers: { Origin: "http://dodonet.iptime.org:13000" },
    data: { clientMessageId: randomUUID(), parts: [{ type: "text", text }] },
  });
  expect(response.ok()).toBe(true);
  await page.reload();
  await expect(page.getByTestId("message-user")).toContainText(text);
  return text;
}

test("REF-15 remote HTTP copy passes exact text to the native clipboard command and preserves draft", async ({ page }) => {
  await page.addInitScript(() => {
    const calls: Array<{ command: string; text: string; succeeded: boolean }> = [];
    Object.assign(window, { copyCalls: calls });
    const original = document.execCommand.bind(document);
    document.execCommand = (command, showUI, value) => {
      const text = document.activeElement instanceof HTMLTextAreaElement ? document.activeElement.value : "";
      const succeeded = original(command, showUI, value);
      calls.push({ command, text, succeeded });
      return succeeded;
    };
  });
  const text = await storedMessage(page);
  expect(await page.evaluate(() => typeof navigator.clipboard)).toBe("undefined");
  await page.getByTestId("chat-input").fill("Preserve my unsent draft.");
  const user = page.getByTestId("message-user");
  await user.hover();
  const copy = user.getByRole("button", { name: "메시지 복사", exact: true });
  await copy.click();
  await expect(user.getByRole("status")).toHaveText("메시지를 복사했어요.");
  expect(await page.evaluate(() => (window as Window & { copyCalls?: unknown }).copyCalls)).toEqual([{ command: "copy", text, succeeded: true }]);
  await expect(copy).toBeFocused();
  await expect(page.getByTestId("chat-input")).toHaveValue("Preserve my unsent draft.");
  await expect(page.locator('textarea[readonly]')).toHaveCount(0);
});

test("REF-33 injected clipboard denial reports failure without a false copied state or lost draft", async ({ page }) => {
  await page.addInitScript(() => { document.execCommand = () => false; });
  await storedMessage(page);
  await page.getByTestId("chat-input").fill("Keep this on copy failure.");
  const user = page.getByTestId("message-user");
  await user.hover();
  await user.getByRole("button", { name: "메시지 복사", exact: true }).click();
  await expect(page.getByText("복사하지 못했어요. 텍스트를 선택해 직접 복사해 주세요.", { exact: true })).toBeVisible();
  await expect(user.getByRole("status")).toHaveCount(0);
  await expect(page.getByTestId("chat-input")).toHaveValue("Keep this on copy failure.");
  await expect(page.locator('textarea[readonly]')).toHaveCount(0);
});
