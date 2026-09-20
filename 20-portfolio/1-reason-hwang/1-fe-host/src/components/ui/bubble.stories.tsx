import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Bubble, BubbleContent } from './bubble';

const meta = {
  title: 'UI/Bubble',
  component: Bubble,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {},
} satisfies Meta<typeof Bubble>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Bubble {...args}><BubbleContent>안녕하세요! 무엇을 도와드릴까요?</BubbleContent></Bubble>
  ),
};
