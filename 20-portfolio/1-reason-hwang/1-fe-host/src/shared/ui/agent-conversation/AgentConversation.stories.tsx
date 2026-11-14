import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { AgentConversation, ConversationText, type ConversationMessage } from ".";

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
  const input = await canvas.findByRole("textbox");
  await userEvent.type(input, "AAPL 분석{Enter}");
  await expect(await canvas.findByText("검증된 분석 차트")).toBeVisible();
  await expect(canvas.getByText("AAPL 분석")).toBeVisible();
  await userEvent.type(canvas.getByRole("textbox"), "작성 중 초안");
  await userEvent.click(canvas.getByRole("button", { name: "새 대화" }));
  await expect(canvas.getByRole("textbox")).toHaveValue("");
  await expect(canvas.queryByText("검증된 분석 차트")).not.toBeInTheDocument();
} };

function ExternalExample() {
  const [busy, setBusy] = useState(false);
  return <><button onClick={() => setBusy(true)}>화면 액션 실행</button><AgentConversation title="화면 액션" messages={[]} busy={busy} onSend={async () => {}} onCancel={() => setBusy(false)} /></>;
}
export const ExternalActionCancel: Story = { render: () => <ExternalExample />, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await canvas.findByRole("textbox");
  await userEvent.click(canvas.getByRole("button", { name: "화면 액션 실행" }));
  await expect(canvas.getByRole("textbox")).toBeDisabled();
  await userEvent.click(canvas.getByRole("button", { name: "답변 중단" }));
  await expect(canvas.getByRole("textbox")).toBeEnabled();
} };


export const MarkdownAnswer: Story = {
  render: () => <ConversationText text={'## 검증 제목\n\n**강조 문장**과 `code`를 표시합니다.\n\n| 지표 | 값 |\n| --- | --- |\n| RSI | 60.9 |'} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("heading", { name: "검증 제목" })).toBeVisible();
    await expect(canvas.getByText("강조 문장")).toBeVisible();
    await expect(canvas.getByRole("table")).toBeVisible();
  },
};
