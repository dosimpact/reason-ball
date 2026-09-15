import { describe, expect, it } from "vitest";
import {
  editFlowTree,
  indexFlow,
  flowLimits,
  validateFlowTree,
  parseFlowSpec,
  type FlowTree,
  type FlowEdit,
} from "../src/features/flow-spec-syntax/parser";
import { exampleContent } from "../src/app/lib/catalog";
const tree = () => exampleContent("flow-spec-overview") as FlowTree;
describe("Flow node editing", () => {
  it("returns node identity with path diagnostics and limits aggregate text", () => {
    try {
      const bad = tree();
      bad.layers[0].children[0].label = "bad\nlabel";
      validateFlowTree(bad);
      expect.fail("invalid label accepted");
    } catch (error) {
      expect(error).toMatchObject({
        details: {
          errors: expect.arrayContaining([
            expect.objectContaining({
              nodeId: "step-0",
              path: "/layers/0/children/0/label",
            }),
          ]),
        },
      });
    }
    const large = tree();
    large.layers[0].children = Array.from({ length: 501 }, (_, i) => ({
      id: `text-${i}`,
      kind: "step",
      label: "x".repeat(2000),
      children: [],
    }));
    expect(() => validateFlowTree(large)).toThrow();
  });
  it("inserts, renames, moves and removes without mutating the original", () => {
    const original = tree(),
      before = structuredClone(original);
    const added = editFlowTree(original, {
      action: "insert",
      parentId: "step-0",
      index: 0,
      node: { id: "new", kind: "note", label: "rule" },
    });
    const renamed = editFlowTree(added, {
      action: "rename",
      nodeId: "new",
      label: "updated",
    });
    const moved = editFlowTree(renamed, {
      action: "move",
      nodeId: "new",
      parentId: "step-1",
      index: 0,
    });
    expect(indexFlow(moved).parentById.get("new")).toBe("step-1");
    expect(indexFlow(moved).byId.get("new")).toMatchObject({
      id: "new",
      label: "updated",
    });
    expect(editFlowTree(moved, { action: "remove", nodeId: "new" })).toEqual(
      original,
    );
    expect(original).toEqual(before);
  });
  it("uses the destination index after removal for same-parent moves", () => {
    const added = editFlowTree(tree(), {
      action: "insert",
      parentId: "layer-0",
      index: 1,
      node: { id: "new", kind: "step", label: "second" },
    });
    expect(
      editFlowTree(added, {
        action: "move",
        nodeId: "step-0",
        parentId: "layer-0",
        index: 1,
      }).layers[0].children.map((n) => n.id),
    ).toEqual(["new", "step-0"]);
  });
  it.each<FlowEdit>([
    { action: "rename", nodeId: "missing", label: "x" },
    { action: "rename", nodeId: "layer-0", label: "x" },
    { action: "rename", nodeId: "step-0", label: " bad " },
    { action: "move", nodeId: "step-0", parentId: "step-0", index: 0 },
    { action: "move", nodeId: "step-0", parentId: "missing", index: 0 },
    { action: "move", nodeId: "step-0", parentId: "layer-1", index: 9 },
    {
      action: "insert",
      parentId: "layer-0",
      index: 0,
      node: { id: "step-0", kind: "step", label: "duplicate" },
    },
    {
      action: "insert",
      parentId: "layer-0",
      index: 0,
      node: { id: "new", kind: "note", label: "bad parent" },
    },
  ])("rejects invalid edits without changing input: %j", (edit) => {
    const original = tree(),
      before = structuredClone(original);
    expect(() => editFlowTree(original, edit)).toThrow();
    expect(original).toEqual(before);
  });
  it("rejects moving a node beneath its descendant", () => {
    const original = editFlowTree(tree(), {
      action: "insert",
      parentId: "step-0",
      index: 0,
      node: { id: "child", kind: "step", label: "child" },
    });
    expect(() =>
      editFlowTree(original, {
        action: "move",
        nodeId: "step-0",
        parentId: "child",
        index: 0,
      }),
    ).toThrow("자손");
  });
  it("enforces node count, label, text and depth boundaries", () => {
    const value = tree();
    value.layers.forEach((l) => {
      l.children = [];
    });
    value.layers[0].children = Array.from(
      { length: flowLimits.nodes - 3 },
      (_, i) => ({ id: `n${i}`, kind: "step", label: "x", children: [] }),
    );
    expect(validateFlowTree(value)).toBe(value);
    expect(() =>
      editFlowTree(value, {
        action: "insert",
        parentId: "layer-0",
        index: 0,
        node: { id: "overflow", kind: "step", label: "x" },
      }),
    ).toThrow();
    expect(() =>
      editFlowTree(tree(), {
        action: "rename",
        nodeId: "step-0",
        label: "x".repeat(flowLimits.labelLength + 1),
      }),
    ).toThrow();
    expect(parseFlowSpec("x".repeat(flowLimits.textLength + 1)).success).toBe(
      false,
    );
    const deep = tree();
    let children = deep.layers[0].children;
    for (let i = 0; i < flowLimits.depth; i++) {
      children[0] = { id: `d${i}`, kind: "step", label: "x", children: [] };
      children = children[0].children;
    }
    expect(validateFlowTree(deep)).toBe(deep);
    children.push({ id: "too-deep", kind: "step", label: "x", children: [] });
    expect(() => validateFlowTree(deep)).toThrow();
  });
});
