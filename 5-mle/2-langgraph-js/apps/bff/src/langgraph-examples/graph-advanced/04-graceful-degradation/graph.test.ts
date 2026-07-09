import { describe, expect, it } from "vitest";
import { COUNTERS, FLAKY_FAIL_TIMES } from "./flaky-tools.js";
import { fallback, partial, retry, tryExcept } from "./graph.js";

describe("ADV-04 graceful degradation", () => {
  it("retries transient failures until the flaky tool succeeds", async () => {
    COUNTERS.reset();

    const output = await retry.invoke({ query: "langgraph" });

    expect(output.usedStrategy).toBe("retry");
    expect(output.result).toContain("[flaky_search OK]");
    expect(output.result).toContain(`result-after-${FLAKY_FAIL_TIMES + 1}-tries`);
    expect(COUNTERS.flaky).toBe(FLAKY_FAIL_TIMES + 1);
    expect(COUNTERS.history).toEqual(["flaky#1", "flaky#2", "flaky#3"]);
  });

  it("captures permanent failure inside the try/except strategy", async () => {
    COUNTERS.reset();

    const output = await tryExcept.invoke({ query: "langgraph" });

    expect(output.usedStrategy).toBe("try_except");
    expect(output.result).toContain("search unavailable: PermanentError");
    expect(output.error).toBe("permanent failure for 'langgraph'");
    expect(COUNTERS.always).toBe(1);
    expect(COUNTERS.history).toEqual(["always#1"]);
  });

  it("falls back from primary search to the secondary search", async () => {
    COUNTERS.reset();

    const output = await fallback.invoke({ query: "langgraph" });

    expect(output.usedStrategy).toBe("secondary");
    expect(output.result).toContain("[secondary_search OK]");
    expect(output.error).toBe("primary: permanent failure for 'langgraph'");
    expect(COUNTERS.cached).toBe(0);
    expect(COUNTERS.history).toEqual(["always#1", "secondary#1"]);
  });

  it("returns a mixed partial summary when some workers fail", async () => {
    COUNTERS.reset();

    const output = await partial.invoke({
      query: "langgraph",
      topics: ["topic_a", "topic_b", "topic_c"]
    });

    expect(output.results).toHaveLength(3);
    expect(output.summary).toContain("Partial response: 1/3 succeeded.");
    expect(output.summary).toContain("- topic_a: (failed: TransientError)");
    expect(output.summary).toContain("- topic_b: (failed: PermanentError)");
    expect(output.summary).toContain("- topic_c: [slow_search OK]");
    expect(output.summary).toContain("Failed topics: topic_a, topic_b");
    expect(COUNTERS.history).toEqual(["flaky#1", "always#1", "slow#1"]);
  });
});
