import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  compileCodeWeave,
  getNode,
  getNodeAtLine,
  searchNodes,
  collapseAll,
  expandAll,
  setNodeExpanded,
  getVisibleRows,
  updateNode,
  replaceSource,
} from "../../src/modules/codeweave/core/index";

const source = `[UI]
  -> EVENT: 생성
    -> (+) 사용자타입: https://example.com // 추가 예정
    /*
    -> (-) 여기는 주석: [Layer]
    두 번째 줄
    */
    -> (-) OLD: 이전 처리
    <- RETURN: 결과
`;

describe("CodeWeave public compiler", () => {
  it("compiles the actual requirement example", () => {
    const requirements = readFileSync("master-requirement.md", "utf8").split(
      /\r?\n\[CodeWeave 요구사항\]\r?\n/,
    )[1];
    const example = requirements
      .match(/```text\n([\s\S]*?)\n  ```/)![1]
      .split("\n")
      .map((line) => line.slice(2))
      .join("\n");
    expect(compileCodeWeave(example).diagnostics).toEqual([]);
  });
  it("preserves arbitrary prefixes, direction, changes, comments and source", () => {
    const doc = compileCodeWeave(source);
    expect(doc.ok).toBe(true);
    expect(doc.source).toBe(source);
    expect(doc.nodes).toHaveLength(5);
    expect(getNodeAtLine(doc, 3)).toMatchObject({
      prefix: "사용자타입",
      text: "https://example.com",
      change: "added",
      parentId: "line:2",
      layer: "UI",
    });
    expect(getNodeAtLine(doc, 5)?.id).toBe("line:3");
    expect(getNodeAtLine(doc, 3)?.comments.map((c) => c.kind)).toEqual([
      "inline",
      "block",
    ]);
    expect(getNodeAtLine(doc, 9)?.direction).toBe("<-");
    expect(getNodeAtLine(doc, 10)).toBeUndefined();
    expect(getNode(doc, "missing")).toBeUndefined();
    expect(searchNodes(doc, "두 번째").map((n) => n.id)).toEqual(["line:3"]);
    expect(searchNodes(doc, "missing")).toEqual([]);
    expect(searchNodes(doc, "")).toHaveLength(5);
  });
  it("accepts empty source and standalone roots; separates layers", () => {
    expect(compileCodeWeave("").nodes).toEqual([]);
    const doc = compileCodeWeave(
      "-> 작업: 시작\n  <- 결과: 완료\n[A]\n  -> 임의: A\n[B]\n  -> 임의: B",
    );
    expect(doc.ok).toBe(true);
    expect(doc.nodes.at(-1)).toMatchObject({ layer: "B", parentId: "line:5" });
    expect(doc.nodes[0].layer).toBeNull();
  });
  it.each([
    ["\t-> X: x", "indent"],
    ["[A]\n  -> X: x\n\t\t/* bad */", "indent"],
    [" -> X: x", "indent"],
    ["    -> X: x", "depth-jump"],
    ["EVENT x", "syntax"],
    ["-> X: ", "body"],
    ["  [A]", "layer"],
    ["[ ]", "layer"],
    ["[A]\n-> X: x", "layer-depth"],
    ["-> (+) (-) X: x", "syntax"],
    ["/* orphan */", "orphan-comment"],
    ["-> X: x\n/* missing", "unclosed-comment"],
    ["-> X: x\n/* /* nested */", "nested-comment"],
    ["-> X: x\n/* comment */ text", "comment-tail"],
    ["-> X: x\n\n/* detached */", "orphan-comment"],
  ])("reports %j with source position", (input, code) => {
    const doc = compileCodeWeave(input);
    expect(doc.ok).toBe(false);
    expect(doc.diagnostics).toContainEqual(
      expect.objectContaining({
        code,
        line: expect.any(Number),
        column: expect.any(Number),
      }),
    );
  });
});

