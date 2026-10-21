import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Checkbox } from './checkbox';

const meta = {
  title: 'UI/Checkbox',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const States: Story = {
  render: () => (
    <div className="space-y-4">
      {[
        { label: '이메일 알림' },
        { label: '이용약관 동의', defaultChecked: true },
        { label: '일부 항목 선택', indeterminate: true },
        { label: '관리자 전용', disabled: true },
      ].map(({ label, ...props }) => (
        <label key={label} className="flex items-center gap-3 text-sm">
          <Checkbox {...props} />
          {label}
        </label>
      ))}
    </div>
  ),
};
export const Preference: Story = {
  render: () => (
    <label className="flex max-w-sm items-start gap-3 rounded-xl border p-5">
      <Checkbox defaultChecked />
      <span className="space-y-1">
        <strong className="block text-sm">주간 활동 요약</strong>
        <span className="text-sm text-muted-foreground">
          매주 월요일에 프로젝트 진행 상황을 이메일로 받습니다.
        </span>
      </span>
    </label>
  ),
};

export const Interaction: Story = {
  ...States,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const box = canvas.getByRole('checkbox', { name: '이메일 알림' });
    await userEvent.click(box);
    await expect(box).toBeChecked();
  },
};
