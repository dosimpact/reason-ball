import type { ElementNode } from "@openuidev/lang-core";

export type ChartData = {
  visualization: string;
  columns: string[];
  rows: unknown[][];
};
const seriesCharts = new Set([
  "LineChart",
  "BarChart",
  "AreaChart",
  "HorizontalBarChart",
  "RadarChart",
]);
const sliceCharts = new Set([
  "PieChart",
  "RadialChart",
  "SingleStackedBarChart",
]);
function props(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && "props" in value
    ? (value.props as Record<string, unknown>)
    : {};
}
const array = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

/** Export evaluated observations, never infer absent points as zero. */
export function extractChart(node: ElementNode): ChartData | null {
  const p = node.props;
  const visualization = node.typeName;
  if (seriesCharts.has(visualization)) {
    const labels = array(p.labels);
    return {
      visualization,
      columns: [
        "Series",
        String(p.xLabel || "Category"),
        String(p.yLabel || "Value"),
      ],
      rows: array(p.series).flatMap((item) => {
        const series = props(item);
        const values = array(series.values);
        return Array.from(
          { length: Math.max(labels.length, values.length) },
          (_, i) => [series.category, labels[i] ?? "", values[i] ?? ""],
        );
      }),
    };
  }
  if (sliceCharts.has(visualization)) {
    const labels = array(p.labels),
      values = array(p.values);
    return {
      visualization,
      columns: ["Category", "Value"],
      rows: Array.from(
        { length: Math.max(labels.length, values.length) },
        (_, i) => [labels[i] ?? "", values[i] ?? ""],
      ),
    };
  }
  if (visualization === "ScatterChart") {
    return {
      visualization,
      columns: [
        "Series",
        String(p.xLabel || "X"),
        String(p.yLabel || "Y"),
        "Z",
      ],
      rows: array(p.datasets).flatMap((item) => {
        const series = props(item);
        return array(series.points).map((point) => {
          const coordinates = props(point);
          return [
            series.name,
            coordinates.x,
            coordinates.y,
            coordinates.z ?? "",
          ];
        });
      }),
    };
  }
  if (visualization === "Chart") {
    const rows = array(p.data) as Record<string, unknown>[];
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    return {
      visualization: `Chart:${p.type}`,
      columns,
      rows: rows.map((row) => columns.map((key) => row[key] ?? "")),
    };
  }
  return null;
}
