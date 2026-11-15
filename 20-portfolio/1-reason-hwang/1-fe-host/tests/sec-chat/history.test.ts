import assert from "node:assert/strict";
import test from "node:test";
import { HISTORY_KEY, parseHistory, saveHistory, type Conversation } from "../../src/_pages/sec-chat/model/history";

test("history round trip preserves rendered answers and session metadata", () => {
  const map = new Map<string, string>();
  const storage: Storage = { get length() { return map.size; }, clear: () => map.clear(), getItem: key => map.get(key) ?? null, key: index => [...map.keys()][index] ?? null, removeItem: key => { map.delete(key); }, setItem: (key, value) => { map.set(key, value); } };
  const record: Conversation = { id: "one", title: "Apple", updatedAt: "2026-11-16T00:00:00Z", messages: [{ role: "user", text: "Apple?" }, { role: "assistant", text: "답변", program: "root = Text(\"답변\")" }], company: { cik: "0000320193", name: "Apple", ticker: "AAPL" }, prepared: { threadId: "a".repeat(32), filing: { accessionNo: "x", filingDate: "2026-01-01" }, checkedAt: null, missingItems: [] } };
  saveHistory(storage, [record]);
  assert.deepEqual(parseHistory(map.get(HISTORY_KEY) ?? null), [record]);
});
test("invalid stored data and oversized history are bounded", () => {
  assert.deepEqual(parseHistory("not-json"), []);
  assert.deepEqual(parseHistory('[{"id":"bad","messages":[{}]}]'), []);
  const records = Array.from({ length: 60 }, (_, index) => ({ id: String(index), title: "chat", updatedAt: "2026-11-16", messages: [{ role: "user", text: "hello" }] }));
  assert.equal(parseHistory(JSON.stringify(records)).length, 50);
});
