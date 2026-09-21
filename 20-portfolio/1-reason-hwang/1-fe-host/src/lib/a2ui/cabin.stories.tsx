import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { CabinPreview } from "./cabin-preview";

const meta = { title: "A2UI/Cabin", component: CabinPreview } satisfies Meta<typeof CabinPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const MealAndSeat: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("radio", { name: "채식" }));
    await userEvent.click(canvas.getByRole("radio", { name: "14C · 통로" }));
    await userEvent.click(canvas.getByRole("button", { name: "선택 확정" }));
    await expect(canvas.getByLabelText("기내 선택 action")).toHaveTextContent('"name":"confirm_cabin"');
    await expect(canvas.getByLabelText("기내 선택 action")).toHaveTextContent('"meal":"vegetarian"');
    await expect(canvas.getByLabelText("기내 선택 action")).toHaveTextContent('"seat":"14C"');
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
  },
};

export const MealOnly: Story = {
  args: { uiType: "meal" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("radio", { name: "채식" }));
    await expect(canvas.queryByRole("group", { name: "좌석" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "선택 확정" }));
    await expect(canvas.getByLabelText("기내 선택 action")).toHaveTextContent('"meal":"vegetarian"');
    await expect(canvas.getByLabelText("기내 선택 action")).not.toHaveTextContent('"seat":');
  },
};

export const SeatOnly: Story = {
  args: { uiType: "seat" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("radio", { name: "14C · 통로" }));
    await expect(canvas.queryByRole("group", { name: "기내식" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "선택 확정" }));
    await expect(canvas.getByLabelText("기내 선택 action")).toHaveTextContent('"seat":"14C"');
    await expect(canvas.getByLabelText("기내 선택 action")).not.toHaveTextContent('"meal":');
  },
};
