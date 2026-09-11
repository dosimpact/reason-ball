import { randomInt } from "node:crypto";
import { adminClient, expect, signIn, test } from "./fixtures";

// Small valid PDF fixture: the unpredictable code exists only in page content.
// Offsets and stream lengths are computed from bytes, not hard-coded strings.
function pdfWithCode(code: string) {
  const content = `BT /F1 32 Tf 72 700 Td (Verification code: ${code}) Tj ET\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

test("CHAT-05 REF-14 real PDF picker sends a private document to the verified model and restores its protected download", async ({ page, account, browser, createAccount }) => {
  test.setTimeout(180_000);
  const code = String(randomInt(100000, 1000000));
  const pdf = pdfWithCode(code);
  const filename = "verification-card.pdf";
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /외우지 말고/ })).toBeVisible();
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  await page.getByRole("button", { name: "새 채팅", exact: true }).click();
  const input = page.getByRole("textbox", { name: "영어 메시지", exact: true });
  await expect(input).toBeEnabled();
  const id = (await page.getByTestId("chat-workspace").getAttribute("data-conversation-id"))!;
  const response = await page.request.get("/api/ai/models");
  expect(response.ok()).toBe(true);
  const catalog = await response.json() as { items: Array<{ id: string; capabilities: { documents: boolean | null } }> };
  const model = catalog.items.find(item => item.capabilities.documents === true);
  expect(model, "Actual catalog must verify document support; no test capability overrides").toBeDefined();
  await page.getByLabel("AI 모델 선택").selectOption(model!.id);
  await expect(page.getByLabel("선택 모델 기능")).toContainText("PDF: 지원");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "이미지 또는 문서 첨부", exact: true }).click();
  await (await chooser).setFiles({ name: filename, mimeType: "application/pdf", buffer: pdf });
  await expect(page.getByTestId("attachment-preview")).toContainText(filename);
  await expect(page.getByTestId("attachment-preview").locator("img,iframe,embed,object")).toHaveCount(0);
  const prompt = "Read the verification code in the attached PDF and reply with only its six digits.";
  expect(prompt).not.toContain(code);
  await input.fill(prompt);
  const uploaded = page.waitForResponse(result => new URL(result.url()).pathname === `/api/conversations/${id}/attachments` && result.request().method() === "POST");
  const generated = page.waitForResponse(result => new URL(result.url()).pathname === "/api/ai/chat" && result.request().method() === "POST");
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  const uploadResponse = await uploaded;
  expect(uploadResponse.ok()).toBe(true);
  const file = (await uploadResponse.json()).file;
  expect(file).toMatchObject({ type: "file", mediaType: "application/pdf", filename });
  expect(file.url).toMatch(new RegExp(`^chat-file://${id}/[0-9a-f-]{36}$`));
  const generation = await generated;
  expect(generation.ok()).toBe(true);
  expect(generation.headers()["x-ai-model"]).toBe(model!.id);
  async function rows() {
    const result = await adminClient().from("messages").select("role,status,plain_text,parts").eq("conversation_id", id);
    expect(result.error).toBeNull(); return result.data!;
  }
  await expect.poll(async () => (await rows()).filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length, { timeout: 120_000 }).toBe(1);
  const messages = await rows();
  expect(messages).toHaveLength(2);
  expect(messages.find(row => row.role === "assistant")!.plain_text.trim()).toBe(code);
  expect(messages.find(row => row.role === "user")!.parts).toContainEqual(file);
  expect(messages.find(row => row.role === "user")!.plain_text).toBe(prompt);
  const attachmentId = file.url.split("/").at(-1);
  const stored = await adminClient().from("chat_file_uploads").select("id,owner_id,mime_type,storage_path,byte_size").eq("conversation_id", id);
  expect(stored.error).toBeNull();
  expect(stored.data).toHaveLength(1);
  expect(stored.data![0]).toMatchObject({ id: attachmentId, owner_id: account!.id, mime_type: "application/pdf", byte_size: pdf.length });
  expect(stored.data![0].storage_path).toMatch(new RegExp(`^${account!.id}/${id}/[a-f0-9]{64}\\.pdf$`));
  const path = `/api/conversations/${id}/attachments/${attachmentId}`;
  await page.reload();
  const attachment = page.getByTestId("message-user").getByTestId("message-attachment");
  await expect(attachment).toContainText(filename);
  await expect(attachment.locator("img,iframe,embed,object")).toHaveCount(0);
  await expect(attachment.getByRole("link", { name: `${filename} 열기`, exact: true })).toHaveAttribute("href", path);
  await expect(page.getByTestId("message-assistant")).toContainText(code);
  const download = await page.request.get(path);
  expect(download.ok()).toBe(true);
  expect(download.headers()["content-type"]).toContain("application/pdf");
  expect(download.headers()["content-disposition"]).toContain("attachment;");
  expect(await download.body()).toEqual(pdf);
  const other = await browser.newContext({ baseURL: "http://dodonet.iptime.org:13000" });
  try {
    await signIn(other.request, await createAccount());
    expect([403, 404]).toContain((await other.request.get(path)).status());
  } finally { await other.close(); }
});


test("REF-14 an unverified document model rejects PDF selection without uploading or losing the draft", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  await page.getByRole("button", { name: "새 채팅", exact: true }).click();
  const input = page.getByRole("textbox", { name: "영어 메시지", exact: true });
  await expect(input).toBeEnabled();
  const id = (await page.getByTestId("chat-workspace").getAttribute("data-conversation-id"))!;
  const response = await page.request.get("/api/ai/models");
  expect(response.ok()).toBe(true);
  const catalog = await response.json() as { items: Array<{ id: string; capabilities: { documents: boolean | null } }> };
  const unverified = catalog.items.find(item => item.capabilities.documents !== true);
  expect(unverified, "Actual catalog must expose an unverified document model").toBeDefined();
  await page.getByLabel("AI 모델 선택").selectOption(unverified!.id);
  const draft = "Please preserve this unsent document question.";
  await input.fill(draft);
  const writes: string[] = [];
  page.on("request", request => {
    if (request.method() === "POST" && ["/api/ai/chat", `/api/conversations/${id}/attachments`].includes(new URL(request.url()).pathname)) writes.push(request.url());
  });
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "이미지 또는 문서 첨부", exact: true }).click();
  await (await chooser).setFiles({ name: "unsupported.pdf", mimeType: "application/pdf", buffer: pdfWithCode("123456") });
  await expect(page.getByRole("alert").filter({ hasText: "첨부 지원이 확인되지 않았어요" })).toBeVisible();
  await expect(page.getByTestId("attachment-preview")).toHaveCount(0);
  await expect(input).toHaveValue(draft);
  for (const table of ["messages", "chat_file_uploads"]) {
    const saved = await adminClient().from(table).select("id").eq("conversation_id", id);
    expect(saved.error).toBeNull(); expect(saved.data).toEqual([]);
  }
  expect(writes).toEqual([]);
  await page.reload();
  await expect(page.getByLabel("AI 모델 선택")).toHaveValue(unverified!.id);
  await expect(input).toHaveValue(draft);
  await expect(page.getByTestId("attachment-preview")).toHaveCount(0);
  expect(writes).toEqual([]);
});
