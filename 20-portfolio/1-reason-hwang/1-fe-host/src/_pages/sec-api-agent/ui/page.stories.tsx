import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import SecApiAgentPage from "./page";

const meta = { title: "SEC/API Agent", component: SecApiAgentPage } satisfies Meta<typeof SecApiAgentPage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Welcome: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("heading", { name: "SEC 데이터로 무엇을 할까요?" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "기업 검색" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "전체 수집 안내" })).toBeVisible();
    await expect(canvas.getByRole("textbox")).toBeVisible();
  },
};
