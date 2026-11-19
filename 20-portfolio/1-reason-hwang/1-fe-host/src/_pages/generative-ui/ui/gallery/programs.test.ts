import { createParser } from "@openuidev/lang-core";
import { describe, expect, it } from "vitest";
import { OpenuiSystemPromptSpec as spec } from "@/shared/config";
import { exampleDashboard, exampleShoppingList, exampleSteps, exampleTrip } from "./prompt-examples";
import { compositionPrograms } from "./composition-programs";
import { programs } from "./programs";
import { toolPrograms } from "./tool-programs";
import { demoTools } from "./demo-data";

const all = [...compositionPrograms, ...toolPrograms, ...programs,
  { id: "example-list", code: exampleShoppingList },
  { id: "example-trip", code: exampleTrip },
  { id: "example-steps", code: exampleSteps },
  { id: "example-dashboard", code: exampleDashboard },
];

describe("migrated gallery", () => {
  it("preserves all original examples with unique anchors", () => {
    expect(all).toHaveLength(45);
    expect(new Set(all.map(program => program.id)).size).toBe(all.length);
  });
  it.each(all)("parses $id against the host library", ({ code }) => {
    const result = createParser(spec.schema, spec.root).parse(code);
    expect(result.root).not.toBeNull();
    expect(result.meta.errors.map(error => error.message)).toEqual([]);
    expect(result.meta.unresolved).toEqual([]);
    expect(result.meta.orphaned).toEqual([]);
  });
  it("provides local data for all dashboard queries", async () => {
    for (const name of ["get_orders", "get_tickets", "get_traffic"]) {
      const data = await demoTools[name]({ days: 7 });
      expect(data).toHaveProperty("rows");
    }
  });
});
