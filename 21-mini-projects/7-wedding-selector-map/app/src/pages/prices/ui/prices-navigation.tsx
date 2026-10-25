import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Compass,
  Heart,
  Scale,
  TableProperties,
  Download,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import type { PriceBrowserProps } from "../model/use-price-browser";
type NavProps = PriceBrowserProps<
  | "filters"
  | "updateFilters"
  | "favorites"
  | "comparisonVendors"
  | "setCompareOpen"
  | "setGuideOpen"
>;
export function PricesRail({
  filters,
  updateFilters,
  favorites,
  comparisonVendors,
  setCompareOpen,
  setGuideOpen,
}: NavProps) {
  return (
    <aside className="prices-rail" aria-label="빠른 메뉴">
      <Link
        className="prices-monogram"
        href="/"
        prefetch={false}
        aria-label="오롯 홈"
      >
        o<span>r</span>
      </Link>
      <nav className="prices-rail-links">
        <Link
          className="prices-rail-item"
          href="/"
          prefetch={false}
          aria-label="지도 탐색"
        >
          <Compass size={21} />
          <span>탐색</span>
        </Link>
        <Link
          className="prices-rail-item active"
          href="/prices"
          aria-label="가격표 페이지"
          aria-current="page"
        >
          <TableProperties size={20} />
          <span>가격표</span>
        </Link>
        <button
          className={cn("prices-rail-item", filters.savedOnly && "active")}
          onClick={() => updateFilters({ savedOnly: !filters.savedOnly })}
          aria-label="가격표 저장한 업체"
          aria-pressed={filters.savedOnly}
        >
          <Heart size={20} />
          <span>저장</span>
          {favorites.ids.length > 0 && <i>{favorites.ids.length}</i>}
        </button>
        <button
          className="prices-rail-item"
          onClick={() => setCompareOpen(true)}
          aria-label="가격표 비교함 열기"
        >
          <Scale size={21} />
          <span>비교</span>
          {comparisonVendors.length > 0 && <i>{comparisonVendors.length}</i>}
        </button>
      </nav>
      <button
        className="prices-rail-item prices-rail-guide"
        onClick={() => setGuideOpen(true)}
        aria-label="가격표 사용 가이드"
      >
        <BookOpen size={19} />
        <span>가이드</span>
      </button>
      <p>
        WITH
        <br />
        LOVE
      </p>
    </aside>
  );
}
type HeaderProps = PriceBrowserProps<
  | "setCompareOpen"
  | "comparisonVendors"
  | "setGuideOpen"
  | "exportCsv"
  | "summary"
  | "isPending"
>;
export function PricesHeader({
  setCompareOpen,
  comparisonVendors,
  setGuideOpen,
  exportCsv,
  summary,
  isPending,
}: HeaderProps) {
  return (
    <header className="prices-header">
      <Link
        className="prices-brand"
        href="/"
        prefetch={false}
        aria-label="오롯 웨딩 아틀라스"
      >
        <strong>
          오롯<span>·</span>
        </strong>
        <span>
          WEDDING
          <br />
          ATLAS
        </span>
      </Link>
      <nav aria-label="페이지 이동">
        <Link href="/" prefetch={false}>
          지도에서 찾기 <ArrowRight size={12} />
        </Link>
        <span aria-current="page">가격표로 비교하기</span>
        <button onClick={() => setGuideOpen(true)}>비교 기준 안내</button>
      </nav>
      <div className="prices-header-actions">
        <Button
          variant="outline"
          onClick={exportCsv}
          disabled={!summary.count || isPending}
          className="prices-export"
        >
          <Download size={15} />
          <span>가격표 저장</span>
        </Button>
        <Button
          onClick={() => setCompareOpen(true)}
          className="prices-open-compare"
        >
          <Scale size={16} />
          비교함 <b>{comparisonVendors.length}</b>
        </Button>
      </div>
    </header>
  );
}
