import { describe, expect, it } from "vitest";
import { INTERRUPT, InMemoryStore, MemorySaver, isInterrupted } from "@langchain/langgraph";
import { buildStandaloneGraph as buildStandaloneCheckpointerGraph } from "./06-checkpointer.js";
import { buildGraph as buildMemoryGraph } from "./15-long-term-memory.js";
import { buildGraph as buildCommandInterruptGraph, createReviewCommand } from "./16-command-interrupt.js";
import { buildGraph as buildCustomStreamingGraph } from "./18-custom-streaming.js";
import { buildGraph as buildApprovalSystemGraph, createApprovalCommand } from "./25-approval-system.js";

function assertIncludesAll(actual: string[], expected: string[]) {
  for (const item of expected) {
    expect(actual).toContain(item);
  }
}

describe("selected graph-basic migrations", () => {
  it("GRAPH-06 compiles with an explicit memory checkpointer", () => {
    expect(buildStandaloneCheckpointerGraph()).toBeTruthy();
  });

  it("GRAPH-19 stores and recalls user-scoped long-term memories", async () => {
    const store = new InMemoryStore();
    const graph = buildMemoryGraph({ store });

    await graph.invoke({ user_id: "u1", fact: "u1 favorite color is blue." });
    await graph.invoke({ user_id: "u1", fact: "u1 lives in Seoul." });

    const recalled = await graph.invoke({ user_id: "u1" });
    assertIncludesAll(recalled.recalled, ["u1 favorite color is blue.", "u1 lives in Seoul."]);

    const isolated = await graph.invoke({ user_id: "u2" });
    expect(isolated.recalled).toEqual([]);
  });

  it("GRAPH-20 interrupts for review and resumes with Command approval", async () => {
    const graph = buildCommandInterruptGraph({ checkpointer: new MemorySaver() });
    const config = { configurable: { thread_id: "graph-20-review" } };

    const interrupted = await graph.invoke({ topic: "LangGraph" }, config);
    expect(isInterrupted<unknown>(interrupted)).toBe(true);

    if (!isInterrupted(interrupted)) {
      throw new Error("Expected command interrupt");
    }

    const payload = interrupted[INTERRUPT][0]?.value as { question?: string; options?: string[] };
    expect(payload.question).toBe("Approve this draft?");
    expect(payload.options).toEqual(["approve", "reject", "edit"]);

    const resumed = await graph.invoke(createReviewCommand("approve"), config);
    expect(resumed.final).toBe("PUBLISHED: [Draft] An article about LangGraph.");
  });

  it("GRAPH-22 emits custom progress events and returns the processed result", async () => {
    const graph = buildCustomStreamingGraph();
    const events: unknown[] = [];
    const stream = await graph.stream({ item_id: "abc-123" }, { streamMode: "custom" });

    for await (const event of stream) {
      events.push(event);
    }

    expect(events.some((event) => isEventMatch(event, { node: "download", msg: "chunk 1/3" }))).toBe(true);
    expect(events.some((event) => isEventMatch(event, { node: "process", phase: "validate" }))).toBe(true);
    expect(events.some((event) => isEventMatch(event, { node: "upload", msg: "done" }))).toBe(true);

    const output = await graph.invoke({ item_id: "abc-123" });
    expect(output.result).toBe("processed:abc-123");
  });

  it("GRAPH-29 auto-executes low-risk actions and interrupts high-risk actions", async () => {
    const graph = buildApprovalSystemGraph({ checkpointer: new MemorySaver() });

    const lowRisk = await graph.invoke(
      { action: "read customer profile" },
      { configurable: { thread_id: "graph-29-low-risk" } }
    );
    expect(lowRisk.risk).toBe("low");
    expect(lowRisk.approved).toBe(true);
    expect(lowRisk.execution_result).toBe("EXECUTED: read customer profile");

    const config = { configurable: { thread_id: "graph-29-approval" } };
    const interrupted = await graph.invoke({ action: "delete production database backup" }, config);
    expect(isInterrupted(interrupted)).toBe(true);

    const rejected = await graph.invoke(createApprovalCommand("reject"), config);
    expect(rejected.approved).toBe(false);
    expect(rejected.decision_reason).toBe("human rejected action");
    expect(rejected.execution_result).toBe("BLOCKED: delete production database backup");
  });
});

function isEventMatch(event: unknown, expected: Record<string, unknown>) {
  if (!event || typeof event !== "object") {
    return false;
  }

  return Object.entries(expected).every(([key, value]) => (event as Record<string, unknown>)[key] === value);
}
