import { describe, it, expect } from "vitest";
import { PlannerStore } from "../src/app/server/store";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
function fixture() {
  const store = new PlannerStore(":memory:");
  const p = store.createProject({ title: "Test" });
  const d = store.createDocument({
    projectId: p.id,
    title: "Login",
    phase: "design",
    templateName: "view",
  });
  return { store, p, d };
}
describe("document lifecycle", () => {
  it("snapshots templates, indexes expose children, result upsert and persistence", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "planner-unit-"));
    let s = new PlannerStore(path.join(dir, "db"));
    try {
      const p = s.createProject({ title: "Persist" });
      const t = s.getTemplate("view");
      const d = s.createDocument({
        projectId: p.id,
        title: "Screen",
        phase: "design",
        templateName: "view",
      });
      const { revision, ...input } = t;
      s.saveTemplate({ ...input, body: "changed" }, revision);
      expect(s.document(d.id).body).toBe(t.body);
      expect(s.getDocument(d.parentId!).children[0].id).toBe(d.id);
      const r = s.recordVerification(d.id, "first", d.revision);
      const r2 = s.recordVerification(
        d.id,
        "second",
        s.document(d.id).revision,
      );
      expect(r2.id).toBe(r.id);
      expect(r2.body).toBe("second");
      s.close();
      s = new PlannerStore(path.join(dir, "db"));
      expect(s.getProject(p.id).title).toBe("Persist");
      expect(s.getDocument(d.id).children).toHaveLength(1);
    } finally {
      s.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("selective reopen preserves unaffected confirmation and transaction rollback", () => {
    const { store: s, d } = fixture();
    try {
      let current = s.addCheck(d.id, { label: "Second" }, d.revision);
      for (const item of current.checklist) {
        current = s.updateCheck(d.id, item.id, {
          aiResult: "passed",
          expectedRevision: current.revision,
        });
        current = s.confirmCheck(d.id, item.id, true, current.revision);
      }
      expect(current.status).toBe("verified");
      const [first, second] = current.checklist;
      expect(() =>
        s.reopen(d.id, {
          affectedItemIds: [first.id, "missing"],
          reason: "change",
          expectedRevision: current.revision,
        }),
      ).toThrow();
      expect(s.document(d.id).status).toBe("verified");
      current = s.reopen(d.id, {
        affectedItemIds: [first.id],
        reason: "change",
        expectedRevision: current.revision,
      });
      expect(current.status).toBe("reopen");
      expect(current.checklist.find((i) => i.id === first.id)).toMatchObject({
        aiResult: "pending",
        humanConfirmed: false,
      });
      expect(current.checklist.find((i) => i.id === second.id)).toMatchObject({
        aiResult: "passed",
        humanConfirmed: true,
      });
    } finally {
      s.close();
    }
  });
  it("rejects stale revisions, forged human confirmation and cross-project references", () => {
    const { store: s, p, d } = fixture();
    try {
      const other = s.createProject({ title: "Other" });
      expect(() =>
        s.createDocument({
          projectId: other.id,
          parentId: d.id,
          title: "Bad",
          phase: "design",
          templateName: "view",
        }),
      ).toThrow("Cross-project");
      expect(() =>
        s.updateCheck(d.id, d.checklist[0].id, {
          humanConfirmed: true,
          expectedRevision: d.revision,
        }),
      ).toThrow();
      s.updateDocument(d.id, { body: "updated", expectedRevision: d.revision });
      expect(() =>
        s.updateDocument(d.id, { body: "stale", expectedRevision: d.revision }),
      ).toThrow("revision");
      expect(() =>
        s.createNode(other.id, {
          label: "bad",
          phase: "design",
          documentId: d.id,
          position: 0,
        }),
      ).toThrow();
      expect(() => s.deleteDocument(p.indexes[0].id, 1)).toThrow(
        "cannot be deleted",
      );
    } finally {
      s.close();
    }
  });
  it("validates overview cycles and clears links when target is deleted", () => {
    const { store: s, p, d } = fixture();
    try {
      let o = s.createDocument({
        projectId: p.id,
        title: "Overview",
        phase: "design",
        templateName: "overview",
      });
      const entry = {
        id: "login",
        parentId: null,
        title: "Login",
        what: "Authenticate",
        how: "API",
        verificationDocumentId: d.id,
      };
      expect(() =>
        s.updateDocument(o.id, {
          overview: [{ ...entry, parentId: "login" }],
          expectedRevision: 1,
        }),
      ).toThrow("cycle");
      s.updateDocument(o.id, { overview: [entry], expectedRevision: 1 });
      s.deleteDocument(d.id, d.revision);
      o = s.getDocument(o.id);
      expect(o.overview[0].verificationDocumentId).toBeNull();
      expect(o.revision).toBe(3);
    } finally {
      s.close();
    }
  });
});

it("human confirmation is independent of AI result and clears only on label changes or reopen", () => {
  const { store, d } = fixture();
  try {
    const id = d.checklist[0].id;
    let current = store.confirmCheck(d.id, id, true, d.revision);
    expect(current.checklist[0]).toMatchObject({
      aiResult: "pending",
      humanConfirmed: true,
    });
    expect(current.status).toBe("in-progress");
    for (const aiResult of [
      "failed",
      "skipped",
      "pending",
      "passed",
    ] as const) {
      current = store.updateCheck(d.id, id, {
        aiResult,
        expectedRevision: current.revision,
      });
      expect(current.checklist[0].humanConfirmed).toBe(true);
      current = store.confirmCheck(d.id, id, false, current.revision);
      expect(current.checklist[0].humanConfirmed).toBe(false);
      current = store.confirmCheck(d.id, id, true, current.revision);
      expect(current.checklist[0].humanConfirmed).toBe(true);
    }
    expect(current.status).toBe("verified");
    current = store.updateCheck(d.id, id, {
      label: "수정된 조건",
      expectedRevision: current.revision,
    });
    expect(current.checklist[0]).toMatchObject({
      aiResult: "pending",
      humanConfirmed: false,
    });
  } finally {
    store.close();
  }
});
