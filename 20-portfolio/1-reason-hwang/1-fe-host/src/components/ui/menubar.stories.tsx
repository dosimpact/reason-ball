import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarCheckboxItem,
} from './menubar';

const meta = {
  title: 'UI/Menubar',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
function EditorMenuDemo() {
  const [status, setStatus] = useState('문서 준비 완료');
  const [grid, setGrid] = useState(true);
  return (
    <div className="space-y-4">
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>파일</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={() => setStatus('새 문서가 생성되었습니다')}>
              새 문서<MenubarShortcut>⌘ N</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={() => setStatus('문서를 저장했습니다')}>
              저장<MenubarShortcut>⌘ S</MenubarShortcut>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>보기</MenubarTrigger>
          <MenubarContent>
            <MenubarCheckboxItem checked={grid} onCheckedChange={setGrid}>
              그리드 표시
            </MenubarCheckboxItem>
            <MenubarItem disabled>전체 화면</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
      <p role="status" className="text-sm text-muted-foreground">
        {status} · 그리드 {grid ? '켜짐' : '꺼짐'}
      </p>
    </div>
  );
}
export const EditorMenu: Story = { render: () => <EditorMenuDemo /> };
export const DisabledMenu: Story = {
  render: () => (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger disabled>읽기 전용 파일</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>저장</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  ),
};

export const Interaction: Story = {
  ...EditorMenu,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('menuitem', { name: '파일' }));
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await body.findByRole('menuitem', { name: /새 문서/ }),
    );
    await expect(canvas.getByRole('status')).toHaveTextContent(
      '새 문서가 생성되었습니다',
    );
  },
};
