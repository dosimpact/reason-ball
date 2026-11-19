import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import GenerativeHome from "./Home";

const meta = { title: "Generative UI/Home", component: GenerativeHome } satisfies Meta<typeof GenerativeHome>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AvailableDemos: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: /매출 분석/ })).toHaveAttribute("href", "/open-ui/dynamic");
    await expect(canvas.getByRole("link", { name: /항공편 선택/ })).toHaveAttribute("href", "/open-ui/fixed");
    await expect(canvas.getByRole("link", { name: /전체 컴포넌트 카탈로그/ })).toHaveAttribute("href", "/open-ui/catalog");
    await expect(canvas.queryByRole("link", { name: /SEC 공시 분석/ })).not.toBeInTheDocument();
  },
};
