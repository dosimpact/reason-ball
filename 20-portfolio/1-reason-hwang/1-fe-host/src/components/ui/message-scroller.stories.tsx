import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  MessageScroller,
  MessageScrollerProvider,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from './message-scroller';

const meta = {
  title: 'UI/MessageScroller',
  component: MessageScroller,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <MessageScrollerProvider>
        <Story />
      </MessageScrollerProvider>
    ),
  ],
} satisfies Meta<typeof MessageScroller>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div style={{ height: '300px', width: '300px', border: '1px solid #ccc' }}>
      <MessageScroller>
        <MessageScrollerViewport>
          <MessageScrollerContent>
            <MessageScrollerItem>
              <div style={{ padding: '20px', background: '#f0f0f0', marginBottom: '10px' }}>Item 1</div>
            </MessageScrollerItem>
            <MessageScrollerItem>
              <div style={{ padding: '20px', background: '#f0f0f0', marginBottom: '10px' }}>Item 2</div>
            </MessageScrollerItem>
            <MessageScrollerItem>
              <div style={{ padding: '20px', background: '#f0f0f0', marginBottom: '10px' }}>Item 3</div>
            </MessageScrollerItem>
            <MessageScrollerItem>
              <div style={{ padding: '20px', background: '#f0f0f0', marginBottom: '10px' }}>Item 4</div>
            </MessageScrollerItem>
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton direction="end" />
      </MessageScroller>
    </div>
  ),
};
