import { StoryGallery, StorySample } from '../../stories/ui-gallery';
import { BubbleGroup, BubbleReactions } from './bubble';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Bubble, BubbleContent } from './bubble';

const meta = {
  title: 'UI/Bubble',
  component: Bubble,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'secondary',
        'muted',
        'tinted',
        'outline',
        'ghost',
        'destructive',
      ],
    },
    align: { control: 'inline-radio', options: ['start', 'end'] },
  },
} satisfies Meta<typeof Bubble>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Bubble {...args}>
      <BubbleContent>안녕하세요! 무엇을 도와드릴까요?</BubbleContent>
    </Bubble>
  ),
};

export const Variants: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <StoryGallery
      title="말풍선의 표현"
      description="발신자와 메시지의 성격에 따라 배경과 테두리를 선택합니다."
    >
      {(
        [
          'default',
          'secondary',
          'muted',
          'tinted',
          'outline',
          'ghost',
          'destructive',
        ] as const
      ).map((variant) => (
        <StorySample key={variant} title={variant}>
          <Bubble variant={variant}>
            <BubbleContent>프로젝트 리뷰를 시작해볼까요?</BubbleContent>
          </Bubble>
        </StorySample>
      ))}
    </StoryGallery>
  ),
};
export const Conversation: Story = {
  render: () => (
    <BubbleGroup className="w-full max-w-md rounded-xl border p-5">
      <Bubble variant="secondary">
        <BubbleContent>
          시안 검토가 끝났어요. 버튼 간격만 조금 넓혀주세요.
        </BubbleContent>
      </Bubble>
      <Bubble align="end">
        <BubbleContent>좋아요! 모바일 화면도 함께 확인할게요.</BubbleContent>
        <BubbleReactions>👍 2</BubbleReactions>
      </Bubble>
      <Bubble variant="secondary" className="mt-4">
        <BubbleContent>
          감사합니다. 내일 오전에 다시 공유해주세요.
        </BubbleContent>
      </Bubble>
    </BubbleGroup>
  ),
};
export const LongContent: Story = {
  render: () => (
    <div className="w-full max-w-sm">
      <Bubble variant="outline">
        <BubbleContent>
          <p>긴 메시지도 말풍선의 최대 너비 안에서 자연스럽게 줄바꿈됩니다.</p>
          <p className="mt-2">{'very-long-project-reference-'.repeat(8)}</p>
        </BubbleContent>
      </Bubble>
    </div>
  ),
};
