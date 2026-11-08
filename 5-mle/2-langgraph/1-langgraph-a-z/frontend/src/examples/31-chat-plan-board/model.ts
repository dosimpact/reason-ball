import * as R from "remeda";
export const defaultGoal = "Plan a reliable rollout for a LangGraph SDK artifact demo with review checkpoints.";

export const statuses = ["completed", "active", "pending", "blocked", "failed"] as const;

export type PlanStatus = (typeof statuses)[number];

export type JsonRecord = Record<string, unknown>;

export type PlanStep = {
  id: string;
  title: string;
  detail: string;
  status: string;
  owner: string;
};

export type ExecutionLog = {
  stepId: string;
  status: string;
  detail: string;
};

export type PlanVersion = {
  version: number;
  summary: string;
  steps: PlanStep[];
};

export type PlanEvent = {
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

export function normalizeSteps(value: unknown): PlanStep[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((step) => ({
      id: R.isString(step.id) ? step.id : "",
      title: R.isString(step.title) ? step.title : "",
      detail: R.isString(step.detail) ? step.detail : "",
      status: R.isString(step.status) ? step.status : "",
      owner: R.isString(step.owner) ? step.owner : "",
    })));
}

export function normalizeLog(value: unknown): ExecutionLog[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((entry) => ({
      stepId: R.isString(entry.step_id) ? entry.step_id : "",
      status: R.isString(entry.status) ? entry.status : "",
      detail: R.isString(entry.detail) ? entry.detail : "",
    })));
}

export function normalizeVersions(value: unknown): PlanVersion[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((version) => ({
      version: numberValue(version.version),
      summary: R.isString(version.summary) ? version.summary : "",
      steps: normalizeSteps(version.steps),
    })));
}

export function normalizePlanEvents(value: unknown): PlanEvent[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((event) => ({
      type: R.isString(event.type) ? event.type : "31_chat_plan_board",
      phase: R.isString(event.phase) ? event.phase : "",
      status: R.isString(event.status) ? event.status : "",
      detail: R.isString(event.detail) ? event.detail : "",
      progress: numberValue(event.progress),
    })));
}

export function mergePlanEvents(current: PlanEvent[], next: PlanEvent[]) {
  return R.uniqueBy([...current, ...next], (event) => `${event.phase}:${event.status}:${event.detail}:${event.progress}`);
}
