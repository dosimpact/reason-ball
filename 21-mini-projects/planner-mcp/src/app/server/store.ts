import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { z } from "zod";
import {
  documentSchema,
  projectSchema,
  identifier,
  sourceSchema,
  type PlannerDocument,
  type Project,
  type Draft,
} from "@/entities/document/model/schema";
import { validateDraft, schemaError } from "@/app/lib/catalog";
import { PlannerError, errorResult } from "@/shared/lib/errors";
import { canonicalJson } from "@/shared/lib/json";
import { validateDocument } from "./validate-document";
import {
  documentReferences,
  type Relations,
} from "@/entities/document/lib/references";
import { compareJson } from "@/entities/document/lib/compare";
import {
  editFlowTree,
  flowEditSchema,
  indexFlow,
  type FlowTree,
  type FlowEdit,
} from "@/features/flow-spec-syntax/parser";
import { fetchFigma, figmaImportSchema, type FigmaInput } from "./figma";

type Write = { file: string; value: unknown };
type Receipt = {
  key: string;
  digest: string;
  result: unknown;
  writes: Write[];
};
export type Change = {
  projectId: string;
  documentId?: string;
  kind: "created" | "updated" | "deleted" | "error" | "recovered";
  revision?: number;
  message?: string;
};
const hash = (value: unknown) =>
  createHash("sha256").update(canonicalJson(value)).digest("hex");
const now = () => new Date().toISOString();
const id = (value: string) => identifier.parse(value);

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(file, "utf8"));
}
async function atomicJson(file: string, value: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  const handle = await fs.open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify(value, null, 2) + "\n");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(temporary, file);
}
async function exists(file: string) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
async function jsonFiles(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
  const files = await Promise.all(
    entries.map((e) =>
      e.isDirectory()
        ? jsonFiles(path.join(directory, e.name))
        : Promise.resolve(
            e.isFile() && e.name.endsWith(".json")
              ? [path.join(directory, e.name)]
              : [],
          ),
    ),
  );
  return files.flat();
}

export class PlannerStore {
  private queue: Promise<unknown> = Promise.resolve();
  private documents = new Map<string, PlannerDocument>();
  private projects = new Map<string, Project>();
  private problems = new Map<
    string,
    { projectId: string; documentId?: string; message: string }
  >();
  private timer?: ReturnType<typeof setInterval>;
  private lockFile: string;
  readonly events = new EventEmitter();

