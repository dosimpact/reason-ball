import type { ApiSpec, Draft } from "../model/schema";

export type DocumentReference = {
  kind: "overview" | "api-base";
  documentId: string;
  revision?: number;
  nodeId?: string;
};
export type Relation = DocumentReference & {
  title: string;
  currentRevision?: number;
  needsReview: boolean;
  error?: string;
};
export type Relations = {
  outgoing: Relation[];
  incoming: {
    documentId: string;
    title: string;
    revision: number;
    kind: DocumentReference["kind"];
  }[];
};
export function documentReferences(draft: Draft): DocumentReference[] {
  const result: DocumentReference[] = [];
  if (draft.overviewDocumentId)
    result.push({
      kind: "overview",
      documentId: draft.overviewDocumentId,
      revision: draft.overviewRevision,
      nodeId: draft.overviewNodeId,
    });
  if (draft.type.endsWith("api-spec")) {
    const api = draft.content as ApiSpec;
    if (api.baseDocumentId)
      result.push({
        kind: "api-base",
        documentId: api.baseDocumentId,
        revision: api.baseRevision,
      });
  }
  return result;
}
