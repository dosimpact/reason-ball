import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import {
  checkInput,
  checkPatch,
  documentInput,
  documentPatch,
  nodeInput,
  reopenInput,
  templateInput,
  title,
  type Document,
  type Project,
  type Template,
  type FlowNode,
  type ChecklistItem,
} from "@/entities/planner/model";
import { ensure, nextStatus, validateOverview } from "@/entities/planner/rules";

import { verificationTemplates } from "./verification-templates";

export class PlannerStore {
  readonly db: DatabaseSync;
  constructor(filename: string) {
    if (filename !== ":memory:")
      mkdirSync(dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db
      .exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS templates(name TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, parent_id TEXT REFERENCES documents(id) ON DELETE CASCADE, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS checks(id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE, label TEXT NOT NULL, ai_result TEXT NOT NULL DEFAULT 'pending', human_confirmed INTEGER NOT NULL DEFAULT 0, position INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS nodes(id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, document_id TEXT REFERENCES documents(id) ON DELETE SET NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS changes(id INTEGER PRIMARY KEY AUTOINCREMENT);
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS documents_project ON documents(project_id);
      CREATE INDEX IF NOT EXISTS checks_document ON checks(document_id);
    `);
    this.seedTemplates();
    this.seedVerificationTemplates();
  }
  private seedTemplates() {
    if (this.db.prepare("SELECT 1 FROM settings WHERE key='seeded'").get())
      return;
    this.transaction(() => {
      for (const [name, kind] of [
        ["view", "design-verification"],
        ["api", "design-verification"],
        ["e2e", "design-verification"],
        ["implementation", "implementation"],
        ["overview", "overview"],
      ] as const) {
        const t: Template = {
          name,
          title: name,
          kind,
          body: "## 목적\n\n## 설계\n\n## 검증 방법\n",
          example: "목적과 완료 조건을 구체적으로 작성하세요.",
          prompt: "설계된 범위만 작업하고 검증 체크리스트와 결과를 기록하세요.",
          checklist: kind === "overview" ? [] : ["설계된 동작 확인"],
          revision: 1,
        };
        this.db
          .prepare("INSERT OR IGNORE INTO templates VALUES (?,?)")
          .run(name, JSON.stringify(t));
      }
      this.db.prepare("INSERT INTO settings VALUES ('seeded','1')").run();
    });
  }
  private seedVerificationTemplates() {
    const key = "verification-templates-v1";
    if (this.db.prepare("SELECT 1 FROM settings WHERE key=?").get(key)) return;
    this.transaction(() => {
      for (const template of verificationTemplates) {
        this.db
          .prepare("INSERT OR IGNORE INTO templates VALUES (?,?)")
          .run(template.name, JSON.stringify({ ...template, revision: 1 }));
      }
      this.db.prepare("INSERT INTO settings VALUES (?,?)").run(key, "1");
    });
  }
  close() {
    this.db.close();
  }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.prepare("INSERT INTO changes DEFAULT VALUES").run();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  version() {
    return (
      this.db
        .prepare("SELECT coalesce(max(id),0) AS version FROM changes")
        .get() as { version: number }
    ).version;
  }
  private json<T>(
    table: "projects" | "templates" | "documents" | "nodes",
    key: string,
  ): T {
    const row = this.db
      .prepare(
        `SELECT data FROM ${table} WHERE ${table === "templates" ? "name" : "id"}=?`,
      )
      .get(key) as { data: string } | undefined;
    ensure(row, `${table}: not found`, 404);
    return JSON.parse(row.data);
  }
  listProjects(): Project[] {
    return this.db
      .prepare("SELECT data FROM projects ORDER BY rowid")
      .all()
      .map((r) => JSON.parse(r.data as string));
  }
  getProject(id: string) {
    return {
      ...this.json<Project>("projects", id),
      indexes: this.listDocuments(id).filter((d) => d.kind === "index"),
      nodes: this.listNodes(id),
    };
  }
  createProject(input: unknown) {
    const data = z.object({ title }).strict().parse(input);
    return this.transaction(() => {
      const p: Project = {
        id: randomUUID(),
        title: data.title,
        createdAt: new Date().toISOString(),
      };
      this.db
        .prepare("INSERT INTO projects VALUES (?,?)")
        .run(p.id, JSON.stringify(p));
      for (const [position, phase] of (
        ["design", "implementation", "verification"] as const
      ).entries()) {
        const d = this.insertDocument({
          projectId: p.id,
          parentId: null,
          title: `${phase} index`,
          kind: "index",
          phase,
          body: "",
          templateSnapshot: null,
        });
        this.insertNode(p.id, {
          label: phase,
          phase,
          documentId: d.id,
          position,
        });
      }
      return this.getProject(p.id);
    });
  }
  updateProject(id: string, input: unknown) {
    const data = z.object({ title }).strict().parse(input);
    return this.transaction(() => {
      const p = this.json<Project>("projects", id);
      p.title = data.title;
      this.db
        .prepare("UPDATE projects SET data=? WHERE id=?")
        .run(JSON.stringify(p), id);
      return p;
    });
  }
  deleteProject(id: string) {
    return this.transaction(() => {
      this.json("projects", id);
      this.db.prepare("DELETE FROM projects WHERE id=?").run(id);
      return { deleted: id };
    });
  }
  listTemplates(): Template[] {
    return this.db
      .prepare("SELECT data FROM templates ORDER BY name")
      .all()
      .map((r) => JSON.parse(r.data as string));
  }
  getTemplate(name: string): Template {
    return this.json("templates", name);
  }
  saveTemplate(input: unknown, expectedRevision?: number) {
    const data = templateInput.parse(input);
    return this.transaction(() => {
      const exists = this.db
        .prepare("SELECT data FROM templates WHERE name=?")
        .get(data.name);
      if (exists) {
        ensure(
          expectedRevision === this.getTemplate(data.name).revision,
          "Template revision conflict",
          409,
        );
      } else {
        ensure(expectedRevision === undefined, "Template not found", 404);
      }
      const t = {
        ...data,
        extensions:
          data.extensions ??
          (exists ? (this.getTemplate(data.name).extensions ?? []) : []),
        revision: (expectedRevision ?? 0) + 1,
      };
      this.db
        .prepare(
          "INSERT INTO templates VALUES (?,?) ON CONFLICT(name) DO UPDATE SET data=excluded.data",
        )
        .run(t.name, JSON.stringify(t));
      return t;
    });
  }
  deleteTemplate(name: string) {
    return this.transaction(() => {
      this.getTemplate(name);
      this.db.prepare("DELETE FROM templates WHERE name=?").run(name);
      return { deleted: name };
    });
  }
  listDocuments(projectId: string, parentId?: string): Document[] {
    this.json("projects", projectId);
    const rows =
      parentId === undefined
        ? this.db
            .prepare(
              "SELECT id FROM documents WHERE project_id=? ORDER BY rowid",
            )
            .all(projectId)
        : this.db
            .prepare(
              "SELECT id FROM documents WHERE project_id=? AND parent_id=? ORDER BY rowid",
            )
            .all(projectId, parentId);
    return rows.map((r) => this.document(r.id as string));
  }
  document(id: string): Document {
    const d = this.json<Document>("documents", id);
    d.extensions ??= [];
    d.checklist = this.db
      .prepare(
        "SELECT id,label,ai_result AS aiResult,human_confirmed AS humanConfirmed,position FROM checks WHERE document_id=? ORDER BY position,id",
      )
      .all(id)
      .map((r) => ({
        ...r,
        humanConfirmed: !!r.humanConfirmed,
      })) as unknown as ChecklistItem[];
    return d;
  }
  getDocument(id: string) {
    const d = this.document(id);
    return {
      ...d,
      children: this.listDocuments(d.projectId)
        .filter(
          (c) =>
            c.parentId === id ||
            (d.kind === "index" &&
              d.phase === "verification" &&
              (c.kind === "design-verification" ||
                c.kind === "verification-result")),
        )
        .map((c) => ({
          id: c.id,
          title: c.title,
          kind: c.kind,
          href: `/api/documents/${c.id}`,
        })),
    };
  }
  private insertDocument(
    data: Pick<
      Document,
      | "projectId"
      | "parentId"
      | "title"
      | "kind"
      | "phase"
      | "body"
      | "templateSnapshot"
      | "extensions"
    >,
  ) {
    const d: Document = {
      ...data,
      id: randomUUID(),
      overview: [],
      extensions: structuredClone(data.extensions ?? []),
      status: "draft",
      revision: 1,
      checklist: [],
    };
    this.db
      .prepare("INSERT INTO documents VALUES (?,?,?,?)")
      .run(d.id, d.projectId, d.parentId, JSON.stringify(d));
    return d;
  }
  private writeDocument(d: Document) {
    const { checklist: _, ...data } = d;
    void _;
    this.db
      .prepare("UPDATE documents SET data=? WHERE id=?")
      .run(JSON.stringify({ ...data, checklist: [] }), d.id);
    return this.document(d.id);
  }
  private revision(id: string, expected: number) {
    const d = this.document(id);
    ensure(
      d.revision === expected,
      "Document revision conflict: reload latest document",
      409,
    );
    return d;
  }
  private sameProject(id: string, projectId: string) {
    ensure(
      this.document(id).projectId === projectId,
      "Cross-project reference is forbidden",
    );
  }
  createDocument(input: unknown) {
    const data = documentInput.parse(input);
    return this.transaction(() => {
      this.json("projects", data.projectId);
      const template = data.templateName
        ? this.getTemplate(data.templateName)
        : null;
      ensure(template || data.kind, "templateName or kind is required");
      const parentId =
        data.parentId ??
        this.listDocuments(data.projectId).find(
          (d) => d.kind === "index" && d.phase === data.phase,
        )!.id;
      this.sameProject(parentId, data.projectId);
      const d = this.insertDocument({
        projectId: data.projectId,
        parentId,
        title: data.title,
        kind: template?.kind ?? data.kind!,
        phase: data.phase,
        body: data.body ?? template?.body ?? "",
        templateSnapshot: template,
        extensions: data.extensions ?? template?.extensions ?? [],
      });
      template?.checklist.forEach((label, position) =>
        this.insertCheck(d.id, label, position),
      );
      return this.getDocument(d.id);
    });
  }
  updateDocument(id: string, input: unknown) {
    const patch = documentPatch.parse(input);
    return this.transaction(() => {
      const d = this.revision(id, patch.expectedRevision);
      const contentChanged =
        (patch.extensions !== undefined &&
          JSON.stringify(patch.extensions) !==
            JSON.stringify(d.extensions ?? [])) ||
        (patch.body !== undefined && patch.body !== d.body) ||
        (patch.title !== undefined && patch.title !== d.title) ||
        (patch.overview !== undefined &&
          JSON.stringify(patch.overview) !== JSON.stringify(d.overview));
      if (patch.overview) {
        ensure(d.kind === "overview", "Only overview documents accept a tree");
        validateOverview(patch.overview);
        for (const e of patch.overview)
          if (e.verificationDocumentId)
            this.sameProject(e.verificationDocumentId, d.projectId);
        d.overview = patch.overview;
      }
      if (patch.extensions !== undefined) d.extensions = patch.extensions;
      if (patch.title !== undefined) d.title = patch.title;
      if (patch.body !== undefined && patch.body !== d.body) {
        d.body = patch.body;
        if (d.status === "verified") d.status = "reopen";
      }
      if (contentChanged && d.status === "verified") d.status = "reopen";
      d.revision++;
      return this.writeDocument(d);
    });
  }
  deleteDocument(id: string, expected: number) {
    return this.transaction(() => {
      const d = this.revision(id, expected);
      ensure(d.kind !== "index", "Stage indexes cannot be deleted");
      const descendants = new Set<string>();
      const visit = (key: string) => {
        descendants.add(key);
        for (const c of this.listDocuments(d.projectId, key)) visit(c.id);
      };
      visit(id);
      for (const other of this.listDocuments(d.projectId)) {
        if (descendants.has(other.id)) continue;
        let changed = false;
        other.overview = other.overview.map((e) => {
          if (
            e.verificationDocumentId &&
            descendants.has(e.verificationDocumentId)
          ) {
            changed = true;
            return { ...e, verificationDocumentId: null };
          }
          return e;
        });
        if (changed) {
          other.revision++;
          this.writeDocument(other);
        }
      }
      this.db.prepare("DELETE FROM documents WHERE id=?").run(id);
      return { deleted: id };
    });
  }
  private insertCheck(documentId: string, label: string, position: number) {
    this.db
      .prepare(
        "INSERT INTO checks(id,document_id,label,position) VALUES (?,?,?,?)",
      )
      .run(randomUUID(), documentId, label, position);
  }
  private finishChecks(d: Document) {
    d.checklist = this.document(d.id).checklist;
    d.status = nextStatus(d.checklist, d.status);
    d.revision++;
    return this.writeDocument(d);
  }
  addCheck(id: string, input: unknown, expected: number) {
    const data = checkInput.parse(input);
    return this.transaction(() => {
      const d = this.revision(id, expected);
      this.insertCheck(id, data.label, data.position ?? d.checklist.length);
      return this.finishChecks(d);
    });
  }
  updateCheck(id: string, itemId: string, input: unknown) {
    const patch = checkPatch.parse(input);
    return this.transaction(() => {
      const d = this.revision(id, patch.expectedRevision);
      const item = d.checklist.find((i) => i.id === itemId);
      ensure(item, "Checklist item not found", 404);
      const changedLabel =
        patch.label !== undefined && patch.label !== item.label;
      const result =
        patch.aiResult ?? (changedLabel ? "pending" : item.aiResult);
      this.db
        .prepare(
          "UPDATE checks SET label=?,ai_result=?,human_confirmed=?,position=? WHERE id=?",
        )
        .run(
          patch.label ?? item.label,
          result,
          changedLabel ? 0 : Number(item.humanConfirmed),
          patch.position ?? item.position,
          itemId,
        );
      return this.finishChecks(d);
    });
  }
  confirmCheck(
    id: string,
    itemId: string,
    confirmed: boolean,
    expected: number,
  ) {
    return this.transaction(() => {
      const d = this.revision(id, expected);
      const item = d.checklist.find((i) => i.id === itemId);
      ensure(item, "Checklist item not found", 404);
      this.db
        .prepare("UPDATE checks SET human_confirmed=? WHERE id=?")
        .run(Number(confirmed), itemId);
      return this.finishChecks(d);
    });
  }
  deleteCheck(id: string, itemId: string, expected: number) {
    return this.transaction(() => {
      const d = this.revision(id, expected);
      ensure(
        d.checklist.some((i) => i.id === itemId),
        "Checklist item not found",
        404,
      );
      this.db.prepare("DELETE FROM checks WHERE id=?").run(itemId);
      return this.finishChecks(d);
    });
  }
  reopen(id: string, input: unknown) {
    const data = reopenInput.parse(input);
    return this.transaction(() => {
      const d = this.revision(id, data.expectedRevision);
      ensure(
        data.affectedItemIds.every((key) =>
          d.checklist.some((i) => i.id === key),
        ),
        "Unknown affected checklist item",
      );
      for (const key of new Set(data.affectedItemIds))
        this.db
          .prepare(
            "UPDATE checks SET ai_result='pending',human_confirmed=0 WHERE id=?",
          )
          .run(key);
      d.status = "reopen";
      d.revision++;
      return { ...this.writeDocument(d), reason: data.reason };
    });
  }
  recordVerification(id: string, content: string, expected: number) {
    return this.transaction(() => {
      const parent = this.revision(id, expected);
      ensure(
        parent.kind === "design-verification",
        "Verification results belong to design-verification documents",
      );
      let result = this.listDocuments(parent.projectId, id).find(
        (d) => d.kind === "verification-result",
      );
      if (result) {
        result.body = content;
        result.revision++;
        this.writeDocument(result);
      } else
        result = this.insertDocument({
          projectId: parent.projectId,
          parentId: id,
          title: `${parent.title} — AI 검증 결과`,
          phase: "verification",
          kind: "verification-result",
          body: content,
          templateSnapshot: null,
        });
      parent.revision++;
      this.writeDocument(parent);
      return this.getDocument(result.id);
    });
  }
  listNodes(projectId: string): FlowNode[] {
    this.json("projects", projectId);
    return this.db
      .prepare(
        "SELECT data,document_id FROM nodes WHERE project_id=? ORDER BY rowid",
      )
      .all(projectId)
      .map((r) => ({
        ...JSON.parse(r.data as string),
        documentId: r.document_id,
      }))
      .sort((a, b) => a.position - b.position);
  }
  private insertNode(projectId: string, input: z.infer<typeof nodeInput>) {
    const n: FlowNode = { ...input, id: randomUUID(), projectId };
    this.db
      .prepare("INSERT INTO nodes VALUES (?,?,?,?)")
      .run(n.id, projectId, n.documentId, JSON.stringify(n));
    return n;
  }
  createNode(projectId: string, input: unknown) {
    const data = nodeInput.parse(input);
    return this.transaction(() => {
      this.json("projects", projectId);
      if (data.documentId) this.sameProject(data.documentId, projectId);
      return this.insertNode(projectId, data);
    });
  }
  updateNode(projectId: string, id: string, input: unknown) {
    const data = nodeInput.parse(input);
    return this.transaction(() => {
      const n = this.json<FlowNode>("nodes", id);
      ensure(n.projectId === projectId, "Node not found", 404);
      if (data.documentId) this.sameProject(data.documentId, projectId);
      const updated = { ...n, ...data };
      this.db
        .prepare("UPDATE nodes SET document_id=?,data=? WHERE id=?")
        .run(data.documentId, JSON.stringify(updated), id);
      return updated;
    });
  }
  deleteNode(projectId: string, id: string) {
    return this.transaction(() => {
      const n = this.json<FlowNode>("nodes", id);
      ensure(n.projectId === projectId, "Node not found", 404);
      this.db.prepare("DELETE FROM nodes WHERE id=?").run(id);
      return { deleted: id };
    });
  }
}
