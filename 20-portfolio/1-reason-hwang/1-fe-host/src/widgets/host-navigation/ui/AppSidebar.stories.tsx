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
  for (const label of ["Overview", "Remote Apps", "AI Chat", "Debugging", "Generative UI"]) {
    await expect(canvas.getByText(label, { exact: true })).toBeVisible();
  }
  const debugging = within(canvas.getByText("Debugging", { exact: true }).closest<HTMLElement>('[data-slot="sidebar-group"]')!);
  await expect(debugging.getAllByRole("link")).toHaveLength(2);
  await expect(debugging.getByRole("link", { name: "Langgraph dev chat" })).toHaveAttribute("href", "/langgraph-dev-chat");
  await expect(debugging.getByRole("link", { name: "FastAPI 채팅" })).toHaveAttribute("href", "/fastapi-chat");
  const aiChat = within(canvas.getByText("AI Chat", { exact: true }).closest<HTMLElement>('[data-slot="sidebar-group"]')!);
  await expect(aiChat.queryByRole("link", { name: "Langgraph dev chat" })).not.toBeInTheDocument();
  await expect(aiChat.queryByRole("link", { name: "FastAPI 채팅" })).not.toBeInTheDocument();
  await expect(aiChat.getByRole("link", { name: "기술적 분석 · 인라인" })).toBeVisible();
  await expect(canvas.getByRole("link", { name: "Todo" })).toHaveAttribute("href", "/remotes/todo");
  await expect(canvas.getByRole("link", { name: "OpenUI Lang Catalog" })).toHaveAttribute("data-active");
  await expect(canvas.getByRole("link", { name: "OpenUI Lang Catalog" })).toHaveAttribute("href", "/open-ui/catalog");
  await expect(canvas.getByRole("link", { name: "UI Demos" })).not.toHaveAttribute("data-active");
} };
