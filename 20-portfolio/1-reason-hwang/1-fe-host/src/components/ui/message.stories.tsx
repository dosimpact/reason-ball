import { MessageGroup, MessageAvatar } from './message';
import { Avatar, AvatarFallback } from './avatar';
import {
  Attachment,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
} from './attachment';
import { Skeleton } from './skeleton';
import { Marker, MarkerContent } from './marker';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Message,
  MessageContent,
  MessageHeader,
  MessageFooter,
} from './message';

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
        <Bubble>
          <BubbleContent>안녕하세요! 메시지 예제입니다.</BubbleContent>
        </Bubble>
        <MessageFooter>오후 2:30</MessageFooter>
      </MessageContent>
    </Message>
  ),
};

export const Conversation: Story = {
  render: () => (
    <MessageGroup className="w-full max-w-lg gap-6 rounded-xl border p-5">
      <Marker variant="separator">
        <MarkerContent>오늘 · 프로젝트 리뷰</MarkerContent>
      </Marker>
      <Message>
        <MessageAvatar>
          <Avatar>
            <AvatarFallback>AI</AvatarFallback>
          </Avatar>
        </MessageAvatar>
        <MessageContent>
          <MessageHeader>Assistant</MessageHeader>
          <Bubble variant="secondary">
            <BubbleContent>
              포트폴리오 초안을 확인했어요. 어떤 부분을 먼저 개선할까요?
            </BubbleContent>
          </Bubble>
          <MessageFooter>오후 2:30</MessageFooter>
        </MessageContent>
      </Message>
      <Message align="end">
        <MessageContent>
          <MessageHeader>나</MessageHeader>
          <Bubble>
            <BubbleContent>
              모바일에서 읽기 쉽도록 카드 레이아웃을 개선해주세요.
            </BubbleContent>
          </Bubble>
          <MessageFooter>오후 2:31 · 읽음</MessageFooter>
        </MessageContent>
      </Message>
      <Message>
        <MessageAvatar>
          <Avatar>
            <AvatarFallback>AI</AvatarFallback>
          </Avatar>
        </MessageAvatar>
        <MessageContent>
          <MessageHeader>Assistant</MessageHeader>
          <Bubble variant="secondary">
            <BubbleContent>
              좋아요. 카드 너비, 제목 줄바꿈, 버튼 배치를 함께 확인하겠습니다.
            </BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    </MessageGroup>
  ),
};
export const WithAttachment: Story = {
  render: () => (
    <Message className="w-full max-w-sm">
      <MessageContent>
        <MessageHeader>Reason</MessageHeader>
        <Bubble>
          <BubbleContent>이번 리뷰에 참고할 문서를 첨부합니다.</BubbleContent>
        </Bubble>
        <Attachment>
          <AttachmentContent>
            <AttachmentTitle>portfolio-review.pdf</AttachmentTitle>
            <AttachmentDescription>PDF · 1.2 MB</AttachmentDescription>
          </AttachmentContent>
        </Attachment>
        <MessageFooter>오후 3:10</MessageFooter>
      </MessageContent>
    </Message>
  ),
};
export const Generating: Story = {
  render: () => (
    <Message className="w-full max-w-sm">
      <MessageAvatar>
        <Avatar>
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
      </MessageAvatar>
      <MessageContent>
        <MessageHeader>답변 작성 중…</MessageHeader>
        <div
          className="space-y-2 rounded-lg bg-muted p-4"
          role="status"
          aria-label="답변 생성 중"
        >
          <Skeleton className="h-3 w-full bg-foreground/10" />
          <Skeleton className="h-3 w-4/5 bg-foreground/10" />
          <Skeleton className="h-3 w-1/2 bg-foreground/10" />
        </div>
      </MessageContent>
    </Message>
  ),
};
export const DeliveryError: Story = {
  render: () => (
    <Message align="end" className="w-full max-w-sm">
      <MessageContent>
        <Bubble variant="destructive">
          <BubbleContent>메시지를 보내지 못했습니다.</BubbleContent>
        </Bubble>
        <MessageFooter className="text-destructive">
          연결을 확인한 후 다시 시도하세요.
        </MessageFooter>
      </MessageContent>
    </Message>
  ),
};
