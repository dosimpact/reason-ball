import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AspectRatio } from './aspect-ratio';

const meta = {
  title: 'UI/Aspect Ratio',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Landscape: Story = {
  render: () => (
    <div className="w-[min(80vw,600px)]">
      <AspectRatio ratio={16 / 9}>
        <div className="flex h-full items-end rounded-xl bg-gradient-to-br from-sky-400 via-indigo-500 to-violet-800 p-6 text-white">
          <div>
            <p className="text-sm">PORTFOLIO / 2026</p>
            <h2 className="text-2xl font-semibold">Ideas in motion</h2>
          </div>
        </div>
      </AspectRatio>
    </div>
  ),
};
export const Square: Story = {
  render: () => (
    <div className="w-64">
      <AspectRatio ratio={1}>
        <div
          className="grid h-full place-items-center rounded-xl bg-muted text-5xl"
          aria-label="앨범 커버"
        >
          ♫
        </div>
      </AspectRatio>
    </div>
  ),
};
