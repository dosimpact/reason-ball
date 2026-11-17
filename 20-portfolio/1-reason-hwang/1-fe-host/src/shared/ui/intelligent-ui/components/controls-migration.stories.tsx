import { useState } from "react";
import { Renderer } from "@openuidev/react-lang";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { library } from "../library";

const response = `$text = "Initial"
$number = 2
$notes = "Notes"
$choice = "one"
$segment = "Day"
$checked = false
$radio = "a"
$level = 25
$date = "2026-11-17"
$seconds = 5
root = Form([Col([Input($text,"Name"),Input($number,"Amount","number"),TextArea($notes,"Notes"),Select($choice,[{value:"one",label:"One"},{value:"two",label:"Two"}],"Choice"),SegmentedControl($segment,["Day","Week"],true),Checkbox($checked,"Complete",true),RadioGroup($radio,[{value:"a",label:"Alpha",description:"First option"},{value:"b",label:"Beta"}],"Mode","cards"),Slider($level,0,100,1,"Level","%"),DatePicker($date,"Date"),Row([Button("Save"),Button("Outline",null,"outline"),Button("Soft",null,"soft"),Button("Disabled",null,"solid",null,null,null,true),IconButton("plus",null,"Add")],2),Timer($seconds,"Countdown")],3)])`;

function ControlsExample({ streaming = false, program = response }: { streaming?: boolean; program?: string }) {
  const [lastAction, setLastAction] = useState("");
  return <><Renderer library={library} response={program} isStreaming={streaming} onAction={(event) => setLastAction(JSON.stringify(event))} /><output aria-label="Action event">{lastAction}</output></>;
}
const meta = { title: "OpenUI/ShadcnControls", component: ControlsExample } satisfies Meta<typeof ControlsExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ReactiveControls: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.clear(canvas.getByLabelText("Name"));
  await userEvent.type(canvas.getByLabelText("Name"), "Updated");
  await expect(canvas.getByLabelText("Name")).toHaveValue("Updated");
  await userEvent.clear(canvas.getByLabelText("Amount"));
  await userEvent.type(canvas.getByLabelText("Amount"), "12.5");
  await userEvent.tab();
  await expect(canvas.getByLabelText("Amount")).toHaveValue("12.5");
  await userEvent.click(canvas.getByRole("combobox", { name: "Choice" }));
  await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole("option", { name: "Two" }));
  await expect(canvas.getByRole("combobox", { name: "Choice" })).toHaveTextContent("Two");
  await userEvent.click(canvas.getByRole("checkbox", { name: "Complete" }));
  await expect(canvas.getByRole("checkbox", { name: "Complete" })).toBeChecked();
  await userEvent.click(canvas.getByRole("button", { name: "Week" }));
  await expect(canvas.getByRole("button", { name: "Week" })).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(canvas.getByRole("radio", { name: "Beta" }));
  await expect(canvas.getByRole("radio", { name: "Beta" })).toBeChecked();
  const slider = canvas.getByRole("slider", { name: "Level" });
  slider.focus();
  await userEvent.keyboard("{ArrowRight}");
  await expect(slider).toHaveAttribute("aria-valuenow", "26");
  await userEvent.click(canvas.getByRole("button", { name: "Save" }));
  await expect(canvas.getByLabelText("Action event")).toHaveTextContent("Save");
  await expect(canvas.getByLabelText("Action event")).toHaveTextContent("Updated");
  await expect(canvas.getByLabelText("Action event")).toHaveTextContent("12.5");
  await expect(canvas.getByRole("button", { name: "Disabled" })).toBeDisabled();
  await expect(canvas.getByRole("button", { name: "Add" })).toHaveAttribute("data-slot", "button");
  await userEvent.click(canvas.getByRole("button", { name: "Start" }));
  await expect(canvas.getByRole("button", { name: "Pause" })).toBeEnabled();
  await userEvent.click(canvas.getByRole("button", { name: "Reset" }));
  await expect(canvas.getByRole("timer", { name: "Countdown" })).toHaveTextContent("0:05");
} };
export const Streaming: Story = { args: { streaming: true }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await expect(canvas.getByRole("button", { name: "Save" })).toBeDisabled();
  await expect(canvas.getByRole("button", { name: "Add" })).toBeDisabled();
  await expect(canvas.getByRole("button", { name: "Start" })).toBeDisabled();
} };

