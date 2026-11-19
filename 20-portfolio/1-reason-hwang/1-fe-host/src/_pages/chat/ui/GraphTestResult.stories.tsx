import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { GraphTestResult } from "./GraphTestResult";
const meta = { title: "Chat/GraphTestResult", component: GraphTestResult, args: { result: { message: "완료", count: 2 } } } satisfies Meta<typeof GraphTestResult>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Complete: Story = { play: async ({ canvasElement }) => { await expect(within(canvasElement).getByRole("button", { name: "전체 결과 복사" })).toBeVisible(); } };
export const Bounded: Story = { args: { result: { payload: "x".repeat(110000) } }, play: async ({ canvasElement }) => {
  await expect(canvasElement.querySelector("pre")?.textContent?.length).toBe(100000);
  await expect(within(canvasElement).getByText(/복사에는 전체 JSON/)).toBeVisible();
} };
