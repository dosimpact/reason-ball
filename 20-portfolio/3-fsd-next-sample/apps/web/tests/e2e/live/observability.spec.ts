import { randomUUID } from "node:crypto";
import { adminClient, expect, test } from "./fixtures";

const uuid = /^[0-9a-f-]{36}$/;
test("NFR-09 request IDs link real responses to owned generation records and isolate a rejected request", async ({ page, account }, testInfo) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  await page.getByRole("button", { name: "새 채팅", exact: true }).click();
  const input = page.getByRole("textbox", { name: "영어 메시지", exact: true });
  await expect(input).toBeEnabled();
  const id = (await page.getByTestId("chat-workspace").getAttribute("data-conversation-id"))!;
  async function generations() {
    const result = await adminClient().from("chat_generations")
      .select("request_id,user_message_id,assistant_message_id,status").eq("conversation_id", id).order("request_id");
    expect(result.error).toBeNull(); return result.data!;
  }
  const correlations: Array<Record<string, unknown>> = [];
  let firstPayload: Record<string, unknown> | undefined;
  for (const [index, prompt] of ["Please greet me in one short sentence.", "Thank you. Please suggest one short practice sentence."].entries()) {
    const suppliedId = randomUUID();
    await page.setExtraHTTPHeaders({ "X-Request-Id": suppliedId });
    await input.fill(prompt);
    const pending = page.waitForResponse(response => new URL(response.url()).pathname === "/api/ai/chat" && response.request().method() === "POST");
    await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
    const response = await pending;
    expect(response.ok()).toBe(true);
    const requestId = response.headers()["x-request-id"];
    expect(requestId).toMatch(uuid); expect(requestId).not.toBe(suppliedId);
    expect(response.headers()["x-ai-provider"]).toBe("oauth-proxy");
    await expect.poll(async () => (await generations()).filter(row => row.status === "complete").length, { timeout: 120_000 }).toBe(index + 1);
    const generation = (await generations()).find(row => row.request_id === requestId);
    expect(generation).toBeDefined();
    const messages = await adminClient().from("messages").select("id,conversation_id,author_id,role,status,plain_text")
      .in("id", [generation!.user_message_id, generation!.assistant_message_id]);
    expect(messages.error).toBeNull(); expect(messages.data).toHaveLength(2);
    expect(messages.data!.every(row => row.conversation_id === id && row.status === "complete")).toBe(true);
    expect(messages.data!.find(row => row.id === generation!.user_message_id)).toMatchObject({ author_id: account!.id, role: "user", plain_text: prompt });
    const answer = messages.data!.find(row => row.id === generation!.assistant_message_id)!;
    expect(answer.role).toBe("assistant"); expect(answer.plain_text.trim()).not.toBe("");
    await expect(page.locator(`[data-message-id="${answer.id}"]`)).toBeVisible();
    correlations.push({ requestId, conversationId: id, assistantMessageId: answer.id, outcome: "success" });
    firstPayload ??= response.request().postDataJSON();
  }
  const before = await generations();
  await input.fill("Preserve my unsent draft.");
  const denied = await page.request.post("/api/ai/chat", {
    headers: { Origin: "http://dodonet.iptime.org:13000" },
    data: { ...firstPayload, modelId: `unavailable-${randomUUID()}` },
  });
  expect(denied.status()).toBe(400);
  const error = await denied.json();
  const errorId = denied.headers()["x-request-id"];
  expect(errorId).toMatch(uuid);
  expect(error).toMatchObject({ requestId: errorId, code: "MODEL_NOT_ALLOWED", retryable: false });
  expect(correlations.map(row => row.requestId)).not.toContain(errorId);
  expect(await generations()).toEqual(before);
  await expect(input).toHaveValue("Preserve my unsent draft.");
  correlations.push({ requestId: errorId, outcome: "error", code: error.code });
  await testInfo.attach("request-correlations", { body: JSON.stringify(correlations), contentType: "application/json" });
  await page.reload();
  await expect(input).toHaveValue("Preserve my unsent draft.");
  expect(await generations()).toEqual(before);
});
