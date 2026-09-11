import { adminClient, expect, test } from "./fixtures";

test("REF-11 reload during real output without Stop preserves one turn and explicitly recovers it", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
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
  let posts = 0;
  page.on("request", request => {
    if (new URL(request.url()).pathname === "/api/ai/chat" && request.method() === "POST") posts++;
  });
  const prompt = "Please write 80 different numbered English sentences for a hotel guest. Continue through number 80.";
  await input.fill(prompt);
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  const stop = page.getByRole("button", { name: "답변 생성 중지", exact: true });
  await expect(page.getByTestId("message-assistant").last().locator("p, li").first()).not.toBeEmpty();
  await expect(stop).toBeVisible();
  const before = await rows();
  expect(before.map(row => row.role)).toEqual(["user", "assistant"]);
  expect(before[1].status).not.toBe("complete");
  const initialGeneration = await adminClient().from("chat_generations").select("request_id,status")
    .eq("assistant_message_id", before[1].id).single();
  expect(initialGeneration.error).toBeNull();
  expect(initialGeneration.data!.status).toBe("running");
  // No Stop click, route interception, fabricated response, or offline toggle.
  await page.reload();
  await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", conversationId!);
  await expect(page.getByTestId("message-user")).toHaveCount(1);
  await expect(page.getByTestId("message-user")).toContainText(prompt);
  await expect.poll(async () => (await rows())[1]?.status, { timeout: 30_000 }).toBe("cancelled");
  expect(posts).toBe(1);
  const interrupted = await rows();
  expect(interrupted.map(row => row.id)).toEqual(before.map(row => row.id));
  const cancelledGeneration = await adminClient().from("chat_generations").select("request_id,status")
    .eq("assistant_message_id", before[1].id).single();
  expect(cancelledGeneration.error).toBeNull();
  expect(cancelledGeneration.data).toEqual({ request_id: initialGeneration.data!.request_id, status: "cancelled" });
  const retry = page.getByRole("button", { name: "저장된 메시지 답변 이어받기", exact: true });
  await expect(retry).toBeVisible();
  const draft = "Please keep this separate draft after recovery.";
  await input.fill(draft);
  await retry.click();
  await expect.poll(async () => (await rows())[1]?.status, { timeout: 120_000 }).toBe("complete");
  await expect(stop).toHaveCount(0);
  const completed = await rows();
  expect(completed.map(row => row.id)).toEqual(before.map(row => row.id));
  expect(completed[0]).toEqual(before[0]);
  expect(completed[1].plain_text.trim().length).toBeGreaterThan(200);
  const finalGeneration = await adminClient().from("chat_generations").select("request_id,status")
    .eq("assistant_message_id", before[1].id).single();
  expect(finalGeneration.error).toBeNull();
  expect(finalGeneration.data!.status).toBe("complete");
  expect(finalGeneration.data!.request_id).not.toBe(initialGeneration.data!.request_id);
  expect(posts).toBe(2);
  await expect(input).toHaveValue(draft);
  const rendered = await page.getByTestId("message-assistant").locator("p, li").allTextContents();
  expect(rendered.join(" ").length).toBeGreaterThan(200);
  await page.reload();
  await expect(page.getByTestId("message-assistant").locator("p, li")).toHaveText(rendered);
  await expect(retry).toHaveCount(0);
  await expect(input).toHaveValue(draft);
  expect(posts).toBe(2);
  expect(await rows()).toEqual(completed);
  await testInfo.attach("midstream-reload-recovery", {
    body: JSON.stringify({ conversationId, userId: before[0].id, assistantId: before[1].id,
      initialRequestId: initialGeneration.data!.request_id, retryRequestId: finalGeneration.data!.request_id,
      cancelledPartialLength: interrupted[1].plain_text.length, completedLength: completed[1].plain_text.length, posts }),
    contentType: "application/json",
  });
});

