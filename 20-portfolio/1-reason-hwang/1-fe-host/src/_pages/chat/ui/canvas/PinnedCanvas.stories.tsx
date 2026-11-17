import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { PinnedCanvas } from "./PinnedCanvas";
import "./canvas.css";

const exampleItem = {
  id: "report-1:price",
  title: "AAPL 가격",
  program: 'root = Col([Text("AAPL 가격 차트")])',
  messageId: "message-1",
  reportId: "report-1",
  columns: 1 as const,
  height: 380,
  addedAt: "2026-11-17T00:00:00Z",
};

const meta = { title: "Chat/Canvas/PinnedCanvas", component: PinnedCanvas, args: {
  items: [exampleItem], busy: false, onChange: fn(), onClose: fn(), onAsk: fn(),
} } satisfies Meta<typeof PinnedCanvas>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ManagePinnedItem: Story = { play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement);
  await expect(canvas.getByRole("region", { name: "기술적 분석 Canvas" })).toBeVisible();
  await expect(canvasElement.querySelector(".ta-canvas-item")).toHaveStyle({ height: "380px" });
  await expect(canvas.getByRole("button", { name: "PDF 저장 / 인쇄" })).toBeEnabled();
  await userEvent.click(canvas.getByRole("button", { name: "AAPL 가격 제거" }));
  await expect(args.onChange).toHaveBeenCalledOnce();
  await expect(args.onChange.mock.calls[0][0](args.items)).toEqual([]);
  await userEvent.click(canvas.getByRole("button", { name: "접기" }));
  await expect(args.onClose).toHaveBeenCalledOnce();
} };
