import * as R from "remeda";
// Local fixtures, contracts, normalization and merge rules for this example.
export const toolQuery =
  "Use observability metrics to explain why a LangGraph SDK demo run is slow. Mention latency, tokens, and cost.";

export const summaryQuery =
  "Summarize what run metadata, trace links, and raw stream events are useful for debugging a graph.";

export type JsonRecord = Record<string, unknown>;

export type NodeTiming = {
  node: string;
  status: string;
  startedAt: string;
  finishedAt: string;
  elapsedMs: number;
  inputKeys: string[];
  outputKeys: string[];
};

export type TokenMetric = {
  node: string;
  modelAlias: string;
  modelName: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
  usageAvailable: boolean;
};

export type CostSummary = {
  totalInputTokens: number | null;
  totalOutputTokens: number | null;
  totalTokens: number | null;
  totalCostUsd: number | null;
  pricingNote: string;
};

export type TraceLinks = {
  tracingEnabled: boolean;
  langsmithProject: string;
  langsmithUrl: string;
  note: string;
};

export type ObservabilityEvent = {
  type: string;
  phase: string;
  status: string;
  detail: string;
  node: string;
  elapsedMs: number;
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

function stringList(value: unknown) {
  return R.isArray(value) ? value.map(String) : [];
}

function numberOrNull(value: unknown) {
  return typeof value === "number" ? value : null;
}

export function formatCount(value: number | null) {
  return value === null ? "unknown" : String(value);
}

export function formatCost(value: number | null) {
  return value === null ? "unknown" : `$${value.toFixed(8)}`;
}

export function normalizeNodeTimings(value: unknown): NodeTiming[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((timing) => ({
      node: R.isString(timing.node) ? timing.node : "node",
      status: R.isString(timing.status) ? timing.status : "",
      startedAt: R.isString(timing.started_at) ? timing.started_at : "",
      finishedAt:
        R.isString(timing.finished_at) ? timing.finished_at : "",
      elapsedMs: typeof timing.elapsed_ms === "number" ? timing.elapsed_ms : 0,
      inputKeys: stringList(timing.input_keys),
      outputKeys: stringList(timing.output_keys),
    })));
}

export function normalizeTokenMetrics(value: unknown): TokenMetric[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((metric) => ({
      node: R.isString(metric.node) ? metric.node : "call_model",
      modelAlias:
        R.isString(metric.model_alias) ? metric.model_alias : "",
      modelName: R.isString(metric.model_name) ? metric.model_name : "",
      inputTokens: numberOrNull(metric.input_tokens),
      outputTokens: numberOrNull(metric.output_tokens),
      totalTokens: numberOrNull(metric.total_tokens),
      costUsd: numberOrNull(metric.cost_usd),
      usageAvailable:
        typeof metric.usage_available === "boolean"
          ? metric.usage_available
          : false,
    })));
}

export function normalizeCostSummary(value: unknown): CostSummary {
  const record = R.isPlainObject(value) ? value : {};
  return {
    totalInputTokens: numberOrNull(record.total_input_tokens),
    totalOutputTokens: numberOrNull(record.total_output_tokens),
    totalTokens: numberOrNull(record.total_tokens),
    totalCostUsd: numberOrNull(record.total_cost_usd),
    pricingNote:
      R.isString(record.pricing_note) ? record.pricing_note : "",
  };
}

export function normalizeTraceLinks(value: unknown): TraceLinks {
  const record = R.isPlainObject(value) ? value : {};
  return {
    tracingEnabled:
      typeof record.tracing_enabled === "boolean"
        ? record.tracing_enabled
        : false,
    langsmithProject:
      R.isString(record.langsmith_project)
        ? record.langsmith_project
        : "",
    langsmithUrl:
      R.isString(record.langsmith_url) ? record.langsmith_url : "",
    note:
      R.isString(record.note) ? record.note : "Trace link unavailable.",
  };
}

export function normalizeObservabilityEvents(
  value: unknown,
): ObservabilityEvent[] {
  if (!R.isArray(value)) return [];
  return R.pipe(
    value,
    R.filter(R.isPlainObject),
    R.map((event) => ({
      type: R.isString(event.type) ? event.type : "observability_status",
      phase: R.isString(event.phase) ? event.phase : "",
      status: R.isString(event.status) ? event.status : "",
      detail: R.isString(event.detail) ? event.detail : "",
      node: R.isString(event.node) ? event.node : "",
      elapsedMs: typeof event.elapsed_ms === "number" ? event.elapsed_ms : 0,
    })));
}

export function mergeObservabilityEvents(
  current: ObservabilityEvent[],
  next: ObservabilityEvent[],
) {
  return R.uniqueBy([...current, ...next], (event) => `${event.node}:${event.phase}:${event.status}:${event.detail}:${event.elapsedMs}`)
    .slice(-80);
}
