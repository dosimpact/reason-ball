import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { HostThemeProvider } from "@/shared/lib/theme";
import { ThemeToggle } from "./theme-toggle";

const meta = { title: "Host/Theme Toggle", component: ThemeToggle,
  decorators: [(Story) => <HostThemeProvider><Story /></HostThemeProvider>],
} satisfies Meta<typeof ThemeToggle>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Toggle: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole("button");
    const before = button.getAttribute("aria-label");
    await userEvent.click(button);
    await expect(button).not.toHaveAttribute("aria-label", before);
    await expect(document.documentElement.dataset.theme).toBe(document.documentElement.dataset.openuiTheme);
    await userEvent.click(button);
  },
};
