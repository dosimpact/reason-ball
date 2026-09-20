import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { Toaster, createToastManager } from './toast';
import { Button } from './button';

const meta = {
  title: 'UI/Toast',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
function NotificationDemo({ error = false }: { error?: boolean }) {
  const [manager] = useState(() => createToastManager());
  return (
    <Toaster toastManager={manager}>
      <Button
        variant={error ? 'destructive' : 'outline'}
        onClick={() =>
          manager.add({
            title: error ? '저장 실패' : '저장 완료',
            description: error
              ? '연결을 확인한 후 다시 시도하세요.'
              : '프로젝트 변경사항이 저장되었습니다.',
            type: error ? 'error' : 'success',
          })
        }
      >
        {error ? '오류 알림 표시' : '성공 알림 표시'}
      </Button>
    </Toaster>
  );
}
export const Notifications: Story = { render: () => <NotificationDemo /> };
export const ErrorNotification: Story = {
  render: () => <NotificationDemo error />,
};

export const Interaction: Story = {
  ...Notifications,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: '성공 알림 표시' }),
    );
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText('저장 완료')).toBeVisible();
  },
};
