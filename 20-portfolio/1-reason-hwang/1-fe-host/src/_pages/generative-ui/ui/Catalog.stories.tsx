import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { LibStory } from "./catalog/lib-story";

const meta = { title: "Generative UI/Catalog", component: LibStory, args: { theme: "light" } } satisfies Meta<typeof LibStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const TradingViewChart: Story = {
  beforeEach: () => {
    const previous = window.location.href;
    window.history.replaceState(null, "", "#components-financialchart");
    return () => { window.history.replaceState(null, "", previous); };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("searchbox", { name: "항목 검색" }), "TradingView");
    await expect(canvas.getByRole("link", { name: /FinancialChart/ })).toHaveAttribute("href", "#components-financialchart");
    await expect(canvas.getByRole("heading", { name: "FinancialChart" })).toBeVisible();
    await waitFor(() => expect(canvas.getAllByTestId("financial-chart-canvas")).toHaveLength(2));
    for (const chart of canvas.getAllByTestId("financial-chart-canvas")) {
      await waitFor(() => expect(chart.querySelectorAll("canvas").length).toBeGreaterThan(1));
    }
    await expect(canvas.getByText("표시할 가격 데이터가 없습니다.")).toBeVisible();
    const editor = canvas.getByRole("textbox", { name: "FinancialChart 빈 데이터 안내 코드" });
    const panel = within(editor.closest("section")!);
    await userEvent.clear(editor);
    await userEvent.type(editor, 'root = Text("차트 예제 편집 확인");', { delay: 0 });
    await userEvent.click(panel.getByRole("button", { name: "코드 적용" }));
    await expect(panel.getByText("차트 예제 편집 확인", { exact: true })).toBeVisible();
    await userEvent.click(panel.getByRole("button", { name: "초기화" }));
    await expect(panel.getByText("표시할 가격 데이터가 없습니다.")).toBeVisible();
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
  },
};

export const FinancialShowcases: Story = {
  beforeEach: () => {
    const previous = window.location.href;
    window.history.replaceState(null, "", "#financial-combined");
    return () => { window.history.replaceState(null, "", previous); };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /^financial · 금융 \d+$/ })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(canvas.getByRole("button", { name: /^components / }));
    await expect(canvas.queryByRole("link", { name: /FinancialChart|IndicatorControls/ })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: /^financial · 금융 \d+$/ }));
    const group = canvas.getByRole("region", { name: "금융 차트 쇼케이스" });
    for (const name of ["캔들 · 거래량", "SMA(20) 오버레이", "RSI(14) 패널", "MACD(12,26,9) 패널", "캔들 · 지표 통합"]) {
      await expect(within(group).getByRole("link", { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })).toBeVisible();
    }
    await waitFor(() => expect(canvas.getByTestId("financial-chart-canvas").querySelectorAll("canvas").length).toBeGreaterThan(1));
    await expect(canvas.getByText(/화면 확인용 가상 데이터/)).toBeVisible();
  },
};

export const FinancialV2Showcases: Story = {
  beforeEach: () => {
    const previous = window.location.href;
    window.history.replaceState(null, "", "#financial-multi-instance");
    return () => { window.history.replaceState(null, "", previous); };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("searchbox", { name: "항목 검색" }), "financial");
    for (const [id, label] of [
      ["financial-multi-instance", "SMA(10)"],
      ["financial-bands-psar", "BBANDS(20)"],
      ["financial-partial-error", "표시 확인용 계산 오류"],
    ]) {
      const link = canvasElement.querySelector<HTMLAnchorElement>(`a[href="#${id}"]`)!;
      await expect(link).toBeVisible();
      window.history.replaceState(null, "", `#${id}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      await waitFor(() => expect(canvas.getByTestId("financial-chart-canvas").querySelectorAll("canvas").length).toBeGreaterThan(1));
      await expect(canvas.getAllByText(label, { exact: false })[0]).toBeVisible();
      if (id === "financial-partial-error") await expect(canvas.getByRole("alert")).toHaveTextContent(label);
      else await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
    }
    await expect(canvas.getByRole("link", { name: /IndicatorControls/ })).toBeVisible();
    window.history.replaceState(null, "", "#components-indicatorcontrols");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await expect(await canvas.findByRole("heading", { name: "IndicatorControls" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "지표 추가" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("적용하지 않은 초안");
    await userEvent.click(canvas.getByRole("button", { name: "지표 설정 적용 · 차트 조회" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("적용된 설정");
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
  },
};

export const GeneralFinancialTypes: Story = {
  beforeEach: () => {
    const previous = window.location.href;
    window.history.replaceState(null, "", "#financial-series-line");
    return () => { window.history.replaceState(null, "", previous); };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const types = within(canvas.getByRole("region", { name: "기본 차트 유형" }));
    for (const name of ["Candlestick", "Line", "Area", "Baseline", "Histogram"]) {
      await expect(types.getByRole("link", { name: new RegExp(`^◇ ${name}`) })).toBeVisible();
    }
    await expect(canvas.getByRole("region", { name: "축·마커·기준선" })).toBeVisible();
    for (const id of ["candlestick", "line", "area", "baseline", "histogram", "twoscales", "annotations", "indicatoronly"]) {
      window.history.replaceState(null, "", `#financial-series-${id}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      await waitFor(() => expect(canvasElement.querySelector("main")).toHaveAttribute("id", `financial-series-${id}`));
      await waitFor(() => expect(canvas.getByTestId("financial-series-chart-canvas").querySelectorAll("canvas").length).toBeGreaterThan(0));
      await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
    }
  },
};