  private constructor(readonly root: string) {
    this.lockFile = path.join(root, ".writer-lock");
  }
  static async open(root: string, pollMs = 1000) {
    const store = new PlannerStore(path.resolve(root));
    await fs.mkdir(store.root, { recursive: true });
    await store.acquireLock();
    try {
      await store.recover();
      await store.scan();
      if (pollMs) {
        store.timer = setInterval(() => {
          void store.exclusive(() => store.scan()).catch(() => {});
        }, pollMs);
        store.timer.unref();
      }
      return store;
    } catch (error) {
      await fs.unlink(store.lockFile);
      throw error;
    }
  }
  private async acquireLock() {
    try {
      await fs.writeFile(this.lockFile, String(process.pid), {
        flag: "wx",
        mode: 0o600,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const pid = Number(await fs.readFile(this.lockFile, "utf8"));
      let live = true;
      try {
        process.kill(pid, 0);
      } catch (e) {
        live = (e as NodeJS.ErrnoException).code !== "ESRCH";
      }
      if (live || !Number.isSafeInteger(pid) || pid <= 0)
        throw new PlannerError(
          "STORE_LOCKED",
          "데이터 디렉터리를 다른 서버가 사용 중입니다.",
        );
      await fs.unlink(this.lockFile);
      await fs.writeFile(this.lockFile, String(process.pid), {
        flag: "wx",
        mode: 0o600,
      });
    }
  }
  async close() {
    if (this.timer) clearInterval(this.timer);
    await this.queue;
    this.events.removeAllListeners();
    await fs.unlink(this.lockFile);
  }
  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const pending = this.queue.then(work, work);
    this.queue = pending.catch(() => {});
    return pending;
  }
  private absolute(file: string) {
    const resolved = path.resolve(this.root, file);
    if (!resolved.startsWith(this.root + path.sep))
      throw new PlannerError("INVALID_PATH", "데이터 경로 오류");
    return resolved;
  }
  private async recover() {
    for (const file of await jsonFiles(path.join(this.root, "journal"))) {
      if (!file.endsWith(".pending.json")) continue;
      const receipt = (await readJson(file)) as Receipt;
      for (const write of receipt.writes)
        await atomicJson(this.absolute(write.file), write.value);
      await fs.rename(file, file.replace(".pending.json", ".done.json"));
    }
  }
  private async transact<T>(
    requestId: string,
    operation: unknown,
    prepare: () => Promise<{ result: T; writes: Write[] }>,
  ): Promise<T> {
    id(requestId);
    return this.exclusive(async () => {
      await this.recover();
      const key = hash(requestId),
        digest = hash(operation),
        base = path.join(this.root, "journal", key);
      if (await exists(base + ".done.json")) {
        const prior = (await readJson(base + ".done.json")) as Receipt;
        if (prior.digest !== digest)
          throw new PlannerError(
            "REQUEST_ID_CONFLICT",
            "같은 requestId에 다른 내용이 전달되었습니다.",
          );
        return prior.result as T;
      }
      const prepared = await prepare();
      const receipt: Receipt = { key, digest, ...prepared };
      await atomicJson(base + ".pending.json", receipt);
      try {
        for (const write of prepared.writes)
          await atomicJson(this.absolute(write.file), write.value);
        await fs.rename(base + ".pending.json", base + ".done.json");
        await this.scan();
      } catch {
        throw new PlannerError(
          "STORAGE_WRITE_FAILED",
          "저장 복구가 필요합니다. 같은 requestId로 재시도하세요.",
        );
      }
      return prepared.result;
    });
  }
  async listProjects(): Promise<Project[]> {
    const files = (await jsonFiles(path.join(this.root, "projects"))).filter(
      (f) => path.basename(f) === "project.json",
    );
    const values: Project[] = [];
    for (const file of files) {
      try {
        values.push(projectSchema.parse(await readJson(file)));
      } catch {
        this.problems.set(file, {
          projectId: path.basename(path.dirname(file)),
          message: "프로젝트 메타데이터 손상",
        });
      }
    }
    return values.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async getProject(projectId: string) {
    const file = this.absolute(`projects/${id(projectId)}/project.json`);
    if (!(await exists(file)))
      throw new PlannerError("PROJECT_NOT_FOUND", "프로젝트가 없습니다.");
    try {
      return projectSchema.parse(await readJson(file));
    } catch {
      throw new PlannerError(
        "SOURCE_FILE_INVALID",
        "프로젝트 메타데이터를 읽을 수 없습니다.",
      );
    }
  }
  createProject(
    requestId: string,
    input: { name: string; description?: string },
  ) {
    return this.transact(
      requestId,
      { action: "createProject", input },
      async () => {
        const timestamp = now();
        const project = projectSchema.parse({
          id: randomUUID(),
          name: input.name,
          description: input.description ?? "",
          sources: [],
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        return {
          result: project,
          writes: [
            { file: `projects/${project.id}/project.json`, value: project },
          ],
        };
      },
    );
  }
  addSource(requestId: string, projectId: string, input: unknown) {
    return this.transact(
      requestId,
      { action: "addSource", projectId, input },
      async () => {
        const project = await this.getProject(projectId);
        const source = sourceSchema
          .omit({ id: true, capturedAt: true })
          .parse(input);
        const updated = {
          ...project,
          updatedAt: now(),
          sources: [
            ...project.sources,
            { ...source, id: randomUUID(), capturedAt: now() },
          ],
        };
        return {
          result: updated,
          writes: [
            { file: `projects/${id(projectId)}/project.json`, value: updated },
          ],
        };
      },
    );
  }
  importFigma(
    requestId: string,
    projectId: string,
    input: FigmaInput,
    loader = fetchFigma,
  ) {
    const request = figmaImportSchema.parse(input);
    return this.transact(
      requestId,
      { action: "importFigma", projectId, request },
      async () => {
        const project = await this.getProject(projectId);
        const source = sourceSchema.parse({
          ...(await loader(request)),
          id: randomUUID(),
          capturedAt: now(),
        });
        const updated = {
          ...project,
          updatedAt: now(),
          sources: [...project.sources, source],
        };
        return {
          result: updated,
          writes: [
            { file: `projects/${id(projectId)}/project.json`, value: updated },
          ],
        };
      },
    );
  }
  async index(projectId: string) {
    await this.getProject(projectId);
    await this.exclusive(() => this.scan());
    return {
      documents: [...this.documents.values()]
        .filter((d) => d.projectId === projectId)
        .map((d) => ({
          id: d.id,
          type: d.type,
          title: d.title,
          scope: d.scope,
          status: d.status,
          revision: d.revision,
          updatedAt: d.updatedAt,
        })),
      problems: [...this.problems.values()].filter(
        (p) => p.projectId === projectId,
      ),
    };
  }
  async getDocument(
    projectId: string,
    documentId: string,
    revision?: number,
  ): Promise<PlannerDocument> {
    await this.getProject(projectId);
    id(documentId);
    if (revision !== undefined) {
      if (!Number.isSafeInteger(revision) || revision < 1)
        throw new PlannerError("SCHEMA_INVALID", "revision 오류");
      const file = this.absolute(
        `projects/${projectId}/history/${documentId}/${revision}.json`,
      );
      if (!(await exists(file)))
        throw new PlannerError(
          "DOCUMENT_NOT_FOUND",
          "해당 문서 버전이 없습니다.",
        );
      const historical = documentSchema.parse(await readJson(file));
      if (
        historical.projectId !== projectId ||
        historical.id !== documentId ||
        historical.revision !== revision
      )
        throw new PlannerError(
          "SOURCE_FILE_INVALID",
          "역사 문서의 경로와 식별자가 일치하지 않습니다.",
        );
      validateDraft(this.draftOf(historical));
      return historical;
    }
    await this.exclusive(() => this.scan());
    const doc = this.documents.get(`${projectId}/${documentId}`);
    if (!doc)
      throw new PlannerError(
        "DOCUMENT_NOT_FOUND",
        "문서가 없거나 읽을 수 없습니다.",
      );
    return structuredClone(doc);
  }
  private validateSources(draft: Draft, project: Project) {
    const known = new Set(project.sources.map((s) => s.id));
    const refs = [
      ...draft.sourceIds,
      ...draft.facts.flatMap((s) => s.sourceIds),
      ...draft.assumptions.flatMap((s) => s.sourceIds),
      ...draft.openQuestions.flatMap((s) => s.sourceIds),
    ];
    if (refs.some((ref) => !known.has(ref)))
      throw new PlannerError(
        "SCHEMA_INVALID",
        "프로젝트에 없는 입력 근거입니다.",
      );
    if (draft.facts.some((f) => !f.sourceIds.length))
      throw new PlannerError(
        "SCHEMA_INVALID",
        "확정 사실에는 입력 근거가 필요합니다.",
      );
  }
  private async currentForWrite(
    projectId: string,
    documentId: string,
    expectedRevision: number,
  ) {
    const file = this.absolute(
      `projects/${id(projectId)}/documents/${id(documentId)}.json`,
    );
    if (!(await exists(file)))
      throw new PlannerError("DOCUMENT_NOT_FOUND", "문서가 없습니다.");
    let doc: PlannerDocument;
    try {
      doc = documentSchema.parse(await readJson(file));
      validateDraft(this.draftOf(doc));
    } catch {
      throw new PlannerError(
        "SOURCE_FILE_INVALID",
        "현재 파일이 유효하지 않습니다.",
      );
    }
    if (doc.revision !== expectedRevision)
      throw new PlannerError(
        "REVISION_CONFLICT",
        "문서가 변경되었습니다. 최신 문서를 다시 읽으세요.",
        { expectedRevision, currentRevision: doc.revision },
      );
    const history = this.absolute(
      `projects/${projectId}/history/${documentId}/${doc.revision}.json`,
    );
    if (!(await exists(history)) || hash(await readJson(history)) !== hash(doc))
      throw new PlannerError(
        "EXTERNAL_EDIT_CONFLICT",
        "외부 수정이 감지되었습니다. 다시 불러오거나 검증된 외부 버전을 가져오세요.",
      );
    return doc;
  }
  private draftOf(doc: PlannerDocument): Draft {
    return {
      type: doc.type,
      title: doc.title,
      scope: doc.scope,
      content: doc.content,
      sourceIds: doc.sourceIds,
      facts: doc.facts,
      assumptions: doc.assumptions,
      openQuestions: doc.openQuestions,
      ...(doc.overviewDocumentId
        ? { overviewDocumentId: doc.overviewDocumentId }
        : {}),
      ...(doc.overviewNodeId ? { overviewNodeId: doc.overviewNodeId } : {}),
      ...(doc.overviewRevision
        ? { overviewRevision: doc.overviewRevision }
        : {}),
    };
  }
  private async documentWrites(doc: PlannerDocument): Promise<Write[]> {
    if (Buffer.byteLength(JSON.stringify(doc, null, 2) + "\n") > 2_000_000)
      throw new PlannerError(
        "PAYLOAD_TOO_LARGE",
        "저장 문서는 2MB 이하로 제한됩니다.",
      );
    const history = this.absolute(
      `projects/${doc.projectId}/history/${doc.id}/${doc.revision}.json`,
    );
    if (await exists(history))
      throw new PlannerError(
        "REVISION_CONFLICT",
        "해당 revision의 기록이 이미 있습니다. 과거 파일로 현재 버전을 되돌릴 수 없습니다.",
      );
    return [
      {
        file: `projects/${doc.projectId}/history/${doc.id}/${doc.revision}.json`,
        value: doc,
      },
      {
        file: `projects/${doc.projectId}/documents/${doc.id}.json`,
        value: doc,
      },
    ];
  }
  saveDocument(
    requestId: string,
    projectId: string,
    input: unknown,
    documentId?: string,
    expectedRevision?: number,
  ) {
    return this.transact(
      requestId,
      {
        action: "saveDocument",
        projectId,
        input,
        documentId: documentId ?? null,
        expectedRevision: expectedRevision ?? null,
      },
      async () => {
        const previous = documentId
          ? await this.currentForWrite(
              projectId,
              documentId,
              expectedRevision ?? -1,
            )
          : undefined;
        return this.prepareDocument(projectId, input, previous);
      },
    );
  }
  private async prepareDocument(
    projectId: string,
    input: unknown,
    previous?: PlannerDocument,
  ) {
    const project = await this.getProject(projectId),
      draft = await validateDocument(input);
    this.validateSources(draft, project);
    await this.validateReferences(projectId, draft, previous?.id);
    if (previous && previous.type !== draft.type)
      throw new PlannerError(
        "SCHEMA_INVALID",
        "생성 후 문서 타입을 변경할 수 없습니다.",
      );
    const timestamp = now();
    const doc = documentSchema.parse({
      ...draft,
      id: previous?.id ?? randomUUID(),
      projectId,
      revision: (previous?.revision ?? 0) + 1,
      status: "draft",
      createdAt: previous?.createdAt ?? timestamp,
      updatedAt: timestamp,
      comments: previous?.comments ?? [],
      approval: null,
    });
    if (previous && draft.type.startsWith("flow-spec"))
      await this.assertFreshNodeIds(previous, draft.content as FlowTree);
    return { result: doc, writes: await this.documentWrites(doc) };
  }
  private async assertFreshNodeIds(previous: PlannerDocument, tree: FlowTree) {
    const current = indexFlow(previous.content as FlowTree).byId;
    const additions = new Set(
      [...indexFlow(tree).byId.keys()].filter((key) => !current.has(key)),
    );
    if (!additions.size) return;
    for (const file of await jsonFiles(
      this.absolute(`projects/${previous.projectId}/history/${previous.id}`),
    )) {
      const historical = documentSchema.parse(await readJson(file));
      if (
        [...indexFlow(historical.content as FlowTree).byId.keys()].some((key) =>
          additions.has(key),
        )
      )
        throw new PlannerError(
          "SCHEMA_INVALID",
          "삭제된 노드 ID는 재사용할 수 없습니다. 새 노드 ID를 사용하세요.",
        );
    }
  }
  private async validateReferences(
    projectId: string,
    draft: Draft,
    documentId?: string,
  ) {
    for (const ref of documentReferences(draft)) {
      if (ref.documentId === documentId)
        throw new PlannerError(
          "SCHEMA_INVALID",
          "자기 자신을 기준 문서로 참조할 수 없습니다.",
        );
      const target = ref.revision
        ? await this.getDocument(projectId, ref.documentId, ref.revision)
        : await this.currentReference(projectId, ref.documentId);
      const expectedType =
        ref.kind === "overview" ? "flow-spec-overview" : draft.type;
      if (target.type !== expectedType)
        throw new PlannerError(
          "SCHEMA_INVALID",
          "참조 문서 타입이 올바르지 않습니다.",
        );
      if (ref.kind === "overview") {
        if (
          ref.nodeId &&
          !indexFlow(target.content as FlowTree).byId.has(ref.nodeId)
        )
          throw new PlannerError(
            "SCHEMA_INVALID",
            "Overview에서 참조 노드를 찾을 수 없습니다.",
          );
        draft.overviewRevision = target.revision;
      }
    }
  }
  private async currentReference(projectId: string, documentId: string) {
    // This helper is called inside the write queue; do not enqueue a read again.
    const file = this.absolute(
      `projects/${id(projectId)}/documents/${id(documentId)}.json`,
    );
    if (!(await exists(file)))
      throw new PlannerError("DOCUMENT_NOT_FOUND", "참조 문서가 없습니다.");
    const doc = documentSchema.parse(await readJson(file));
    return this.currentForWrite(projectId, documentId, doc.revision);
  }
  editFlow(
    requestId: string,
    projectId: string,
    documentId: string,
    expectedRevision: number,
    input: FlowEdit,
  ) {
    const edit = flowEditSchema.parse(input);
    return this.transact(
      requestId,
      { action: "editFlow", projectId, documentId, expectedRevision, edit },
      async () => {
        const previous = await this.currentForWrite(
          projectId,
          documentId,
          expectedRevision,
        );
        if (!previous.type.startsWith("flow-spec"))
          throw new PlannerError(
            "SCHEMA_INVALID",
            "Flow 문서만 편집할 수 있습니다.",
          );
        return this.prepareDocument(
          projectId,
          {
            ...this.draftOf(previous),
            content: editFlowTree(previous.content as FlowTree, edit),
          },
          previous,
        );
      },
    );
  }
  async relations(
    projectId: string,
    documentId: string,
    revision?: number,
  ): Promise<Relations> {
    const doc = await this.getDocument(projectId, documentId, revision);
    await this.index(projectId);
    const outgoing: Relations["outgoing"] = [];
    for (const ref of documentReferences(doc)) {
      try {
        const target = await this.getDocument(
          projectId,
          ref.documentId,
          ref.revision,
        );
        const current = this.documents.get(`${projectId}/${ref.documentId}`);
        const broken = [...this.problems.values()].some(
          (p) => p.projectId === projectId && p.documentId === ref.documentId,
        );
        outgoing.push({
          ...ref,
          revision: target.revision,
          title: target.title,
          currentRevision: current?.revision,
          needsReview:
            broken || !current || current.revision !== target.revision,
          ...(broken || !current
            ? { error: "현재 기준 문서가 삭제되었거나 손상되었습니다." }
            : {}),
        });
      } catch {
        outgoing.push({
          ...ref,
          title: ref.documentId,
          needsReview: true,
          error: "참조 문서 또는 버전을 읽을 수 없습니다.",
        });
      }
    }
    const incoming = [...this.documents.values()]
      .filter((d) => d.projectId === projectId)
      .flatMap((d) =>
        documentReferences(d)
          .filter((ref) => ref.documentId === documentId)
          .map((ref) => ({
            documentId: d.id,
            title: d.title,
            revision: d.revision,
            kind: ref.kind,
          })),
      );
    return { outgoing, incoming };
  }
  async compareDocuments(
    projectId: string,
    before: { documentId: string; revision: number },
    after: { documentId: string; revision: number },
  ) {
    const [left, right] = await Promise.all([
      this.getDocument(projectId, before.documentId, before.revision),
      this.getDocument(projectId, after.documentId, after.revision),
    ]);
    if (left.type !== right.type)
      throw new PlannerError(
        "SCHEMA_INVALID",
        "동일한 문서 타입의 버전만 비교할 수 있습니다.",
      );
    return {
      before: left,
      after: right,
      differences: compareJson(this.draftOf(left), this.draftOf(right)),
    };
  }
  review(
    requestId: string,
    projectId: string,
    documentId: string,
    expectedRevision: number,
    action: "review" | "approve",
    actor: string,
  ) {
    return this.transact(
      requestId,
      { action, projectId, documentId, expectedRevision, actor },
      async () => {
        await this.getProject(projectId);
        const previous = await this.currentForWrite(
          projectId,
          documentId,
          expectedRevision,
        );
        if (
          (action === "review" && previous.status !== "draft") ||
          (action === "approve" && previous.status !== "reviewed")
        )
          throw new PlannerError(
            "INVALID_TRANSITION",
            "draft → reviewed → approved 순서로 진행하세요.",
          );
        if (
          action === "approve" &&
          previous.openQuestions.some((q) => q.blocking && !q.resolved)
        )
          throw new PlannerError(
            "UNRESOLVED_QUESTION",
            "구현을 막는 미결정 질문이 남아 있습니다.",
          );
        const revision = previous.revision + 1,
          timestamp = now();
        const doc = documentSchema.parse({
          ...previous,
          revision,
          updatedAt: timestamp,
          status: action === "review" ? "reviewed" : "approved",
          approval:
            action === "approve"
              ? { by: actor, at: timestamp, revision }
              : null,
        });
        return { result: doc, writes: await this.documentWrites(doc) };
      },
    );
  }
  comment(
    requestId: string,
    projectId: string,
    documentId: string,
    expectedRevision: number,
    text: string,
    author: string,
    questionId?: string,
  ) {
    return this.transact(
      requestId,
      {
        action: "comment",
        projectId,
        documentId,
        expectedRevision,
        text,
        author,
        ...(questionId ? { questionId } : {}),
      },
      async () => {
        const previous = await this.currentForWrite(
          projectId,
          documentId,
          expectedRevision,
        );
        if (
          questionId &&
          !previous.openQuestions.some(
            (q) => q.id === questionId && !q.resolved,
          )
        )
          throw new PlannerError(
            "SCHEMA_INVALID",
            "답변할 미해결 질문을 찾을 수 없습니다.",
          );
        const doc = documentSchema.parse({
          ...previous,
          revision: previous.revision + 1,
          updatedAt: now(),
          comments: [
            ...previous.comments,
            {
              id: randomUUID(),
              author,
              ...(questionId ? { questionId } : {}),
              text,
              createdAt: now(),
              revision: previous.revision,
            },
          ],
        });
        return { result: doc, writes: await this.documentWrites(doc) };
      },
    );
  }
  async handoff(
    projectId: string,
    selections: { documentId: string; revision: number }[],
  ) {
    if (!selections.length)
      throw new PlannerError("SCHEMA_INVALID", "인계할 문서를 선택하세요.");
    const project = await this.getProject(projectId);
    const documents = await Promise.all(
      selections.map((s) =>
        this.getDocument(projectId, s.documentId, s.revision),
      ),
    );
    if (documents.some((d) => d.status !== "approved" || !d.approval))
      throw new PlannerError(
        "NOT_APPROVED",
        "승인된 버전만 인계할 수 있습니다.",
      );
    return {
      project,
      documents,
      selections,
      instructions:
        "이 고정 revision을 개발 기준으로 사용하세요. facts, assumptions, openQuestions와 sources를 함께 확인하세요.",
    };
  }
  async scan() {
    await this.scanProjects();
    const found = new Set<string>(),
      issueFiles = new Set<string>();
    const files = (await jsonFiles(path.join(this.root, "projects"))).filter(
      (f) => f.includes(`${path.sep}documents${path.sep}`),
    );
    for (const file of files) {
      const relative = path.relative(path.join(this.root, "projects"), file),
        projectId = relative.split(path.sep)[0],
        documentId = path.basename(file, ".json"),
        key = `${projectId}/${documentId}`;
      found.add(key);
      issueFiles.add(file);
      try {
        if ((await fs.stat(file)).size > 2_000_000)
          throw new Error("파일 크기 제한 초과");
        const doc = documentSchema.parse(await readJson(file));
        validateDraft(this.draftOf(doc));
        if (doc.projectId !== projectId || doc.id !== documentId)
          throw new Error("문서 경로와 ID 불일치");
        const previous = this.documents.get(key);
        const history = this.absolute(
          `projects/${projectId}/history/${documentId}/${doc.revision}.json`,
        );
        const trusted =
          (await exists(history)) &&
          hash(await readJson(history)) === hash(doc);
        if (
          !trusted &&
          (doc.status !== "draft" ||
            doc.approval ||
            (previous &&
              doc.revision <= previous.revision &&
              hash(previous) !== hash(doc)))
        )
          throw new Error("외부 변경은 새 revision의 draft여야 합니다.");
        const recovered = this.problems.delete(file);
        this.documents.set(key, doc);
        if (!previous || hash(previous) !== hash(doc) || recovered)
          this.events.emit("change", {
            projectId,
            documentId,
            kind: recovered ? "recovered" : previous ? "updated" : "created",
            revision: doc.revision,
          } satisfies Change);
      } catch (error) {
        const message = error instanceof Error ? error.message : "파일 오류";
        if (this.problems.get(file)?.message !== message)
          this.events.emit("change", {
            projectId,
            documentId,
            kind: "error",
            message,
          } satisfies Change);
        this.problems.set(file, { projectId, documentId, message });
      }
    }
    for (const [key, doc] of this.documents)
      if (!found.has(key)) {
        this.documents.delete(key);
        this.events.emit("change", {
          projectId: doc.projectId,
          documentId: doc.id,
          revision: doc.revision,
          kind: "deleted",
        } satisfies Change);
      }
    for (const [file] of this.problems)
      if (
        file.includes(`${path.sep}documents${path.sep}`) &&
        !issueFiles.has(file)
      )
        this.problems.delete(file);
  }

  private async scanProjects() {
    const files = (await jsonFiles(path.join(this.root, "projects"))).filter(
      (file) => path.basename(file) === "project.json",
    );
    const found = new Set<string>();
    for (const file of files) {
      const projectId = path.basename(path.dirname(file));
      found.add(projectId);
      try {
        const project = projectSchema.parse(await readJson(file));
        if (project.id !== projectId)
          throw new Error("프로젝트 경로와 ID 불일치");
        const previous = this.projects.get(projectId);
        const recovered = this.problems.delete(file);
        this.projects.set(projectId, project);
        if (!previous || hash(previous) !== hash(project) || recovered)
          this.events.emit("change", {
            projectId,
            kind: recovered ? "recovered" : previous ? "updated" : "created",
          } satisfies Change);
      } catch {
        if (!this.problems.has(file))
          this.events.emit("change", {
            projectId,
            kind: "error",
            message: "프로젝트 메타데이터 손상",
          } satisfies Change);
        this.problems.set(file, {
          projectId,
          message: "프로젝트 메타데이터 손상",
        });
      }
    }
    for (const projectId of this.projects.keys())
      if (!found.has(projectId)) {
        this.projects.delete(projectId);
        this.events.emit("change", {
          projectId,
          kind: "deleted",
        } satisfies Change);
      }
  }
}

export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw schemaError(result.error);
  return result.data;
}
export { errorResult };