export const SelectLabelsAndPlaceholder: Story = {
  render: () => <div className="dark" data-theme="dark"><Renderer library={library} response={'$choice = "missing"\nroot = Col([Select($choice,[{value:"internal-a",label:"표시 이름 A"},{value:"internal-b",label:"표시 이름 B"}],"구분","골라주세요"),Text($choice)])'} /></div>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("combobox", { name: "구분" });
    await expect(trigger).toHaveTextContent("골라주세요");
    await expect(trigger).toHaveAttribute("data-slot", "select-trigger");
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByRole("option", { name: "표시 이름 B" })).toBeVisible();
    await expect(body.getByRole("listbox").closest('[data-slot="select-content"]')).toHaveClass("dark");
    await userEvent.click(body.getByRole("option", { name: "표시 이름 B" }));
    await expect(trigger).toHaveTextContent("표시 이름 B");
    await expect(canvas.getByText("internal-b", { exact: true })).toBeVisible();
  },
};

export const EmptySelect: Story = {
  render: () => <Renderer library={library} response={'root = Col([Select($empty,[],"빈 목록","선택 항목 없음")])\n$empty = ""'} />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("combobox", { name: "빈 목록" })).toHaveTextContent("선택 항목 없음");
  },
};


export const DatePickerFormBinding: Story = {
  args: { program: 'root = Col([Form([DatePicker($date,"일정","2026-11-17","2026-11-19"),Button("날짜 저장")])])\n$date = "2026-11-17"' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "일정" }));
    await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole("button", { name: /November 18th, 2026/ }));
    await expect(canvas.getByRole("button", { name: "일정" })).toHaveTextContent("2026-11-18");
    await userEvent.click(canvas.getByRole("button", { name: "날짜 저장" }));
    await expect(canvas.getByLabelText("Action event")).toHaveTextContent("2026-11-18");
  },
};

export const CanonicalButtonsAndSegmentKeyboard: Story = {
  args: { program: '$period = "Day"\nroot = Col([Row([Button("Default",null,"default"),Button("Secondary",null,"secondary"),Button("Delete",null,"destructive"),Button("Link",null,"link"),Button("Tiny",null,"outline",null,"xs"),Button("Legacy",null,"solid",null,"md"),IconButton("plus",null,"Create","secondary")]),SegmentedControl($period,["Day","Week"],true),Text($period)])' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Delete" })).toHaveClass("text-destructive");
    await expect(canvas.getByRole("button", { name: "Link" })).toHaveClass("text-primary");
    await expect(canvas.getByRole("button", { name: "Tiny" })).toHaveClass("h-5");
    await expect(canvas.getByRole("button", { name: "Legacy" })).toHaveClass("h-7");
    await expect(canvas.getByRole("button", { name: "Create" })).not.toHaveClass("rounded-full");
    const day = canvas.getByRole("button", { name: "Day" });
    day.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByRole("button", { name: "Week" })).toHaveFocus();
    await userEvent.keyboard(" ");
    await expect(canvas.getByRole("button", { name: "Week" })).toHaveAttribute("aria-pressed", "true");
    await expect(day).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(canvas.getByRole("button", { name: "Week" }));
    await expect(canvas.getByRole("button", { name: "Week" })).toHaveAttribute("aria-pressed", "true");
  },
};

export const SemanticColorAliases: Story = {
  args: { program: 'root = Row([Button("Alias",null,"soft","danger"),Button("Canonical",null,"secondary","danger"),Button("Danger link",null,"link","danger"),Button("Explicit",null,"destructive","success")])' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Alias" }).className).toBe(canvas.getByRole("button", { name: "Canonical" }).className);
    await expect(canvas.getByRole("button", { name: "Canonical" })).toHaveClass("bg-destructive/10");
    await expect(canvas.getByRole("button", { name: "Danger link" })).not.toHaveClass("bg-destructive");
    await expect(canvas.getByRole("button", { name: "Explicit" })).toHaveClass("text-destructive");
    await expect(canvas.getByRole("button", { name: "Explicit" })).not.toHaveClass("bg-emerald-700");
  },
};
