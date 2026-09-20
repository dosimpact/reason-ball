import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const meta = {
  title: 'UI/Data Table',
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const customers = [
  { name: 'Alex Kim', email: 'alex@example.com', amount: 29000 },
  { name: 'Reason Hwang', email: 'reason@example.com', amount: 79000 },
  { name: 'Jamie Park', email: 'jamie@example.com', amount: 49000 },
  { name: 'Morgan Lee', email: 'morgan@example.com', amount: 19000 },
];
function CustomerTable({ empty = false }: { empty?: boolean }) {
  const [query, setQuery] = useState('');
  const [ascending, setAscending] = useState(true);
  const rows = (empty ? [] : customers)
    .filter((row) =>
      (row.name + ' ' + row.email).toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => (ascending ? a.amount - b.amount : b.amount - a.amount));
  return (
    <div className="w-[min(85vw,640px)] space-y-4">
      <div>
        <h3 className="font-semibold">고객 목록</h3>
        <p className="text-sm text-muted-foreground">
          이름·이메일로 검색하고 결제 금액순으로 정렬하세요.
        </p>
      </div>
      <Input
        aria-label="고객 검색"
        placeholder="이름 또는 이메일 검색…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="max-w-xs"
      />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>고객</TableHead>
              <TableHead>이메일</TableHead>
              <TableHead
                className="text-right"
                aria-sort={ascending ? 'ascending' : 'descending'}
              >
                <Button
                  variant="ghost"
                  onClick={() => setAscending(!ascending)}
                >
                  결제 금액 {ascending ? '↑' : '↓'}
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow key={row.email}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell className="text-right">
                    ₩{row.amount.toLocaleString('ko-KR')}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="h-28 text-center text-muted-foreground"
                >
                  일치하는 고객이 없습니다.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p role="status" className="text-xs text-muted-foreground">
        {rows.length}명의 고객
      </p>
    </div>
  );
}
export const SearchAndSort: Story = { render: () => <CustomerTable /> };
export const Empty: Story = { render: () => <CustomerTable empty /> };

export const Interaction: Story = {
  ...SearchAndSort,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /결제 금액/ }));
    await expect(canvas.getAllByRole('row')[1]).toHaveTextContent(
      'Reason Hwang',
    );
    await userEvent.type(
      canvas.getByRole('textbox', { name: '고객 검색' }),
      'alex',
    );
    await expect(canvas.getByRole('status')).toHaveTextContent('1명의 고객');
    await expect(canvas.getByRole('cell', { name: 'Alex Kim' })).toBeVisible();
  },
};
