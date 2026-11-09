import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { ChatMessageList } from "./ChatMessageList";

const meta = { title: "Chat/AnalysisMessages", component: ChatMessageList } satisfies Meta<typeof ChatMessageList>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Charts: Story = { args: { messages: [{ id: "a", role: "assistant", content: "RSI 중립", createdAt: "2026-11-08", status: "complete", presentationId: "p1", program: 'root = Col([Title("기술적 분석"), Chart("line", [{"date":"2026-11-06","close":100},{"date":"2026-11-07","close":102}], "date", ["close"])])' }] }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await expect(canvas.getByRole("heading", { name: "기술적 분석" })).toBeVisible();
  await expect(canvas.getByRole("img", { name: /line chart/ })).toBeVisible();
} };
export const Failure: Story = { args: { messages: [{ id: "a", role: "assistant", content: "가격 조회에 실패했습니다.", createdAt: "2026-11-08", status: "error" }] }, play: async ({ canvasElement }) => {
  await expect(within(canvasElement).getByText("가격 조회에 실패했습니다.")).toBeVisible();
} };
