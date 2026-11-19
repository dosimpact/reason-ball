"use client";

import { defineComponent } from "@openuidev/react-lang";
import { AreaSeries, BaselineSeries, CandlestickSeries, ColorType, HistogramSeries, LineSeries, LineStyle, createChart, createSeriesMarkers, type IChartApi, type ISeriesApi, type SeriesType } from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod/v4";
import { financialSeriesChartSchema, type FinancialSeries, type FinancialSeriesChartConfig } from "./schema";
export { financialSeriesChartSchema, type FinancialSeriesChartConfig } from "./schema";

function validateColor(color: string) {
  if (!CSS.supports("color", color) || /(?:var\(|currentcolor|inherit|initial|unset)/i.test(color)) throw new Error(`Unsupported color: ${color}`);
  const probe = document.createElement("span");
  probe.style.color = color;
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  // Lightweight Charts 5.1 accepts browser-normalized RGB(A) colors only.
  if (!/^rgba?\(/.test(computed)) throw new Error(`Use a hex, RGB or named color instead of: ${color}`);
}

function addSeries(chart: IChartApi, descriptor: FinancialSeries) {
  const color = descriptor.color ?? "#2563eb";
  const common = { title: descriptor.title ?? descriptor.id, priceScaleId: descriptor.priceScaleId ?? "right" };
  switch (descriptor.type) {
    case "candlestick": return chart.addSeries(CandlestickSeries, { ...common, ...(descriptor.color ? { upColor: color, downColor: color, wickUpColor: color, wickDownColor: color } : {}), borderVisible: false });
    case "area": return chart.addSeries(AreaSeries, { ...common, lineColor: color, topColor: color, bottomColor: "transparent" });
    case "baseline": return chart.addSeries(BaselineSeries, { ...common, baseValue: { type: "price", price: descriptor.baseValue ?? 0 }, ...(descriptor.color ? { topLineColor: color, bottomLineColor: color, topFillColor1: color, topFillColor2: "transparent", bottomFillColor1: "transparent", bottomFillColor2: color } : {}) });
    case "histogram": return chart.addSeries(HistogramSeries, { ...common, color });
    default: return chart.addSeries(LineSeries, { ...common, color });
  }
}

function populateChart(chart: IChartApi, config: FinancialSeriesChartConfig) {
  config.series.forEach(descriptor => {
    // Validation above guarantees the data shape matches the chosen series type.
    const series = addSeries(chart, descriptor) as ISeriesApi<SeriesType>;
    series.setData(descriptor.data);
    if (descriptor.markers?.length) createSeriesMarkers(series, descriptor.markers);
    descriptor.priceLines?.forEach(line => series.createPriceLine({ ...line, title: line.title ?? "", lineStyle: line.lineStyle === "solid" ? LineStyle.Solid : line.lineStyle === "dotted" ? LineStyle.Dotted : LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true }));
  });
  chart.timeScale().fitContent();
}

function SeriesCanvas({ config }: { config: FinancialSeriesChartConfig }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let chart: IChartApi | undefined;
    let resize: ResizeObserver | undefined;
    let themeObserver: MutationObserver | undefined;
    setError("");
    try {
      for (const descriptor of config.series) {
        const colors = [descriptor.color, ...descriptor.markers?.map(marker => marker.color) ?? [], ...descriptor.priceLines?.map(line => line.color) ?? []];
        for (const color of colors) {
          if (color !== undefined) validateColor(color);
        }
      }
      chart = createChart(element, { width: element.clientWidth, height: config.height ?? 360, layout: { attributionLogo: true }, leftPriceScale: { visible: config.series.some(series => series.priceScaleId === "left") }, rightPriceScale: { visible: config.series.some(series => series.priceScaleId !== "left") } });
      populateChart(chart, config);
      const applyTheme = () => {
        const localTheme = element.closest("[data-openui-theme], [data-theme]");
        const selectedTheme = localTheme?.getAttribute("data-openui-theme") ?? localTheme?.getAttribute("data-theme");
        const dark = selectedTheme ? selectedTheme === "dark" : document.documentElement.classList.contains("dark") || document.documentElement.dataset.theme === "dark";
        chart?.applyOptions({ layout: { background: { type: ColorType.Solid, color: dark ? "#15171b" : "#ffffff" }, textColor: dark ? "#d4d4d8" : "#333333" }, grid: { vertLines: { color: dark ? "#262930" : "#f0f0f0" }, horzLines: { color: dark ? "#262930" : "#f0f0f0" } } });
      };
      applyTheme();
      themeObserver = new MutationObserver(applyTheme);
      for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
        themeObserver.observe(ancestor, { attributes: true, attributeFilter: ["class", "data-theme", "data-openui-theme"] });
      }
      resize = new ResizeObserver(() => chart?.applyOptions({ width: element.clientWidth }));
      resize.observe(element);
    } catch (cause) {
      setError(`Unable to display series chart: ${cause instanceof Error ? cause.message : "invalid chart options"}`);
      resize?.disconnect(); themeObserver?.disconnect(); chart?.remove(); chart = undefined;
    }
    return () => { resize?.disconnect(); themeObserver?.disconnect(); chart?.remove(); };
  }, [config]);
  return <>{error && <p role="alert">{error}</p>}<div ref={ref} data-testid="financial-series-chart-canvas" style={{ width: "100%", minWidth: 0 }} /></>;
}

export function FinancialSeriesChartView({ config }: { config: unknown }) {
  const parsed = useMemo(() => financialSeriesChartSchema.safeParse(config), [config]);
  if (!parsed.success) return <p role="alert">Invalid series chart: {parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).slice(0, 5).join("; ")}</p>;
  const value = parsed.data;
  return <section aria-label={value.title ?? "Time series chart"} style={{ minWidth: 0 }}>
    {value.title && <h3>{value.title}</h3>}
    {!value.series.some(series => series.data.some(point => "value" in point || "open" in point)) ? <p role="status">No series data to display.</p> : <SeriesCanvas config={value} />}
  </section>;
}

export const FinancialSeriesChart = defineComponent({
  name: "FinancialSeriesChart", props: z.object({ config: financialSeriesChartSchema }),
  description: "Generic time-series chart without ticker requirements. Config contains series (candlestick OHLC, line, area, baseline, histogram), ISO dates with whitespace, left/right scales, optional markers and priceLines. Accepts indicator-only series and arbitrary units in titles; never calculates indicators or requests data.",
  component: ({ props }) => <FinancialSeriesChartView config={props.config} />,
});
