import { adminClient, expect, test } from "./fixtures";

test("TTS-05/08 LEARN-08 real speech provider failure announces loading and retry without changing the conversation", async ({ page }) => {
  test.setTimeout(180_000);
  expect(process.env.AI_PROVIDER, "This scenario verifies the current OAuth proxy without a speech endpoint").toBe("oauth-proxy");
  expect(process.env.AI_SPEECH_PROVIDER).toBeFalsy();
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  await page.getByRole("button", { name: "새 채팅", exact: true }).click();
  const input = page.getByRole("textbox", { name: "영어 메시지", exact: true });
  await expect(input).toBeEnabled();
  const id = (await page.getByTestId("chat-workspace").getAttribute("data-conversation-id"))!;
  await input.fill("Please greet me in one short sentence.");
  await page.getByRole("button", { name: "메시지 보내기", exact: true }).click();
  async function messages() {
    const result = await adminClient().from("messages").select("id,role,status,plain_text").eq("conversation_id", id).order("sequence_number");
    expect(result.error).toBeNull(); return result.data!;
  }
  await expect.poll(async () => (await messages()).filter(row => row.role === "assistant" && row.status === "complete" && row.plain_text.trim()).length, { timeout: 120_000 }).toBe(1);
  const before = await messages();
  const answer = page.getByTestId("message-assistant");
  const audio = answer.getByTestId(/^audio-playback-/);
  await expect(audio.getByText("AI로 생성된 음성입니다.", { exact: true })).toBeVisible();
  await input.fill("Keep this unsent question.");
  const bodies: unknown[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    // Delay delivery only to observe loading; the actual backend generates the error.
    await page.route("**/api/ai/speech", async route => {
      bodies.push(route.request().postDataJSON());
      await gate;
      await route.continue();
    }, { times: 1 });
    const received = page.waitForResponse(response => new URL(response.url()).pathname === "/api/ai/speech" && response.request().method() === "POST", { timeout: 60_000 }).catch(() => null);
    await answer.hover();
    await expect.poll(() => audio.evaluate(element => getComputedStyle(element.parentElement!).opacity)).toBe("1");
    try {
      await audio.getByRole("button", { name: attempt ? "음성 다시 시도" : "AI 음성 듣기", exact: true }).click();
      await expect(audio.getByRole("button", { name: "음성 불러오는 중", exact: true })).toBeDisabled();
      await expect(audio.getByRole("status")).toHaveText("음성을 불러오는 중입니다.");
    } finally { release(); }
    const response = await received;
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(502);
    expect((await response!.json()).code).toBe("AI_PROVIDER_ERROR");
    await expect(audio.getByRole("alert")).toBeVisible();
    await expect(audio.getByRole("status")).toHaveText("음성을 재생하지 못했어요. 다시 시도할 수 있습니다.");
    await expect(audio.getByRole("button", { name: "음성 다시 시도", exact: true })).toBeEnabled();
    await expect(audio.getByText("AI로 생성된 음성입니다.", { exact: true })).toBeVisible();
    await expect(input).toHaveValue("Keep this unsent question.");
    expect(await messages()).toEqual(before);
  }
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toEqual(bodies[0]);
  expect(bodies[0]).toMatchObject({ messageId: before[1].id, text: before[1].plain_text });
  const cache = await adminClient().from("message_audio").select("id").eq("message_id", before[1].id);
  expect(cache.error).toBeNull(); expect(cache.data).toEqual([]);
  await page.reload();
  await expect(audio.getByText("AI로 생성된 음성입니다.", { exact: true })).toBeVisible();
  await expect(input).toHaveValue("Keep this unsent question.");
  expect(await messages()).toEqual(before);
});
