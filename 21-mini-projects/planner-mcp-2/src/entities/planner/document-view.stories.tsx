import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChecklistView, MarkdownView, OverviewTree } from "./document-view";
const meta = {
  title: "Planner/Checklist",
  component: ChecklistView,
} satisfies Meta<typeof ChecklistView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = { args: { items: [] } };
export const Mixed: Story = {
  args: {
    items: [
      {
        id: "1",
        label: "정상 로그인",
        aiResult: "passed",
        humanConfirmed: true,
        position: 0,
      },
      {
        id: "2",
        label: "오류 안내",
        aiResult: "pending",
        humanConfirmed: false,
        position: 1,
      },
      {
        id: "3",
        label: "실패 시나리오",
        aiResult: "failed",
        humanConfirmed: false,
        position: 2,
      },
    ],
  },
};
export const Markdown: Story = {
  args: { items: [] },
  render: () => (
    <MarkdownView
      body={
        "# 로그인 설계\n\n**What**: 로그인\n\n```mermaid\nflowchart LR\n A[입력] --> B[인증]\n```"
      }
    />
  ),
};
export const Overview: Story = {
  args: { items: [] },
  render: () => (
    <OverviewTree
      entries={[
        {
          id: "1",
          parentId: null,
          title: "회원 관리",
          what: "회원 흐름",
          how: "API",
          verificationDocumentId: null,
        },
        {
          id: "2",
          parentId: "1",
          title: "로그인",
          what: "인증",
          how: "폼 제출",
          verificationDocumentId: "test",
        },
      ]}
    />
  ),
};
