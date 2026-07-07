import { HumanMessage } from "@langchain/core/messages";
import { describe, expect, it } from "vitest";
import { subgraphGraph } from "./04-subgraph.js";
import { mapReduceGraph } from "./08-map-reduce.js";
import { parallelBranchesGraph } from "./14-parallel-branches.js";
import {
  getAttemptCount,
  PermanentError,
  resetAttemptCounter,
  retryPolicyGraph
} from "./19-retry-policy.js";

describe("GRAPH-04 subgraph", () => {
  it("routes translation requests through the translator subgraph", async () => {
    const output = await subgraphGraph.invoke({
      messages: [new HumanMessage("Hello, how are you today? (한국어로)")]
    });

    expect(output.intent).toBe("translate");
    expect(output.steps).toEqual(["classify", "detect_lang", "translate"]);
    expect(output.messages.filter((message) => message.type === "human")).toHaveLength(1);
    expect(output.messages.some((message) => message.text.includes("[detect_lang]"))).toBe(true);
    expect(output.messages.some((message) => message.text.includes("[translate en->ko]"))).toBe(true);
  });

  it("routes summary requests through the summarizer subgraph", async () => {
    const output = await subgraphGraph.invoke({
      messages: [
        new HumanMessage(
          "Summarize: LangGraph builds stateful workflows with nodes, edges, persistence, streaming, and human review."
        )
      ]
    });

    expect(output.intent).toBe("summarize");
    expect(output.steps).toEqual(["classify", "summarize"]);
    expect(output.messages.at(-1)?.text).toContain("[summary]");
  });
});

describe("GRAPH-08 map-reduce", () => {
  it("fans out topics and reduces worker results into an answer", async () => {
    const output = await mapReduceGraph.invoke({
      topics: ["langgraph", "unknown_topic"]
    });

    expect(output.results).toHaveLength(2);
    expect(output.results.map((result) => result.topic).sort()).toEqual(["langgraph", "unknown_topic"]);
    expect(output.answer).toContain("- langgraph:");
    expect(output.answer).toContain("No specific information found for 'unknown_topic'.");
  });

  it("handles an empty topic list by still producing an empty aggregate answer", async () => {
    const output = await mapReduceGraph.invoke({ topics: [] });

    expect(output.results).toEqual([]);
    expect(output.answer).toBe("");
  });
});

describe("GRAPH-18 parallel branches", () => {
  it("joins static branches into a deterministic report", async () => {
    const output = await parallelBranchesGraph.invoke({
      text: "LangGraph is amazing for building stateful LLM apps. I love it!"
    });

    expect(output.artifacts).toHaveLength(3);
    expect(output.report.split("\n")[0]).toMatch(/^- summary:/);
    expect(output.report).toContain("- tags:");
    expect(output.report).toContain("- sentiment: positive");
  });
});

describe("GRAPH-23 retry policy", () => {
  it("retries transient errors and succeeds on the third attempt", async () => {
    resetAttemptCounter();

    const output = await retryPolicyGraph.invoke({ target: "ok" });

    expect(output.attempts).toBe(3);
    expect(output.result).toBe("OK on attempt #3");
    expect(output.steps).toEqual(["flaky_call:3", "finalize"]);
    expect(getAttemptCount()).toBe(3);
  });

  it("does not retry permanent errors", async () => {
    resetAttemptCounter();

    await expect(retryPolicyGraph.invoke({ target: "always_fail" })).rejects.toThrow(PermanentError);
    expect(getAttemptCount()).toBe(1);
  });
});
