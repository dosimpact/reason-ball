import { describe, expect, it } from "vitest";
import { createParser } from "@openuidev/lang-core";
import { OpenuiSystemPromptSpec as spec } from "@/shared/config";
import { financialSnapshotSchema } from "@/shared/ui/intelligent-ui/components/financial/financial-schema";
import { chartIndicators } from "@/shared/ui/intelligent-ui/components/financial/financial-indicators";
import { financialStories } from "./financial-stories";

describe("financial chart showcases", () => {
  it("uses valid snapshots and OpenUI programs for every chart combination", () => {
    expect(financialStories).toHaveLength(5);
    const expected = [[], ["SMA"], ["RSI"], ["MACD"], ["SMA", "RSI", "MACD"]];
    financialStories.forEach((story, index) => {
      const code = story.examples[0].code;
      const raw = code.slice("snapshot = ".length, code.indexOf(";\nroot"));
      const snapshot = financialSnapshotSchema.parse(JSON.parse(raw));
      expect(chartIndicators(snapshot).map(indicator => indicator.name)).toEqual(expected[index]);
      const parsed = createParser(spec.schema, spec.root).parse(code);
      expect(parsed.root).toBeTruthy();
      expect(parsed.meta.errors).toEqual([]);
      expect(parsed.meta.unresolved).toEqual([]);
    });
  });
});
