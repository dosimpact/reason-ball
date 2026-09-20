import { Copy, Download, Info } from 'lucide-react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from './tooltip';

import { Button } from './button';

import { expect, userEvent, waitFor, within } from 'storybook/test';

const meta = {
  title: 'UI/Tooltip',
  component: Tooltip,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {},
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <TooltipProvider>
      <Tooltip {...args}>
        <TooltipTrigger render={<Button variant="outline" />}>
          도움말
        </TooltipTrigger>
        <TooltipContent>컴포넌트에 대한 추가 설명입니다.</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};

export const Interaction: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: '도움말' });
    await userEvent.tab();
    await expect(trigger).toHaveFocus();
    const page = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(page.getByText('컴포넌트에 대한 추가 설명입니다.')).toBeVisible(),
    );
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        page.queryByText('컴포넌트에 대한 추가 설명입니다.'),
      ).not.toBeInTheDocument(),
    );
  },
};

export const Placement: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <TooltipProvider>
      <div className="flex flex-wrap justify-center gap-6 p-12">
        {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
          <Tooltip key={side}>
            <TooltipTrigger render={<Button variant="outline" />}>
              {side}
            </TooltipTrigger>
            <TooltipContent side={side}>{side} 방향의 도움말</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  ),
};
export const IconToolbar: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <TooltipProvider>
      <div className="flex gap-2 rounded-xl border p-3">
        <Tooltip>
          <TooltipTrigger
            render={<Button variant="ghost" size="icon" aria-label="복사" />}
          >
            <Copy />
          </TooltipTrigger>
          <TooltipContent>클립보드에 복사 · ⌘C</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="다운로드" />
            }
          >
            <Download />
          </TooltipTrigger>
          <TooltipContent>파일 다운로드</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={<Button variant="ghost" size="icon" aria-label="정보" />}
          >
            <Info />
          </TooltipTrigger>
          <TooltipContent>마지막 수정: 2026년 9월 20일</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  ),
};
export const LongDescription: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<Button variant="outline" />}>
          공유 범위 알아보기
        </TooltipTrigger>
        <TooltipContent className="max-w-60 leading-relaxed">
          워크스페이스 멤버만 이 프로젝트를 볼 수 있습니다. 외부에 공유하려면
          프로젝트 설정에서 공개 링크를 활성화하세요.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};
