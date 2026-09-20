import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Message, MessageContent, MessageHeader, MessageFooter } from './message';

import { Bubble, BubbleContent } from './bubble';

const meta = {
  title: 'UI/Message',
  component: Message,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {},
} satisfies Meta<typeof Message>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Message {...args} className="w-72">
      <MessageContent>
        <MessageHeader>Assistant</MessageHeader>
        <Bubble><BubbleContent>안녕하세요! 메시지 예제입니다.</BubbleContent></Bubble>
        <MessageFooter>오후 2:30</MessageFooter>
      </MessageContent>
    </Message>
  ),
};
