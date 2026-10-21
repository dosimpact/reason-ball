import { useId, useState } from 'react';
import { SheetFooter, SheetClose } from './sheet';
import { Input } from './input';
import { Textarea } from './textarea';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from './sheet';

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
      <SheetTrigger render={<Button variant="outline" />}>
        패널 열기
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>프로젝트 설정</SheetTitle>
          <SheetDescription>프로젝트 정보를 확인합니다.</SheetDescription>
        </SheetHeader>
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
    await waitFor(() =>
      expect(page.getByRole('dialog', { name: '프로젝트 설정' })).toBeVisible(),
    );
    await userEvent.click(page.getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(page.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  },
};

export const Placement: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-wrap gap-3">
      {(['left', 'right', 'top', 'bottom'] as const).map((side) => (
        <Sheet key={side}>
          <SheetTrigger render={<Button variant="outline" />}>
            {side} 패널
          </SheetTrigger>
          <SheetContent side={side}>
            <SheetHeader>
              <SheetTitle>{side} 패널</SheetTitle>
              <SheetDescription>
                화면 가장자리에서 추가 정보를 보여줍니다.
              </SheetDescription>
            </SheetHeader>
            <p className="px-6 pb-6 text-sm">
              작업 맥락에 맞는 방향을 선택하세요. Escape로 닫을 수 있습니다.
            </p>
          </SheetContent>
        </Sheet>
      ))}
    </div>
  ),
};

function ProjectSettings() {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [savedName, setSavedName] = useState('Design System');
  return (
    <div className="space-y-4">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button />}>프로젝트 편집</SheetTrigger>
        <SheetContent>
          <form
            className="flex h-full flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              setSavedName(String(data.get('name')));
              setOpen(false);
            }}
          >
            <SheetHeader>
              <SheetTitle>프로젝트 편집</SheetTitle>
              <SheetDescription>
                이 예제의 변경 내용은 현재 스토리 안에서만 유지됩니다.
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-6">
              <label className="block space-y-2" htmlFor={id}>
                <span>프로젝트 이름</span>
                <Input id={id} name="name" required defaultValue={savedName} />
              </label>
              <label className="block space-y-2">
                <span>설명</span>
                <Textarea
                  name="description"
                  defaultValue="함께 만드는 재사용 가능한 UI 컴포넌트"
                />
              </label>
            </div>
            <SheetFooter>
              <Button type="submit">변경사항 저장</Button>
              <SheetClose render={<Button type="button" variant="outline" />}>
                취소
              </SheetClose>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
      <p className="text-sm" role="status">
        현재 프로젝트: {savedName}
      </p>
    </div>
  );
}
export const EditProject: Story = {
  parameters: { controls: { disable: true } },
  render: () => <ProjectSettings />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole('button', { name: '프로젝트 편집' }),
    );
    const name = await page.findByRole('textbox', { name: '프로젝트 이름' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Portfolio v2');
    await userEvent.click(page.getByRole('button', { name: '변경사항 저장' }));
    await waitFor(() =>
      expect(canvas.getByRole('status')).toHaveTextContent('Portfolio v2'),
    );
    await waitFor(() =>
      expect(page.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  },
};
