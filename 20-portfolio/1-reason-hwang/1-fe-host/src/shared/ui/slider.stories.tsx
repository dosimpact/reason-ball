import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Slider } from './slider';

const meta = {
  title: 'UI/Slider',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Volume: Story = {
  render: () => (
    <div className="w-72 space-y-4">
      <p className="text-sm">재생 볼륨</p>
      <Slider defaultValue={[40]} aria-label="재생 볼륨" />
    </div>
  ),
};
export const PriceRange: Story = {
  render: () => (
    <div className="w-80 space-y-4">
      <p className="text-sm">가격 범위 · 0–100만원</p>
      <Slider defaultValue={[20, 75]} step={5} aria-label="가격 범위" />
    </div>
  ),
};
export const Disabled: Story = {
  render: () => (
    <Slider
      disabled
      defaultValue={[60]}
      className="w-72"
      aria-label="잠긴 볼륨"
    />
  ),
};
