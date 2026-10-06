import {
  isPlainObject,
  isArray,
  isString,
  values,
  filter,
  uniqueBy,
} from "remeda";
// Local fixtures, contracts, normalization and merge rules for this example.
export const samples = [
  {
    label: "Concise examples",
    key: "preference-style",
    value: "The learner prefers concise examples with visible graph state.",
  },
  {
    label: "Seoul timezone",
    key: "timezone",
    value:
      "The learner works from Seoul and prefers dates shown with Korea time context.",
  },
  {
    label: "Debug focus",
    key: "debug-focus",
    value:
      "The learner wants memory, checkpoint, and stream events separated in the UI.",
  },
];

export type JsonRecord = Record<string, unknown>;

export type MemoryAction = "create" | "update" | "delete" | "recall";

export type MemoryRecord = {
  id: string;
  content: string;
  namespace: string;
  userId: string;
  source: string;
};

export type MemoryOperation = {
  action: string;
  memoryId: string;
  content: string;
  status: string;
  detail: string;
};

export type MemoryEvent = {
  type: string;
  action: string;
  userId: string;
  memoryId: string;
  detail: string;
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

export function normalizeStringList(value: unknown) {
  return isArray(value) ? value.map((item) => String(item)) : [];
}

export function normalizeMemories(value: unknown): MemoryRecord[] {
  if (!isArray(value)) return [];
  return filter(value, isPlainObject).map((memory, index) => ({
    id: isString(memory.id) ? memory.id : `memory-${index + 1}`,
    content: isString(memory.content) ? memory.content : "",
    namespace: isString(memory.namespace) ? memory.namespace : "",
    userId:
      isString(memory.user_id)
        ? memory.user_id
        : String(memory.userId ?? ""),
    source: isString(memory.source) ? memory.source : "BaseStore",
  }));
}

export function normalizeOperations(value: unknown): MemoryOperation[] {
  if (!isArray(value)) return [];
  return filter(value, isPlainObject).map((operation) => ({
    action: isString(operation.action) ? operation.action : "recall",
    memoryId:
      isString(operation.memory_id)
        ? operation.memory_id
        : String(operation.memoryId ?? ""),
    content: isString(operation.content) ? operation.content : "",
    status: isString(operation.status) ? operation.status : "",
    detail: isString(operation.detail) ? operation.detail : "",
  }));
}

export function normalizeMemoryEvents(value: unknown): MemoryEvent[] {
  if (!isArray(value)) return [];
  return filter(value, isPlainObject).map((event) => ({
    type: isString(event.type) ? event.type : "memory_operation",
    action: isString(event.action) ? event.action : "recall",
    userId:
      isString(event.user_id)
        ? event.user_id
        : String(event.userId ?? ""),
    memoryId:
      isString(event.memory_id)
        ? event.memory_id
        : String(event.memoryId ?? ""),
    detail: isString(event.detail) ? event.detail : "",
  }));
}

export function mergeOperations(
  current: MemoryOperation[],
  next: MemoryOperation[],
) {
  return uniqueBy([...current, ...next], (operation) =>
    `${operation.action}:${operation.memoryId}:${operation.status}:${operation.detail}:${operation.content}`,
  ).slice(-40);
}

export function mergeMemoryEvents(current: MemoryEvent[], next: MemoryEvent[]) {
  return uniqueBy([...current, ...next], (event) =>
    `${event.action}:${event.userId}:${event.memoryId}:${event.detail}`,
  ).slice(-60);
}
