import { expect, it } from "vitest";
import { displayLayouts, keyboardLayout, dropPosition } from "./grid";
import type { Panel } from "@/entities/dashboard";
const base = { x: 12, y: 4, w: 12, h: 8 };
it("projects narrow layouts in visual order without changing stored coordinates", () => {
  const panels = [
    { id: "later", layout: base, pinned: false },
    { id: "first", layout: { x: 0, y: 0, w: 8, h: 10 }, pinned: false },
  ] as Panel[];
  const before = JSON.stringify(panels);
  const mobile = displayLayouts(panels, true);
  expect(mobile.map((p) => [p.i, p.x, p.y, p.w, p.static])).toEqual([
    ["first", 0, 0, 24, true],
    ["later", 0, 10, 24, true],
  ]);
  expect(JSON.stringify(panels)).toBe(before);
  expect(displayLayouts(panels, false)[0]).toEqual({
    i: "later",
    ...base,
    static: false,
  });
});
it("bounds keyboard movement and resizing while keeping panels within the grid", () => {
  expect(keyboardLayout(base, "ArrowRight", false)?.x).toBe(12);
  expect(keyboardLayout(base, "ArrowRight", true)).toEqual({
    ...base,
    x: 11,
    w: 13,
  });
  expect(keyboardLayout({ ...base, y: 0 }, "ArrowUp", false)?.y).toBe(0);
  expect(keyboardLayout({ ...base, h: 4 }, "ArrowUp", true)?.h).toBe(4);
  expect(keyboardLayout(base, "Enter", false)).toBeNull();
});

it("maps pixel drops including gutters and clamps off-grid coordinates", () => {
  expect(dropPosition(444, 240, 876)).toEqual({ x: 12, y: 6 });
  expect(dropPosition(443, 239, 876)).toEqual({ x: 11, y: 5 });
  expect(dropPosition(-50, -10, 876)).toEqual({ x: 0, y: 0 });
  expect(dropPosition(9999, 999999, 876)).toEqual({ x: 23, y: 10000 });
});
