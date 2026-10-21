import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldSet,
  FieldLegend,
} from './field';
import { Input } from './input';

const meta = {
  title: 'UI/Field',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const ProfileForm: Story = {
  render: () => (
    <FieldSet className="w-80">
      <FieldLegend>프로필 설정</FieldLegend>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="field-name">표시 이름</FieldLabel>
          <Input id="field-name" defaultValue="Reason Hwang" />
          <FieldDescription>팀원에게 표시되는 이름입니다.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="field-email">이메일</FieldLabel>
          <Input id="field-email" type="email" placeholder="you@example.com" />
        </Field>
      </FieldGroup>
    </FieldSet>
  ),
};
export const ValidationError: Story = {
  render: () => (
    <Field data-invalid className="w-80">
      <FieldLabel htmlFor="invalid-email">이메일</FieldLabel>
      <Input
        id="invalid-email"
        defaultValue="invalid-email"
        aria-invalid
        aria-describedby="email-error"
      />
      <FieldError id="email-error">올바른 이메일 주소를 입력하세요.</FieldError>
    </Field>
  ),
};
