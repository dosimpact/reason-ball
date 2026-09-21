import type { Meta, StoryObj } from "@storybook/react-vite";
import { TemplateViewer } from "./template-viewer";
const meta = {
  title: "Templates/Viewer",
  component: TemplateViewer,
  args: { format: "markdown" },
} satisfies Meta<typeof TemplateViewer>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MarkdownAndMermaid: Story = {
  args: {
    source:
      "# API 설계\n\n| 이름 | 설명 |\n| --- | --- |\n| GET | 조회 |\n\n```mermaid\nflowchart LR\n Input-->Output\n```",
  },
};
export const Empty: Story = { args: { source: "" } };
export const InvalidMermaid: Story = {
  args: { source: "```mermaid\nnot-a-diagram\n```" },
};
export const LongContent: Story = {
  args: {
    source: "# 긴 문서\n\n" + "반복 설명과 긴 입력을 확인합니다. ".repeat(300),
  },
};
export const UnsafeHtml: Story = {
  args: {
    source:
      '# 안전한 문서\n<script>window.alert("unsafe")</script>\n[위험 링크](javascript:alert(1))',
  },
};
export const Unsupported: Story = {
  args: { format: "react-flow", source: "{}" },
};
