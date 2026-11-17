import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { GraphSelector } from "./GraphSelector";

const meta = { title: "Chat/GraphSelector", component: GraphSelector, args: {
  graphs: [{ id: "starter_graph", name: "기본 채팅", description: "일반 대화와 날씨 질문을 처리합니다." }, { id: "technical_analysis_agent", name: "기술적 분석 에이전트" }],
  value: "starter_graph", disabled: false, onChange: fn(),
} } satisfies Meta<typeof GraphSelector>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SelectAgent: Story = { play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement);
  await expect(canvas.getByRole("combobox")).toHaveAccessibleDescription("일반 대화와 날씨 질문을 처리합니다.");
  await userEvent.selectOptions(canvas.getByRole("combobox"), "technical_analysis_agent");
  await expect(args.onChange).toHaveBeenCalledWith("technical_analysis_agent");
} };
export const Running: Story = { args: { disabled: true }, play: async ({ canvasElement }) => {
  await expect(within(canvasElement).getByRole("combobox")).toBeDisabled();
} };

export const DevelopmentGraphIds: Story = {
  args: { showGraphIds: true, graphs: [
    { id: "price_agent", name: "가격 조회", mode: "chat" },
    { id: "technical_analysis_graph", name: "기술적 분석 서브그래프", mode: "chat" },
    { id: "main_graph", name: "Main Graph", mode: "json" },
    { id: "starter_graph", name: "기본 채팅", mode: "chat" },
    { id: "simple_llm", name: "일반 에이전트", mode: "chat" },
  ], value: "price_agent" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    for (const graph of args.graphs) await expect(canvas.getByRole("option", { name: graph.id })).toHaveTextContent(graph.id);
    await expect(canvas.queryByRole("option", { name: /JSON 테스트/ })).not.toBeInTheDocument();
    await userEvent.selectOptions(canvas.getByRole("combobox"), "technical_analysis_graph");
    await expect(args.onChange).toHaveBeenCalledWith("technical_analysis_graph");
  },
};
