import { adminClient, expect, signIn, test } from "./fixtures";

// Manually authored 32x32 solid blue PNG fixture.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAKklEQVR4nGPQyNtCU8QwasGoBaMWjFowasGoBaMWjFowasGoBaMWDBULADD+KEyfbA9oAAAAAElFTkSuQmCC", "base64");

// Real image delivery and three real generations; no OCR/content-quality claim.
test("CHAT-05/06 REF-14/16 editing reuses a saved image, cancel preserves it, and explicit removal creates a text-only branch", async ({ page, account, browser, createAccount }) => {
  test.setTimeout(300_000);
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
  const model = catalog.items.find(item => item.capabilities.vision === true);
  expect(model, "A verified real vision model is required").toBeDefined();
  await page.getByLabel("AI 모델 선택").selectOption(model!.id);
  let uploads = 0;
  let generations = 0;
  page.on("request", request => {
    if (request.method() !== "POST") return;
    const path = new URL(request.url()).pathname;
    if (path === `/api/conversations/${id}/attachments`) uploads++;
    if (path === "/api/ai/chat") generations++;
  });
  async function rows() {
    const result = await adminClient().from("messages").select("id,role,status,plain_text,parts").eq("conversation_id", id).order("sequence_number");
    expect(result.error).toBeNull(); return result.data!;
  }
  async function files() {
    const result = await adminClient().from("chat_file_uploads").select("id,owner_id,storage_path,byte_size").eq("conversation_id", id);
    expect(result.error).toBeNull(); return result.data!;
  }
  async function send(text: string, editing = false) {
    await input.fill(text);
    const generated = page.waitForResponse(response => new URL(response.url()).pathname === "/api/ai/chat" && response.request().method() === "POST");
    await page.getByRole("button", { name: editing ? "수정한 메시지 보내기" : "메시지 보내기", exact: true }).click();
    expect((await generated).ok()).toBe(true);
    await expect.poll(async () => (await rows()).find(row => row.role === "user")?.plain_text).toBe(text);
    await expect.poll(async () => (await rows()).filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length, { timeout: 120_000 }).toBe(1);
    await expect(page.getByRole("button", { name: "메시지 보내기", exact: true })).toBeVisible();
    expect(await rows()).toHaveLength(2);
  }
  async function edit() {
    await page.getByTestId("message-user").hover();
    await page.getByTestId("message-user").getByRole("button", { name: "메시지 편집", exact: true }).click();
    await expect(page.getByRole("button", { name: "수정한 메시지 보내기", exact: true })).toBeVisible();
  }
  const filename = "tiny-check.png";
  // Use the enabled user-facing picker; model persistence temporarily disables it.
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "이미지 또는 문서 첨부", exact: true }).click();
  await (await chooser).setFiles({ name: filename, mimeType: "image/png", buffer: png });
  await expect(page.getByTestId("attachment-preview")).toContainText(filename);
  const original = "This is a tiny test image. Please reply with a short greeting.";
  await send(original);
  expect(uploads).toBe(1);
  const initial = await rows();
  const storedFiles = await files();
  expect(storedFiles).toHaveLength(1);
  expect(storedFiles[0]).toMatchObject({ owner_id: account!.id, byte_size: png.length });
  const attachmentId = storedFiles[0].id;
  const reference = `chat-file://${id}/${attachmentId}`;
  const downloadUrl = `/api/conversations/${id}/attachments/${attachmentId}`;
  const filePart = { type: "file", mediaType: "image/png", filename, url: reference };
  expect(initial[0].parts).toContainEqual(filePart);
  await edit();
  await expect(page.getByTestId("attachment-preview")).toContainText(filename);
  await expect(page.getByRole("img", { name: "첨부 미리보기", exact: true })).toHaveAttribute("src", downloadUrl);
  // Preview removal is reversible until the user explicitly submits the edit.
  await page.getByRole("button", { name: "첨부 제거", exact: true }).click();
  await input.fill("Cancelled text must not reach the database.");
  await page.getByRole("button", { name: "취소", exact: true }).click();
  expect(await rows()).toEqual(initial);
  expect(await files()).toEqual(storedFiles);
  await expect(page.getByRole("img", { name: filename, exact: true })).toHaveAttribute("src", downloadUrl);
  expect(generations).toBe(1);

  await edit();
  await expect(page.getByTestId("attachment-preview")).toContainText(filename);
  const edited = "Keep this same tiny image and greet a hotel guest briefly.";
  await send(edited, true);
  const withImage = await rows();
  expect(withImage[0].id).not.toBe(initial[0].id);
  expect(withImage[0].parts).toContainEqual(filePart);
  expect(await files()).toEqual(storedFiles);
  expect(uploads).toBe(1);
  expect(generations).toBe(2);
  await page.reload();
  const restored = page.getByRole("img", { name: filename, exact: true });
  await expect(restored).toHaveAttribute("src", downloadUrl);
  await expect.poll(() => restored.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(32);

  await edit();
  await page.getByRole("button", { name: "첨부 제거", exact: true }).click();
  await expect(page.getByTestId("attachment-preview")).toHaveCount(0);
  const textOnly = "No image is attached now. Please give one short checkout greeting.";
  await send(textOnly, true);
  const withoutImage = await rows();
  expect(withoutImage[0].parts).toEqual([{ type: "text", text: textOnly }]);
  expect(withoutImage[0].id).not.toBe(withImage[0].id);
  expect(await files()).toEqual(storedFiles);
  expect(uploads).toBe(1);
  expect(generations).toBe(3);
  await page.reload();
  await expect(page.getByTestId("message-user")).toContainText(textOnly);
  await expect(page.getByTestId("message-user").getByRole("img")).toHaveCount(0);
  await expect(page.getByTestId("message-assistant")).toHaveCount(1);
  expect(await rows()).toEqual(withoutImage);
  const download = await page.request.get(downloadUrl);
  expect(download.ok()).toBe(true);
  expect(await download.body()).toEqual(png);
  const other = await browser.newContext({ baseURL: "http://dodonet.iptime.org:13000" });
  try {
    await signIn(other.request, await createAccount());
    expect([403, 404]).toContain((await other.request.get(downloadUrl)).status());
  } finally { await other.close(); }
});
