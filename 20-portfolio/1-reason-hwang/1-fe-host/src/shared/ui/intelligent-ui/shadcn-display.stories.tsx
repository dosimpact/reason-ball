import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { OutputView } from "./OutputView";

const program = `root = Col([
  Card([Title("Shadcn display adapters"), Label("Status"), Row([Badge("Neutral"), Badge("Ready", "success", "check"), Badge("Review", "warning"), Badge("Failed", "danger")]), Divider(), Table(["Company", "Revenue", "Status"], [["**Apple**", 1234.56, Badge("Ready", "info")], ["Microsoft", "$2.4k", Badge("Review", "purple")]]), Popover("Source details", "Public filing evidence")]),
  Card([Text("Soft card with explicit spacing"), Text("Preserves padding and gap")], "soft", 6, 3),
  Row([Badge("Default variant", null, null, "default"), Badge("Secondary variant", null, null, "secondary"), Badge("Destructive variant", null, null, "destructive"), Badge("Outline variant", null, null, "outline"), Badge("Ghost variant", null, null, "ghost"), Badge("Link variant", null, null, "link")]),
  Popover(Button("Component trigger", null, "outline"), "Component trigger evidence"),
  Table(["Empty data", "Amount"], []),
  Code("const answer = 42;", "typescript"),
  Quote("A clear source supports a clear answer.", "Research notes")
])`;

const meta = {
  title: "Generative UI/Shadcn Display",
  component: OutputView,
  args: { program },
} satisfies Meta<typeof OutputView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const DisplayAndPopover: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Shadcn display adapters")).toBeVisible();
    await expect(canvas.getAllByRole("table")).toHaveLength(2);
    for (const variant of ["default", "secondary", "destructive", "outline", "ghost", "link"]) {
      await expect(canvas.getByText(`${variant[0].toUpperCase()}${variant.slice(1)} variant`)).toHaveAttribute("data-variant", variant);
    }
    await expect(canvas.getByText("Neutral")).toHaveAttribute("data-variant", "default");
    await expect(canvas.getByText("Failed")).toHaveAttribute("data-variant", "destructive");
    const softContent = canvas.getByText("Soft card with explicit spacing").closest('[data-slot="card-content"]');
    await expect(softContent).not.toBeNull();
    await expect(softContent).toHaveStyle({ gap: "12px" });
    await expect(softContent?.parentElement).toHaveStyle({ "--card-spacing": "24px" });
    await expect(canvasElement.querySelector("button button")).toBeNull();
    const code = canvas.getByText("const answer = 42;");
    await expect(code.closest('[data-slot="code-block-content"]')).not.toBeNull();
    await expect(canvas.getByText("typescript").closest('[data-slot="code-block-title"]')).not.toBeNull();
    await expect(canvas.getByRole("button", { name: "Copy code" })).toBeVisible();
    await expect(canvas.getByRole("cell", { name: "1,234.56" })).toHaveClass("text-right");
    await expect(canvas.getByRole("cell", { name: "Apple" }).querySelector("strong")).not.toBeNull();
    await expect(canvas.queryByText("Public filing evidence")).toBeNull();
    const trigger = canvas.getByRole("button", { name: "Source details" });
    await userEvent.click(trigger);
    await waitFor(() => expect(within(canvasElement.ownerDocument.body).getByText("Public filing evidence")).toBeVisible());
    await waitFor(() => expect(within(canvasElement.ownerDocument.body).getByRole("dialog")).toHaveFocus());
    await waitFor(() => expect(within(canvasElement.ownerDocument.body).getByRole("dialog")).not.toHaveAttribute("data-starting-style"));
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Source details" }));
    await waitFor(() => expect(trigger).toHaveFocus());
    const componentTrigger = canvas.getByRole("button", { name: "Component trigger" });
    componentTrigger.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(within(canvasElement.ownerDocument.body).getByText("Component trigger evidence")).toBeVisible());
    await userEvent.click(componentTrigger);
  },
};

export const NarrowDisplay: Story = {
  decorators: [(Story) => <div style={{ width: 320, maxWidth: "100%" }}><Story /></div>],
};

export const DarkPopover: Story = {
  decorators: [(Story) => <div className="dark" data-theme="dark"><Story /></div>],
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Source details" }));
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole("dialog")).toHaveFocus());
    await expect(body.getByRole("dialog")).toHaveAttribute("data-theme", "dark");
    await expect(body.getByRole("dialog")).toHaveClass("dark");
    await waitFor(() => expect(within(canvasElement.ownerDocument.body).getByRole("dialog")).not.toHaveAttribute("data-starting-style"));
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Source details" }));
  },
};

export const CopyCode: Story = {
  args: { program: 'root = Code("line one\\n\\nline three", "text")' },
  play: async ({ canvasElement }) => {
    const browserNavigator = canvasElement.ownerDocument.defaultView!.navigator;
    const original = Object.getOwnPropertyDescriptor(browserNavigator, "clipboard");
    let copied = "";
    Object.defineProperty(browserNavigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value: string) => { copied = value; } },
    });
    try {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Copy code" }));
      await waitFor(() => expect(copied).toBe("line one\n\nline three"));
    } finally {
      if (original) Object.defineProperty(browserNavigator, "clipboard", original);
      else Reflect.deleteProperty(browserNavigator, "clipboard");
    }
  },
};
