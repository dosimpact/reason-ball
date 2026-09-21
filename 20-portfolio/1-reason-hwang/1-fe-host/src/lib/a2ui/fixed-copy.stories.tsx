import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fixedDemoCopy } from "@/features/a2ui-demo/fixed-copy";

function FixedCopyPreview() {
  return <main className="max-w-5xl p-6"><h1 className="text-2xl font-semibold">{fixedDemoCopy.title}</h1><p className="mt-2 text-sm text-muted-foreground">{fixedDemoCopy.description}</p><div className="my-4 rounded-lg bg-muted p-4 text-sm">{fixedDemoCopy.examples}</div><p>{fixedDemoCopy.welcome}</p></main>;
}

const meta = { title: "A2UI/Fixed 안내", component: FixedCopyPreview } satisfies Meta<typeof FixedCopyPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Narrow: Story = { decorators: [Story => <div style={{ width: 360 }}><Story /></div>] };
