import { tool } from "@langchain/core/tools";
import { z } from "zod";

export class TransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransientError";
  }
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

export class PermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentError";
  }
}

export type CounterHistoryEntry = `flaky#${number}` | `always#${number}` | `slow#${number}` | `secondary#${number}` | `cached#${number}`;

export const FLAKY_FAIL_TIMES = 2;

export const COUNTERS = {
  flaky: 0,
  always: 0,
  slow: 0,
  secondary: 0,
  cached: 0,
  history: [] as CounterHistoryEntry[],
  reset() {
    this.flaky = 0;
    this.always = 0;
    this.slow = 0;
    this.secondary = 0;
    this.cached = 0;
    this.history = [];
  }
};

const querySchema = z.object({
  query: z.string().describe("Search query")
});

export const flakySearch = tool(
  ({ query }) => {
    COUNTERS.flaky += 1;
    COUNTERS.history.push(`flaky#${COUNTERS.flaky}`);

    if (COUNTERS.flaky <= FLAKY_FAIL_TIMES) {
      throw new TransientError(`transient failure (attempt ${COUNTERS.flaky})`);
    }

    return `[flaky_search OK] '${query}' -> result-after-${COUNTERS.flaky}-tries`;
  },
  {
    name: "flaky_search",
    description: "Deterministic search tool that fails transiently before succeeding.",
    schema: querySchema
  }
);

export const alwaysFailingSearch = tool(
  ({ query }) => {
    COUNTERS.always += 1;
    COUNTERS.history.push(`always#${COUNTERS.always}`);
    throw new PermanentError(`permanent failure for '${query}'`);
  },
  {
    name: "always_failing_search",
    description: "Deterministic search tool that always raises a permanent error.",
    schema: querySchema
  }
);

export const slowThenOkSearch = tool(
  ({ query }) => {
    COUNTERS.slow += 1;
    COUNTERS.history.push(`slow#${COUNTERS.slow}`);
    return `[slow_search OK] '${query}'`;
  },
  {
    name: "slow_then_ok_search",
    description: "Deterministic backup search tool that always succeeds.",
    schema: querySchema
  }
);

export const secondarySearch = tool(
  ({ query }) => {
    COUNTERS.secondary += 1;
    COUNTERS.history.push(`secondary#${COUNTERS.secondary}`);
    return `[secondary_search OK] '${query}'`;
  },
  {
    name: "secondary_search",
    description: "Deterministic secondary search tool used after primary failure.",
    schema: querySchema
  }
);

export const cachedAnswer = tool(
  ({ query }) => {
    COUNTERS.cached += 1;
    COUNTERS.history.push(`cached#${COUNTERS.cached}`);
    return `[cached_answer] stale result for '${query}' (may be outdated)`;
  },
  {
    name: "cached_answer",
    description: "Deterministic cached answer used as the final fallback.",
    schema: querySchema
  }
);
