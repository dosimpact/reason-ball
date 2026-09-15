import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  mkdtemp,
  rm,
  writeFile,
  readFile,
  rename,
  readdir,
  unlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PlannerStore } from "../src/app/server/store";
import { exampleContent } from "../src/app/lib/catalog";
import type { Project } from "../src/entities/document/model/schema";
let root: string, store: PlannerStore, project: Project;
const draft = () => ({
  type: "flow-spec-overview",
  title: "예산 추천",
  scope: "budget",
  content: exampleContent("flow-spec-overview"),
});
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "planner-test-"));
  store = await PlannerStore.open(root, 0);
  project = await store.createProject("project-1", { name: "Google Ads" });
});
afterEach(async () => {
  await store.close();
  await rm(root, { recursive: true, force: true });
});
describe("Durable project documents", () => {
  it("isolates documents and historical revisions between projects", async () => {
    const doc = await store.saveDocument("isolated", project.id, draft());
    const other = await store.createProject("other-project", { name: "Other" });
    expect((await store.index(other.id)).documents).toEqual([]);
    for (const revision of [undefined, 1]) {
      await expect(
        store.getDocument(other.id, doc.id, revision),
      ).rejects.toMatchObject({
        code: "DOCUMENT_NOT_FOUND",
      });
    }
  });
  it("never overwrites history after an old current file is restored", async () => {
    const first = await store.saveDocument("first", project.id, draft());
    const second = await store.saveDocument(
      "second",
      project.id,
      { ...draft(), title: "New" },
      first.id,
      1,
    );
    await writeFile(
      path.join(root, "projects", project.id, "documents", `${first.id}.json`),
      JSON.stringify(first),
    );
    await expect(
      store.saveDocument("rollback", project.id, draft(), first.id, 1),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    expect(await store.getDocument(project.id, first.id, 2)).toEqual(second);
  });
  it("recovers an interrupted multi-file commit before retrying it", async () => {
    const saved = await store.saveDocument("recovery", project.id, draft());
    await store.close();
    const journalDir = path.join(root, "journal");
    for (const file of await readdir(journalDir)) {
      const receipt = JSON.parse(
        await readFile(path.join(journalDir, file), "utf8"),
      );
      if (receipt.result.id !== saved.id) continue;
      await rename(
        path.join(journalDir, file),
        path.join(journalDir, file.replace(".done.json", ".pending.json")),
      );
    }
    await unlink(
      path.join(root, "projects", project.id, "documents", `${saved.id}.json`),
    );
    store = await PlannerStore.open(root, 0);
    expect(await store.saveDocument("recovery", project.id, draft())).toEqual(
      saved,
    );
    expect(await store.getDocument(project.id, saved.id)).toEqual(saved);
    expect(
      (await readdir(journalDir)).some((f) => f.endsWith(".pending.json")),
    ).toBe(false);
  });
  it("rejects a second writer, and emits metadata changes after sources are durable", async () => {
    await expect(PlannerStore.open(root, 0)).rejects.toMatchObject({
      code: "STORE_LOCKED",
    });
    const changes: unknown[] = [];
    store.events.on("change", (change) => changes.push(change));
    await store.addSource("s", project.id, {
      kind: "reference",
      title: "참조",
      originalText: "보존",
    });
    expect(changes).toContainEqual({ projectId: project.id, kind: "updated" });
    expect((await store.getProject(project.id)).sources[0].originalText).toBe(
      "보존",
    );
  });
  it("keeps successful writes when another document fails validation", async () => {
    const good = await store.saveDocument("good", project.id, draft());
    await expect(
      store.saveDocument("bad", project.id, { ...draft(), type: "invalid" }),
    ).rejects.toMatchObject({ code: "UNKNOWN_DOCUMENT_TYPE" });
    expect((await store.index(project.id)).documents.map((d) => d.id)).toEqual([
      good.id,
    ]);
  });
  it("does not allow unresolved blocking questions to be approved", async () => {
    const doc = await store.saveDocument("a", project.id, {
      ...draft(),
      openQuestions: [
        {
          id: "q",
          text: "누가 사용하나요?",
          sourceIds: [],
          blocking: true,
          resolved: false,
        },
      ],
    });
    const reviewed = await store.review(
      "r",
      project.id,
      doc.id,
      1,
      "review",
      "사용자",
    );
    await expect(
      store.review(
        "approve",
        project.id,
        doc.id,
        reviewed.revision,
        "approve",
        "사용자",
      ),
    ).rejects.toMatchObject({ code: "UNRESOLVED_QUESTION" });
  });
  it("starts empty and allows multiple documents of the same type and scope", async () => {
    expect((await store.index(project.id)).documents).toEqual([]);
    const a = await store.saveDocument("create-a", project.id, draft()),
      b = await store.saveDocument("create-b", project.id, draft());
    expect(a.id).not.toBe(b.id);
    expect((await store.index(project.id)).documents).toHaveLength(2);
  });
  it("retries return the same result even after restart, and mismatched reuse fails", async () => {
    const a = await store.saveDocument("save-once", project.id, draft());
    await store.close();
    store = await PlannerStore.open(root, 0);
    expect(await store.saveDocument("save-once", project.id, draft())).toEqual(
      a,
    );
    await expect(
      store.saveDocument("save-once", project.id, {
        ...draft(),
        title: "different",
      }),
    ).rejects.toMatchObject({ code: "REQUEST_ID_CONFLICT" });
    expect((await store.index(project.id)).documents).toHaveLength(1);
  });
  it("serializes concurrent saves and reports stale revision", async () => {
    const a = await store.saveDocument("a", project.id, draft());
    const results = await Promise.allSettled([
      store.saveDocument("b", project.id, { ...draft(), title: "B" }, a.id, 1),
      store.saveDocument("c", project.id, { ...draft(), title: "C" }, a.id, 1),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "REVISION_CONFLICT" },
    });
    expect((await store.getDocument(project.id, a.id)).revision).toBe(2);
  });
  it("preserves sources and separates human approval and immutable handoff", async () => {
    const p = await store.addSource("source", project.id, {
      kind: "requirement",
      title: "사업 요구",
      originalText: "예산 추천을 보여준다.",
    });
    const a = await store.saveDocument("a", project.id, {
      ...draft(),
      facts: [
        { id: "fact", text: "예산 추천 필요", sourceIds: [p.sources[0].id] },
      ],
    });
    await expect(
      store.handoff(project.id, [{ documentId: a.id, revision: 1 }]),
    ).rejects.toMatchObject({ code: "NOT_APPROVED" });
    await expect(
      store.review("bad", project.id, a.id, 1, "approve", "사용자"),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    const reviewed = await store.review(
      "review",
      project.id,
      a.id,
      1,
      "review",
      "사용자",
    );
    const approved = await store.review(
      "approve",
      project.id,
      a.id,
      reviewed.revision,
      "approve",
      "사용자",
    );
    await store.saveDocument(
      "update",
      project.id,
      draft(),
      a.id,
      approved.revision,
    );
    const handoff = await store.handoff(project.id, [
      { documentId: a.id, revision: approved.revision },
    ]);
    expect(handoff.documents[0].status).toBe("approved");
    expect(handoff.project.sources[0].originalText).toBe(
      "예산 추천을 보여준다.",
    );
    expect((await store.getDocument(project.id, a.id)).status).toBe("draft");
  });
  it("keeps the last good document and surfaces corrupt external JSON", async () => {
    const a = await store.saveDocument("a", project.id, draft());
    await writeFile(
      path.join(root, "projects", project.id, "documents", `${a.id}.json`),
      "{broken",
    );
    const index = await store.index(project.id);
    expect(index.problems).toHaveLength(1);
    expect(index.documents[0].revision).toBe(1);
    expect((await store.getDocument(project.id, a.id)).title).toBe(a.title);
    await expect(
      store.saveDocument("b", project.id, draft(), a.id, 1),
    ).rejects.toMatchObject({ code: "SOURCE_FILE_INVALID" });
  });
  it("rejects unknown projects, unsafe IDs and unsourced facts", async () => {
    await expect(store.index("missing")).rejects.toMatchObject({
      code: "PROJECT_NOT_FOUND",
    });
    await expect(store.index("../outside")).rejects.toThrow();
    await expect(
      store.saveDocument("a", project.id, {
        ...draft(),
        facts: [{ id: "f", text: "unproven", sourceIds: [] }],
      }),
    ).rejects.toMatchObject({ code: "SCHEMA_INVALID" });
  });
});
