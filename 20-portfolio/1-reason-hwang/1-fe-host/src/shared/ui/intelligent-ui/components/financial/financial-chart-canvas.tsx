"use client";

import { CandlestickSeries, ColorType, HistogramSeries, LineSeries, createChart } from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import { colorFor, numberText } from "./financial-format";
import type { FinancialSnapshot, IndicatorInstance } from "./financial-schema";

export function FinancialChartCanvas({ snapshot, visible }: { snapshot: FinancialSnapshot; visible: IndicatorInstance[] }) {
  const [chartError, setChartError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !snapshot.bars.length || snapshot.error) return;
    const element = ref.current;
    const bars = snapshot.bars;
    const panes = ["price", "volume", ...visible.filter(item => item.panel === "oscillator").slice(0, 4).map(item => item.instanceId)];
    const chart = createChart(element, { autoSize: true, height: 340 + (panes.length - 1) * 120, layout: { attributionLogo: true }, rightPriceScale: { minimumWidth: 72 } });
    let observer: MutationObserver | undefined;
    setChartError("");
    try {
      if (bars.some((bar, index) => index > 0 && bar.time <= bars[index - 1].time)) throw new Error("가격 날짜가 중복되거나 시간순으로 정렬되지 않았습니다.");
      chart.addSeries(CandlestickSeries, { upColor: "#26a69a", downColor: "#ef5350", borderVisible: false, wickUpColor: "#26a69a", wickDownColor: "#ef5350", title: snapshot.currency ?? "Price" }).setData(bars);
      chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, title: "Volume" }, 1).setData(bars.map(bar => ({ time: bar.time, value: bar.volume, color: bar.close >= bar.open ? "#26a69a99" : "#ef535099" })));
      visible.forEach(indicator => {
        if (indicator.status === "error") return;
        const pane = indicator.panel === "price" ? 0 : panes.indexOf(indicator.instanceId);
        if (pane < 0) return;
        indicator.series.forEach(descriptor => {
          if (descriptor.values.length !== bars.length) throw new Error(`${indicator.label}: 지표와 가격의 시간축이 일치하지 않습니다.`);
          const color = colorFor(`${indicator.instanceId}:${descriptor.key}`);
          const options = { color, title: `${indicator.label} ${descriptor.label} · ${descriptor.unit}`, priceFormat: { type: "custom" as const, formatter: (value: number) => numberText(value), minMove: 0.000001 } };
          const series = descriptor.display === "histogram" ? chart.addSeries(HistogramSeries, options, pane)
            : chart.addSeries(LineSeries, { ...options, lineWidth: 2, lineVisible: descriptor.display !== "markers", pointMarkersVisible: descriptor.display === "markers", pointMarkersRadius: 3, ...(descriptor.role && descriptor.role !== "middle" ? { lineStyle: 2 } : {}) }, pane);
          series.setData(bars.map((bar, index) => descriptor.values[index] == null ? { time: bar.time } : { time: bar.time, value: descriptor.values[index]!, ...(descriptor.display === "histogram" ? { color: descriptor.values[index]! >= 0 ? "#26a69a" : "#ef5350" } : {}) }));
          if (indicator.name === "RSI") [30, 70].forEach(price => series.createPriceLine({ price, color: "#888888", lineWidth: 1, lineStyle: 2, axisLabelVisible: true }));
        });
      });
      chart.panes().forEach((pane, index) => pane.setHeight(index === 0 ? 340 : 120));
      chart.timeScale().fitContent();
      const theme = () => {
        const dark = document.documentElement.classList.contains("dark") || document.documentElement.dataset.theme === "dark";
        chart.applyOptions({ layout: { background: { type: ColorType.Solid, color: dark ? "#15171b" : "#ffffff" }, textColor: dark ? "#d4d4d8" : "#333333" }, grid: { vertLines: { color: dark ? "#262930" : "#f0f0f0" }, horzLines: { color: dark ? "#262930" : "#f0f0f0" } } });
      };
      theme(); observer = new MutationObserver(theme);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    } catch (error) { setChartError(error instanceof Error ? error.message : "차트를 표시하지 못했습니다."); }
    return () => { observer?.disconnect(); chart.remove(); };
  }, [snapshot, visible]);
  return <>
    {snapshot.error ? <p role="alert">{snapshot.error}</p> : !snapshot.bars.length ? <p role="status">{snapshot.status === "loading" ? "가격과 지표를 불러오는 중…" : "표시할 가격 데이터가 없습니다."}</p> : <div ref={ref} data-testid="financial-chart-canvas" style={{ width: "100%", minWidth: 0 }} />}
    {chartError && <p role="alert">{chartError}</p>}
  </>;
}
