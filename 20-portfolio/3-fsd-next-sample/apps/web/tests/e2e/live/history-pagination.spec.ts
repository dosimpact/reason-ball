import { randomUUID } from "node:crypto";
import { adminClient, expect, test } from "./fixtures";

const headers = { Origin: "http://dodonet.iptime.org:13000" };

test("REF-18 history crosses 50 records, groups dates, searches the oldest message and resumes its exact conversation", async ({ page, account }) => {
  test.setTimeout(240_000);
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
  await page.getByRole("button", { name: "새 채팅", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "영어 메시지", exact: true })).toBeEnabled();
  const initial = await page.getByTestId("chat-workspace").getAttribute("data-conversation-id");
  const seed = await adminClient().from("conversations").select("character_id").eq("id", initial!).eq("owner_id", account!.id).single();
  expect(seed.error).toBeNull();
  const marker = randomUUID();
  const records = [{ id: initial!, title: `History ${marker} 00` }];
  const renamed = await page.request.patch(`/api/conversations/${initial}`, { headers, data: { action: "update", title: records[0].title } });
  expect(renamed.ok()).toBe(true);
  // Ordinary authenticated creation APIs make all owned rows; only historical
  // timestamps below are fixture setup. No AI or fake history responses.
  for (let offset = 1; offset < 51; offset += 5) {
    const batch = await Promise.all(Array.from({ length: Math.min(5, 51 - offset) }, async (_, step) => {
      const index = offset + step;
      const title = `History ${marker} ${String(index).padStart(2, "0")}`;
      const created = await page.request.post("/api/conversations", { headers, data: { id: randomUUID(), characterId: seed.data!.character_id, title } });
      expect(created.ok(), await created.text()).toBe(true);
      return { id: (await created.json()).item.id as string, title };
    }));
    records.push(...batch);
  }
  const oldest = records.at(-1)!;
  const phrase = `Reopen oldest private phrase ${marker}`;
  const saved = await page.request.post(`/api/conversations/${oldest.id}/messages`, { headers, data: { clientMessageId: randomUUID(), parts: [{ type: "text", text: phrase }] } });
  expect(saved.ok(), await saved.text()).toBe(true);
  // A bounded bulk fixture exercises the real Data API row cap as well. These
  // are owned stored user messages, not 1,000 browser sends or AI responses.
  for (let offset = 0; offset < 1000; offset += 250) {
    const inserted = await adminClient().from("messages").insert(Array.from({ length: 250 }, (_, step) => ({
      conversation_id: records[1].id, author_id: account!.id, role: "user", status: "complete",
      parts: [{ type: "text", text: `Stored history fixture ${offset + step}` }],
      plain_text: `Stored history fixture ${offset + step}`,
    })));
    expect(inserted.error).toBeNull();
  }
  const times = await page.evaluate(() => {
    const now = Date.now();
    return Array.from({ length: 51 }, (_, index) => {
      if (index < 3) return new Date(now - index * 1000).toISOString();
      const date = new Date(now);
      date.setDate(date.getDate() - (index < 6 ? 1 : 7));
      date.setHours(12, 0, 0, 0);
      return new Date(date.getTime() - index * 1000).toISOString();
    });
  });
  for (let offset = 0; offset < records.length; offset += 5) {
    await Promise.all(records.slice(offset, offset + 5).map(async (record, step) => {
      const result = await adminClient().from("conversations").update({ last_message_at: times[offset + step] }).eq("id", record.id).eq("owner_id", account!.id);
      expect(result.error).toBeNull();
    }));
  }
  const owned = await adminClient().from("conversations").select("id").eq("owner_id", account!.id).neq("status", "deleted");
  expect(owned.error).toBeNull(); expect(owned.data).toHaveLength(51);
  await page.goto("/history");
  const cards = page.getByTestId("persisted-history");
  await expect(cards).toHaveCount(4);
  const more = page.getByTestId("history-load-more");
  for (let count = 4; count < records.length; count += 4) {
    await expect(more).toBeVisible();
    await more.click();
    await expect(cards).toHaveCount(Math.min(count + 4, records.length));
  }
  await expect(more).toHaveCount(0);
  await expect(cards.getByRole("heading", { level: 3 })).toHaveText(records.map(record => record.title));
  const busy = cards.filter({ has: page.getByRole("heading", { name: records[1].title, exact: true }) });
  await expect(busy).toContainText("1000 turns");
  await expect(busy).toContainText("Stored history fixture 999");
  for (const [group, count] of [["오늘", 3], ["어제", 3], ["이전", 45]] as const) {
    await expect(page.getByTestId(`history-group-${group}`).getByTestId("persisted-history")).toHaveCount(count);
  }
  const search = page.getByRole("searchbox", { name: "대화 기록 검색", exact: true });
  await search.fill(phrase.toUpperCase());
  await expect(cards).toHaveCount(1);
  await expect(cards.getByRole("heading", { level: 3 })).toHaveText(oldest.title);
  await expect(more).toHaveCount(0);
  await search.fill(`not-present-${marker}`);
  await expect(page.getByText("검색한 대화 기록이 없어요.", { exact: true })).toBeVisible();
  await search.fill("");
  await expect(cards).toHaveCount(4);
  await search.fill(oldest.title);
  await cards.getByRole("link", { name: "이어서 대화", exact: true }).click();
  await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", oldest.id);
  await expect(page.getByTestId("message-user")).toHaveCount(1);
  await expect(page.getByTestId("message-user").getByText(phrase, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", oldest.id);
  await expect(page.getByTestId("message-user")).toHaveCount(1);
  await expect(page.getByTestId("message-user").getByText(phrase, { exact: true })).toBeVisible();
  const after = await adminClient().from("conversations").select("id").eq("owner_id", account!.id);
  expect(after.error).toBeNull(); expect(after.data).toHaveLength(51);
});
