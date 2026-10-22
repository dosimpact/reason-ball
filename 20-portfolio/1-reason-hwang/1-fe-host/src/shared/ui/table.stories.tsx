import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from './table';

const meta = {
  title: 'UI/Table',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Invoices: Story = {
  render: () => (
    <div className="w-[min(85vw,640px)]">
      <Table>
        <TableCaption>2026년 9월 청구 내역</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>청구 번호</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>결제 수단</TableHead>
            <TableHead className="text-right">금액</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            ['INV-001', '결제 완료', '카드', '₩29,000'],
            ['INV-002', '대기', '계좌이체', '₩49,000'],
            ['INV-003', '결제 완료', '카드', '₩19,000'],
          ].map((row) => (
            <TableRow key={row[0]}>
              {row.map((cell, i) => (
                <TableCell key={i} className={i === 3 ? 'text-right' : ''}>
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3}>합계</TableCell>
            <TableCell className="text-right">₩97,000</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  ),
};
export const EmptyState: Story = {
  render: () => (
    <Table className="w-80">
      <TableHeader>
        <TableRow>
          <TableHead>이름</TableHead>
          <TableHead>상태</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell
            colSpan={2}
            className="h-32 text-center text-muted-foreground"
          >
            표시할 데이터가 없습니다.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};
