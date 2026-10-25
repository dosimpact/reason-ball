import { extractDataBlocks, exportCellValue } from "./extract-tables";
import type { Dashboard } from "@/entities/dashboard";

// 수식으로 해석될 수 있는 CSV 텍스트를 이스케이프하고 출처와 조회 조건을 함께 내보냅니다.
function cell(value: unknown) {
  let text = String(value ?? "");
  if (typeof value !== "number" && /^[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function canvasCsv(state: Dashboard) {
  const rows: unknown[][] = [
    [
      "Panel",
      "Tab",
      "Period",
      "Value",
      "Unit",
      "YoY percent",
      "Source",
      "Query",
      "Content / status",
      "Data block",
      "Row",
      "Column",
      "Visualization",
    ],
  ];
  for (const p of state.panels) {
    const tab = state.tabs.find((t) => t.id === p.tab_id)?.title ?? p.tab_id;
    const data = (p.data.rows ?? []) as Record<string, unknown>[];
    if (data.length)
      for (const r of data)
        rows.push([
          p.title,
          tab,
          r.period,
          r.value,
          r.unit,
          r.growth_percent,
          r.url,
          JSON.stringify(p.query),
          "",
        ]);
    else {
      const source = p.sources.map((s) => s.url).join(" ");
      try {
        const tables = extractDataBlocks(p);
        for (const [tableIndex, table] of tables.entries()) {
          const tableSource = [
            ...new Set([source, ...(table.sources ?? [])].filter(Boolean)),
          ].join(" ");
          for (const [rowIndex, row] of table.rows.entries()) {
            table.columns.forEach((column, columnIndex) =>
              rows.push([
                p.title,
                tab,
                "",
                exportCellValue(row[columnIndex]),
                "",
                "",
                tableSource,
                JSON.stringify(p.query),
                "",
                tableIndex + 1,
                rowIndex + 1,
                column,
                table.visualization ?? "Table",
              ]),
            );
          }
        }
        if (!tables.length || tables.every((table) => !table.rows.length)) {
          rows.push([
            p.title,
            tab,
            "",
            "",
            "",
            "",
            source,
            JSON.stringify(p.query),
            "표·차트 데이터 없음 — 전체 내용은 PDF 또는 JSON으로 내보내세요.",
          ]);
        }
      } catch (error) {
        rows.push([
          p.title,
          tab,
          "",
          "",
          "",
          "",
          source,
          JSON.stringify(p.query),
          (error as Error).message,
        ]);
      }
    }
  }
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        Array.from({ length: rows[0].length }, (_, i) => cell(row[i])).join(
          ",",
        ),
      )
      .join("\r\n")
  );
}
export function downloadDashboard(state: Dashboard, format: "json" | "csv") {
  const body =
    format === "json"
      ? JSON.stringify(
          {
            schema_version: 1,
            exported_at: new Date().toISOString(),
            dashboard: state,
          },
          null,
          2,
        )
      : canvasCsv(state);
  const url = URL.createObjectURL(
    new Blob([body], {
      type: format === "json" ? "application/json" : "text/csv;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `sec-dashboard-${new Date().toISOString().slice(0, 10)}.${format}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
