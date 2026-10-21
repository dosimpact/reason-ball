import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Alert, AlertTitle, AlertDescription } from './alert';

const meta = {
  title: 'UI/Alert',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Informational: Story = {
  render: () => (
    <Alert className="max-w-md">
      <AlertTitle>새 버전을 사용할 수 있습니다</AlertTitle>
      <AlertDescription>
        설정은 유지되며 다음 실행부터 업데이트가 적용됩니다.
      </AlertDescription>
    </Alert>
  ),
};
export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive" className="max-w-md">
      <AlertTitle>저장하지 못했습니다</AlertTitle>
      <AlertDescription>
        연결 상태를 확인한 뒤 다시 시도하세요. 작성한 내용은 남아 있습니다.
      </AlertDescription>
    </Alert>
  ),
};
