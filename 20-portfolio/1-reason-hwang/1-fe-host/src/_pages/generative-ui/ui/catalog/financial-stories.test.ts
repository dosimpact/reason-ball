import { describe, expect, it } from "vitest";
import { createParser } from "@openuidev/lang-core";
import { OpenuiSystemPromptSpec as spec } from "@/shared/config";
import { financialSnapshotSchema } from "@/shared/ui/intelligent-ui-data";
import { chartIndicators } from "@/shared/ui/intelligent-ui-data";
import { financialStories } from "./financial-stories";

describe("financial chart showcases", () => {
  it("uses valid snapshots and OpenUI programs for every chart combination", () => {
    expect(financialStories).toHaveLength(9);
    const expected = [[], ["SMA"], ["RSI"], ["MACD"], ["SMA", "RSI", "MACD"]];
    financialStories.forEach((story, index) => {
      const code = story.examples[0].code;
      if (index < 8) {
      const raw = code.slice("snapshot = ".length, code.indexOf(";\nroot"));
      const snapshot = financialSnapshotSchema.parse(JSON.parse(raw));
      if (index < 5) expect(chartIndicators(snapshot).map(indicator => indicator.name)).toEqual(expected[index]);
      else expect(snapshot.schemaVersion).toBe(2);
      }
      const parsed = createParser(spec.schema, spec.root).parse(code);
      expect(parsed.root).toBeTruthy();
      expect(parsed.meta.errors).toEqual([]);
      expect(parsed.meta.unresolved).toEqual([]);
    });
  });
});
