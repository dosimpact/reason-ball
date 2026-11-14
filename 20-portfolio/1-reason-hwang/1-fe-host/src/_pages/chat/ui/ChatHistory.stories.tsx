import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ChatHistory } from "./ChatHistory";
const meta = { title: "Chat/History", component: ChatHistory, args: {
  items: [{ threadId: "saved", title: "이전 질문", graphId: "starter_graph", updatedAt: "2026-11-14T00:00:00Z", status: "idle" }],
  loading: false, error: null, disabled: false, selectedId: "saved", onRefresh: fn(async () => {}), onSelect: fn(async () => {}),
} } satisfies Meta<typeof ChatHistory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SavedConversation: Story = { play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByText("대화 기록"));
  await expect(args.onRefresh).toHaveBeenCalled();
  const saved = canvas.getByRole("button", { name: /이전 질문/ });
  await expect(saved).toHaveAttribute("aria-current", "true");
  await userEvent.click(saved);
  await expect(args.onSelect).toHaveBeenCalledWith("saved");
} };
export const Loading: Story = { args: { loading: true }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByText("대화 기록"));
  await expect(canvas.getByRole("status")).toBeVisible();
  await expect(canvas.getByRole("button", { name: /이전 질문/ })).toBeDisabled();
} };
export const Failed: Story = { args: { items: [], error: "기록 조회 실패" }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByText("대화 기록"));
  await expect(canvas.getByRole("alert")).toHaveTextContent("기록 조회 실패");
} };
