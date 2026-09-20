import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from './tooltip';

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
        <TooltipTrigger render={<Button variant="outline" />}>도움말</TooltipTrigger>
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
    await waitFor(() => expect(page.getByText('컴포넌트에 대한 추가 설명입니다.')).toBeVisible());
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(page.queryByText('컴포넌트에 대한 추가 설명입니다.')).not.toBeInTheDocument());
  },
};
