import { describe, expect, it } from "vitest";
import {
  appendMetric,
  createMetricsRecord,
  estimateCost,
  extractUsage,
  mergeMetrics,
  summarizeMetrics
} from "./metrics.js";

describe("ADV-09 metrics helpers", () => {
  it("estimates cost with configured model pricing", () => {
    expect(estimateCost("fast", 1000, 1000)).toBe(0.006);
    expect(estimateCost("missing-model", 1000, 1000)).toBe(0.018);
  });

  it("rejects invalid token counts", () => {
    expect(() => estimateCost("fast", -1, 0)).toThrow(RangeError);
    expect(() => estimateCost("fast", 0, Number.NaN)).toThrow(RangeError);
  });

  it("extracts LangChain usage_metadata", () => {
    expect(
      extractUsage({
        usage_metadata: {
          input_tokens: 10,
          output_tokens: 5,
          total_tokens: 15
        }
      })
    ).toEqual({
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15
    });
  });

  it("extracts OpenAI-compatible response_metadata tokenUsage", () => {
    expect(
      extractUsage({
        response_metadata: {
          tokenUsage: {
            promptTokens: 7,
            completionTokens: 3,
            totalTokens: 10
          }
        }
      })
    ).toEqual({
      inputTokens: 7,
      outputTokens: 3,
      totalTokens: 10
    });
  });

  it("accumulates metrics records and totals", () => {
    const first = createMetricsRecord("fast", {
      usage_metadata: {
        input_tokens: 1000,
        output_tokens: 1000,
        total_tokens: 2000
      }
    });
    const second = createMetricsRecord("default", {
      usage_metadata: {
        input_tokens: 500,
        output_tokens: 100,
        total_tokens: 600
      }
    });

    const merged = mergeMetrics([first], [second]);
    const aggregate = summarizeMetrics(merged);
    const appended = appendMetric([first], second);

    expect(aggregate).toEqual(appended);
    expect(aggregate.totalInputTokens).toBe(1500);
    expect(aggregate.totalOutputTokens).toBe(1100);
    expect(aggregate.totalTokens).toBe(2600);
    expect(aggregate.totalCostUsd).toBe(0.009);
  });
});
