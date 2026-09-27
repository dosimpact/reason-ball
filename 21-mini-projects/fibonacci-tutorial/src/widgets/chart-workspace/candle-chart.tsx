"use client";

import { useEffect, useRef } from "react";
import { CandlestickSeries, ColorType, LineSeries, LineStyle, createChart, createSeriesMarkers, type IPriceLine, type ISeriesMarkersPluginApi, type Time, type UTCTimestamp } from "lightweight-charts";
import type { MonitoringState } from "@/entities/strategy-monitor";
import type { Candle } from "@/entities/tutorial";
import { useTheme } from "@/shared/lib/theme";
import { chartLevels, selectedPoint, type ChartPlan } from "./levels";

type Props = { candles: Candle[]; selectedIndices: number[]; exampleIndices?: number[] | null; showFibonacci?: boolean; plan?: ChartPlan | null; monitoring?: MonitoringState | null; onSelect: (index: number) => void; disabled: boolean };
export function CandleChart({ candles, selectedIndices, exampleIndices, showFibonacci = false, plan, monitoring, onSelect, disabled }: Props) {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const candleSeriesRef = useRef<ReturnType<ReturnType<typeof createChart>["addSeries"]> | null>(null);
  const selectedSeriesRef = useRef<ReturnType<ReturnType<typeof createChart>["addSeries"]> | null>(null);
  const exampleSeriesRef = useRef<ReturnType<ReturnType<typeof createChart>["addSeries"]> | null>(null);
  const scaleSeriesRef = useRef<ReturnType<ReturnType<typeof createChart>["addSeries"]> | null>(null);
  const markerRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const selectRef = useRef(onSelect);
  const disabledRef = useRef(disabled);
  const candlesRef = useRef(candles);
  useEffect(() => { selectRef.current = onSelect; disabledRef.current = disabled; candlesRef.current = candles; }, [onSelect, disabled, candles]);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const style = getComputedStyle(container);
    const color = (token: string) => style.getPropertyValue(token).trim();
    const chart = createChart(container, {
      width: container.clientWidth, height: 354,
      layout: { background: { type: ColorType.Solid, color: color("--bgColor-default") }, textColor: color("--fgColor-muted"), fontFamily: style.fontFamily, fontSize: 11, attributionLogo: false },
      grid: { vertLines: { color: color("--bgColor-muted") }, horzLines: { color: color("--bgColor-muted") } },
      rightPriceScale: { borderColor: color("--borderColor-default"), scaleMargins: { top: 0.12, bottom: 0.14 } },
      timeScale: { borderColor: color("--borderColor-default"), timeVisible: true, secondsVisible: false, rightOffset: 2 },
      crosshair: { vertLine: { color: color("--fgColor-muted") }, horzLine: { color: color("--fgColor-muted") } },
      handleScale: true, handleScroll: true,
    });
    const candlesSeries = chart.addSeries(CandlestickSeries, { upColor: color("--fgColor-success"), downColor: color("--fgColor-danger"), borderUpColor: color("--fgColor-success"), borderDownColor: color("--fgColor-danger"), wickUpColor: color("--fgColor-success"), wickDownColor: color("--fgColor-danger") });
    const selectedSeries = chart.addSeries(LineSeries, { color: color("--fgColor-accent"), lineWidth: 2, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false });
    const exampleSeries = chart.addSeries(LineSeries, { color: color("--fgColor-attention"), lineWidth: 2, lineStyle: LineStyle.Dashed, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false });
    const scaleSeries = chart.addSeries(LineSeries, { color: "rgba(0,0,0,0)", lineWidth: 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false });
    markerRef.current = createSeriesMarkers(candlesSeries);
    chartRef.current = chart; candleSeriesRef.current = candlesSeries; selectedSeriesRef.current = selectedSeries; exampleSeriesRef.current = exampleSeries; scaleSeriesRef.current = scaleSeries;
    chart.subscribeClick((event) => {
      if (disabledRef.current || event.time === undefined) return;
      const index = candlesRef.current.findIndex((candle) => candle.time === Number(event.time));
      if (index >= 0) selectRef.current(index);
    });
    const observer = new ResizeObserver(() => chart.applyOptions({ width: container.clientWidth }));
    observer.observe(container);
    return () => { observer.disconnect(); chart.remove(); chartRef.current = null; candleSeriesRef.current = null; selectedSeriesRef.current = null; exampleSeriesRef.current = null; scaleSeriesRef.current = null; markerRef.current = null; };
  }, [theme]);
  useEffect(() => {
    candleSeriesRef.current?.setData(candles.map((candle) => ({ ...candle, time: candle.time as UTCTimestamp })));
    if (candles.length) chartRef.current?.timeScale().fitContent();
  }, [candles, theme]);
  useEffect(() => {
    const chartPoints = (indices: number[]) => indices.flatMap((index, wave) => {
      const value = selectedPoint(candles, index, wave);
      return value ? [{ time: value.time as UTCTimestamp, value: value.price }] : [];
    });
    selectedSeriesRef.current?.setData(chartPoints(selectedIndices));
    exampleSeriesRef.current?.setData(chartPoints(exampleIndices || []));
    const markers = selectedIndices.flatMap((index, wave) => candles[index] ? [{ time: candles[index].time as UTCTimestamp, position: (wave % 2 ? "aboveBar" : "belowBar") as "aboveBar" | "belowBar", color: getComputedStyle(containerRef.current!).getPropertyValue("--fgColor-accent").trim(), shape: "circle" as const, text: `W${wave}`, size: 1.5 }] : []);
    const eventMarkers = (monitoring?.events ?? []).filter((event) => event.kind !== "PLAN_LOADED" && candles.some((bar) => bar.time === event.candleTime)).map((event) => ({
      time: event.candleTime as UTCTimestamp,
      position: "aboveBar" as const,
      color: getComputedStyle(containerRef.current!).getPropertyValue(event.kind === "ENTERED" ? "--fgColor-accent" : event.kind === "CLOSED_TP" ? "--fgColor-success" : "--fgColor-danger").trim(),
      shape: "square" as const,
      text: ({ ENTERED:"진입", WARNING:"경고", INVALIDATED:"무효화", CLOSED_TP:"익절", CLOSED_SL:"손절", ABORTED:"중단", EXPIRED:"만료", INDETERMINATE:"순서 불명", PLAN_LOADED:"계획" })[event.kind],
      size: 1,
    }));
    markerRef.current?.setMarkers([...markers, ...eventMarkers].sort((a, b) => a.time - b.time));
  }, [candles, selectedIndices, exampleIndices, monitoring, theme]);
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;
    priceLinesRef.current.forEach((line) => series.removePriceLine(line));
    const displayLevels = chartLevels(candles, selectedIndices.length >= 3 ? selectedIndices : exampleIndices || [], showFibonacci, plan);
    priceLinesRef.current = displayLevels.map(({ label, price, color, lineStyle, lineWidth }) => series.createPriceLine({ price, color: getComputedStyle(containerRef.current!).getPropertyValue(color.slice(4, -1)).trim(), lineStyle: lineStyle === "dotted" ? LineStyle.Dotted : LineStyle.Dashed, lineWidth: lineWidth ?? 1, axisLabelVisible: true, title: label }));
    if (candles.length && displayLevels.length) {
      const prices = displayLevels.map((item) => item.price);
      const first = candles[0].time as UTCTimestamp;
      const last = candles[candles.length - 1].time as UTCTimestamp;
      const min = Math.min(...prices), max = Math.max(...prices);
      scaleSeriesRef.current?.setData(first === last ? [{ time: first, value: max }] : [{ time: first, value: min }, { time: last, value: max }]);
    } else scaleSeriesRef.current?.setData([]);
  }, [candles, selectedIndices, exampleIndices, showFibonacci, plan, theme]);
  return <div className="chart-shell">
    <div ref={containerRef} className="chart-canvas" role="img" aria-label="공개된 가격의 캔들 차트. 아래 캔들 목록에서 키보드로도 파동 지점을 고를 수 있습니다." />
    <div className="chart-selection-overlay" aria-hidden="true">{selectedIndices.map((index, wave) => <span key={`${wave}-${index}`}>W{wave} · {index + 1}번째 캔들</span>)}</div>
    <div className="chart-attribution">Charts by <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">TradingView</a></div>
  </div>;
}
