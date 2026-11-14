import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { ChatActivity } from "./ChatActivity";
import "@openuidev/react-ui/styles/index.css";
const meta = { title: "Chat/ChatActivity", component: ChatActivity } satisfies Meta<typeof ChatActivity>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Running: Story = { args: { streaming: true, activities: [{ id: "price", name: "get_price_ohlcv", status: "running" }] }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await expect(canvas.getByRole("button", { name: "Working..." })).toHaveAttribute("aria-expanded", "true");
  await expect(canvas.getByText("실행 중")).toBeVisible();
} };
export const Completed: Story = { args: { activities: [{ id: "price", name: "get_price_ohlcv", status: "complete" }, { id: "analysis", name: "analyze_ohlcv_with_talib", status: "error" }] }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const toggle = canvas.getByRole("button", { name: "Behind the scenes" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await userEvent.click(toggle);
  await expect(canvas.getByText("get_price_ohlcv")).toBeVisible();
  await expect(canvas.getByText("완료")).toBeVisible();
  await expect(canvas.getByText("오류")).toBeVisible();
  await userEvent.click(toggle);
  await expect(canvas.queryByRole("list")).not.toBeInTheDocument();
} };
export const NoTools: Story = { args: { activities: [] }, play: async ({ canvasElement }) => { await expect(within(canvasElement).queryByTestId("chat-tool-activity")).not.toBeInTheDocument(); } };
