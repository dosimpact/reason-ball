import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ModelingView } from "./ModelingView";
import type { ModelingFiling } from "../model/types";
const filing: ModelingFiling = { cik: "0000320193", accessionNo: "0000320193-26-000001", companyName: "Apple", ticker: "AAPL", formType: "10-K", reportDate: "2026-09-26", filingDate: "2026-10-30", hasSource: true, stages: { "1": { status: "SUCCEEDED", generationId: "generation-1", resultCount: 23 }, "2": { status: "UNPROCESSED" }, "3": { status: "UNPROCESSED" } } };
const meta = {
  title: "SEC Modeling/Admin", component: ModelingView,
  args: { cikFilter: "", applyFilter: fn(), filingPage: 1, filingTotal: 1, setFilingPage: fn(), filings: [filing], selected: filing, runs: [], run: null, events: [], result: { generationId: "generation-1", total: 1, items: [{ id: "item-1", itemCode: "1", title: "Business", displayHtml: "<h2>Business</h2><p>Apple designs products.</p>", text: "Apple designs products." }] }, stage: 1, page: 1, loading: false, busy: false, error: "", refresh: fn(), select: fn(), collapse: fn(), applyFilters: fn(), changeStage: fn(), setPage: fn(), inspectRun: fn(), start: fn(), mutateRun: fn(), inspectEvidence: fn(async () => ({})), search: fn(async () => ({ items: [] })) },
} satisfies Meta<typeof ModelingView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = { play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { name: "모델링 2 실행" }));
  await expect(args.start).toHaveBeenCalledWith(2, "gpt-5.6-sol");
  await userEvent.click(canvas.getByText("1 Business", { exact: true }));
  await expect(canvas.getByTitle("Item 미리보기 1")).toHaveAttribute("sandbox", "");
  await userEvent.type(canvas.getByRole("textbox", { name: "검색 질문" }), "business risk");
  await userEvent.click(canvas.getByRole("button", { name: /^검색$/ }));
  await expect(args.search).toHaveBeenCalledWith("business risk");
} };
export const MissingInput: Story = { args: { filings: [{ ...filing, hasSource: false, stages: {} }], selected: { ...filing, hasSource: false, stages: {} } }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  for (const stage of [1, 2, 3]) await expect(canvas.getByRole("button", { name: `모델링 ${stage} 실행` })).toBeDisabled();
} };
export const FailedRun: Story = { args: { run: { id: "failed", runId: "failed", cik: filing.cik, accessionNo: filing.accessionNo, stage: 2, status: "FAILED", error: "Embedding API credential missing", createdAt: "2026-11-14" } }, play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement);
  await expect(canvas.getByRole("button", { name: "실행 취소" })).toBeDisabled();
  await userEvent.click(canvas.getByRole("button", { name: "실패 작업 재시도" }));
  await expect(args.mutateRun).toHaveBeenCalledWith("retry");
} };
export const Running: Story = { args: { busy: true, run: { id: "running", runId: "running", cik: filing.cik, accessionNo: filing.accessionNo, stage: 1, status: "RUNNING", createdAt: "2026-11-14" } } };
export const Empty: Story = { args: { filings: [], filingTotal: 0, selected: null, result: null } };
export const Loading: Story = { args: { filings: [], selected: null, loading: true, overviewLoading: true } };
export const Error: Story = { args: { error: "BFF 연결 실패" }, play: async ({ canvasElement }) => { await expect(within(canvasElement).getByRole("alert")).toHaveTextContent("BFF 연결 실패"); } };

export const CompanyFilter: Story = { play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement);
  await userEvent.type(canvas.getByRole("textbox", { name: "CIK 필터" }), "1834584");
  await userEvent.click(canvas.getByRole("button", { name: "공시 필터 적용" }));
  await expect(args.applyFilters).toHaveBeenCalledWith(expect.objectContaining({ cik: "1834584" }));
} };
export const XbrlReadableFacts: Story = { args: { stage: 3, result: { total: 2, items: [{ id: "fact-1", label: "Revenue", normalizedValue: "26312000000", valueType: "numeric", context: { startDate: "2025-01-01", endDate: "2025-12-31" }, unit: { numerator: ["{iso4217}USD"] } }, { id: "fact-2", label: "Accounting policies", valueType: "text", normalizedValue: "<div>Long disclosure</div>", context: { instantDate: "2025-12-31" } }] } }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await expect(canvas.getByText(/Revenue · 26312000000 USD · 2025-01-01/)).toBeVisible();
  await expect(canvas.getByText(/Accounting policies · 텍스트 공시/)).toBeVisible();
} };

export const SearchToSource: Story = { args: {
  search: fn(async () => ({ items: [{ id: "statement-1", evidenceId: "statement-1", type: "Statement", itemCode: "1A", text: "Risk may affect demand." }] })),
  inspectEvidence: fn(async () => ({ id: "statement-1", itemId: "item-1a", generationId: "g1", isActive: true, text: "Risk may affect demand.", supportingChunks: [{ id: "chunk-1", text: "Original source says adverse economic conditions may affect demand." }], displayHtml: "<h2>Item 1A</h2><p>Original source.</p>" })),
}, play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement);
  await userEvent.type(canvas.getByRole("textbox", { name: "검색 질문" }), "risk");
  await userEvent.click(canvas.getByRole("button", { name: /^검색$/ }));
  await userEvent.click(await canvas.findByRole("button", { name: "근거 보기 1" }));
  await expect(args.inspectEvidence).toHaveBeenCalledWith("statement-1");
  await expect(await canvas.findByText("현재 공개 결과")).toBeVisible();
  await expect(canvas.getByText("Original source says adverse economic conditions may affect demand.")).toBeVisible();
  await expect(canvas.getByTitle("검색 근거 Item 미리보기")).toHaveAttribute("sandbox", "");
} };


const counts = { supported: 42, unsupported: 0, latestRuns: { QUEUED: 1, RUNNING: 2, SUCCEEDED: 10, FAILED: 1, CANCELLED: 0, unprocessed: 28 } };
export const OverviewAndPagination: Story = { args: { selected: null, filingTotal: 42, overview: { scope: "filtered", filters: {}, totalFilings: 42, sourceCollected: 40, sourceMissing: 2, stages: { "1": counts, "2": counts, "3": counts }, retrievedAt: "2026-11-16T00:00:00Z" } }, play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement);
  await expect(canvas.getByRole("region", { name: "모델링 통계" })).toHaveTextContent("42");
  await userEvent.click(canvas.getByRole("button", { name: "다음 공시" }));
  await expect(args.setFilingPage).toHaveBeenCalledWith(2);
  await expect(canvas.getByRole("button", { name: /AAPL .* 모델링 펼치기/ })).toHaveAttribute("aria-expanded", "false");
} };
export const PublicationUnavailable: Story = { args: { filings: [{ ...filing, stages: { "1": { status: "unavailable", readiness: "unavailable", latestRun: { id: "old", runId: "old", cik: filing.cik, accessionNo: filing.accessionNo, stage: 1, status: "SUCCEEDED", createdAt: "2026-11-16" } } } }], overviewError: "통계 연결 실패" } };
