import { expect, test } from "@playwright/test";
import { createHttpChatRepository } from "../../src/entities/chat/api/http-chat-repository";
import { conversationFromHttp, storedMessagesToChat, voteFromHttp, type ConversationResponseItem, type MessageResponseItem } from "../../src/entities/chat/model/http-conversation";
import type { CreateConversationInput } from "../../src/entities/chat/model/types";

const context: CreateConversationInput = {
  characterId: "11111111-1111-4111-8111-111111111111",
  characterName: "Emma", routeKey: "emma:free", title: "Emma practice",
  messages: [{ id: "local-welcome", role: "assistant", parts: [{ type: "text", text: "Local greeting" }] }],
};

test('regeneration preparation preserves the request key across an uncertain response', async () => {
  const bodies: unknown[] = [];
  const repository = createHttpChatRepository(async (url, init) => {
    expect(url).toBe(`/api/conversations/${conversation.id}/messages/${assistant.id}/regenerate`);
    expect(init?.method).toBe('POST');
    bodies.push(JSON.parse(init!.body as string));
    return bodies.length === 1 ? Response.json({ error: { message: 'Unavailable' } }, { status: 503 }) : Response.json({ item: user });
  });
  await expect(repository.prepareRegeneration(conversation.id, assistant.id, 'same-key')).rejects.toMatchObject({ status: 503 });
  expect(await repository.prepareRegeneration(conversation.id, assistant.id, 'same-key')).toEqual(user);
  expect(bodies).toEqual([{ requestId: 'same-key' }, { requestId: 'same-key' }]);
});

test("branch replacement sends the original tail and retry key without silently refreshing them", async () => {
  const bodies: unknown[] = [];
  const repository = createHttpChatRepository(async (url, init) => {
    expect(url).toBe(`/api/conversations/${conversation.id}/messages/${user.id}`);
    expect(init?.method).toBe('PATCH');
    bodies.push(JSON.parse(init!.body as string));
    return bodies.length === 1 ? Response.json({ error: { message: 'Conflict' } }, { status: 409 }) : Response.json({ item: user });
  });
  await expect(repository.replaceMessageBranch(conversation.id, user.id, assistant.id, 'same-key', user.parts)).rejects.toMatchObject({ status: 409 });
  expect(await repository.replaceMessageBranch(conversation.id, user.id, assistant.id, 'same-key', user.parts)).toEqual(user);
  expect(bodies).toEqual(Array(2).fill({ expectedTailId: assistant.id, requestId: 'same-key', parts: user.parts }));
});

test("clear retries the same key after a lost readback and restores later messages", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  let reads = 0;
  const repository = createHttpChatRepository(async (url, init) => {
    requests.push({ url, init });
    if (init?.method === "DELETE") return Response.json({ cleared: true, deletedCount: 2 });
    return ++reads === 1 ? Response.json({ error: { message: "Read failed" } }, { status: 503 })
      : Response.json({ items: [user], hasMore: false });
  });
  await expect(repository.clearMessages(conversation.id, "same-key")).rejects.toMatchObject({ status: 503 });
  expect(await repository.clearMessages(conversation.id, "same-key")).toEqual([user]);
  const mutations = requests.filter((request) => request.init?.method === "DELETE");
  expect(mutations.map((request) => JSON.parse(request.init!.body as string))).toEqual(Array(2).fill({ requestId: "same-key", confirmation: "CLEAR MESSAGES" }));
  expect(mutations.every((request) => request.url === `/api/conversations/${conversation.id}/messages`)).toBe(true);
});

test("clear never reads or reports success after a rejected mutation", async () => {
  const methods: unknown[] = [];
  const repository = createHttpChatRepository(async (_url, init) => {
    methods.push(init?.method);
    return Response.json({ error: { message: "Generation running", code: "CONVERSATION_NOT_CLEARABLE" } }, { status: 409 });
  });
  await expect(repository.clearMessages(conversation.id, "key")).rejects.toMatchObject({ status: 409 });
  expect(methods).toEqual(["DELETE"]);
});

test("requires purge confirmation and preserves the caller's retry key", async () => {
  const bodies: unknown[] = [];
  const repository = createHttpChatRepository(async (url, init) => {
    expect(url).toBe("/api/conversations");
    expect(init?.method).toBe("DELETE");
    bodies.push(JSON.parse(init!.body as string));
    return bodies.length === 1
      ? Response.json({ error: { message: "Retry", code: "UNAVAILABLE" } }, { status: 503 })
      : Response.json({ deleted: true, deletedCount: 0 });
  });
  await expect(repository.purgeConversations("stable-key", "wrong")).rejects.toThrow("확인 문구");
  expect(bodies).toHaveLength(0);
  await expect(repository.purgeConversations("stable-key", "DELETE ALL")).rejects.toMatchObject({ status: 503 });
  await repository.purgeConversations("stable-key", "DELETE ALL");
  expect(bodies).toEqual(Array(2).fill({ requestId: "stable-key", confirmation: "DELETE ALL" }));
});
const conversation: ConversationResponseItem = {
  id: "33333333-3333-4333-8333-333333333333", characterId: context.characterId,
  missionId: null, title: context.title, status: "active", modelId: "gpt-5.6-terra",
  createdAt: "2026-09-10T00:00:00Z", updatedAt: "2026-09-10T00:01:00Z",
};
const user: MessageResponseItem = {
  id: "44444444-4444-4444-8444-444444444444", clientMessageId: "client-user-1",
  role: "user", status: "complete", parts: [{ type: "text", text: "Hello" }],
  sequenceNumber: 1, createdAt: conversation.createdAt,
};
const assistant: MessageResponseItem = {
  id: "55555555-5555-4555-8555-555555555555", role: "assistant", status: "complete",
  parts: [{ type: "text", text: "Welcome!" }], sequenceNumber: 2, createdAt: conversation.updatedAt,
};

