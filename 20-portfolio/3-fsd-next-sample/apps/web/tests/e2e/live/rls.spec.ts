import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, signIn, test } from "./fixtures";

const origin = "http://dodonet.iptime.org:13000";
function publicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function directRows(client: SupabaseClient, conversationId: string) {
  const conversation = await client.from("conversations").select("id").eq("id", conversationId);
  const messages = await client.from("messages").select("id, role, plain_text").eq("conversation_id", conversationId);
  expect(conversation.error).toBeNull();
  expect(messages.error).toBeNull();
  return { conversations: conversation.data!, messages: messages.data! };
}

// CHAT-08 / REF-20. Business privacy requirements require revocable, unguessable share tokens;
// development §RLS explicitly distinguishes private/unlisted through share-token validation.
// An unrelated JWT without that token must not enumerate unlisted conversation rows or messages.
test("direct Supabase JWT cannot read private or unlisted chats without token while shared-link UI works", async ({ page, account, createAccount, browser }) => {
  const owner = publicClient();
  const other = publicClient();
  const anonymous = publicClient();
  const otherAccount = await createAccount();
  expect((await owner.auth.signInWithPassword({ email: account!.email, password: account!.password })).error).toBeNull();
  expect((await other.auth.signInWithPassword({ email: otherAccount.email, password: otherAccount.password })).error).toBeNull();
  const viewerContext = await browser.newContext({ baseURL: origin });
  try {
    await signIn(viewerContext.request, otherAccount);
    await page.goto("/");
    await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
    await page.getByRole("button", { name: "새 채팅", exact: true }).click();
    await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", /^[0-9a-f-]{36}$/);
    const id = (await page.getByTestId("chat-workspace").getAttribute("data-conversation-id"))!;
    const phrase = `Private RLS user message ${randomUUID()}`;
    const saved = await page.request.post(`/api/conversations/${id}/messages`, {
      headers: { Origin: origin }, data: { clientMessageId: randomUUID(), parts: [{ type: "text", text: phrase }] },
    });
    expect(saved.ok()).toBe(true);
    const owned = await directRows(owner, id);
    expect(owned.conversations).toEqual([{ id }]);
    expect(owned.messages).toEqual([expect.objectContaining({ role: "user", plain_text: phrase })]);
    expect(await directRows(other, id)).toEqual({ conversations: [], messages: [] });
    expect(await directRows(anonymous, id)).toEqual({ conversations: [], messages: [] });
    await page.reload();
    await expect(page.getByTestId("message-user")).toContainText(phrase);
    await page.getByRole("button", { name: "대화 공유", exact: true }).click();
    const href = await page.getByRole("dialog", { name: "대화 공유", exact: true }).getByRole("link", { name: "읽기 전용 화면 열기" }).getAttribute("href");
    expect(href).toMatch(/^\/shared\//);
    const viewer = await viewerContext.newPage();
    await viewer.goto(href!);
    await expect(viewer.getByLabel("공유된 메시지")).toContainText(phrase);
    await expect(viewer.getByRole("textbox", { name: "영어 메시지" })).toHaveCount(0);
    // SDK requests carry B's JWT only: no share token, browser cookie, or privileged key.
    expect.soft(await directRows(other, id), "Unlisted is token-gated, not all-member-readable").toEqual({ conversations: [], messages: [] });
    expect.soft(await directRows(anonymous, id)).toEqual({ conversations: [], messages: [] });
    const canView = await other.rpc("can_view_conversation", { _conversation_id: id });
    expect(canView.error).toBeNull();
    expect.soft(canView.data, "RLS visibility helper must not authorize unlisted without token").toBe(false);
    expect(await directRows(owner, id)).toEqual(owned);
    const revoked = await page.request.patch(`/api/conversations/${id}`, {
      headers: { Origin: origin }, data: { action: "update", visibility: "private" },
    });
    expect(revoked.ok()).toBe(true);
    await viewer.reload();
    await expect(viewer.getByRole("heading", { name: "공유 대화를 찾을 수 없어요." })).toBeVisible();
    expect(await directRows(other, id)).toEqual({ conversations: [], messages: [] });
    expect(await directRows(owner, id)).toEqual(owned);
  } finally {
    await viewerContext.request.post("/api/auth/logout", { headers: { Origin: origin } });
    await viewerContext.close();
    await owner.auth.signOut();
    await other.auth.signOut();
  }
});

test("CHAT-08 public chat permits anonymous and member reads, denies foreign writes and revokes both on private transition", async ({ page, account, createAccount, browser, playwright }) => {
  const owner = publicClient();
  const other = publicClient();
  const anonymous = publicClient();
  const otherAccount = await createAccount();
  expect((await owner.auth.signInWithPassword({ email: account!.email, password: account!.password })).error).toBeNull();
  expect((await other.auth.signInWithPassword({ email: otherAccount.email, password: otherAccount.password })).error).toBeNull();
  const viewerContext = await browser.newContext({ baseURL: origin });
  const anonymousHttp = await playwright.request.newContext({ baseURL: origin });
  try {
    await signIn(viewerContext.request, otherAccount);
    await page.goto("/");
    await expect(page.getByTestId("app-shell")).toHaveAttribute("data-shortcuts-ready", "true");
    await page.getByRole("button", { name: "새 채팅", exact: true }).click();
    await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-conversation-id", /^[0-9a-f-]{36}$/);
    const id = (await page.getByTestId("chat-workspace").getAttribute("data-conversation-id"))!;
    const phrase = `Disposable public conversation ${randomUUID()}`;
    expect((await page.request.post(`/api/conversations/${id}/messages`, {
      headers: { Origin: origin }, data: { clientMessageId: randomUUID(), parts: [{ type: "text", text: phrase }] },
    })).ok()).toBe(true);
    const owned = await directRows(owner, id);
    expect(owned.messages).toEqual([expect.objectContaining({ role: "user", plain_text: phrase })]);
    const published = await page.request.patch(`/api/conversations/${id}`, {
      headers: { Origin: origin }, data: { action: "update", visibility: "public" },
    });
    expect(published.ok()).toBe(true);
    const { shareToken } = await published.json();
    expect(shareToken).toMatch(/^[0-9a-f-]{36}$/);
    const publicConversation = await owner.from("conversations").select("id,title,visibility").eq("id", id).single();
    expect(publicConversation.error).toBeNull();
    expect(publicConversation.data?.visibility).toBe("public");
    for (const reader of [anonymous, other]) {
      expect(await directRows(reader, id)).toEqual(owned);
      const writableConversation = await reader.from("conversations").update({ title: "Unauthorized replacement" }).eq("id", id).select("id");
      expect(writableConversation.data ?? []).toEqual([]);
      const writableMessage = await reader.from("messages").update({ plain_text: "Unauthorized replacement" }).eq("id", owned.messages[0].id).select("id");
      expect(writableMessage.data ?? []).toEqual([]);
      const deleted = await reader.from("messages").delete().eq("id", owned.messages[0].id).select("id");
      expect(deleted.data ?? []).toEqual([]);
    }
    for (const request of [anonymousHttp, viewerContext.request]) {
      const shared = await request.get(`/api/share/${shareToken}`);
      expect(shared.ok()).toBe(true);
      const body = await shared.json();
      expect(body.readOnly).toBe(true);
      expect(JSON.stringify(body.messages)).toContain(phrase);
      const denied = await request.post(`/api/conversations/${id}/messages`, {
        headers: { Origin: origin }, data: { clientMessageId: randomUUID(), parts: [{ type: "text", text: "Unauthorized insertion" }] },
      });
      expect([401, 403, 404]).toContain(denied.status());
    }
    expect(await directRows(owner, id)).toEqual(owned);
    const unchangedConversation = await owner.from("conversations").select("id,title,visibility").eq("id", id).single();
    expect(unchangedConversation.error).toBeNull();
    expect(unchangedConversation.data).toEqual(publicConversation.data);
    const viewer = await viewerContext.newPage();
    await viewer.goto(`/shared/${shareToken}`);
    await expect(viewer.getByLabel("공유된 메시지")).toContainText(phrase);
    await expect(viewer.getByRole("textbox", { name: "영어 메시지" })).toHaveCount(0);
    expect((await page.request.patch(`/api/conversations/${id}`, {
      headers: { Origin: origin }, data: { action: "update", visibility: "private" },
    })).ok()).toBe(true);
    for (const reader of [anonymous, other]) expect(await directRows(reader, id)).toEqual({ conversations: [], messages: [] });
    for (const request of [anonymousHttp, viewerContext.request]) expect((await request.get(`/api/share/${shareToken}`)).status()).toBe(404);
    await viewer.reload();
    await expect(viewer.getByRole("heading", { name: "공유 대화를 찾을 수 없어요." })).toBeVisible();
    await expect(viewer.getByLabel("공유된 메시지")).toHaveCount(0);
    expect(await directRows(owner, id)).toEqual(owned);
  } finally {
    await viewerContext.request.post("/api/auth/logout", { headers: { Origin: origin } });
    await viewerContext.close();
    await anonymousHttp.dispose();
    await owner.auth.signOut();
    await other.auth.signOut();
  }
});
