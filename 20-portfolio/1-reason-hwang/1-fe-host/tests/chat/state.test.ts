import assert from "node:assert/strict";
import test from "node:test";
import { chatReducer, initialChatState } from "../../src/_pages/chat/model/state/chatReducer";

const assistant = (id: string) => ({ id, role: "assistant" as const, content: "", createdAt: "2026-11-08", status: "streaming" as const });

test("values snapshots replace and target their own turn", () => {
  let state = chatReducer(initialChatState, { type: "assistantMessageStarted", message: assistant("first") });
  state = chatReducer(state, { type: "assistantSnapshotReceived", messageId: "first", content: "analysis", program: "first chart", presentationId: "p1" });
  state = chatReducer(state, { type: "assistantSnapshotReceived", messageId: "first", content: "analysis", program: "first chart", presentationId: "p1" });
  assert.equal(state.messages[0].content, "analysis");
  state = chatReducer(state, { type: "assistantMessageCompleted" });
  state = chatReducer(state, { type: "assistantMessageStarted", message: assistant("second") });
  state = chatReducer(state, { type: "assistantSnapshotReceived", messageId: "second", content: "weekly", program: "weekly chart", presentationId: "p2" });
  assert.equal(state.messages[0].program, "first chart");
  assert.equal(state.messages[1].program, "weekly chart");
  state = chatReducer(state, { type: "threadReset" });
  state = chatReducer(state, { type: "assistantSnapshotReceived", messageId: "second", content: "late event" });
  assert.deepEqual(state.messages, []);
});
