import { randomUUID } from "node:crypto";
import { adminClient, expect, test } from "./fixtures";

const headers = { Origin: "http://dodonet.iptime.org:13000" };

for (const kind of ["mission", "free"] as const) {
  test(`DISC-01 home resumes the exact saved ${kind} conversation without creating another conversation or attempt`, async ({ page, account }) => {
    if (kind === "mission") {
      const response = await page.request.get("/api/missions");
      expect(response.ok()).toBe(true);
      const { items } = await response.json() as { items: Array<{ id: string; recommendedCharacterId?: string; prerequisites: string[] }> };
      const mission = items.find(item => item.recommendedCharacterId && !item.prerequisites.length);
      expect(mission).toBeDefined();
      await page.goto(`/missions/${mission!.id}`);
      await page.getByTestId("start-mission").click();
    } else {
      await page.goto("/");
      await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
      await page.getByRole("button", { name: "새 채팅", exact: true }).click();
    }
    await expect(page.getByTestId("chat-input")).toBeEnabled();
    const conversationId = await page.getByTestId("chat-workspace").getAttribute("data-conversation-id");
    expect(conversationId).toMatch(/^[0-9a-f-]{36}$/);
    const text = `Resume my saved ${kind} practice ${randomUUID()}.`;
    // Store a genuine learner turn; this scenario doesn't require an AI reply.
    const stored = await page.request.post(`/api/conversations/${conversationId}/messages`, {
      headers, data: { clientMessageId: randomUUID(), parts: [{ type: "text", text }] },
    });
    expect(stored.ok()).toBe(true);
    async function state() {
      const [conversations, runs, messages] = await Promise.all([
        adminClient().from("conversations").select("id,character_id,mission_id").eq("owner_id", account!.id).order("id"),
        adminClient().from("mission_runs").select("id,conversation_id,attempt_number,status").eq("owner_id", account!.id).order("id"),
        adminClient().from("messages").select("id,role,parts").eq("conversation_id", conversationId!).order("id"),
      ]);
      for (const result of [conversations, runs, messages]) expect(result.error).toBeNull();
      return { conversations: conversations.data!, runs: runs.data!, messages: messages.data! };
    }
    const before = await state();
    expect(before.conversations).toHaveLength(1);
    expect(before.runs).toHaveLength(kind === "mission" ? 1 : 0);
    expect(before.messages).toHaveLength(1);
    await page.goto("/");
    const card = page.getByTestId("continue-learning");
    await expect(card).toBeVisible();
    await expect(card).toContainText(text);
    await expect(card.getByTestId("continue-learning-status")).toHaveText("저장된 대화에서 이어갑니다.");
    await expect(card).toContainText("1개 메시지");
    const resume = card.getByRole("link", { name: "이어서 대화", exact: true });
    const href = await resume.getAttribute("href");
    expect(new URL(href!, headers.Origin).searchParams.get("conversation")).toBe(conversationId);
    await resume.click();
    await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", conversationId!);
    await expect(page.getByTestId("message-user")).toContainText(text);
    await expect(page.getByTestId("chat-input")).toBeEnabled();
    expect(await state()).toEqual(before);
    await page.reload();
    await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", conversationId!);
    await expect(page.getByTestId("message-user")).toContainText(text);
    expect(await state()).toEqual(before);
  });
}
