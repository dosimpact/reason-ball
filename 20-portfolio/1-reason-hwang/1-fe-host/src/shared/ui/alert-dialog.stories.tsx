import { expect, userEvent, within, waitFor } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from './alert-dialog';
import { Button } from './button';

const meta = {
  title: 'UI/Alert Dialog',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    controls: { disable: true },
    docs: { story: { inline: false, height: 420 } },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline" />}>
        상세 보기
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>프로젝트 보관</AlertDialogTitle>
          <AlertDialogDescription>
            보관하면 프로젝트가 목록에서 숨겨집니다. 설정에서 복원할 수
            있습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="p-4 text-sm">
          담당 팀: Product Design
          <br />
          완료된 작업: 24 / 32
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel render={<Button variant="outline" />}>
            닫기
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};
export const Open: Story = {
  render: () => (
    <AlertDialog defaultOpen>
      <AlertDialogTrigger render={<Button variant="outline" />}>
        상세 보기
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>프로젝트 보관</AlertDialogTitle>
          <AlertDialogDescription>
            보관하면 프로젝트가 목록에서 숨겨집니다. 설정에서 복원할 수
            있습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="p-4 text-sm">
          담당 팀: Product Design
          <br />
          완료된 작업: 24 / 32
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel render={<Button variant="outline" />}>
            닫기
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};

export const Interaction: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: '상세 보기' }));
    const body = within(canvasElement.ownerDocument.body);
    const popup = await body.findByRole('alertdialog');
    await waitFor(() => expect(popup).toBeVisible());
    await userEvent.click(within(popup).getByRole('button', { name: '닫기' }));
    await waitFor(() =>
      expect(body.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
  },
};