test("CHAT-03/13 REF-09/10/11 stop a real stream, reload without auto-send, and explicitly retry one persisted turn", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  await page.getByRole("button", { name: "새 채팅", exact: true }).click();
  const input = page.getByRole("textbox", { name: "영어 메시지", exact: true });
  await expect(input).toBeEnabled();
  const id = await page.getByTestId("chat-workspace").getAttribute("data-conversation-id");
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  async function stored() {
    const result = await adminClient().from("messages").select("id,role,status,plain_text,client_message_id")
      .eq("conversation_id", id!).order("sequence_number");
    expect(result.error).toBeNull();
    return result.data!;
  }
  const text = "Please write 80 different short English sentences a hotel guest can practice. Number every sentence and continue through number 80.";
  const requests: string[] = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname === "/api/ai/chat" && request.method() === "POST") requests.push(request.url());
  });
  const firstResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/ai/chat" && response.request().method() === "POST");
  await input.fill(text);
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  const initialRequestId = (await firstResponse).headers()["x-request-id"];
  expect(initialRequestId).toMatch(/^[0-9a-f-]{36}$/);
  const stop = page.getByRole("button", { name: "답변 생성 중지", exact: true });
  await expect(stop).toBeVisible();
  // Observe real text before stopping, so this tests mid-stream cancellation.
  await expect(page.getByTestId("message-assistant").last().locator("p, li").first()).not.toBeEmpty();
  await stop.click();
  await expect(stop).toHaveCount(0);
  await expect.poll(async () => (await stored()).find(row => row.role === "assistant")?.status,
    { timeout: 30_000 }).toBe("cancelled");
  const interrupted = await stored();
  expect(interrupted.filter(row => row.role === "user")).toHaveLength(1);
  const userId = interrupted.find(row => row.role === "user")!.id;
  const assistantId = interrupted.find(row => row.role === "assistant")!.id;
  const cancelledGeneration = await adminClient().from("chat_generations").select("request_id,status").eq("assistant_message_id", assistantId).single();
  expect(cancelledGeneration.error).toBeNull();
  expect(cancelledGeneration.data).toEqual({ request_id: initialRequestId, status: "cancelled" });
  const sentBeforeReload = requests.length;
  await page.reload();
  await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", id!);
  await expect(page.getByTestId("message-user")).toHaveCount(1);
  await expect(page.getByTestId("message-user")).toContainText(text);
  const retry = page.getByRole("button", { name: "저장된 메시지 답변 이어받기", exact: true });
  await expect(retry).toBeVisible();
  expect(requests).toHaveLength(sentBeforeReload);
  expect(await stored()).toEqual(interrupted);
  const retriedResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/ai/chat" && response.request().method() === "POST");
  await retry.click();
  const retryRequestId = (await retriedResponse).headers()["x-request-id"];
  expect(retryRequestId).toMatch(/^[0-9a-f-]{36}$/);
  expect(retryRequestId).not.toBe(initialRequestId);
  await expect.poll(async () => (await stored()).filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length,
    { timeout: 120_000 }).toBe(1);
  const completed = await stored();
  expect(completed.map(row => row.id)).toEqual([userId, assistantId]);
  const completedGeneration = await adminClient().from("chat_generations").select("request_id,status").eq("assistant_message_id", assistantId).single();
  expect(completedGeneration.error).toBeNull();
  expect(completedGeneration.data).toEqual({ request_id: retryRequestId, status: "complete" });
  await testInfo.attach("request-correlations", { body: JSON.stringify([
    { requestId: initialRequestId, conversationId: id, assistantMessageId: assistantId, outcome: "aborted" },
    { requestId: retryRequestId, conversationId: id, assistantMessageId: assistantId, outcome: "success" },
  ]), contentType: "application/json" });
  expect(requests).toHaveLength(sentBeforeReload + 1);
  await expect(stop).toHaveCount(0);
  await expect.poll(async () => (await page.getByTestId("message-assistant").locator("p, li").allTextContents()).join(" ").length).toBeGreaterThan(200);
  const renderedAnswer = await page.getByTestId("message-assistant").locator("p, li").allTextContents();
  expect(renderedAnswer.join(" ").length).toBeGreaterThan(200);
  await page.reload();
  await expect(page.getByTestId("message-assistant")).toHaveCount(1);
  // Markdown list markers render structurally; compare rendered content on reload.
  await expect(page.getByTestId("message-assistant").locator("p, li")).toHaveText(renderedAnswer);
  await expect(retry).toHaveCount(0);
  expect(await stored()).toEqual(completed);
});
