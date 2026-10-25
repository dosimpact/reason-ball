import { createParser, type LibrarySpec } from "@openuidev/lang-core";
import { describe, expect, it } from "vitest";
import spec from "@/generated/spec.json";
import stories from "./stories.json";
import { run } from "@/lib/functions/__tests__/run";
const library: LibrarySpec = spec;
const parser = createParser(library.schema!, library.root);
describe("lib-story catalog coverage", () => {
  for (const category of ["components", "functions", "actions"] as const) {
    it(`covers every registered ${category}`, () => {
      expect(stories.filter(story => story.category === category).map(story => story.name).sort()).toEqual(Object.keys(spec[category]).sort());
    });
  }
  it("keeps anchors unique and provides multiple examples", () => {
    expect(new Set(stories.map(story => story.id)).size).toBe(stories.length);
    expect(stories.every(story => story.examples.length >= 2)).toBe(true);
  });
  it("uses only Col in the Col examples", () => {
    for (const example of stories.find(story => story.name === "Col")!.examples) {
      expect(example.code.match(/\b[A-Z]\w*(?=\()/g)?.every(name => name === "Col")).toBe(true);
    }
  });
});
for (const story of stories) {
  describe(story.id, () => {
    for (const example of story.examples) {
      it(example.title, () => {
        const result = parser.parse(example.code);
        expect(result.root).not.toBeNull();
        expect(result.meta.errors.map(error => error.message)).toEqual([]);
        expect(result.meta.unresolved).toEqual([]);
        expect(result.meta.orphaned).toEqual([]);
        if (story.category === "functions" && example.code.includes("\nresult = ")) {
          const executed = run("result", example.code.split("\n").slice(1).join("\n"));
          expect(executed.parseErrors).toEqual([]);
          if (story.name === "Sqrt" && example.code.includes("@Sqrt(-1)")) {
            expect(executed.value).toBeNull();
            expect(executed.runtimeErrors.length).toBeGreaterThan(0);
          } else {
            expect(executed.runtimeErrors).toEqual([]);
            expect(executed.value).not.toBeUndefined();
          }
        }
      });
    }
  });
}
