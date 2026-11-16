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

export const financialStories = examples.map(({ name, id, indicators, description }) => {
  const selectedBars = bars.map(({ sma, rsi, macd, signal, histogram, ...bar }) => ({ ...bar,
    ...(indicators.includes("SMA") ? { sma } : {}), ...(indicators.includes("RSI") ? { rsi } : {}),
    ...(indicators.includes("MACD") ? { macd, signal, histogram } : {}) }));
  const snapshot = { symbol: "DEMO", interval: "1d", currency: "USD", source: "가상 데이터", indicators, parameters: { sma_period: 20, rsi_period: 14, macd_fast: 12, macd_slow: 26, macd_signal: 9 }, bars: selectedBars };
  return { id: `financial-${id}`, name, category: "components", signature: "FinancialChart(snapshot)", description,
    note: "화면 확인용 가상 데이터와 예시 지표값입니다. 실제 시장 데이터나 계산 결과가 아닙니다.",
    examples: [{ title: name, code: `snapshot = ${JSON.stringify(snapshot)};\nroot = Col([FinancialChart(snapshot)]);` }] };
});
