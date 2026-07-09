import { describe, expect, it } from "vitest";
import {
  collectToolCalls,
  contentToText,
  evaluateOutputs,
  extractAnswerText,
  ruleBasedCheck,
  toolTraceCheck
} from "./eval.js";
import type { GoldenDatasetRow } from "./golden-dataset.js";

describe("ADV-08 eval harness helpers", () => {
  it("extracts answer text from string and block content", () => {
    expect(extractAnswerText({ content: "plain answer" })).toBe("plain answer");
    expect(
      contentToText([
        { type: "text", text: "LangGraph" },
        { type: "text", text: "stateful" }
      ])
    ).toBe("LangGraph stateful");
  });

  it("collects tool calls from LangChain and OpenAI-compatible shapes", () => {
    const calls = collectToolCalls([
      {
        content: "",
        tool_calls: [{ name: "calculate", args: { expression: "2 + 2" } }]
      },
      {
        content: "",
        additional_kwargs: {
          tool_calls: [{ function: { name: "lookup_info" } }]
        }
      }
    ]);

    expect(calls).toEqual(["calculate", "lookup_info"]);
  });

  it("checks keyword and tool trace rules deterministically", () => {
    expect(ruleBasedCheck("LangGraph is stateful", ["langgraph", "STATEFUL"])).toBe(true);
    expect(ruleBasedCheck("LangGraph is stateful", ["FastAPI"])).toBe(false);
    expect(ruleBasedCheck("any answer", [])).toBe(true);

    expect(toolTraceCheck(["lookup_info", "calculate"], ["calculate"])).toBe(true);
    expect(toolTraceCheck(["lookup_info"], ["calculate"])).toBe(false);
  });

  it("evaluates graph outputs without an LLM judge", () => {
    const dataset: GoldenDatasetRow[] = [
      {
        id: "lookup-pass",
        input: "langgraph 가 뭐야?",
        expectedKeywords: ["LangGraph", "stateful"],
        expectedToolCalls: ["lookup_info"]
      },
      {
        id: "calc-fail",
        input: "2 + 2?",
        expectedKeywords: ["4"],
        expectedToolCalls: ["calculate"]
      }
    ];

    const report = evaluateOutputs(
      dataset,
      [
        {
          messages: [
            { content: "question" },
            { content: "", tool_calls: [{ name: "lookup_info" }] },
            { content: "LangGraph is stateful." }
          ]
        },
        {
          messages: [
            { content: "question" },
            { content: "", tool_calls: [{ name: "lookup_info" }] },
            { content: "I do not know." }
          ]
        }
      ],
      { timestamp: "2026-07-07T00:00:00.000Z" }
    );

    expect(report.summary).toMatchObject({
      total: 2,
      pass: 1,
      fail: 1,
      ruleBasedPass: 1,
      toolTracePass: 1,
      useJudge: false
    });
    expect(report.rows[0]?.pass).toBe(true);
    expect(report.rows[1]?.pass).toBe(false);
  });
});
