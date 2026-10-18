import { describe, it, expect } from "vitest";
import type { Document } from "../src/entities/planner/model";
import { PlannerStore } from "../src/app/server/store";
import {
  extensionList,
  type DiagramExtension,
} from "../src/entities/planner/extensions";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const diagram: DiagramExtension = {
  id: "diagram",
  title: "Order flow",
  type: "react-flow-diagram",
  schemaVersion: 1,
  data: {
    nodes: [
      { id: "a", label: "Start", position: { x: 0, y: 0 } },
      { id: "b", label: "End", position: { x: 220, y: 0 } },
    ],
    edges: [{ id: "ab", source: "a", target: "b" }],
  },
};
describe("document extensions", () => {
  it("rejects duplicate IDs, missing endpoints, unsupported versions and invalid coordinates", () => {
    expect(extensionList.safeParse([diagram, diagram]).success).toBe(false);
    expect(
      extensionList.safeParse([
        {
          ...diagram,
          data: {
            ...diagram.data,
            nodes: [diagram.data.nodes[0], diagram.data.nodes[0]],
          },
        },
      ]).success,
    ).toBe(false);
    expect(
      extensionList.safeParse([
        {
          ...diagram,
          data: {
            ...diagram.data,
            edges: [{ id: "bad", source: "a", target: "missing" }],
          },
        },
      ]).success,
    ).toBe(false);
    expect(
      extensionList.safeParse([{ ...diagram, schemaVersion: 2 }]).success,
    ).toBe(false);
    expect(
      extensionList.safeParse([
        {
          ...diagram,
          data: {
            nodes: [{ id: "a", label: "bad", position: { x: Infinity, y: 0 } }],
            edges: [],
          },
        },
      ]).success,
    ).toBe(false);
  });
  it("copies template extensions independently, preserves omission, persists removal and detects conflicts", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "planner-extensions-"));
    let s = new PlannerStore(path.join(dir, "db"));
    try {
      const { revision, ...base } = s.getTemplate("view");
      s.saveTemplate({ ...base, extensions: [diagram] }, revision);
      const p = s.createProject({ title: "Extensions" });
      const d = s.createDocument({
        projectId: p.id,
        title: "Document",
        phase: "design",
        templateName: "view",
      });
      expect(d.extensions).toEqual([diagram]);
      s.saveTemplate({ ...base, extensions: [] }, revision + 1);
      expect(s.document(d.id).extensions).toEqual([diagram]);
      expect(s.document(d.id).templateSnapshot?.extensions).toEqual([diagram]);
      const updated = s.updateDocument(d.id, {
        body: "new",
        expectedRevision: 1,
      });
      expect(updated.extensions).toEqual([diagram]);
      expect(() =>
        s.updateDocument(d.id, { extensions: [], expectedRevision: 1 }),
      ).toThrow(/revision/);
      s.close();
      s = new PlannerStore(path.join(dir, "db"));
      expect(s.document(d.id).extensions).toEqual([diagram]);
      s.updateDocument(d.id, { extensions: [], expectedRevision: 2 });
      s.close();
      s = new PlannerStore(path.join(dir, "db"));
      expect(s.document(d.id).extensions).toEqual([]);
    } finally {
      s.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("reopens verified documents only when extension content changes", () => {
    const s = new PlannerStore(":memory:");
    try {
      const p = s.createProject({ title: "Reopen" });
      let d: Document = s.createDocument({
        projectId: p.id,
        title: "Doc",
        phase: "design",
        templateName: "view",
        extensions: [diagram],
      });
      d = s.updateCheck(d.id, d.checklist[0].id, {
        aiResult: "passed",
        expectedRevision: d.revision,
      });
      d = s.confirmCheck(d.id, d.checklist[0].id, true, d.revision);
      expect(d.status).toBe("verified");
      d = s.updateDocument(d.id, {
        extensions: [diagram],
        expectedRevision: d.revision,
      });
      expect(d.status).toBe("verified");
      d = s.updateDocument(d.id, {
        extensions: [{ ...diagram, title: "Changed" }],
        expectedRevision: d.revision,
      });
      expect(d.status).toBe("reopen");
      expect(d.checklist[0].humanConfirmed).toBe(true);
    } finally {
      s.close();
    }
  });
});
