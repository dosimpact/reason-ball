import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { AnswerView } from "./AnswerView";

const meta = { title: "SEC/Intelligent UI Answer", component: AnswerView } satisfies Meta<typeof AnswerView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const EvidenceToggle: Story = {
  args: { onError: fn(), program: 'root = Col([Title("사업 분석", "xl"), Checkbox($showEvidence, "원문 인용 표시"), Card(@Concat([Badge("Item 1 · Business", "info"), Title("Products", "md"), Text("제품과 서비스에 대한 요약입니다.", "md")], $showEvidence ? [Text("We sell devices and services worldwide.", "sm", "muted")] : []))], 4)\n$showEvidence = true' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "사업 분석" })).toBeVisible();
    await expect(canvas.getByText("We sell devices and services worldwide.")).toBeVisible();
    await userEvent.click(canvas.getByRole("checkbox", { name: "원문 인용 표시" }));
    await expect(canvas.queryByText("We sell devices and services worldwide.")).not.toBeInTheDocument();
    await expect(canvas.getByText("제품과 서비스에 대한 요약입니다.")).toBeVisible();
    await expect(args.onError).not.toHaveBeenCalled();
  },
};
