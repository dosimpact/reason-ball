import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { CopilotChatView, CopilotKitProvider } from "@copilotkit/react-core/v2";
import { ChatViewport } from "@/features/a2ui-demo/chat-viewport";
import "@copilotkit/react-core/v2/styles.css";

const meta = { title: "A2UI/Chat viewport", component: ChatViewport } satisfies Meta<typeof ChatViewport>;
export default meta;
type Story = StoryObj<typeof meta>;
export const LongConversation: Story = {
  args: { children: null },
  render: () => <CopilotKitProvider><ChatViewport><CopilotChatView messages={Array.from({ length: 30 }, (_, index) => ({ id: `message-${index}`, role: "assistant" as const, content: `공시 분석 결과 ${index + 1}. 원문 근거와 설명을 확인합니다.` }))} /></ChatViewport></CopilotKitProvider>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const frame = canvas.getByLabelText("채팅 결과");
    await expect(canvas.getByText(/공시 분석 결과 30/)).toBeInTheDocument();
    await expect(frame.getBoundingClientRect().height).toBeLessThanOrEqual(Math.min(window.innerHeight * 0.7, 900) + 1);
    const scrollable = Array.from(frame.querySelectorAll<HTMLElement>("div")).find(element => /auto|scroll/.test(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 100);
    await expect(scrollable).toBeDefined();
    scrollable!.scrollTop = 0;
    await expect(scrollable!.scrollTop).toBe(0);
  },
};
