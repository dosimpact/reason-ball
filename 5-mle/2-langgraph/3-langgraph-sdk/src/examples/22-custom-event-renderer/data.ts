import * as R from "remeda";
import { createClientId } from "../../lib/langgraphClient";

// Local fixtures, contracts, normalization and merge rules for this example.
export const warningPrompt =
  "Render inline progress for a legacy import with warning events and preserve unknown diagnostic payloads.";

export const cleanPrompt =
  "Render inline progress for a clean analytics export with phase, progress, and status updates.";

export type JsonRecord = Record<string, unknown>;

export type RendererEvent = {
  type: string;
  schemaVersion: string;
  kind: string;
  eventId: string;
  replaceKey: string;
  sequence: number;
  phase: string;
  node: string;
  status: string;
  progress: number;
  message: string;
  severity: string;
  timestamp: string;
};

export type PhaseRecord = {
  phase: string;
  label: string;
  status: string;
  progress: number;
  lastMessage: string;
};

export const knownKinds = new Set(["phase", "progress", "status", "warning"]);



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
  return typeof value === "number" ? value : fallback;
}

export function normalizeRendererEvent(value: unknown): RendererEvent | null {
  if (!R.isPlainObject(value)) return null;
  if (
    value.type !== "22_custom_event_renderer" &&
    !R.isString(value.kind)
  )
    return null;
  return {
    type:
      R.isString(value.type) ? value.type : "22_custom_event_renderer",
    schemaVersion:
      R.isString(value.schema_version)
        ? value.schema_version
        : "unknown",
    kind: R.isString(value.kind) ? value.kind : "unknown",
    eventId:
      R.isString(value.event_id)
        ? value.event_id
        : createClientId("event"),
    replaceKey: R.isString(value.replace_key) ? value.replace_key : "",
    sequence: numberValue(value.sequence),
    phase: R.isString(value.phase) ? value.phase : "unknown",
    node: R.isString(value.node) ? value.node : "unknown",
    status: R.isString(value.status) ? value.status : "",
    progress: numberValue(value.progress),
    message: R.isString(value.message) ? value.message : "",
    severity: R.isString(value.severity) ? value.severity : "info",
    timestamp: R.isString(value.timestamp) ? value.timestamp : "",
  };
}

export function normalizeRendererEvents(value: unknown): RendererEvent[] {
  if (!R.isArray(value)) return [];
  return R.pipe(value, R.map(normalizeRendererEvent), R.filter(R.isNonNull));
}

export function normalizePhaseRecords(value: unknown): PhaseRecord[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((record) => ({
      phase: R.isString(record.phase) ? record.phase : "",
      label: R.isString(record.label) ? record.label : "",
      status: R.isString(record.status) ? record.status : "",
      progress: numberValue(record.progress),
      lastMessage:
        R.isString(record.last_message) ? record.last_message : "",
    })));
}

export function mergeUniqueByEventId(
  current: RendererEvent[],
  next: RendererEvent[],
) {
  const byId = new Map<string, RendererEvent>();
  [...current, ...next].forEach((event) => byId.set(event.eventId, event));
  return R.sortBy([...byId.values()], (event) => event.sequence).slice(-120);
}

export function inlineKey(event: RendererEvent) {
  if (event.kind === "warning") return event.eventId;
  return event.replaceKey || event.eventId;
}

export function mergeInlineEvents(
  current: RendererEvent[],
  next: RendererEvent[],
) {
  const byKey = new Map<string, RendererEvent>();
  [...current, ...next]
    .filter((event) => knownKinds.has(event.kind))
    .forEach((event) => byKey.set(inlineKey(event), event));
  return R.sortBy([...byKey.values()], (event) => event.sequence);
}

export function mergePhaseRecords(current: PhaseRecord[], next: PhaseRecord[]) {
  const byPhase = new Map<string, PhaseRecord>();
  [...current, ...next].forEach((record) => {
    if (record.phase) byPhase.set(record.phase, record);
  });
  return [...byPhase.values()];
}

export function eventPercent(event: RendererEvent) {
  return Math.max(0, Math.min(100, Math.round(event.progress * 100)));
}

export function phasePercent(record: PhaseRecord) {
  return Math.max(0, Math.min(100, Math.round(record.progress * 100)));
}
