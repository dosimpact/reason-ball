import { randomUUID } from "node:crypto";
import type { Route } from "@playwright/test";
import { adminClient, expect, signIn, test } from "./fixtures";

const origin = "http://dodonet.iptime.org:13000";
const headers = { Origin: origin };

test("CHAT-08 REF-20 remote HTTP share copy, retry, revocation and token rotation preserve the owner's conversation", async ({ page, browser, account, createAccount }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    const state = { denied: false, calls: [] as Array<{ text: string; succeeded: boolean }> };
    Object.assign(window, { shareClipboard: state });
    const native = document.execCommand.bind(document);
    document.execCommand = (command, showUI, value) => {
      if (command !== "copy") return native(command, showUI, value);
      const text = document.activeElement instanceof HTMLTextAreaElement ? document.activeElement.value : "";
      // Only the explicit failure branch is injected; success calls the native command.
      const succeeded = state.denied ? false : native(command, showUI, value);
      state.calls.push({ text, succeeded });
      return succeeded;
    };
  });
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  await page.getByRole("button", { name: "새 채팅", exact: true }).click();
  const input = page.getByTestId("chat-input");
  await expect(input).toBeEnabled();
  const id = (await page.getByTestId("chat-workspace").getAttribute("data-conversation-id"))!;
  const text = `Share regression sentence ${randomUUID()}`;
  const seeded = await page.request.post(`/api/conversations/${id}/messages`, {
    headers, data: { clientMessageId: randomUUID(), parts: [{ type: "text", text }] },
  });
  expect(seeded.ok()).toBe(true);
  await page.reload();
  await expect(page.getByTestId("message-user")).toContainText(text);
  await input.fill("Keep my unsent private draft.");
  async function stored() {
    const row = await adminClient().from("conversations").select("id,owner_id,title,visibility,share_token").eq("id", id).single();
    expect(row.error).toBeNull(); return row.data!;
  }
  async function messages() {
    const rows = await adminClient().from("messages").select("id,role,plain_text,parts").eq("conversation_id", id).order("sequence_number");
    expect(rows.error).toBeNull(); return rows.data!;
  }
  const originalMessages = await messages();
  const viewerContext = await browser.newContext({ baseURL: origin });
  let revokeHandler: ((route: Route) => Promise<void>) | undefined;
  try {
    await signIn(viewerContext.request, await createAccount());
    const viewer = await viewerContext.newPage();
    await page.getByRole("button", { name: "대화 공유", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "대화 공유", exact: true });
    const link = dialog.getByTestId("share-link");
    await expect(link).toContainText(`${origin}/shared/`);
    const oldUrl = (await link.innerText()).trim();
    const oldToken = new URL(oldUrl).pathname.split("/").at(-1)!;
    const shared = await stored();
    expect(shared).toMatchObject({ id, owner_id: account!.id, visibility: "unlisted", share_token: oldToken });
    expect(new URL(oldUrl).origin).toBe(origin);
    expect(await page.evaluate(() => typeof navigator.clipboard)).toBe("undefined");
    const copy = dialog.getByRole("button", { name: "공유 링크 복사", exact: true });
    await copy.click();
    await expect(dialog.getByRole("status")).toHaveText("공유 링크를 복사했어요.");
    expect(await page.evaluate(() => (window as unknown as Window & { shareClipboard: { calls: unknown[] } }).shareClipboard.calls)).toEqual([{ text: oldUrl, succeeded: true }]);
    await expect(copy).toBeFocused();
    await page.evaluate(() => { (window as unknown as Window & { shareClipboard: { denied: boolean } }).shareClipboard.denied = true; });
    await copy.click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog.getByText("공유 링크를 복사했어요.", { exact: true })).toHaveCount(0);
    await expect(link).toHaveText(oldUrl);
    await page.evaluate(() => { (window as unknown as Window & { shareClipboard: { denied: boolean } }).shareClipboard.denied = false; });
    await copy.click();
    await expect(dialog.getByRole("status")).toHaveText("공유 링크를 복사했어요.");
    expect(await page.evaluate(() => (window as unknown as Window & { shareClipboard: { calls: unknown[] } }).shareClipboard.calls)).toEqual([
      { text: oldUrl, succeeded: true }, { text: oldUrl, succeeded: false }, { text: oldUrl, succeeded: true },
    ]);
    await expect(page.locator("textarea[readonly]")).toHaveCount(0);
    await expect(input).toHaveValue("Keep my unsent private draft.");
    await viewer.goto(oldUrl);
    await expect(viewer.getByLabel("공유된 메시지")).toContainText(text);
    await expect(viewer.getByRole("textbox", { name: "영어 메시지" })).toHaveCount(0);

    let rejected = 0;
    revokeHandler = async route => {
      const request = route.request();
      if (request.method() === "PATCH" && request.postDataJSON()?.action === "update" && request.postDataJSON()?.visibility === "private" && rejected === 0) {
        rejected++; await route.abort("failed");
      } else await route.continue();
    };
    await page.route(`**/api/conversations/${id}`, revokeHandler);
    await dialog.getByRole("button", { name: "공유 취소", exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog.getByRole("alert")).toHaveText("공유 취소를 확인하지 못했어요. 다시 시도해 주세요.");
    expect(rejected).toBe(1);
    await expect(link).toHaveText(oldUrl);
    expect(await stored()).toEqual(shared);
    expect((await viewerContext.request.get(`/api/share/${oldToken}`)).status()).toBe(200);
    await page.unroute(`**/api/conversations/${id}`, revokeHandler); revokeHandler = undefined;
    await dialog.getByRole("button", { name: "공유 취소", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const revoked = await stored();
    expect(revoked.visibility).toBe("private");
    expect(revoked.share_token).not.toBe(oldToken);
    expect(revoked.title).toBe(shared.title);
    expect((await viewerContext.request.get(`/api/share/${oldToken}`)).status()).toBe(404);
    await viewer.reload();
    await expect(viewer.getByRole("heading", { name: "공유 대화를 찾을 수 없어요.", exact: true })).toBeVisible();
    await expect(viewer.getByLabel("공유된 메시지")).toHaveCount(0);
    await expect(input).toHaveValue("Keep my unsent private draft.");
    expect(await messages()).toEqual(originalMessages);

    await page.getByRole("button", { name: "대화 공유", exact: true }).click();
    await expect(link).toContainText(`${origin}/shared/`);
    const newUrl = (await link.innerText()).trim();
    const newToken = new URL(newUrl).pathname.split("/").at(-1)!;
    expect(newToken).not.toBe(oldToken);
    expect(await stored()).toMatchObject({ owner_id: account!.id, title: shared.title, visibility: "unlisted", share_token: newToken });
    expect((await viewerContext.request.get(`/api/share/${oldToken}`)).status()).toBe(404);
    expect((await viewerContext.request.get(`/api/share/${newToken}`)).status()).toBe(200);
    await viewer.goto(newUrl);
    await expect(viewer.getByLabel("공유된 메시지")).toContainText(text);
    await expect(viewer.getByRole("textbox", { name: "영어 메시지" })).toHaveCount(0);
    expect(await messages()).toEqual(originalMessages);
  } finally {
    if (revokeHandler) await page.unroute(`**/api/conversations/${id}`, revokeHandler);
    await viewerContext.request.post("/api/auth/logout", { headers });
    await viewerContext.close();
  }
});
