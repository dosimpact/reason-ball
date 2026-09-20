import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from './collapsible';

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
      <CollapsibleTrigger render={<Button variant="outline" />}>상세 보기</CollapsibleTrigger>
      <CollapsibleContent><p className="py-4">프로젝트의 추가 정보입니다.</p></CollapsibleContent>
    </Collapsible>
  ),
};

export const Interaction: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: '상세 보기' });
    await userEvent.click(trigger);
    await waitFor(() => expect(canvas.getByText('프로젝트의 추가 정보입니다.')).toBeVisible());
    await userEvent.click(trigger);
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
  },
};
