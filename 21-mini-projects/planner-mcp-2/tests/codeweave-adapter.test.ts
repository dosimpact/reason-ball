import type { Document } from "../src/entities/planner/model";
import { it, expect } from "vitest";
import { PlannerStore } from "../src/app/server/store";
import { getCodeWeave, updateCodeWeaveNode } from "../src/app/server/codeweave";
import {
  extensionList,
  type CodeWeaveExtension,
} from "../src/entities/planner/extensions";
const source =
  "[App]\n  -> FLOW: 시작\n    -> (+) Custom: 처리 // 설명\n    /*\n내용\n    */\n    <- RETURN: 결과";
const extension: CodeWeaveExtension = {
  id: "cw",
  title: "흐름",
  type: "codeweave",
  schemaVersion: 1,
  data: { source },
};
it("validates sources and mixed extension uniqueness", () => {
  expect(extensionList.safeParse([extension]).success).toBe(true);
  expect(extensionList.safeParse([extension, extension]).success).toBe(false);
  expect(
    extensionList.safeParse([
      { ...extension, data: { source: "[App]\n   bad" } },
    ]).success,
  ).toBe(false);
});
it("copies templates, queries comment ownership, preserves siblings and rejects stale node edits", () => {
  const s = new PlannerStore(":memory:");
  try {
    const { revision, ...base } = s.getTemplate("view");
    s.saveTemplate(
      { ...base, extensions: [extension, { ...extension, id: "second" }] },
      revision,
    );
    const p = s.createProject({ title: "CW" });
    let d: Document = s.createDocument({
      projectId: p.id,
      title: "CW",
      phase: "design",
      templateName: "view",
    });
    s.saveTemplate({ ...base, extensions: [] }, revision + 1);
    expect(d.extensions).toHaveLength(2);
    expect(
      getCodeWeave(s, d.id, "cw", { line: 5, query: "説明" }).selected?.id,
    ).toBe("line:3");
    expect(getCodeWeave(s, d.id, "cw", { query: "설명" }).matches).toHaveLength(
      1,
    );
    d = s.updateCheck(d.id, d.checklist[0].id, {
      aiResult: "passed",
      expectedRevision: d.revision,
    });
    d = s.confirmCheck(d.id, d.checklist[0].id, true, d.revision);
    const input = {
      nodeId: "line:3",
      expectedRevision: d.revision,
      expectedSource: source,
      patch: { text: "수정", direction: "<-", blockComment: "첫 줄\n둘째 줄" },
    };
    const updated = updateCodeWeaveNode(s, d.id, "cw", input);
    expect(updated.selected?.text).toBe("수정");
    expect(updated.selected?.comments[1].text).toContain("첫 줄\n둘째 줄");
    expect(s.getDocument(d.id).status).toBe("reopen");
    expect(s.getDocument(d.id).extensions?.[1]).toEqual({
      ...extension,
      id: "second",
    });
    expect(s.getDocument(d.id).templateSnapshot?.extensions?.[0]).toEqual(
      extension,
    );
    expect(() => updateCodeWeaveNode(s, d.id, "cw", input)).toThrow(/revision/);
    expect(() =>
      updateCodeWeaveNode(s, d.id, "cw", {
        ...input,
        expectedRevision: updated.revision,
      }),
    ).toThrow(/Source changed/);
    expect(() =>
      updateCodeWeaveNode(s, d.id, "cw", {
        ...input,
        expectedRevision: updated.revision,
        expectedSource: updated.source,
        patch: { prefix: "bad prefix" },
      }),
    ).toThrow(/Patch/);
    expect(() => getCodeWeave(s, d.id, "missing")).toThrow(/not found/);
  } finally {
    s.close();
  }
});
