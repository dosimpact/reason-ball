import { HumanMessage } from "@langchain/core/messages";
import { describe, expect, it } from "vitest";
import { buildDeterministicReflectionGraph } from "./01-reflection-graph.js";

describe("LECTURE-01 reflection graph", () => {
  it("alternates generate and reflect until the message limit is exceeded", async () => {
    const graph = buildDeterministicReflectionGraph();

    const output = await graph.invoke({
      messages: [new HumanMessage("Make this tweet better: LangGraph tool calling is underrated.")]
    });

    expect(output.messages.map((message) => message.text)).toEqual([
      "Make this tweet better: LangGraph tool calling is underrated.",
      "draft-1",
      "critique-1",
      "draft-2",
      "critique-2",
      "draft-3",
      "critique-3",
      "draft-4"
    ]);
  });

  it("can stop earlier when a lower max message threshold is injected", async () => {
    const graph = buildDeterministicReflectionGraph(2);

    const output = await graph.invoke({
      messages: [new HumanMessage("Rewrite this post.")]
    });

    expect(output.messages.map((message) => message.text)).toEqual([
      "Rewrite this post.",
      "draft-1",
      "critique-1",
      "draft-2"
    ]);
  });
});
