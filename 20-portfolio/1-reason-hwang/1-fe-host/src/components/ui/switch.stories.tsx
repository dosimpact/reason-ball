import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Switch } from './switch';

const meta = {
  title: 'UI/Switch',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Settings: Story = {
  render: () => (
    <div className="w-80 space-y-5">
      {['실시간 알림', '주간 리포트', '마케팅 수신'].map((label, i) => (
        <label
          key={label}
          className="flex items-center justify-between gap-4 text-sm"
        >
          {label}
          <Switch defaultChecked={i === 0} />
        </label>
      ))}
    </div>
  ),
};
export const Disabled: Story = {
  render: () => (
    <label className="flex items-center gap-3 text-sm text-muted-foreground">
      <Switch disabled defaultChecked />
      조직 정책으로 활성화됨
    </label>
  ),
};

export const Interaction: Story = {
  ...Settings,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('switch', { name: '주간 리포트' });
    await userEvent.click(toggle);
    await expect(toggle).toBeChecked();
  },
};
