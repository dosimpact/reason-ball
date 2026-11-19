import assert from "node:assert/strict";
import test from "node:test";
import type { Client } from "@langchain/langgraph-sdk";
import { createChatThread } from "../../src/_pages/chat/api/chatRunApi";
import { chatReducer, initialChatState } from "../../src/_pages/chat/model/state/chatReducer";

test("history load restores the thread for continuing and failures preserve the current conversation", () => {
  const message = { id: "old", role: "user" as const, content: "저장된 질문", createdAt: "2026-11-14", status: "complete" as const };
  const loaded = chatReducer(initialChatState, { type: "historyLoaded", threadId: "saved", messages: [message] });
  assert.equal(loaded.threadId, "saved");
  const loading = chatReducer(loaded, { type: "historyLoading" });
  assert.equal(loading.status, "loading_history");
  const failed = chatReducer(loading, { type: "historyLoadFailed", error: "missing thread" });
  assert.deepEqual(failed.messages, [message]);
  assert.equal(failed.threadId, "saved");
  assert.equal(chatReducer(loading, { type: "historyLoadFailed", error: null }).status, "idle");
});

test("thread creation passes graphId through the SDK reserved graph metadata option", async () => {
  let payload: unknown;
  const client = { threads: { create: async (value: unknown) => { payload = value; return { thread_id: "new" }; } } } as unknown as Client;
  const metadata = { source: "host-chat", graph_id: "starter_graph", title: "first question" };
  assert.equal(await createChatThread(client, metadata), "new");
  assert.deepEqual(payload, { metadata, graphId: "starter_graph" });
});
