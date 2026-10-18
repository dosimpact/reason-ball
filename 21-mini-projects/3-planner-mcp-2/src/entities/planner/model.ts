import { z } from "zod";
import { extensionList, type DocumentExtension } from "./extensions";
export const id = z.string().min(1).max(100);
export const title = z.string().trim().min(1).max(160);
export const body = z.string().max(200000);
export const phase = z.enum(["design", "implementation", "verification"]);
export const kind = z.enum([
  "index",
  "design-verification",
  "implementation",
  "overview",
  "verification-result",
]);
export const aiResult = z.enum(["pending", "passed", "failed", "skipped"]);
export const overviewEntry = z
  .object({
    id,
    parentId: id.nullable(),
    title,
    what: body,
    how: body,
    verificationDocumentId: id.nullable(),
  })
  .strict();
export const templateInput = z
  .object({
    name: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
    title,
    kind: kind.exclude(["index", "verification-result"]),
    body,
    example: body,
    prompt: body,
    checklist: z.array(title).max(100),
    extensions: extensionList.optional(),
  })
  .strict();
export type TemplateInput = z.infer<typeof templateInput>;
export type Template = TemplateInput & { revision: number };
export interface Project {
  id: string;
  title: string;
  createdAt: string;
}
export interface ChecklistItem {
  id: string;
  label: string;
  aiResult: z.infer<typeof aiResult>;
  humanConfirmed: boolean;
  position: number;
}
export interface Document {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  kind: z.infer<typeof kind>;
  phase: z.infer<typeof phase>;
  body: string;
  overview: z.infer<typeof overviewEntry>[];
  extensions?: DocumentExtension[];
  status: "draft" | "in-progress" | "verified" | "reopen";
  revision: number;
  templateSnapshot: Template | null;
  checklist: ChecklistItem[];
}
export interface FlowNode {
  coordinates?: { x: number; y: number };
  id: string;
  projectId: string;
  label: string;
  phase: z.infer<typeof phase>;
  documentId: string | null;
  position: number;
}
export const documentInput = z
  .object({
    projectId: id,
    parentId: id.nullable().optional(),
    title,
    phase,
    templateName: z.string().optional(),
    kind: kind.exclude(["index", "verification-result"]).optional(),
    body: body.optional(),
    extensions: extensionList.optional(),
  })
  .strict();
export const documentPatch = z
  .object({
    title: title.optional(),
    body: body.optional(),
    extensions: extensionList.optional(),
    overview: z.array(overviewEntry).max(200).optional(),
    expectedRevision: z.number().int().positive(),
  })
  .strict();
export const checkInput = z
  .object({ label: title, position: z.number().int().nonnegative().optional() })
  .strict();
export const checkPatch = z
  .object({
    label: title.optional(),
    aiResult: aiResult.optional(),
    position: z.number().int().nonnegative().optional(),
    expectedRevision: z.number().int().positive(),
  })
  .strict();
export const reopenInput = z
  .object({
    affectedItemIds: z.array(id).min(1).max(100),
    reason: title,
    expectedRevision: z.number().int().positive(),
  })
  .strict();
export const nodeInput = z
  .object({
    coordinates: z
      .object({ x: z.number().finite(), y: z.number().finite() })
      .strict()
      .optional(),
    label: title,
    phase,
    documentId: id.nullable(),
    position: z.number().int().nonnegative(),
  })
  .strict();
export const workflowRules = {
  domains: [
    "project-management",
    "template-management",
    "document-management",
    "progress-verification",
    "ai-workflow",
  ],
  steps: [
    "프로젝트의 단계별 index와 하위 문서를 조회한다.",
    "설계된 범위만 구현하고 구현 문서를 갱신한다.",
    "get_document의 extensions를 읽고 create_document/update_document의 extensions 전체 목록으로 React Flow 또는 CodeWeave 확장을 작성한다. CodeWeave는 get_codeweave로 탐색하고 update_codeweave_node로 라인 속성·주석을 수정한다. line ID는 snapshot 기준이므로 수정 전 재조회하고 expectedSource와 expectedRevision을 전달한다. 생략하면 보존, 빈 배열이면 모두 제거한다. 기존 확장은 유지하고 변경에는 최신 expectedRevision을 사용한다.",
    "정형 체크리스트에 항목별 AI 결과를 기록한다.",
    "record_verification으로 결과 자식 문서를 생성하거나 갱신한다.",
    "사람은 UI에서 최종 확인한다. AI는 사람 확인을 완료할 수 없다.",
    "설계 변경의 영향 항목을 판단하고 reopen_document로 해당 항목만 초기화한다.",
  ],
};