test("creates only server metadata with a stable creation ID and no fabricated greeting", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const repository = createHttpChatRepository(async (url, init) => {
    requests.push({ url, init });
    return Response.json(url === "/api/conversations" ? { item: conversation } : { items: [], hasMore: false });
  });
  const created = await repository.createConversation(context, conversation.id);
  expect(JSON.parse(requests[0].init!.body as string)).toEqual({
    id: conversation.id, characterId: context.characterId, title: context.title, titleMode: "auto",
  });
  expect(created.id).toBe(conversation.id);
  expect(created.messages).toEqual([]);
  expect(requests.every((entry) => entry.init?.cache === "no-store")).toBe(true);
});

test("restores every message page and preserves the user idempotency key", async () => {
  const requests: string[] = [];
  const repository = createHttpChatRepository(async (url) => {
    requests.push(url);
    if (!url.includes("/messages?")) return Response.json({ item: conversation });
    return Response.json(url.endsWith("after=0") ? { items: [user], hasMore: true } : { items: [assistant], hasMore: false });
  });
  const restored = await repository.getConversation(conversation.id, context);
  expect(restored.messages.map((message) => message.id)).toEqual([user.clientMessageId, assistant.id]);
  expect(restored.messages[0].metadata).toEqual({ databaseId: user.id });
  expect(restored.pendingRequest).toBeUndefined();
  expect(requests.at(-1)).toContain("after=1");
});

test("restores a failed turn as retryable without treating its partial response as complete", () => {
  const rows = [user, { ...assistant, status: "error" }];
  const before = structuredClone(rows);
  const restored = conversationFromHttp(conversation, rows, context);
  expect(restored.pendingRequest?.userMessageId).toBe(user.clientMessageId);
  expect(restored.messages).toHaveLength(1);
  expect(rows).toEqual(before);
  expect(storedMessagesToChat([{ ...assistant, role: "system" }])).toEqual([]);
});

test("rejects a different route context or archived conversation", () => {
  expect(() => conversationFromHttp({ ...conversation, characterId: "another-character" }, [], context)).toThrow("일치하지");
  expect(() => conversationFromHttp({ ...conversation, missionId: "another-mission" }, [], context)).toThrow("일치하지");
  expect(() => conversationFromHttp({ ...conversation, status: "archived" }, [], context)).toThrow("보관");
});

test("does not create a replacement conversation after an explicit ID returns 404", async () => {
  const methods: string[] = [];
  const repository = createHttpChatRepository(async (_url, init) => {
    methods.push(init?.method ?? "GET");
    return Response.json({ error: { code: "CONVERSATION_NOT_FOUND", message: "Not found" } }, { status: 404 });
  });
  await expect(repository.getConversation(conversation.id, context)).rejects.toMatchObject({ code: "CONVERSATION_NOT_FOUND", status: 404 });
  expect(methods).toEqual(["GET"]);
});

test("rejects a non-advancing message cursor instead of looping", async () => {
  const repository = createHttpChatRepository(async () => Response.json({ items: [user], hasMore: true }));
  await expect(repository.getMessages(conversation.id)).rejects.toThrow("다음 페이지");
});

test("sends metadata, share, vote and delete mutations to their server endpoints", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const repository = createHttpChatRepository(async (url, init) => {
    requests.push({ url, init });
    return Response.json({ shareToken: "saved-share", deleted: true, vote: { message_id: assistant.id, rating: -1, reason: "Incorrect" } });
  });
  await repository.renameConversation(conversation.id, "Updated title");
  expect(await repository.shareConversation(conversation.id)).toBe("saved-share");
  await repository.vote(assistant.id, "down", "Incorrect");
  await repository.deleteConversation(conversation.id);
  expect(requests.map((request) => request.init?.method)).toEqual(["PATCH", "PATCH", "POST", "DELETE"]);
  expect(JSON.parse(requests[2].init!.body as string)).toEqual({ rating: -1, reason: "Incorrect" });
  expect(requests[2].url).toBe(`/api/messages/${assistant.id}/vote`);
});

