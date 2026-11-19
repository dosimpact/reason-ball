import type { Message } from "@openuidev/react-ui";
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
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

function NativeToolsExample({ error = false }: { error?: boolean }) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [nativeMessages, setNativeMessages] = useState<Message[]>([]);
  const [executing, setExecuting] = useState(new Set<string>());
  return <AgentConversation title="네이티브 도구" messages={messages} nativeMessages={nativeMessages} executingToolCallIds={executing} onSend={async text => {
    const user: Message = { id: "native-user", role: "user", content: text };
    const answer: Message = { id: "native-answer", role: "assistant", content: "", toolCalls: [{ id: "native-tool", type: "function", function: { name: "get_price_ohlcv", arguments: "{}" } }] };
    setMessages([{ id: "native-user", role: "user", content: text }, { id: "native-answer", role: "assistant", content: "" }]);
    setNativeMessages([user, answer]); setExecuting(new Set(["native-tool"]));
    await new Promise(resolve => setTimeout(resolve, 700));
    setMessages([{ id: "native-user", role: "user", content: text }, { id: "native-answer", role: "assistant", content: "분석 본문", view: <p>검증된 최종 분석 본문</p> }]);
    setNativeMessages([user, { ...answer, content: "분석 본문" }, { id: "native-result", role: "tool", toolCallId: "native-tool", content: error ? "" : "완료", ...(error ? { error: "도구 실행에 실패했습니다." } : {}) }]);
    setExecuting(new Set());
  }} />;
}
export const NativeTimelineBeforeAnswer: Story = { render: () => <NativeToolsExample />, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.type(await canvas.findByRole("textbox"), "도구 확인{Enter}");
  await waitFor(() => expect(Array.from(canvasElement.querySelectorAll<HTMLElement>(".openui-behind-the-scenes")).filter(element => element.getBoundingClientRect().height > 0)).toHaveLength(1));
  await waitFor(() => expect(canvasElement.querySelector(".openui-behind-the-scenes:has(.openui-tool-call) button.openui-behind-the-scenes__toggle")).not.toBeNull());
  const pendingToggle = canvasElement.querySelector<HTMLButtonElement>(".openui-behind-the-scenes:has(.openui-tool-call) button.openui-behind-the-scenes__toggle")!;
  await userEvent.click(pendingToggle);
  const answer = await canvas.findByText("검증된 최종 분석 본문");
  await expect(canvas.getByRole("button", { name: /Behind the scenes/ })).toHaveAttribute("aria-expanded", "true");
  const tray = canvasElement.querySelector(".openui-behind-the-scenes");
  await expect(tray).not.toBeNull();
  await expect(!!(tray!.compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  await expect(canvas.queryByTestId("chat-tool-activity")).not.toBeInTheDocument();
  await waitFor(() => expect(canvasElement.querySelector(".openui-tool-call")).not.toBeNull());
  await expect(canvasElement.textContent).not.toContain("secret");
} };
export const NativeTimelineError: Story = { render: () => <NativeToolsExample error />, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.type(await canvas.findByRole("textbox"), "오류 확인{Enter}");
  await canvas.findByText("검증된 최종 분석 본문");
  await userEvent.click(canvas.getByRole("button", { name: /Behind the scenes/ }));
  await waitFor(() => expect(canvasElement.querySelector(".openui-tool-call")).not.toBeNull());
} };

function GroupedStarterExample() {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [busy, setBusy] = useState(false);
  return <><button onClick={() => setBusy(true)}>외부 실행</button><AgentConversation title="주제별 질문" busy={busy} messages={messages} onReset={() => setMessages([])}
    starterGroups={[
      { title: "추세", description: "이동평균의 방향을 비교합니다.", starters: [{ displayText: "이동평균 비교", prompt: "AAPL의 SMA20과 SMA60을 비교해 줘." }] },
      { title: "모멘텀", starters: [{ displayText: "RSI 비교", prompt: "AAPL의 RSI7과 RSI14를 비교해 줘." }] },
    ]}
    onSend={async text => setMessages([{ id: "grouped-user", role: "user", content: text }])} /></>;
}
export const GroupedStarters: Story = { render: () => <GroupedStarterExample />, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await expect(await canvas.findByRole("button", { name: "이동평균 비교" })).toBeVisible();
  await expect(canvas.queryByRole("button", { name: "RSI 비교" })).not.toBeInTheDocument();
  await userEvent.click(canvas.getByText("모멘텀", { selector: "h3" }));
  await userEvent.click(await canvas.findByRole("button", { name: "RSI 비교" }));
  await expect(await canvas.findByText("AAPL의 RSI7과 RSI14를 비교해 줘.")).toBeVisible();
  await expect(canvas.queryByRole("button", { name: "이동평균 비교" })).not.toBeInTheDocument();
  await userEvent.click(canvas.getByRole("button", { name: "새 대화" }));
  await expect(await canvas.findByRole("button", { name: "이동평균 비교" })).toBeVisible();
  await userEvent.click(canvas.getByRole("button", { name: "외부 실행" }));
  await expect(canvas.queryByRole("button", { name: "이동평균 비교" })).not.toBeInTheDocument();
  await expect(canvas.getByRole("textbox")).toBeDisabled();
} };
