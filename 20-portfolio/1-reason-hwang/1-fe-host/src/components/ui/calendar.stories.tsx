import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { Calendar } from './calendar';

const meta = {
  title: 'UI/Calendar',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
function SingleDateDemo() {
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 8, 20));
  return (
    <div className="space-y-3">
      <Calendar
        mode="single"
        defaultMonth={new Date(2026, 8, 1)}
        selected={date}
        onSelect={setDate}
      />
      <p className="text-center text-sm" aria-live="polite">
        {date ? date.toLocaleDateString('ko-KR') : '날짜를 선택하세요'}
      </p>
    </div>
  );
}
export const SingleDate: Story = { render: () => <SingleDateDemo /> };
function RangeDemo() {
  const [range, setRange] = useState<
    import('react-day-picker').DateRange | undefined
  >({ from: new Date(2026, 8, 10), to: new Date(2026, 8, 16) });
  return (
    <Calendar
      mode="range"
      numberOfMonths={2}
      defaultMonth={new Date(2026, 8, 1)}
      selected={range}
      onSelect={setRange}
    />
  );
}
export const Range: Story = { render: () => <RangeDemo /> };
export const UnavailableDays: Story = {
  render: () => (
    <Calendar
      mode="single"
      defaultMonth={new Date(2026, 8, 1)}
      disabled={[{ dayOfWeek: [0, 6] }, { before: new Date(2026, 8, 7) }]}
    />
  ),
};
