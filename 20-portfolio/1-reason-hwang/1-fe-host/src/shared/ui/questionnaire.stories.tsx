import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import {
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireTitle,
  QuestionnaireDescription,
  QuestionnaireChoices,
  QuestionnaireChoice,
  QuestionnaireError,
  QuestionnaireProgress,
  QuestionnaireActions,
  QuestionnairePrevious,
  QuestionnaireNext,
  QuestionnaireSubmit,
} from './questionnaire';

const meta = {
  title: 'UI/Questionnaire',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const questions = [
  {
    name: 'role',
    title: '어떤 일을 하시나요?',
    required: true,
    choices: [
      { value: 'design', label: '디자인' },
      { value: 'develop', label: '개발' },
      { value: 'product', label: '기획' },
    ],
  },
  {
    name: 'team',
    title: '팀 규모는 어떻게 되나요?',
    required: true,
    choices: [
      { value: 'solo', label: '혼자' },
      { value: 'small', label: '2–10명' },
      { value: 'large', label: '11명 이상' },
    ],
  },
];
function Survey({ single = false }: { single?: boolean }) {
  const [result, setResult] = useState<string | null>(null);
  const items = single ? questions.slice(0, 1) : questions;
  return (
    <div className="w-[min(85vw,440px)]">
      {result ? (
        <div role="status" className="rounded-xl border p-6">
          <h3 className="font-semibold">응답이 저장되었습니다</h3>
          <p className="mt-2 text-sm text-muted-foreground">{result}</p>
        </div>
      ) : (
        <Questionnaire
          items={items}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setResult(
              items
                .map(
                  (item) =>
                    item.choices.find(
                      (choice) => choice.value === data.get(item.name),
                    )?.label ?? '미선택',
                )
                .join(' · '),
            );
          }}
        >
          <QuestionnaireProgress />
          {items.map((item) => (
            <QuestionnaireItem key={item.name} name={item.name} required>
              <QuestionnaireTitle>{item.title}</QuestionnaireTitle>
              <QuestionnaireDescription>
                맞춤 워크스페이스 설정을 위한 질문입니다.
              </QuestionnaireDescription>
              <QuestionnaireChoices>
                {item.choices.map((choice) => (
                  <QuestionnaireChoice key={choice.value} value={choice.value}>
                    {choice.label}
                  </QuestionnaireChoice>
                ))}
              </QuestionnaireChoices>
              <QuestionnaireError />
            </QuestionnaireItem>
          ))}
          <QuestionnaireActions>
            <QuestionnairePrevious>이전</QuestionnairePrevious>
            <QuestionnaireNext>다음</QuestionnaireNext>
            <QuestionnaireSubmit>완료</QuestionnaireSubmit>
          </QuestionnaireActions>
        </Questionnaire>
      )}
    </div>
  );
}
export const Onboarding: Story = { render: () => <Survey /> };
export const SingleQuestion: Story = { render: () => <Survey single /> };

export const Interaction: Story = {
  ...Onboarding,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('radio', { name: '개발' }));
    await userEvent.click(canvas.getByRole('button', { name: '다음' }));
    await userEvent.click(await canvas.findByRole('radio', { name: '2–10명' }));
    await userEvent.click(canvas.getByRole('button', { name: '완료' }));
    await expect(canvas.getByRole('status')).toHaveTextContent('개발 · 2–10명');
  },
};
