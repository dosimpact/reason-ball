import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Toggle } from './toggle';

const meta = {
  title: 'UI/Toggle',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Formatting: Story = {
  render: () => (
    <div className="flex gap-3">
      <Toggle aria-label="굵게">
        <b>B</b>
      </Toggle>
      <Toggle aria-label="기울임" defaultPressed>
        <i>I</i>
      </Toggle>
      <Toggle aria-label="밑줄" variant="outline">
        <u>U</u>
      </Toggle>
      <Toggle disabled>잠김</Toggle>
    </div>
  ),
};
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      {(['sm', 'default', 'lg'] as const).map((size) => (
        <Toggle key={size} size={size} variant="outline">
          {size}
        </Toggle>
      ))}
    </div>
  ),
};

export const Interaction: Story = {
  ...Formatting,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', { name: '굵게' });
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  },
};
