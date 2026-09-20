import { useState } from 'react';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from './dropdown-menu';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from './dropdown-menu';

import { Button } from './button';

import { expect, userEvent, waitFor, within } from 'storybook/test';

const meta = {
  title: 'UI/DropdownMenu',
  component: DropdownMenu,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {},
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <DropdownMenu {...args}>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        메뉴 열기
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>프로필</DropdownMenuItem>
        <DropdownMenuItem>설정</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const Interaction: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: '메뉴 열기' }));
    const page = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(page.getByRole('menuitem', { name: '프로필' })).toBeVisible(),
    );
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(page.queryByRole('menu')).not.toBeInTheDocument(),
    );
  },
};

export const ProjectActions: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        프로젝트 작업
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Design System</DropdownMenuLabel>
          <DropdownMenuItem>
            <Pencil />
            이름 변경<DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Copy />
            복제
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>내보내기</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>PDF 문서</DropdownMenuItem>
              <DropdownMenuItem>JSON 데이터</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem disabled>
            프로젝트 이전 (관리자 전용)
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <Trash2 />
          프로젝트 삭제
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

function DisplayPreferences() {
  const [showStatus, setShowStatus] = useState(true);
  const [density, setDensity] = useState('comfortable');
  return (
    <div className="space-y-4">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" />}>
          보기 설정
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-52">
          <DropdownMenuCheckboxItem
            checked={showStatus}
            onCheckedChange={setShowStatus}
            closeOnClick={false}
          >
            상태 배지 표시
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>목록 간격</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={density} onValueChange={setDensity}>
              <DropdownMenuRadioItem value="comfortable">
                넉넉하게
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="compact">
                촘촘하게
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <p className="text-xs text-muted-foreground" role="status">
        배지: {showStatus ? '표시' : '숨김'} · 간격:{' '}
        {density === 'compact' ? '촘촘하게' : '넉넉하게'}
      </p>
    </div>
  );
}
export const Preferences: Story = {
  parameters: { controls: { disable: true } },
  render: () => <DisplayPreferences />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: '보기 설정' }));
    const checkbox = await page.findByRole('menuitemcheckbox', {
      name: '상태 배지 표시',
    });
    await userEvent.click(checkbox);
    await waitFor(() =>
      expect(checkbox).toHaveAttribute('aria-checked', 'false'),
    );
    await userEvent.click(
      page.getByRole('menuitemradio', { name: '촘촘하게' }),
    );
    await waitFor(() =>
      expect(canvas.getByRole('status')).toHaveTextContent(
        '배지: 숨김 · 간격: 촘촘하게',
      ),
    );
    await userEvent.keyboard('{Escape}');
  },
};
