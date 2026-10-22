import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from './input-otp';

const meta = {
  title: 'UI/Input OTP',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const VerificationCode: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">이메일 인증</h3>
        <p className="text-sm text-muted-foreground">
          전송된 6자리 인증번호를 입력하세요.
        </p>
      </div>
      <InputOTP maxLength={6} aria-label="인증번호">
        <InputOTPGroup>
          {[0, 1, 2].map((index) => (
            <InputOTPSlot key={index} index={index} />
          ))}
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          {[3, 4, 5].map((index) => (
            <InputOTPSlot key={index} index={index} />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>
  ),
};
export const Disabled: Story = {
  render: () => (
    <InputOTP maxLength={4} value="1234" disabled aria-label="완료된 코드">
      <InputOTPGroup>
        {[0, 1, 2, 3].map((index) => (
          <InputOTPSlot key={index} index={index} />
        ))}
      </InputOTPGroup>
    </InputOTP>
  ),
};

export const Interaction: Story = {
  ...VerificationCode,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: '인증번호' });
    await userEvent.type(input, '123456');
    await expect(input).toHaveValue('123456');
  },
};
