import { StoryGallery, StorySample } from '../../stories/ui-gallery';
import { Button } from './button';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Textarea } from './textarea';

const meta = {
  title: 'UI/Textarea',
  component: Textarea,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    readOnly: { control: 'boolean' },
    'aria-invalid': { control: 'boolean' },
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: '메시지를 입력하세요',
    'aria-label': '메시지',
    className: 'w-72',
  },
};

export const States: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <StoryGallery
      title="여러 줄 입력"
      description="빈 상태, 긴 내용, 오류와 읽기 전용 상태를 비교합니다."
    >
      <StorySample title="빈 상태">
        <Textarea
          aria-label="프로젝트 설명"
          placeholder="프로젝트의 목표를 적어주세요…"
        />
      </StorySample>
      <StorySample title="긴 텍스트">
        <Textarea
          aria-label="긴 설명"
          defaultValue={
            '사용자의 생각을 연결하는 포트폴리오입니다.\n\n컴포넌트를 재사용하고, 다양한 화면 크기에서 읽기 쉬운 인터페이스를 만듭니다.\n\n긴 문장은 자동으로 줄바꿈되며 내용에 맞춰 높이가 늘어납니다.'
          }
        />
      </StorySample>
      <StorySample title="오류">
        <Textarea
          aria-label="필수 설명"
          aria-invalid="true"
          placeholder="필수 입력입니다"
        />
        <p className="text-xs text-destructive">설명을 입력해주세요.</p>
      </StorySample>
      <StorySample title="비활성">
        <Textarea
          aria-label="비활성 설명"
          disabled
          defaultValue="이 프로젝트는 보관되었습니다."
        />
      </StorySample>
    </StoryGallery>
  ),
};
export const Composer: Story = {
  render: () => (
    <div className="w-full max-w-md space-y-3 rounded-xl border p-4">
      <label className="block space-y-2">
        <span className="text-sm font-medium">피드백 남기기</span>
        <Textarea placeholder="좋았던 점이나 개선할 점을 알려주세요." />
      </label>
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          공개 게시 전 내용을 확인하세요.
        </p>
        <Button>댓글 작성</Button>
      </div>
    </div>
  ),
};
export const ReadOnly: Story = {
  args: { readOnly: true, value: '검토가 완료되어 수정할 수 없는 메모입니다.' },
};
