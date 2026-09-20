import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from './command';

const meta = {
  title: 'UI/Command',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
function CommandDemo() {
  const [selection, setSelection] = useState('명령어를 선택하세요');
  return (
    <div className="w-80 space-y-3">
      <Command className="rounded-lg border">
        <CommandInput placeholder="명령어 검색…" />
        <CommandList>
          <CommandEmpty>일치하는 명령어가 없습니다.</CommandEmpty>
          <CommandGroup heading="프로젝트">
            {['새 프로젝트', '최근 파일', '설정'].map((label, i) => (
              <CommandItem key={label} onSelect={() => setSelection(label)}>
                {label}
                <CommandShortcut>⌘ {i + 1}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="계정">
            <CommandItem disabled>관리자 콘솔</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
      <p role="status" className="text-sm text-muted-foreground">
        {selection}
      </p>
    </div>
  );
}
export const SearchCommands: Story = { render: () => <CommandDemo /> };
export const EmptyResults: Story = {
  render: () => (
    <Command className="w-80 rounded-lg border">
      <CommandInput placeholder="검색…" defaultValue="없는 명령어" />
      <CommandList>
        <CommandEmpty>일치하는 명령어가 없습니다.</CommandEmpty>
        <CommandItem>프로젝트 열기</CommandItem>
      </CommandList>
    </Command>
  ),
};

export const Interaction: Story = {
  ...SearchCommands,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('combobox'), '최근 파일');
    await userEvent.click(canvas.getByRole('option', { name: /최근 파일/ }));
    await expect(canvas.getByRole('status')).toHaveTextContent('최근 파일');
  },
};
