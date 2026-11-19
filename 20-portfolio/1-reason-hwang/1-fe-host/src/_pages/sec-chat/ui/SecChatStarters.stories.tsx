import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { AgentConversation, type ConversationMessage } from "@/shared/ui/agent-conversation";
import { secChatStarterGroups } from "../model/starters";

function SecChatStarterPreview() {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  return <AgentConversation title="SEC Intelligent Research Chat" starterGroups={secChatStarterGroups} messages={messages}
    onSend={async prompt => setMessages([{ id: "starter", role: "user", content: prompt }])}
    onReset={() => setMessages([])} />;
}

const meta = { title: "SEC/Research Chat Starters", component: SecChatStarterPreview } satisfies Meta<typeof SecChatStarterPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const GroupedStarters: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("button", { name: "10-K 읽는 순서" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "수집 범위 먼저 설명" })).not.toBeVisible();
    for (const group of secChatStarterGroups.slice(1)) {
      await userEvent.click(canvas.getByText(group.title, { selector: "h3" }));
      for (const starter of group.starters) await expect(canvas.getByRole("button", { name: starter.displayText })).toBeVisible();
    }
    const last = secChatStarterGroups.at(-1)!.starters.at(-1)!;
    await userEvent.click(canvas.getByRole("button", { name: last.displayText }));
    await expect(await canvas.findByText(last.prompt)).toBeVisible();
  },
};
