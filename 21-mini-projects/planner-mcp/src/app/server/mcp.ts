import {
  templateDraftSchema,
  templateName,
} from "@/entities/template/model/schema";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  identifier,
  text,
  draftSchema,
  sourceSchema,
} from "@/entities/document/model/schema";
import { catalog } from "@/app/lib/catalog";
import { validateDocument } from "./validate-document";
import { errorResult } from "@/shared/lib/errors";
import { type PlannerStore } from "./store";
import {
  materializeFlow,
  parseFlowSpec,
} from "@/features/flow-spec-syntax/parser";
import { randomUUID } from "node:crypto";
import { flowEditSchema } from "@/features/flow-spec-syntax/parser";
import { figmaImportSchema } from "./figma";

export function createMcpServer(store: PlannerStore) {
  const server = new McpServer(
    { name: "planner-mcp", version: "1.0.0" },
    {
      instructions:
        "공용 템플릿은 list_templates → get_template(name)으로 본문·예시·prompt를 함께 읽고 사용하세요. 프로젝트 → 카탈로그와 JSON 스키마 → 인덱스/본문 → validate_document → save_document 순서로 작업하세요. scope는 필수입니다. 사실에는 sourceIds 근거가 필요합니다. 갱신에는 expectedRevision, 모든 쓰기에는 고유 requestId를 보내세요. 재시도는 같은 requestId와 내용을 유지합니다. 승인은 사용자 UI에서만 합니다. 구현 에이전트는 승인된 revision으로 get_handoff를 호출하세요.",
    },
  );
  const result = async (work: () => unknown | Promise<unknown>) => {
    try {
      const value = await work();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(value) }],
        structuredContent: { result: value },
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          { type: "text" as const, text: JSON.stringify(errorResult(error)) },
        ],
      };
    }
  };
  server.registerTool(
    "list_projects",
    {
      description: "프로젝트 목록 조회",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => result(() => store.listProjects()),
  );
  server.registerTool(
    "create_project",
    {
      description: "원본 요구사항을 관리할 프로젝트 생성",
      inputSchema: {
        requestId: identifier,
        name: text,
        description: z.string().optional(),
      },
    },
    (input) => result(() => store.createProject(input.requestId, input)),
  );
  server.registerTool(
    "get_project",
    {
      description: "프로젝트와 보존된 원본 입력 조회",
      inputSchema: { projectId: identifier },
      annotations: { readOnlyHint: true },
    },
    ({ projectId }) => result(() => store.getProject(projectId)),
  );
  server.registerTool(
    "add_source",
    {
      description:
        "프로젝트에 원본 요구사항·Figma·참고 자료를 덮어쓰기 없이 추가",
      inputSchema: {
        requestId: identifier,
        projectId: identifier,
        source: sourceSchema.omit({ id: true, capturedAt: true }),
      },
    },
    (input) =>
      result(() =>
        store.addSource(input.requestId, input.projectId, input.source),
      ),
  );
  server.registerTool(
    "get_catalog",
    {
      description: "일곱 타입의 작성 규칙, JSON 스키마, 예시 조회",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => result(catalog),
  );
  server.registerTool(
    "get_document_index",
    {
      description:
        "프로젝트의 실제 문서 목록·scope·승인 상태·revision·파일 오류 조회",
      inputSchema: { projectId: identifier },
      annotations: { readOnlyHint: true },
    },
    ({ projectId }) => result(() => store.index(projectId)),
  );
  server.registerTool(
    "get_document",
    {
      description:
        "문서 본문·사실·가정·질문·검토 의견 조회. revision 지정 시 고정 버전",
      inputSchema: {
        projectId: identifier,
        documentId: identifier,
        revision: z.number().int().positive().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    (input) =>
      result(() =>
        store.getDocument(input.projectId, input.documentId, input.revision),
      ),
  );
  server.registerTool(
    "validate_document",
    {
      description:
        "저장 없이 타입별 문서 구조 검증. 실제 저장에서 revision과 입력 근거를 다시 확인",
      inputSchema: { document: draftSchema },
      annotations: { readOnlyHint: true },
    },
    ({ document }) => result(() => validateDocument(document)),
  );
  server.registerTool(
    "save_document",
    {
      description:
        "새 문서 생성 또는 기존 문서 갱신. 기존 문서에는 읽은 expectedRevision 필수. 항상 draft 저장",
      inputSchema: {
        requestId: identifier,
        projectId: identifier,
        document: draftSchema,
        documentId: identifier.optional(),
        expectedRevision: z.number().int().positive().optional(),
      },
    },
    (input) =>
      result(() =>
        store.saveDocument(
          input.requestId,
          input.projectId,
          input.document,
          input.documentId,
          input.expectedRevision,
        ),
      ),
  );
  server.registerTool(
    "get_handoff",
    {
      description: "다른 구현 에이전트를 위한 승인 문서 고정 버전 묶음 조회",
      inputSchema: {
        projectId: identifier,
        selections: z
          .array(
            z
              .object({
                documentId: identifier,
                revision: z.number().int().positive(),
              })
              .strict(),
          )
          .min(1),
      },
      annotations: { readOnlyHint: true },
    },
    (input) => result(() => store.handoff(input.projectId, input.selections)),
  );
  server.registerTool(
    "parse_flow_spec",
    {
      description:
        "Flow Spec 텍스트를 새로운 노드 ID를 가진 JSON 트리로 변환. 저장하지 않음",
      inputSchema: { source: z.string().max(1_000_000) },
      annotations: { readOnlyHint: true },
    },
    ({ source }) =>
      result(() => {
        const parsed = parseFlowSpec(source);
        if (!parsed.success) return parsed;
        return {
          success: true,
          tree: materializeFlow(
            parsed.layers,
            Array.from({ length: 5000 }, () => randomUUID()),
          ),
        };
      }),
  );
  server.registerTool(
    "import_figma",
    {
      description:
        "Figma 파일/노드를 읽어 원문과 파일 버전을 프로젝트 입력 자료에 보존. 서버 FIGMA_ACCESS_TOKEN 필요",
      inputSchema: {
        requestId: identifier,
        projectId: identifier,
        ...figmaImportSchema.shape,
      },
    },
    ({ requestId, projectId, ...input }) =>
      result(() => store.importFigma(requestId, projectId, input)),
  );
  server.registerTool(
    "edit_flow_node",
    {
      description:
        "Flow 노드 추가·이름 변경·삭제·이동. 새 draft 생성, revision 충돌 및 재시도 중복 검사",
      inputSchema: {
        requestId: identifier,
        projectId: identifier,
        documentId: identifier,
        expectedRevision: z.number().int().positive(),
        edit: flowEditSchema,
      },
    },
    (input) =>
      result(() =>
        store.editFlow(
          input.requestId,
          input.projectId,
          input.documentId,
          input.expectedRevision,
          input.edit,
        ),
      ),
  );
  server.registerTool(
    "get_document_relations",
    {
      description: "문서의 기준/연결 문서와 참조 변경에 따른 재검토 안내 조회",
      inputSchema: {
        projectId: identifier,
        documentId: identifier,
        revision: z.number().int().positive().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    (input) =>
      result(() =>
        store.relations(input.projectId, input.documentId, input.revision),
      ),
  );
  const selection = z
    .object({ documentId: identifier, revision: z.number().int().positive() })
    .strict();
  server.registerTool(
    "compare_documents",
    {
      description: "동일 타입의 두 고정 문서 버전을 JSON 경로별로 비교",
      inputSchema: {
        projectId: identifier,
        before: selection,
        after: selection,
      },
      annotations: { readOnlyHint: true },
    },
    (input) =>
      result(() =>
        store.compareDocuments(input.projectId, input.before, input.after),
      ),
  );
  server.registerTool(
    "list_templates",
    {
      description:
        "공용 문서 템플릿 목록 조회. 이름·본문·예시·AI 사용 프롬프트를 반환",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => result(() => store.templates.list()),
  );
  server.registerTool(
    "get_template",
    {
      description:
        "template name으로 Markdown/Mermaid 템플릿·예시·AI 사용 프롬프트 조회",
      inputSchema: { name: templateName },
      annotations: { readOnlyHint: true },
    },
    ({ name }) => result(() => store.templates.get(name)),
  );
  server.registerTool(
    "create_template",
    {
      description: "공용 문서 템플릿과 AI 사용 프롬프트 생성",
      inputSchema: { requestId: identifier, template: templateDraftSchema },
    },
    ({ requestId, template }) =>
      result(() => store.templates.save(requestId, template)),
  );
  server.registerTool(
    "update_template",
    {
      description: "템플릿과 프롬프트 수정. 읽은 revision 필수",
      inputSchema: {
        requestId: identifier,
        template: templateDraftSchema,
        expectedRevision: z.number().int().positive(),
      },
    },
    ({ requestId, template, expectedRevision }) =>
      result(() => store.templates.save(requestId, template, expectedRevision)),
  );
  server.registerTool(
    "delete_template",
    {
      description: "공용 템플릿 삭제. 기존 프로젝트 문서는 유지",
      inputSchema: {
        requestId: identifier,
        name: templateName,
        expectedRevision: z.number().int().positive(),
      },
      annotations: { destructiveHint: true },
    },
    ({ requestId, name, expectedRevision }) =>
      result(() => store.templates.delete(requestId, name, expectedRevision)),
  );
  return server;
}
