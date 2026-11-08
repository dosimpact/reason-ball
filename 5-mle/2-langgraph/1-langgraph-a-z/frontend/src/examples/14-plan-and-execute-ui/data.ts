import {
  isPlainObject,
  isArray,
  isString,
  isNumber,
  values,
  filter,
} from "remeda";
// Local fixtures, contracts, normalization and merge rules for this example.
export const samples = [
  {
    label: "SDK Demo",
    value:
      "Build a LangGraph SDK learning demo: plan the work, implement the UI, and verify it.",
  },
  {
    label: "Blog Post",
    value:
      "Write a blog post about RAG: outline the post, draft the key sections, and prepare an edit checklist.",
  },
  {
    label: "Launch Checklist",
    value:
      "Prepare a launch checklist for a developer preview: define scope, coordinate teams, and verify release readiness.",
  },
];

export const modes = [
  {
    label: "Normal",
    value: "normal",
    detail: "execute every planned step",
  },
  {
    label: "Replan",
    value: "replan_after_first",
    detail: "revise remaining steps after step one",
  },
  {
    label: "Stop",
    value: "stop_after_first",
    detail: "stop after the first completed step",
  },
] as const;

export type ControlMode = (typeof modes)[number]["value"];

type StepStatus =
  "pending" | "active" | "completed" | "failed" | "skipped" | "replanned";

export type JsonRecord = Record<string, unknown>;

export type PlanStep = {
  id: string;
  index: number;
  title: string;
  status: StepStatus;
  result: string;
  error: string;
  source: string;
};

export type StepEvent = {
  type: string;
  stepId: string;
  status: StepStatus;
  title: string;
  detail: string;
};

export function valuesOf(state: unknown): JsonRecord {
  if (isPlainObject(state) && isPlainObject(state.values)) return state.values;
  return isPlainObject(state) ? state : {};
}

export function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function normalizeStatus(value: unknown): StepStatus {
  if (
    value === "pending" ||
    value === "active" ||
    value === "completed" ||
    value === "failed" ||
    value === "skipped" ||
    value === "replanned"
  ) {
    return value;
  }
  return "pending";
}

export function normalizeSteps(value: unknown): PlanStep[] {
  if (!isArray(value)) return [];
  return filter(value, isPlainObject).map((step, index) => ({
    id: isString(step.id) ? step.id : `step-${index + 1}`,
    index: isNumber(step.index) ? step.index : index + 1,
    title: isString(step.title) ? step.title : `Step ${index + 1}`,
    status: normalizeStatus(step.status),
    result: isString(step.result) ? step.result : "",
    error: isString(step.error) ? step.error : "",
    source: isString(step.source) ? step.source : "planner",
  }));
}

export function normalizeEvents(value: unknown): StepEvent[] {
  if (!isArray(value)) return [];
  return filter(value, isPlainObject).map((event, index) => ({
    type: isString(event.type) ? event.type : "plan_step",
    stepId:
      isString(event.step_id)
        ? event.step_id
        : String(event.stepId ?? `event-${index + 1}`),
    status: normalizeStatus(event.status),
    title: isString(event.title) ? event.title : `Step ${index + 1}`,
    detail: isString(event.detail) ? event.detail : "",
  }));
}

export function nodePayloads(data: unknown): JsonRecord[] {
  if (!isPlainObject(data)) return [];
  return filter(values(data), isPlainObject);
}

export function updateStepFromEvent(steps: PlanStep[], event: StepEvent) {
  return steps.map((step) =>
    step.id === event.stepId
      ? {
          ...step,
          status: event.status,
          result:
            event.status === "completed"
              ? event.detail || step.result
              : step.result,
          error:
            event.status === "failed" ? event.detail || step.error : step.error,
        }
      : step,
  );
}
