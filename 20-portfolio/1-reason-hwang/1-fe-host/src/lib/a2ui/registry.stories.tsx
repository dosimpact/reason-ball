import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within, waitFor } from "storybook/test";
import { FixturePreview } from "./fixture-preview";

const meta = {
  title: "A2UI/Registry",
  component: FixturePreview,
  parameters: { layout: "padded" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("button", { name: "바인딩 확인" })).toBeVisible();
    await expect(canvas.queryByTestId("a2ui-error")).not.toBeInTheDocument();
  },
} satisfies Meta<typeof FixturePreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Accordion: Story = { args: { name: "Accordion" } };
export const Alert: Story = { args: { name: "Alert" } };
export const AlertDialog: Story = { args: { name: "AlertDialog" } };
export const AspectRatio: Story = { args: { name: "AspectRatio" } };
export const Attachment: Story = { args: { name: "Attachment" } };
export const Avatar: Story = { args: { name: "Avatar" } };
export const Badge: Story = { args: { name: "Badge" } };
export const Breadcrumb: Story = { args: { name: "Breadcrumb" } };
export const Bubble: Story = { args: { name: "Bubble" } };
export const Button: Story = { args: { name: "Button" } };
export const ButtonGroup: Story = { args: { name: "ButtonGroup" } };
export const Calendar: Story = { args: { name: "Calendar" } };
export const Card: Story = { args: { name: "Card" } };
export const Carousel: Story = { args: { name: "Carousel" } };
export const Chart: Story = { args: { name: "Chart" } };
export const Checkbox: Story = { args: { name: "Checkbox" } };
export const Collapsible: Story = { args: { name: "Collapsible" } };
export const Column: Story = { args: { name: "Column" } };
export const Combobox: Story = { args: { name: "Combobox" } };
export const Command: Story = { args: { name: "Command" } };
export const ContextMenu: Story = { args: { name: "ContextMenu" } };
export const Dialog: Story = { args: { name: "Dialog" } };
export const Direction: Story = { args: { name: "Direction" } };
export const Drawer: Story = { args: { name: "Drawer" } };
export const DropdownMenu: Story = { args: { name: "DropdownMenu" } };
export const Empty: Story = { args: { name: "Empty" } };
export const Field: Story = { args: { name: "Field" } };
export const HoverCard: Story = { args: { name: "HoverCard" } };
export const InfoRow: Story = { args: { name: "InfoRow" } };
export const Input: Story = { args: { name: "Input" } };
export const InputGroup: Story = { args: { name: "InputGroup" } };
export const InputOtp: Story = { args: { name: "InputOtp" } };
export const Item: Story = { args: { name: "Item" } };
export const Kbd: Story = { args: { name: "Kbd" } };
export const Label: Story = { args: { name: "Label" } };
export const Marker: Story = { args: { name: "Marker" } };
export const Menubar: Story = { args: { name: "Menubar" } };
export const Message: Story = { args: { name: "Message" } };
export const MessageScroller: Story = { args: { name: "MessageScroller" } };
export const Metric: Story = { args: { name: "Metric" } };
export const NativeSelect: Story = { args: { name: "NativeSelect" } };
export const NavigationMenu: Story = { args: { name: "NavigationMenu" } };
export const Pagination: Story = { args: { name: "Pagination" } };
export const Popover: Story = { args: { name: "Popover" } };
export const Progress: Story = { args: { name: "Progress" } };
export const Questionnaire: Story = { args: { name: "Questionnaire" } };
export const RadioGroup: Story = { args: { name: "RadioGroup" } };
export const Resizable: Story = { args: { name: "Resizable" } };
export const Row: Story = {
  args: { name: "Row" },
  decorators: [Story => <div style={{ width: 420 }}><Story /></div>],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const values = await canvas.findAllByText("$680,000");
    await expect(values).toHaveLength(5);
    for (const value of values) {
      await expect(value.scrollWidth).toBeLessThanOrEqual(value.clientWidth);
    }
  },
};
export const ScrollArea: Story = { args: { name: "ScrollArea" } };
export const Select: Story = { args: { name: "Select" } };
export const Separator: Story = { args: { name: "Separator" } };
export const Sheet: Story = { args: { name: "Sheet" } };
export const Sidebar: Story = { args: { name: "Sidebar" } };
export const Skeleton: Story = { args: { name: "Skeleton" } };
export const Slider: Story = { args: { name: "Slider" } };
export const Spinner: Story = { args: { name: "Spinner" } };
export const Switch: Story = { args: { name: "Switch" } };
export const Table: Story = {
  args: { name: "Table" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("cell", { name: "서울" })).toBeVisible();
    await expect(canvas.getByRole("cell", { name: "360000" })).toBeVisible();
  },
};
export const Tabs: Story = { args: { name: "Tabs" } };
export const Text: Story = { args: { name: "Text" } };
export const Textarea: Story = { args: { name: "Textarea" } };
export const Toast: Story = { args: { name: "Toast" } };
export const Toggle: Story = { args: { name: "Toggle" } };
export const ToggleGroup: Story = { args: { name: "ToggleGroup" } };
export const Tooltip: Story = { args: { name: "Tooltip" } };

export const SelectWriteback: Story = {
  args: { name: "Select" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("combobox", { name: "지역" }));
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole("option", { name: "부산" }));
    await userEvent.click(canvas.getByRole("button", { name: "바인딩 확인" }));
    await expect(canvas.getByLabelText("최근 action")).toHaveTextContent('"value":"busan"');
  },
};
export const InputWriteback: Story = {
  args: { name: "Input" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByRole("textbox", { name: "입력값" });
    await userEvent.clear(input);
    await userEvent.type(input, "변경한 값");
    await userEvent.click(canvas.getByRole("button", { name: "바인딩 확인" }));
    await expect(canvas.getByLabelText("최근 action")).toHaveTextContent('"text":"변경한 값"');
  },
};
export const DialogComposition: Story = {
  args: { name: "Dialog" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "상세 보기" }));
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog", { name: "상세 정보" });
    await waitFor(() => expect(dialog).toBeVisible());
    await expect(body.getByText("하위 콘텐츠")).toBeVisible();
    await userEvent.keyboard("{Escape}");
  },
};
