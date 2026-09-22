import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import fixtures from "../../../../assets/a2ui/sec-ux-fixtures.json";
import { SurfaceReadOnly } from "./readonly";
import { SecPreview } from "./sec-preview";
import { SecWelcomeView } from "@/features/a2ui-demo/sec-welcome";
import { SurfaceFrame } from "@/features/a2ui-demo/surface-frame";
import { ProgressView } from "@/features/a2ui-demo/progress-view";

const meta = { title: "A2UI/SEC UX", component: SecPreview } satisfies Meta<typeof SecPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const DirectCompany: Story = {
  args: { operations: fixtures.companies },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Coupang, Inc.")).toBeVisible();
    await expect(canvas.queryByRole("combobox")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("table")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "CPNG 공시 보기" }));
    await expect(canvas.getByLabelText("SEC action")).toHaveTextContent('"cik":"0001834584"');
  },
};
export const DirectFiling: Story = {
  args: { operations: fixtures.filings },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("연간보고서 (10-K) · 분석 가능 · 1건")).toBeVisible();
    await expect(canvas.queryByRole("combobox")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "추가 조건" }));
    await expect(canvas.getByRole("combobox", { name: "공시 종류" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "10-K · 2026-02-26 선택" }));
    await expect(canvas.getByLabelText("SEC action")).toHaveTextContent('"accession":"0001834584-26-000024"');
  },
};
export const AnalysisChoices: Story = {
  args: { operations: fixtures.selected },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/보고기간 2025-12-31/)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "위험 요인" }));
    await expect(canvas.getByLabelText("SEC action")).toHaveTextContent('"request":"위험 요인만 표로 정리해줘"');
    await userEvent.click(canvas.getByRole("button", { name: "직접 분석 요청하기" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "어떤 내용을 분석할까요?" }), "매출만");
    await userEvent.click(canvas.getByRole("button", { name: "분석 요청" }));
    await expect(canvas.getByLabelText("SEC action")).toHaveTextContent('"request":"매출만"');
  },
};
export const UnavailableOriginal: Story = {
  args: { operations: fixtures.unavailable },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText(/원문이 저장되지 않아 분석할 수 없습니다/)).toBeVisible();
    for (const name of ["핵심 요약", "위험 요인", "전체 분석"]) await expect(canvas.getByRole("button", { name })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "다른 공시 선택" })).toBeEnabled();
  },
};
export const EmptyScope: Story = {
  args: { operations: fixtures.empty },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("현재 조건에 맞는 공시가 없습니다")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "전체 공시" })).toBeEnabled();
    await expect(canvas.queryByRole("button", { name: /10-K .* 선택/ })).not.toBeInTheDocument();
  },
};
const choose = fn();
export const ClearStart: Story = {
  render: () => <SecWelcomeView input={<input aria-label="회사 질문" />} busy={false} onChoose={choose} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "쿠팡 CPNG" }));
    await expect(choose).toHaveBeenCalledWith("CPNG 회사를 찾아줘");
  },
};
export const FoldedHistory: Story = {
  render: () => <SurfaceFrame historical canvas={false} title="Coupang · 공시 선택"><SurfaceReadOnly.Provider value><SecPreview operations={fixtures.selected} /></SurfaceReadOnly.Provider></SurfaceFrame>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "핵심 요약" })).not.toBeVisible();
    await userEvent.click(canvas.getByText(/이전 결과 · Coupang/));
    await expect(canvas.getByRole("button", { name: "핵심 요약" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "핵심 요약" })).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "접수번호 · 원본/수정본 정보" }));
    await expect(canvas.getByText(/접수번호: 0001834584-26-000024/)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "직접 분석 요청하기" }));
    await expect(canvas.getByRole("textbox", { name: "어떤 내용을 분석할까요?" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: /^분석 요청$/ })).toBeDisabled();
  },
};
export const CompactProgress: Story = {
  render: () => <ProgressView compact progress={{ stages: ["connecting", "analyzing", "analyzing"], status: "running" }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent("요청을 처리");
    await expect(canvas.queryByRole("list")).not.toBeInTheDocument();
  },
};
