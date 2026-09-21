import { promises as fs } from "node:fs";
import path from "node:path";
import type { EventEmitter } from "node:events";
import {
  templateDraftSchema,
  templateName,
  templateSchema,
  type DocumentTemplate,
  type TemplateDraft,
} from "@/entities/template/model/schema";
import { PlannerError } from "@/shared/lib/errors";
import { schemaError } from "@/app/lib/catalog";

type Transaction = <T>(
  requestId: string,
  operation: unknown,
  prepare: () => Promise<{
    result: T;
    writes: { file: string; value: unknown }[];
  }>,
) => Promise<T>;

export class TemplateRepository {
  private fingerprint = "";
  constructor(
    private root: string,
    private transact: Transaction,
    private events: EventEmitter,
  ) {}

  private parseName(name: string) {
    const parsed = templateName.safeParse(name);
    if (!parsed.success) throw schemaError(parsed.error);
    return parsed.data;
  }
  private async read(name: string): Promise<DocumentTemplate | null> {
    const file = path.join(
      this.root,
      "templates",
      `${this.parseName(name)}.json`,
    );
    let raw: string;
    try {
      raw = await fs.readFile(file, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
    try {
      const value = templateSchema.parse(JSON.parse(raw));
      if (value.name !== name) throw new Error("Name mismatch");
      return value;
    } catch {
      throw new PlannerError(
        "TEMPLATE_CORRUPT",
        `템플릿 ${name}의 저장 파일을 읽을 수 없습니다.`,
      );
    }
  }
  private async names() {
    try {
      return (await fs.readdir(path.join(this.root, "templates")))
        .filter((f) => f.endsWith(".json"))
        .sort();
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  }
  async list() {
    const templates = await Promise.all(
      (await this.names()).map((f) => this.read(f.slice(0, -5))),
    );
    return templates.filter((t): t is DocumentTemplate => !!t && !t.deleted);
  }
  async get(name: string) {
    const template = await this.read(name);
    if (!template || template.deleted)
      throw new PlannerError(
        "TEMPLATE_NOT_FOUND",
        "템플릿을 찾을 수 없습니다.",
      );
    return template;
  }
  save(requestId: string, input: TemplateDraft, expectedRevision?: number) {
    return this.transact(
      requestId,
      {
        action: "saveTemplate",
        input,
        expectedRevision: expectedRevision ?? null,
      },
      async () => {
        const parsed = templateDraftSchema.safeParse(input);
        if (!parsed.success) throw schemaError(parsed.error);
        const draft = parsed.data;
        const previous = await this.read(draft.name);
        if (expectedRevision === undefined) {
          if (previous && !previous.deleted)
            throw new PlannerError(
              "TEMPLATE_NAME_CONFLICT",
              "이미 사용 중인 템플릿 이름입니다.",
            );
        } else {
          if (!previous || previous.deleted)
            throw new PlannerError(
              "TEMPLATE_NOT_FOUND",
              "템플릿을 찾을 수 없습니다.",
            );
          if (previous.revision !== expectedRevision)
            throw new PlannerError(
              "REVISION_CONFLICT",
              "다른 변경이 저장되었습니다. 최신 내용을 다시 조회하세요.",
            );
        }
        const timestamp = new Date().toISOString();
        const template: DocumentTemplate = {
          ...draft,
          deleted: false,
          revision: (previous?.revision ?? 0) + 1,
          createdAt:
            previous && !previous.deleted ? previous.createdAt : timestamp,
          updatedAt: timestamp,
        };
        return {
          result: template,
          writes: [{ file: `templates/${draft.name}.json`, value: template }],
        };
      },
    );
  }
  delete(requestId: string, name: string, expectedRevision: number) {
    return this.transact(
      requestId,
      { action: "deleteTemplate", name, expectedRevision },
      async () => {
        const previous = await this.get(name);
        if (previous.revision !== expectedRevision)
          throw new PlannerError(
            "REVISION_CONFLICT",
            "다른 변경이 저장되었습니다. 최신 내용을 다시 조회하세요.",
          );
        const template = {
          ...previous,
          deleted: true,
          revision: previous.revision + 1,
          updatedAt: new Date().toISOString(),
        };
        return {
          result: { name, deleted: true, revision: template.revision },
          writes: [{ file: `templates/${name}.json`, value: template }],
        };
      },
    );
  }
  async scan() {
    // Compare content, not timestamps: external writes may preserve mtime.
    const values = await Promise.all(
      (await this.names()).map(async (name) => [
        name,
        await fs
          .readFile(path.join(this.root, "templates", name), "utf8")
          .catch(() => "unreadable"),
      ]),
    );
    const next = JSON.stringify(values);
    if (next !== this.fingerprint) {
      this.fingerprint = next;
      this.events.emit("templates", { kind: "updated" });
    }
  }
}
