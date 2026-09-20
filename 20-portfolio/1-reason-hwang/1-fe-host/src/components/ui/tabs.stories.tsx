import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';

const meta = {
  title: 'UI/Tabs',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Workspace: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-[min(85vw,480px)]">
      <TabsList>
        <TabsTrigger value="overview">개요</TabsTrigger>
        <TabsTrigger value="activity">활동</TabsTrigger>
        <TabsTrigger value="billing" disabled>
          청구
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="rounded-lg border p-6">
        <h3 className="font-semibold">이번 주 프로젝트</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          12개 작업 완료 · 검토 대기 3개
        </p>
      </TabsContent>
      <TabsContent value="activity" className="rounded-lg border p-6">
        <p className="text-sm">
          오늘 10:30 · 디자인 시안이 업데이트되었습니다.
        </p>
      </TabsContent>
    </Tabs>
  ),
};
export const Vertical: Story = {
  render: () => (
    <Tabs defaultValue="profile" orientation="vertical">
      <TabsList>
        <TabsTrigger value="profile">프로필</TabsTrigger>
        <TabsTrigger value="security">보안</TabsTrigger>
      </TabsList>
      <TabsContent value="profile" className="p-4">
        이름과 소개를 관리합니다.
      </TabsContent>
      <TabsContent value="security" className="p-4">
        비밀번호와 로그인 기록을 관리합니다.
      </TabsContent>
    </Tabs>
  ),
};

export const Interaction: Story = {
  ...Workspace,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('tab', { name: '활동' }));
    await expect(
      canvas.getByRole('tabpanel', { name: '활동' }),
    ).toHaveTextContent('오늘 10:30');
  },
};
