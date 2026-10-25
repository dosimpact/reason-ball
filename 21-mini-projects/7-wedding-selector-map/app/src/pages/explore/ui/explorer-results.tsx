import { ArrowDownUp, ArrowRight, ChevronDown, Search } from "lucide-react";
import { VendorCard } from "@/entities/vendor";
import { Button } from "@/shared/ui/button";
import { PriceOverview } from "@/widgets/price-overview";
import type { ExplorerSectionProps } from "../model/use-explorer";

type ResultsProps = ExplorerSectionProps<
  | "mapOnly"
  | "setMapOnly"
  | "filters"
  | "visibleCount"
  | "setVisibleCount"
  | "selectedId"
  | "favorites"
  | "comparison"
  | "selectVendor"
  | "toggleCompare"
  | "resetFilters"
>;

export function ExplorerResults(props: ResultsProps) {
  return (
    <section className="results-panel" aria-label="업체 검색 결과">
      <label className="map-list-scope">
        <input
          type="checkbox"
          checked={props.mapOnly}
          onChange={(event) => props.setMapOnly(event.target.checked)}
        />
        현재 지도 범위만 보기
        <span>{props.mapOnly ? "위치 확인 업체만" : "모든 검색 결과"}</span>
      </label>
      <ResultsHeader filters={props.filters} />
      <div className="result-list">
        {props.filters.filtered.length ? (
          <ResultCards {...props} />
        ) : (
          <EmptyResults
            filters={props.filters}
            resetFilters={props.resetFilters}
          />
        )}
      </div>
    </section>
  );
}

function ResultsHeader({ filters }: ExplorerSectionProps<"filters">) {
  return (
    <div className="results-header">
      <div>
        <span>
          {filters.favoritesOnly
            ? "저장한 업체"
            : filters.region === "전체"
              ? "전국"
              : filters.region}
        </span>
        <strong>
          {" "}
          {filters.filtered.length}
          <small>곳의 {filters.kind === "venue" ? "웨딩홀" : "준비대행"}</small>
        </strong>
      </div>
      <label className="sort-control">
        <ArrowDownUp size={13} />
        <select
          aria-label="정렬 방식"
          value={filters.sort}
          onChange={(e) =>
            filters.setSort(e.target.value as typeof filters.sort)
          }
        >
          <option value="recommended">최근 공시순</option>
          <option value="price-asc">공개비용 낮은순</option>
          <option value="price-desc">공개비용 높은순</option>
          <option value="name">이름순</option>
        </select>
      </label>
    </div>
  );
}

function ResultCards({
  filters,
  visibleCount,
  setVisibleCount,
  selectedId,
  favorites,
  comparison,
  selectVendor,
  toggleCompare,
}: ResultsProps) {
  return (
    <>
      <PriceOverview
        defaultOpen={false}
        vendors={filters.filtered}
        guests={filters.guests}
        selectedId={selectedId}
      />
      {filters.filtered.slice(0, visibleCount).map((vendor, index) => (
        <VendorCard
          key={vendor.id}
          vendor={vendor}
          index={index}
          guests={filters.guests}
          selected={selectedId === vendor.id}
          favorite={favorites.ids.includes(vendor.id)}
          compared={comparison.ids.includes(vendor.id)}
          onSelect={() => selectVendor(vendor.id)}
          onFavorite={() => favorites.toggle(vendor.id)}
          onCompare={() => toggleCompare(vendor.id)}
        />
      ))}
      {visibleCount < filters.filtered.length && (
        <Button
          variant="outline"
          className="load-more"
          onClick={() => setVisibleCount(visibleCount + 24)}
        >
          더 많은 업체 보기 <ChevronDown size={15} />
        </Button>
      )}
      <p className="results-footnote">
        공시가의 적용 시점·홀·요일·시간에 따라 실제 견적이 달라질 수 있어요.
      </p>
    </>
  );
}

function EmptyResults({
  filters,
  resetFilters,
}: ExplorerSectionProps<"filters" | "resetFilters">) {
  return (
    <div className="empty-state">
      <Search size={32} strokeWidth={1} />
      <h2>
        {filters.favoritesOnly
          ? "아직 저장한 업체가 없어요"
          : "조건에 맞는 업체가 없어요"}
      </h2>
      <p>
        {filters.favoritesOnly
          ? "마음에 드는 업체의 하트를 눌러 모아보세요."
          : "지도를 이동·축소하거나 지도 범위 조건을 해제해보세요."}
      </p>
      <Button variant="outline" onClick={resetFilters}>
        모든 업체 둘러보기 <ArrowRight size={14} />
      </Button>
    </div>
  );
}