describe("Tree projection", () => {
  it("collapses all, opens selected branches, and preserves source", () => {
    const doc = compileCodeWeave(source);
    const state = collapseAll(doc);
    expect(getVisibleRows(doc, state).map((r) => r.node.id)).toEqual([
      "line:1",
    ]);
    const partial = setNodeExpanded(state, "line:1", true);
    expect(getVisibleRows(doc, partial).map((r) => r.node.id)).toEqual([
      "line:1",
      "line:2",
    ]);
    expect(state.collapsedIds).toContain("line:1");
    expect(
      getVisibleRows(doc, setNodeExpanded(partial, "line:1", false)),
    ).toHaveLength(1);
    expect(getVisibleRows(doc, expandAll())).toHaveLength(5);
    expect(getVisibleRows(doc).map((r) => r.marker)).toEqual([
      "",
      "",
      "+",
      "-",
      "",
    ]);
    expect(getVisibleRows(doc).map((r) => r.tone)).toEqual([
      "neutral",
      "neutral",
      "added",
      "removed",
      "neutral",
    ]);
    expect(doc.source).toBe(source);
    expect(getVisibleRows(compileCodeWeave(""), collapseAll(doc))).toEqual([]);
  });
});

describe("Immutable editing", () => {
  it("patches fields and preserves untouched block bytes and children", () => {
    const doc = compileCodeWeave(source);
    const result = updateNode(
      doc,
      "line:3",
      { prefix: "새타입", text: "새 로직", change: "removed", direction: "<-" },
      source,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(getNode(result.document, "line:3")).toMatchObject({
      prefix: "새타입",
      text: "새 로직",
      change: "removed",
      direction: "<-",
    });
    expect(getNode(result.document, "line:3")?.comments).toEqual(
      getNode(doc, "line:3")?.comments,
    );
    expect(result.document.source).toContain("  -> EVENT: 생성\n");
    expect(doc.source).toBe(source);
  });
  it("adds, edits and removes comments with CRLF and no final newline", () => {
    let doc = compileCodeWeave("-> X: x\r\n  -> Y: y");
    const added = updateNode(
      doc,
      "line:1",
      { inlineComment: "설명", blockComment: "첫 줄\n둘째 줄" },
      doc.source,
    );
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    doc = added.document;
    expect(doc.source).toContain("/*\r\n첫 줄\r\n둘째 줄\r\n*/\r\n  -> Y: y");
    expect(doc.source.endsWith("y")).toBe(true);
    expect(getNodeAtLine(doc, 4)?.id).toBe("line:1");
    const removed = updateNode(
      doc,
      "line:1",
      { inlineComment: null, blockComment: null },
      doc.source,
    );
    expect(removed.ok && removed.document.source).toBe("-> X: x\r\n  -> Y: y");
    const last = updateNode(
      compileCodeWeave("-> X: x"),
      "line:1",
      { blockComment: "" },
      "-> X: x",
    );
    expect(last.ok && last.document.source).toBe("-> X: x\n/*\n\n*/");
  });
  it("renames layer and updates descendant layer metadata", () => {
    const doc = compileCodeWeave(source);
    const result = updateNode(doc, "line:1", { text: "Presentation" }, source);
    expect(
      result.ok &&
        result.document.nodes.every((n) => n.layer === "Presentation"),
    ).toBe(true);
  });
  it("rejects stale, missing and invalid patches atomically", () => {
    const doc = compileCodeWeave(source);
    expect(updateNode(doc, "line:3", { text: "new" }, "old")).toMatchObject({
      ok: false,
      code: "conflict",
    });
    expect(updateNode(doc, "missing", {}, source)).toMatchObject({
      ok: false,
      code: "not-found",
    });
    for (const patch of [
      { text: "x\n-> X: injected" },
      { prefix: "X:" },
      { text: "x // injected" },
      { blockComment: "*/" },
    ]) {
      expect(updateNode(doc, "line:3", patch, source)).toMatchObject({
        ok: false,
        code: "invalid-edit",
      });
    }
    expect(
      updateNode(doc, "line:1", { change: "added" }, source),
    ).toMatchObject({ ok: false, code: "invalid-edit" });
    expect(updateNode(doc, "line:3", {}, source)).toMatchObject({
      ok: true,
      document: doc,
    });
    const invalid = compileCodeWeave("broken");
    expect(updateNode(invalid, "line:1", {}, "broken")).toMatchObject({
      ok: false,
      code: "invalid-document",
    });
    expect(replaceSource(invalid, "-> X: fixed", "broken").ok).toBe(true);
    expect(replaceSource(doc, "", "stale")).toMatchObject({
      ok: false,
      code: "conflict",
    });
    expect(replaceSource(doc, "broken", source)).toMatchObject({
      ok: false,
      code: "invalid-edit",
    });
    expect(replaceSource(doc, "", source)).toMatchObject({
      ok: true,
      document: { nodes: [] },
    });
  });
});
