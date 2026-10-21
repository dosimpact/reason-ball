import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
  title: 'UI/Typography',
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Editorial: Story = {
  render: () => (
    <article className="max-w-xl space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-medium tracking-widest text-primary">
          DESIGN NOTES / 2026
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          작은 요소가 만드는 일관된 경험
        </h1>
        <p className="text-lg text-muted-foreground">
          명확한 정보 위계와 읽기 편한 본문을 위한 타이포그래피 예시입니다.
        </p>
      </header>
      <section className="space-y-3">
        <h2 className="border-b pb-2 text-2xl font-semibold tracking-tight">
          컴포넌트의 공통 언어
        </h2>
        <p className="text-sm leading-7">
          제목은 핵심 내용을 전달하고, 본문은 맥락을 설명합니다. 같은 크기와
          간격 규칙을 사용하면 여러 화면에서도 익숙한 흐름을 유지할 수 있습니다.
        </p>
        <blockquote className="border-l-2 pl-4 text-sm italic text-muted-foreground">
          좋은 인터페이스는 다음 행동을 쉽게 이해할 수 있도록 돕습니다.
        </blockquote>
      </section>
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">작성 원칙</h3>
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>동작을 설명하는 짧은 문장을 사용합니다.</li>
          <li>
            보조 정보는{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              text-muted-foreground
            </code>
            로 구분합니다.
          </li>
          <li>긴 문장도 편하게 읽을 수 있도록 줄 간격을 확보합니다.</li>
        </ul>
      </section>
      <p className="text-xs text-muted-foreground">
        최근 수정 · 2026년 9월 20일
      </p>
    </article>
  ),
};
