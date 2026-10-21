import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { ActivityTimeline } from "./ActivityTimeline";
import "./sec-chat.css";

const meta = { title: "SEC/Activity Timeline", component: ActivityTimeline, args: { activities: [{ id: "1", label: "질문 해석", kind: "node", status: "completed" }, { id: "2", label: "추천 질문 생성", kind: "node", status: "completed" }] } } satisfies Meta<typeof ActivityTimeline>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Completed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("질문 해석")).not.toBeVisible();
    await userEvent.click(canvas.getByText("Behind the scenes"));
    await expect(canvas.getByText("질문 해석")).toBeVisible();
    await userEvent.click(canvas.getByText("Behind the scenes"));
    await expect(canvas.getByText("질문 해석")).not.toBeVisible();
  },
};
export const Working: Story = {
  args: { working: true, activities: [{ id: "1", label: "공시 다운로드", kind: "request", status: "running" }] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Working")).toBeVisible();
    await expect(canvas.getByText("공시 다운로드")).toBeVisible();
    await expect(canvas.getByText("진행 중")).toBeVisible();
  },
};
export const Failed: Story = {
  args: { activities: [{ id: "1", label: "추천 질문 생성", kind: "node", status: "unavailable" }] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("일부 작업 실패")).toBeVisible();
    await userEvent.click(canvas.getByText("Behind the scenes"));
    await expect(canvas.getByText("생성하지 못함")).toBeVisible();
  },
};
export const Cancelled: Story = {
  args: { activities: [{ id: "1", label: "답변 생성", kind: "node", status: "cancelled" }] },
  play: async ({ canvasElement }) => { await expect(within(canvasElement).getByText("중단됨")).toBeVisible(); },
};
