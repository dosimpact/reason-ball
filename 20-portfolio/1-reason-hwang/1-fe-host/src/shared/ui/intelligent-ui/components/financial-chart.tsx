"use client";

import { defineComponent } from "@openuidev/react-lang";
import { CandlestickSeries, ColorType, HistogramSeries, LineSeries, createChart } from "lightweight-charts";
import { useEffect, useRef } from "react";
import { z } from "zod/v4";

import { financialSnapshotSchema, type FinancialSnapshot } from "../financial-schema";
export type { FinancialSnapshot } from "../financial-schema";
const panels = [
  { key: "sma", pane: "price", color: "#e79b19", label: "SMA" },
  { key: "rsi", pane: "rsi", color: "#8b5cf6", label: "RSI" },
  { key: "macd", pane: "macd", color: "#3b82f6", label: "MACD" },
  { key: "signal", pane: "macd", color: "#f59e0b", label: "Signal" },
  { key: "histogram", pane: "macd", color: "#26a69a", label: "Histogram" },
] as const;

const loadingSnapshot: FinancialSnapshot = { bars: [], status: "loading" };

export function FinancialChartView({ snapshot: querySnapshot }: { snapshot?: FinancialSnapshot | null }) {
  const snapshot = querySnapshot ?? loadingSnapshot;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !snapshot.bars.length || snapshot.error) return;
    const element = ref.current;
    const bars = snapshot.bars;
    const active = panels.filter(panel => snapshot.indicators?.includes(panel.pane === "macd" ? "MACD" : panel.key.toUpperCase()) || bars.some(bar => typeof bar[panel.key] === "number"));
    const periodLabel = (key: string) => key === "sma" ? `SMA(${snapshot.parameters?.sma_period ?? 20})` : key === "rsi" ? `RSI(${snapshot.parameters?.rsi_period ?? 14})` : key === "macd" ? `MACD(${snapshot.parameters?.macd_fast ?? 12}/${snapshot.parameters?.macd_slow ?? 26}/${snapshot.parameters?.macd_signal ?? 9})` : key;
    const paneNames = ["price", "volume", ...new Set(active.filter(panel => panel.pane !== "price").map(panel => panel.pane))];
    const chart = createChart(element, { autoSize: true, height: 340 + (paneNames.length - 1) * 120, layout: { attributionLogo: true }, rightPriceScale: { minimumWidth: 72 } });
    chart.addSeries(CandlestickSeries, { upColor: "#26a69a", downColor: "#ef5350", borderVisible: false, wickUpColor: "#26a69a", wickDownColor: "#ef5350", title: snapshot.currency ?? "Price" }).setData(bars);
    chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, title: "Volume" }, 1).setData(bars.map(bar => ({ time: bar.time, value: bar.volume, color: bar.close >= bar.open ? "#26a69a99" : "#ef535099" })));
    active.forEach(panel => {
      const pane = paneNames.indexOf(panel.pane);
      const series = panel.key === "histogram"
        ? chart.addSeries(HistogramSeries, { color: panel.color, title: periodLabel(panel.key) }, pane)
        : chart.addSeries(LineSeries, { color: panel.color, lineWidth: 2, title: periodLabel(panel.key) }, pane);
      series.setData(bars.map(bar => typeof bar[panel.key] === "number" ? { time: bar.time, value: bar[panel.key] as number, ...(panel.key === "histogram" ? { color: (bar.histogram ?? 0) >= 0 ? "#26a69a" : "#ef5350" } : {}) } : { time: bar.time }));
      if (panel.key === "rsi") [30, 70].forEach(price => series.createPriceLine({ price, color: "#888888", lineWidth: 1, lineStyle: 2, axisLabelVisible: true }));
    });
    chart.panes().forEach((pane, index) => pane.setHeight(index === 0 ? 340 : 120));
    chart.timeScale().fitContent();
    const theme = () => {
      const dark = document.documentElement.classList.contains("dark") || document.documentElement.dataset.theme === "dark";
      chart.applyOptions({ layout: { background: { type: ColorType.Solid, color: dark ? "#15171b" : "#ffffff" }, textColor: dark ? "#d4d4d8" : "#333333" }, grid: { vertLines: { color: dark ? "#262930" : "#f0f0f0" }, horzLines: { color: dark ? "#262930" : "#f0f0f0" } } });
    };
    theme();
    const observer = new MutationObserver(theme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => { observer.disconnect(); chart.remove(); };
  }, [snapshot]);
  return <figure style={{ margin: 0, minWidth: 0 }} aria-label={`${snapshot.symbol ?? "Financial"} candlestick chart`}>
    <figcaption><strong>{snapshot.symbol} · {snapshot.interval} · {snapshot.currency}</strong> · Candles / Volume{snapshot.indicators?.length ? ` / ${snapshot.indicators.join(" / ")}` : ""}</figcaption>
    {snapshot.error ? <p role="alert">{snapshot.error}</p> : !snapshot.bars.length ? <p role="status">{snapshot.status === "loading" ? "가격과 지표를 불러오는 중…" : "표시할 가격 데이터가 없습니다."}</p> : <div ref={ref} data-testid="financial-chart-canvas" style={{ width: "100%", minWidth: 0 }} />}
    <small>{snapshot.source} · 기준 {snapshot.as_of ?? "—"} · 조회 {snapshot.fetched_at ?? "—"}{snapshot.auto_adjust ? " · 수정주가" : ""}. 분석 본문은 답변 시점의 스냅샷입니다.</small>
    {snapshot.warnings?.map(warning => <p key={warning} role="status">{warning}</p>)}
    <div><small>TradingView Lightweight Charts™ · Copyright © 2025 TradingView, Inc. <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView</a></small></div>
  </figure>;
}

export const FinancialChart = defineComponent({
  name: "FinancialChart",
  props: z.object({ snapshot: financialSnapshotSchema }),
  description: "Financial OHLCV snapshot from technical_analysis_chart Query. One aligned bars array drives candlesticks, volume, SMA overlay and RSI/MACD panes on a shared time axis. Never invent prices or calculate indicators in the model.",
  component: ({ props }) => <FinancialChartView snapshot={props.snapshot} />,
});
