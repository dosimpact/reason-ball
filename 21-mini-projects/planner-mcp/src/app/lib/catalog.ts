import { z } from "zod";
import {
  apiSpec,
  dbSpec,
  loggingSpec,
  figmaSpec,
  draftSchema,
  type DocumentType,
  typeIds,
} from "@/entities/document/model/schema";
import {
  validateFlowTree,
  layerTypes,
} from "@/features/flow-spec-syntax/parser";
import { PlannerError } from "@/shared/lib/errors";

const flowNode: z.ZodType = z.lazy(() =>
  z
    .object({
      id: z.string().min(1),
      kind: z.enum(["step", "note"]),
      label: z.string().min(1),
      children: z.array(flowNode),
    })
    .strict(),
);
const flowSchema = z
  .object({
    format: z.literal("flow-spec"),
    schemaVersion: z.literal(1),
    layers: z
      .array(
        z
          .object({
            id: z.string().min(1),
            kind: z.literal("layer"),
            layerType: z.enum(layerTypes),
            children: z.array(flowNode),
          })
          .strict(),
      )
      .length(3),
  })
  .strict();
export const contentSchemas = {
  "upstream-api-spec": apiSpec,
  "bff-api-spec": apiSpec,
  "db-entity": dbSpec,
  "weblogging-spec": loggingSpec,
  "figma-requirements": figmaSpec,
  "flow-spec-overview": flowSchema,
  "flow-spec-detail": flowSchema,
};
export const typeNames: Record<DocumentType, string> = {
  "upstream-api-spec": "Upstream API Spec",
  "bff-api-spec": "BFF API Spec",
  "db-entity": "DB Entity",
  "weblogging-spec": "Weblogging Spec",
  "figma-requirements": "Figma Requirements",
  "flow-spec-overview": "Flow Spec Overview",
  "flow-spec-detail": "Flow Spec Detail",
};
export function exampleContent(type: DocumentType): unknown {
  if (type.startsWith("flow-spec"))
    return {
      format: "flow-spec",
      schemaVersion: 1,
      layers: layerTypes.map((layerType, i) => ({
        id: `layer-${i}`,
        kind: "layer",
        layerType,
        children: [
          {
            id: `step-${i}`,
            kind: "step",
            label: [
              "예산 추천 조회",
              "캠페인별 추천 제공",
              "예산 추천 확인·적용",
            ][i],
            children: [],
          },
        ],
      })),
    };
  if (type.endsWith("api-spec"))
    return {
      schemaVersion: 1,
      specKind: "existing",
      operations: [
        {
          id: "list-campaigns",
          name: "캠페인 조회",
          protocol: "http",
          method: "GET",
          address: "/campaigns",
          input: [],
          output: [
            { name: "campaigns", description: "캠페인 목록", type: "array" },
          ],
          errors: [],
        },
      ],
    };
  if (type === "db-entity")
    return {
      schemaVersion: 1,
      mermaid:
        "erDiagram\n  CAMPAIGN ||--o{ BUDGET_RECOMMENDATION : has\n  CAMPAIGN {\n    string id\n    string name\n  }",
    };
  if (type === "weblogging-spec")
    return {
      schemaVersion: 1,
      events: [
        {
          id: "budget-adoption",
          eventName: "budget_adopted",
          trigger: "adoption",
          condition: "예산 추천 적용 성공 시",
          fields: [{ name: "campaignId", description: "대상 캠페인 식별자" }],
        },
      ],
    };
  return {
    schemaVersion: 1,
    widgets: [
      {
        widgetId: "budget-card",
        name: "BudgetRecommendation",
        responsibility: "예산 추천 확인과 적용",
        figmaRefs: [],
        surfaces: ["현재 예산과 추천 예산"],
        inputValidation: [{ input: "budget", rule: "현재 예산보다 커야 함" }],
        funnel: [{ action: "추천 적용", destination: "캠페인 상세" }],
        states: [],
      },
    ],
  };
}

export function catalog() {
  return typeIds.map((type) => ({
    type,
    name: typeNames[type],
    schemaVersion: 1,
    purpose: type.startsWith("flow-spec")
      ? type.endsWith("overview")
        ? "비즈니스 핵심 대상과 주요 호출 경로"
        : "핵심 동작의 상세 흐름"
      : typeNames[type],
    requiredInputs: ["projectId", "title", "scope", "content"],
    rules: [
      "등록된 타입을 선택하세요.",
      "정보 부족은 assumptions/openQuestions에 기록하세요.",
      "사용자 승인은 AI 저장과 별도입니다.",
    ],
    // Zod builds JSON Schema maps with null prototypes. Route handlers can
    // stringify them, but React Server Components require plain-object props.
    contentSchema: JSON.parse(
      JSON.stringify(
        z.toJSONSchema(contentSchemas[type], {
          unrepresentable: "any",
        }),
      ),
    ) as Record<string, unknown>,
    example: exampleContent(type),
  }));
}

export function validateDraft(input: unknown) {
  if (
    input &&
    typeof input === "object" &&
    "type" in input &&
    !typeIds.includes(input.type as DocumentType)
  )
    throw new PlannerError(
      "UNKNOWN_DOCUMENT_TYPE",
      "카탈로그에 없는 문서 타입입니다.",
    );
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) throw schemaError(parsed.error);
  const draft = parsed.data;
  if (
    (draft.overviewDocumentId ||
      draft.overviewNodeId ||
      draft.overviewRevision) &&
    (draft.type !== "flow-spec-detail" || !draft.overviewDocumentId)
  )
    throw new PlannerError(
      "SCHEMA_INVALID",
      "Overview 참조는 대상 문서 ID가 있는 Flow Detail에만 지정하세요.",
    );
  const statementIds = [
    ...draft.facts,
    ...draft.assumptions,
    ...draft.openQuestions,
  ].map((s) => s.id);
  if (new Set(statementIds).size !== statementIds.length)
    throw new PlannerError(
      "SCHEMA_INVALID",
      "사실·가정·질문의 ID는 문서 안에서 고유해야 합니다.",
    );
  // Iterative guard runs before recursive schema validation on Flow input.
  if (draft.type.startsWith("flow-spec")) validateFlowTree(draft.content);
  const content = contentSchemas[draft.type].safeParse(draft.content);
  if (!content.success) throw schemaError(content.error);
  const ids: string[] = [];
  if (draft.type.endsWith("api-spec"))
    ids.push(
      ...(content.data as z.infer<typeof apiSpec>).operations.map((o) => o.id),
    );
  if (draft.type === "weblogging-spec")
    ids.push(
      ...(content.data as z.infer<typeof loggingSpec>).events.map((e) => e.id),
    );
  if (draft.type === "figma-requirements")
    ids.push(
      ...(content.data as z.infer<typeof figmaSpec>).widgets.map(
        (w) => w.widgetId,
      ),
    );
  if (new Set(ids).size !== ids.length)
    throw new PlannerError("SCHEMA_INVALID", "문서 항목 ID가 중복됩니다.");
  return { ...draft, content: content.data };
}
export function schemaError(error: z.ZodError) {
  return new PlannerError("SCHEMA_INVALID", "입력 형식을 확인하세요.", {
    errors: error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    })),
  });
}
