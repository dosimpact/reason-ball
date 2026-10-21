import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ToggleGroup, ToggleGroupItem } from './toggle-group';

const meta = {
  title: 'UI/Toggle Group',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Alignment: Story = {
  render: () => (
    <ToggleGroup defaultValue={['left']} variant="outline">
      {['left', 'center', 'right'].map((value) => (
        <ToggleGroupItem key={value} value={value} aria-label={value}>
          {value}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  ),
};
export const MultipleFormats: Story = {
  render: () => (
    <ToggleGroup multiple defaultValue={['bold', 'italic']}>
      <ToggleGroupItem value="bold">
        <b>Bold</b>
      </ToggleGroupItem>
      <ToggleGroupItem value="italic">
        <i>Italic</i>
      </ToggleGroupItem>
      <ToggleGroupItem value="underline">
        <u>Underline</u>
      </ToggleGroupItem>
    </ToggleGroup>
  ),
};
