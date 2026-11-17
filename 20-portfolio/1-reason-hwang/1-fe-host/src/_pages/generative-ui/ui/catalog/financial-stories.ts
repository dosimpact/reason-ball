import type { IndicatorCatalog, IndicatorInstance } from "@/shared/ui/intelligent-ui/components/financial/financial-schema";

/** Synthetic data for UI demonstration; indicator values are not investment data. */
const bars = Array.from({ length: 50 }, (_, index) => {
  const close = Math.round((100 + index * 0.35 + Math.sin(index / 4) * 4) * 100) / 100;
  const open = Math.round((close + Math.sin(index) * 1.5) * 100) / 100;
  return { time: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10), open, high: Math.max(open, close) + 2, low: Math.min(open, close) - 2, close, volume: 100000 + index * 1300,
    sma: index < 19 ? null : Math.round((close - Math.sin(index / 4) * 2 - 1) * 100) / 100,
    rsi: index < 13 ? null : Math.round((50 + Math.sin(index / 5) * 18) * 100) / 100,
    macd: index < 25 ? null : Math.round(Math.sin(index / 6) * 200) / 100,
    signal: index < 33 ? null : Math.round(Math.sin((index - 3) / 6) * 150) / 100,
    histogram: index < 33 ? null : Math.round((Math.sin(index / 6) * 2 - Math.sin((index - 3) / 6) * 1.5) * 100) / 100 };
});

const examples = [
  { name: "캔들 · 거래량", id: "candles-volume", indicators: [] as string[], description: "캔들로 시가·고가·저가·종가를, 아래 패널에서 거래량을 표시합니다." },
  { name: "SMA(20) 오버레이", id: "sma", indicators: ["SMA"], description: "20일 이동평균선을 가격 캔들 위에 겹쳐 표시합니다." },
  { name: "RSI(14) 패널", id: "rsi", indicators: ["RSI"], description: "RSI 선과 30·70 기준선을 별도 패널에 표시합니다." },
  { name: "MACD(12,26,9) 패널", id: "macd", indicators: ["MACD"], description: "MACD, 시그널과 히스토그램을 별도 패널에 표시합니다." },
  { name: "캔들 · 지표 통합", id: "combined", indicators: ["SMA", "RSI", "MACD"], description: "캔들·거래량과 SMA, RSI, MACD를 같은 시간 축에서 함께 살펴봅니다." },
];

const legacyStories = examples.map(({ name, id, indicators, description }) => {
  const selectedBars = bars.map(({ sma, rsi, macd, signal, histogram, ...bar }) => ({ ...bar,
    ...(indicators.includes("SMA") ? { sma } : {}), ...(indicators.includes("RSI") ? { rsi } : {}),
    ...(indicators.includes("MACD") ? { macd, signal, histogram } : {}) }));
  const snapshot = { symbol: "DEMO", interval: "1d", currency: "USD", source: "가상 데이터", indicators, parameters: { sma_period: 20, rsi_period: 14, macd_fast: 12, macd_slow: 26, macd_signal: 9 }, bars: selectedBars };
  return { id: `financial-${id}`, name, category: "components", signature: "FinancialChart(snapshot)", description,
    note: "화면 확인용 가상 데이터와 예시 지표값입니다. 실제 시장 데이터나 계산 결과가 아닙니다.",
    examples: [{ title: name, code: `snapshot = ${JSON.stringify(snapshot)};\nroot = Col([FinancialChart(snapshot)]);` }] };
});

