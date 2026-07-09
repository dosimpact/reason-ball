export interface ModelPricing {
  input: number;
  output: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface MetricsRecord extends TokenUsage {
  model: string;
  costUsd: number;
}

export interface MetricsAggregate {
  metrics: MetricsRecord[];
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
}

// Demo estimates in USD per 1,000 tokens. Update this table when provider prices change.
export const PRICING: Record<string, ModelPricing> = {
  fast: { input: 0.001, output: 0.005 },
  default: { input: 0.003, output: 0.015 },
  normal: { input: 0.003, output: 0.015 },
  smart: { input: 0.015, output: 0.075 },
  reasoning: { input: 0.015, output: 0.075 },
  "gpt-4o-mini": { input: 0.001, output: 0.005 }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumber(record: Record<string, unknown>, keys: readonly string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

function normalizeTokenCount(value: number | undefined, label: string): number {
  if (value === undefined) {
    return 0;
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative finite number.`);
  }
  return Math.trunc(value);
}

function readUsageFrom(record: Record<string, unknown>): TokenUsage {
  const inputTokens = normalizeTokenCount(
    readNumber(record, ["input_tokens", "inputTokens", "prompt_tokens", "promptTokens"]),
    "inputTokens"
  );
  const outputTokens = normalizeTokenCount(
    readNumber(record, ["output_tokens", "outputTokens", "completion_tokens", "completionTokens"]),
    "outputTokens"
  );
  const explicitTotal = readNumber(record, ["total_tokens", "totalTokens"]);
  const totalTokens = normalizeTokenCount(explicitTotal ?? inputTokens + outputTokens, "totalTokens");

  return {
    inputTokens,
    outputTokens,
    totalTokens
  };
}

export function estimateCost(modelAlias: string, inputTokens: number, outputTokens: number): number {
  const input = normalizeTokenCount(inputTokens, "inputTokens");
  const output = normalizeTokenCount(outputTokens, "outputTokens");
  const pricing = PRICING[modelAlias] ?? PRICING.default;
  return Number(((input / 1000) * pricing.input + (output / 1000) * pricing.output).toFixed(12));
}

export function extractUsage(source: unknown): TokenUsage {
  if (!isRecord(source)) {
    return {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0
    };
  }

  if (isRecord(source.usage_metadata)) {
    return readUsageFrom(source.usage_metadata);
  }

  if (isRecord(source.response_metadata)) {
    const tokenUsage = source.response_metadata.tokenUsage ?? source.response_metadata.token_usage;
    if (isRecord(tokenUsage)) {
      return readUsageFrom(tokenUsage);
    }
  }

  return readUsageFrom(source);
}

export function createMetricsRecord(modelAlias: string, source: unknown): MetricsRecord {
  const usage = extractUsage(source);
  return {
    model: modelAlias,
    ...usage,
    costUsd: estimateCost(modelAlias, usage.inputTokens, usage.outputTokens)
  };
}

export function mergeMetrics(left: readonly MetricsRecord[], right: readonly MetricsRecord[]): MetricsRecord[] {
  return [...left, ...right];
}

export function summarizeMetrics(metrics: readonly MetricsRecord[]): MetricsAggregate {
  const totalInputTokens = metrics.reduce((sum, metric) => sum + metric.inputTokens, 0);
  const totalOutputTokens = metrics.reduce((sum, metric) => sum + metric.outputTokens, 0);
  const totalTokens = metrics.reduce((sum, metric) => sum + metric.totalTokens, 0);
  const totalCostUsd = Number(metrics.reduce((sum, metric) => sum + metric.costUsd, 0).toFixed(12));

  return {
    metrics: [...metrics],
    totalCostUsd,
    totalInputTokens,
    totalOutputTokens,
    totalTokens
  };
}

export function appendMetric(metrics: readonly MetricsRecord[], record: MetricsRecord): MetricsAggregate {
  return summarizeMetrics([...metrics, record]);
}
