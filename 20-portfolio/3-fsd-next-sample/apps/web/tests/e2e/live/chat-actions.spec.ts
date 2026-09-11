import type { Page } from "@playwright/test";
import { adminClient, expect, signIn, test } from "./fixtures";
async function openChat(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /외우지 말고/ })).toBeVisible();
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  await page.getByRole("button", { name: "새 채팅", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "영어 메시지" })).toBeEnabled();
  return (await page.getByTestId("chat-workspace").getAttribute("data-conversation-id"))!;
}
async function messages(id: string) {
  const result = await adminClient().from("messages").select("id,role,status,plain_text,model_id").eq("conversation_id", id);
  expect(result.error).toBeNull(); return result.data!;
}
async function waitAnswer(id: string) {
  await expect.poll(async () => (await messages(id)).filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length, { timeout: 120_000 }).toBe(1);
}

test("CHAT-04/10 REF-05/06/08 selected real model restores and suggested draft obeys Enter versus ShiftEnter", async ({ page }) => {
  test.setTimeout(180_000);
  const id = await openChat(page);
  const model = page.getByLabel("AI 모델 선택");
  await expect(model).toBeEnabled();
  await page.getByLabel("AI 모델 검색").fill("gpt-5.6-sol");
  await model.selectOption("gpt-5.6-sol");
  await page.reload();
  await expect(model).toHaveValue("gpt-5.6-sol");
  const suggestion = page.getByLabel("추천 문장", { exact: true }).getByRole("button").first();
  const phrase = (await suggestion.innerText()).trim();
  await suggestion.click();
  const input = page.getByRole("textbox", { name: "영어 메시지", exact: true });
  await expect(input).toHaveValue(phrase);
  expect(await messages(id)).toHaveLength(0);
  await input.press("End"); await input.press("Shift+Enter");
  await input.pressSequentially("Please answer briefly.");
  const composed = `${phrase}\nPlease answer briefly.`;
  await expect(input).toHaveValue(composed);
  expect(await messages(id)).toHaveLength(0);
  const generated = page.waitForResponse(response => new URL(response.url()).pathname === "/api/ai/chat" && response.request().method() === "POST");
  await input.press("Enter");
  const response = await generated;
  expect(response.ok()).toBe(true);
  expect(response.headers()["x-ai-model"]).toBe("gpt-5.6-sol");
  await waitAnswer(id);
  const stored = await messages(id);
  expect(stored.filter(row => row.role === "user").map(row => row.plain_text)).toEqual([composed]);
  expect(stored.find(row => row.role === "assistant")?.model_id).toBe("gpt-5.6-sol");
  await page.reload();
  await expect(model).toHaveValue("gpt-5.6-sol");
  await expect(page.getByTestId("message-user")).toContainText(composed);
  await expect(input).toHaveValue("");
});

