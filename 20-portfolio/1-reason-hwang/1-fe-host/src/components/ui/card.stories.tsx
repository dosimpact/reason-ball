import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './card';

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
      <CardHeader><CardTitle>프로젝트</CardTitle><CardDescription>프로젝트 요약을 확인하세요.</CardDescription></CardHeader>
      <CardContent>Storybook에서 컴포넌트의 모양과 동작을 확인합니다.</CardContent>
    </Card>
  ),
};
