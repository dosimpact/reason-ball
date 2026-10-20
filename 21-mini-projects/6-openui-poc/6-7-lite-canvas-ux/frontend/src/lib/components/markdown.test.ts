import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { inline } from "./markdown";
describe("supplier evidence identifiers", () => {
  it("preserves underscores inside campaign and product IDs", () => {
    expect(renderToStaticMarkup(inline("CAMP_004와 CAMP_003, VID_0022"))).toBe("CAMP_004와 CAMP_003, VID_0022");
  });
  it("still supports standalone emphasis", () => {
    expect(renderToStaticMarkup(inline("_강조_ **중요**"))).toBe("<em>강조</em> <strong>중요</strong>");
  });
});
