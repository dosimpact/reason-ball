import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { FollowUpQuestions } from "./FollowUpQuestions";
import "./sec-chat.css";

const meta = { title: "SEC/Follow-up Questions", component: FollowUpQuestions, args: { questions: ["서비스 매출의 비중은 어떻게 돼?", "주요 사업 위험을 알려줘", "현금흐름도 살펴볼까?"], disabled: false, onSelect: fn() } } satisfies Meta<typeof FollowUpQuestions>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SelectQuestion: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("button")).toHaveLength(3);
    await userEvent.click(canvas.getByRole("button", { name: args.questions[0] }));
    await expect(args.onSelect).toHaveBeenCalledWith(args.questions[0]);
  },
};
export const PreviousTurn: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => { for (const button of within(canvasElement).getAllByRole("button")) await expect(button).toBeDisabled(); },
};
export const Unavailable: Story = {
  args: { questions: [] },
  play: async ({ canvasElement }) => { await expect(within(canvasElement).queryByRole("navigation")).not.toBeInTheDocument(); },
};
