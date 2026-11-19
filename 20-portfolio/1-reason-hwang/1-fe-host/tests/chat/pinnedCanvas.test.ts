import assert from "node:assert/strict";
import { test } from "node:test";
import { applyLayouts, pinItem, restorePinnedItems, serializePinnedItems, storageKey } from "../../src/_pages/chat/model/pinnedCanvas";

const selection = { id: "price-aapl-1", title: "AAPL 가격", program: 'root = CanvasItem("price-aapl-1", "AAPL 가격", [])', initialState: { ticker: "AAPL", filters: { period: "1y" } } };

test("three additions create independent instances while retaining source provenance", () => {
  const items = Array.from({ length: 3 }).reduce<ReturnType<typeof pinItem>>((saved) => pinItem(saved, selection, "message-1", "report-1"), []);
  assert.equal(new Set(items.map(item => item.id)).size, 3);
  for (const item of items) {
    assert.equal(item.sourceElementId, selection.id);
    assert.equal(item.messageId, "message-1");
    assert.equal(item.reportId, "report-1");
  }
  (items[0].reactiveState!.filters as { period: string }).period = "5y";
  (items[0].initialState!.filters as { period: string }).period = "6mo";
  assert.equal((items[1].reactiveState!.filters as { period: string }).period, "1y");
  assert.equal((items[0].reactiveState!.filters as { period: string }).period, "5y");
  assert.equal(selection.initialState.filters.period, "1y");
  assert.deepEqual(items.map(item => item.layout.y), [0, 10, 20]);
});

test("migrates legacy canvas without losing IDs, state, provenance, or order", () => {
  const legacy = { ...selection, messageId: "message-1", reportId: "report-1", columns: 2, height: 520, addedAt: "2026-11-17", reactiveState: { ticker: "MSFT" }, successfulArgs: { ticker: "MSFT" } };
  const items = restorePinnedItems(JSON.stringify([legacy, { ...legacy, id: "second", columns: 1 }, legacy, { id: "invalid" }]));
  assert.deepEqual(items.map(item => item.id), [selection.id, "second"]);
  assert.deepEqual(items[0].layout, { x: 0, y: 0, w: 24, h: 14 });
  assert.equal(items[0].sourceElementId, selection.id);
  assert.equal(items[0].reactiveState?.ticker, "MSFT");
  assert.deepEqual(restorePinnedItems(serializePinnedItems(items)), items);
  assert.deepEqual(restorePinnedItems("bad JSON"), []);
  assert.notEqual(storageKey("local", "thread-A"), storageKey("local", "thread-B"));
  assert.notEqual(storageKey("local", "thread-A"), storageKey("remote", "thread-A"));
});

test("grid moves preserve free placement, push collisions down, and protect pinned panels", () => {
  const items = pinItem(pinItem([], selection, "message-1"), selection, "message-1");
  const moved = applyLayouts(items, [{ i: items[1].id, x: 0, y: 0, w: 12, h: 10 }]);
  assert.equal(moved[1].layout.y, 0);
  assert.equal(moved[0].layout.y, 10);
  const free = applyLayouts(moved, [{ i: items[0].id, x: 12, y: 25, w: 12, h: 10 }]);
  assert.equal(free[0].layout.y, 25);
  free[1].pinned = true;
  const pinned = applyLayouts(free, [{ i: free[1].id, x: 12, y: 40, w: 12, h: 10 }, { i: free[0].id, x: 0, y: 0, w: 12, h: 10 }]);
  assert.deepEqual(pinned[1].layout, free[1].layout);
  assert.equal(pinned[0].layout.y, 10);
  assert.equal(free[0].layout.y, 25);
});

test("rejects invalid grid bounds and malformed versioned entries", () => {
  const items = pinItem([], selection, "message-1");
  for (const layout of [{ x: -1, y: 0, w: 12, h: 10 }, { x: 20, y: 0, w: 12, h: 10 }, { x: 0, y: 0.5, w: 12, h: 10 }, { x: 0, y: 10001, w: 12, h: 10 }, { x: 0, y: 0, w: 3, h: 10 }, { x: 0, y: 0, w: 12, h: 41 }]) {
    assert.equal(applyLayouts(items, [{ i: items[0].id, ...layout }]), items);
    assert.deepEqual(restorePinnedItems(serializePinnedItems([{ ...items[0], layout }])), []);
  }
  assert.deepEqual(restorePinnedItems(JSON.stringify({ version: 3, items })), []);
});
