import { Renderer } from "@openuidev/react-lang";
import { library } from "../../library";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { FinancialChartView, FinancialChartPlotView, FinancialChartSummaryView, FinancialChartMetadataView, type FinancialSnapshot } from "./financial-chart";

const bars = Array.from({ length: 80 }, (_, index) => ({
  time: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
  open: 100 + index, high: 104 + index, low: 98 + index, close: 102 + index,
  volume: 100000 + index * 1000, sma: index < 20 ? null : 92 + index,
  rsi: index < 14 ? null : 50 + Math.sin(index) * 20,
  macd: index < 26 ? null : Math.sin(index / 5), signal: index < 34 ? null : Math.sin(index / 5) / 2,
  histogram: index < 34 ? null : Math.sin(index / 5) / 2,
}));
const snapshot: FinancialSnapshot = { symbol: "AAPL", interval: "1d", currency: "USD", source: "Yahoo Finance", as_of: "2026-03-21", fetched_at: "2026-03-22T00:00:00Z", auto_adjust: true, indicators: ["SMA", "RSI", "MACD"], bars };
const meta = { title: "OpenUI/FinancialChart", component: FinancialChartView, args: { snapshot } } satisfies Meta<typeof FinancialChartView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const CandleAndIndicators: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await expect(canvas.getByTestId("financial-chart-canvas").querySelectorAll("canvas").length).toBeGreaterThan(3);
  await expect(canvas.getByRole("link", { name: "TradingView" })).toHaveAttribute("href", "https://www.tradingview.com/");
} };
export const Loading: Story = { args: { snapshot: { bars: [], status: "loading" } }, play: async ({ canvasElement }) => { await expect(within(canvasElement).getByRole("status")).toHaveTextContent("불러오는 중"); } };
export const Failed: Story = { args: { snapshot: { bars: [], error: "가격 조회 실패 (503)" } }, play: async ({ canvasElement }) => { await expect(within(canvasElement).getByRole("alert")).toHaveTextContent("503"); } };
export const Empty: Story = { args: { snapshot: { bars: [] } } };
export const PriceOnly: Story = { args: { snapshot: { ...snapshot, indicators: [], bars: bars.map(({ time, open, high, low, close, volume }) => ({ time, open, high, low, close, volume })) } } };
export const Warmup: Story = { args: { snapshot: { ...snapshot, bars: bars.slice(0, 10), warnings: ["지표 준비 구간: 아직 계산할 값이 없습니다."] } }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await expect(canvas.getByTestId("financial-chart-canvas").querySelectorAll("canvas").length).toBeGreaterThan(3);
  await expect(canvas.getByRole("status")).toHaveTextContent("준비 구간");
} };

export const PendingQuery: Story = { args: { snapshot: null }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await expect(canvas.getByRole("status")).toHaveTextContent("불러오는 중");
  await expect(canvas.queryByTestId("financial-chart-canvas")).not.toBeInTheDocument();
} };

const v2: FinancialSnapshot = {
  ...snapshot, schemaVersion: 2, catalogVersion: "ta20-1", source: "표시 확인용 가상 데이터", origin: { date: bars[0].time, availableHistory: bars.length, policy: "Story fixture only" },
  indicators: [
    ...[20, 60].map(period => ({ instanceId: `sma-${period}`, name: "SMA", label: `SMA(${period})`, parameters: { timeperiod: period }, panel: "price" as const, status: "success" as const, signal: { state: "표시 확인용" }, series: [{ key: "sma", label: "SMA", unit: "price", display: "line" as const, values: bars.map((bar, index) => index < period ? null : bar.close - 3) }] })),
    { instanceId: "psar", name: "PSAR", label: "PSAR", parameters: {}, panel: "price", status: "success", series: [{ key: "sar", label: "SAR", unit: "price", display: "markers", values: bars.map(bar => bar.low - 1) }] },
    ...Array.from({ length: 5 }, (_, index) => ({ instanceId: `osc-${index}`, name: `OSC${index}`, label: `가상 패널 ${index + 1}`, parameters: {}, panel: "oscillator" as const, status: "success" as const, series: [{ key: "value", label: "value", unit: "ratio", display: index === 0 ? "histogram" as const : "line" as const, values: bars.map((_, i) => i < 10 ? null : Math.sin(i / 5 + index)) }] })),
    { instanceId: "failed", name: "ERROR", label: "계산 오류 예시", parameters: {}, panel: "oscillator", status: "error", error: "이력 부족 예시", series: [] },
  ],
};
export const MultiInstanceV2: Story = { args: { snapshot: v2 }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByText(`지표 요약 · ${v2.schemaVersion === 2 ? v2.indicators.length : 0}개`));
  await expect(canvas.getByRole("region", { name: "지표 요약과 표시 설정" })).toHaveTextContent("SMA(20)");
  await expect(canvas.getByRole("region", { name: "지표 요약과 표시 설정" })).toHaveTextContent("SMA(60)");
} };
export const AllNullV2: Story = { args: { snapshot: { ...v2, indicators: v2.schemaVersion === 2 ? v2.indicators.map(indicator => ({ ...indicator, series: indicator.series.map(series => ({ ...series, values: bars.map(() => null) })) })) : [] } } };


