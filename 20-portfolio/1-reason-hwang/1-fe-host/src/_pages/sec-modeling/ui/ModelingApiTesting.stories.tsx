import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { useRequestLock } from "@/shared/lib/hooks";
import { ModelingApiTesting } from "./ModelingApiTesting";
const selected = { cik: "0000320193", accessionNo: "0000320193-26-000001", ticker: "AAPL", companyName: "Apple", formType: "10-K", filingDate: "2026-10-30", reportDate: "2026-09-26", hasSource: true, stages: {} };
function Example() {
  const execution = useRequestLock<"modeling" | "api-testing">();
  return <ModelingApiTesting execution={execution} selected={selected} onMutation={() => undefined} execute={async request => ({ request, status: request.method === "POST" ? 202 : 200, statusText: "Fixture", durationMs: 12, headers: { "content-type": "application/json" }, bodyText: '{"status":"QUEUED"}', body: { status: "QUEUED" }, events: [], outcome: "success" })} />;
}
const meta = { title: "SEC Modeling/API Testing", component: Example } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ReadOnlyRequest: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { name: "Send 요청 보내기" }));
  await expect(canvas.getByRole("region", { name: "API 응답" })).toHaveTextContent("HTTP 200");
} };
export const AcceptedNotCompleted: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.selectOptions(canvas.getByRole("combobox", { name: "API 프리셋" }), "create-3");
  await userEvent.click(canvas.getByRole("button", { name: "운영 화면의 선택 공시·실행 값 가져오기" }));
  await expect(canvas.getByRole("button", { name: "Send 요청 보내기" })).toBeDisabled();
  await userEvent.click(canvas.getByRole("checkbox", { name: /실제 서버 작업/ }));
  await userEvent.click(canvas.getByRole("button", { name: "Send 요청 보내기" }));
  await expect(canvas.getByRole("region", { name: "API 응답" })).toHaveTextContent("실행 접수됨 · 완료 아님");
} };
