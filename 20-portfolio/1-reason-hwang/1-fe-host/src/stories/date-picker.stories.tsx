import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

const meta = {
  title: 'UI/Date Picker',
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
function DatePickerDemo({ empty = false }: { empty?: boolean }) {
  const [date, setDate] = useState<Date | undefined>(
    empty ? undefined : new Date(2026, 8, 20),
  );
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">예약 날짜</p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={<Button variant="outline" className="w-64 justify-start" />}
        >
          {date ? format(date, 'yyyy년 MM월 dd일') : '날짜 선택'}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            defaultMonth={new Date(2026, 8, 1)}
            selected={date}
            onSelect={(value) => {
              setDate(value);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      <p className="text-xs text-muted-foreground">
        달력에서 날짜를 선택하면 자동으로 닫힙니다.
      </p>
    </div>
  );
}
export const BookingDate: Story = { render: () => <DatePickerDemo /> };
export const Empty: Story = { render: () => <DatePickerDemo empty /> };
