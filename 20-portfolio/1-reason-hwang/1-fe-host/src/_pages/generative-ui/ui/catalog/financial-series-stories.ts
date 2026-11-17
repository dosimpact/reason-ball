import { financialSeriesFixtures } from "@/shared/ui/intelligent-ui/components/financial/series-chart/fixtures";

/** Rendering fixtures only; generated financial answers must use supplied trusted data. */
const examples = [
  { key: "line", name: "FinancialSeriesChart", group: "components", description: "시리즈 목록으로 차트 유형·좌우 축·마커·기준선을 조합하는 범용 금융 시계열 컴포넌트입니다." },
  { key: "candlestick", name: "Candlestick", group: "types", description: "OHLC 데이터를 캔들로 표시합니다." },
  { key: "line", name: "Line", group: "types", description: "날짜와 값만으로 단순 라인을 그립니다. OHLC 가격 데이터는 필요하지 않습니다." },
  { key: "area", name: "Area", group: "types", description: "라인 아래 영역을 채워 시계열 흐름을 표시합니다." },
  { key: "baseline", name: "Baseline", group: "types", description: "baseValue 위아래를 서로 다른 색으로 표시합니다." },
  { key: "histogram", name: "Histogram", group: "types", description: "거래량이나 임의 수치를 세로 막대로 표시합니다." },
  { key: "twoScales", name: "Two price scales", group: "options", description: "서로 다른 단위의 시리즈를 왼쪽·오른쪽 독립 축에 배치합니다." },
  { key: "annotations", name: "Series markers · Price lines", group: "options", description: "시리즈별 이벤트 마커와 수평 기준선을 조합합니다. 매매 판단을 자동 생성하지 않습니다." },
  { key: "indicatorOnly", name: "지표 전용 · 가격 없음", group: "compositions", description: "계산된 지표의 time/value만 사용해 가격 캔들 없이 표시합니다." },
] as const;

export const financialSeriesStories = examples.map(({ key, name, group, description }) => ({
  id: name === "FinancialSeriesChart" ? "components-financialserieschart" : `financial-series-${key.toLowerCase()}`, name, group, category: "financial",
  signature: "FinancialSeriesChart(config)", description,
  note: "렌더링 확인용 가상 데이터입니다. 실제 금융 답변에는 제공된 데이터만 사용하세요. 차트는 지표를 계산하거나 데이터를 조회하지 않습니다.",
  examples: [{ title: name, code: `config = ${JSON.stringify(financialSeriesFixtures[key])};\nroot = Col([FinancialSeriesChart(config)]);` }],
}));
