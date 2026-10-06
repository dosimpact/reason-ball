import {
  isPlainObject,
  isArray,
  isString,
  isNumber,
  values,
  filter,
} from "remeda";
// Local fixtures, contracts, normalization and merge rules for this example.
export const samples = [
  {
    label: "Evidence UI",
    value:
      "How should a LangGraph SDK RAG UI show retrieved documents, citation chips, and the supporting answer?",
  },
  {
    label: "Streaming Modes",
    value:
      "Which LangGraph SDK stream modes should a UI expose for graph updates and custom progress?",
  },
  {
    label: "No Document",
    value: "What does this local corpus say about Kubernetes pod scheduling?",
  },
];

export type JsonRecord = Record<string, unknown>;

export type RetrievedDoc = {
  id: string;
  rank: number;
  title: string;
  source: string;
  score: number;
  snippet: string;
  text: string;
  matchedTerms: string[];
};

export type Citation = {
  id: string;
  docId: string;
  label: string;
  title: string;
  rank: number;
  score: number;
};

export function valuesOf(state: unknown): JsonRecord {
  if (isPlainObject(state) && isPlainObject(state.values)) return state.values;
  return isPlainObject(state) ? state : {};
}

export function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function nodePayloads(data: unknown): JsonRecord[] {
  if (!isPlainObject(data)) return [];
  return filter(values(data), isPlainObject);
}

export function normalizeDocs(value: unknown): RetrievedDoc[] {
  if (!isArray(value)) return [];
  return filter(value, isPlainObject).map((doc, index) => ({
    id: isString(doc.id) ? doc.id : `doc-${index + 1}`,
    rank: isNumber(doc.rank) ? doc.rank : index + 1,
    title: isString(doc.title) ? doc.title : `Document ${index + 1}`,
    source: isString(doc.source) ? doc.source : "local fixture",
    score: isNumber(doc.score) ? doc.score : Number(doc.score ?? 0),
    snippet: isString(doc.snippet) ? doc.snippet : "",
    text: isString(doc.text) ? doc.text : "",
    matchedTerms: isArray(doc.matched_terms)
      ? doc.matched_terms.map((term) => String(term))
      : [],
  }));
}

export function normalizeCitations(value: unknown): Citation[] {
  if (!isArray(value)) return [];
  return filter(value, isPlainObject).map((citation, index) => {
    const docId =
      isString(citation.doc_id)
        ? citation.doc_id
        : String(citation.docId ?? "");
    return {
      id: isString(citation.id) ? citation.id : `cite-${index + 1}`,
      docId,
      label:
        isString(citation.label)
          ? citation.label
          : docId
            ? `[${docId}]`
            : `[cite-${index + 1}]`,
      title: isString(citation.title) ? citation.title : docId,
      rank: isNumber(citation.rank) ? citation.rank : index + 1,
      score:
        isNumber(citation.score)
          ? citation.score
          : Number(citation.score ?? 0),
    };
  });
}

export function scoreLabel(value: number) {
  return Number.isFinite(value) ? value.toFixed(3) : "0.000";
}
