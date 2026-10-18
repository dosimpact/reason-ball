import type { Meta, StoryObj } from "@storybook/react-vite";
import { Layout } from "./layout";
import { TemplatePreview } from "./template-preview";
const meta = {
  title: "Planner/WorkspacePanels",
  component: Layout.Panels,
} satisfies Meta<typeof Layout.Panels>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Resizable: Story = {
  args: {
    canvas: (
      <Layout.Canvas>
        <h2>프로젝트 흐름</h2>
        <p>패널 경계를 드래그하세요.</p>
      </Layout.Canvas>
    ),
    detail: (
      <Layout.Detail>
        <h2>문서 상세</h2>
        <textarea aria-label="문서 입력" defaultValue="작성 중인 문서" />
      </Layout.Detail>
    ),
  },
  render: (args) => (
    <div style={{ height: 420 }}>
      <Layout.Panels {...args} />
    </div>
  ),
};
export const PreviewModal: Story = {
  args: { canvas: null, detail: null },
  render: () => (
    <TemplatePreview
      title="로그인"
      body={
        "# 로그인 설계\n\n```mermaid\nflowchart LR\n A[입력] --> B[인증]\n```"
      }
      example="정상 로그인 흐름을 확인합니다."
    />
  ),
};

export const IndependentScroll: Story = {
  args: {
    canvas: (
      <Layout.Canvas>
        <h2>캔버스 목록</h2>
        {Array.from({ length: 40 }, (_, i) => (
          <p key={i}>설계 문서 {i + 1}</p>
        ))}
      </Layout.Canvas>
    ),
    detail: (
      <Layout.Detail>
        <h2>긴 상세 문서</h2>
        {Array.from({ length: 40 }, (_, i) => (
          <p key={i}>검증 내용 {i + 1}</p>
        ))}
      </Layout.Detail>
    ),
  },
  render: (args) => (
    <div style={{ height: 420 }}>
      <Layout.Panels {...args} />
    </div>
  ),
};
