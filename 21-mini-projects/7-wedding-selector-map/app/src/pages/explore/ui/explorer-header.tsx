import Link from "next/link";
import { ArrowRight, Scale, TableProperties } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import type { ExplorerSectionProps } from "../model/use-explorer";
type ExplorerHeaderProps = ExplorerSectionProps<
  | "filters"
  | "changeKind"
  | "setGuideOpen"
  | "setCompareOpen"
  | "comparisonVendors"
>;
export function ExplorerHeader({
  filters,
  changeKind,
  setGuideOpen,
  setCompareOpen,
  comparisonVendors,
}: ExplorerHeaderProps) {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="오롯 웨딩 아틀라스">
        <strong>
          오롯<span>·</span>
        </strong>
        <span>WEDDING ATLAS</span>
      </Link>
      <nav className="header-nav" aria-label="탐색 종류">
        <button
          onClick={() => changeKind("venue")}
          className={cn(filters.kind === "venue" && "active")}
        >
          웨딩홀 찾기
        </button>
        <button
          onClick={() => changeKind("planning")}
          className={cn(filters.kind === "planning" && "active")}
        >
          스드메 · 플래닝
        </button>
        <Link href="/prices" className="header-price-link">
          가격표
        </Link>
        <button onClick={() => setGuideOpen(true)}>
          비교 가이드 <ArrowRight size={12} />
        </button>
      </nav>
      <Link
        href="/prices"
        className="header-prices-mobile"
        aria-label="모바일 가격표 페이지"
      >
        <TableProperties size={17} />
        <span>가격표</span>
      </Link>
      <Button
        variant="outline"
        className="header-compare"
        onClick={() => setCompareOpen(true)}
      >
        <Scale size={16} />
        나의 비교함<span>{comparisonVendors.length}</span>
      </Button>
    </header>
  );
}
