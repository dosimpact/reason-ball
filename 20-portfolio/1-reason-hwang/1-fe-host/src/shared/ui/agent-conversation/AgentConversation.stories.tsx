import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { SidebarProvider, SidebarTrigger } from "@/shared/ui/sidebar";
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

export const CompactHeader: Story = { render: () => <SidebarProvider><AgentConversation title="에이전트" welcomeTitle="무엇을 도와드릴까요?" description="선택한 에이전트와 대화하세요." messages={[]} onSend={async () => {}} headerLeading={<SidebarTrigger aria-label="메뉴 열기" className="md:hidden" />} headerControls={<div className="agent-conversation__header-controls"><label className="agent-conversation__graph-selector"><span className="sr-only">에이전트 선택</span><select aria-label="에이전트 선택" className="h-9 w-full rounded-lg border bg-background px-2"><option>기술적 분석 에이전트</option></select></label><button type="button">대화 기록</button></div>} /></SidebarProvider>, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await expect(await canvas.findByRole("combobox", { name: "에이전트 선택" })).toBeVisible();
  await expect(canvas.getByRole("button", { name: "새 대화" })).toBeVisible();
  await expect(canvas.getAllByText("선택한 에이전트와 대화하세요.")).toHaveLength(1);
  await expect(canvas.queryByText("Ready")).not.toBeInTheDocument();
  await expect(canvas.getByRole("textbox")).toHaveAttribute("placeholder", "메시지를 입력하세요");
} };

export const PopulatedCompactHeader: Story = { render: () => <SidebarProvider><AgentConversation title="에이전트" messages={[{ id: "user-layout", role: "user", content: "상단 메뉴 아래에서 대화가 시작되어야 합니다." }, { id: "assistant-layout", role: "assistant", content: "완료", view: <div>{Array.from({ length: 25 }, (_, index) => <p key={index}>분석 결과 {index + 1}</p>)}</div> }]} onSend={async () => {}} headerLeading={<SidebarTrigger aria-label="메뉴 열기" className="md:hidden" />} headerControls={<div className="agent-conversation__header-controls"><select aria-label="에이전트 선택" className="h-9 min-w-0 flex-1 rounded border"><option>기술적 분석 에이전트</option></select><button type="button">대화 기록</button></div>} /></SidebarProvider>, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await canvas.findByRole("textbox");
  const scroll = canvasElement.querySelector<HTMLElement>(".openui-agent-thread-scroll-area");
  if (scroll) scroll.scrollTop = 0;
  const headers = Array.from(canvasElement.querySelectorAll<HTMLElement>(".openui-agent-thread-header,.openui-agent-mobile-header")).filter(element => element.getBoundingClientRect().height > 0);
  const headerBottom = Math.max(...headers.map(element => element.getBoundingClientRect().bottom));
  const firstMessage = canvas.getByText("상단 메뉴 아래에서 대화가 시작되어야 합니다.");
  await expect(firstMessage.getBoundingClientRect().top).toBeGreaterThanOrEqual(headerBottom);
} };
