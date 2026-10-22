import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuCheckboxItem,
  ContextMenuShortcut,
} from './context-menu';

const meta = {
  title: 'UI/Context Menu',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
function ContextDemo() {
  const [status, setStatus] = useState('파일을 오른쪽 클릭하세요');
  const [pinned, setPinned] = useState(false);
  return (
    <div className="space-y-3">
      <ContextMenu>
        <ContextMenuTrigger className="grid h-40 w-72 place-items-center rounded-lg border border-dashed text-sm">
          design-system.fig
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onClick={() => setStatus('파일 이름을 복사했습니다')}
          >
            이름 복사<ContextMenuShortcut>⌘ C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuCheckboxItem checked={pinned} onCheckedChange={setPinned}>
            즐겨찾기에 고정
          </ContextMenuCheckboxItem>
          <ContextMenuItem disabled>삭제 권한 없음</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <p role="status" className="text-sm text-muted-foreground">
        {pinned ? '즐겨찾기에 고정됨' : status}
      </p>
    </div>
  );
}
export const FileActions: Story = { render: () => <ContextDemo /> };
export const DisabledActions: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenuTrigger className="grid h-40 w-72 place-items-center rounded-lg border border-dashed text-sm">
        읽기 전용 · 오른쪽 클릭
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem disabled>잘라내기</ContextMenuItem>
        <ContextMenuItem disabled>삭제</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ),
};