export const CollapsedExtras: Story = { args: { snapshot: v2 }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const summary = canvas.getByText(`지표 요약 · ${v2.schemaVersion === 2 ? v2.indicators.length : 0}개`).closest("details");
  const metadata = canvas.getByText("데이터 출처와 분석 기준").closest("details");
  await expect(summary).not.toHaveAttribute("open");
  await expect(metadata).not.toHaveAttribute("open");
  await userEvent.click(canvas.getByText("데이터 출처와 분석 기준"));
  await expect(canvas.getByText("누적 기준 시작일")).toBeVisible();
  await expect(canvasElement.querySelector("pre")).toBeNull();
} };

export const ComposedBlocks: Story = {
  render: () => <div style={{ display: "grid", gap: 16 }}><FinancialChartMetadataView snapshot={v2} /><FinancialChartPlotView snapshot={v2} /><FinancialChartSummaryView snapshot={v2} /></div>,
};

export const PanelSelectionLimit: Story = { args: { snapshot: v2 }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByText(`지표 요약 · ${v2.schemaVersion === 2 ? v2.indicators.length : 0}개`));
  const fifth = canvas.getByText(/^가상 패널 5 ·/).closest("details")!;
  await userEvent.click(within(fifth).getByText(/^가상 패널 5 ·/));
  const fifthToggle = within(fifth).getByRole("checkbox");
  await userEvent.click(fifthToggle);
  await expect(canvas.getByText("하위 패널은 최대 4개까지 표시할 수 있습니다. 다른 지표를 먼저 숨겨 주세요.")).toBeVisible();
  await expect(fifthToggle).not.toBeChecked();
  const first = canvas.getByText(/^가상 패널 1 ·/).closest("details")!;
  await userEvent.click(within(first).getByText(/^가상 패널 1 ·/));
  await userEvent.click(within(first).getByRole("checkbox"));
  await userEvent.click(fifthToggle);
  await expect(fifthToggle).toBeChecked();
  await expect(within(first).getByRole("checkbox")).not.toBeChecked();
} };


export const SharedVisibilityBlocks: Story = {
  render: () => <Renderer library={library} response={'root = Col([FinancialChartPlot(snapshot, "shared-financial-visibility"), FinancialChartSummary(snapshot, "shared-financial-visibility"), FinancialChartMetadata(snapshot)], 3)\nsnapshot = ' + JSON.stringify(v2)} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chart = canvas.getByTestId("financial-chart-canvas");
    await waitFor(() => expect(chart.querySelector(".tv-lightweight-charts")).toHaveStyle({ height: "940px" }));
    await userEvent.click(canvas.getByText(`지표 요약 · ${v2.schemaVersion === 2 ? v2.indicators.length : 0}개`));
    const first = canvas.getByText(/^가상 패널 1 ·/).closest("details")!;
    await userEvent.click(within(first).getByText(/^가상 패널 1 ·/));
    await userEvent.click(within(first).getByRole("checkbox"));
    await expect(within(first).getByRole("checkbox")).not.toBeChecked();
    await waitFor(() => expect(chart.querySelector(".tv-lightweight-charts")).toHaveStyle({ height: "820px" }));
  },
};
