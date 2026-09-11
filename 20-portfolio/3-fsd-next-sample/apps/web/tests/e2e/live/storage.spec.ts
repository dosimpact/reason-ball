import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { adminClient, expect, signIn, test } from "./fixtures";

const origin = "http://dodonet.iptime.org:13000";
const headers = { Origin: origin };
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHmsAAAAASUVORK5CYII=", "base64");
const upload = { dataUrl: `data:image/png;base64,${png.toString("base64")}`, filename: "private-key.png" };

async function openConversation(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /외우지 말고/ })).toBeVisible();
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  await page.getByRole("button", { name: "새 채팅", exact: true }).click();
  await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", /^[0-9a-f-]{36}$/);
  return (await page.getByTestId("chat-workspace").getAttribute("data-conversation-id"))!;
}

// These tests exercise real upload/DB/download and browser restoration. The user
// message is an explicit API fixture; this does not prove AI attachment sending.
test("private PNG survives browser reload, enforces ownership, and stays hidden in shared UI", async ({ page, account, browser, createAccount }) => {
  const id = await openConversation(page);
  const response = await page.request.post(`/api/conversations/${id}/attachments`, { headers, data: upload });
  expect(response.ok(), `Upload returned ${response.status()}`).toBe(true);
  const file = (await response.json()).file;
  expect(file.url).toMatch(new RegExp(`^chat-file://${id}/[0-9a-f-]{36}$`));
  const attachmentId = file.url.split("/").at(-1);
  const path = `/api/conversations/${id}/attachments/${attachmentId}`;
  const stored = await adminClient().from("chat_file_uploads").select("owner_id, conversation_id, storage_path, byte_size").eq("id", attachmentId).single();
  expect(stored.error).toBeNull();
  expect(stored.data).toMatchObject({ owner_id: account!.id, conversation_id: id, byte_size: png.length });
  expect(stored.data!.storage_path).toMatch(new RegExp(`^${account!.id}/${id}/`));
  const messageId = randomUUID();
  const append = await page.request.post(`/api/conversations/${id}/messages`, { headers, data: {
    id: messageId, clientMessageId: randomUUID(), parts: [{ type: "text", text: "My private hotel key" }, file],
  } });
  expect(append.ok()).toBe(true);
  const message = await adminClient().from("messages").select("author_id, parts").eq("id", messageId).single();
  expect(message.error).toBeNull();
  expect(message.data!.author_id).toBe(account!.id);
  expect(message.data!.parts).toContainEqual(file);
  await page.reload();
  const image = page.getByRole("img", { name: upload.filename, exact: true });
  await expect(image).toHaveAttribute("src", path);
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(1);
  const download = await page.request.get(path);
  expect(download.ok()).toBe(true);
  expect(download.headers()["content-type"]).toContain("image/png");
  expect(await download.body()).toEqual(png);
  const shared = await page.request.patch(`/api/conversations/${id}`, { headers, data: { action: "update", visibility: "unlisted" } });
  expect(shared.ok()).toBe(true);
  const token = (await shared.json()).shareToken;
  expect(token).toMatch(/^[0-9a-f-]{36}$/);
  const other = await browser.newContext({ baseURL: origin });
  try {
    await signIn(other.request, await createAccount());
    expect([403, 404]).toContain((await other.request.get(path)).status());
    expect([403, 404]).toContain((await other.request.post(`/api/conversations/${id}/attachments`, { headers, data: upload })).status());
    const viewer = await other.newPage();
    let privateRequests = 0;
    viewer.on("request", request => { if (new URL(request.url()).pathname === path) privateRequests++; });
    await viewer.goto(`/shared/${token}`);
    await expect(viewer.getByTestId("private-attachment-notice")).toContainText("소유자만 열 수 있어요");
    await expect(viewer.getByRole("img", { name: upload.filename })).toHaveCount(0);
    await expect(viewer.getByRole("link", { name: `${upload.filename} 열기` })).toHaveCount(0);
    expect(privateRequests).toBe(0);
    const sharedResponse = await other.request.get(`/api/share/${token}`);
    expect(sharedResponse.ok()).toBe(true);
    const sharedBody = await sharedResponse.text();
    expect(sharedBody).not.toContain(stored.data!.storage_path);
    expect(sharedBody).not.toContain("/storage/v1/object/sign/");
    const ownId = await openConversation(viewer);
    const foreignReference = await other.request.post(`/api/conversations/${ownId}/messages`, { headers, data: {
      clientMessageId: randomUUID(), parts: [{ type: "text", text: "Forbidden foreign attachment" }, file],
    } });
    expect([400, 403, 404]).toContain(foreignReference.status());
  } finally {
    expect((await other.request.post("/api/auth/logout", { headers })).ok()).toBe(true);
    await other.close();
  }
});

test("attachment API rejects unsupported MIME, forged bytes, and files above 2 MB", async ({ page }) => {
  const id = await openConversation(page);
  const oversized = Buffer.alloc(2 * 1024 * 1024 + 1);
  png.copy(oversized);
  for (const [dataUrl, status] of [
    ["data:text/html;base64,PGgxPnRlc3Q8L2gxPg==", 415],
    ["data:image/png;base64,bm90LWEtcG5n", 400],
    [`data:image/png;base64,${oversized.toString("base64")}`, 400],
  ] as const) {
    const response = await page.request.post(`/api/conversations/${id}/attachments`, { headers, data: { dataUrl, filename: "invalid.png" } });
    expect(response.status()).toBe(status);
  }
  const files = await adminClient().from("chat_file_uploads").select("id").eq("conversation_id", id);
  expect(files.error).toBeNull();
  expect(files.data).toEqual([]);
});
