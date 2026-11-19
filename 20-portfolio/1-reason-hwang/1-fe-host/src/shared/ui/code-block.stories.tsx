import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { CodeBlock, CodeBlockActions, CodeBlockContent, CodeBlockCopyButton, CodeBlockHeader, CodeBlockLine, CodeBlockTitle } from "./code-block";

const code = "const answer = 42;\n\nconsole.log(answer);";
const meta = { title: "UI/Code Block", component: CodeBlock } satisfies Meta<typeof CodeBlock>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PlainCode: Story = {
  render: () => <CodeBlock><CodeBlockHeader><CodeBlockTitle>example.ts</CodeBlockTitle><CodeBlockActions><CodeBlockCopyButton value={code} /></CodeBlockActions></CodeBlockHeader><CodeBlockContent lineNumbers>{code}</CodeBlockContent></CodeBlock>,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button", { name: "Copy" })).toBeEnabled();
    await expect(canvasElement.querySelectorAll('[data-slot="code-block-line"]')).toHaveLength(3);
  },
};
export const DiffAndWrap: Story = {
  render: () => <CodeBlock size="sm"><CodeBlockContent wrap><CodeBlockLine variant="removed">const value = 1;</CodeBlockLine><CodeBlockLine variant="added">const value = 2;</CodeBlockLine><CodeBlockLine variant="highlighted">console.log(value);</CodeBlockLine></CodeBlockContent></CodeBlock>,
};
