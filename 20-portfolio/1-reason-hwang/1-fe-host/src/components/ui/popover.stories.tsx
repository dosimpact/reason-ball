import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
  PopoverDescription,
} from './popover';
import { Button } from './button';
import { Input } from './input';

const meta = {
  title: 'UI/Popover',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const DisplaySettings: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" />}>
        표시 설정
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <PopoverTitle>카드 설정</PopoverTitle>
        <PopoverDescription>
          미리보기 카드의 크기를 입력하세요.
        </PopoverDescription>
        <label className="mt-3 grid grid-cols-3 items-center gap-2 text-sm">
          너비
          <Input className="col-span-2" type="number" defaultValue={320} />
        </label>
        <label className="mt-2 grid grid-cols-3 items-center gap-2 text-sm">
          높이
          <Input className="col-span-2" type="number" defaultValue={180} />
        </label>
      </PopoverContent>
    </Popover>
  ),
};
export const Help: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" />}>
        공유 범위란?
      </PopoverTrigger>
      <PopoverContent>
        <PopoverTitle>팀 내부 공유</PopoverTitle>
        <PopoverDescription>
          초대받은 팀원만 프로젝트를 열람할 수 있습니다.
        </PopoverDescription>
      </PopoverContent>
    </Popover>
  ),
};

export const Interaction: Story = {
  ...DisplaySettings,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: '표시 설정' }));
    const body = within(canvasElement.ownerDocument.body);
    const width = await body.findByRole('spinbutton', { name: '너비' });
    await userEvent.clear(width);
    await userEvent.type(width, '480');
    await expect(width).toHaveValue(480);
    await userEvent.keyboard('{Escape}');
  },
};
