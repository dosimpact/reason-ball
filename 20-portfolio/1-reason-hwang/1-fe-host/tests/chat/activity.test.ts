import assert from "node:assert/strict";
import test from "node:test";
import { extractToolActivity } from "../../src/_pages/chat/model/toolActivity";
import { chatReducer, initialChatState } from "../../src/_pages/chat/model/state/chatReducer";

test("maps LangChain tool calls and result status without payloads or prior turns", () => {
  const call = { id: "price", name: "get_price_ohlcv", args: { secret: "private args" } };
  const messages = [{ type: "human" }, { type: "ai", tool_calls: [{ id: "old", name: "old_tool" }] }, { type: "human" }, { type: "ai", content: "private reasoning", tool_calls: [call, call] }];
  assert.deepEqual(extractToolActivity(messages), [{ id: "price", name: "get_price_ohlcv", status: "running" }]);
  assert.deepEqual(extractToolActivity([...messages, { type: "tool", tool_call_id: "price", content: "private result" }]), [{ id: "price", name: "get_price_ohlcv", status: "complete" }]);
});
test("supports role snapshots, parallel errors, and malformed messages", () => {
  assert.deepEqual(extractToolActivity([null, { role: "user" }, { role: "assistant", tool_calls: [{ id: "a", name: "fetch" }, { id: "b", name: "analyze" }, { name: "invalid" }] }, { role: "tool", tool_call_id: "a", status: "error" }]), [{ id: "a", name: "fetch", status: "error" }, { id: "b", name: "analyze", status: "running" }]);
  assert.deepEqual(extractToolActivity([{ type: "ai", tool_calls: [{ id: "a", name: "old" }] }]), []);
  assert.deepEqual(extractToolActivity({}), []);
});
test("snapshot activity stays on its turn and unsettled tools stop on cancellation", () => {
  let state = chatReducer(initialChatState, { type: "assistantMessageStarted", message: { id: "turn", role: "assistant", content: "", createdAt: "2026-11-14", status: "streaming" } });
  state = chatReducer(state, { type: "assistantSnapshotReceived", messageId: "old", content: "", activities: [{ id: "old", name: "old", status: "running" }] });
  assert.equal(state.messages[0].activities, undefined);
  state = chatReducer(state, { type: "assistantSnapshotReceived", messageId: "turn", content: "", activities: [{ id: "a", name: "fetch", status: "complete" }, { id: "b", name: "analyze", status: "running" }] });
  state = chatReducer(state, { type: "assistantMessageCompleted" });
  assert.deepEqual(state.messages[0].activities?.map(activity => activity.status), ["complete", "interrupted"]);
});
test("late completion and failure from a reset turn cannot settle the new turn", () => {
  const state = chatReducer(initialChatState, { type: "assistantMessageStarted", message: { id: "new-turn", role: "assistant", content: "", createdAt: "2026-11-14", status: "streaming", activities: [{ id: "new-tool", name: "fetch", status: "running" }] } });
  assert.equal(chatReducer(state, { type: "assistantMessageCompleted", messageId: "old-turn" }), state);
  assert.equal(chatReducer(state, { type: "streamFailed", messageId: "old-turn", error: "late error" }), state);
  const completed = chatReducer(state, { type: "assistantMessageCompleted", messageId: "new-turn" });
  assert.equal(completed.status, "idle");
  assert.equal(completed.messages[0].activities?.[0].status, "interrupted");
});
