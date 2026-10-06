import { isPlainObject, isArray, isString, values, filter } from "remeda";
export const samples = [
  {
    label: "Sales Report",
    value:
      "Analyze last quarter sales data and draft an executive summary with the key growth driver and next action.",
  },
  {
    label: "Writing Sample",
    value:
      "Rewrite this customer email to sound concise, professional, and ready to send.",
  },
  {
    label: "Analysis Brief",
    value:
      "Use the revenue metrics to explain why enterprise expansion changed the forecast.",
  },
];

export type JsonRecord = Record<string, unknown>;

export type StepRecord = {
  id: string;
  level: string;
  path: string[];
  node: string;
  label: string;
  status: string;
  summary: string;
};

export type MessageRecord = {
  path: string;
  role: string;
  content: string;
};

export function valuesOf(state: unknown): JsonRecord {
  if (isPlainObject(state) && isPlainObject(state.values)) return state.values;
  return isPlainObject(state) ? state : {};
}

export function normalizeSteps(value: unknown): StepRecord[] {
  if (!isArray(value)) return [];
  return filter(value, isPlainObject).map((record, index) => ({
    id: isString(record.id) ? record.id : `step-${index + 1}`,
    level: isString(record.level) ? record.level : "nested",
    path: isArray(record.path) ? record.path.map(String) : [],
    node: isString(record.node) ? record.node : `node-${index + 1}`,
    label:
      isString(record.label) ? record.label : `Step ${index + 1}`,
    status: isString(record.status) ? record.status : "done",
    summary: isString(record.summary) ? record.summary : "",
  }));
}

export function normalizeMessages(value: unknown): MessageRecord[] {
  if (!isArray(value)) return [];
  return filter(value, isPlainObject).map((record) => ({
    path: isString(record.path) ? record.path : "unknown",
    role: isString(record.role) ? record.role : "node",
    content:
      isString(record.content)
        ? record.content
        : JSON.stringify(record),
  }));
}

export function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function namespaceFromEvent(event: string) {
  const [, namespace] = event.split("|");
  return namespace ?? "parent";
}

export function nodePayloads(data: unknown): JsonRecord[] {
  if (!isPlainObject(data)) return [];
  return filter(values(data), isPlainObject);
}