test("CHAT-07 REF-15 real assistant votes persist across reload and deny another account", async ({ page, account, playwright, createAccount }) => {
  test.setTimeout(180_000);
  const id = await openChat(page);
  await page.getByRole("textbox", { name: "영어 메시지" }).fill("Please greet me in one short sentence.");
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  await waitAnswer(id);
  const assistant = page.getByTestId("message-assistant").last();
  const messageId = (await messages(id)).find(row => row.role === "assistant")!.id;
  await expect(assistant).toHaveAttribute("data-message-id", messageId);
  async function votes() {
    const result = await adminClient().from("message_feedback").select("user_id,rating,reason").eq("message_id", messageId);
    expect(result.error).toBeNull(); return result.data!;
  }
  await assistant.hover();
  await assistant.getByRole("button", { name: "좋아요", exact: true }).click();
  await expect.poll(votes).toEqual([{ user_id: account!.id, rating: 1, reason: null }]);
  await page.reload();
  await expect(assistant.getByRole("button", { name: "좋아요", exact: true })).toHaveAttribute("aria-pressed", "true");
  await assistant.hover();
  await assistant.getByRole("button", { name: "싫어요", exact: true }).click();
  await assistant.getByLabel("싫어요 이유", { exact: true }).selectOption("정확하지 않음");
  await expect.poll(votes).toEqual([{ user_id: account!.id, rating: -1, reason: "정확하지 않음" }]);
  await page.reload();
  await expect(assistant.getByRole("button", { name: "싫어요", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(assistant.getByLabel("싫어요 이유", { exact: true })).toHaveValue("정확하지 않음");
  const other = await playwright.request.newContext({ baseURL: "http://dodonet.iptime.org:13000" });
  try {
    await signIn(other, await createAccount());
    const denied = await other.post(`/api/messages/${messageId}/vote`, { headers: { Origin: "http://dodonet.iptime.org:13000" }, data: { rating: 1 } });
    expect([403, 404]).toContain(denied.status());
    expect(await votes()).toEqual([{ user_id: account!.id, rating: -1, reason: "정확하지 않음" }]);
  } finally { await other.dispose(); }
  await assistant.hover();
  await assistant.getByRole("button", { name: "싫어요", exact: true }).click();
  await expect.poll(votes).toEqual([]);
  await page.reload();
  await expect(assistant.getByRole("button", { name: "싫어요", exact: true })).toHaveAttribute("aria-pressed", "false");
});


test("CHAT-06/07 REF-15/16 replacing a branch removes only discarded-answer feedback and does not transfer it to new answers", async ({ page, account }) => {
  test.setTimeout(240_000);
  const id = await openChat(page);
  const input = page.getByRole("textbox", { name: "영어 메시지", exact: true });
  for (const [index, prompt] of ["Please greet me briefly.", "Please give me one short hotel checkout sentence."].entries()) {
    await input.fill(prompt);
    await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
    await expect.poll(async () => (await messages(id)).filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length, { timeout: 120_000 }).toBe(index + 1);
    await expect(page.getByRole("button", { name: "메시지 보내기", exact: true })).toBeVisible();
  }
  const assistants = page.getByTestId("message-assistant");
  const firstId = (await assistants.first().getAttribute("data-message-id"))!;
  const discardedId = (await assistants.last().getAttribute("data-message-id"))!;
  async function feedback() {
    const result = await adminClient().from("message_feedback").select("message_id,rating,reason").eq("user_id", account!.id).order("message_id");
    expect(result.error).toBeNull(); return result.data!;
  }
  await assistants.first().hover();
  await assistants.first().getByRole("button", { name: "좋아요", exact: true }).click();
  await expect.poll(feedback).toEqual([{ message_id: firstId, rating: 1, reason: null }]);
  await assistants.last().hover();
  await assistants.last().getByRole("button", { name: "싫어요", exact: true }).click();
  await assistants.last().getByLabel("싫어요 이유", { exact: true }).selectOption("정확하지 않음");
  await expect.poll(feedback).toEqual([
    { message_id: firstId, rating: 1, reason: null },
    { message_id: discardedId, rating: -1, reason: "정확하지 않음" },
  ].sort((a, b) => a.message_id.localeCompare(b.message_id)));
  await page.getByTestId("message-user").last().hover();
  await page.getByTestId("message-user").last().getByRole("button", { name: "메시지 편집", exact: true }).click();
  const edited = "Please give me one short restaurant greeting instead.";
  await input.fill(edited);
  await page.getByRole("button", { name: "수정한 메시지 보내기", exact: true }).click();
  await expect.poll(async () => (await messages(id)).some(row => row.role === "user" && row.plain_text === edited)).toBe(true);
  await expect.poll(async () => (await messages(id)).filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length, { timeout: 120_000 }).toBe(2);
  await expect(page.getByRole("button", { name: "메시지 보내기", exact: true })).toBeVisible();
  await expect.poll(feedback).toEqual([{ message_id: firstId, rating: 1, reason: null }]);
  const replacementId = (await assistants.last().getAttribute("data-message-id"))!;
  expect(replacementId).not.toBe(discardedId);
  expect((await messages(id)).some(row => row.id === discardedId)).toBe(false);
  const replay = await page.request.post(`/api/messages/${discardedId}/vote`, { headers: { Origin: "http://dodonet.iptime.org:13000" }, data: { rating: 1 } });
  expect(replay.status()).toBe(404);
  await page.reload();
  await expect(assistants.first()).toHaveAttribute("data-message-id", firstId);
  await expect(assistants.first().getByRole("button", { name: "좋아요", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(assistants.last().getByRole("button", { name: "싫어요", exact: true })).toHaveAttribute("aria-pressed", "false");
  await assistants.last().hover();
  await assistants.last().getByRole("button", { name: "좋아요", exact: true }).click();
  await expect.poll(async () => (await feedback()).length).toBe(2);
  const regenerated = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith(`/${replacementId}/regenerate`));
  await assistants.last().getByRole("button", { name: "답변 다시 생성", exact: true }).click();
  expect((await regenerated).ok()).toBe(true);
  await expect.poll(async () => (await messages(id)).filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length, { timeout: 120_000 }).toBe(2);
  await expect(page.getByRole("button", { name: "메시지 보내기", exact: true })).toBeVisible();
  await expect.poll(feedback).toEqual([{ message_id: firstId, rating: 1, reason: null }]);
  expect((await messages(id)).some(row => row.id === replacementId)).toBe(false);
  await page.reload();
  await expect(assistants).toHaveCount(2);
  await expect(assistants.first().getByRole("button", { name: "좋아요", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(assistants.last().getByRole("button", { name: "좋아요", exact: true })).toHaveAttribute("aria-pressed", "false");
  expect(await feedback()).toEqual([{ message_id: firstId, rating: 1, reason: null }]);
});

test("CHAT-04 allowed default and two independent conversation models survive real responses and reload", async ({ page, account }, testInfo) => {
  test.setTimeout(300_000);
  const catalogResponse = await page.request.get("/api/ai/models");
  expect(catalogResponse.ok()).toBe(true);
  const catalog = await catalogResponse.json() as { defaultModelId: string; items: Array<{ id: string }> };
  const allowed = catalog.items.map(item => item.id);
  expect(allowed).toContain(catalog.defaultModelId);
  const alternative = ["gpt-5.6-sol", ...allowed].find(id => id !== catalog.defaultModelId && allowed.includes(id));
  expect(alternative, "This live independence case requires two allowed text models").toBeTruthy();
  const firstId = await openChat(page);
  await expect(page).toHaveURL(new RegExp(`conversation=${firstId}`));
  const firstUrl = page.url();
  const selector = page.getByRole("combobox", { name: "AI 모델 선택", exact: true });
  await expect(selector).toBeEnabled();
  await expect(selector).toHaveValue(catalog.defaultModelId);
  async function storedModels(ids: string[]) {
    const rows = await adminClient().from("conversations").select("id,owner_id,model_id").in("id", ids).order("id");
    expect(rows.error).toBeNull();
    return rows.data!;
  }
  expect(await storedModels([firstId])).toEqual([{ id: firstId, owner_id: account!.id, model_id: catalog.defaultModelId }]);
  await selector.selectOption(alternative!);
  await expect.poll(async () => (await storedModels([firstId]))[0].model_id).toBe(alternative);

  const secondId = await openChat(page);
  expect(secondId).not.toBe(firstId);
  await expect(page).toHaveURL(new RegExp(`conversation=${secondId}`));
  const secondUrl = page.url();
  await expect(selector).toBeEnabled();
  await expect(selector).toHaveValue(catalog.defaultModelId);
  const expectedModels = [
    { id: firstId, owner_id: account!.id, model_id: alternative! },
    { id: secondId, owner_id: account!.id, model_id: catalog.defaultModelId },
  ].sort((left, right) => left.id.localeCompare(right.id));
  expect(await storedModels([firstId, secondId])).toEqual(expectedModels);

  for (const [id, url, chosenModel] of [[firstId, firstUrl, alternative!], [secondId, secondUrl, catalog.defaultModelId]]) {
    await page.goto(url);
    await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", id);
    await expect(selector).toBeEnabled();
    await expect(selector).toHaveValue(chosenModel);
    await page.reload();
    await expect(selector).toBeEnabled();
    await expect(selector).toHaveValue(chosenModel);
    const prompt = `Please give one short English greeting for practice session ${id}.`;
    await page.getByRole("textbox", { name: "영어 메시지", exact: true }).fill(prompt);
    const generated = page.waitForResponse(response => new URL(response.url()).pathname === "/api/ai/chat" && response.request().method() === "POST");
    await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
    const response = await generated;
    expect(response.ok()).toBe(true);
    expect(response.headers()["x-ai-provider"]).not.toBe("mock");
    expect(response.headers()["x-ai-model"]).toBe(chosenModel);
    await waitAnswer(id);
    const rows = await messages(id);
    expect(rows).toHaveLength(2);
    expect(rows.find(row => row.role === "user")?.plain_text).toBe(prompt);
    expect(rows.find(row => row.role === "assistant")?.model_id).toBe(chosenModel);
    expect(await storedModels([firstId, secondId])).toEqual(expectedModels);
  }
  for (const [id, url, chosenModel] of [[firstId, firstUrl, alternative!], [secondId, secondUrl, catalog.defaultModelId]]) {
    const before = await messages(id);
    await page.goto(url); await page.reload();
    await expect(selector).toBeEnabled(); await expect(selector).toHaveValue(chosenModel);
    await expect(page.getByTestId("message-user")).toHaveCount(1);
    await expect(page.getByTestId("message-assistant")).toHaveCount(1);
    expect(await messages(id)).toEqual(before);
  }
  expect(await storedModels([firstId, secondId])).toEqual(expectedModels);
  await testInfo.attach("conversation-model-independence", {
    body: JSON.stringify({ defaultModelId: catalog.defaultModelId, alternative, conversations: expectedModels }, null, 2), contentType: "application/json",
  });
});
