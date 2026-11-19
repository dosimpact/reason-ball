import { describe, expect, it } from "vitest";
import { createParser } from "@openuidev/lang-core";
import { OpenuiSystemPromptSpec as spec } from "@/shared/config";
import { financialSeriesChartSchema } from "@/shared/ui/intelligent-ui-data";
import { financialSeriesStories } from "./financial-series-stories";

describe("general financial series catalog", () => {
  it("offers five types and reusable scales, annotations and indicator-only combinations", () => {
    expect(financialSeriesStories).toHaveLength(9);
    for (const story of financialSeriesStories) {
      const code = story.examples[0].code;
      const config = JSON.parse(code.slice("config = ".length, code.indexOf(";\nroot")));
      expect(financialSeriesChartSchema.safeParse(config).success).toBe(true);
      const parsed = createParser(spec.schema, spec.root).parse(code);
      expect(parsed.root).toBeTruthy();
      expect(parsed.meta.errors).toEqual([]);
      expect(parsed.meta.unresolved).toEqual([]);
    }
  });
});
