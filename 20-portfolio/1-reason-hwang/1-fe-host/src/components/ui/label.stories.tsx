import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Label } from './label';
import { Input } from './input';

const meta = {
  title: 'UI/Label',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const FormField: Story = {
  render: () => (
    <div className="w-72 space-y-2">
      <Label htmlFor="label-email">
        이메일 <span className="text-destructive">*</span>
      </Label>
      <Input id="label-email" type="email" placeholder="you@example.com" />
      <p className="text-xs text-muted-foreground">
        라벨을 클릭하면 입력으로 포커스가 이동합니다.
      </p>
    </div>
  ),
};
export const DisabledField: Story = {
  render: () => (
    <div className="w-72 space-y-2">
      <Label htmlFor="label-disabled">워크스페이스 ID</Label>
      <Input id="label-disabled" disabled value="workspace-001" />
    </div>
  ),
};
