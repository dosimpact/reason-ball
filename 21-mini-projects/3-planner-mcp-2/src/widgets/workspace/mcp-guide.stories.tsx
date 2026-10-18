import type { Meta, StoryObj } from "@storybook/react-vite";
import { McpGuide } from "./mcp-guide";
const meta = { title: "Planner/McpGuide", component: McpGuide } satisfies Meta<
  typeof McpGuide
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Catalog: Story = {
  args: {
    tools: [
      {
        name: "get_workflow_rules",
        description: "Read workflow rules",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_document",
        description: "Read document",
        inputSchema: {
          type: "object",
          properties: { documentId: { type: "string", minLength: 1 } },
          required: ["documentId"],
        },
      },
    ],
  },
};
export const Empty: Story = { args: { tools: [] } };
