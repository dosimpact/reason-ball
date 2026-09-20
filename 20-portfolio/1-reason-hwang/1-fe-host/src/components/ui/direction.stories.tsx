import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DirectionProvider } from './direction';
import { InputGroup, InputGroupInput, InputGroupAddon } from './input-group';

const meta = {
  title: 'UI/Direction',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Bidirectional: Story = {
  render: () => (
    <div className="space-y-8">
      {(['ltr', 'rtl'] as const).map((direction) => (
        <DirectionProvider key={direction} direction={direction}>
          <div dir={direction} className="w-72 space-y-2">
            <h3 className="text-sm font-semibold">
              {direction === 'ltr' ? 'Left to right' : 'من اليمين إلى اليسار'}
            </h3>
            <InputGroup>
              <InputGroupAddon>⌕</InputGroupAddon>
              <InputGroupInput
                aria-label={direction}
                placeholder={
                  direction === 'ltr' ? 'Search projects' : 'البحث عن المشاريع'
                }
              />
            </InputGroup>
            <p className="text-xs text-muted-foreground">
              {direction.toUpperCase()} · logical spacing
            </p>
          </div>
        </DirectionProvider>
      ))}
    </div>
  ),
};
