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

export const FreeComposition: Story = {
  args: {
    onError: fn(), onMessage: fn(),
    program: 'root = Col([Title("제품별 매출", "xl"), SegmentedControl($view, ["bar", "donut"]), Chart($view, data, "product", ["revenue"]), Table(["제품", "매출"], [["A", 100], ["B", 60]]), Button("위험요인도 알려줘", @ToAssistant("위험요인도 알려줘"))], 4)\n$view = "bar"\ndata = [{"product":"A","revenue":100},{"product":"B","revenue":60}]',
    evidence: { filing: { cik: "0000000001", accessionNo: "fixture", filingDate: "2025-01-01" }, sourceUrl: "https://www.sec.gov/", checkedAt: null, limitations: "가상 테스트 데이터", coverage: { "8": { used: 100, total: 100 } }, findings: [{ item: "8", heading: "매출", quote: "Fixture revenues: A 100, B 60." }] },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("table")).toBeVisible();
    await expect(canvas.getByRole("img", { name: /bar chart/ })).toBeVisible();
    await userEvent.click(canvas.getByRole("radio", { name: "donut" }));
    await expect(canvas.getByRole("img", { name: /donut chart/ })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "위험요인도 알려줘" }));
    await expect(args.onMessage).toHaveBeenCalledWith('위험요인도 알려줘\n입력값: {"$view":"donut"}');
    await userEvent.click(canvas.getByRole("checkbox", { name: "원문 인용 표시" }));
    await expect(canvas.queryByText("Fixture revenues: A 100, B 60.")).not.toBeInTheDocument();
    await expect(canvas.getByRole("img", { name: /donut chart/ })).toBeVisible();
    await expect(args.onError).not.toHaveBeenCalled();
  },
};

const prose = "### 일회성 수익 찾기\n\n- **gain on sale/disposal**: 매각이익\n- `debt maturity`: 부채 만기\n\n| 항목 | 확인 |\n| --- | --- |\n| 만기 | 연도별 금액 |";
export const MarkdownProse: Story = {
  args: { program: `root = Col([Markdown(${JSON.stringify(prose)})])`, onError: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "일회성 수익 찾기" })).toBeVisible();
    await expect(canvas.getAllByRole("listitem")).toHaveLength(2);
    await expect(canvas.getByText("gain on sale/disposal").tagName).toBe("STRONG");
    await expect(canvas.getByRole("table")).toBeVisible();
    await expect(args.onError).not.toHaveBeenCalled();
  },
};
export const TextWithMarkdown: Story = { ...MarkdownProse, args: { program: `root = Col([Text(${JSON.stringify(prose)})])`, onError: fn() } };
