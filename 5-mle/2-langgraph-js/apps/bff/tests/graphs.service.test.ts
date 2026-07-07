import { describe, expect, it } from "vitest";
import { LangGraphRunnerAdapter } from "../src/graphs/adapters/langgraph-runner.adapter.js";
import { GraphsService } from "../src/graphs/graphs.service.js";

describe("GraphsService", () => {
  it("lists registered LangGraph examples", () => {
    const service = new GraphsService(new LangGraphRunnerAdapter());

    expect(service.listGraphs()).toContain("b_01_simple");
    expect(service.listGraphs()).toContain("b_25_approval_system");
  });

  it("invokes a deterministic graph through the BFF adapter", async () => {
    const service = new GraphsService(new LangGraphRunnerAdapter());

    const output = await service.invoke("b_01_simple", {
      input: { text: "hello langgraph", steps: [] }
    });

    expect(output).toEqual({
      text: "HELLO LANGGRAPH!",
      steps: ["uppercase", "exclaim"]
    });
  });
});
