import { adminClient, expect, test } from "./fixtures";

// Fault injection aborts only the first outgoing chat request. All subsequent
// requests, Auth, persistence, and AI responses use the actual external service.
test("CHAT-13 interrupted outgoing request restores its unsaved turn and retries exactly once after reload", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  await page.getByRole("button", { name: "새 채팅", exact: true }).click();
  const input = page.getByRole("textbox", { name: "영어 메시지", exact: true });
  await expect(input).toBeEnabled();
  const conversationId = await page.getByTestId("chat-workspace").getAttribute("data-conversation-id");
  expect(conversationId).toMatch(/^[0-9a-f-]{36}$/);
  async function rows() {
    const result = await adminClient().from("messages").select("id,role,status,plain_text,client_message_id")
      .eq("conversation_id", conversationId!).order("sequence_number");
    expect(result.error).toBeNull();
    return result.data!;
  }
  const outgoing: Array<{ id: string; text: string }> = [];
  let releaseFirstRequest!: () => void;
  const firstRequestGate = new Promise<void>(resolve => { releaseFirstRequest = resolve; });
  await page.route("**/api/ai/chat", async route => {
    const body = route.request().postDataJSON();
    const user = body.messages.findLast((message: { role: string }) => message.role === "user");
    outgoing.push({ id: user.id, text: user.parts.filter((part: { type: string }) => part.type === "text").map((part: { text: string }) => part.text).join("\n") });
    if (outgoing.length === 1) { await firstRequestGate; await route.abort("connectionreset"); }
    else await route.continue();
  });
  const text = "Hello! Please teach me one polite greeting in English.";
  await input.fill(text);
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  try {
    // Hold transport before headers to observe the actual submitted UI, without
    // manufacturing an AI response or racing the provider's first token.
    await expect(page.getByText("답변을 생각하는 중", { exact: false })).toBeVisible();
    await expect(page.getByText(/가 생각하고 있어요$/)).toBeVisible();
    await expect(page.getByRole("button", { name: "답변 생성 중지", exact: true })).toBeVisible();
    await expect(page.getByTestId("chat-error")).toHaveCount(0);
  } finally { releaseFirstRequest(); }
  await expect(page.getByTestId("chat-error")).toContainText("답변을 가져오지 못했어요.");
  await expect(page.getByRole("button", { name: "답변 생성 중지", exact: true })).toHaveCount(0);
  await expect(page.getByText(/가 생각하고 있어요$/)).toHaveCount(0);
  await expect(page.getByTestId("message-user")).toHaveCount(1);
  await expect(page.getByTestId("message-user")).toContainText(text);
  expect(outgoing).toHaveLength(1);
  expect(outgoing[0].text).toBe(text);
  expect(outgoing[0].id).toMatch(/^[0-9a-f-]{36}$/);
  expect(await rows()).toEqual([]);
  const draft = "Keep this separate unsent draft.";
  await input.fill(draft);
  await page.reload();
  await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", conversationId!);
  await expect(page.getByTestId("message-user")).toHaveCount(1);
  await expect(page.getByTestId("message-user")).toContainText(text);
  await expect(input).toHaveValue(draft);
  const retry = page.getByRole("button", { name: "저장된 메시지 답변 이어받기", exact: true });
  await expect(retry).toBeVisible();
  expect(outgoing).toHaveLength(1);
  expect(await rows()).toEqual([]);
  await retry.click();
  await expect.poll(async () => (await rows()).filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length,
    { timeout: 120_000 }).toBe(1);
  const saved = await rows();
  expect(saved).toHaveLength(2);
  // The DB allocates its own row ID; the client ID is the retry identity.
  expect(saved[0].id).toMatch(/^[0-9a-f-]{36}$/);
  expect(saved[0]).toMatchObject({ client_message_id: outgoing[0].id, role: "user", plain_text: text });
  expect(outgoing).toEqual([outgoing[0], outgoing[0]]);
  await expect(input).toHaveValue(draft);
  await expect(page.getByTestId("chat-error")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("message-user")).toHaveCount(1);
  await expect(page.getByTestId("message-assistant")).toHaveCount(1);
  await expect(input).toHaveValue(draft);
  await expect(retry).toHaveCount(0);
  expect(outgoing).toHaveLength(2);
  expect(await rows()).toEqual(saved);
  await expect(page.getByText("대화 가능", { exact: false })).toBeVisible();
  await expect(page.getByText(/가 생각하고 있어요$/)).toHaveCount(0);
});

// The real server completes and persists a response, but the browser loses its
// transport before receiving it. Explicit retry must restore, not generate twice.
test("CHAT-13 lost completed response restores the saved answer without another AI request", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  await page.getByRole("button", { name: "새 채팅", exact: true }).click();
  const input = page.getByRole("textbox", { name: "영어 메시지", exact: true });
  await expect(input).toBeEnabled();
  const conversationId = await page.getByTestId("chat-workspace").getAttribute("data-conversation-id");
  expect(conversationId).toMatch(/^[0-9a-f-]{36}$/);
  async function rows() {
    const result = await adminClient().from("messages").select("id,role,status,plain_text,client_message_id")
      .eq("conversation_id", conversationId!).order("sequence_number");
    expect(result.error).toBeNull();
    return result.data!;
  }
  let requests = 0;
  await page.route("**/api/ai/chat", async route => {
    requests++;
    if (requests !== 1) { await route.continue(); return; }
    const response = await route.fetch({ timeout: 120_000 });
    expect(response.ok()).toBe(true);
    await response.body();
    await response.dispose();
    await route.abort("connectionreset");
  });
  const text = "Please give me one short English sentence for ordering tea.";
  await input.fill(text);
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  await expect(page.getByTestId("chat-error")).toBeVisible({ timeout: 120_000 });
  await expect.poll(async () => (await rows()).filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length).toBe(1);
  const saved = await rows();
  expect(saved).toHaveLength(2);
  expect(saved[0]).toMatchObject({ role: "user", plain_text: text });
  expect(requests).toBe(1);
  const draft = "My next question is still a draft.";
  await input.fill(draft);
  await page.getByTestId("chat-error").getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.getByTestId("chat-error")).toHaveCount(0);
  await expect(page.getByTestId("message-assistant")).toHaveCount(1);
  await expect(page.getByTestId("message-user")).toHaveCount(1);
  await expect(input).toHaveValue(draft);
  expect(requests).toBe(1);
  expect(await rows()).toEqual(saved);
  const answer = await page.getByTestId("message-assistant").locator("p, li").allTextContents();
  expect(answer.join(" ").trim().length).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByTestId("message-assistant").locator("p, li")).toHaveText(answer);
  await expect(page.getByTestId("message-user")).toHaveCount(1);
  await expect(input).toHaveValue(draft);
  expect(requests).toBe(1);
  expect(await rows()).toEqual(saved);
});
