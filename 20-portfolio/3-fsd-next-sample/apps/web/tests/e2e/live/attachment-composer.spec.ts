import type { Page } from "@playwright/test";
import { adminClient, expect, signIn, test } from "./fixtures";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHmsAAAAASUVORK5CYII=";
async function openChat(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /외우지 말고/ })).toBeVisible();
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  await page.getByRole("button", { name: "새 채팅", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "영어 메시지", exact: true })).toBeEnabled();
  const id = (await page.getByTestId("chat-workspace").getAttribute("data-conversation-id"))!;
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  return id;
}
async function uploads(id: string) {
  const result = await adminClient().from("chat_file_uploads").select("id").eq("conversation_id", id);
  expect(result.error).toBeNull(); return result.data!;
}

// Real browser picker and DOM paste handlers; no model flags, FileReader, API
// responses, or DB rows are mocked. DOM paste does not prove OS clipboard access.
test("REF-14 attachment picker rejects invalid MIME, empty and oversized files while preserving the draft", async ({ page }) => {
  const id = await openChat(page);
  const draft = "Please keep my unsent booking question.";
  const input = page.getByRole("textbox", { name: "영어 메시지", exact: true });
  await input.fill(draft);
  let uploadRequests = 0;
  page.on("request", request => { if (new URL(request.url()).pathname === `/api/conversations/${id}/attachments`) uploadRequests++; });
  const cases = [
    { name: "unsafe.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>"), error: "PNG, JPEG 또는 PDF" },
    { name: "empty.png", mimeType: "image/png", buffer: Buffer.alloc(0), error: "비어 있는 파일" },
    { name: "large.png", mimeType: "image/png", buffer: Buffer.alloc(2 * 1024 * 1024 + 1), error: "2MB 이하" },
  ];
  for (const { error, ...file } of cases) {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "이미지 또는 문서 첨부", exact: true }).click();
    await (await chooser).setFiles(file);
    await expect(page.getByRole("alert").filter({ hasText: error })).toBeVisible();
    await expect(input).toHaveValue(draft);
    await expect(page.getByTestId("attachment-preview")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "메시지 보내기", exact: true })).toBeEnabled();
  }
  expect(uploadRequests).toBe(0);
  expect(await uploads(id)).toEqual([]);
  await page.reload();
  await expect(input).toHaveValue(draft);
});

test("REF-14 unverified attachment capability rejects picker and paste, then allows a real text reply", async ({ page }) => {
  test.setTimeout(180_000);
  const id = await openChat(page);
  const catalogResponse = await page.request.get("/api/ai/models");
  expect(catalogResponse.ok()).toBe(true);
  const catalog = await catalogResponse.json() as { items: Array<{ id: string; capabilities: { vision: boolean | null } }> };
  const model = page.getByLabel("AI 모델 선택");
  await expect(model).toBeEnabled();
  const selected = catalog.items.find(item => item.capabilities.vision !== true);
  expect(selected, "Actual catalog must expose a model without verified vision for the guard scenario").toBeDefined();
  await model.selectOption(selected!.id);
  expect(selected, "Selected model must exist in the actual catalog").toBeDefined();
  expect(selected!.capabilities.vision, "This guard case requires the selected model to lack verified vision support").not.toBe(true);
  const input = page.getByRole("textbox", { name: "영어 메시지", exact: true });
  const draft = "Hello! Please teach me one polite hotel greeting in English.";
  await input.fill(draft);
  let uploadRequests = 0;
  page.on("request", request => { if (new URL(request.url()).pathname === `/api/conversations/${id}/attachments`) uploadRequests++; });
  await page.getByLabel("파일 첨부", { exact: true }).setInputFiles({ name: "booking.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  const guard = page.getByRole("alert").filter({ hasText: "첨부 지원이 확인되지 않았어요" });
  await expect(guard).toBeVisible();
  async function paste(names: string[]) {
    await input.evaluate((element, payload) => {
      const data = new DataTransfer();
      for (const name of payload.names) data.items.add(new File([Uint8Array.from(atob(payload.png), c => c.charCodeAt(0))], name, { type: "image/png" }));
      element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    }, { names, png });
  }
  await paste(["one.png", "two.png"]);
  await expect(page.getByRole("alert").filter({ hasText: "파일 하나만" })).toBeVisible();
  await paste(["booking.png"]);
  await expect(guard).toBeVisible();
  await expect(input).toHaveValue(draft);
  await expect(page.getByTestId("attachment-preview")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "첨부 제거", exact: true })).toHaveCount(0);
  const prevented = await input.evaluate(element => {
    const data = new DataTransfer(); data.setData("text/plain", "normal text");
    const event = new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true });
    element.dispatchEvent(event); return event.defaultPrevented;
  });
  expect(prevented).toBe(false);
  expect(uploadRequests).toBe(0);
  expect(await uploads(id)).toEqual([]);
  const generated = page.waitForResponse(response => new URL(response.url()).pathname === "/api/ai/chat" && response.request().method() === "POST");
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  expect((await generated).ok()).toBe(true);
  async function rows() {
    const result = await adminClient().from("messages").select("role,status,plain_text,parts").eq("conversation_id", id);
    expect(result.error).toBeNull(); return result.data!;
  }
  await expect.poll(async () => (await rows()).filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length, { timeout: 120_000 }).toBe(1);
  const saved = await rows();
  expect(saved).toHaveLength(2);
  expect(saved.find(row => row.role === "user")).toMatchObject({ plain_text: draft, parts: [{ type: "text", text: draft }] });
  expect(uploadRequests).toBe(0);
  expect(await uploads(id)).toEqual([]);
  await expect(input).toHaveValue("");
  await page.reload();
  await expect(page.getByTestId("message-user")).toContainText(draft);
  await expect(page.getByTestId("message-assistant")).toHaveCount(1);
  await expect(page.getByTestId("attachment-preview")).toHaveCount(0);
});

