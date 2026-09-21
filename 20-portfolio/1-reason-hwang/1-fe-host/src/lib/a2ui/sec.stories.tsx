import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { SecPreview } from "./sec-preview";

const meta = { title: "A2UI/SEC", component: SecPreview } satisfies Meta<typeof SecPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SearchAction: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByRole("textbox", { name: "회사명 또는 티커" }), "AAPL");
    await userEvent.click(canvas.getByRole("button", { name: "회사 검색" }));
    await expect(canvas.getByLabelText("SEC action")).toHaveTextContent('"name":"sec_search"');
    await expect(canvas.getByLabelText("SEC action")).toHaveTextContent('"query":"AAPL"');
    await expect(canvas.getByLabelText("SEC action")).toHaveTextContent('"revision":1');
  },
};

export const ReportEvidence: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "핵심 요약" }));
    await expect(await canvas.findByText(/\[E1\] The company/)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "재무 분석" }));
    await expect(await canvas.findByText("제공된 발췌에서 확인된 정보가 없습니다.")).toBeVisible();
  },
};
