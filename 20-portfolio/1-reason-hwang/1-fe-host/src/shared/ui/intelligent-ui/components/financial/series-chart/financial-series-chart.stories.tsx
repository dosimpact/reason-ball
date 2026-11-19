import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, waitFor, within } from "storybook/test";
import { FinancialSeriesChartView } from "./financial-series-chart";
import { financialSeriesFixtures as fixtures } from "./fixtures";

const meta = { title: "OpenUI/FinancialSeriesChart", component: FinancialSeriesChartView, args: { config: fixtures.line }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await waitFor(() => expect(canvas.getByTestId("financial-series-chart-canvas").querySelectorAll("canvas").length).toBeGreaterThan(0));
  await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
} } satisfies Meta<typeof FinancialSeriesChartView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Candlestick: Story = { args: { config: fixtures.candlestick } };
export const Line: Story = { args: { config: fixtures.line } };
export const Area: Story = { args: { config: fixtures.area } };
export const Baseline: Story = { args: { config: fixtures.baseline } };
export const Histogram: Story = { args: { config: fixtures.histogram } };
export const TwoScales: Story = { args: { config: fixtures.twoScales } };
export const MarkersAndPriceLines: Story = { args: { config: fixtures.annotations } };
export const IndicatorOnly: Story = { args: { config: fixtures.indicatorOnly } };
export const Empty: Story = { args: { config: fixtures.empty }, play: async ({ canvasElement }) => { await expect(within(canvasElement).getByRole("status")).toHaveTextContent("No series data"); } };
export const Invalid: Story = { args: { config: fixtures.invalid }, play: async ({ canvasElement }) => { await expect(within(canvasElement).getByRole("alert")).toHaveTextContent("sorted and unique"); } };
export const InvalidShape: Story = { args: { config: { series: [{ id: "bad", type: "candlestick", data: [{ time: "2026-11-01", value: 2 }] }] } }, play: async ({ canvasElement }) => { await expect(within(canvasElement).getByRole("alert")).toHaveTextContent("Data must match candlestick"); } };
export const InvalidNumber: Story = { args: { config: { series: [{ id: "bad", type: "line", data: [{ time: "2026-11-01", value: Infinity }] }] } }, play: async ({ canvasElement }) => { await expect(within(canvasElement).getByRole("alert")).toHaveTextContent("Invalid series chart"); } };

export const CandleAnnotations: Story = { args: { config: { ...fixtures.candlestick, series: fixtures.candlestick.series.map(series => ({ ...series, markers: fixtures.annotations.series[0].markers, priceLines: fixtures.annotations.series[0].priceLines })) } } };
export const HistogramAnnotations: Story = { args: { config: { ...fixtures.histogram, series: fixtures.histogram.series.map(series => ({ ...series, markers: fixtures.annotations.series[0].markers, priceLines: fixtures.annotations.series[0].priceLines })) } } };
export const DarkTheme: Story = { decorators: [Story => <div data-openui-theme="dark"><Story /></div>] };
