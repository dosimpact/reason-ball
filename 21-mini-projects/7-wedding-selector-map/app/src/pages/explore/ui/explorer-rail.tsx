import Link from "next/link";
import { BookOpen, Compass, Heart, Scale, TableProperties } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { ExplorerSectionProps } from "../model/use-explorer";
type ExplorerRailProps = ExplorerSectionProps<
  | "filters"
  | "favorites"
  | "comparison"
  | "setSelectedId"
  | "setCompareOpen"
  | "setGuideOpen"
  | "showFavorites"
>;
export function ExplorerRail({
  filters,
  favorites,
  comparison,
  setSelectedId,
  setCompareOpen,
  setGuideOpen,
  showFavorites,
}: ExplorerRailProps) {
  return (
    <aside className="side-rail" aria-label="빠른 메뉴">
      <Link className="rail-monogram" href="/" aria-label="오롯 홈">
        o<span>r</span>
      </Link>
      <div className="rail-top">
        <button
          className={cn("rail-item", !filters.favoritesOnly && "active")}
          onClick={() => {
            filters.setFavoritesOnly(false);
            setSelectedId(null);
          }}
          aria-label="업체 탐색"
        >
          <Compass size={21} />
          <span>탐색</span>
        </button>
        <Link className="rail-item" href="/prices" aria-label="가격표 페이지">
          <TableProperties size={21} />
          <span>가격표</span>
        </Link>
        <button
          className={cn("rail-item", filters.favoritesOnly && "active")}
          onClick={showFavorites}
          aria-label="저장한 업체"
          aria-pressed={filters.favoritesOnly}
        >
          <Heart size={20} />
          <span>저장</span>
          {favorites.ids.length > 0 && <i>{favorites.ids.length}</i>}
        </button>
        <button
          className="rail-item"
          onClick={() => setCompareOpen(true)}
          aria-label="비교함 열기"
        >
          <Scale size={21} />
          <span>비교</span>
          {comparison.ids.length > 0 && <i>{comparison.ids.length}</i>}
        </button>
      </div>
      <button
        className="rail-item rail-guide"
        onClick={() => setGuideOpen(true)}
        aria-label="가격 비교 가이드"
      >
        <BookOpen size={19} />
        <span>가이드</span>
      </button>
      <div className="rail-bottom">
        WITH
        <br />
        LOVE
      </div>
    </aside>
  );
}
