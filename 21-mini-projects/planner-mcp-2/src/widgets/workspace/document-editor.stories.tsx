import type { Meta, StoryObj } from "@storybook/react-vite";
import { DocumentEditor } from "./document-editor";
const meta = {
  title: "Planner/DocumentEditor",
  component: DocumentEditor,
} satisfies Meta<typeof DocumentEditor>;
export default meta;
type Story = StoryObj<typeof meta>;
export const IndexProgress: Story = {
  args: {
    document: {
      id: "index-story",
      projectId: "story",
      parentId: null,
      title: "설계 index",
      kind: "index",
      phase: "design",
      body: "## 설계 문서 안내\n\n아래 체크리스트에서 단계의 진행을 확인하세요.",
      overview: [],
      status: "in-progress",
      revision: 1,
      templateSnapshot: null,
      checklist: [
        {
          id: "check",
          label: "설계 범위 확인",
          aiResult: "passed",
          humanConfirmed: false,
          position: 0,
        },
      ],
      children: [],
    },
    documents: [],
    onRefresh: async () => {},
    onOpen: () => {},
    onDelete: () => {},
    onCreateChild: () => {},
  },
};
export const EmptyIndex: Story = {
  args: {
    ...IndexProgress.args,
    document: { ...IndexProgress.args!.document!, checklist: [] },
  },
};

export const ChildDocumentCatalog: Story = {
  args: {
    ...IndexProgress.args,
    document: {
      ...IndexProgress.args!.document!,
      children: [
        {
          id: "login-design",
          title: "로그인 흐름 설계",
          kind: "design-verification",
        },
        {
          id: "onboarding-design",
          title: "첫 프로젝트 온보딩",
          kind: "overview",
        },
      ],
    },
  },
};
