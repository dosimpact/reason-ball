import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { useState } from "react";
import { AgentConversation, type ConversationMessage } from "@/shared/ui/agent-conversation";
import { secApiAgentStarterGroups } from "../model/starters";
import SecApiAgentPage from "./page";

const meta = { title: "SEC/API Agent", component: SecApiAgentPage } satisfies Meta<typeof SecApiAgentPage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Welcome: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("heading", { name: "SEC 데이터로 무엇을 할까요?" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "AAPL 기업 검색" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "수집 실패 시 대응" })).not.toBeVisible();
    await expect(canvas.getByRole("textbox")).toBeVisible();
  },
};

function GroupedStarterPreview() {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  return <AgentConversation title="SEC API Agent" starterGroups={secApiAgentStarterGroups} messages={messages}
    onSend={async prompt => setMessages([{ id: "starter", role: "user", content: prompt }])}
    onReset={() => setMessages([])} />;
}

export const GroupedStarters: Story = {
  render: () => <GroupedStarterPreview />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("button", { name: "AAPL 기업 검색" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "수집 실패 시 대응" })).not.toBeVisible();
    for (const group of secApiAgentStarterGroups.slice(1)) {
      await userEvent.click(canvas.getByText(group.title, { selector: "h3" }));
      for (const starter of group.starters) await expect(canvas.getByRole("button", { name: starter.displayText })).toBeVisible();
    }
    const last = secApiAgentStarterGroups.at(-1)!.starters.at(-1)!;
    await userEvent.click(canvas.getByRole("button", { name: last.displayText }));
    await expect(await canvas.findByText(last.prompt)).toBeVisible();
  },
};
