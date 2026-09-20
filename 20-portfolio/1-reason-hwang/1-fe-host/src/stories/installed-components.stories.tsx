import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Questionnaire, QuestionnaireItem, QuestionnaireTitle, QuestionnaireChoices, QuestionnaireChoice, QuestionnaireActions, QuestionnaireSubmit } from '@/components/ui/questionnaire';
import { StoryGallery, StorySample } from './ui-gallery';

const meta = {
  title: 'Installation/Registry smoke check',
  parameters: { layout: 'padded', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const items = [{ name: 'theme', required: true, choices: [{ value: 'light', label: '라이트' }, { value: 'dark', label: '다크' }] }] as const;

export const Installed: Story = {
  render: () => (
    <StoryGallery title="설치된 컴포넌트 확인" description="CLI로 추가한 기본 입력, 달력, 설문 컴포넌트의 호환성을 확인합니다.">
      <StorySample title="Accordion">
        <Accordion><AccordionItem value="install"><AccordionTrigger>설치 정보</AccordionTrigger><AccordionContent>Base UI · Mira · Phosphor</AccordionContent></AccordionItem></Accordion>
      </StorySample>
      <StorySample title="입력 및 진행 상태">
        <label className="flex items-center gap-2 text-sm"><Checkbox />알림 받기</label>
        <label className="flex items-center gap-2 text-sm"><Switch />미리보기</label>
        <Progress value={65} aria-label="설치 진행률" className="w-full" />
      </StorySample>
      <StorySample title="Calendar"><Calendar mode="single" defaultMonth={new Date(2026, 8, 1)} /></StorySample>
      <StorySample title="Questionnaire">
        <Questionnaire items={items} onSubmit={(event) => event.preventDefault()}>
          <QuestionnaireItem name="theme" required>
            <QuestionnaireTitle>선호하는 테마는 무엇인가요?</QuestionnaireTitle>
            <QuestionnaireChoices>{items[0].choices.map((choice) => <QuestionnaireChoice key={choice.value} value={choice.value}>{choice.label}</QuestionnaireChoice>)}</QuestionnaireChoices>
          </QuestionnaireItem>
          <QuestionnaireActions><QuestionnaireSubmit>선택 완료</QuestionnaireSubmit></QuestionnaireActions>
        </Questionnaire>
      </StorySample>
    </StoryGallery>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: '설치 정보' }));
    await expect(await canvas.findByText('Base UI · Mira · Phosphor')).toBeVisible();
    const checkbox = canvas.getByRole('checkbox', { name: '알림 받기' });
    await userEvent.click(checkbox);
    await expect(checkbox).toBeChecked();
    await expect(canvas.getByText('선호하는 테마는 무엇인가요?')).toBeVisible();
  },
};
