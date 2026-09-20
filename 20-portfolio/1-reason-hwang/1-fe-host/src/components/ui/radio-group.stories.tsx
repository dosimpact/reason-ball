import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RadioGroup, RadioGroupItem } from './radio-group';

const meta = {
  title: 'UI/Radio Group',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Plans: Story = {
  render: () => (
    <RadioGroup defaultValue="pro" className="w-80">
      {[
        ['free', 'Free', '개인 프로젝트 · 무료'],
        ['pro', 'Pro', '협업과 무제한 프로젝트 · 월 ₩19,000'],
        ['enterprise', 'Enterprise', '조직을 위한 맞춤 구성'],
      ].map(([value, title, description]) => (
        <label
          key={value}
          className="flex items-center gap-3 rounded-lg border p-4"
        >
          <RadioGroupItem value={value} />
          <span>
            <strong className="block text-sm">{title}</strong>
            <span className="text-xs text-muted-foreground">{description}</span>
          </span>
        </label>
      ))}
    </RadioGroup>
  ),
};
export const Disabled: Story = {
  render: () => (
    <RadioGroup disabled defaultValue="managed">
      <label className="flex gap-2 text-sm">
        <RadioGroupItem value="managed" />
        관리자 설정
      </label>
    </RadioGroup>
  ),
};

export const Interaction: Story = {
  ...Plans,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const radio = canvas.getByRole('radio', { name: /Free/ });
    await userEvent.click(radio);
    await expect(radio).toBeChecked();
  },
};
