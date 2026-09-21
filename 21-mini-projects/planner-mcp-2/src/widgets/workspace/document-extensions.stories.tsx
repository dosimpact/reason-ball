import type { Meta, StoryObj } from "@storybook/react-vite";
import { DocumentExtensions } from "./document-extensions";
const meta = {
  title: "Planner/DocumentExtensions",
  component: DocumentExtensions,
} satisfies Meta<typeof DocumentExtensions>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Diagram: Story = {
  args: {
    extensions: [
      {
        id: "example",
        type: "react-flow-diagram",
        title: "주문 처리 흐름",
        schemaVersion: 1,
        data: {
          nodes: [
            { id: "a", label: "주문 요청", position: { x: 0, y: 0 } },
            { id: "b", label: "결제 확인", position: { x: 220, y: 0 } },
          ],
          edges: [{ id: "ab", source: "a", target: "b" }],
        },
      },
    ],
  },
};
export const Empty: Story = { args: { extensions: [] } };

export const CodeWeave: Story = {
  args: {
    extensions: [
      {
        id: "cw",
        type: "codeweave",
        title: "코드 흐름",
        schemaVersion: 1,
        data: {
          source:
            "[App]\n  -> FLOW: 시작\n    -> (+) Custom: 추가 처리 // 설명\n    /*\n여러 줄 주석\n    */\n    <- (-) RETURN: 이전 결과",
        },
      },
    ],
  },
};
