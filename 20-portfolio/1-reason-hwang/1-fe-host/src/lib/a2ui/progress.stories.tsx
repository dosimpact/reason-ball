import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { ProgressView } from "@/features/a2ui-demo/progress-view";

const meta = { title: "A2UI/Progress", component: ProgressView } satisfies Meta<typeof ProgressView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Composing: Story = {
  args: { progress: { stages: ["connecting", "analyzing", "composing"], status: "running" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent("화면을 구성");
    await expect(canvas.getAllByRole("listitem")).toHaveLength(3);
  },
};
export const Failed: Story = {
  args: { progress: { stages: ["analyzing", "composing", "validating", "retrying"], status: "error" } },
  play: async ({ canvasElement }) => { await expect(within(canvasElement).getByRole("status")).toHaveTextContent("작업 실패"); },
};
export const Stopped: Story = {
  args: { progress: { stages: ["analyzing", "composing"], status: "stopped" } },
  play: async ({ canvasElement }) => { await expect(within(canvasElement).getByRole("status")).toHaveTextContent("중단"); },
};
