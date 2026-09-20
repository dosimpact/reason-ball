import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Attachment, AttachmentContent, AttachmentTitle, AttachmentDescription } from './attachment';

const meta = {
  title: 'UI/Attachment',
  component: Attachment,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {},
} satisfies Meta<typeof Attachment>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Attachment {...args}>
      <AttachmentContent>
        <AttachmentTitle>project-notes.pdf</AttachmentTitle>
        <AttachmentDescription>PDF · 240 KB</AttachmentDescription>
      </AttachmentContent>
    </Attachment>
  ),
};
