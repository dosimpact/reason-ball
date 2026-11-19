import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { EvidenceView, type Evidence } from "./EvidenceView";

const original: Evidence = {
  filing: { cik: "0000320193", accessionNo: "fixture-10k", filingDate: "2025-11-01" },
  sourceUrl: "https://www.sec.gov/", checkedAt: null, coverage: { "8": { used: 100, total: 200 } },
  findings: [{ item: "8", heading: "재무제표", quote: "원문 Item 인용은 별도로 유지됩니다." }],
  limitations: "Fixture 데이터이며 실제 공시 수치가 아닙니다.",
};
const meta = { title: "SEC Chat/Evidence", component: EvidenceView, args: { evidence: original } } satisfies Meta<typeof EvidenceView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Published: Story = {
  args: { evidence: { ...original, modeling: { filingId: "filing-fixture", status: "available", toolCalls: ["query_sec_xbrl_facts"], limitations: ["선택된 게시 근거만 표시합니다."], sources: [{ evidenceId: "fact-123", filingId: "filing-fixture", conceptQName: "{http://fasb.org/us-gaap/2025}Revenue", normalizedValue: "123000000", rawValue: "123", period: { startDate: "2024-10-01", endDate: "2025-09-30" }, unit: '{"numerator":["USD"],"denominator":[]}', text: "모델링 사실의 근거 설명" }] } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("원문 Item 인용은 별도로 유지됩니다.")).toBeVisible();
    const selected = within(canvas.getByRole("region", { name: "모델링 검색 근거" }));
    await expect(selected.getByText("123000000")).toBeVisible();
    await expect(selected.getByText("2024-10-01 ~ 2025-09-30")).toBeVisible();
    await expect(selected.getByText("USD")).toBeVisible();
    await expect(selected.getByText("fact-123")).toBeVisible();
  },
};
export const Empty: Story = { args: { evidence: { ...original, modeling: { filingId: "filing-fixture", status: "empty", toolCalls: [], sources: [], limitations: ["게시된 모델링 결과가 없습니다."] } } } };
export const Unavailable: Story = { args: { evidence: { ...original, modeling: { filingId: "filing-fixture", status: "unavailable", toolCalls: [], sources: [], limitations: ["모델링 서비스에 연결하지 못했습니다."] } } } };
