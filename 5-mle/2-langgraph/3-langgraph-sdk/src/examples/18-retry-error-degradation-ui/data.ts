import * as R from "remeda";
// Local fixtures, contracts, normalization and merge rules for this example.
export const samples = [
  {
    label: "SDK Outage",
    value:
      "Summarize retry and fallback behavior for a LangGraph SDK learning demo.",
  },
  {
    label: "Search Timeout",
    value:
      "Handle an upstream search timeout while still giving the learner useful partial context.",
  },
  {
    label: "Auth Failure",
    value:
      "Explain how a graph should surface a permanent authentication failure without hiding it.",
  },
];

export const modes = [
  { label: "Normal", value: "normal", detail: "primary succeeds immediately" },
  {
    label: "Flaky",
    value: "flaky_success",
    detail: "two transient failures, then recovery",
  },
  {
    label: "Fallback",
    value: "fallback_success",
    detail: "primary exhausts retries, fallback succeeds",
  },
  {
    label: "Forced failure",
    value: "final_failure",
    detail: "permanent error with no fallback",
  },
] as const;

export type FailureMode = (typeof modes)[number]["value"];

export type JsonRecord = Record<string, unknown>;

export type RetryAttempt = {
  attempt: number;
  status: string;
  errorType: string;
  message: string;
  recoverable: boolean;
  backoffMs: number;
  result: string;
};

export type ErrorRecord = {
  node: string;
  attempt: number;
  errorType: string;
  message: string;
  recoverable: boolean;
};

export type RetryEvent = {
  type: string;
  phase: string;
  attempt: number;
  status: string;
  detail: string;
  backoffMs: number;
};



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

export function normalizeAttempts(value: unknown): RetryAttempt[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((attempt, index) => ({
      attempt: typeof attempt.attempt === "number" ? attempt.attempt : index + 1,
      status: R.isString(attempt.status) ? attempt.status : "",
      errorType:
        R.isString(attempt.error_type)
          ? attempt.error_type
          : String(attempt.errorType ?? ""),
      message: R.isString(attempt.message) ? attempt.message : "",
      recoverable:
        typeof attempt.recoverable === "boolean" ? attempt.recoverable : false,
      backoffMs:
        typeof attempt.backoff_ms === "number"
          ? attempt.backoff_ms
          : Number(attempt.backoffMs ?? 0),
      result: R.isString(attempt.result) ? attempt.result : "",
    })));
}

export function normalizeErrors(value: unknown): ErrorRecord[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((error, index) => ({
      node: R.isString(error.node) ? error.node : "primary_call",
      attempt: typeof error.attempt === "number" ? error.attempt : index + 1,
      errorType:
        R.isString(error.error_type)
          ? error.error_type
          : String(error.errorType ?? ""),
      message: R.isString(error.message) ? error.message : "",
      recoverable:
        typeof error.recoverable === "boolean" ? error.recoverable : false,
    })));
}

export function normalizeRetryEvents(value: unknown): RetryEvent[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((event, index) => ({
      type: R.isString(event.type) ? event.type : "retry_status",
      phase: R.isString(event.phase) ? event.phase : "event",
      attempt: typeof event.attempt === "number" ? event.attempt : index + 1,
      status: R.isString(event.status) ? event.status : "",
      detail: R.isString(event.detail) ? event.detail : "",
      backoffMs:
        typeof event.backoff_ms === "number"
          ? event.backoff_ms
          : Number(event.backoffMs ?? 0),
    })));
}

export function mergeRetryEvents(current: RetryEvent[], next: RetryEvent[]) {
  return R.uniqueBy([...current, ...next], (event) => `${event.phase}:${event.attempt}:${event.status}:${event.detail}:${event.backoffMs}`)
    .slice(-80);
}
