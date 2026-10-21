import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from './pagination';

const meta = {
  title: 'UI/Pagination',
  tags: ['autodocs'],
  parameters: { layout: 'centered', controls: { disable: true } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
function Pages() {
  const [page, setPage] = useState(1);
  return (
    <div className="space-y-4">
      <p role="status" className="text-center text-sm">
        {page} / 5 페이지 · 항목 {(page - 1) * 10 + 1}–{page * 10}
      </p>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#previous"
              aria-disabled={page === 1}
              onClick={(event) => {
                event.preventDefault();
                setPage(Math.max(1, page - 1));
              }}
            />
          </PaginationItem>
          {[1, 2, 3, 4, 5].map((n) => (
            <PaginationItem key={n}>
              <PaginationLink
                href={'#page-' + n}
                isActive={page === n}
                onClick={(event) => {
                  event.preventDefault();
                  setPage(n);
                }}
              >
                {n}
              </PaginationLink>
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext
              href="#next"
              aria-disabled={page === 5}
              onClick={(event) => {
                event.preventDefault();
                setPage(Math.min(5, page + 1));
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
export const InteractivePages: Story = { render: () => <Pages /> };
export const ManyPages: Story = {
  render: () => (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationLink href="#page-1" isActive>
            1
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#page-2">2</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationEllipsis />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#page-24">24</PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  ),
};

export const Interaction: Story = {
  ...InteractivePages,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Go to next page' }),
    );
    await expect(canvas.getByRole('status')).toHaveTextContent('2 / 5 페이지');
    await expect(canvas.getByRole('button', { name: '2' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  },
};
