import type { Meta, StoryObj } from "@storybook/react-vite";
import { WorkspaceShell } from "./workspace-shell";
const meta = {
  title: "Planner/WorkspaceShell",
  component: WorkspaceShell,
} satisfies Meta<typeof WorkspaceShell>;
export default meta;
type Story = StoryObj<typeof meta>;
export const CollapsibleSidebar: Story = {
  args: {
    navigation: (
      <>
        <div className="sidebar-content">
          <h2>프로젝트</h2>
          <input aria-label="프로젝트 검색" placeholder="검색 내용 유지" />
        </div>
        <div className="sidebar-footer">AI MCP Interface 안내</div>
      </>
    ),
    children: (
      <main>
        <h1>작업 공간</h1>
        <textarea
          aria-label="작성 중인 문서"
          defaultValue="접어도 유지되는 초안"
        />
      </main>
    ),
  },
  render: (args) => (
    <div className="app" style={{ height: 500 }}>
      <WorkspaceShell {...args} />
    </div>
  ),
};
