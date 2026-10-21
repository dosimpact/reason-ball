import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from './button-group';
import { Button } from './button';

const meta = {
  title: 'UI/Button Group',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Toolbar: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline">되돌리기</Button>
      <Button variant="outline">다시 실행</Button>
      <ButtonGroupSeparator />
      <Button variant="outline">저장</Button>
    </ButtonGroup>
  ),
};
export const Segmented: Story = {
  render: () => (
    <ButtonGroup>
      <ButtonGroupText>내보내기</ButtonGroupText>
      <Button variant="outline">CSV</Button>
      <Button variant="outline">JSON</Button>
      <Button variant="outline" disabled>
        PDF
      </Button>
    </ButtonGroup>
  ),
};
