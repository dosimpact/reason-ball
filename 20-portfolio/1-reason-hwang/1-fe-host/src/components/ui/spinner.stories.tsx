import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Spinner } from './spinner';
import { Button } from './button';

const meta = {
  title: 'UI/Spinner',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <Spinner className="size-4" />
      <Spinner className="size-6" />
      <Spinner className="size-10" />
    </div>
  ),
};
export const LoadingActions: Story = {
  render: () => (
    <div className="flex gap-3">
      <Button disabled>
        <Spinner />
        저장 중
      </Button>
      <Button variant="outline" disabled>
        <Spinner />
        불러오는 중
      </Button>
    </div>
  ),
};
