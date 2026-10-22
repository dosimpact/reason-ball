import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { TurnView } from "./TurnView";
const meta = { title: "Examples/PushUIMessage/Turn", component: TurnView } satisfies Meta<typeof TurnView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Running: Story = {
  args: { turn: { id: "one", question: "서울 매출을 조사해줘", answer: "", status: "running", steps: [
    { id: "model", title: "도구 선택", status: "completed" },
    { id: "query", title: "데이터 조회 · 예제 매출 집계", status: "running" },
  ] } },
  play: async ({ canvasElement }) => { const canvas = within(canvasElement); await expect(canvas.getByText("Assistant · 진행 중")).toBeVisible(); await expect(canvas.getByText("실행 진행 정보 (2)")).toBeVisible(); },
};
export const Completed: Story = {
  args: { turn: { ...Running.args!.turn, status: "completed", answer: "서울의 데모 매출은 200,000입니다.", steps: Running.args!.turn.steps.map(step => ({ ...step, status: "completed" })) } },
  play: async ({ canvasElement }) => { await expect(within(canvasElement).getByText("서울의 데모 매출은 200,000입니다.")).toBeVisible(); },
};
export const Failed: Story = {
  args: { turn: { ...Running.args!.turn, status: "failed", error: "모델 연결 실패", steps: [{ id: "model", title: "모델 요청", status: "failed" }] } },
  play: async ({ canvasElement }) => { await expect(within(canvasElement).getByRole("alert")).toHaveTextContent("모델 연결 실패"); },
};
