import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './sheet';

import { Button } from './button';

import { expect, userEvent, waitFor, within } from 'storybook/test';

const meta = {
  title: 'UI/Sheet',
  component: Sheet,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {},
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Sheet {...args}>
      <SheetTrigger render={<Button variant="outline" />}>패널 열기</SheetTrigger>
      <SheetContent>
        <SheetHeader><SheetTitle>프로젝트 설정</SheetTitle><SheetDescription>프로젝트 정보를 확인합니다.</SheetDescription></SheetHeader>
      </SheetContent>
    </Sheet>
  ),
};

export const Interaction: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: '패널 열기' }));
    const page = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(page.getByRole('dialog', { name: '프로젝트 설정' })).toBeVisible());
    await userEvent.click(page.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(page.queryByRole('dialog')).not.toBeInTheDocument());
  },
};
