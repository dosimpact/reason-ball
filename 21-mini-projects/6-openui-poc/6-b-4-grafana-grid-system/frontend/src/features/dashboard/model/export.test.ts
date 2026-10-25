import { it, expect } from "vitest";
import { canvasCsv } from "./export";
import { EMPTY, type Panel } from "@/entities/dashboard";
it("exports every tab, keeps source and protects spreadsheet formulas", () => {
  const p: Panel = {
    id: "a",
    title: "=bad",
    kind: "financial",
    tab_id: "other",
    layout: { x: 0, y: 0, w: 12, h: 12 },
    pinned: false,
    program: "",
    ui_state: {},
    source_artifact_id: null,
    query: { years: 10 },
    sources: [],
    data: {
      rows: [
        {
          period: "2025-12-31",
          value: 12,
          unit: "USD",
          growth_percent: null,
          url: "https://www.sec.gov/example",
        },
      ],
    },
  };
  const csv = canvasCsv({
    ...EMPTY,
    tabs: [...EMPTY.tabs, { id: "other", title: "Other" }],
    panels: [p],
  });
  expect(csv).toContain("'=bad");
  expect(csv).toContain("Other");
  expect(csv).toContain("https://www.sec.gov/example");
});

import { extractTables } from "./extract-tables";
const tablePanel: Panel = {
  id: "table",
  title: "Company comparison",
  kind: "openui",
  tab_id: "main",
  layout: { x: 0, y: 0, w: 12, h: 12 },
  pinned: false,
  program:
    'root = Card([Table([Col("Company", ["A", "B"]), Col("Revenue", [10, 20])])])',
  ui_state: {},
  source_artifact_id: null,
  query: {},
  sources: [{ title: "Report", url: "https://example.com/report" }],
  data: {},
};
it("extracts column-oriented Table into actual rows and CSV cells", () => {
  expect(extractTables(tablePanel)).toEqual([
    {
      columns: ["Company", "Revenue"],
      rows: [
        ["A", 10],
        ["B", 20],
      ],
    },
  ]);
  const csv = canvasCsv({ ...EMPTY, panels: [tablePanel] });
  expect(csv).toContain('"20"');
  expect(csv).toContain('"Revenue"');
  expect(csv).toContain("https://example.com/report");
  expect(csv).not.toContain("root =");
});
it("evaluates row-oriented tables using saved state and custom functions", () => {
  const panel = {
    ...tablePanel,
    program:
      '$now = 120\n$prior = 100\nroot = Card([IuiTable(["Now", "YoY"], [[$now, @YearOverYear($now, $prior)]])])',
    ui_state: { $now: 150 },
  };
  expect(extractTables(panel)).toEqual([
    { columns: ["Now", "YoY"], rows: [[150, 50]] },
  ]);
});
it("finds nested and multiple tables, including a named reference", () => {
  const panel = {
    ...tablePanel,
    program:
      'root = Card([VStack([one, IuiTable(["B"], [[2]])])])\none = Table([Col("A", [1])])',
  };
  expect(extractTables(panel)).toHaveLength(2);
});
it("reports unsupported or invalid content without exporting program text", () => {
  const csv = canvasCsv({
    ...EMPTY,
    panels: [{ ...tablePanel, program: "root = Missing()" }],
  });
  expect(csv).toContain("표 데이터를 평가하지 못했습니다");
  expect(csv).not.toContain("Missing");
});
it("preserves negative numbers and escapes formula strings, quotes and newlines", () => {
  const panel = {
    ...tablePanel,
    program:
      'root = Card([IuiTable(["Value"], [[-12], ["=SUM(1)"], ["line\\nquote\\\""]])])',
  };
  const csv = canvasCsv({ ...EMPTY, panels: [panel] });
  expect(csv).toContain('"-12"');
  expect(csv).not.toContain("'-12");
  expect(csv).toContain("'=SUM(1)");
  expect(csv).toContain('line\nquote""');
});

it("preserves source URLs embedded in the rendered Card", () => {
  const panel = {
    ...tablePanel,
    sources: [],
    program:
      'root = Card([Table([Col("Amount", [12])])], [{title:"Annual report",sourceName:"Company",url:"https://example.com/annual.pdf#page=4"}])',
  };
  const csv = canvasCsv({ ...EMPTY, panels: [panel] });
  expect(csv).toContain("https://example.com/annual.pdf#page=4");
});

import { extractDataBlocks } from "./extract-tables";
it.each([
  "LineChart",
  "BarChart",
  "AreaChart",
  "HorizontalBarChart",
  "RadarChart",
])("exports %s series with saved input and missing observations", (type) => {
  const panel = {
    ...tablePanel,
    program: `$value = 10\nroot = Card([${type}(["2024", "2025"], [Series("Revenue", [$value, -20]), Series("Profit", [3])])])`,
    ui_state: { $value: 150 },
  };
  expect(extractDataBlocks(panel)[0]).toEqual({
    visualization: type,
    columns: ["Series", "Category", "Value"],
    rows: [
      ["Revenue", "2024", 150],
      ["Revenue", "2025", -20],
      ["Profit", "2024", 3],
      ["Profit", "2025", ""],
    ],
  });
  const csv = canvasCsv({ ...EMPTY, panels: [panel] });
  expect(csv).toContain('"150"');
  expect(csv).toContain('"Revenue"');
  expect(csv).toContain(`"${type}"`);
  expect(csv).not.toContain("표·차트 데이터 없음");
});
it.each(["PieChart", "RadialChart", "SingleStackedBarChart"])(
  "exports %s category values without inventing missing labels",
  (type) => {
    const blocks = extractDataBlocks({
      ...tablePanel,
      program: `root = Card([${type}(["A"], [20, 30])])`,
    });
    expect(blocks[0].rows).toEqual([
      ["A", 20],
      ["", 30],
    ]);
  },
);
it("exports scatter coordinates and optional bubble size with axis labels", () => {
  const blocks = extractDataBlocks({
    ...tablePanel,
    program:
      'root = Card([ScatterChart([ScatterSeries("A", [Point(1, 2, 3), Point(4, 5)])], "Revenue", "Profit")])',
  });
  expect(blocks[0]).toEqual({
    visualization: "ScatterChart",
    columns: ["Series", "Revenue", "Profit", "Z"],
    rows: [
      ["A", 1, 2, 3],
      ["A", 4, 5, ""],
    ],
  });
});
it("exports generic Chart source data, multiple charts/tables and shared sources", () => {
  const panel = {
    ...tablePanel,
    sources: [],
    program:
      'root = Card([Chart("line", [{year:"2024",revenue:10},{year:"2025",profit:2}], "year", ["revenue", "profit"]), PieChart(["A"], [12]), Table([Col("Note", ["=formula"])])], [{title:"Source",sourceName:"Example",url:"https://example.com/chart"}])',
  };
  const blocks = extractDataBlocks(panel);
  expect(blocks).toHaveLength(3);
  expect(blocks[0].rows).toEqual([
    ["2024", 10, ""],
    ["2025", "", 2],
  ]);
  expect(
    blocks.every((block) =>
      block.sources?.includes("https://example.com/chart"),
    ),
  ).toBe(true);
  const csv = canvasCsv({ ...EMPTY, panels: [panel] });
  expect(csv).toContain('"Chart:line"');
  expect(csv).toContain('"PieChart"');
  expect(csv).toContain("'=formula");
  expect(extractTables(panel)).toHaveLength(1);
});
