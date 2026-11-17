import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { AgentConversation } from "@/shared/ui/agent-conversation";
import { canvasAnalysisStarterGroups, inlineAnalysisStarterGroups } from "../model/technicalAnalysisStarters";
import { generalStarterGroups, secResearchStarterGroups, secModelingStarterGroups } from "../model/chatStarters";
import { talibStarterGroups } from "../model/talibStarters";

const meta = {
  title: "Chat/TechnicalAnalysisStarters",
  component: AgentConversation,
  decorators: [Story => <div style={{ width: 1100, height: 900 }}><Story /></div>],
  parameters: { layout: "fullscreen" },
  args: {
    title: "기술적 분석 · 인라인",
    starterGroups: inlineAnalysisStarterGroups,
    messages: [],
    onSend: fn(async () => {}),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByLabelText("주제별 시작 질문")).toBeVisible();
    const groups = args.starterGroups!;
    for (const [index, group] of groups.entries()) {
      const heading = canvas.getByRole("heading", { name: group.title });
      const detail = heading.closest("details")!;
      await expect(detail.open).toBe(index === 0);
      if (!detail.open) await userEvent.click(heading);
      for (const starter of group.starters) {
        await expect(within(detail).getByRole("button", { name: starter.displayText })).toBeVisible();
      }
    }
    const lastGroup = groups[groups.length - 1];
    const last = lastGroup.starters[lastGroup.starters.length - 1];
    const detail = canvas.getByRole("heading", { name: lastGroup.title }).closest("details")!;
    await userEvent.click(within(detail).getByRole("button", { name: last.displayText }));
    await expect(args.onSend).toHaveBeenCalledWith(last.prompt);
  },
} satisfies Meta<typeof AgentConversation>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Inline: Story = {};
export const Canvas: Story = { args: { title: "기술적 분석 · Canvas", starterGroups: canvasAnalysisStarterGroups } };
export const General: Story = { args: { title: "AI Chat", starterGroups: generalStarterGroups } };
export const Research: Story = { args: { title: "SEC Research Chat", starterGroups: secResearchStarterGroups } };
export const Modeling: Story = { args: { title: "SEC Modeling Chat", starterGroups: secModelingStarterGroups } };
export const Talib: Story = { args: { title: "TA-Lib 채팅", starterGroups: talibStarterGroups } };
