import type { FinancialSeriesChartConfig } from "./schema";

const points = Array.from({ length: 30 }, (_, index) => ({ time: `2026-11-${String(index + 1).padStart(2, "0")}`, value: 45 + Math.sin(index / 3) * 12 }));
const candles = points.map(({ time, value }) => ({ time, open: value, high: value + 4, low: value - 3, close: value + 2 }));
function single(type: "candlestick" | "line" | "area" | "baseline" | "histogram"): FinancialSeriesChartConfig {
  return { title: `${type} · sample data`, series: [{ id: type, type, title: "Sample units", data: type === "candlestick" ? candles : points, ...(type === "baseline" ? { baseValue: 45 } : {}) }] };
}
export const financialSeriesFixtures = {
  candlestick: single("candlestick"), line: single("line"), area: single("area"), baseline: single("baseline"), histogram: single("histogram"),
  twoScales: { title: "Temperature and demand", series: [{ id: "temperature", title: "Temperature °C", type: "line", priceScaleId: "left", data: points }, { id: "demand", title: "Demand kWh", type: "area", priceScaleId: "right", color: "#9333ea", data: points.map(point => ({ ...point, value: point.value * 100 })) }] },
  annotations: { title: "Events and reference lines", series: [{ id: "index", title: "Sample index", type: "line", data: points, markers: [{ time: points[5].time, position: "aboveBar", shape: "arrowDown", color: "#dc2626", text: "Review" }, { time: points[15].time, position: "belowBar", shape: "circle", color: "#16a34a", text: "Event" }], priceLines: [{ price: 45, color: "#9333ea", title: "Reference", lineStyle: "dotted" }] }] },
  indicatorOnly: { title: "Indicator only · no OHLC", series: [{ id: "indicator", title: "Oscillator points", type: "baseline", baseValue: 0, data: points.map((point, index) => index < 5 ? { time: point.time } : { ...point, value: point.value - 45 }) }] },
  empty: { title: "Empty series", series: [] },
  invalid: { title: "Invalid order", series: [{ id: "invalid", type: "line", data: [points[1], points[0]] }] },
} satisfies Record<string, FinancialSeriesChartConfig>;
