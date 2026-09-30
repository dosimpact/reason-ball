import { adminClient, expect, test } from "./fixtures";

// TOOL-01/02: actual model function call, durable approval, real weather API.
for (const approved of [true, false]) {
  test(`TOOL real weather ${approved ? "approval executes Open-Meteo" : "rejection prevents execution"} and survives reload`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /외우지 말고/ })).toBeVisible();
    await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
    await page.getByRole("button", { name: "새 채팅", exact: true }).click();
    const input = page.getByRole("textbox", { name: "영어 메시지" });
    await expect(input).toBeEnabled();
    await page.getByLabel("AI 모델 선택").selectOption("gpt-5.6-terra");
    await expect(page.getByLabel("선택 모델 기능")).toContainText("도구: 지원");
    const id = (await page.getByTestId("chat-workspace").getAttribute("data-conversation-id"))!;
    async function parts() {
      const result = await adminClient().from("messages").select("parts").eq("conversation_id", id);
      expect(result.error).toBeNull();
      return result.data!.flatMap(row => row.parts as Array<{ type: string; state?: string; output?: { source: string; temperature: number; observedAt: string }; approval?: { approved?: boolean } }>).filter(part => part.type === "tool-weather");
    }
    await input.fill("Please call the weather tool once for Seoul to get current weather. Wait for my approval. Do not invent weather.");
    await input.press("Enter");
    const card = page.getByTestId("weather-tool-card").first();
    await expect(card.getByRole("button", { name: "허용", exact: true })).toBeVisible({ timeout: 120_000 });
    await expect.poll(async () => (await parts()).some(part => part.state === "approval-requested")).toBe(true);
    expect((await parts()).every(part => part.output === undefined)).toBe(true);
    await page.reload();
    await expect(card.getByRole("button", { name: "허용", exact: true })).toBeVisible();
    await card.getByRole("button", { name: approved ? "허용" : "거부", exact: true }).click();
    if (approved) {
      await expect(card).toContainText("Open-Meteo", { timeout: 120_000 });
      await expect.poll(async () => (await parts()).some(part => part.state === "output-available")).toBe(true);
      const output = (await parts()).find(part => part.state === "output-available")!.output!;
      expect(output.source).toBe("Open-Meteo");
      expect(Number.isFinite(output.temperature)).toBe(true);
      expect(Number.isFinite(Date.parse(output.observedAt))).toBe(true);
    } else {
      await expect(card).toContainText("사용자가 날씨 조회를 거부했어요.");
      await expect.poll(async () => (await parts()).some(part => part.state === "output-denied" || part.approval?.approved === false)).toBe(true);
      expect((await parts()).every(part => part.output === undefined)).toBe(true);
    }
    await expect(page.getByRole("button", { name: "메시지 보내기", exact: true })).toBeVisible({ timeout: 120_000 });
    await page.reload();
    await expect(card).toContainText(approved ? "Open-Meteo" : "사용자가 날씨 조회를 거부했어요.");
    await expect(card.getByRole("button", { name: "허용", exact: true })).toHaveCount(0);
    const users = await adminClient().from("messages").select("id").eq("conversation_id", id).eq("role", "user");
    expect(users.error).toBeNull(); expect(users.data).toHaveLength(1);
  });
}
