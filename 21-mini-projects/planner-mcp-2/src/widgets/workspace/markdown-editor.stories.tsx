import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarkdownEditor } from "./markdown-editor";
const meta = {
  title: "Planner/MarkdownEditor",
  component: MarkdownEditor,
} satisfies Meta<typeof MarkdownEditor>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Blocks: Story = {
  args: {
    label: "설계 본문",
    value:
      "# 로그인 설계\n\n**사용자**가 로그인합니다.\n\n- 입력 확인\n- 제출\n\n```mermaid\nflowchart LR\n A[입력] --> B[완료]\n```",
    onChange: () => {},
  },
  render: function Stateful(args) {
    const [value, setValue] = useState(args.value);
    return <MarkdownEditor {...args} value={value} onChange={setValue} />;
  },
};
