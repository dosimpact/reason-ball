import { expect, userEvent, within, waitFor } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from './drawer';
import { Button } from './button';

const meta = {
  title: 'UI/Drawer',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    controls: { disable: true },
    docs: { story: { inline: false, height: 420 } },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Drawer showSwipeHandle>
      <DrawerTrigger render={<Button variant="outline" />}>
        상세 보기
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>프로젝트 정보</DrawerTitle>
          <DrawerDescription>디자인 시스템 구축 · 2026년 9월</DrawerDescription>
        </DrawerHeader>
        <div className="p-4 text-sm">
          담당 팀: Product Design
          <br />
          완료된 작업: 24 / 32
        </div>
        <DrawerFooter>
          <DrawerClose render={<Button variant="outline" />}>닫기</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
};
export const Open: Story = {
  render: () => (
    <Drawer defaultOpen showSwipeHandle>
      <DrawerTrigger render={<Button variant="outline" />}>
        상세 보기
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>프로젝트 정보</DrawerTitle>
          <DrawerDescription>디자인 시스템 구축 · 2026년 9월</DrawerDescription>
        </DrawerHeader>
        <div className="p-4 text-sm">
          담당 팀: Product Design
          <br />
          완료된 작업: 24 / 32
        </div>
        <DrawerFooter>
          <DrawerClose render={<Button variant="outline" />}>닫기</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
};

export const Interaction: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: '상세 보기' }));
    const body = within(canvasElement.ownerDocument.body);
    const popup = await body.findByRole('dialog');
    await waitFor(() => expect(popup).toBeVisible());
    await userEvent.click(within(popup).getByRole('button', { name: '닫기' }));
    await waitFor(() =>
      expect(body.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  },
};
