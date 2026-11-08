import * as R from "remeda";
export const defaultRequest =
  "Add a safe test scaffold marker to the FastAPI sample and show the diff before applying it.";

export const files = ["app.py", "README.md"];

export type JsonRecord = Record<string, unknown>;

export type TestRecord = {
  phase: string;
  status: string;
  detail: string;
  tool: string;
};

export type EditorEvent = {
  type: string;
  phase: string;
  status: string;
  detail: string;
  progress: number;
};

export type ArtifactVersion = {
  path: string;
  name: string;
  before: string;
  after: string;
  summary: string;
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

export function normalizeTestRecords(value: unknown): TestRecord[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((record) => ({
      phase: R.isString(record.phase) ? record.phase : "",
      status: R.isString(record.status) ? record.status : "",
      detail: R.isString(record.detail) ? record.detail : "",
      tool: R.isString(record.tool) ? record.tool : "",
    })));
}

export function normalizeEditorEvents(value: unknown): EditorEvent[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((event) => ({
      type: R.isString(event.type) ? event.type : "29_chat_code_editor",
      phase: R.isString(event.phase) ? event.phase : "",
      status: R.isString(event.status) ? event.status : "",
      detail: R.isString(event.detail) ? event.detail : "",
      progress: numberValue(event.progress),
    })));
}

export function normalizeHistory(value: unknown): ArtifactVersion[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((version) => ({
      path: R.isString(version.path) ? version.path : "",
      name: R.isString(version.name) ? version.name : "",
      before: R.isString(version.before) ? version.before : "",
      after: R.isString(version.after) ? version.after : "",
      summary: R.isString(version.summary) ? version.summary : "",
    })));
}

export function mergeEditorEvents(current: EditorEvent[], next: EditorEvent[]) {
  return R.uniqueBy([...current, ...next], (event) => `${event.phase}:${event.status}:${event.detail}:${event.progress}`);
}
