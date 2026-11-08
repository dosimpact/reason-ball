import { filter, isArray, isNumber, isPlainObject, isString, map, pipe, values } from "remeda";
export type JsonRecord = Record<string, unknown>;

export type TriggerType = "manual" | "webhook" | "cron";

export type Verdict = "PASS" | "FAIL";

export type AttemptRecord = {
  attempt: number;
  draft: string;
  status: string;
  toolCallIds: string[];
  changesFromFeedback: string[];
};

export type ToolCallRecord = {
  id: string;
  attempt: number;
  name: string;
  args: unknown;
  result: string;
};

export type VerificationRecord = {
  attempt: number;
  verdict: Verdict;
  score: number;
  threshold: number;
  feedback: string;
  retryReason: string;
};

export type TraceEvent = {
  loop: string;
  phase: string;
  status: string;
  detail: string;
  attempt: number;
};

export type ImprovementSuggestion = {
  area: string;
  suggestion: string;
  evidence: string;
};

export const sampleTasks = [
  "Improve a release note for developers explaining how loop engineering makes LangGraph agents easier to verify, operate, and improve.",
  "Rewrite a team update so it explains why agent traces should feed future prompt and rubric changes.",
];

export function valuesOf(state: unknown): JsonRecord {
  if (isPlainObject(state) && isPlainObject(state.values)) return state.values;
  return isPlainObject(state) ? state : {};
}

export function nodePayloads(data: unknown): JsonRecord[] {
  if (!isPlainObject(data)) return [];
  return pipe(data, values, filter(isPlainObject));
}

export function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function normalizeStringList(value: unknown) {
  return isArray(value) ? map(value, String) : [];
}

export function normalizeAttempts(value: unknown): AttemptRecord[] {
  if (!isArray(value)) return [];
  return pipe(value, filter(isPlainObject), map((item, index) => ({
    attempt: isNumber(item.attempt) ? item.attempt : index + 1,
    draft: isString(item.draft) ? item.draft : "",
    status: isString(item.status) ? item.status : "",
    toolCallIds: normalizeStringList(item.tool_call_ids ?? item.toolCallIds),
    changesFromFeedback: normalizeStringList(item.changes_from_feedback ?? item.changesFromFeedback),
  })));
}

export function normalizeToolCalls(value: unknown): ToolCallRecord[] {
  if (!isArray(value)) return [];
  return pipe(value, filter(isPlainObject), map((item, index) => ({
    id: isString(item.id) ? item.id : `tool-${index + 1}`,
    attempt: isNumber(item.attempt) ? item.attempt : 0,
    name: isString(item.name) ? item.name : "tool",
    args: item.args ?? {},
    result: isString(item.result) ? item.result : "",
  })));
}

export function normalizeVerifications(value: unknown): VerificationRecord[] {
  if (!isArray(value)) return [];
  return pipe(value, filter(isPlainObject), map((item, index): VerificationRecord => ({
    attempt: isNumber(item.attempt) ? item.attempt : index + 1,
    verdict: item.verdict === "PASS" ? "PASS" : "FAIL",
    score: isNumber(item.score) ? item.score : 0,
    threshold: isNumber(item.threshold) ? item.threshold : 4,
    feedback: isString(item.feedback) ? item.feedback : "",
    retryReason: isString(item.retry_reason) ? item.retry_reason : "",
  })));
}

export function normalizeTraceEvents(value: unknown): TraceEvent[] {
  if (!isArray(value)) return [];
  return pipe(value, filter(isPlainObject), map((item) => ({
    loop: isString(item.loop) ? item.loop : "agent",
    phase: isString(item.phase) ? item.phase : "event",
    status: isString(item.status) ? item.status : "unknown",
    detail: isString(item.detail) ? item.detail : "",
    attempt: isNumber(item.attempt) ? item.attempt : 0,
  })));
}

export function normalizeSuggestions(value: unknown): ImprovementSuggestion[] {
  if (!isArray(value)) return [];
  return pipe(value, filter(isPlainObject), map((item) => ({
    area: isString(item.area) ? item.area : "harness",
    suggestion: isString(item.suggestion) ? item.suggestion : "",
    evidence: isString(item.evidence) ? item.evidence : "",
  })));
}
