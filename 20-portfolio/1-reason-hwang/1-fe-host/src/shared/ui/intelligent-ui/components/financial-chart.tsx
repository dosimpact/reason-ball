"use client";

import { defineComponent, useStateField } from "@openuidev/react-lang";
import { CandlestickSeries, ColorType, HistogramSeries, LineSeries, createChart } from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod/v4";
import { chartIndicators } from "../financial-indicators";
import { financialSnapshotSchema, type FinancialSnapshot } from "../financial-schema";
export type { FinancialSnapshot } from "../financial-schema";

const loadingSnapshot: FinancialSnapshot = { bars: [], status: "loading" };
const colors = ["#e79b19", "#8b5cf6", "#3b82f6", "#e0528b", "#16a085", "#d35400", "#78909c"];
const colorFor = (id: string) => colors[[...id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % colors.length];
const numberText = (value: number | null | undefined) => value == null ? "값 없음" : value.toLocaleString("ko-KR", { maximumFractionDigits: 6 });
const parametersText = (parameters: Record<string, unknown>) => Object.entries(parameters).map(([key, value]) => `${key}=${String(value)}`).join(", ");

export function FinancialChartView({ snapshot: querySnapshot, visibility: controlledVisibility, onVisibilityChange }: { snapshot?: FinancialSnapshot | null; visibility?: Record<string, boolean>; onVisibilityChange?: (value: Record<string, boolean>) => void }) {
  const snapshot = querySnapshot ?? loadingSnapshot;
  const indicators = useMemo(() => chartIndicators(snapshot), [snapshot]);
  const [localVisibility, setLocalVisibility] = useState<Record<string, boolean>>({});
  const visibility = controlledVisibility ?? localVisibility;
  const [selectionError, setSelectionError] = useState("");
  const [chartError, setChartError] = useState("");
  const defaults = useMemo(() => new Set(indicators.filter(item => item.panel === "oscillator").slice(0, 4).map(item => item.instanceId)), [indicators]);
  const visible = useMemo(() => {
    const explicitlyShown = indicators.filter(item => item.panel === "oscillator" && visibility[item.instanceId] === true);
    const initiallyShown = indicators.filter(item => item.panel === "oscillator" && visibility[item.instanceId] === undefined && defaults.has(item.instanceId));
    const shown = new Set([...explicitlyShown, ...initiallyShown].slice(0, 4).map(item => item.instanceId));
    return indicators.filter(item => item.panel === "price" ? visibility[item.instanceId] ?? true : shown.has(item.instanceId));
  }, [indicators, visibility, defaults]);
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
  return <figure className="iui-financial-chart" style={{ margin: 0, minWidth: 0 }} aria-label={`${snapshot.symbol ?? "Financial"} candlestick chart`}>
    <figcaption><strong>{snapshot.symbol} · {snapshot.interval} · {snapshot.currency}</strong> · Candles / Volume{indicators.length ? ` / ${indicators.map(item => item.label).join(" / ")}` : ""}</figcaption>
    {snapshot.error ? <p role="alert">{snapshot.error}</p> : !snapshot.bars.length ? <p role="status">{snapshot.status === "loading" ? "가격과 지표를 불러오는 중…" : "표시할 가격 데이터가 없습니다."}</p> : <div ref={ref} data-testid="financial-chart-canvas" style={{ width: "100%", minWidth: 0 }} />}
    {chartError && <p role="alert">{chartError}</p>}
    <small>{snapshot.source} · 기준 {snapshot.as_of ?? "—"} · 조회 {snapshot.fetched_at ?? "—"}{snapshot.auto_adjust ? " · 수정주가" : ""}. 분석 본문은 답변 시점의 스냅샷입니다.</small>
    {snapshot.schemaVersion === 2 && <p className="iui-indicator-origin">카탈로그 {snapshot.catalogVersion}{snapshot.origin && ` · 누적 기준 시작일 ${snapshot.origin.date ?? "알 수 없음"} · 사용 이력 ${snapshot.origin.availableHistory}봉 · ${snapshot.origin.policy}`}</p>}
    {snapshot.schemaVersion === 2 && snapshot.origin && <details><summary>누적 기준 정책 상세</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(snapshot.origin, null, 2)}</pre></details>}
    {snapshot.warnings?.map(warning => <p key={warning} role="status">{warning}</p>)}
    {indicators.length > 0 && <section aria-label="지표 요약과 표시 설정" className="iui-indicator-summary">
      <h3>지표 요약 · {indicators.length}개</h3><p>하위 패널은 최대 4개입니다. 표시 선택은 조회·모델 호출 없이 화면만 바꿉니다. 각 패널은 단위별로 분리됩니다.</p>
      {selectionError && <p role="alert">{selectionError}</p>}
      {indicators.map(indicator => <details key={indicator.instanceId} className="iui-indicator-summary-item"><summary>{indicator.label} · {indicator.status === "error" ? "계산 오류" : indicator.series.every(series => series.values.at(-1) == null) ? "준비 구간 / 값 없음" : indicator.series.map(series => `${series.label}: ${numberText(series.values.at(-1))} ${series.unit}`).join(" · ")}{indicator.signal ? ` · ${indicator.signal.state}${indicator.signal.cross ? ` / ${indicator.signal.cross}` : ""}` : ""}</summary>
        <label className="iui-indicator-toggle"><input type="checkbox" checked={visible.some(item => item.instanceId === indicator.instanceId)} onChange={event => {
          if (event.target.checked && indicator.panel === "oscillator" && visible.filter(item => item.panel === "oscillator").length >= 4) { setSelectionError("하위 패널은 최대 4개까지 표시할 수 있습니다. 다른 지표를 먼저 숨겨 주세요."); return; }
          setSelectionError(""); const next = { ...visibility, [indicator.instanceId]: event.target.checked }; if (onVisibilityChange) onVisibilityChange(next); else setLocalVisibility(next);
        }} />{indicator.panel === "price" ? "가격 위에 표시" : "하위 패널 표시"}</label>
        <p>설정: {parametersText(indicator.parameters) || "없음"}</p>{indicator.signal && <p>서버 시그널 근거: {parametersText(indicator.signal)}</p>}<p>인스턴스: {indicator.instanceId}</p>
        {indicator.error && <p role="alert">{indicator.error}{indicator.errorCode ? ` (${indicator.errorCode})` : ""}</p>}{indicator.warnings?.map(warning => <p key={warning}>{warning}</p>)}
        <p>최신 표시 봉: {snapshot.bars.at(-1)?.time ?? "—"}. 값 없음은 0을 의미하지 않습니다.</p>
        <ul>{indicator.series.map(series => <li key={series.key}>{series.label}: {numberText(series.values.at(-1))} {series.unit}{series.bandGroup ? ` · ${series.bandGroup} ${series.role ?? ""} 경계` : ""}</li>)}</ul>
      </details>)}
    </section>}
    <div><small>TradingView Lightweight Charts™ · Copyright © 2025 TradingView, Inc. <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView</a></small></div>
  </figure>;
}

export const FinancialChart = defineComponent({
  name: "FinancialChart", props: z.object({ snapshot: financialSnapshotSchema }),
  description: "Trusted financial snapshot v1 or v2. Shared OHLCV time axis with candle/volume, data-driven multi-instance indicator series, band boundaries, PSAR dots and up to four visible oscillator panes. All indicators remain available in summary/detail. Never invent or calculate indicator values in the model.",
  component: function FinancialChartComponent({ props, statementId }) {
    const field = useStateField<Record<string, boolean>>(`${statementId ?? "financial-chart"}.visibility`, {});
    return <FinancialChartView snapshot={props.snapshot} visibility={field.value} onVisibilityChange={value => field.setValue(value)} />;
  },
});
