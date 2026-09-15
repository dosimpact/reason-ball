import { describe, expect, it } from "vitest";
import { catalog, exampleContent, validateDraft } from "../src/app/lib/catalog";
import { typeIds, figmaSpec } from "../src/entities/document/model/schema";
describe("Catalog", () => {
  it("returns plain JSON values for the client workspace", () => {
    const assertPlainJson = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(assertPlainJson);
        return;
      }
      if (value && typeof value === "object") {
        expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
        Object.values(value).forEach(assertPlainJson);
      }
    };

    assertPlainJson(catalog());
  });

  it("preserves multiple screen references and widget requirements", () => {
    const content = figmaSpec.parse(exampleContent("figma-requirements"));
    content.widgets[0].figmaRefs = [
      {
        screenName: "Campaign",
        url: "https://example.com/figma/campaign",
        nodeId: "1:1",
      },
      {
        screenName: "Budget",
        url: "https://example.com/figma/budget",
        nodeId: "1:2",
      },
    ];
    const result = validateDraft({
      type: "figma-requirements",
      title: "Widget",
      scope: "budget",
      content,
    });
    expect(result.content).toEqual(content);
    expect(content.widgets[0].surfaces.length).toBeGreaterThan(0);
    expect(content.widgets[0].inputValidation.length).toBeGreaterThan(0);
    expect(content.widgets[0].funnel.length).toBeGreaterThan(0);
    content.widgets[0].figmaRefs[0].url = "javascript:alert(1)";
    expect(() => figmaSpec.parse(content)).toThrow();
  });
  it.each(typeIds)("validates example %s and publishes its schema", (type) => {
    const content = exampleContent(type);
    expect(
      validateDraft({ type, title: "Example", scope: "budget", content }).type,
    ).toBe(type);
    expect(
      catalog().find((e) => e.type === type)?.contentSchema,
    ).toHaveProperty("type", "object");
  });
  it("rejects arbitrary document types, missing scopes and mismatched content", () => {
    expect(() => validateDraft({ type: "anything" })).toThrow("카탈로그");
    expect(() =>
      validateDraft({
        type: "db-entity",
        title: "x",
        content: exampleContent("db-entity"),
      }),
    ).toThrow();
    expect(() =>
      validateDraft({
        type: "bff-api-spec",
        title: "x",
        scope: "b",
        content: exampleContent("db-entity"),
      }),
    ).toThrow();
  });
  it("uses the same existing/change API contract for both layers", () => {
    for (const type of ["upstream-api-spec", "bff-api-spec"] as const) {
      const content = {
        ...(exampleContent(type) as object),
        specKind: "change",
        changeReason: "예산 필드 추가",
      };
      expect(
        validateDraft({ type, title: "변경", scope: "budget", content })
          .content,
      ).toMatchObject({ specKind: "change" });
    }
  });
});
