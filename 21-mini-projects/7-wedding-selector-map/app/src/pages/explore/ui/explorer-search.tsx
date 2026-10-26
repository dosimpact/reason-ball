import {
  ChevronDown,
  MapPin,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import type { ExplorerSectionProps } from "../model/use-explorer";
type ExplorerSearchProps = ExplorerSectionProps<
  | "filters"
  | "regions"
  | "setVisibleCount"
  | "setSelectedId"
  | "moreFilters"
  | "setMoreFilters"
  | "activeCount"
>;
export function ExplorerSearch({
  filters,
  regions,
  setVisibleCount,
  setSelectedId,
  moreFilters,
  setMoreFilters,
  activeCount,
}: ExplorerSearchProps) {
  return (
    <section className="search-section" aria-label="업체 검색 조건">
      <div className="search-control">
        <Search size={19} />
        <input
          aria-label="업체명 또는 지역 검색"
          placeholder="어떤 공간을 찾고 계신가요?"
          value={filters.query}
          onChange={(event) => {
            filters.setQuery(event.target.value);
            setVisibleCount(24);
          }}
        />
        {filters.query && (
          <button
            aria-label="검색어 지우기"
            onClick={() => filters.setQuery("")}
          >
            <X size={15} />
          </button>
        )}
      </div>
      <div className="filter-select">
        <MapPin size={17} />
        <select
          aria-label="지역 선택"
          value={filters.region}
          onChange={(event) => {
            filters.setRegion(event.target.value);
            setSelectedId(null);
            setVisibleCount(24);
          }}
        >
          <option value="전체">전국 모든 지역</option>
          <option value="서울">서울 전체</option>
          {regions.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>
        <ChevronDown size={13} />
      </div>
      {filters.kind === "venue" && (
        <div className="filter-select guest-filter">
          <Users size={17} />
          <select
            aria-label="비교 하객 수"
            value={filters.guests}
            onChange={(e) => filters.setGuests(Number(e.target.value))}
          >
            {Array.from(
              new Set([
                50,
                100,
                150,
                200,
                250,
                300,
                400,
                500,
                600,
                filters.guests,
              ]),
            )
              .sort((a, b) => a - b)
              .map((n) => (
                <option key={n} value={n}>
                  하객 {n}명
                </option>
              ))}
          </select>
          <ChevronDown size={13} />
        </div>
      )}
      <Button
        variant={moreFilters ? "default" : "outline"}
        className="filter-more"
        onClick={() => setMoreFilters(!moreFilters)}
        aria-expanded={moreFilters}
      >
        <SlidersHorizontal size={16} />
        <span>조건 설정</span>
        {activeCount > 0 && <b>{activeCount}</b>}
      </Button>
    </section>
  );
}
