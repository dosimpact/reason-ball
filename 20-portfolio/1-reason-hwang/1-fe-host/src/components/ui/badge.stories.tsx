import { StoryGallery, StorySample } from '../../stories/ui-gallery';
import { Check, Clock, X } from 'lucide-react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Badge } from './badge';

const meta = {
  title: 'UI/Badge',
  component: Badge,
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
        'outline',
        'destructive',
        'ghost',
        'link',
      ],
    },
    children: { control: 'text' },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: '진행 중' },
};

export const Variants: Story = {
  parameters: { layout: 'padded', controls: { disable: true } },
  render: () => (
    <StoryGallery
      title="배지와 상태"
      description="짧은 상태 정보와 카테고리를 시각적으로 구분합니다."
    >
      {(
        [
          'default',
          'secondary',
          'outline',
          'destructive',
          'ghost',
          'link',
        ] as const
      ).map((variant) => (
        <StorySample key={variant} title={variant}>
          <Badge variant={variant}>Design system</Badge>
        </StorySample>
      ))}
    </StoryGallery>
  ),
};
export const WorkflowStatus: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge>
        <Check />
        완료
      </Badge>
      <Badge variant="secondary">
        <Clock />
        검토 중
      </Badge>
      <Badge variant="outline">초안</Badge>
      <Badge variant="destructive">
        <X />
        실패
      </Badge>
    </div>
  ),
};
export const Categories: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline">React</Badge>
      <Badge variant="outline">TypeScript</Badge>
      <Badge variant="secondary">UI / UX</Badge>
      <Badge variant="link" render={<a href="#all-tags" />}>
        전체 태그 보기
      </Badge>
    </div>
  ),
};
