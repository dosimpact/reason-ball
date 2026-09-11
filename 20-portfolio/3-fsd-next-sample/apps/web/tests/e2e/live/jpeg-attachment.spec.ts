import { adminClient, expect, signIn, test } from "./fixtures";

// Manually authored 32x32 solid blue raster, encoded as JPEG. No OCR claim.
const jpeg = Buffer.from("/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAIKADAAQAAAABAAAAIAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAIAAgAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQAAv/aAAwDAQACEQMRAD8A8booor+xD+PwooooA//Q8booor+xD+PwooooA//Z", "base64");

test("CHAT-05 REF-14 real JPEG picker upload reaches vision and reloads with correct bytes, MIME and private ownership", async ({ page, account, browser, createAccount }) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /외우지 말고/ })).toBeVisible();
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  await page.getByRole("button", { name: "새 채팅", exact: true }).click();
  const input = page.getByRole("textbox", { name: "영어 메시지", exact: true });
  await expect(input).toBeEnabled();
  const id = (await page.getByTestId("chat-workspace").getAttribute("data-conversation-id"))!;
  const catalogResponse = await page.request.get("/api/ai/models");
  expect(catalogResponse.ok()).toBe(true);
  const catalog = await catalogResponse.json() as { items: Array<{ id: string; capabilities: { vision: boolean | null } }> };
  const verified = catalog.items.find(item => item.capabilities.vision === true);
  expect(verified, "Requires actual verified vision capability").toBeDefined();
  await page.getByLabel("AI 모델 선택").selectOption(verified!.id);
  await expect(page.getByLabel("선택 모델 기능")).toContainText("이미지: 지원");
  const filename = "blue-card.jpg";
  // The visible picker waits for model persistence to finish before opening.
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "이미지 또는 문서 첨부", exact: true }).click();
  await (await chooser).setFiles({ name: filename, mimeType: "image/jpeg", buffer: jpeg });
  const preview = page.getByTestId("attachment-preview");
  await expect(preview).toContainText(filename);
  await expect.poll(() => preview.getByRole("img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(32);
  const text = "This is a small image attachment. Please acknowledge it briefly in English.";
  await input.fill(text);
  const uploaded = page.waitForResponse(response => new URL(response.url()).pathname === `/api/conversations/${id}/attachments` && response.request().method() === "POST");
  const generated = page.waitForResponse(response => new URL(response.url()).pathname === "/api/ai/chat" && response.request().method() === "POST");
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  const uploadResponse = await uploaded;
  expect(uploadResponse.ok()).toBe(true);
  const file = (await uploadResponse.json()).file;
  expect(file).toMatchObject({ type: "file", mediaType: "image/jpeg", filename });
  expect(file.url).toMatch(new RegExp(`^chat-file://${id}/[0-9a-f-]{36}$`));
  const generation = await generated;
  expect(generation.ok()).toBe(true);
  expect(generation.headers()["x-ai-model"]).toBe(verified!.id);
  async function messages() {
    const result = await adminClient().from("messages").select("role,status,plain_text,parts").eq("conversation_id", id);
    expect(result.error).toBeNull(); return result.data!;
  }
  await expect.poll(async () => (await messages()).filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length, { timeout: 120_000 }).toBe(1);
  const rows = await messages();
  expect(rows).toHaveLength(2);
  expect(rows.find(row => row.role === "user")!.parts).toContainEqual(file);
  expect(rows.find(row => row.role === "user")!.plain_text).toBe(text);
  const attachmentId = file.url.split("/").at(-1);
  const stored = await adminClient().from("chat_file_uploads").select("id,owner_id,storage_path,byte_size").eq("conversation_id", id);
  expect(stored.error).toBeNull();
  expect(stored.data).toHaveLength(1);
  expect(stored.data![0]).toMatchObject({ id: attachmentId, owner_id: account!.id, byte_size: jpeg.length });
  expect(stored.data![0].storage_path).toMatch(new RegExp(`^${account!.id}/${id}/[a-f0-9]{64}\\.jpg$`));
  const path = `/api/conversations/${id}/attachments/${attachmentId}`;
  await page.reload();
  const image = page.getByRole("img", { name: filename, exact: true });
  await expect(image).toHaveAttribute("src", path);
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => ({ width: element.naturalWidth, height: element.naturalHeight }))).toEqual({ width: 32, height: 32 });
  await expect(page.getByTestId("message-assistant")).toHaveCount(1);
  const download = await page.request.get(path);
  expect(download.ok()).toBe(true);
  expect(download.headers()["content-type"]).toContain("image/jpeg");
  expect(await download.body()).toEqual(jpeg);
  const outsider = await browser.newContext({ baseURL: "http://dodonet.iptime.org:13000" });
  try {
    expect([401, 403, 404]).toContain((await outsider.request.get(path)).status());
    await signIn(outsider.request, await createAccount());
    expect([403, 404]).toContain((await outsider.request.get(path)).status());
  } finally { await outsider.close(); }
});
