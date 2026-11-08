import * as R from "remeda";
export const defaultRequest =
  "Rewrite the launch brief to be more professional, concise, and clear for executive reviewers.";

export const tones = ["professional", "friendly", "executive", "plain"];

export const lengths = ["concise", "standard", "expanded"];

export const sections = [
  { id: "all", label: "All sections" },
  { id: "overview", label: "Overview" },
  { id: "details", label: "Details" },
  { id: "next_steps", label: "Next Steps" },
];

export type JsonRecord = Record<string, unknown>;

export type DocumentSection = {
  id: string;
  title: string;
  before: string;
  after: string;
  changeSummary: string;
  status: string;
};

export type DocumentComment = {
  id: string;
  sectionId: string;
  severity: string;
  text: string;
};

export type QualityCheck = {
  label: string;
  status: string;
  detail: string;
};

export type DocumentVersion = {
  version: number;
  title: string;
  summary: string;
  sections: DocumentSection[];
};

export type DocumentEvent = {
  type: string;
  phase: string;
  status: string;
  detail: string;
  progress: number;
};



export function valuesOf(state: unknown): JsonRecord {
  if (R.isPlainObject(state) && R.isPlainObject(state.values)) return state.values;
  return R.isPlainObject(state) ? state : {};
}

export function nodePayloads(data: unknown): JsonRecord[] {
  if (!R.isPlainObject(data)) return [];
  return R.filter(R.values(data), R.isPlainObject);
}

export function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : Number(value ?? fallback);
}

export function percent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

export function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function normalizeSections(value: unknown): DocumentSection[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((section) => ({
      id: R.isString(section.id) ? section.id : "",
      title: R.isString(section.title) ? section.title : "",
      before: R.isString(section.before) ? section.before : "",
      after: R.isString(section.after) ? section.after : "",
      changeSummary:
        R.isString(section.change_summary)
          ? section.change_summary
          : R.isString(section.changeSummary)
            ? section.changeSummary
            : "",
      status: R.isString(section.status) ? section.status : "",
    })));
}

export function serializeSections(sectionsValue: DocumentSection[]): JsonRecord[] {
  return sectionsValue.map((section) => ({
    id: section.id,
    title: section.title,
    before: section.before,
    after: section.after,
    change_summary: section.changeSummary,
    status: section.status,
  }));
}

export function normalizeComments(value: unknown): DocumentComment[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((comment) => ({
      id: R.isString(comment.id) ? comment.id : "",
      sectionId: R.isString(comment.section_id) ? comment.section_id : "",
      severity: R.isString(comment.severity) ? comment.severity : "",
      text: R.isString(comment.text) ? comment.text : "",
    })));
}

export function normalizeQualityChecks(value: unknown): QualityCheck[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((check) => ({
      label: R.isString(check.label) ? check.label : "",
      status: R.isString(check.status) ? check.status : "",
      detail: R.isString(check.detail) ? check.detail : "",
    })));
}

export function normalizeVersions(value: unknown): DocumentVersion[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((version) => ({
      version: numberValue(version.version),
      title: R.isString(version.title) ? version.title : "",
      summary: R.isString(version.summary) ? version.summary : "",
      sections: normalizeSections(version.sections),
    })));
}

export function normalizeDocumentEvents(value: unknown): DocumentEvent[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((event) => ({
      type: R.isString(event.type) ? event.type : "30_chat_document_artifact",
      phase: R.isString(event.phase) ? event.phase : "",
      status: R.isString(event.status) ? event.status : "",
      detail: R.isString(event.detail) ? event.detail : "",
      progress: numberValue(event.progress),
    })));
}

export function mergeDocumentEvents(current: DocumentEvent[], next: DocumentEvent[]) {
  return R.uniqueBy([...current, ...next], (event) => `${event.phase}:${event.status}:${event.detail}:${event.progress}`);
}
