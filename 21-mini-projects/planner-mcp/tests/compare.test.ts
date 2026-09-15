import { expect, it } from "vitest";
import { compareJson } from "../src/entities/document/lib/compare";
it("compares JSON fields, escaped paths, arrays and null without mutation", () => {
  const before = { "a/b": 1, removed: true, list: ["a", "b"], nullable: null };
  const after = { "a/b": 2, added: false, list: ["b", "a"], nullable: {} };
  const copy = structuredClone(before);
  expect(compareJson(before, after)).toEqual(
    expect.arrayContaining([
      { path: "/a~1b", kind: "changed", before: 1, after: 2 },
      { path: "/removed", kind: "removed", before: true },
      { path: "/added", kind: "added", after: false },
      { path: "/list/0", kind: "changed", before: "a", after: "b" },
      { path: "/nullable", kind: "changed", before: null, after: {} },
    ]),
  );
  expect(before).toEqual(copy);
  expect(compareJson({ x: 1, y: 2 }, { y: 2, x: 1 })).toEqual([]);
  expect(compareJson([], [0])).toEqual([
    { path: "/0", kind: "added", after: 0 },
  ]);
  expect(compareJson(null, 1)).toEqual([
    { path: "/", kind: "changed", before: null, after: 1 },
  ]);
});
