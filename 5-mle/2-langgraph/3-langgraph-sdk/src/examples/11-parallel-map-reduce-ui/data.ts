import {
  isPlainObject,
  isArray,
  isString,
  isNumber,
  values,
  filter,
  sortBy,
} from "remeda";
export const samples = [
  {
    label: "Analyze Launch",
    value:
      "Evaluate a product launch plan for a LangGraph SDK learning workspace and combine market, customer, and operations findings.",
  },
  {
    label: "Market Compare",
    value:
      "Compare market positioning, developer adoption, and support readiness for a new agent dashboard.",
  },
  {
    label: "Support Summary",
    value:
      "Summarize support, documentation, and onboarding risks before a developer preview release.",
  },
];

export type JsonRecord = Record<string, unknown>;

type WorkerStatus = "pending" | "running" | "done" | "completed" | "failed";

export type WorkerCard = {
  id: string;
  index: number;
  label: string;
  item: string;
  status: WorkerStatus;
  detail: string;
  result: string;
};

export function valuesOf(state: unknown): JsonRecord {
  if (isPlainObject(state) && isPlainObject(state.values)) return state.values;
  return isPlainObject(state) ? state : {};
}

export function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function normalizeStatus(value: unknown): WorkerStatus {
  if (
    value === "running" ||
    value === "done" ||
    value === "completed" ||
    value === "failed"
  ) {
    return value;
  }
  return "pending";
}

function workerFromRecord(
  record: JsonRecord,
  fallbackIndex: number,
): WorkerCard {
  const id =
    isString(record.id)
      ? record.id
      : String(record.worker_id ?? `worker-${fallbackIndex + 1}`);
  const index = isNumber(record.index) ? record.index : fallbackIndex;
  return {
    id,
    index,
    label:
      isString(record.label) ? record.label : `Worker ${index + 1}`,
    item: isString(record.item) ? record.item : id,
    status: normalizeStatus(record.status),
    detail: isString(record.detail) ? record.detail : "",
    result: isString(record.result) ? record.result : "",
  };
}

export function mergeWorkers(current: WorkerCard[], updates: WorkerCard[]) {
  const byId = new Map(current.map((worker) => [worker.id, worker]));
  for (const update of updates) {
    const existing = byId.get(update.id);
    byId.set(update.id, {
      ...existing,
      ...update,
      detail: update.detail || existing?.detail || "",
      result: update.result || existing?.result || "",
    });
  }
  return sortBy(Array.from(byId.values()), (worker) => worker.index);
}

export function workersFromArray(value: unknown): WorkerCard[] {
  if (!isArray(value)) return [];
  return filter(value, isPlainObject)
    .map((record, index) => workerFromRecord(record, index));
}

export function updateWorkerEvent(current: WorkerCard[], event: JsonRecord) {
  const workerId = isString(event.worker_id) ? event.worker_id : "";
  if (!workerId || workerId === "dispatcher") return current;
  const index = isNumber(event.index) ? event.index : current.length;
  return mergeWorkers(current, [
    {
      id: workerId,
      index,
      label: `Worker ${workerId}`,
      item: isString(event.detail) ? event.detail : workerId,
      status: normalizeStatus(event.status),
      detail: isString(event.detail) ? event.detail : "",
      result: "",
    },
  ]);
}

export function nodePayloads(data: unknown): JsonRecord[] {
  if (!isPlainObject(data)) return [];
  return filter(values(data), isPlainObject);
}
