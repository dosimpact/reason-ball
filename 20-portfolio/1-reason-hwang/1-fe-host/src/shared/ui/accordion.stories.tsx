import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from './accordion';

const meta = {
  title: 'UI/Accordion',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const FrequentlyAskedQuestions: Story = {
  render: () => (
    <Accordion className="w-[min(80vw,480px)]" defaultValue={['billing']}>
      {[
        [
          'billing',
          '결제는 언제 진행되나요?',
          '매월 가입일에 결제되며 청구 내역은 설정에서 확인할 수 있습니다.',
        ],
        [
          'team',
          '팀원을 초대할 수 있나요?',
          '워크스페이스 설정에서 이메일로 초대할 수 있습니다.',
        ],
        [
          'export',
          '데이터를 내보내려면?',
          '설정의 데이터 메뉴에서 CSV로 다운로드하세요.',
        ],
      ].map(([value, title, body]) => (
        <AccordionItem key={value} value={value}>
          <AccordionTrigger>{title}</AccordionTrigger>
          <AccordionContent>{body}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  ),
};
export const MultipleOpen: Story = {
  render: () => (
    <Accordion multiple defaultValue={['design', 'code']} className="w-80">
      {['design', 'code'].map((value) => (
        <AccordionItem key={value} value={value}>
          <AccordionTrigger>
            {value === 'design' ? '디자인 검토' : '코드 검토'}
          </AccordionTrigger>
          <AccordionContent>
            각 항목을 독립적으로 열고 닫을 수 있습니다.
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  ),
};

export const Interaction: Story = {
  ...FrequentlyAskedQuestions,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: '팀원을 초대할 수 있나요?' }),
    );
    await expect(
      await canvas.findByText(
        '워크스페이스 설정에서 이메일로 초대할 수 있습니다.',
      ),
    ).toBeVisible();
  },
};
