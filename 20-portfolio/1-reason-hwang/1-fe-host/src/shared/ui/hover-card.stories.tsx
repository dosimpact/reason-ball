import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { HoverCard, HoverCardTrigger, HoverCardContent } from './hover-card';

const meta = {
  title: 'UI/Hover Card',
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    controls: { disable: true },
    docs: { story: { inline: false, height: 420 } },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const ProfilePreview: Story = {
  render: () => (
    <HoverCard>
      <HoverCardTrigger
        href="https://github.com"
        className="text-sm underline underline-offset-4"
      >
        @reason
      </HoverCardTrigger>
      <HoverCardContent>
        <div className="flex gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            RH
          </div>
          <div>
            <h3 className="font-semibold">Reason Hwang</h3>
            <p className="mt-1 text-muted-foreground">
              Frontend Engineer · Design systems
            </p>
            <p className="mt-3">프로젝트 12개 · 서울</p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  ),
};
export const OpenPreview: Story = {
  render: () => (
    <HoverCard defaultOpen>
      <HoverCardTrigger href="https://react.dev" className="underline">
        React 문서
      </HoverCardTrigger>
      <HoverCardContent>
        <h3 className="font-semibold">React</h3>
        <p className="mt-2 text-muted-foreground">
          사용자 인터페이스를 만드는 라이브러리입니다.
        </p>
      </HoverCardContent>
    </HoverCard>
  ),
};
