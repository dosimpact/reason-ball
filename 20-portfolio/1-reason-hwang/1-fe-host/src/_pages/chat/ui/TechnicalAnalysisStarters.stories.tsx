import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { AgentConversation } from "@/shared/ui/agent-conversation";
import { canvasAnalysisStarters, inlineAnalysisStarters } from "../model/technicalAnalysisStarters";

const meta = {
  title: "Chat/TechnicalAnalysisStarters",
  component: AgentConversation,
  args: {
    title: "기술적 분석 · 인라인",
    description: "기술적 분석 에이전트와 대화하세요.",
    headerControls: <span>기술적 분석</span>,
    starters: inlineAnalysisStarters,
    messages: [],
    onSend: fn(async () => {}),
  },
} satisfies Meta<typeof AgentConversation>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Inline: Story = { play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement);
  await expect(await canvas.findByRole("button", { name: "20개 지표 종합 점검", exact: true })).toBeVisible();
  for (const starter of inlineAnalysisStarters) await expect(canvas.getByRole("button", { name: starter.displayText, exact: true })).toBeVisible();
  await userEvent.click(canvas.getByRole("button", { name: "RSI 7일·14일 비교", exact: true }));
  await expect(args.onSend).toHaveBeenCalledWith(inlineAnalysisStarters[8].prompt);
} };

export const Canvas: Story = {
  args: { title: "기술적 분석 · Canvas", starters: canvasAnalysisStarters },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("button", { name: "20개 지표 종합 점검", exact: true })).toBeVisible();
    for (const starter of canvasAnalysisStarters) await expect(canvas.getByRole("button", { name: starter.displayText, exact: true })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "20개 지표 종합 점검", exact: true }));
    await expect(args.onSend).toHaveBeenCalledWith(canvasAnalysisStarters[11].prompt);
  },
};
