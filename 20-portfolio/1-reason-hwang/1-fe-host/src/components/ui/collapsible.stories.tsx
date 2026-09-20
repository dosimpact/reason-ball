import { Folder, FileText, ChevronDown } from 'lucide-react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from './collapsible';

import { Button } from './button';

import { expect, userEvent, waitFor, within } from 'storybook/test';

const meta = {
  title: 'UI/Collapsible',
  component: Collapsible,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {},
} satisfies Meta<typeof Collapsible>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Collapsible {...args} className="w-72">
      <CollapsibleTrigger render={<Button variant="outline" />}>
        상세 보기
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="py-4">프로젝트의 추가 정보입니다.</p>
      </CollapsibleContent>
    </Collapsible>
  ),
};

export const Interaction: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: '상세 보기' });
    await userEvent.click(trigger);
    await waitFor(() =>
      expect(canvas.getByText('프로젝트의 추가 정보입니다.')).toBeVisible(),
    );
    await userEvent.click(trigger);
    await waitFor(() =>
      expect(trigger).toHaveAttribute('aria-expanded', 'false'),
    );
  },
};

export const FileTree: Story = {
  render: () => (
    <Collapsible defaultOpen className="w-full max-w-sm rounded-xl border p-4">
      <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm font-medium">
        <Folder className="size-4 text-primary" />
        프로젝트 문서
        <ChevronDown className="ml-auto size-4" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-4 space-y-3 border-l pl-5 text-xs text-muted-foreground">
          {['요구사항.md', '화면 설계.fig', '컴포넌트 가이드.pdf'].map(
            (name) => (
              <li key={name} className="flex items-center gap-2">
                <FileText className="size-4" />
                {name}
              </li>
            ),
          )}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  ),
};
export const FAQ: Story = {
  render: () => (
    <div className="w-full max-w-lg space-y-3">
      {[
        [
          '프로젝트를 어떻게 공유하나요?',
          '프로젝트 설정에서 공유 링크를 생성하고 팀원에게 전달하세요.',
        ],
        [
          '작업 내용은 자동으로 저장되나요?',
          '변경 내용은 저장 버튼을 누르면 반영됩니다. 저장 상태를 확인해주세요.',
        ],
        [
          '컴포넌트를 직접 수정할 수 있나요?',
          'Controls에서 props를 바꿔보고 각 상태의 모습을 비교할 수 있습니다.',
        ],
      ].map(([question, answer]) => (
        <Collapsible key={question} className="rounded-lg border p-4">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 text-left text-sm font-medium">
            {question}
            <ChevronDown className="size-4 shrink-0" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="pt-4 text-sm leading-relaxed text-muted-foreground">
              {answer}
            </p>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  ),
};
export const Disabled: Story = { ...Default, args: { disabled: true } };
export const InitiallyOpen: Story = { ...Default, args: { defaultOpen: true } };
