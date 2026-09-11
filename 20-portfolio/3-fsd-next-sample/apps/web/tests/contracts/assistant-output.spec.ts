import { expect, test } from "@playwright/test";
import { hasAssistantOutput } from "../../src/app/api/ai/chat/_lib/assistant-output";

test("empty provider output and stream bookkeeping are not successful answers", () => {
  expect(hasAssistantOutput([])).toBe(false);
  expect(hasAssistantOutput([{ type: "step-start" }])).toBe(false);
  expect(hasAssistantOutput([{ type: "text", text: " \n" }])).toBe(false);
});

test("text and non-text output preserve valid provider responses", () => {
  expect(hasAssistantOutput([{ type: "step-start" }, { type: "text", text: "Hello" }])).toBe(true);
  expect(hasAssistantOutput([{ type: "dynamic-tool", toolName: "weather", toolCallId: "call-1", state: "input-available", input: { city: "Seoul" } }])).toBe(true);
});
