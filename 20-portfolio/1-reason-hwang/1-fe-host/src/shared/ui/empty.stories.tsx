import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
} from './empty';

const meta = {
  title: 'UI/Empty',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const NoProjects: Story = {
  render: () => (
    <Empty className="max-w-md border">
      <EmptyHeader>
        <EmptyMedia variant="icon">＋</EmptyMedia>
        <EmptyTitle>아직 프로젝트가 없습니다</EmptyTitle>
        <EmptyDescription>
          첫 프로젝트를 만들고 팀과 아이디어를 공유하세요.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <p className="text-xs text-muted-foreground">
          프로젝트 생성 전의 초기 화면 예시입니다.
        </p>
      </EmptyContent>
    </Empty>
  ),
};
export const NoResults: Story = {
  render: () => (
    <Empty className="max-w-md border">
      <EmptyHeader>
        <EmptyMedia variant="icon">⌕</EmptyMedia>
        <EmptyTitle>검색 결과가 없습니다</EmptyTitle>
        <EmptyDescription>
          다른 검색어를 사용하거나 필터 범위를 넓혀 보세요.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  ),
};
