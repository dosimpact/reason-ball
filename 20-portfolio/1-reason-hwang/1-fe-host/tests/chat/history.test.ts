import assert from "node:assert/strict";
import test from "node:test";
import type { Client } from "@langchain/langgraph-sdk";

import { listChatHistory, loadChatHistory, normalizeThreadMessages } from "../../src/_pages/chat/api/chatHistoryApi";

test("history normalizes visible roles and text blocks without exposing tools or reasoning", () => {
  const messages = normalizeThreadMessages({ created_at: "2026-11-14", values: { messages: [
    null, { type: "system", content: "private instructions" },
    { id: "question", type: "human", content: [{ type: "text", text: "안녕" }, "하세요"] },
    { type: "ai", content: "private reasoning", tool_calls: [{ name: "lookup" }] },
    { role: "tool", content: "private tool result" },
    { role: "assistant", content: [{ type: "reasoning", text: "private" }, { type: "text", text: "반갑습니다" }] },
    { role: "unsupported", content: "hidden" },
  ] } });
  assert.deepEqual(messages.map(({ role, content }) => ({ role, content })), [
    { role: "user", content: "안녕하세요" }, { role: "assistant", content: "반갑습니다" },
  ]);
  assert.equal(messages[0].id, "question");
  assert.equal(messages[1].id, "history-assistant-5");
  assert.equal(messages[1].createdAt, "2026-11-14");
  assert.equal(messages[1].status, "complete");
});

test("only the latest final assistant receives the snapshot presentation", () => {
  const state = { values: { messages: [
    { type: "human", content: "first" }, { type: "ai", content: "first answer" },
    { role: "user", content: "second" }, { role: "assistant", content: "second answer" },
  ], presentation: { id: "chart-2", program: 'root = Text("Latest chart");' } } };
  const messages = normalizeThreadMessages(state);
  assert.equal(messages[1].program, undefined);
  assert.equal(messages[3].program, state.values.presentation.program);
  assert.equal(messages[3].presentationId, "chart-2");
  assert.deepEqual(normalizeThreadMessages(state), messages);
  const pending = normalizeThreadMessages({ values: { ...state.values, messages: [...state.values.messages, { type: "human", content: "third" }] } });
  assert.equal(pending.some(message => message.program), false);
});

test("malformed snapshots and additional tool-call messages do not become chat prose", () => {
  for (const state of [null, [], {}, { values: [] }, { values: { messages: "bad" } }]) {
    assert.deepEqual(normalizeThreadMessages(state), []);
  }
  assert.deepEqual(normalizeThreadMessages({ values: { messages: [
    { type: "ai", content: "secret", additional_kwargs: { tool_calls: [{ id: "call" }] } },
    { type: "human", content: { text: "bad format" } },
    { type: "assistant", content: [] },
  ] } }), []);
});

test("list history filters by source and graph, forwards cancellation, and preserves server ordering", async () => {
  const controller = new AbortController();
  const client = { threads: { search: async (query: unknown) => {
    assert.deepEqual(query, { metadata: { source: "host-chat", graph_id: "starter_graph" }, limit: 50, sortBy: "updated_at", sortOrder: "desc", signal: controller.signal });
    return [
      { thread_id: "new", updated_at: "2026-11-14", status: "idle", metadata: { source: "host-chat", graph_id: "starter_graph", title: "最初の質問" } },
      { thread_id: "other", metadata: { source: "host-chat", graph_id: "other" } },
      { thread_id: "unrelated", metadata: {} },
      { thread_id: "older", created_at: "2026-11-13", metadata: { source: "host-chat", graph_id: "starter_graph" } },
    ];
  } } } as unknown as Client;
  assert.deepEqual(await listChatHistory(client, "starter_graph", controller.signal), [
    { threadId: "new", title: "最初の質問", graphId: "starter_graph", updatedAt: "2026-11-14", status: "idle" },
    { threadId: "older", title: "제목 없는 대화", graphId: "starter_graph", updatedAt: "2026-11-13", status: "unknown" },
  ]);
});

test("loading a selected thread uses server state and propagates failures", async () => {
  const controller = new AbortController();
  const client = { threads: { getState: async (id: string, checkpoint: unknown, options: unknown) => {
    assert.equal(id, "thread-1"); assert.equal(checkpoint, undefined); assert.deepEqual(options, { signal: controller.signal });
    return { values: { messages: [{ id: "saved", type: "human", content: "saved question" }] } };
  } } } as unknown as Client;
  assert.equal((await loadChatHistory(client, "thread-1", controller.signal))[0].content, "saved question");
  const failed = { threads: { getState: async () => { throw new Error("server unavailable"); } } } as unknown as Client;
  await assert.rejects(loadChatHistory(failed, "thread-1"), /server unavailable/);
});
