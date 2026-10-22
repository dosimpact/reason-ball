import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  NativeSelect,
  NativeSelectOption,
  NativeSelectOptGroup,
} from './native-select';

const meta = {
  title: 'UI/Native Select',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Grouped: Story = {
  render: () => (
    <NativeSelect aria-label="시간대" defaultValue="seoul">
      <NativeSelectOptGroup label="아시아">
        <NativeSelectOption value="seoul">서울 · UTC+9</NativeSelectOption>
        <NativeSelectOption value="singapore">
          싱가포르 · UTC+8
        </NativeSelectOption>
      </NativeSelectOptGroup>
      <NativeSelectOptGroup label="유럽">
        <NativeSelectOption value="london">런던 · UTC+0</NativeSelectOption>
      </NativeSelectOptGroup>
    </NativeSelect>
  ),
};
export const Disabled: Story = {
  render: () => (
    <NativeSelect disabled aria-label="고정 언어">
      <NativeSelectOption>한국어</NativeSelectOption>
    </NativeSelect>
  ),
};