// Manually authored antialiased conventional-font raster reading 32997; prompt contains no answer.
// This checks attachment delivery, not general OCR accuracy.
const digitPng = "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";

test("REF-14 real image picker removal and paste survive upload failure, retry with vision, and restore privately", async ({ page, account, browser, createAccount }) => {
  test.setTimeout(180_000);
  const id = await openChat(page);
  const response = await page.request.get("/api/ai/models");
  expect(response.ok()).toBe(true);
  const catalog = await response.json() as { items: Array<{ id: string; capabilities: { vision: boolean | null } }> };
  const vision = catalog.items.find(item => item.capabilities.vision === true);
  expect(vision, "Requires an actual verified vision model; capability flags are never fabricated").toBeDefined();
  await page.getByLabel("AI 모델 선택").selectOption(vision!.id);
  await expect(page.getByLabel("선택 모델 기능")).toContainText("이미지: 지원");
  const input = page.getByRole("textbox", { name: "영어 메시지", exact: true });
  const draft = "Read the five digits in the attached image. Reply with only those digits.";
  await input.fill(draft);
  const file = { name: "digit-card.png", mimeType: "image/png", buffer: Buffer.from(digitPng, "base64") };
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "이미지 또는 문서 첨부", exact: true }).click();
  await (await chooser).setFiles(file);
  const preview = page.getByTestId("attachment-preview");
  await expect(preview).toContainText(file.name);
  await expect.poll(() => preview.getByRole("img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(890);
  await page.getByRole("button", { name: "첨부 제거", exact: true }).click();
  await expect(preview).toHaveCount(0);
  await expect(input).toHaveValue(draft);
  expect(await uploads(id)).toEqual([]);
  await input.evaluate((element, payload) => {
    const data = new DataTransfer();
    data.items.add(new File([Uint8Array.from(atob(payload.png), c => c.charCodeAt(0))], payload.name, { type: "image/png" }));
    element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, { name: file.name, png: digitPng });
  await expect(preview).toContainText(file.name);
  await expect.poll(() => preview.getByRole("img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(890);
  let uploadAttempts = 0;
  let chatRequests = 0;
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/ai/chat") chatRequests++; });
  // Only failure is injected. Retry continues to the actual Supabase upload API.
  await page.route(`**/api/conversations/${id}/attachments`, async route => {
    uploadAttempts++;
    if (uploadAttempts === 1) await route.abort("connectionreset");
    else await route.continue();
  });
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: /fetch|네트워크|첨부|요청/i })).toBeVisible();
  await expect(input).toHaveValue(draft);
  await expect(preview).toContainText(file.name);
  await expect(page.getByRole("button", { name: "메시지 보내기", exact: true })).toBeEnabled();
  expect(uploadAttempts).toBe(1);
  expect(chatRequests).toBe(0);
  expect(await uploads(id)).toEqual([]);
  const beforeMessages = await adminClient().from("messages").select("id").eq("conversation_id", id);
  expect(beforeMessages.error).toBeNull();
  expect(beforeMessages.data).toEqual([]);
  const generated = page.waitForResponse(result => new URL(result.url()).pathname === "/api/ai/chat" && result.request().method() === "POST");
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  const generation = await generated;
  expect(generation.ok()).toBe(true);
  expect(generation.headers()["x-ai-model"]).toBe(vision!.id);
  async function messages() {
    const result = await adminClient().from("messages").select("role,status,plain_text,parts").eq("conversation_id", id);
    expect(result.error).toBeNull(); return result.data!;
  }
  await expect.poll(async () => (await messages()).filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length, { timeout: 120_000 }).toBe(1);
  const rows = await messages();
  expect(rows).toHaveLength(2);
  expect(rows.find(row => row.role === "assistant")!.plain_text).toContain("32997");
  const uploaded = await adminClient().from("chat_file_uploads").select("id,owner_id,storage_path,byte_size").eq("conversation_id", id).single();
  expect(uploaded.error).toBeNull();
  expect(uploaded.data).toMatchObject({ owner_id: account!.id, byte_size: file.buffer.length });
  const attachmentId = uploaded.data!.id;
  const url = `/api/conversations/${id}/attachments/${attachmentId}`;
  expect(rows.find(row => row.role === "user")!.parts).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "file", filename: file.name, url: `chat-file://${id}/${attachmentId}` }),
    { type: "text", text: draft },
  ]));
  expect(uploadAttempts).toBe(2);
  expect(chatRequests).toBe(1);
  await expect(preview).toHaveCount(0);
  await expect(input).toHaveValue("");
  await page.reload();
  const restored = page.getByRole("img", { name: file.name, exact: true });
  await expect(restored).toHaveAttribute("src", url);
  await expect.poll(() => restored.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(890);
  await expect(page.getByTestId("message-assistant")).toContainText("32997");
  expect(await (await page.request.get(url)).body()).toEqual(file.buffer);
  const other = await browser.newContext({ baseURL: "http://dodonet.iptime.org:13000" });
  try {
    await signIn(other.request, await createAccount());
    expect([403, 404]).toContain((await other.request.get(url)).status());
  } finally {
    await other.close();
  }
});
