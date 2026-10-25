import { Flower2, Info, List, Map as MapIcon, MapPin } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { ExplorerSectionProps } from "../model/use-explorer";
type ExplorerHeadingProps = ExplorerSectionProps<
  | "filters"
  | "changeKind"
  | "venueCount"
  | "planningCount"
  | "setGuideOpen"
  | "mobileView"
  | "setMobileView"
>;
export function ExplorerHeading({
  filters,
  changeKind,
  venueCount,
  planningCount,
  setGuideOpen,
  mobileView,
  setMobileView,
}: ExplorerHeadingProps) {
  return (
    <div className="explore-heading">
      <div className="kind-tabs" role="tablist" aria-label="공시 종류">
        <button
          role="tab"
          aria-selected={filters.kind === "venue"}
          className={cn(filters.kind === "venue" && "active")}
          onClick={() => changeKind("venue")}
        >
          <MapPin size={15} />
          웨딩홀<span>{venueCount}</span>
        </button>
        <button
          role="tab"
          aria-selected={filters.kind === "planning"}
          className={cn(filters.kind === "planning" && "active")}
          onClick={() => changeKind("planning")}
        >
          <Flower2 size={16} />
          스드메 · 플래닝<span>{planningCount}</span>
        </button>
      </div>
      <div className="explore-hint">
        <span className="status-dot" />
        공개자료로 비교하는 투명한 선택
        <button aria-label="공시 정보 안내" onClick={() => setGuideOpen(true)}>
          <Info size={14} />
        </button>
      </div>
      <div className="mobile-view-toggle">
        <button
          className={cn(mobileView === "list" && "active")}
          onClick={() => setMobileView("list")}
          aria-label="목록 보기"
        >
          <List size={16} />
        </button>
        <button
          className={cn(mobileView === "map" && "active")}
          onClick={() => setMobileView("map")}
          aria-label="지도 보기"
        >
          <MapIcon size={16} />
        </button>
      </div>
    </div>
  );
}
