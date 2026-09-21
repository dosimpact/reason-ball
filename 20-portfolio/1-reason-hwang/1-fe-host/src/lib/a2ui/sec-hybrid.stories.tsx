import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import fixtures from "../../../../assets/a2ui/sec-hybrid-fixtures.json";
import { SecPreview } from "./sec-preview";

const meta = { title: "A2UI/SEC Hybrid", component: SecPreview } satisfies Meta<typeof SecPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const RiskCards: Story = {
  args: { operations: fixtures.cards },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/\[E1\] Service interruptions/)).toBeVisible();
    await expect(canvas.queryByText("핵심 요약")).not.toBeInTheDocument();
    await expect(canvas.queryByText("재무 분석")).not.toBeInTheDocument();
  },
};

export const RiskTable: Story = {
  args: { operations: fixtures.table },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("columnheader", { name: "원문 근거" })).toBeVisible();
    await expect(canvas.getByText(/\[E1\] Service interruptions/)).toBeVisible();
    const viewport = canvas.getByRole("table").parentElement!;
    await expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth + 1);
  },
};

export const RiskAccordion: Story = {
  args: { operations: fixtures.accordion },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "위험 요인" }));
    await expect(await canvas.findByText(/\[E1\] Service interruptions/)).toBeVisible();
  },
};

export const EmptyFilings: Story = {
  args: { operations: fixtures.empty },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("조건에 맞는 공시가 없습니다. 필터를 변경해 주세요.")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "공시 필터 적용" })).toBeEnabled();
    await expect(canvas.queryByRole("button", { name: "분석·요약 보고서 생성" })).not.toBeInTheDocument();
    await expect(canvas.queryByText("선택 공시 분석 보고서")).not.toBeInTheDocument();
  },
};
