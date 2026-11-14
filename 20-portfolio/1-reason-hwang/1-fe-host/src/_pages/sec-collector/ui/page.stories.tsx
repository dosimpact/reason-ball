import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import SecCollectorPage from "./page";
import { collectorServices, type CollectorServices } from "./useSecCollector";
import type { Company, Filing } from "../model/types";

const companies: Company[] = [{ cik: "0000320193", ticker: "AAPL", name: "Apple Inc.", sic: 3571, updatedAt: "2026-11-14T00:00:00Z" }, { cik: "0000789019", ticker: "MSFT", name: "Microsoft Corporation", sic: 7372, updatedAt: "2026-11-14T00:00:00Z" }];
const filings: Filing[] = [{ cik: "0000320193", accessionNo: "0000320193-26-000001", formType: "10-K", filingDate: "2026-10-30", reportDate: "2026-09-30", status: "downloaded", parserStatus: "", errorMessage: null, retryCount: 0, filingUrl: "https://www.sec.gov/Archives/aapl.htm", updatedAt: "2026-11-14T00:00:00Z", documentSizeBytes: "1234" }, { cik: "0000789019", accessionNo: "0000789019-26-000002", formType: "10-K/A", filingDate: "2026-11-01", reportDate: "2026-06-30", status: "failed", parserStatus: "", errorMessage: "다운로드 실패", retryCount: 1, filingUrl: "https://www.sec.gov/Archives/msft.htm", updatedAt: "2026-11-14T00:00:00Z" }];
function list<T>(items: T[], filters: { page: number; pageSize: number }) { return { filters, items, pagination: { page: filters.page, pageSize: filters.pageSize, totalItems: items.length, totalPages: items.length ? 1 : 0, hasNextPage: false } }; }
const fixture: CollectorServices = {
  ...collectorServices,
  fetchOverview: async () => ({ companies: 2, totalFilings: 2, pending: 0, downloaded: 1, failed: 1, retrievedAt: "2026-11-14T00:00:00Z" }),
  fetchCompanies: async filters => list(companies.filter(company => !filters.q || `${company.name} ${company.ticker}`.toLowerCase().includes(filters.q.toLowerCase())), filters),
  fetchFilings: async filters => list(filings.filter(filing => (!filters.cik || filing.cik === filters.cik) && (!filters.status || filing.status === filters.status)), filters),
  syncCompanies: fn(async () => ({ job: "companies:sync", correlationId: "test", requestedAt: "2026-11-14", syncedCount: 2 })),
  streamCollection: fn(async (_kind, _input, onEvent) => {
    onEvent({ type: "started", data: { startedAt: "2026-11-14" } });
    onEvent({ type: "progress", data: { phase: "metadata", processed: 1 } });
    await new Promise(resolve => setTimeout(resolve, 100));
    const result = { metadataProcessed: 1, documentsDownloaded: 1, failed: 0 };
    onEvent({ type: "completed", data: result });
    return { status: "completed" as const, result };
  }),
};
const meta = { title: "SEC Collector/Dashboard", component: SecCollectorPage, args: { services: fixture } } satisfies Meta<typeof SecCollectorPage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const OverviewAndDetail: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await waitFor(() => expect(canvas.getByRole("checkbox", { name: "기업 선택 AAPL" })).toBeVisible());
  await userEvent.click(canvas.getByRole("button", { name: "공시 상세 0000320193-26-000001" }));
  await expect(canvas.getByRole("link", { name: /저장 원문/ })).toHaveAttribute("target", "_blank");
  await expect(canvas.getByRole("link", { name: /저장 원문/ })).toHaveAttribute("rel", "noopener noreferrer");
  await userEvent.click(canvas.getByRole("button", { name: "공시 보기 AAPL" }));
  await waitFor(() => expect(canvas.getByText("현재 조회 범위: CIK 0000320193")).toBeVisible());
  await expect(canvas.getByLabelText("CIK")).toHaveValue("0000320193");
} };
export const SelectedCollection: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await waitFor(() => expect(canvas.getByRole("checkbox", { name: "기업 선택 AAPL" })).toBeVisible());
  await userEvent.click(canvas.getByRole("checkbox", { name: "기업 선택 AAPL" }));
  await userEvent.click(canvas.getByRole("button", { name: "선택 기업 수집 준비" }));
  const confirmation = within(canvas.getByRole("region", { name: "수집 실행 확인" }));
  await expect(confirmation.getByRole("button", { name: "수집 시작" })).toBeDisabled();
  await expect(confirmation.getByText(/"years": 20/)).toBeVisible();
  await userEvent.click(confirmation.getByRole("checkbox", { name: "수집 대상과 기간을 확인했습니다." }));
  await userEvent.click(confirmation.getByRole("button", { name: "수집 시작" }));
  await waitFor(() => expect(canvas.getByText("완료", { exact: true })).toBeVisible());
  await expect(canvas.getByText("선택 기업 수집", { exact: true })).toBeVisible();
} };
export const BulkConfirmation: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { name: "전체 기업 수집 준비" }));
  await expect(canvas.getByText("전체 기업 수집 확인", { exact: true })).toBeVisible();
  await expect(canvas.getByRole("button", { name: "수집 시작" })).toBeDisabled();
} };
export const Empty: Story = { args: { services: { ...fixture, fetchCompanies: async filters => list([], filters), fetchFilings: async filters => list([], filters) } } };
export const ApiFailure: Story = { args: { services: { ...fixture, fetchOverview: async () => { throw new Error("BFF 연결 실패"); } } }, play: async ({ canvasElement }) => { await waitFor(() => expect(within(canvasElement).getByRole("alert")).toHaveTextContent("BFF 연결 실패")); } };
export const ScopeAndFilterReset: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await waitFor(() => expect(canvas.getByRole("button", { name: "공시 보기 MSFT" })).toBeVisible());
  await userEvent.type(canvas.getByLabelText("티커", { exact: true }), "AAPL");
  await userEvent.click(canvas.getByRole("button", { name: "공시 조회" }));
  await userEvent.click(canvas.getByRole("button", { name: "공시 보기 MSFT" }));
  await waitFor(() => expect(canvas.getByLabelText("CIK", { exact: true })).toHaveValue("0000789019"));
  await expect(canvas.getByLabelText("티커", { exact: true })).toHaveValue("");
  await userEvent.type(canvas.getByLabelText("양식", { exact: true }), "10-K/A");
  await userEvent.selectOptions(canvas.getByLabelText("다운로드 상태"), "failed");
  await userEvent.click(canvas.getByRole("button", { name: "전체 공시" }));
  await waitFor(() => expect(canvas.getByLabelText("CIK", { exact: true })).toHaveValue(""));
  await expect(canvas.getByLabelText("양식", { exact: true })).toHaveValue("");
  await expect(canvas.getByLabelText("다운로드 상태")).toHaveValue("");
} };
