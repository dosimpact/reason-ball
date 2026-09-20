import { Button } from './button';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Separator } from './separator';

const meta = {
  title: 'UI/Separator',
  component: Separator,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {},
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="w-72 space-y-4">
      <p>프로젝트 정보</p>
      <Separator {...args} />
      <p>추가 정보</p>
    </div>
  ),
};

export const Vertical: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex h-8 items-center gap-3">
      <Button variant="ghost">개요</Button>
      <Separator orientation="vertical" />
      <Button variant="ghost">활동</Button>
      <Separator orientation="vertical" />
      <Button variant="ghost">설정</Button>
    </div>
  ),
};
export const SettingsSections: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="w-full max-w-sm space-y-5 rounded-xl border p-6">
      <div>
        <h3 className="text-sm font-semibold">알림 설정</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          작업에 필요한 알림만 받아보세요.
        </p>
      </div>
      <Separator />
      <div className="flex justify-between text-sm">
        <span>댓글 알림</span>
        <span className="text-primary">사용 중</span>
      </div>
      <Separator />
      <div className="flex justify-between text-sm">
        <span>주간 요약</span>
        <span className="text-muted-foreground">매주 월요일</span>
      </div>
    </div>
  ),
};
