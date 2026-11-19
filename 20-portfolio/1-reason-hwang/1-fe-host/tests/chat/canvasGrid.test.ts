import assert from "node:assert/strict";
import test from "node:test";
import { displayLayouts, keyboardLayout } from "../../src/_pages/chat/model/canvasGrid";
import type { PinnedCanvasItem } from "../../src/_pages/chat/model/pinnedCanvas";

const item: PinnedCanvasItem = { id: "instance", sourceElementId: "source", title: "Chart", program: "root = Text(\"Chart\")", messageId: "message", addedAt: "2026-11-17", layout: { x: 12, y: 9, w: 12, h: 10 }, pinned: false };
test("narrow layouts stack in visual order without changing desktop coordinates", () => {
  const items = [item, { ...item, id: "earlier", pinned: true, layout: { x: 0, y: 0, w: 8, h: 6 } }];
  const before = structuredClone(items);
  assert.deepEqual(displayLayouts(items, true).map(({ i, x, y, w, static: locked }) => ({ i, x, y, w, locked })), [{ i: "earlier", x: 0, y: 0, w: 24, locked: true }, { i: "instance", x: 0, y: 6, w: 24, locked: true }]);
  assert.deepEqual(items, before);
  assert.equal(displayLayouts(items, false)[1].static, true);
});
test("keyboard movement respects boundaries and resize keeps right edge inside grid", () => {
  assert.deepEqual(keyboardLayout(item.layout, "ArrowRight", false), item.layout);
  assert.deepEqual(keyboardLayout(item.layout, "ArrowRight", true), { x: 11, y: 9, w: 13, h: 10 });
  assert.equal(keyboardLayout({ x: 0, y: 0, w: 4, h: 4 }, "ArrowUp", true)?.h, 4);
  assert.equal(keyboardLayout(item.layout, "Enter", false), null);
});
