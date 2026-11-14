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
