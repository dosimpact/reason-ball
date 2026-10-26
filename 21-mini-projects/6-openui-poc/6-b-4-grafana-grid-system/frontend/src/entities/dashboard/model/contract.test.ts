import { describe, it, expect } from "vitest";
import { createParser } from "@openuidev/lang-core";
import { catalogSpec as spec } from "@/shared/ui/openui";
import { dashboardSchema, EMPTY } from "./types";
import { stateDefaultErrors } from "./program-validation";
const parser = createParser(spec.schema, spec.root);
describe("dashboard catalog contracts", () => {
  it("supports reactive YoY and host panel action with original catalog", () => {
    const result = parser.parse(
      'root = Card([VStack([IuiText(@YearOverYear($current, $prior)), IuiInput($current, "Current", "number"), IuiButton("Focus", @FocusPanel("real-panel-id"))])])\n$current = 120\n$prior = 100',
    );
    expect(result.root).not.toBeNull();
    expect(result.meta.errors.filter((e) => e.severity !== "warning")).toEqual(
      [],
    );
    expect(result.meta.unresolved).toEqual([]);
  });
  it("rejects invalid incoming dashboard without losing prior state", () => {
    expect(
      dashboardSchema.safeParse({ ...EMPTY, panels: [{ id: "bad" }] }).success,
    ).toBe(false);
    expect(dashboardSchema.safeParse(EMPTY).success).toBe(true);
  });
});

it("rejects computed mutable defaults but accepts reactive named expressions", () => {
  const invalid = parser.parse(
    "$current = 120\n$prior = 100\n$rate = @YearOverYear($current, $prior)\nroot = Card([IuiText($rate)])",
  );
  expect(stateDefaultErrors(invalid.stateDeclarations)[0]).toContain("$rate");
  const valid = parser.parse(
    "$current = 120\n$prior = 100\nrate = @YearOverYear($current, $prior)\nroot = Card([IuiText(rate)])",
  );
  expect(stateDefaultErrors(valid.stateDeclarations)).toEqual([]);
  expect(valid.meta.errors).toEqual([]);
});

import { renderedArtifactIds } from "../ui/library";
it("counts only artifacts reachable from root so the fallback does not duplicate them", () => {
  expect(
    renderedArtifactIds('root = Card([DashboardArtifact("one")])'),
  ).toEqual(["one"]);
  expect(
    renderedArtifactIds(
      'root = Card([IuiText("done")])\norphan = DashboardArtifact("two")',
    ),
  ).toEqual([]);
  expect(
    renderedArtifactIds(
      'root = Card([item])\nitem = DashboardArtifact("three")',
    ),
  ).toEqual(["three"]);
});

import { componentPlacementErrors } from "./program-validation";
it("rejects data-only nodes in visual children but accepts their registered parent", () => {
  const schema = spec.schema;
  expect(
    componentPlacementErrors(
      parser.parse(
        'root=Card([SectionItem("risk", "Risk", [TextContent("Body")])])',
      ).root,
      schema,
    )[0],
  ).toContain("SectionItem");
  expect(
    componentPlacementErrors(
      parser.parse(
        'root=Card([SectionBlock([SectionItem("risk", "Risk", [TextContent("Body")])])])',
      ).root,
      schema,
    ),
  ).toEqual([]);
  expect(
    componentPlacementErrors(
      parser.parse('root=Card([Series("Revenue", [10])])').root,
      schema,
    )[0],
  ).toContain("Series");
  expect(
    componentPlacementErrors(
      parser.parse(
        'root=Card([LineChart(["2025"], [Series("Revenue", [10])])])',
      ).root,
      schema,
    ),
  ).toEqual([]);
});

import { blockingProgramErrors } from "./program-validation";
it("rejects warnings that silently discard content or coerce invalid props", () => {
  const result = parser.parse(
    'root=Card([TextContent("First", "Second paragraph", "Dropped paragraph")])',
  );
  expect(
    blockingProgramErrors(result.meta.errors).map((error) => error.code),
  ).toEqual(expect.arrayContaining(["type-mismatch", "excess-args"]));
});

import { sourcesFromRoot } from "./program-validation";
it("extracts reachable citations and excludes orphan declarations", () => {
  const result = parser.parse(`root = Card([TextContent("Evidence")], citations)
  citations = [{title: "Report", sourceName: "Company", url: "https://example.com/report#page=3"}, {title: "Report", sourceName: "Company", url: "https://example.com/report#page=3"}]
  orphan = Card([], [{title: "Unused", sourceName: "Other"}])`);
  expect(sourcesFromRoot(result.root)).toEqual([{title: "Report", sourceName: "Company", url: "https://example.com/report#page=3"}]);
  expect(sourcesFromRoot(parser.parse('root = Card([])').root)).toEqual([]);
});
