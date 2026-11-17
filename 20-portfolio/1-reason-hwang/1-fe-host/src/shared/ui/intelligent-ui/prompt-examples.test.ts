import { describe, expect, it } from "vitest";
import { createParser } from "@openuidev/lang-core";
import { OpenuiSystemPromptSpec as spec } from "@/shared/config";
import { financialPromptExamples } from "./components/financial/prompt-examples";
import { canvasItemPromptExamples } from "./components/canvas-item/prompt-examples";

describe("shared catalog composition examples", () => {
  it.each([...financialPromptExamples, ...canvasItemPromptExamples])("parses a complete example %#", program => {
    const parsed = createParser(spec.schema, spec.root).parse(program);
    expect(parsed.meta.errors).toEqual([]);
    expect(parsed.meta.unresolved).toEqual([]);
    expect(parsed.meta.incomplete).toBe(false);
    expect(parsed.root).toBeTruthy();
  });
});
