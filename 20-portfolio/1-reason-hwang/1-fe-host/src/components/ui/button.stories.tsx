import { StoryGallery, StorySample } from '../../stories/ui-gallery';
import { ArrowRight, Download, LoaderCircle, Plus, Trash2 } from 'lucide-react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from './button';

const meta = {
  title: 'UI/Button',
  component: Button,
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
        'ghost',
        'destructive',
        'link',
      ],
    },
    size: {
      control: 'select',
      options: [
        'xs',
        'sm',
        'default',
        'lg',
        'icon-xs',
        'icon-sm',
        'icon',
        'icon-lg',
      ],
    },
    disabled: { control: 'boolean' },
    children: { control: 'text' },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: '버튼' },
};

const variants = [
  'default',
  'secondary',
  'outline',
  'ghost',
  'destructive',
  'link',
] as const;

export const Variants: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <StoryGallery
      title="버튼의 역할"
      description="주요 행동, 보조 행동, 위험한 작업의 시각적 우선순위를 비교합니다."
    >
      {variants.map((variant) => (
        <StorySample key={variant} title={variant}>
          <Button variant={variant}>프로젝트 만들기</Button>
          <Button variant={variant} disabled>
            사용 불가
          </Button>
        </StorySample>
      ))}
    </StoryGallery>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      {(['xs', 'sm', 'default', 'lg'] as const).map((size) => (
        <Button key={size} size={size}>
          <Plus />
          {size}
        </Button>
      ))}
    </div>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button>
        <Plus data-icon="inline-start" />새 프로젝트
      </Button>
      <Button variant="outline">
        <Download />
        내보내기
      </Button>
      <Button variant="secondary">
        다음 단계
        <ArrowRight data-icon="inline-end" />
      </Button>
      <Button variant="destructive" size="icon" aria-label="프로젝트 삭제">
        <Trash2 />
      </Button>
    </div>
  ),
};

export const Loading: Story = {
  args: {
    disabled: true,
    'aria-busy': true,
    children: (
      <>
        <LoaderCircle className="animate-spin" />
        저장 중…
      </>
    ),
  },
};

export const Disabled: Story = {
  args: { disabled: true, children: '권한이 필요합니다' },
};
