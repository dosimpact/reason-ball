import { describe, it, expect } from "vitest";
import {
  parseFlowSpec,
  materializeFlow,
  validateFlowTree,
  flowRows,
  indexFlow,
  ancestors,
  reconcileCollapsed,
  serializeFlowSpec,
} from "../src/features/flow-spec-syntax/parser";
const source =
  "flow-spec 1\n[Upstream API]\n  -> 예산 추천 조회\n    (+) 검증 규칙\n[BFF Endpoint]\n  -> 추천 제공\n[Frontend Biz Logic]";
const make = () => {
  const p = parseFlowSpec(source);
  if (!p.success) throw new Error("fixture");
  return materializeFlow(p.layers, ["u", "s", "n", "b", "bs", "f"]);
};
describe("Flow Spec contract", () => {
  it("parses labels, note parents, CRLF and serializes without losing semantics", () => {
    const tree = make();
    expect(tree.layers[0].children[0].children[0].kind).toBe("note");
    expect(serializeFlowSpec(tree)).toBe(source);
    expect(parseFlowSpec(source.replaceAll("\n", "\r\n"))).toEqual(
      parseFlowSpec(source),
    );
  });
  it.each([
    "flow-spec 2",
    source.replace("    (+)", "      (+)"),
    source.replace("  ->", "\t->"),
    source.replace("    (+)", "   (+)"),
    source.replace("  -> 예산", "  (+) 예산"),
    source + "\n  unknown",
    source.replace("[Frontend Biz Logic]", "[BFF Endpoint]"),
  ])("returns diagnostic locations for malformed source", (input) => {
    const result = parseFlowSpec(input);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors[0].line).toBeGreaterThan(0);
  });
  it("supports empty layers but rejects missing ones", () => {
    expect(
      parseFlowSpec(
        "flow-spec 1\n[Upstream API]\n[BFF Endpoint]\n[Frontend Biz Logic]",
      ).success,
    ).toBe(true);
    expect(parseFlowSpec("flow-spec 1").success).toBe(false);
  });
  it("uses DFS ordering and skips collapsed subtrees while indexing all nodes", () => {
    const tree = make(),
      before = JSON.stringify(tree),
      idx = indexFlow(tree);
    expect(flowRows(tree).map((r) => r.node.id)).toEqual([
      "u",
      "s",
      "n",
      "b",
      "bs",
      "f",
    ]);
    expect(flowRows(tree, new Set(["u"])).map((r) => r.node.id)).toEqual([
      "u",
      "b",
      "bs",
      "f",
    ]);
    expect(ancestors("n", idx)).toEqual(["s", "u"]);
    expect(idx.locationById.get("n")).toEqual({ parentId: "s", index: 0 });
    expect(reconcileCollapsed(tree, new Set(["u", "n", "deleted"]))).toEqual(
      new Set(["u"]),
    );
    expect(JSON.stringify(tree)).toBe(before);
  });
  it("rejects duplicate IDs, extra fields and cycles without overflowing", () => {
    const duplicate = make();
    duplicate.layers[1].id = "u";
    expect(() => validateFlowTree(duplicate)).toThrow();
    expect(() => validateFlowTree({ ...make(), extra: true })).toThrow();
    const cyclic = make();
    cyclic.layers[0].children[0].children.push(cyclic.layers[0].children[0]);
    expect(() => validateFlowTree(cyclic)).toThrow();
    expect(() => validateFlowTree(null)).toThrow();
  });
  it("rejects missing supplied identities and note children", () => {
    const p = parseFlowSpec(source);
    if (p.success) expect(() => materializeFlow(p.layers, [])).toThrow();
    const tree = make();
    tree.layers[0].children[0].children[0].children.push({
      id: "x",
      kind: "step",
      label: "bad",
      children: [],
    });
    expect(() => validateFlowTree(tree)).toThrow();
  });
});
