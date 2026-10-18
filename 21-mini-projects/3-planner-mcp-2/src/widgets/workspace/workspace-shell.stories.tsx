import type { Meta, StoryObj } from "@storybook/react-vite";
import { Layout } from "./layout";
const meta = {
  title: "Planner/WorkspaceShell",
  component: Layout.Shell,
} satisfies Meta<typeof Layout.Shell>;
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
      <Layout.Main>
        <h1>작업 공간</h1>
        <textarea
          aria-label="작성 중인 문서"
          defaultValue="접어도 유지되는 초안"
        />
      </Layout.Main>
    ),
  },
  render: (args) => (
    <Layout.Root style={{ height: 500 }}>
      <Layout.Shell {...args} />
    </Layout.Root>
  ),
};
