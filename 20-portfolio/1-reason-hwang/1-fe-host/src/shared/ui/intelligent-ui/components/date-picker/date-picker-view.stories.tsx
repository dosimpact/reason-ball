import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { OpenUIDatePickerView, type OpenUIDatePickerViewProps } from "./date-picker-view";

function Example(props: OpenUIDatePickerViewProps) {
  const [value, setValue] = useState(props.value);
  return <div className="max-w-80"><OpenUIDatePickerView {...props} value={value} onChange={setValue} /><output aria-label="Date value">{value}</output></div>;
}
const meta = { title: "OpenUI/DatePicker", component: Example, args: { value: "2026-11-17", label: "Date", onChange: () => {} } } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SelectionAndClear: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "Date" });
    await userEvent.click(trigger);
    await userEvent.click(await body.findByRole("button", { name: /November 18th, 2026/ }));
    await expect(canvas.getByLabelText("Date value")).toHaveTextContent("2026-11-18");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(trigger);
    await userEvent.click(await body.findByRole("button", { name: /November 18th, 2026/ }));
    await expect(canvas.getByLabelText("Date value")).toBeEmptyDOMElement();
    await expect(trigger).toHaveTextContent("날짜 선택");
  },
};
export const Empty: Story = { args: { value: "" }, play: async ({ canvasElement }) => {
  await expect(within(canvasElement).getByRole("button", { name: "Date" })).toHaveTextContent("날짜 선택");
} };
export const Invalid: Story = { args: { value: "2026-02-30", min: "2026-11-17", max: "2026-11-19" }, play: async ({ canvasElement }) => {
  const trigger = within(canvasElement).getByRole("button", { name: "Date" });
  await expect(trigger).toHaveTextContent("날짜 선택");
  await userEvent.click(trigger);
  await expect(await within(canvasElement.ownerDocument.body).findByRole("button", { name: /November 17th, 2026/ })).toBeEnabled();
  await userEvent.click(trigger);
} };
export const InclusiveBounds: Story = { args: { min: "2026-11-17", max: "2026-11-19" }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const body = within(canvasElement.ownerDocument.body);
  const trigger = canvas.getByRole("button", { name: "Date" });
  await userEvent.click(trigger);
  await expect(await body.findByRole("button", { name: /November 16th, 2026/ })).toBeDisabled();
  await expect(body.getByRole("button", { name: /November 20th, 2026/ })).toBeDisabled();
  await expect(body.getByRole("button", { name: /November 17th, 2026/ })).toBeEnabled();
  await userEvent.click(body.getByRole("button", { name: /November 19th, 2026/ }));
  await expect(canvas.getByLabelText("Date value")).toHaveTextContent("2026-11-19");
  await userEvent.click(trigger);
  await userEvent.click(await body.findByRole("button", { name: /November 17th, 2026/ }));
  await expect(canvas.getByLabelText("Date value")).toHaveTextContent("2026-11-17");
} };
export const Dark: Story = { decorators: [(Story) => <div className="dark bg-background p-4 text-foreground" data-openui-theme="dark"><Story /></div>], play: async ({ canvasElement }) => {
  const trigger = within(canvasElement).getByRole("button", { name: "Date" });
  await userEvent.click(trigger);
  const day = await within(canvasElement.ownerDocument.body).findByRole("button", { name: /November 18th, 2026/ });
  await expect(day.closest('[data-slot="popover-content"]')).toHaveClass("dark");
  await userEvent.click(day);
} };
export const LeapDay: Story = { args: { value: "2024-02-29" }, play: async ({ canvasElement }) => {
  await expect(within(canvasElement).getByRole("button", { name: "Date" })).toHaveTextContent("2024-02-29");
} };