test("restores the owner's votes from every message page without mutating rows", async () => {
  const first = { ...assistant, vote: { rating: 1 as const, reason: null } };
  const last = { ...assistant, id: "last-answer", sequenceNumber: 4, vote: { rating: -1 as const, reason: "Incorrect" } };
  const rows = [first, last];
  const before = structuredClone(rows);
  const repository = createHttpChatRepository(async (url) => Response.json(
    !url.includes("/messages?") ? { item: conversation }
      : url.endsWith("after=0") ? { items: [user, first], hasMore: true } : { items: [last], hasMore: false },
  ));
  expect((await repository.getConversation(conversation.id, context)).votes).toEqual({
    [assistant.id]: { value: "up" }, "last-answer": { value: "down", reason: "Incorrect" },
  });
  expect(rows).toEqual(before);
  expect(conversationFromHttp(conversation, [user, assistant, { ...last, status: "error" }], context).votes).toEqual({});
});

test("rejects invalid feedback and never treats a failed feedback page as an empty vote list", async () => {
  for (const invalid of [null, {}, { rating: 0, reason: null }, { rating: 1, reason: 123 }]) {
    expect(() => voteFromHttp(invalid)).toThrow("피드백");
  }
  const repository = createHttpChatRepository(async (url) => !url.includes("/messages?")
    ? Response.json({ item: conversation })
    : Response.json({ error: { message: "Feedback unavailable" } }, { status: 503 }));
  await expect(repository.getConversation(conversation.id, context)).rejects.toMatchObject({ status: 503 });
});

test("uses the saved vote response and rejects missing, mismatched and failed writes", async () => {
  const saved = createHttpChatRepository(async () => Response.json({ vote: { message_id: assistant.id, rating: -1, reason: "trimmed" } }));
  expect(await saved.vote(assistant.id, "down", "  trimmed  ")).toEqual({ value: "down", reason: "trimmed" });
  for (const vote of [null, { message_id: "other", rating: 1, reason: null }, { message_id: assistant.id, rating: 9, reason: null }]) {
    const malformed = createHttpChatRepository(async () => Response.json({ vote }));
    await expect(malformed.vote(assistant.id, "up")).rejects.toThrow("피드백");
  }
  const rejected = createHttpChatRepository(async () => Response.json({ error: { message: "Denied" } }, { status: 403 }));
  await expect(rejected.vote(assistant.id, "up")).rejects.toMatchObject({ status: 403 });
});

test("persists a model selection and restores it from conversation metadata", async () => {
  let item = { ...conversation };
  const repository = createHttpChatRepository(async (url, init) => {
    if (init?.method === "PATCH") {
      expect(url).toBe(`/api/conversations/${conversation.id}`);
      expect(JSON.parse(init.body as string)).toEqual({ action: "update", modelId: "gpt-5-mini" });
      item = { ...item, modelId: "gpt-5-mini" };
    }
    return Response.json(url.includes('/messages?') ? { items: [], hasMore: false } : { item });
  });
  expect(await repository.setModel(conversation.id, "gpt-5-mini")).toBe("gpt-5-mini");
  expect((await repository.getConversation(conversation.id, context)).modelId).toBe("gpt-5-mini");
});

test("rejects denied, missing or mismatched model save responses", async () => {
  for (const item of [null, { ...conversation, id: 'other' }, { ...conversation, modelId: 'other-model' }]) {
    const repository = createHttpChatRepository(async () => Response.json({ item }));
    await expect(repository.setModel(conversation.id, 'gpt-5-mini')).rejects.toThrow('모델');
  }
  const repository = createHttpChatRepository(async () => Response.json({ error: { code: 'MODEL_NOT_ALLOWED', message: 'Unavailable' } }, { status: 400 }));
  await expect(repository.setModel(conversation.id, 'unknown')).rejects.toMatchObject({ status: 400, code: 'MODEL_NOT_ALLOWED' });
});

test('reads the server model catalog without a hardcoded fallback', async () => {
  const entries = ['custom-model', 'another-model'].map((id) => ({ id, capabilitySource: 'unverified', capabilities: { vision: null, documents: null, tools: null, reasoning: null } }));
  const repository = createHttpChatRepository(async (url, init) => {
    expect(url).toBe('/api/ai/models'); expect(init?.cache).toBe('no-store');
    return Response.json({ items: [...entries, entries[0]] });
  });
  expect(await repository.getModels()).toEqual(entries);
  expect(await createHttpChatRepository(async () => Response.json({ items: [] })).getModels()).toEqual([]);
});

test('rejects malformed or unavailable model catalogs', async () => {
  for (const items of [null, {}, [null], [{ id: 1 }], [{ id: ' ' }]]) {
    await expect(createHttpChatRepository(async () => Response.json({ items })).getModels()).rejects.toThrow('모델 목록');
  }
  await expect(createHttpChatRepository(async () => Response.json({ error: { message: 'Unavailable' } }, { status: 503 })).getModels()).rejects.toMatchObject({ status: 503 });
});
