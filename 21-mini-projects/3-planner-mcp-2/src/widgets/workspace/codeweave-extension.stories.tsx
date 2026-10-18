import type { Meta, StoryObj } from "@storybook/react-vite";
import { CodeWeaveView, codeWeaveExample } from "./codeweave-extension";

const meta = {
  title: "Planner/CodeWeaveTree",
  component: CodeWeaveView,
  args: { source: codeWeaveExample },
  argTypes: { treeStyle: { control: "object" } },
} satisfies Meta<typeof CodeWeaveView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Configurable: Story = {
  args: {
    treeStyle: {
      "--codeweave-tree-height": "240px",
      "--codeweave-tree-max-height": "70vh",
      "--codeweave-tree-font-family": "sans-serif",
      "--codeweave-tree-font-size": "18px",
      "--codeweave-tree-line-height": 1.8,
    },
  },
};
export const Inherited: Story = {
  decorators: [
    (Story) => (
      <div
        style={
          {
            "--codeweave-tree-max-height": "180px",
            "--codeweave-tree-font-size": "16px",
          } as import("./codeweave-extension").CodeWeaveTreeStyle
        }
      >
        <Story />
      </div>
    ),
  ],
};
