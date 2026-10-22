import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Progress, ProgressLabel, ProgressValue } from './progress';

const meta = {
  title: 'UI/Progress',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Stages: Story = {
  render: () => (
    <div className="w-80 space-y-6">
      {[0, 35, 75, 100].map((value) => (
        <Progress key={value} value={value}>
          <ProgressLabel>
            {value === 100 ? '업로드 완료' : '파일 업로드'}
          </ProgressLabel>
          <ProgressValue />
        </Progress>
      ))}
    </div>
  ),
};
export const Indeterminate: Story = {
  render: () => (
    <Progress value={null} className="w-80">
      <ProgressLabel>서버 응답을 기다리는 중</ProgressLabel>
    </Progress>
  ),
};
