import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PlannerStore } from "../src/app/server/store";
import { collaborationOverview } from "../src/app/server/collaboration";
import { exampleContent } from "../src/app/lib/catalog";
import type { ApiSpec } from "../src/entities/document/model/schema";
import type { FlowTree } from "../src/features/flow-spec-syntax/parser";
let root: string, store: PlannerStore, projectId: string;
const draft = (type = "flow-spec-overview") => ({
  type,
  title: "Design",
  scope: "budget",
  content: exampleContent(type as "flow-spec-overview"),
});
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "planner-completion-"));
  store = await PlannerStore.open(root, 0);
  projectId = (await store.createProject("p", { name: "Project" })).id;
});
afterEach(async () => {
  await store.close();
  await rm(root, { recursive: true, force: true });
});
describe("Collaboration", () => {
  it("records idempotent question replies without resolving or approving", async () => {
    const doc = await store.saveDocument("question", projectId, {
      ...draft(),
      openQuestions: [{ id: "q1", text: "Budget?", blocking: true }],
    });
    const reply = await store.comment(
      "reply",
      projectId,
      doc.id,
      1,
      "100",
      "User",
      "q1",
    );
    expect(reply).toMatchObject({
      revision: 2,
      status: "draft",
      approval: null,
      openQuestions: [{ resolved: false }],
      comments: [{ questionId: "q1", text: "100" }],
    });
    expect(
      await store.comment("reply", projectId, doc.id, 1, "100", "User", "q1"),
    ).toEqual(reply);
    await expect(
      store.comment("stale", projectId, doc.id, 1, "200", "User", "q1"),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    await expect(
      store.comment("missing", projectId, doc.id, 2, "200", "User", "missing"),
    ).rejects.toMatchObject({ code: "SCHEMA_INVALID" });
    const overview = await collaborationOverview(store);
    expect(overview[0].documents[0]).toMatchObject({
      revision: 2,
      comments: [{ questionId: "q1" }],
      needsReview: false,
    });
    expect(overview[0].problems).toEqual([]);
  });
  it("returns empty projects and surfaces failed document reads", async () => {
    expect(await collaborationOverview(store)).toEqual([
      { id: projectId, documents: [], problems: [] },
    ]);
    await store.saveDocument("one", projectId, draft());
    vi.spyOn(store, "getDocument").mockRejectedValueOnce(
      new Error("unavailable"),
    );
    const overview = await collaborationOverview(store);
    expect(overview[0].documents).toEqual([]);
    expect(overview[0].problems).toHaveLength(1);
    vi.restoreAllMocks();
  });
});
describe("Versioned references", () => {
  it("pins legacy unversioned Overview references and reports changes and incoming links", async () => {
    const overview = await store.saveDocument("o", projectId, draft());
    const detail = await store.saveDocument("d", projectId, {
      ...draft("flow-spec-detail"),
      overviewDocumentId: overview.id,
      overviewNodeId: "step-0",
    });
    expect(detail.overviewRevision).toBe(1);
    expect(
      (await store.relations(projectId, overview.id)).incoming,
    ).toMatchObject([{ documentId: detail.id }]);
    expect(
      (await store.relations(projectId, detail.id)).outgoing[0].needsReview,
    ).toBe(false);
    await store.saveDocument(
      "update",
      projectId,
      { ...draft(), title: "Updated overview" },
      overview.id,
      1,
    );
    expect(
      (await store.relations(projectId, detail.id)).outgoing[0],
    ).toMatchObject({ revision: 1, currentRevision: 2, needsReview: true });
    expect((await store.getDocument(projectId, overview.id, 1)).title).toBe(
      "Design",
    );
  });
  it("rejects absent, cross-project, wrong-type, missing-version and missing-node references", async () => {
    const other = await store.createProject("other", { name: "Other" });
    const outside = await store.saveDocument("outside", other.id, draft());
    const overview = await store.saveDocument("o", projectId, draft());
    const detail = await store.saveDocument(
      "d",
      projectId,
      draft("flow-spec-detail"),
    );
    const references = [
      { overviewDocumentId: "missing" },
      { overviewDocumentId: outside.id },
      { overviewDocumentId: detail.id },
      { overviewDocumentId: overview.id, overviewRevision: 99 },
      { overviewDocumentId: overview.id, overviewNodeId: "missing" },
      { overviewNodeId: "step-0" },
    ];
    for (const [i, reference] of references.entries())
      await expect(
        store.saveDocument(`bad-${i}`, projectId, {
          ...draft("flow-spec-detail"),
          ...reference,
        }),
      ).rejects.toThrow();
    await expect(
      store.saveDocument("bad-overview", projectId, {
        ...draft(),
        overviewDocumentId: overview.id,
      }),
    ).rejects.toThrow();
    await expect(
      store.saveDocument(
        "self",
        projectId,
        { ...draft("flow-spec-detail"), overviewDocumentId: detail.id },
        detail.id,
        1,
      ),
    ).rejects.toThrow("자기 자신");
    expect((await store.index(projectId)).documents).toHaveLength(2);
  });
  it("validates API baselines and compares their pinned content", async () => {
    const base = await store.saveDocument(
      "base",
      projectId,
      draft("bff-api-spec"),
    );
    const content = {
      ...(exampleContent("bff-api-spec") as ApiSpec),
      specKind: "change",
      changeReason: "new field",
      baseDocumentId: base.id,
      baseRevision: 1,
    };
    const change = await store.saveDocument("change", projectId, {
      ...draft("bff-api-spec"),
      content,
    });
    const comparison = await store.compareDocuments(
      projectId,
      { documentId: base.id, revision: 1 },
      { documentId: change.id, revision: 1 },
    );
    expect(comparison.differences).toContainEqual({
      path: "/content/specKind",
      kind: "changed",
      before: "existing",
      after: "change",
    });
    await expect(
      store.saveDocument("wrong-api-type", projectId, {
        ...draft("upstream-api-spec"),
        content,
      }),
    ).rejects.toThrow("타입");
    await expect(
      store.saveDocument("wrong-version", projectId, {
        ...draft("bff-api-spec"),
        content: { ...content, baseRevision: 999 },
      }),
    ).rejects.toThrow();
    const flow = await store.saveDocument("flow", projectId, draft());
    await expect(
      store.compareDocuments(
        projectId,
        { documentId: base.id, revision: 1 },
        { documentId: flow.id, revision: 1 },
      ),
    ).rejects.toThrow("타입");
  });
  it("reports a corrupt current reference while keeping the pinned version readable", async () => {
    const overview = await store.saveDocument("o", projectId, draft());
    const detail = await store.saveDocument("d", projectId, {
      ...draft("flow-spec-detail"),
      overviewDocumentId: overview.id,
    });
    await writeFile(
      path.join(
        root,
        "projects",
        projectId,
        "documents",
        `${overview.id}.json`,
      ),
      "{broken",
    );
    expect(
      (await store.relations(projectId, detail.id)).outgoing[0],
    ).toMatchObject({
      needsReview: true,
      revision: 1,
      error: expect.any(String),
    });
    expect((await store.getDocument(projectId, overview.id, 1)).id).toBe(
      overview.id,
    );
  });
});
describe("Durable Flow edits", () => {
  it("keeps approvals immutable and retries idempotent across restarts", async () => {
    const doc = await store.saveDocument("doc", projectId, draft());
    await store.review("review", projectId, doc.id, 1, "review", "local");
    const approved = await store.review(
      "approve",
      projectId,
      doc.id,
      2,
      "approve",
      "local",
    );
    const edit = { action: "rename", nodeId: "step-0", label: "new" } as const;
    const updated = await store.editFlow("edit", projectId, doc.id, 3, edit);
    expect(updated).toMatchObject({
      status: "draft",
      approval: null,
      revision: 4,
    });
    expect(await store.getDocument(projectId, doc.id, 3)).toEqual(approved);
    await store.close();
    store = await PlannerStore.open(root, 0);
    expect(await store.editFlow("edit", projectId, doc.id, 3, edit)).toEqual(
      updated,
    );
    await expect(
      store.editFlow("conflict", projectId, doc.id, 3, edit),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    await expect(
      store.editFlow("edit", projectId, doc.id, 3, { ...edit, label: "other" }),
    ).rejects.toMatchObject({ code: "REQUEST_ID_CONFLICT" });
  });
  it("rejects retired node IDs for both partial and whole-document writes", async () => {
    const doc = await store.saveDocument("doc", projectId, draft());
    await store.editFlow("remove", projectId, doc.id, 1, {
      action: "remove",
      nodeId: "step-0",
    });
    await expect(
      store.editFlow("reuse", projectId, doc.id, 2, {
        action: "insert",
        parentId: "layer-0",
        index: 0,
        node: { id: "step-0", kind: "step", label: "reuse" },
      }),
    ).rejects.toThrow("재사용");
    await expect(
      store.saveDocument("reuse-whole", projectId, draft(), doc.id, 2),
    ).rejects.toThrow("재사용");
    const added = await store.editFlow("fresh", projectId, doc.id, 2, {
      action: "insert",
      parentId: "layer-0",
      index: 0,
      node: { id: "fresh", kind: "step", label: "new" },
    });
    expect((added.content as FlowTree).layers[0].children[0].id).toBe("fresh");
  });
  it("serializes concurrent edits and rejects editing other document types", async () => {
    const doc = await store.saveDocument("doc", projectId, draft());
    const results = await Promise.allSettled(
      ["A", "B"].map((label) =>
        store.editFlow(label, projectId, doc.id, 1, {
          action: "rename",
          nodeId: "step-0",
          label,
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const api = await store.saveDocument(
      "api",
      projectId,
      draft("bff-api-spec"),
    );
    await expect(
      store.editFlow("bad", projectId, api.id, 1, {
        action: "remove",
        nodeId: "step-0",
      }),
    ).rejects.toThrow("Flow");
  });
});
describe("Figma source durability", () => {
  it("appends snapshots and avoids fetching again on a duplicate request", async () => {
    const loader = vi.fn().mockResolvedValue({
      kind: "figma",
      title: "Figma · Budget",
      originalText: '{"version":"v1"}',
      url: "https://www.figma.com/design/key",
    });
    const input = { url: "https://www.figma.com/design/key" };
    const result = await store.importFigma("import", projectId, input, loader);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]).toMatchObject({
      capturedAt: expect.any(String),
      originalText: '{"version":"v1"}',
    });
    await store.close();
    store = await PlannerStore.open(root, 0);
    expect(await store.importFigma("import", projectId, input, loader)).toEqual(
      result,
    );
    expect(loader).toHaveBeenCalledTimes(1);
    await expect(
      store.importFigma("import", projectId, { ...input, depth: 3 }, loader),
    ).rejects.toMatchObject({ code: "REQUEST_ID_CONFLICT" });
    loader.mockResolvedValue({
      ...result.sources[0],
      originalText: '{"version":"v2"}',
    });
    expect(
      (await store.importFigma("refresh", projectId, input, loader)).sources,
    ).toHaveLength(2);
    expect((await store.getProject(projectId)).sources[0]).toEqual(
      result.sources[0],
    );
  });
  it("failed fetches do not add sources and remain retryable", async () => {
    const loader = vi.fn().mockRejectedValue(new Error("offline"));
    const input = { url: "https://www.figma.com/design/key" };
    await expect(
      store.importFigma("retry", projectId, input, loader),
    ).rejects.toThrow();
    expect((await store.getProject(projectId)).sources).toEqual([]);
    loader.mockResolvedValue({
      kind: "figma",
      title: "ok",
      originalText: "{}",
      url: input.url,
    });
    expect(
      (await store.importFigma("retry", projectId, input, loader)).sources,
    ).toHaveLength(1);
  });
});
