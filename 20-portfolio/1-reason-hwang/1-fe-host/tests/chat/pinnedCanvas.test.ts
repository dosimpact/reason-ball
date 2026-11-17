import assert from "node:assert/strict";
import { test } from "node:test";
import { moveItem, pinItem, restorePinnedItems, storageKey } from "../../src/_pages/chat/model/pinnedCanvas";

const selection = { id: "price-aapl-1", title: "AAPL 가격", program: 'root = CanvasItem("price-aapl-1", "AAPL 가격", [])', initialState: { ticker: "AAPL" } };

test("pins a selected element only once and keeps its own query state", () => {
  const first = pinItem([], selection, "message-1", "report-1");
  const second = pinItem(first, selection, "message-1", "report-1");
  const another = pinItem(second, { ...selection, id: "rsi-msft-1", title: "MSFT RSI", initialState: { ticker: "MSFT" } }, "message-2", "report-2");
  assert.equal(second, first);
  assert.equal(another.length, 2);
  assert.deepEqual(another.map(item => item.initialState?.ticker), ["AAPL", "MSFT"]);
  assert.deepEqual(another.map(item => item.reportId), ["report-1", "report-2"]);
});

test("restores order and layout while rejecting broken or duplicate entries", () => {
  const items = pinItem(pinItem([], selection, "message-1"), { ...selection, id: "rsi-1" }, "message-2");
  const moved = moveItem(items, "rsi-1", "price-aapl-1");
  moved[0].columns = 2;
  moved[0].height = 520;
  const restored = restorePinnedItems(JSON.stringify([moved[0], moved[1], moved[0], { id: "invalid" }]));
  assert.deepEqual(restored.map(item => item.id), ["rsi-1", "price-aapl-1"]);
  assert.equal(restored[0].columns, 2);
  assert.equal(restored[0].height, 520);
  assert.deepEqual(restorePinnedItems("bad JSON"), []);
  assert.notEqual(storageKey("local", "thread-A"), storageKey("local", "thread-B"));
  assert.notEqual(storageKey("local", "thread-A"), storageKey("remote", "thread-A"));
});