// Deliberately synthetic series: these examples exercise rendering, not TA calculations.
const indicator = (name: string, period: number): IndicatorInstance => ({
  instanceId: `${name.toLowerCase()}-${period}`, name, label: `${name}(${period})`,
  parameters: { timeperiod: period }, panel: "price", status: "success",
  series: [{ key: "value", label: name, unit: "USD", display: "line", values: bars.map((bar, index) => index < period - 1 ? null : bar.close - period / 10) }],
});
const bands: IndicatorInstance = {
  instanceId: "bbands-20", name: "BBANDS", label: "BBANDS(20)", parameters: { timeperiod: 20 }, panel: "price", status: "success",
  series: (["upper", "middle", "lower"] as const).map((role, index) => ({ key: role, label: role, unit: "USD", display: "line", role, bandGroup: "bbands-20", values: bars.map((bar, i) => i < 19 ? null : bar.close + (1 - index) * 4) })),
};
const psar: IndicatorInstance = {
  instanceId: "psar-demo", name: "PSAR", label: "PSAR", parameters: {}, panel: "price", status: "success",
  series: [{ key: "sar", label: "SAR", unit: "USD", display: "markers", values: bars.map(bar => bar.low - 1) }],
};
const v2Stories = [
  { id: "multi-instance", name: "FinancialChart · SMA 다중 설정", description: "v2 snapshot에서 SMA(10)과 SMA(20)을 독립 인스턴스로 표시하고 각각 숨길 수 있습니다.", indicators: [indicator("SMA", 10), indicator("SMA", 20)] },
  { id: "bands-psar", name: "FinancialChart · BBANDS·PSAR", description: "밴드의 상단·중앙·하단 선과 PSAR 가격 마커를 표시합니다.", indicators: [bands, psar] },
  { id: "partial-error", name: "FinancialChart · 준비 구간·부분 오류", description: "전체 null인 준비 구간과 지표별 계산 실패를 가격 차트와 함께 표시합니다.", indicators: [{ ...indicator("SMA", 20), series: [{ ...indicator("SMA", 20).series[0], values: bars.map(() => null) }] }, { instanceId: "rsi-error", name: "RSI", label: "RSI 오류 예시", parameters: { timeperiod: 14 }, panel: "oscillator" as const, status: "error" as const, error: "표시 확인용 계산 오류", series: [] }] },
].map(({ id, name, description, indicators }) => ({
  id: `financial-${id}`, name, category: "components", signature: "FinancialChart(snapshot: schemaVersion 2)", description,
  note: "화면 확인용 가상 데이터와 예시 지표값입니다. 실제 시장 데이터나 계산 결과가 아닙니다.",
  examples: [{ title: name, code: `snapshot = ${JSON.stringify({ schemaVersion: 2, catalogVersion: "demo-v2", symbol: "DEMO", currency: "USD", source: "가상 데이터", bars, indicators })};\nroot = Col([FinancialChart(snapshot)]);` }],
}));
const demoCatalog: IndicatorCatalog = {
  schemaVersion: 2, catalogVersion: "demo-v2", maxInstances: 40, maxVisiblePanels: 4,
  defaultInstances: [10, 20, 30].map(timeperiod => ({ name: "SMA", parameters: { timeperiod } })),
  indicators: [{ name: "SMA", label: "단순 이동평균", defaults: { timeperiod: 20 }, parameters: { timeperiod: { default: 20, min: 2, max: 200, type: "integer" } }, supportsSignal: false, panel: "price", series: [{ key: "sma", label: "SMA", unit: "USD", display: "line" }] }],
};
export const financialStories = [...legacyStories, ...v2Stories, {
  id: "components-indicatorcontrols", name: "IndicatorControls", category: "components", signature: "IndicatorControls($chart_instances, catalog)",
  description: "Financial 지표 설정: 추가·복제·제거·기간 편집과 명시적 초안 적용을 실행합니다.",
  note: "SMA만 포함한 축소 가상 카탈로그입니다. 설정 적용은 로컬 상태만 변경하며 서버 조회나 실제 차트 계산은 실행하지 않습니다.",
  examples: [{ title: "지표 설정 편집", code: `catalog = ${JSON.stringify(demoCatalog)};\nroot = Col([IndicatorControls($chart_instances, catalog)]);` }],
}];
