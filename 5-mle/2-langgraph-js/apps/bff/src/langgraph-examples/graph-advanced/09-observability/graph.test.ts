import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { describe, expect, it } from "vitest";
import { buildGraph, metricsUpdateForResponse } from "./graph.js";
import { estimateCost } from "./metrics.js";

describe("ADV-09 observability graph", () => {
  it("accumulates metrics from a deterministic agent node", async () => {
    const deterministicGraph = buildGraph({
      agentNode: (state) => {
        const response = new AIMessage({ content: "tracked response" });
        Object.assign(response, {
          usage_metadata: {
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: 150
          }
        });
        return metricsUpdateForResponse(state, response, "fast");
      }
    });

    const output = await deterministicGraph.invoke({
      messages: [new HumanMessage("ping")]
    });

    expect(output.messages.at(-1)?.content).toBe("tracked response");
    expect(output.metrics).toHaveLength(1);
    expect(output.metrics[0]).toMatchObject({
      model: "fast",
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      costUsd: estimateCost("fast", 100, 50)
    });
    expect(output.totalCostUsd).toBe(estimateCost("fast", 100, 50));
  });
});
