import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fireEvent, fn, userEvent, within } from "storybook/test";
import { GraphTestInput } from "./GraphTestInput";
const meta = { title: "Chat/GraphTestInput", component: GraphTestInput, args: { example: { query: "AAPL" }, schema: { type: "object", properties: { query: { type: "string" } } }, busy: false, onRun: fn(async () => {}), onCancel: fn() } } satisfies Meta<typeof GraphTestInput>;
export default meta;
type Story = StoryObj<typeof meta>;
export const RunExample: Story = { play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { name: "그래프 실행" }));
  await expect(args.onRun).toHaveBeenCalledWith({ query: "AAPL" });
} };
export const InvalidJson: Story = { play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement);
  await userEvent.clear(canvas.getByRole("textbox", { name: "그래프 입력 JSON" }));
  fireEvent.change(canvas.getByRole("textbox"), { target: { value: "[]" } });
  await userEvent.click(canvas.getByRole("button", { name: "그래프 실행" }));
  await expect(canvas.getByRole("alert")).toHaveTextContent("JSON 객체");
  await expect(args.onRun).not.toHaveBeenCalled();
} };
export const Running: Story = { args: { busy: true }, play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement);
  await expect(canvas.getByRole("textbox")).toBeDisabled();
  await userEvent.click(canvas.getByRole("button", { name: "실행 중단" }));
  await expect(args.onCancel).toHaveBeenCalled();
} };
