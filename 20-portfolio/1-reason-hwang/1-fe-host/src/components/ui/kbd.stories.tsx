import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Kbd, KbdGroup } from './kbd';

const meta = {
  title: 'UI/Kbd',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Shortcuts: Story = {
  render: () => (
    <div className="space-y-4 text-sm">
      {[
        ['검색', '⌘', 'K'],
        ['저장', '⌘', 'S'],
        ['빠른 실행', '⌘', '⇧', 'P'],
      ].map(([label, ...keys]) => (
        <div key={label} className="flex w-64 items-center justify-between">
          <span>{label}</span>
          <KbdGroup>
            {keys.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </KbdGroup>
        </div>
      ))}
    </div>
  ),
};
export const InlineHelp: Story = {
  render: () => (
    <p className="text-sm text-muted-foreground">
      <Kbd>Tab</Kbd>으로 이동하고 <Kbd>Enter</Kbd>로 선택하세요.
    </p>
  ),
};
