import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { SidebarProvider } from "@/shared/ui/sidebar";
import { AppSidebar } from "./app-sidebar";

const meta = {
  title: "Host/Navigation",
  component: AppSidebar,
  decorators: [Story => <SidebarProvider><Story /></SidebarProvider>],
  parameters: { viewport: { defaultViewport: "desktop" }, nextjs: { appDirectory: true, navigation: { pathname: "/open-ui/catalog" } } },
} satisfies Meta<typeof AppSidebar>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Groups: Story = { args: { collapsible: "none" }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  for (const label of ["Overview", "Remote Apps", "AI Chat", "Generative UI"]) {
    await expect(canvas.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(canvas.getByRole("link", { name: "Todo" })).toHaveAttribute("href", "/remotes/todo");
  await expect(canvas.getByRole("link", { name: "Component Catalog" })).toHaveAttribute("data-active");
  await expect(canvas.getByRole("link", { name: "UI Demos" })).not.toHaveAttribute("data-active");
} };
