import * as R from "remeda";
import { createClientId } from "../../lib/langgraphClient";

// Local fixtures, contracts, normalization and merge rules for this example.
export const analysisPrompt =
  "Explain how a LangGraph UI can show useful public reasoning status without exposing non-public model notes.";

export const supportPrompt =
  "Summarize how a support ticket triage graph should show visible thinking status before the final answer.";

export type JsonRecord = Record<string, unknown>;

export type ThinkingStep = {
  type: string;
  schemaVersion: string;
  stepId: string;
  sequence: number;
  label: string;
  status: string;
  publicSummary: string;
  detail: string;
  timestamp: string;
  publicOnly: boolean;
};

export type SafetyGuardrails = {
  publicOnly: boolean;
  hiddenReasoningExposed: boolean;
  policy: string;
  allowedContent: string[];
  blockedContent: string[];
};



export function valuesOf(state: unknown): JsonRecord {
  if (R.isPlainObject(state) && R.isPlainObject(state.values)) return state.values;
  return R.isPlainObject(state) ? state : {};
}

const sensitiveKeyPattern =
  /(chain[_ -]?of[_ -]?thought|raw[_ -]?reasoning|reasoning[_ -]?trace|thoughts|private[_ -]?)/i;

function sanitizeForDisplay(value: unknown): unknown {
  if (R.isArray(value)) return value.map(sanitizeForDisplay);
  if (!R.isPlainObject(value)) return value;
  return R.fromEntries(
    R.entries(value).map(([key, childValue]) => [
      key,
      sensitiveKeyPattern.test(key)
        ? "[redacted: non-public field]"
        : sanitizeForDisplay(childValue),
    ]),
  );
}

export function formatJson(value: unknown) {
  return JSON.stringify(sanitizeForDisplay(value), null, 2);
}

export function nodePayloads(data: unknown): JsonRecord[] {
  if (!R.isPlainObject(data)) return [];
  return R.filter(R.values(data), R.isPlainObject);
}

export function normalizeThinkingStep(value: unknown): ThinkingStep | null {
  if (!R.isPlainObject(value)) return null;
  if (
    value.type !== "23_thinking_renderer" &&
    !R.isString(value.step_id)
  )
    return null;
  return {
    type: R.isString(value.type) ? value.type : "23_thinking_renderer",
    schemaVersion:
      R.isString(value.schema_version) ? value.schema_version : "v1",
    stepId:
      R.isString(value.step_id)
        ? value.step_id
        : createClientId("step"),
    sequence: typeof value.sequence === "number" ? value.sequence : 0,
    label: R.isString(value.label) ? value.label : "Thinking step",
    status: R.isString(value.status) ? value.status : "",
    publicSummary:
      R.isString(value.public_summary) ? value.public_summary : "",
    detail: R.isString(value.detail) ? value.detail : "",
    timestamp: R.isString(value.timestamp) ? value.timestamp : "",
    publicOnly:
      typeof value.public_only === "boolean" ? value.public_only : true,
  };
}

export function normalizeThinkingSteps(value: unknown): ThinkingStep[] {
  if (!R.isArray(value)) return [];
  return R.pipe(value, R.map(normalizeThinkingStep), R.filter(R.isNonNull));
}

export function normalizeGuardrails(value: unknown): SafetyGuardrails | null {
  if (!R.isPlainObject(value)) return null;
  return {
    publicOnly:
      typeof value.public_only === "boolean" ? value.public_only : true,
    hiddenReasoningExposed:
      typeof value.hidden_reasoning_exposed === "boolean"
        ? value.hidden_reasoning_exposed
        : false,
    policy: R.isString(value.policy) ? value.policy : "",
    allowedContent: R.isArray(value.allowed_content)
      ? value.allowed_content.map(String)
      : [],
    blockedContent: R.isArray(value.blocked_content)
      ? value.blocked_content.map(String)
      : [],
  };
}

export function mergeThinkingSteps(
  current: ThinkingStep[],
  next: ThinkingStep[],
) {
  const byKey = new Map<string, ThinkingStep>();
  [...current, ...next].forEach((step) => {
    byKey.set(`${step.stepId}:${step.sequence}`, step);
  });
  return R.sortBy([...byKey.values()], (step) => step.sequence).slice(-80);
}
