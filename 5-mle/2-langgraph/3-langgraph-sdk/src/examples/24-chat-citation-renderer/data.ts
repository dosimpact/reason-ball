import * as R from "remeda";
// Local fixtures, contracts, normalization and merge rules for this example.
export const evidenceQuestion =
  "How should a chat UI render inline citation chips, hover previews, and source document cards?";

export const streamQuestion =
  "How can LangGraph SDK stream updates and custom events help debug citation renderer state?";

export type JsonRecord = Record<string, unknown>;

export type SourceDoc = {
  id: string;
  rank: number;
  title: string;
  url: string;
  sourceType: string;
  score: number;
  snippet: string;
  text: string;
  matchedTerms: string[];
};

export type AnswerSegment = {
  id: string;
  text: string;
  citationIds: string[];
};

export type Citation = {
  id: string;
  label: string;
  sourceId: string;
  segmentId: string;
  title: string;
  url: string;
  snippet: string;
  rank: number;
  score: number;
};

export type CitationEvent = {
  type: string;
  phase: string;
  status: string;
  detail: string;
  sourceId: string;
  citationId: string;
  timestamp: string;
};



export function valuesOf(state: unknown): JsonRecord {
  if (R.isPlainObject(state) && R.isPlainObject(state.values)) return state.values;
  return R.isPlainObject(state) ? state : {};
}

export function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function nodePayloads(data: unknown): JsonRecord[] {
  if (!R.isPlainObject(data)) return [];
  return R.filter(R.values(data), R.isPlainObject);
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : Number(value ?? fallback);
}

export function normalizeSources(value: unknown): SourceDoc[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((source, index) => ({
      id: R.isString(source.id) ? source.id : `doc-${index + 1}`,
      rank: numberValue(source.rank, index + 1),
      title:
        R.isString(source.title) ? source.title : `Source ${index + 1}`,
      url: R.isString(source.url) ? source.url : "",
      sourceType:
        R.isString(source.source_type) ? source.source_type : "",
      score: numberValue(source.score),
      snippet: R.isString(source.snippet) ? source.snippet : "",
      text: R.isString(source.text) ? source.text : "",
      matchedTerms: R.isArray(source.matched_terms)
        ? source.matched_terms.map(String)
        : [],
    })));
}

export function normalizeSegments(value: unknown): AnswerSegment[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((segment, index) => ({
      id: R.isString(segment.id) ? segment.id : `seg-${index + 1}`,
      text: R.isString(segment.text) ? segment.text : "",
      citationIds: R.isArray(segment.citation_ids)
        ? segment.citation_ids.map(String)
        : [],
    })));
}

export function normalizeCitations(value: unknown): Citation[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((citation, index) => ({
      id: R.isString(citation.id) ? citation.id : `cite-${index + 1}`,
      label:
        R.isString(citation.label)
          ? citation.label
          : `[cite-${index + 1}]`,
      sourceId: R.isString(citation.source_id) ? citation.source_id : "",
      segmentId:
        R.isString(citation.segment_id) ? citation.segment_id : "",
      title: R.isString(citation.title) ? citation.title : "",
      url: R.isString(citation.url) ? citation.url : "",
      snippet: R.isString(citation.snippet) ? citation.snippet : "",
      rank: numberValue(citation.rank, index + 1),
      score: numberValue(citation.score),
    })));
}

export function normalizeCitationEvents(value: unknown): CitationEvent[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((event) => ({
      type:
        R.isString(event.type) ? event.type : "24_chat_citation_renderer",
      phase: R.isString(event.phase) ? event.phase : "",
      status: R.isString(event.status) ? event.status : "",
      detail: R.isString(event.detail) ? event.detail : "",
      sourceId: R.isString(event.source_id) ? event.source_id : "",
      citationId: R.isString(event.citation_id) ? event.citation_id : "",
      timestamp: R.isString(event.timestamp) ? event.timestamp : "",
    })));
}

export function mergeCitationEvents(
  current: CitationEvent[],
  next: CitationEvent[],
) {
  const byKey = new Map<string, CitationEvent>();
  [...current, ...next].forEach((event, index) => {
    byKey.set(
      `${event.phase}:${event.status}:${event.citationId}:${event.timestamp}:${index}`,
      event,
    );
  });
  return [...byKey.values()].slice(-80);
}

export function scoreLabel(value: number) {
  return Number.isFinite(value) ? value.toFixed(3) : "0.000";
}
