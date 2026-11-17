import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { PinnedCanvasItem } from "../model/pinnedCanvas";
import { PinnedCanvas } from "./canvas/PinnedCanvas";
import "./canvas/canvas.css";

const items: PinnedCanvasItem[] = [{ id: "instance-a", sourceElementId: "source-a", title: "분석 요약", program: 'root = TextContent("독립 분석 결과")', messageId: "message-a", addedAt: "2026-11-17T00:00:00Z", layout: { x: 0, y: 0, w: 12, h: 10 }, pinned: false }];
const meta = { title: "Chat/PinnedCanvas", component: PinnedCanvas, args: { items, busy: false, onChange: fn(), onClose: fn(), onAsk: fn() }, parameters: { layout: "fullscreen" }, render: args => {
  const [current, setCurrent] = useState(args.items);
  return <div style={{ width: 900, height: 650, display: "grid" }}><PinnedCanvas {...args} items={current} onChange={update => { args.onChange(update); setCurrent(update); }} /></div>;
} } satisfies Meta<typeof PinnedCanvas>;
export default meta;
type Story = StoryObj<typeof meta>;
export const GridKeyboardAndLock: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const move = await canvas.findByRole("button", { name: "분석 요약 이동" });
  await expect(move).toBeEnabled();
  await userEvent.click(move);
  await userEvent.keyboard("{ArrowRight}");
  await userEvent.click(canvas.getByRole("button", { name: "분석 요약 위치 고정" }));
  await expect(move).toBeDisabled();
  await expect(canvas.getByLabelText("분석 요약 크기 조절")).toBeDisabled();
  await userEvent.click(canvas.getByRole("button", { name: "분석 요약 위치 고정 해제" }));
  await expect(move).toBeEnabled();
  await userEvent.click(canvas.getByRole("button", { name: "분석 요약 제거" }));
  await expect(canvas.queryByRole("button", { name: "분석 요약 이동" })).not.toBeInTheDocument();
} };
export const Busy: Story = { args: { busy: true }, play: async ({ canvasElement }) => {
  await expect(await within(canvasElement).findByRole("button", { name: "분석 요약 이동" })).toBeDisabled();
} };
