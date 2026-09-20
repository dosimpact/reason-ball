import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Marker, MarkerContent } from './marker';

const meta = {
  title: 'UI/Marker',
  component: Marker,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {},
} satisfies Meta<typeof Marker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Marker {...args} className="w-72" variant="separator"><MarkerContent>오늘</MarkerContent></Marker>
  ),
};
