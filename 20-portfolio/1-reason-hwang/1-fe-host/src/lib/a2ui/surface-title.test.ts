import { describe, expect, it } from "vitest";
import { secSurfaceTitle } from "../../features/a2ui-demo/surface-title";

const batch = (components: Record<string, string>[]) => [{ updateComponents: { surfaceId: "sec-canvas-test", components } }];

describe("SEC surface context", () => {
  it("replaces the selected company's title when Canvas is reused for a new search", () => {
    const selected = batch([{ id: "stage", text: "3 · 분석할 내용 선택" }, { id: "selected-company", text: "Coupang · CPNG" }]);
    const reset = batch([{ id: "stage", text: "1 · 회사 선택" }, { id: "company-row-0", title: "Apple Inc." }]);
    expect(secSurfaceTitle("sec-canvas-test", [selected, reset], false)).toBe("Apple Inc.");
    const empty = batch([{ id: "stage", text: "1 · 회사 선택" }]);
    expect(secSurfaceTitle("sec-canvas-test", [selected, reset, empty], false)).toBe("1 · 회사 선택");
    expect(secSurfaceTitle("sec-canvas-test", [selected], true)).toBe("Coupang · CPNG · 3 · 분석할 내용 선택");
  });
});
