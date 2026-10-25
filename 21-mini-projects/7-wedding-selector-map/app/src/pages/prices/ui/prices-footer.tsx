import { ArrowRight, ChevronLeft, ChevronRight, Scale, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import type { PriceBrowserProps } from "../model/use-price-browser";
type PaginationProps = PriceBrowserProps<
  "pagination" | "filters" | "updateFilters"
>;
export function PricesPagination({
  pagination,
  filters,
  updateFilters,
}: PaginationProps) {
  const start = Math.max(
    1,
    Math.min(pagination.page - 2, pagination.pageCount - 4),
  );
  const pages = Array.from(
    { length: Math.min(5, pagination.pageCount) },
    (_, i) => start + i,
  );
  return (
    <footer className="prices-pagination">
      <span>
        <b>
          {pagination.start}–{pagination.end}
        </b>{" "}
        / {pagination.total}곳
      </span>
      <nav aria-label="가격표 페이지 이동">
        <button
          aria-label="이전 가격표 페이지"
          disabled={pagination.page <= 1}
          onClick={() => updateFilters({ page: pagination.page - 1 })}
        >
          <ChevronLeft size={16} />
        </button>
        {pages.map((page) => (
          <button
            key={page}
            aria-label={`가격표 ${page}페이지`}
            aria-current={page === pagination.page ? "page" : undefined}
            className={page === pagination.page ? "active" : ""}
            onClick={() => updateFilters({ page })}
          >
            {page}
          </button>
        ))}
        <button
          aria-label="다음 가격표 페이지"
          disabled={pagination.page >= pagination.pageCount}
          onClick={() => updateFilters({ page: pagination.page + 1 })}
        >
          <ChevronRight size={16} />
        </button>
      </nav>
      <label>
        한 번에
        <select
          aria-label="가격표 표시 개수"
          value={filters.pageSize}
          onChange={(event) =>
            updateFilters({ pageSize: Number(event.target.value) })
          }
        >
          {[20, 50, 100].map((size) => (
            <option value={size} key={size}>
              {size}개
            </option>
          ))}
        </select>
      </label>
    </footer>
  );
}
type SelectionProps = PriceBrowserProps<
  "comparisonVendors" | "comparison" | "setCompareOpen"
>;
export function PricesSelection({
  comparisonVendors,
  comparison,
  setCompareOpen,
}: SelectionProps) {
  if (!comparisonVendors.length) return null;
  return (
    <section className="prices-selection" aria-label="선택한 비교 업체">
      <div className="prices-selection-copy">
        <Scale size={20} />
        <span>
          마음에 담은 후보,<strong>나란히 살펴볼까요?</strong>
        </span>
      </div>
      <div className="prices-selection-items">
        {comparisonVendors.map((vendor) => (
          <span key={vendor.id}>
            {vendor.name}
            <button
              aria-label={`${vendor.name} 가격표 비교 해제`}
              onClick={() => comparison.toggle(vendor.id)}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <Button onClick={() => setCompareOpen(true)}>
        {comparisonVendors.length}곳 자세히 비교 <ArrowRight size={14} />
      </Button>
    </section>
  );
}
