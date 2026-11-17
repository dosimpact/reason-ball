import { describe, expect, it } from "vitest";
import { extractCanvasItems } from "./extract-canvas-items";

describe("CanvasItem extraction", () => {
  it("retains only transitive Query and reactive dependencies for the selected child", () => {
    const program = [
      '$ticker = "AAPL"',
      'wanted = Query("technical_analysis_chart", {ticker: $ticker}, {bars: []})',
      'unused = Query("technical_analysis_chart", {ticker: "MSFT"}, {bars: []})',
      'chart = Text(wanted.symbol)',
      'root = Col([CanvasItem("report:chart", "차트", [Input($ticker, "종목"), chart]), CanvasItem("report:other", "별도", [Text(unused.symbol)])])',
    ].join("\n");
    const items = extractCanvasItems(program);
    expect(items).toHaveLength(2);
    expect(items[0].program).toContain('wanted = Query(');
    expect(items[0].program).toContain('$ticker = "AAPL"');
    expect(items[0].program).not.toContain('unused = Query(');
    expect(items[0].program).not.toContain('report:other');
    expect(items[0].program).toContain('root = Col([Input($ticker, "종목"), chart])');
  });

  it("ignores duplicate and invalid ids", () => {
    const items = extractCanvasItems('root = Col([CanvasItem("one", "First", [Text("A")]), CanvasItem("one", "Second", [Text("B")]), CanvasItem("", "Empty", [Text("C")])])');
    expect(items.map(item => item.title)).toEqual(["First"]);
  });
});
