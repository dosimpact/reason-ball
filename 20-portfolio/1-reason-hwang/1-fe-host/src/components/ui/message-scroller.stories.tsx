import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
  MessageScroller,
  MessageScrollerProvider,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from './message-scroller';
import {
  Message,
  MessageContent,
  MessageHeader,
  MessageFooter,
} from './message';
import { Bubble, BubbleContent } from './bubble';
import { Button } from './button';
import { Badge } from './badge';

const meta = {
  title: 'UI/MessageScroller',
  component: MessageScroller,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          '고정 높이의 대화 영역. 위·아래 이동 버튼과 새 메시지 추가, 빈 대화 상태를 확인합니다.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof MessageScroller>;
export default meta;
type Story = StoryObj<typeof meta>;

const conversation = [
  '포트폴리오의 컴포넌트를 함께 검토해볼까요?',
  '좋아요. 모바일에서 버튼과 카드가 잘 보이는지 먼저 확인해주세요.',
  '카드는 좁은 화면에서 한 열로 표시하고, 긴 제목은 줄바꿈하는 구성이 좋겠습니다.',
  '첨부파일이 여러 개일 때도 보여주세요.',
  '가로 스크롤 영역 안에 파일 이름과 상태를 함께 배치할 수 있습니다.',
  '오류 메시지와 로딩 상태도 추가해주세요.',
  '네. 빈 상태, 업로드 실패, 답변 생성 중 상태를 각각 비교해보겠습니다.',
  '좋습니다. 스토리에서 직접 확인할게요.',
];

function ConversationExample({
  empty = false,
  compact = false,
}: {
  empty?: boolean;
  compact?: boolean;
}) {
  const [messages, setMessages] = useState(empty ? [] : conversation);
  return (
    <div
      className={`w-full ${compact ? 'max-w-xs' : 'max-w-lg'} overflow-hidden rounded-xl border bg-card`}
    >
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">프로젝트 리뷰</h3>
        <Badge variant="secondary">{messages.length} messages</Badge>
      </header>
      <div className="h-80">
        <MessageScrollerProvider>
          <MessageScroller>
            <MessageScrollerViewport aria-label="대화 내역" tabIndex={0}>
              <MessageScrollerContent className="p-4">
                {messages.length === 0 && (
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    아직 대화가 없습니다. 첫 메시지를 추가해보세요.
                  </div>
                )}
                {messages.map((content, index) => (
                  <MessageScrollerItem key={index}>
                    <Message align={index % 2 ? 'end' : 'start'}>
                      <MessageContent>
                        <MessageHeader>
                          {index % 2 ? '나' : 'Assistant'}
                        </MessageHeader>
                        <Bubble variant={index % 2 ? 'default' : 'secondary'}>
                          <BubbleContent>{content}</BubbleContent>
                        </Bubble>
                        <MessageFooter>
                          오후 2:{String(30 + index).padStart(2, '0')}
                        </MessageFooter>
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton direction="start" />
            <MessageScrollerButton direction="end" />
          </MessageScroller>
        </MessageScrollerProvider>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
        <span className="text-xs text-muted-foreground">
          위로 스크롤해 이전 대화를 확인하세요.
        </span>
        <Button
          onClick={() =>
            setMessages((current) => [
              ...current,
              `새 메시지 ${current.length + 1}: 검토 의견을 추가했습니다.`,
            ])
          }
        >
          메시지 추가
        </Button>
      </footer>
    </div>
  );
}

export const Default: Story = { render: () => <ConversationExample /> };
export const EmptyConversation: Story = {
  parameters: { controls: { disable: true } },
  render: () => <ConversationExample empty />,
};
export const Compact: Story = { render: () => <ConversationExample compact /> };
export const AddMessage: Story = {
  parameters: { controls: { disable: true } },
  render: () => <ConversationExample empty />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: '메시지 추가' }));
    await expect(
      canvas.getByText('새 메시지 1: 검토 의견을 추가했습니다.'),
    ).toBeVisible();
    await expect(
      canvas.queryByText(/아직 대화가 없습니다/),
    ).not.toBeInTheDocument();
  },
};
