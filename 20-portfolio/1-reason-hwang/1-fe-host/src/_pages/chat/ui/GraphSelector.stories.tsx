import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { GraphSelector } from "./GraphSelector";

const meta = { title: "Chat/GraphSelector", component: GraphSelector, args: {
  graphs: [{ id: "starter_graph", name: "기본 채팅" }, { id: "technical_analysis_agent", name: "기술적 분석 에이전트" }],
  value: "starter_graph", disabled: false, onChange: fn(),
} } satisfies Meta<typeof GraphSelector>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SelectAgent: Story = { play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement);
  await userEvent.selectOptions(canvas.getByRole("combobox"), "technical_analysis_agent");
  await expect(args.onChange).toHaveBeenCalledWith("technical_analysis_agent");
} };
export const Running: Story = { args: { disabled: true }, play: async ({ canvasElement }) => {
  await expect(within(canvasElement).getByRole("combobox")).toBeDisabled();
} };
