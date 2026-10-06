import { isPlainObject, isArray, values } from "remeda";
export const defaultAction =
  "delete production database backup after summarizing risk";

export const editedAction =
  "archive production database backup after summarizing risk";

export type InterruptPayload = {
  kind?: string;
  question?: string;
  action?: string;
  risk?: string;
  risk_summary?: string;
  options?: string[];
};

export function extractInterruptPayload(
  value: unknown,
): InterruptPayload | null {
  if (!value) return null;
  if (isArray(value)) {
    for (const item of value) {
      const found = extractInterruptPayload(item);
      if (found) return found;
    }
    return null;
  }
  if (!isPlainObject(value)) return null;

  if (isPlainObject(value.value) && value.value.kind === "approval_request") {
    return value.value as InterruptPayload;
  }
  if (value.kind === "approval_request") {
    return value as InterruptPayload;
  }

  const interrupts = value.interrupts;
  if (isArray(interrupts)) return extractInterruptPayload(interrupts);
  const tasks = value.tasks;
  if (isArray(tasks)) return extractInterruptPayload(tasks);

  for (const child of values(value)) {
    const found = extractInterruptPayload(child);
    if (found) return found;
  }
  return null;
}

export function valuesOf(state: unknown): Record<string, unknown> {
  if (isPlainObject(state) && isPlainObject(state.values)) return state.values;
  return isPlainObject(state) ? state : {};
}
