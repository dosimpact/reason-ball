import { StoryGallery, StorySample } from '../../stories/ui-gallery';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Skeleton } from './skeleton';

const meta = {
  title: 'UI/Skeleton',
  component: Skeleton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {},
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    className: 'h-20 w-72',
    'aria-label': '콘텐츠 로딩 중',
    role: 'status',
  },
};

export const ContentPatterns: Story = {
  parameters: { layout: 'padded', controls: { disable: true } },
  render: () => (
    <StoryGallery
      title="로딩 중의 레이아웃"
      description="실제 콘텐츠의 형태를 유지해 로딩 후 레이아웃 변화를 줄입니다."
    >
      <StorySample title="프로필">
        <div
          className="flex w-full items-center gap-3"
          role="status"
          aria-label="프로필 로딩 중"
        >
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-40 max-w-full" />
          </div>
        </div>
      </StorySample>
      <StorySample title="프로젝트 카드">
        <div
          className="w-full space-y-3"
          role="status"
          aria-label="프로젝트 로딩 중"
        >
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </StorySample>
      <StorySample title="메시지">
        <div
          className="w-full space-y-2"
          role="status"
          aria-label="메시지 로딩 중"
        >
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </StorySample>
      <StorySample title="목록">
        <div
          className="w-full space-y-4"
          role="status"
          aria-label="목록 로딩 중"
        >
          {[1, 2, 3].map((item) => (
            <div key={item} className="flex gap-3">
              <Skeleton className="size-8 rounded-md" />
              <Skeleton className="h-8 flex-1" />
            </div>
          ))}
        </div>
      </StorySample>
    </StoryGallery>
  ),
};
export const Profile: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      className="flex items-center gap-3"
      role="status"
      aria-label="프로필 로딩 중"
    >
      <Skeleton className="size-12 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  ),
};
