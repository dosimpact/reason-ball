import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { AgentConversation, type ConversationMessage } from ".";

function Example() {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  return <AgentConversation title="공통 에이전트" messages={messages} onReset={() => setMessages([])} onSend={async text => {
    setMessages([{ id: "user", role: "user", content: text }, { id: "answer", role: "assistant", content: "", view: <p>검증된 분석 차트</p> }]);
  }} />;
}
const meta = { title: "Shared/AgentConversation", component: Example } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SendAndReset: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const input = await canvas.findByPlaceholderText("메시지를 입력하세요");
  await userEvent.type(input, "AAPL 분석{Enter}");
  await expect(await canvas.findByText("검증된 분석 차트")).toBeVisible();
  await expect(canvas.getByText("AAPL 분석")).toBeVisible();
  await userEvent.type(input, "작성 중 초안");
  await userEvent.click(canvas.getByRole("button", { name: "새 대화" }));
  await expect(canvas.getByPlaceholderText("메시지를 입력하세요")).toHaveValue("");
  await expect(canvas.queryByText("검증된 분석 차트")).not.toBeInTheDocument();
} };

function ExternalExample() {
  const [busy, setBusy] = useState(false);
  return <><button onClick={() => setBusy(true)}>화면 액션 실행</button><AgentConversation title="화면 액션" messages={[]} busy={busy} onSend={async () => {}} onCancel={() => setBusy(false)} /></>;
}
export const ExternalActionCancel: Story = { render: () => <ExternalExample />, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const input = await canvas.findByPlaceholderText("메시지를 입력하세요");
  await userEvent.click(canvas.getByRole("button", { name: "화면 액션 실행" }));
  await expect(input).toBeDisabled();
  await userEvent.click(canvas.getByRole("button", { name: "답변 중단" }));
  await expect(input).toBeEnabled();
} };
