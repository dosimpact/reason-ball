import * as R from "remeda";
export const defaultPrompt =
  "Explain a LangGraph SDK run with chat, subgraph execution, checkpoints, and replay inspection.";

export type JsonRecord = Record<string, unknown>;

export type CanvasNode = {
  id: string;
  label: string;
  status: string;
  detail: string;
  lane: string;
};

export type CanvasEdge = {
  from: string;
  to: string;
  label: string;
};

export type ExecutionEvent = {
  id: string;
  nodeId: string;
  phase: string;
  status: string;
  detail: string;
  checkpointId: string;
};

export type CanvasCheckpoint = {
  id: string;
  label: string;
  eventId: string;
  nodeId: string;
  summary: string;
};

export type DiffRow = {
  key: string;
  before: string;
  after: string;
  status: string;
};

export type CanvasVersion = {
  version: number;
  summary: string;
  selectedEventId: string;
};

export type CanvasEvent = {
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

export function normalizeNodes(value: unknown): CanvasNode[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((node) => ({
      id: R.isString(node.id) ? node.id : "",
      label: R.isString(node.label) ? node.label : "",
      status: R.isString(node.status) ? node.status : "pending",
      detail: R.isString(node.detail) ? node.detail : "",
      lane: R.isString(node.lane) ? node.lane : R.isString(node.kind) ? node.kind : "main",
    })));
}

export function normalizeEdges(value: unknown): CanvasEdge[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((edge) => ({
      from: R.isString(edge.from) ? edge.from : R.isString(edge.source) ? edge.source : "",
      to: R.isString(edge.to) ? edge.to : R.isString(edge.target) ? edge.target : "",
      label: R.isString(edge.label) ? edge.label : "",
    })));
}

export function normalizeExecutionEvents(value: unknown): ExecutionEvent[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((event) => ({
      id: R.isString(event.id) ? event.id : "",
      nodeId: R.isString(event.node_id) ? event.node_id : "",
      phase: R.isString(event.phase) ? event.phase : "",
      status: R.isString(event.status) ? event.status : "",
      detail: R.isString(event.detail) ? event.detail : "",
      checkpointId: R.isString(event.checkpoint_id) ? event.checkpoint_id : "",
    })));
}

export function normalizeCheckpoints(value: unknown): CanvasCheckpoint[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((checkpoint) => ({
      id: R.isString(checkpoint.id) ? checkpoint.id : "",
      label: R.isString(checkpoint.label) ? checkpoint.label : "",
      eventId: R.isString(checkpoint.event_id) ? checkpoint.event_id : "",
      nodeId: R.isString(checkpoint.node_id) ? checkpoint.node_id : "",
      summary: R.isString(checkpoint.summary) ? checkpoint.summary : "",
    })));
}

export function normalizeDiff(value: unknown): DiffRow[] {
  if (R.isPlainObject(value)) {
    const rows: DiffRow[] = [];
    const added = R.isPlainObject(value.added) ? value.added : {};
    const changed = R.isPlainObject(value.changed) ? value.changed : {};
    const removed = R.isArray(value.removed) ? value.removed.map(String) : [];
    for (const [key, after] of R.entries(added)) {
      rows.push({ key, before: "undefined", after: formatJson(after), status: "added" });
    }
    for (const [key, after] of R.entries(changed)) {
      rows.push({ key, before: "previous", after: formatJson(after), status: "changed" });
    }
    for (const key of removed) {
      rows.push({ key, before: "present", after: "removed", status: "removed" });
    }
    if (R.isString(value.event_id)) {
      rows.unshift({ key: "event_id", before: "previous", after: value.event_id, status: "selected" });
    }
    return rows;
  }
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((row) => ({
      key: R.isString(row.key) ? row.key : "",
      before: R.isString(row.before) ? row.before : "",
      after: R.isString(row.after) ? row.after : "",
      status: R.isString(row.status) ? row.status : "changed",
    })));
}

export function normalizeVersions(value: unknown): CanvasVersion[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((version) => ({
      version: numberValue(version.version),
      summary: R.isString(version.summary) ? version.summary : "",
      selectedEventId: R.isString(version.selected_event_id) ? version.selected_event_id : "",
    })));
}

export function normalizeCanvasEvents(value: unknown): CanvasEvent[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((event) => ({
      type: R.isString(event.type) ? event.type : "32_chat_graph_execution_canvas",
      phase: R.isString(event.phase) ? event.phase : "",
      status: R.isString(event.status) ? event.status : "",
      detail: R.isString(event.detail) ? event.detail : "",
      progress: numberValue(event.progress),
    })));
}

export function mergeCanvasEvents(current: CanvasEvent[], next: CanvasEvent[]) {
  return R.uniqueBy([...current, ...next], (event) => `${event.phase}:${event.status}:${event.detail}:${event.progress}`);
}

export function selectedEventFrom(values: JsonRecord, fallback: ExecutionEvent | null): ExecutionEvent | null {
  if (!R.isPlainObject(values.selected_event)) return fallback;
  return normalizeExecutionEvents([values.selected_event])[0] ?? fallback;
}
