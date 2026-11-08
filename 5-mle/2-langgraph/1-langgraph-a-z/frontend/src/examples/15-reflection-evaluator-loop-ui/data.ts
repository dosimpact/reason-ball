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
    label: "Checkpoint Update",
    value:
      "Draft a concise product update for developers explaining why LangGraph checkpointing helps with review, replay, and safer agent releases.",
  },
  {
    label: "Interrupt Release",
    value:
      "Write a short launch note for engineering teams explaining when to use human approval interrupts in an agent workflow.",
  },
  {
    label: "Streaming Guide",
    value:
      "Create a practical developer blurb about using LangGraph stream modes to debug node updates and custom progress events.",
  },
];

export const retryPolicies = [
  {
    label: "Force first retry",
    value: "force_first_retry",
    detail: "guarantees a visible rewrite loop",
  },
  {
    label: "Allow immediate pass",
    value: "allow_pass",
    detail: "trust the first evaluator verdict",
  },
] as const;

export type RetryPolicy = (typeof retryPolicies)[number]["value"];

export type JsonRecord = Record<string, unknown>;

export type Verdict = "PASS" | "FAIL" | "";

export type IterationRecord = {
  iteration: number;
  draft: string;
  critique: string;
  verdict: Verdict;
  score: number;
  feedback: string;
  strengths: string[];
  requiredChanges: string[];
  status: string;
};

export type LoopEvent = {
  type: string;
  iteration: number;
  phase: string;
  verdict: string;
  score: number;
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

function normalizeVerdict(value: unknown): Verdict {
  if (value === "PASS" || value === "FAIL") return value;
  return "";
}

export function normalizeIterations(value: unknown): IterationRecord[] {
  if (!isArray(value)) return [];
  return filter(value, isPlainObject).map((iteration, index) => ({
    iteration:
      isNumber(iteration.iteration) ? iteration.iteration : index + 1,
    draft: isString(iteration.draft) ? iteration.draft : "",
    critique: isString(iteration.critique) ? iteration.critique : "",
    verdict: normalizeVerdict(iteration.verdict),
    score: isNumber(iteration.score) ? iteration.score : 0,
    feedback: isString(iteration.feedback) ? iteration.feedback : "",
    strengths: normalizeStringList(iteration.strengths),
    requiredChanges: normalizeStringList(
      iteration.required_changes ?? iteration.requiredChanges,
    ),
    status: isString(iteration.status) ? iteration.status : "pending",
  }));
}

export function normalizeLoopEvents(value: unknown): LoopEvent[] {
  if (!isArray(value)) return [];
  return filter(value, isPlainObject).map((event, index) => ({
    type: isString(event.type) ? event.type : "reflection_iteration",
    iteration:
      isNumber(event.iteration) ? event.iteration : index + 1,
    phase: isString(event.phase) ? event.phase : "event",
    verdict: isString(event.verdict) ? event.verdict : "",
    score: isNumber(event.score) ? event.score : 0,
    detail: isString(event.detail) ? event.detail : "",
  }));
}
