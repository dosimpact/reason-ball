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

export const ToolDetails: Story = {
  args: { activities: [{ id: "tool", label: "SEC 도구 · list_sec_filings", kind: "tool", status: "completed", arguments: { cik: "0000320193" }, result: { items: ["10-K"] } }] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("Behind the scenes"));
    await userEvent.click(canvas.getByText("도구 인자와 결과"));
    await expect(canvas.getByText(/0000320193/)).toBeVisible();
    await expect(canvas.getByText(/10-K/)).toBeVisible();
  },
};

export const MobileLongContent: Story = {
  decorators: [(Story) => <div style={{ width: "100%", maxWidth: 288 }}><Story /></div>],
  args: { activities: [{ id: "long-tool", label: "SEC 도구 · retrieve_company_filing_financial_statement_evidence_with_sources", kind: "tool", status: "unavailable", arguments: { accession: "0000320193-2026-000001", query: "장기적인 매출 변화와 사업부별 위험 요인 분석" }, result: { source: `https://www.sec.gov/Archives/${"long-filing-path/".repeat(12)}`, message: "공시 근거를 확인하지 못했습니다." } }] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText("Behind the scenes"));
    await userEvent.click(canvas.getByText("도구 인자와 결과"));
    await expect(canvas.getByText("생성하지 못함")).toBeVisible();
    const timeline = canvasElement.querySelector<HTMLElement>(".sec-timeline")!;
    await expect(timeline.scrollWidth).toBeLessThanOrEqual(timeline.clientWidth + 1);
    const label = canvasElement.querySelector<HTMLElement>(".openui-tool-call__name")!;
    await expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth + 1);
    await userEvent.click(canvas.getByText("Behind the scenes"));
    await expect(canvas.getByText("생성하지 못함")).not.toBeVisible();
  },
};
