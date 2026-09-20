import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ScrollArea, ScrollBar } from './scroll-area';

const meta = {
  title: 'UI/Scroll Area',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const ActivityFeed: Story = {
  render: () => (
    <ScrollArea className="h-72 w-80 rounded-lg border">
      <div className="p-4">
        <h3 className="mb-4 font-semibold">최근 활동</h3>
        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} className="border-b py-3 text-sm">
            <p>프로젝트 업데이트 #{20 - i}</p>
            <p className="text-xs text-muted-foreground">
              {i + 1}분 전 · 디자인 팀
            </p>
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};
export const Horizontal: Story = {
  render: () => (
    <ScrollArea className="w-[min(80vw,520px)] rounded-lg border">
      <div className="flex w-max gap-4 p-4">
        {['기획', '디자인', '개발', '검토', '배포'].map((label, i) => (
          <div
            key={label}
            className="grid h-36 w-48 place-items-center rounded-lg bg-muted"
          >
            <div className="text-center">
              <p className="text-xs text-muted-foreground">0{i + 1}</p>
              <strong>{label}</strong>
            </div>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  ),
};
