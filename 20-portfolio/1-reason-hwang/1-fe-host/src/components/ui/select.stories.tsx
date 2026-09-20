import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from './select';

const meta = {
  title: 'UI/Select',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const ProjectStatus: Story = {
  render: () => (
    <Select
      defaultValue="progress"
      items={{ backlog: '대기', progress: '진행 중', done: '완료' }}
    >
      <SelectTrigger className="w-52" aria-label="프로젝트 상태">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>상태</SelectLabel>
          <SelectItem value="backlog">대기</SelectItem>
          <SelectItem value="progress">진행 중</SelectItem>
          <SelectItem value="done">완료</SelectItem>
          <SelectItem value="archived" disabled>
            보관됨
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};
export const Placeholder: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-52" aria-label="담당자">
        <SelectValue placeholder="담당자 선택" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="reason">Reason</SelectItem>
        <SelectItem value="alex">Alex</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const Interaction: Story = {
  ...ProjectStatus,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('combobox'));
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole('option', { name: '완료' }));
    await expect(canvas.getByRole('combobox')).toHaveTextContent('완료');
  },
};
