import { StoryGallery } from '../../stories/ui-gallery';
import { CardFooter, CardAction } from './card';
import { Button } from './button';
import { Badge } from './badge';
import { Skeleton } from './skeleton';
import { FolderPlus } from 'lucide-react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from './card';

const meta = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {},
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Card {...args} className="w-72">
      <CardHeader>
        <CardTitle>프로젝트</CardTitle>
        <CardDescription>프로젝트 요약을 확인하세요.</CardDescription>
      </CardHeader>
      <CardContent>
        Storybook에서 컴포넌트의 모양과 동작을 확인합니다.
      </CardContent>
    </Card>
  ),
};

export const ProjectOverview: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Card className="w-full max-w-sm">
      <div className="flex h-32 items-end bg-gradient-to-br from-primary/20 via-primary/5 to-background p-5">
        <span className="text-xs font-semibold tracking-widest text-primary">
          REASON / PORTFOLIO
        </span>
      </div>
      <CardHeader>
        <CardTitle>Design System</CardTitle>
        <CardDescription>
          일관된 경험을 만드는 컴포넌트 라이브러리
        </CardDescription>
        <CardAction>
          <Badge variant="secondary">진행 중</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          19개 컴포넌트의 상태와 실제 사용 예제를 팀과 공유합니다.
        </p>
        <div className="mt-4 flex gap-2">
          <Badge variant="outline">React</Badge>
          <Badge variant="outline">Storybook</Badge>
        </div>
      </CardContent>
      <CardFooter className="justify-between border-t">
        <span className="text-muted-foreground">오늘 업데이트</span>
        <Button variant="outline">프로젝트 보기</Button>
      </CardFooter>
    </Card>
  ),
};
export const Metrics: Story = {
  parameters: { layout: 'padded', controls: { disable: true } },
  render: () => (
    <StoryGallery
      title="요약 카드"
      description="제목·핵심 수치·보조 설명을 분리해 빠르게 읽을 수 있게 구성합니다."
    >
      {[
        ['진행 중 프로젝트', '12', '이번 달 +3'],
        ['검토 대기', '4', '이번 주 마감 2건'],
        ['완료한 작업', '128', '지난주 대비 +18%'],
        ['팀 멤버', '7', '활성 멤버 기준'],
      ].map(([title, value, description]) => (
        <Card key={title}>
          <CardHeader>
            <CardDescription>{title}</CardDescription>
            <CardTitle className="text-3xl">{value}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            {description}
          </CardContent>
        </Card>
      ))}
    </StoryGallery>
  ),
};
export const EmptyState: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Card className="w-full max-w-sm text-center">
      <CardContent className="flex flex-col items-center gap-3 py-5">
        <FolderPlus className="size-8 text-muted-foreground" />
        <h3 className="text-sm font-semibold">아직 프로젝트가 없습니다</h3>
        <p className="text-muted-foreground">
          첫 프로젝트를 만들고 아이디어를 기록해보세요.
        </p>
        <Button>
          <FolderPlus />
          프로젝트 만들기
        </Button>
      </CardContent>
    </Card>
  ),
};
export const Loading: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Card className="w-72" role="status" aria-label="프로젝트 로딩 중">
      <CardHeader>
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-2 h-3 w-full" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </CardContent>
    </Card>
  ),
};
