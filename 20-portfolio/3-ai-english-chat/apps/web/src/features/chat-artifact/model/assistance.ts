import { z } from "zod";
export const artifactAssistanceRequest = z.object({ requestId: z.uuid(), artifactId: z.uuid(), expectedVersionId: z.uuid(), mode: z.enum(["rewrite", "grammar", "analysis"]), selection: z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive() }).strict().optional() }).strict();
export const artifactSuggestion = z.object({ suggestion: z.string().trim().min(1).max(20_000), explanation: z.string().trim().min(1).max(2000) }).strict();
export const artifactAssistanceResponse = z.object({ suggestionId: z.uuid(), artifactId: z.uuid(), versionId: z.uuid(), mode: artifactAssistanceRequest.shape.mode, sourceContent: z.string().max(20_000), selection: artifactAssistanceRequest.shape.selection, source: z.literal("provider"), result: artifactSuggestion });
export type ArtifactAssistance = z.infer<typeof artifactAssistanceResponse>;
export function assistanceTarget(kind: string, content: string, input: z.infer<typeof artifactAssistanceRequest>) {
  if (content.length > 20_000 || !content.trim()) throw new Error("1~20,000자의 저장된 내용을 사용해 주세요.");
  if (input.mode === "analysis") {
    if (kind !== "sheet" || input.selection) throw new Error("표 Artifact만 분석할 수 있어요.");
    return content;
  }
  if (input.mode === "grammar") {
    if (kind !== "text" || input.selection) throw new Error("문서 Artifact만 문법을 교정할 수 있어요.");
    return content;
  }
  if (!["text", "code", "sheet"].includes(kind) || !input.selection || input.selection.start >= input.selection.end || input.selection.end > content.length) throw new Error("다듬을 영역을 선택해 주세요.");
  return content.slice(input.selection.start, input.selection.end);
}

export const storedArtifactSuggestion = z.object({
  id: z.uuid(), artifact_version_id: z.uuid(), owner_id: z.uuid(),
  mode: artifactAssistanceRequest.shape.mode,
  selection_start: z.number().int().nonnegative().nullable(),
  selection_end: z.number().int().positive().nullable(),
  original_text: z.string().max(20_000), suggested_text: artifactSuggestion.shape.suggestion,
  description: artifactSuggestion.shape.explanation, status: z.literal("pending"),
});
export function storedAssistanceDto(row: unknown, artifactId: string, kind: string, content: string) {
  const stored = storedArtifactSuggestion.parse(row);
  if (stored.original_text !== content || (stored.selection_start === null) !== (stored.selection_end === null)) throw new Error("Stored suggestion source does not match its immutable version.");
  const selection = stored.selection_start === null ? undefined : { start: stored.selection_start, end: stored.selection_end! };
  const input = { requestId: stored.id, artifactId, expectedVersionId: stored.artifact_version_id, mode: stored.mode, selection };
  assistanceTarget(kind, content, input);
  return artifactAssistanceResponse.parse({ suggestionId: stored.id, artifactId, versionId: stored.artifact_version_id,
    mode: stored.mode, selection, sourceContent: content, source: "provider",
    result: { suggestion: stored.suggested_text, explanation: stored.description } });
}
export function matchesAssistanceRequest(row: unknown, input: z.infer<typeof artifactAssistanceRequest>, ownerId: string, content: string) {
  const stored = storedArtifactSuggestion.safeParse(row);
  return stored.success && stored.data.id === input.requestId && stored.data.owner_id === ownerId
    && stored.data.artifact_version_id === input.expectedVersionId && stored.data.mode === input.mode
    && stored.data.original_text === content && stored.data.selection_start === (input.selection?.start ?? null)
    && stored.data.selection_end === (input.selection?.end ?? null);
}
