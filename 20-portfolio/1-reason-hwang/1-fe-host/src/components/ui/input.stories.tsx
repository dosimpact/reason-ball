import { StoryGallery, StorySample } from '../../stories/ui-gallery';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Input } from './input';

const meta = {
  title: 'UI/Input',
  component: Input,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    readOnly: { control: 'boolean' },
    'aria-invalid': { control: 'boolean' },
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'search', 'number'],
    },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: '이름을 입력하세요',
    'aria-label': '이름',
    className: 'w-72',
  },
};

export const States: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <StoryGallery
      title="입력 필드 상태"
      description="각 입력의 이름, 안내 문구, 오류 메시지를 함께 확인합니다."
    >
      <StorySample title="기본">
        <label className="w-full space-y-2">
          <span className="text-xs">프로젝트 이름</span>
          <Input placeholder="새 프로젝트" />
        </label>
      </StorySample>
      <StorySample title="입력 완료">
        <Input aria-label="입력 완료 예제" defaultValue="Reason Portfolio" />
      </StorySample>
      <StorySample title="유효하지 않은 값">
        <label className="w-full space-y-2">
          <span className="text-xs">이메일</span>
          <Input type="email" aria-invalid="true" defaultValue="reason@" />
          <span className="text-xs text-destructive">
            이메일 주소를 확인하세요.
          </span>
        </label>
      </StorySample>
      <StorySample title="비활성">
        <Input
          aria-label="비활성 예제"
          disabled
          defaultValue="편집 권한이 필요합니다"
        />
      </StorySample>
      <StorySample title="읽기 전용">
        <Input aria-label="프로젝트 ID" readOnly value="project_2026_001" />
      </StorySample>
      <StorySample title="검색">
        <Input
          type="search"
          aria-label="프로젝트 검색"
          placeholder="프로젝트 검색…"
        />
      </StorySample>
    </StoryGallery>
  ),
};
export const Password: Story = {
  args: {
    type: 'password',
    'aria-label': '비밀번호',
    placeholder: '비밀번호를 입력하세요',
  },
};
export const Disabled: Story = {
  args: { disabled: true, defaultValue: '편집 권한이 필요합니다' },
};
export const Invalid: Story = {
  args: { 'aria-invalid': true, defaultValue: '잘못된 입력' },
};
