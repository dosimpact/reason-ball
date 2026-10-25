"use client";

import {
  ArrowDown,
  ArrowDownUp,
  ArrowRight,
  ArrowUp,
  Check,
  Heart,
  MoveHorizontal,
  Search,
} from "lucide-react";
import { useEffect, useRef } from "react";
import type { VendorKind } from "@/entities/vendor";
import type {
  PriceTableRow,
  PriceTableSort,
  PriceTableSortKey,
} from "@/features/price-table";
import { money, number } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import "./price-table.css";

export interface PriceTableProps {
  rows: PriceTableRow[];
  kind: VendorKind;
  sort: PriceTableSort;
  onSort: (key: PriceTableSortKey) => void;
  onSelect: (id: string) => void;
  onFavorite: (id: string) => void;
  onCompare: (id: string) => void;
  favoriteIds: readonly string[];
  comparisonIds: readonly string[];
  startIndex?: number;
  priceScaleMax?: number;
  selectedId?: string | null;
  guests?: number;
}

/** The table only presents normalized rows; selection and price calculations live below it. */
export function PriceTable(props: PriceTableProps) {
  const { rows, kind, priceScaleMax, startIndex } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const firstRowId = rows[0]?.id;
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [startIndex, firstRowId]);
  const maximum = Math.max(
    priceScaleMax ?? 0,
    ...rows.map((row) => row.priceMax ?? row.price ?? 0),
    1,
  );
  if (rows.length === 0) return <EmptyTable />;
  return (
    <section className="price-table-widget" aria-label="가격 비교 테이블">
      <div
        className="pt-table-scroll"
        ref={scrollRef}
        role="region"
        aria-label="가격표 가로·세로 스크롤"
        tabIndex={0}
      >
        <table
          className={cn("pt-table", kind === "planning" && "pt-table-planning")}
          aria-label={
            kind === "venue" ? "웨딩홀 가격 비교표" : "준비대행 가격 비교표"
          }
        >
          <caption className="pt-visually-hidden">
            {kind === "venue"
              ? "같은 하객 수에 적용한 홀별 식대와 대관료를 비교합니다. 장식과 미확인 필수 옵션은 별도입니다."
              : "선택한 상품 분류와 산정 단위의 기본가만 비교합니다. 서로 다른 상품을 합산하지 않습니다."}
          </caption>
          <TableColumns kind={kind} />
          <TableHead {...props} />
          <tbody>
            {rows.map((row, index) => (
              <VendorRow
                key={row.id}
                {...props}
                row={row}
                index={(props.startIndex ?? 0) + index}
                maximum={maximum}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="pt-table-key" aria-label="가격 막대 안내">
        <span>
          <i className="pt-key-min" />
          확인된 최저 금액
        </span>
        <span>
          <i className="pt-key-range" />
          같은 상품의 가격 범위
        </span>
        <span className="pt-scroll-tip">
          <MoveHorizontal size={12} />
          옆으로 밀어 {kind === "venue" ? "식대·조건" : "상품·조건"} 더 보기
        </span>
        <span className="pt-table-key-note">
          금액이 없는 항목은 0원으로 계산하지 않아요.
        </span>
      </div>
    </section>
  );
}

function TableColumns({ kind }: { kind: VendorKind }) {
  return (
    <colgroup>
      <col className="pt-col-select" />
      <col className="pt-col-vendor" />
      <col className="pt-col-price" />
      {kind === "venue" ? (
        <>
          <col className="pt-col-meal" />
          <col className="pt-col-rental" />
          <col className="pt-col-guests" />
        </>
      ) : (
        <col className="pt-col-basis" />
      )}
      <col className="pt-col-condition" />
      <col className="pt-col-year" />
      <col className="pt-col-actions" />
    </colgroup>
  );
}

type HeadProps = Pick<PriceTableProps, "kind" | "guests" | "sort" | "onSort">;
function TableHead({ kind, guests, sort, onSort }: HeadProps) {
  const sortable = (
    key: PriceTableSortKey,
    label: string,
    className?: string,
  ) => (
    <SortHeader
      key={key}
      column={key}
      sort={sort}
      onSort={onSort}
      className={className}
    >
      {label}
    </SortHeader>
  );
  return (
    <thead>
      <tr>
        <th scope="col" className="pt-sticky-select">
          <span title="최대 3곳을 선택해 비교함에 담을 수 있어요">비교</span>
        </th>
        {sortable("name", "업체명", "pt-sticky-vendor")}
        {sortable(
          "price",
          kind === "venue" ? `${guests ?? 200}명 참고비용` : "선택 상품 가격",
          "pt-primary-heading",
        )}
        {kind === "venue" ? (
          <>
            {sortable("meal", "성인 1인 식대")}
            {sortable("rental", "대관료")}
            {sortable("guarantee", "보증 / 적용 인원")}
          </>
        ) : (
          <th scope="col">상품 · 산정 단위</th>
        )}
        <th scope="col">비교 조건</th>
        {sortable("year", "적용연도")}
        <th scope="col" className="pt-actions-heading">
          저장 · 상세
        </th>
      </tr>
    </thead>
  );
}

function SortHeader({
  column,
  sort,
  onSort,
  className,
  children,
}: {
  column: PriceTableSortKey;
  sort: PriceTableSort;
  onSort: (key: PriceTableSortKey) => void;
  className?: string;
  children: string;
}) {
  const active =
    sort.key === column || (column === "guarantee" && sort.key === "guests");
  const Icon = active
    ? sort.direction === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowDownUp;
  return (
    <th
      scope="col"
      className={cn(className, active && "pt-sorted")}
      aria-sort={
        active
          ? sort.direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-label={`${children} 정렬`}
      >
        <span>{children}</span>
        <Icon size={12} strokeWidth={active ? 2 : 1.5} aria-hidden="true" />
      </button>
    </th>
  );
}

type RowProps = PriceTableProps & {
  row: PriceTableRow;
  index: number;
  maximum: number;
};
function VendorRow({
  row,
  index,
  maximum,
  kind,
  guests,
  favoriteIds,
  comparisonIds,
  selectedId,
  onSelect,
  onFavorite,
  onCompare,
}: RowProps) {
  const { vendor } = row;
  const favorite = favoriteIds.includes(vendor.id);
  const compared = comparisonIds.includes(vendor.id);
  const compareFull = !compared && comparisonIds.length >= 3;
  return (
    <tr
      className={cn(
        compared && "pt-is-compared",
        selectedId === vendor.id && "pt-is-selected",
      )}
      data-vendor-id={vendor.id}
      data-price={row.price ?? "unknown"}
    >
      <td className="pt-sticky-select pt-selection-cell">
        <label
          className={cn(
            "pt-checkbox",
            compared && "is-checked",
            compareFull && "is-disabled",
          )}
          title={
            compareFull
              ? "비교함은 최대 3곳까지 담을 수 있어요"
              : "같은 조건으로 나란히 비교하기"
          }
        >
          <input
            type="checkbox"
            checked={compared}
            disabled={compareFull}
            onChange={() => onCompare(vendor.id)}
            aria-label={`${vendor.name} 비교 선택`}
          />
          <span aria-hidden="true">
            {compared && <Check size={12} strokeWidth={2.5} />}
          </span>
        </label>
      </td>
      <th scope="row" className="pt-sticky-vendor pt-vendor-cell">
        <div className="pt-vendor-identity">
          <span className="pt-row-number">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div>
            <button
              type="button"
              className="pt-vendor-name"
              onClick={() => onSelect(vendor.id)}
              aria-label={`${vendor.name} 가격 상세 보기`}
              title={vendor.name}
            >
              {vendor.name}
            </button>
            <div className="pt-vendor-meta">
              <span>{vendor.region}</span>
              {vendor.archived && (
                <span className="pt-previous-price">이전 가격</span>
              )}
              {compared && <span className="pt-compared-tag">비교 중</span>}
            </div>
          </div>
        </div>
      </th>
      <td className="pt-primary-cell">
        <PriceCell row={row} maximum={maximum} kind={kind} />
      </td>
      {kind === "venue" ? (
        <>
          <td className="pt-number-cell">
            <AmountRange min={row.meal} max={row.mealMax} />
            <small>같은 홀 · 1인 기준</small>
          </td>
          <td className="pt-number-cell">
            <AmountRange min={row.rental} max={row.rentalMax} />
            <small>
              {row.rentalKind === "combined"
                ? "대관·장식 합계"
                : "선택한 홀 기준"}
            </small>
          </td>
          <td className="pt-guests-cell">
            <GuestCell row={row} guests={guests} />
          </td>
        </>
      ) : (
        <td className="pt-basis-cell">
          <span className="pt-basis-tag">{row.basisLabel}</span>
          <small>같은 상품·단위 기준</small>
        </td>
      )}
      <td className="pt-condition-cell">
        <ConditionCell row={row} onSelect={onSelect} />
      </td>
      <td className="pt-year-cell">
        {vendor.priceYear ? (
          <>
            <b>{vendor.priceYear}</b>
            <small>년 적용</small>
          </>
        ) : (
          <span className="pt-unknown">미기재</span>
        )}
      </td>
      <td className="pt-actions-cell">
        <div className="pt-row-actions">
          <button
            type="button"
            className={cn("pt-save", favorite && "is-saved")}
            aria-label={`${vendor.name} ${favorite ? "저장 해제" : "저장"}`}
            aria-pressed={favorite}
            onClick={() => onFavorite(vendor.id)}
            title={favorite ? "저장 해제" : "관심 업체 저장"}
          >
            <Heart
              size={15}
              strokeWidth={1.5}
              fill={favorite ? "currentColor" : "none"}
            />
          </button>
          <button
            type="button"
            className="pt-open-detail"
            onClick={() => onSelect(vendor.id)}
            aria-label={`${vendor.name} 상세 열기`}
            title="가격과 조건 자세히"
          >
            <ArrowRight size={15} strokeWidth={1.5} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function amount(value: number) {
  return value === 0 ? "0원" : money(value);
}
function AmountRange({ min, max }: { min: number | null; max: number | null }) {
  if (min == null) return <span className="pt-unknown">미확인</span>;
  return (
    <span className="pt-amount">
      {amount(min)}
      {max != null && max !== min && (
        <span className="pt-range-max"> ~ {amount(max)}</span>
      )}
    </span>
  );
}

function PriceCell({
  row,
  maximum,
  kind,
}: {
  row: PriceTableRow;
  maximum: number;
  kind: VendorKind;
}) {
  if (row.price == null)
    return (
      <div className="pt-no-price">
        <strong>가격 정보 없음</strong>
        <span>상담 시 확인해보세요</span>
        {row.freeAvailable && <small>조건별 무료 항목 있음</small>}
        {row.includedAvailable && <small>다른 상품에 포함된 항목 있음</small>}
      </div>
    );
  const percent = (value: number) =>
    `${Math.min(100, Math.max(0, (value / maximum) * 100))}%`;
  return (
    <div className="pt-price">
      <strong>
        <AmountRange min={row.price} max={row.priceMax} />
      </strong>
      <div
        className="pt-price-bar"
        role="img"
        aria-label={`확인된 최저 ${amount(row.price)}${row.priceMax != null && row.priceMax !== row.price ? `, 최고 ${amount(row.priceMax)}` : ""}. 현재 표본 내 상대 금액 막대`}
      >
        <span
          className="pt-bar-range"
          style={{ width: percent(row.priceMax ?? row.price) }}
        />
        <span className="pt-bar-min" style={{ width: percent(row.price) }} />
      </div>
      <span className="pt-price-note">
        {kind === "venue"
          ? row.rental == null
            ? "식대만 확인 · 대관 별도 확인"
            : "식대 + 대관 · 추가 옵션 별도"
          : "기본 구성 · 추가 옵션 별도"}
      </span>
      {(row.freeAvailable || row.includedAvailable) && (
        <div className="pt-price-flags">
          {row.freeAvailable && <span>조건별 무료 항목</span>}
          {row.includedAvailable && <span>다른 상품에 포함</span>}
        </div>
      )}
    </div>
  );
}

function GuestCell({ row, guests }: { row: PriceTableRow; guests?: number }) {
  const guaranteeApplied =
    guests != null && row.billableGuests != null && row.billableGuests > guests;
  return (
    <div className={cn("pt-guests", guaranteeApplied && "is-guaranteed")}>
      <strong>
        {row.guarantee == null ? (
          <span className="pt-unknown">보증 미확인</span>
        ) : (
          `${number(row.guarantee)}명`
        )}
      </strong>
      <small>
        {row.billableGuests == null
          ? "계산 조건 확인 필요"
          : `${number(row.billableGuests)}명 적용`}
      </small>
      {guaranteeApplied && <span>보증 인원 반영</span>}
    </div>
  );
}

function ConditionCell({
  row,
  onSelect,
}: {
  row: PriceTableRow;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="pt-condition">
      {row.offerLabel && (
        <strong title={row.offerLabel}>{row.offerLabel}</strong>
      )}
      <button
        type="button"
        onClick={() => onSelect(row.id)}
        title={row.condition || "상담 시 적용 조건을 확인해주세요"}
        aria-label={`${row.vendor.name} 적용 조건 자세히`}
      >
        {row.condition || "상품 구성과 적용 시점을 상담 시 확인해주세요."}
      </button>
    </div>
  );
}

function EmptyTable() {
  return (
    <section
      className="price-table-widget pt-empty"
      aria-label="가격표 빈 결과"
    >
      <Search size={28} strokeWidth={1.2} />
      <h2>조건에 맞는 업체가 없어요</h2>
      <p>검색어나 지역·가격 조건을 조금 넓혀보세요.</p>
    </section>
  );
}
